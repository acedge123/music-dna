import copy
import json
from pathlib import Path
import tempfile
import unittest
from datetime import datetime, timedelta

from monitoring.core import (PROJECT, RECIPIENT, UTC, advisor_objects, empty_state,
                             evaluate, iso, regression, sql_snapshot, cron_due)
from monitoring.worker import (ROOT, Store, Unavailable, Slack, Operator, atomic_json,
                               deliver, guard_sql, windows, collect, due_slot)

CONFIG = json.loads((ROOT / 'config.json').read_text())
NOW = datetime(2026, 11, 7, 6, 5, tzinfo=UTC)


def snap(**kw):
    return dict(observed_at=iso(NOW), transaction_read_only='on', statement_timeout='10s', **kw)


def observation(now=NOW, objects=None):
    rows = [dict(source='edge_logs', events=1000, responses=1000, server_errors=0,
                 access_failures=0, unknown_status=0)]
    payloads = {
        'capabilities': snap(has_cron=False, has_cron_history=False, has_statements=True,
                             has_chat_leases=True, can_read_all_stats=True),
        'snapshot': snap(database_bytes=1000, max_connections=100, client_connections=4,
                         active_connections=1, largest_tables=[]),
        'performance': snap(sessions=[], statements=[]),
        'chat_leases': snap(pending=0, expired_leases=0, oldest_expired_seconds=None),
        'advisors_security': objects or [], 'advisors_health': [], 'advisors_performance': [],
        'hourly_current': rows, 'hourly_previous': rows,
        'daily_current': rows, 'daily_previous': rows,
        'agent_brain': {'ready': True},
    }
    results = {k: {'status': 'ok', 'data': copy.deepcopy(v)} for k, v in payloads.items()}
    for key, window in windows(now).items(): results[key]['window'] = window
    for v in results.values():
        if isinstance(v['data'], dict) and 'observed_at' in v['data']: v['data']['observed_at'] = iso(now)
    return {'project_id': PROJECT, 'observed_at': iso(now), 'results': results}


def obj(identity='one', level='WARN'):
    return dict(id=identity, name='duplicate_index', level=level,
                object='public.example', link='https://supabase.com/docs/guides/database/database-linter')


def state(): return empty_state(iso(NOW), CONFIG['policy_version'])


class PolicyTests(unittest.TestCase):
    def test_unavailable_and_empty_are_not_healthy(self):
        obs = observation()
        obs['results']['daily_current']['data'] = None
        obs['results']['hourly_previous']['data'] = []
        updated, report = evaluate(state(), obs, CONFIG)
        self.assertEqual(report['coverage'], 'partial')
        for key in ('request_growth', 'hourly/edge_logs', 'query_regressions', 'capacity_forecast'):
            self.assertEqual(report['checks'][key]['outcome'], 'unable_to_assess')
        self.assertIsNone(updated['last_successful_run'])

    def test_last_good_and_acknowledgements_survive_failure(self):
        s, _ = evaluate(state(), observation(), CONFIG)
        s['acknowledged_findings'] = {'old': {'reviewed_at': iso(NOW)}}
        previous = copy.deepcopy(s['last_good']['snapshot'])
        obs = observation(NOW+timedelta(hours=1))
        obs['results']['snapshot'] = {'status': 'unable_to_assess', 'reason': 'http_403'}
        s, report = evaluate(s, obs, CONFIG)
        self.assertEqual(s['last_good']['snapshot'], previous)
        self.assertIn('old', s['acknowledged_findings'])
        self.assertEqual(report['checks']['snapshot']['outcome'], 'unable_to_assess')

    def test_advisor_object_change_recurrence_and_quiet_repeat(self):
        s, r = evaluate(state(), observation(objects=[obj()]), CONFIG)
        self.assertEqual(len(r['new_actionable_findings']), 1)
        s, r = evaluate(s, observation(NOW+timedelta(hours=1), [obj()]), CONFIG)
        self.assertFalse(r['new_actionable_findings'])
        s, r = evaluate(s, observation(NOW+timedelta(hours=2), [obj('two')]), CONFIG)
        self.assertEqual(len(r['new_actionable_findings']), 1)
        self.assertEqual(s['alert_state']['advisor/one']['status'], 'resolved')
        s, r = evaluate(s, observation(NOW+timedelta(hours=3), [obj()]), CONFIG)
        self.assertTrue(r['new_actionable_findings'][0]['recurrence'])

    def test_severity_worsens_but_downgrade_quiet(self):
        s, _ = evaluate(state(), observation(objects=[obj()]), CONFIG)
        s, r = evaluate(s, observation(NOW+timedelta(hours=1), [obj(level='ERROR')]), CONFIG)
        self.assertEqual(len(r['new_actionable_findings']), 1)
        _, r = evaluate(s, observation(NOW+timedelta(hours=2), [obj()]), CONFIG)
        self.assertFalse(r['new_actionable_findings'])

    def test_coverage_failure_change_recovery_and_recurrence(self):
        s = state()
        for i, reason in enumerate(['http_403', 'http_403', 'http_401', None, 'http_401']):
            obs = observation(NOW+timedelta(hours=i))
            if reason: obs['results']['advisors_security'] = {'status': 'unable_to_assess', 'reason': reason}
            s, report = evaluate(s, obs, CONFIG)
            self.assertEqual(bool(report['new_actionable_findings']), i in (0, 2, 4))

    def test_pressure_threshold_and_worsening(self):
        s = state()
        for i, (used, alerts) in enumerate([(79, 0), (80, 1), (85, 0), (90, 1), (95, 1), (96, 0)]):
            obs = observation(NOW+timedelta(hours=i))
            obs['results']['snapshot']['data']['client_connections'] = used
            s, r = evaluate(s, obs, CONFIG)
            self.assertEqual(len(r['new_actionable_findings']), alerts)

    def test_missing_cron_is_not_applicable(self):
        _, r = evaluate(state(), observation(), CONFIG)
        self.assertEqual(r['checks']['cron']['outcome'], 'not_applicable')

    def test_unknown_cron_does_not_hide_gap_when_dispatch_fails(self):
        s = state()
        job = dict(jobid=1, active=True, schedule='@hourly', last_status='failed',
                   last_start=None, last_end=None, failures_last_hour=1)
        s['last_good']['cron'] = {'observed_at': iso(NOW-timedelta(hours=1)), 'data': snap(jobs=[job])}
        obs = observation()
        obs['results']['capabilities']['data'].update(has_cron=True, has_cron_history=True)
        obs['results']['cron'] = {'status': 'ok', 'data': snap(jobs=[job])}
        _, r = evaluate(s, obs, CONFIG)
        self.assertEqual(r['checks']['cron']['outcome'], 'unable_to_assess')
        self.assertTrue(any(f['reason'] == 'cron_dispatch_failed' for f in r['new_actionable_findings']))

    def test_api_auth_sources_are_not_added_together(self):
        obs = observation()
        obs['results']['hourly_current']['data'][0].update(server_errors=30)
        _, r = evaluate(state(), obs, CONFIG)
        self.assertEqual(r['checks']['hourly/edge_logs']['outcome'], 'finding')
        self.assertEqual(r['checks']['hourly/auth_logs']['outcome'], 'unable_to_assess')

    def test_metadata_identity_preserves_policies_without_raw_description(self):
        lint = dict(name='example_lint', level='WARN', count=2,
                    findings=[{'detail': 'DO NOT SAVE', 'metadata': {'schema': 'public', 'name': 'table', 'policy': p}} for p in ['one', 'two']])
        objects = advisor_objects('performance', {'lints': [lint]})
        self.assertNotEqual(objects[0]['id'], objects[1]['id'])
        self.assertNotIn('DO NOT SAVE', json.dumps(objects))
        self.assertNotIn('policy', json.dumps(objects))
        lint['count'] = 3
        with self.assertRaises(ValueError): advisor_objects('performance', {'lints': [lint]})

    def test_grouped_policy_diagnostics_keep_distinct_identity(self):
        lint = dict(name='auth_rls_initplan', level='WARN', count=2,
                    findings=[{'detail': 'Table `public.t` policy `'+p+'`', 'metadata': {'schema': 'public', 'name': 't'}} for p in ('one', 'two')])
        rows = advisor_objects('performance', {'lints': [lint]})
        self.assertEqual(len({r['id'] for r in rows}), 2)
        lint['findings'][0]['detail'] = 'format no longer recognized'
        with self.assertRaises(ValueError): advisor_objects('performance', {'lints': [lint]})

    def test_capacity_requires_matching_verified_limit_and_seven_daily_points(self):
        s = state()
        s['daily_resource_snapshots'] = [dict(utc_date=(NOW-timedelta(days=d)).date().isoformat(), observed_at=iso(NOW-timedelta(days=d)), database_bytes=1000-d*100) for d in range(6, 0, -1)]
        config = copy.deepcopy(CONFIG)
        config['confirmed_limits'] = [dict(verified_at=iso(NOW), source='verified plan metadata', scope=PROJECT+'/database', metric='database_bytes', units='bytes', value=1500)]
        _, r = evaluate(s, observation(), config)
        self.assertEqual(r['checks']['capacity_forecast']['outcome'], 'finding')
        config['confirmed_limits'][0]['units'] = 'disk_bytes'
        _, r = evaluate(s, observation(), config)
        self.assertEqual(r['checks']['capacity_forecast']['outcome'], 'unable_to_assess')

    def test_monitor_gap_alerts_only_on_recovery_then_quiet(self):
        s, _ = evaluate(state(), observation(), CONFIG)
        s, r = evaluate(s, observation(NOW+timedelta(hours=3)), CONFIG)
        self.assertTrue(any(f['key'] == 'monitor/gap' for f in r['new_actionable_findings']))
        _, r = evaluate(s, observation(NOW+timedelta(hours=4)), CONFIG)
        self.assertFalse(r['new_actionable_findings'])

    def test_dependency_recovery_once_after_confirmed_incident(self):
        obs = observation(); obs['results']['agent_brain']['data']['ready'] = False
        s, _ = evaluate(state(), obs, CONFIG)
        for e in s['pending_alerts'].values(): e['delivery_status'] = 'delivered'
        s, r = evaluate(s, observation(NOW+timedelta(hours=1)), CONFIG)
        self.assertTrue(any(e['reason'] == 'dependency_readiness_recovered' for e in r['new_actionable_findings']))
        _, r = evaluate(s, observation(NOW+timedelta(hours=2)), CONFIG)
        self.assertFalse(r['new_actionable_findings'])


class CounterTests(unittest.TestCase):
    def samples(self):
        return [
            dict(observed_at=iso(NOW+timedelta(hours=i)), postmaster_start='same', server_version_num='170006',
                 database_stats_reset=None, statements=[dict(dbid='1', userid='2', queryid='3', toplevel=True,
                    calls=calls, total_exec_time=ms, stats_reset='same', dealloc=0, statement_stats_since='same')])
            for i, (calls, ms) in enumerate([(100, 1000), (120, 2000), (140, 6000)])]

    def test_numeric_delta_regression_with_reset_provenance(self):
        found, assessed, reason = regression(self.samples())
        self.assertIsNone(reason)
        self.assertEqual(found[0]['previous_mean_ms'], 50)
        self.assertEqual(found[0]['current_mean_ms'], 200)
        self.assertEqual(len(assessed), 1)

    def test_reset_eviction_missing_and_decreasing_counters_rejected(self):
        for key, value in [('dealloc', 1), ('statement_stats_since', None), ('stats_reset', 'new'), ('calls', 1), ('total_exec_time', 0)]:
            samples = self.samples()
            samples[-1]['statements'][0][key] = value
            self.assertFalse(regression(samples)[1], key)
        samples = self.samples(); samples[-1]['statements'] = []
        self.assertFalse(regression(samples)[1])
        samples = self.samples(); samples[-1]['postmaster_start'] = 'changed'
        self.assertEqual(regression(samples)[2], 'instance_or_database_reset')
        self.assertEqual(regression(self.samples()[:1])[2], 'insufficient_history')


class SafetyTests(unittest.TestCase):
    def test_hourly_slots_do_not_skip_after_smoke_or_duplicate_after_restart(self):
        at_0631 = NOW.replace(minute=31)
        self.assertEqual(due_slot(at_0631), '2026-11-07T06:00:00Z')
        self.assertIsNone(due_slot(at_0631, '2026-11-07T06:00:00Z'))
        self.assertEqual(due_slot(NOW+timedelta(hours=1), '2026-11-07T06:00:00Z'), '2026-11-07T07:00:00Z')
        self.assertIsNone(due_slot(NOW+timedelta(minutes=59), '2026-11-07T06:00:00Z'))
        self.assertEqual(due_slot(NOW+timedelta(hours=4), '2026-11-07T06:00:00Z'), '2026-11-07T10:00:00Z')

    def test_log_api_contract_uses_documented_route_and_rejects_query_errors(self):
        class Http:
            response = {'result': []}
            def json(self, url, token=None, payload=None):
                self.url = url
                return self.response
        from urllib.parse import urlparse, parse_qs
        http = Http(); operator = Operator(http, 'fake')
        window = windows(NOW)['hourly_current']
        self.assertEqual(operator.logs(window), [])
        url = urlparse(http.url)
        self.assertEqual(url.path, '/v1/projects/'+PROJECT+'/analytics/endpoints/logs')
        params = parse_qs(url.query)
        self.assertEqual(params['iso_timestamp_start'], [window['start']])
        self.assertEqual(params['iso_timestamp_end'], [window['end']])
        http.response = {'result': [], 'error': 'sensitive provider error body'}
        with self.assertRaisesRegex(Unavailable, '^logs_query_rejected$'): operator.logs(window)

    def test_all_diagnostic_templates_guarded(self):
        for file in (ROOT/'sql').glob('*.sql'):
            if file.name.endswith('clickhouse.sql'): continue
            guard_sql(file.read_text())
        for bad in ['SELECT 1;', "BEGIN; SET LOCAL statement_timeout='10s'; SELECT 1; COMMIT;",
                    "BEGIN TRANSACTION READ ONLY; SET LOCAL statement_timeout='10s'; SELECT query FROM pg_stat_activity; COMMIT;",
                    "BEGIN TRANSACTION READ ONLY; SET LOCAL statement_timeout='10s'; SELECT pg_cancel_backend(1); COMMIT;"]:
            with self.assertRaises(ValueError): guard_sql(bad)

    def test_raw_fields_rejected_before_persistence(self):
        for data in [snap(query='private'), snap(statements=[{'query': 'private'}]), snap(jobs=[{'command': 'private'}])]:
            with self.assertRaises(ValueError): sql_snapshot([{'snapshot': data}])
        with self.assertRaises(ValueError): sql_snapshot([{'snapshot': {'transaction_read_only': 'off', 'statement_timeout': '10s'}}])
        obs = observation(); obs['results']['performance']['data']['statements'] = [{'query': 'private'}]
        s, r = evaluate(state(), obs, CONFIG)
        self.assertNotIn('private', json.dumps(s))
        self.assertEqual(r['checks']['performance']['outcome'], 'unable_to_assess')

    def test_state_missing_corrupt_and_wrong_project_fail_closed(self):
        with tempfile.TemporaryDirectory() as temp:
            store = Store(temp)
            with self.assertRaises(FileNotFoundError): store.load()
            Path(temp, 'state.json').write_text('broken')
            with self.assertRaises(ValueError): store.load()
            s = state(); s['project_id'] = 'other'
            with self.assertRaises(ValueError): store.save(s)

    def test_atomic_store_preserves_previous_and_locks(self):
        with tempfile.TemporaryDirectory() as temp:
            store = Store(temp)
            atomic_json(Path(temp, 'state.json'), state())
            new = state(); new['last_attempt_at'] = iso(NOW)
            store.save(new)
            self.assertIsNone(json.loads(Path(temp, 'state.last-good.json').read_text())['last_attempt_at'])
            self.assertEqual(Path(temp, 'state.json').stat().st_mode & 0o777, 0o600)
            with store.locked():
                with self.assertRaises(BlockingIOError):
                    with Store(temp).locked(): pass

    def test_complete_windows_and_cron_grace_semantics(self):
        w = windows(NOW)
        self.assertEqual(w['hourly_current']['end'], '2026-11-07T06:00:00Z')
        self.assertEqual(w['daily_current']['start'], '2026-11-06T00:00:00Z')
        start = datetime(2026, 11, 7, 0, 0, tzinfo=UTC)
        self.assertIsNone(cron_due('0 8 * * MON', start, start+timedelta(hours=23)))
        self.assertEqual(cron_due('0 6 * * *', start, start+timedelta(hours=7)).hour, 6)
        with self.assertRaises(ValueError): cron_due('5 seconds', start, start+timedelta(hours=1))

    def test_slack_users_info_uses_get_and_only_exact_recipient(self):
        class Http:
            def json(self, url, token=None, payload=None):
                if 'users.info' in url:
                    self.url, self.payload = url, payload
                    return {'ok': True, 'user': {'id': RECIPIENT}}
                return {'ok': True, 'channel': {'id': 'D123'}}
        http = Http()
        self.assertEqual(Slack(http, 'fake').recipient(), 'D123')
        self.assertIn('user='+RECIPIENT, http.url)
        self.assertIsNone(http.payload)

    def test_ambiguous_slack_send_never_replayed_and_confirmed_receipts_only(self):
        class Sender:
            calls = 0
            def recipient(self): return 'D123'
            def send(self, *args):
                self.calls += 1
                raise Unavailable('network_or_tls_failure')
        sender = Sender()
        with tempfile.TemporaryDirectory() as temp:
            store = Store(temp)
            s, r = evaluate(state(), observation(objects=[obj()]), CONFIG)
            atomic_json(Path(temp, 'state.json'), s)
            s = deliver(store, s, r, sender)
            deliver(store, s, r, sender)
            self.assertEqual(sender.calls, 1)
            self.assertFalse(s['notification_receipts'])
            self.assertEqual(next(iter(s['pending_alerts'].values()))['delivery_status'], 'ambiguous')

    def test_confirmed_delivery_is_deduplicated(self):
        class Sender:
            calls = 0
            def recipient(self): return 'D123'
            def send(self, *args):
                self.calls += 1
                return {'confirmed': True, 'channel_id': 'D123', 'message_ts': '1.2', 'user_id': RECIPIENT}
        sender = Sender()
        with tempfile.TemporaryDirectory() as temp:
            store = Store(temp)
            s, r = evaluate(state(), observation(objects=[obj()]), CONFIG)
            atomic_json(Path(temp, 'state.json'), s)
            s = deliver(store, s, r, sender)
            s, r = evaluate(s, observation(NOW+timedelta(hours=1), [obj()]), CONFIG)
            deliver(store, s, r, sender)
            self.assertEqual(sender.calls, 1)
            self.assertEqual(len(s['notification_receipts']), 1)


if __name__ == '__main__': unittest.main()
