"""Pure policy/state transitions. Inputs are operator metadata and numeric aggregates."""
from __future__ import annotations

import calendar
import copy
import hashlib
import json
import math
import re
from datetime import datetime, timedelta, timezone

PROJECT = "udycgnhvaanemhrchbuj"
RECIPIENT = "U32PGT1PA"
UTC = timezone.utc
LINK = f"https://supabase.com/dashboard/project/{PROJECT}"


def stamp(value: str) -> datetime:
    result = datetime.fromisoformat(value.replace("Z", "+00:00"))
    if result.tzinfo is None:
        raise ValueError("timezone_required")
    return result.astimezone(UTC)


def iso(value: datetime) -> str:
    return value.astimezone(UTC).isoformat().replace("+00:00", "Z")


def digest(value) -> str:
    return hashlib.sha256(json.dumps(value, sort_keys=True, separators=(",", ":")).encode()).hexdigest()


def number(value) -> bool:
    return type(value) in (int, float) and math.isfinite(value) and value >= 0


def empty_state(now: str, policy: str) -> dict:
    return {"version": 1, "project_id": PROJECT, "policy_version": policy,
            "initialized_at": now, "last_attempt_at": None, "last_successful_run": None,
            "hosting": {"status": "prepared_not_deployed", "schedule_created": False},
            "last_good": {}, "metrics_history": [], "performance_snapshots": [],
            "daily_resource_snapshots": [], "log_windows": {}, "checks": {},
            "acknowledged_findings": {}, "alert_state": {}, "pending_alerts": {},
            "notification_receipts": [], "delivery": {"user_id": RECIPIENT, "verified": False}}


def validate_state(state: dict):
    if state.get("version") != 1 or state.get("project_id") != PROJECT:
        raise ValueError("state_identity_mismatch")
    for key, kind in [("last_good", dict), ("checks", dict), ("alert_state", dict),
                      ("pending_alerts", dict), ("notification_receipts", list),
                      ("acknowledged_findings", dict), ("metrics_history", list),
                      ("performance_snapshots", list), ("daily_resource_snapshots", list),
                      ("log_windows", dict)]:
        if not isinstance(state.get(key), kind):
            raise ValueError("invalid_state_shape")
    if state.get("delivery", {}).get("user_id") != RECIPIENT:
        raise ValueError("recipient_mismatch")


def advisor_objects(kind: str, response: dict) -> list[dict]:
    """Drop descriptions, SQL, and arbitrary values; hash stable object metadata."""
    lints = response.get("lints")
    if not isinstance(lints, list):
        raise ValueError("missing_lints")

    def metadata(value, key=""):
        if re.search(r"query|definition|expression|body|secret|token|password|value|detail", key, re.I):
            return None
        if isinstance(value, dict):
            return {k: metadata(v, k) for k, v in sorted(value.items()) if metadata(v, k) is not None}
        if isinstance(value, list):
            return [metadata(v, key) for v in value[:100]]
        if isinstance(value, str):
            # Function signatures and policy/index names are object metadata, never emitted verbatim.
            return digest(value) if key not in ("schema", "name", "type") else value[:128]
        return value if value is None or isinstance(value, bool) or number(value) else None

    output = []
    for lint in lints:
        name, level = lint.get("name"), lint.get("level")
        if not isinstance(name, str) or not re.fullmatch(r"[a-z0-9_]+", name) or level not in ("INFO", "WARN", "ERROR"):
            raise ValueError("invalid_advisor_shape")
        findings = lint.get("findings", [lint])
        if not isinstance(findings, list) or lint.get("count", len(findings)) != len(findings):
            raise ValueError("incomplete_advisor_objects")
        for finding in findings:
            raw = finding.get("metadata", {})
            safe = metadata(raw)
            # Grouped advisors omit policy/role identity from metadata. Extract
            # only those named diagnostic identifiers; never persist detail/SQL.
            diagnostic = finding.get('detail', '').replace('\\`', '`')
            if name in ('auth_rls_initplan', 'unused_index'):
                field = 'policy' if name == 'auth_rls_initplan' else 'index'
                identity = re.search(r'\b'+field+r'\s+`([^`\n]{1,256})`', diagnostic, re.I)
                if not identity:
                    raise ValueError('advisor_object_identity_incomplete')
                safe[field+'_identity'] = digest(identity.group(1))
            if name == 'multiple_permissive_policies':
                for field in ('role', 'action'):
                    identifier = re.search(r'\b'+field+r'\s+`([^`\n]{1,128})`', diagnostic, re.I)
                    if not identifier:
                        raise ValueError('advisor_object_identity_incomplete')
                    safe[field+'_identity'] = digest(identifier.group(1))
            label = ".".join(str(raw.get(k)) for k in ("schema", "name") if raw.get(k))
            if not label or not re.fullmatch(r"[a-zA-Z0-9_.-]{1,260}", label):
                label = "project" if not raw else "object-" + digest(safe)[:12]
            url = lint.get("remediation", "")
            if not isinstance(url, str) or not url.startswith("https://supabase.com/docs/"):
                url = LINK + "/advisors"
            output.append({"id": digest([PROJECT, kind, name, safe]), "name": name,
                           "level": level, "object": label, "link": url})
    return output


def sql_snapshot(rows: list) -> dict:
    if not isinstance(rows, list) or len(rows) != 1 or not isinstance(rows[0].get("snapshot"), dict):
        raise ValueError("invalid_sql_result")
    data = rows[0]["snapshot"]
    if data.get("transaction_read_only") != "on" or data.get("statement_timeout") not in ("10s", "10000ms"):
        raise ValueError("readonly_or_timeout_not_verified")
    # A closed result vocabulary prevents accidental future SELECT additions
    # (such as query text, commands or row payloads) entering durable history.
    allowed = {
        'observed_at', 'transaction_read_only', 'statement_timeout',
        'server_version_num', 'postmaster_start', 'can_read_all_stats',
        'has_statements', 'has_cron', 'has_cron_history', 'has_chat_leases',
        'database_bytes', 'max_connections', 'client_connections', 'active_connections',
        'largest_tables', 'database_stats_reset', 'sessions', 'statements',
        'pending', 'expired_leases', 'oldest_expired_seconds', 'jobs',
    }
    nested = {
        'largest_tables': {'schemaname', 'relname', 'total_bytes'},
        'sessions': {'pid', 'state', 'query_age_seconds', 'transaction_age_seconds', 'wait_event_type', 'blocking_pids'},
        'statements': {'dbid', 'userid', 'queryid', 'toplevel', 'calls', 'total_exec_time', 'stats_reset', 'dealloc', 'statement_stats_since'},
        'jobs': {'jobid', 'schedule', 'active', 'last_status', 'last_start', 'last_end', 'failures_last_hour'},
    }
    if set(data) - allowed:
        raise ValueError('unexpected_sql_fields')
    for key, fields in nested.items():
        if key in data and (not isinstance(data[key], list) or any(not isinstance(row, dict) or set(row) - fields for row in data[key])):
            raise ValueError('unexpected_sql_fields')
    return data


def valid_data(key, value):
    if key.startswith("advisors_"):
        return isinstance(value, list) and all(isinstance(x, dict) and set(x) == {"id", "name", "object", "level", "link"} and x['level'] in ('INFO', 'WARN', 'ERROR') for x in value)
    if key.startswith(("hourly_", "daily_")):
        return isinstance(value, list) and len({x.get('source') for x in value if isinstance(x, dict)}) == len(value) and all(isinstance(x, dict) and set(x) == {'source', 'events', 'responses', 'server_errors', 'access_failures', 'unknown_status'} and x.get("source") in ("edge_logs", "auth_logs", "function_edge_logs") and all(number(x.get(k)) for k in ("events", "responses", "server_errors", "access_failures", "unknown_status")) for x in value)
    if not isinstance(value, dict): return False
    if key in ('capabilities', 'snapshot', 'performance', 'chat_leases', 'cron'):
        try: sql_snapshot([{'snapshot': value}])
        except ValueError: return False
    if key == "capabilities":
        return all(type(value.get(k)) is bool for k in ("has_cron", "has_cron_history", "has_statements", "can_read_all_stats"))
    required = {"snapshot": ("database_bytes", "max_connections", "client_connections", "active_connections"),
                "chat_leases": ("pending", "expired_leases")}.get(key)
    if required: return all(number(value.get(k)) for k in required)
    if key == "performance": return isinstance(value.get("sessions"), list) and all(number(r.get('pid')) and isinstance(r.get('blocking_pids'), list) for r in value['sessions']) and isinstance(value.get("statements"), list) and bool(value.get("observed_at"))
    if key == "cron": return isinstance(value.get("jobs"), list) and all(number(j.get('jobid')) and isinstance(j.get('schedule'), str) and type(j.get('active')) is bool and number(j.get('failures_last_hour')) for j in value['jobs'])
    if key == "agent_brain": return set(value) == {'ready'} and type(value.get("ready")) is bool
    return False


def regression(snapshots: list[dict]) -> tuple[list, list, str | None]:
    if len(snapshots) < 3:
        return [], [], "insufficient_history"
    a, b, c = snapshots[-3:]
    intervals = [(stamp(y["observed_at"]) - stamp(x["observed_at"])).total_seconds() for x, y in ((a, b), (b, c))]
    if any(not 2700 <= n <= 5400 for n in intervals):
        return [], [], "non_hourly_intervals"
    for key in ("postmaster_start", "server_version_num", "database_stats_reset"):
        if not (a.get(key) == b.get(key) == c.get(key)):
            return [], [], "instance_or_database_reset"
    def index(s):
        return {(r.get("dbid"), r.get("userid"), r.get("queryid"), r.get("toplevel")): r for r in s["statements"]}
    ai, bi, ci = index(a), index(b), index(c)
    found, assessed = [], []
    for key in ai.keys() & bi.keys() & ci.keys():
        rows = [table[key] for table in (ai, bi, ci)]
        if any(r.get("queryid") is None for r in rows):
            continue
        markers = ("stats_reset", "dealloc", "statement_stats_since")
        if any(any(r.get(k) is None for r in rows) or len({str(r[k]) for r in rows}) != 1 for k in markers):
            continue
        if any(not number(r.get(k)) for r in rows for k in ("calls", "total_exec_time")):
            continue
        calls = [rows[i+1]["calls"] - rows[i]["calls"] for i in range(2)]
        elapsed = [rows[i+1]["total_exec_time"] - rows[i]["total_exec_time"] for i in range(2)]
        if min(calls) < 20 or min(elapsed) < 0:
            continue
        means = [elapsed[i] / calls[i] for i in range(2)]
        identity = "query/" + digest(key)
        assessed.append(identity)
        if means[1] >= 100 and means[1] >= 2 * means[0]:
            found.append({"key": identity, "previous_mean_ms": means[0], "current_mean_ms": means[1], "calls": calls})
    return found, assessed, None if assessed else "no_reset_valid_sample_qualified_statements"


def cron_due(expression: str, start: datetime, end: datetime) -> datetime | None:
    """Standard five-field UTC cron, including DOM/DOW OR and pg_cron's last-day $."""
    parts = expression.split()
    if len(parts) != 5 or (end-start).total_seconds() > 86400:
        raise ValueError("unsupported_cron_or_history_window")
    names = {n.lower(): i for i, n in enumerate(calendar.month_abbr) if n}
    days = {n.lower(): (i+1) % 7 for i, n in enumerate(calendar.day_abbr)}
    def values(part, lo, hi, mapping):
        for name, value in mapping.items():
            part = re.sub(name, str(value), part, flags=re.I)
        result = set()
        for item in part.split(","):
            field, _, step = item.partition("/")
            if step and (not step.isdigit() or int(step) <= 0):
                raise ValueError("unsupported_cron")
            if field == "*": left, right = lo, hi
            elif "-" in field: left, right = map(int, field.split("-"))
            else: left = right = int(field)
            if not lo <= left <= right <= hi:
                raise ValueError("unsupported_cron")
            result.update(range(left, right+1, int(step or 1)))
        return result
    minute, hour = values(parts[0], 0, 59, {}), values(parts[1], 0, 23, {})
    dom = None if parts[2] == "$" else values(parts[2], 1, 31, {})
    months, dow = values(parts[3], 1, 12, names), {v % 7 for v in values(parts[4], 0, 7, days)}
    t = start.replace(second=0, microsecond=0) + timedelta(minutes=1)
    latest = None
    while t <= end:
        day_match = t.day == calendar.monthrange(t.year, t.month)[1] if dom is None else t.day in dom
        week_match = (t.weekday()+1) % 7 in dow
        date_match = day_match and week_match if parts[2] == "*" or parts[4] == "*" else day_match or week_match
        if t.minute in minute and t.hour in hour and t.month in months and date_match:
            latest = t
        t += timedelta(minutes=1)
    return latest


def evaluate(state: dict, observation: dict, config: dict) -> tuple[dict, dict]:
    validate_state(state)
    if observation.get("project_id") != PROJECT or config.get("project_id") != PROJECT or config.get("slack_user_id") != RECIPIENT:
        raise ValueError("target_mismatch")
    now = observation["observed_at"]
    when = stamp(now)
    result = copy.deepcopy(state)
    raw, checks, findings, resolved_keys = observation["results"], {}, {}, set()

    def record(key, outcome, evidence=None, reason=None, complete=False):
        checks[key] = {"outcome": outcome, "evidence": evidence or {}, "complete": complete}
        if reason: checks[key]["reason"] = reason

    def finding(key, owner, category, evidence, reason, level="WARN", link=None, band=None):
        findings[key] = {"key": key, "check": owner, "category": category, "level": level,
                         "evidence": evidence, "reason": reason, "link": link or LINK,
                         "signature": digest([level, reason, band])}

    def data(key):
        item = raw.get(key, {"status": "unable_to_assess", "reason": "missing_result"})
        if item.get("status") != "ok":
            reason = item.get("reason", "unavailable")
            record(key, "unable_to_assess", reason=reason)
            finding("coverage/"+key, key, "monitoring", {"reason_code": reason}, reason)
            return None
        if not valid_data(key, item.get("data")):
            record(key, "unable_to_assess", reason="invalid_or_missing_fields")
            finding("coverage/"+key, key, "monitoring", {"reason_code": "invalid_or_missing_fields"}, "invalid_or_missing_fields")
            return None
        record(key, "clear", complete=True)
        result["last_good"][key] = {"observed_at": now, "data": copy.deepcopy(item["data"])}
        return item["data"]

    last_attempt = state.get('last_attempt_at')
    gap = (when-stamp(last_attempt)).total_seconds() if last_attempt else 0
    record('monitor_continuity', 'finding' if gap > 5400 else 'clear', {'gap_seconds': gap}, complete=True)
    if gap > 5400:
        finding('monitor/gap', 'monitor_continuity', 'monitoring', {'gap_seconds': gap, 'window': {'start': last_attempt, 'end': now}}, 'monitoring_gap_detected_on_recovery')

    cap, snapshot, perf = data("capabilities"), data("snapshot"), data("performance")
    if cap:
        record("capabilities", "clear", cap, complete=True)
    if snapshot:
        result["metrics_history"] = (result["metrics_history"] + [snapshot])[-48:]
        today = when.date().isoformat()
        daily = result["daily_resource_snapshots"]
        if when.hour == config["daily_anchor_utc_hour"] and not any(d["utc_date"] == today for d in daily):
            daily.append({"utc_date": today, **snapshot})
        result["daily_resource_snapshots"] = daily[-30:]
        if cap and cap.get("can_read_all_stats") and all(number(snapshot.get(k)) for k in ("max_connections", "client_connections")) and snapshot["max_connections"] > 0:
            ratio = 100 * snapshot["client_connections"] / snapshot["max_connections"]
            record("connection_pressure", "finding" if ratio >= 80 else "clear", {"percent": ratio, "client_connections": snapshot["client_connections"], "max_connections": snapshot["max_connections"]}, complete=True)
            if ratio >= 80:
                finding("connections", "connection_pressure", "health", checks["connection_pressure"]["evidence"], "connection_pressure", level="ERROR" if ratio >= 95 else "WARN", band=95 if ratio >= 95 else 90 if ratio >= 90 else 80)
        else:
            record("connection_pressure", "unable_to_assess", reason="missing_stats_privilege_or_limit")
        record("resources", "clear", {"database_bytes": snapshot.get("database_bytes"), "largest_tables": snapshot.get("largest_tables", []), "scope": "database size, not disk fullness"}, complete=True)
    if perf:
        result["performance_snapshots"] = (result["performance_snapshots"] + [perf])[-6:]
        if cap and cap.get("can_read_all_stats"):
            sessions = perf["sessions"]
            record("application_sessions", "finding" if sessions else "clear", {"sessions": sessions, "sample_limit": 20}, complete=True)
            for row in sessions:
                finding("session/"+str(row["pid"]), "application_sessions", "health", row, "aged_application_session_or_blocker", link=LINK+"/database/observability")
        else:
            record("application_sessions", "unable_to_assess", reason="missing_stats_privilege")
        regressions, assessed, reason = regression(result["performance_snapshots"])
        record("query_regressions", "unable_to_assess" if reason else "finding" if regressions else "clear", {"eligible_sample": len(assessed), "sample_limit": 100}, reason)
        resolved_keys.update(assessed)
        for row in regressions:
            finding(row["key"], "query_regressions", "performance", row, "reset_valid_latency_regression", link=LINK+"/observability/query-performance")

    for category in ("security", "performance", "health"):
        key = "advisors_"+category
        objects = data(key)
        if objects is not None:
            actionable = [o for o in objects if o["level"] in ("WARN", "ERROR")]
            record(key, "finding" if actionable else "clear", {"objects": objects}, complete=True)
            for obj in actionable:
                finding("advisor/"+obj["id"], key, category, obj, obj["name"], obj["level"], obj["link"])

    validated_logs = {}
    for prefix, metric, category in (("hourly", "server_errors", "health"), ("daily", "access_failures", "security")):
        current, previous = data(prefix+"_current"), data(prefix+"_previous")
        validated_logs[prefix] = (current or [], previous or [])
        for source in ("edge_logs", "auth_logs"):
            key = prefix+"/"+source
            a = next((r for r in current or [] if r["source"] == source), None)
            b = next((r for r in previous or [] if r["source"] == source), None)
            window = raw.get(prefix+"_current", {}).get("window")
            if not a or not b or min(a.get("responses", 0), b.get("responses", 0)) < 100:
                record(key, "unable_to_assess", {"current": a, "previous": b, "window": window}, "missing_source_or_insufficient_sample")
                continue
            ar, br = a[metric]/a["responses"], b[metric]/b["responses"]
            alarm = a[metric] >= 20 and ar >= .01 and (br == 0 or ar >= 2*br)
            evidence = {"current": a, "previous": b, "window": window, "rate": ar, "previous_rate": br}
            record(key, "finding" if alarm else "clear", evidence, complete=True)
            if alarm: finding(key, key, category, evidence, metric+"_spike", link=LINK+"/logs/explorer")
    a, b = validated_logs['daily']
    a = next((r for r in a if r["source"] == "edge_logs"), None)
    b = next((r for r in b if r["source"] == "edge_logs"), None)
    if a is None or b is None:
        record("request_growth", "unable_to_assess", reason="missing_complete_day_source")
    else:
        alarm = a["events"] >= 1000 and (b["events"] == 0 or a["events"] >= 2*b["events"])
        evidence = {"events": a["events"], "previous_events": b["events"], "ratio": a["events"]/b["events"] if b["events"] else None, "units": "API Gateway events, not unique users or billing"}
        record("request_growth", "finding" if alarm else "clear", evidence, complete=True)
        if alarm: finding("request_growth", "request_growth", "resources", evidence, "daily_request_growth")

    # Forecast only an explicitly verified, matching metric/scope/unit limit with seven daily samples.
    limits = config.get("confirmed_limits", [])
    record("capacity_forecast", "unable_to_assess", reason="insufficient_matching_history_or_verified_limit")
    for limit in limits:
        if not (limit.get("verified_at") and limit.get("source") and limit.get("scope") == PROJECT+"/database" and limit.get("metric") == "database_bytes" and limit.get("units") == "bytes" and number(limit.get("value")) and limit["value"] > 0):
            continue
        daily = result["daily_resource_snapshots"]
        if snapshot and snapshot["database_bytes"] >= limit["value"]:
            record("capacity_forecast", "finding", {"limit": limit, "current": snapshot["database_bytes"]}, complete=True)
            finding("capacity/database", "capacity_forecast", "resources", checks["capacity_forecast"]["evidence"], "verified_limit_reached", "ERROR")
        elif len(daily) >= 7:
            recent = daily[-7:]
            dates = [stamp(x["observed_at"]) for x in recent]
            if any(not 20 <= (y-x).total_seconds()/3600 <= 28 for x, y in zip(dates, dates[1:])):
                continue
            growth = (recent[-1]["database_bytes"]-recent[0]["database_bytes"])/((dates[-1]-dates[0]).total_seconds()/86400)
            if growth <= 0:
                record("capacity_forecast", "unable_to_assess", reason="flat_or_falling_history")
                continue
            days = (limit["value"]-recent[-1]["database_bytes"])/growth
            evidence = {"days_remaining_linear_estimate": days, "growth_bytes_per_day": growth, "limit": limit}
            record("capacity_forecast", "finding" if days <= 14 else "clear", evidence, complete=True)
            if days <= 14: finding("capacity/database", "capacity_forecast", "resources", evidence, "linear_capacity_estimate", band=next(n for n in (1, 3, 7, 14) if days <= n))
    record("cpu_memory_disk", "unable_to_assess", reason="no_authorized_matching_metrics_series")

    leases = data("chat_leases")
    if leases is not None:
        record("chat_leases", "finding" if leases["expired_leases"] else "clear", leases, complete=True)
        if leases["expired_leases"]:
            finding("chat/expired_leases", "chat_leases", "background_jobs", leases, "expired_chat_leases_require_review")
    if cap and cap.get("has_cron") is False:
        record("cron", "not_applicable", {"catalog_present": False}, complete=True)
    elif cap:
        previous = state["last_good"].get("cron", {})
        cron = data("cron")
        if cron is not None:
            record("cron", "clear", {"jobs": cron["jobs"], "downstream_completion": "unverified"}, complete=True)
            prior = {j["jobid"]: j for j in previous.get("data", {}).get("jobs", [])}
            current_ids = {j["jobid"] for j in cron["jobs"]}
            for old in prior.values():
                if old["active"] and old["jobid"] not in current_ids:
                    finding("cron/missing/"+str(old["jobid"]), "cron", "background_jobs", {"jobid": old["jobid"]}, "previously_active_job_removed")
            for job in cron["jobs"]:
                identity = "cron/"+str(job["jobid"])
                old = prior.get(job["jobid"])
                if job["failures_last_hour"] or job["last_status"] == "failed":
                    finding(identity+"/failed", "cron", "background_jobs", job, "cron_dispatch_failed")
                if old and old["active"] and not job["active"]:
                    finding(identity+"/disabled", "cron", "background_jobs", {"jobid": job["jobid"]}, "previously_active_job_disabled")
                if old and job["active"] and old["schedule"] == job["schedule"]:
                    try:
                        due = cron_due(job["schedule"], stamp(previous["observed_at"]), when-timedelta(minutes=15))
                        if due and (not job["last_start"] or stamp(job["last_start"]) < due):
                            finding(identity+"/missed", "cron", "background_jobs", {"jobid": job["jobid"], "expected_after_grace": iso(due)}, "cron_execution_missing")
                    except (ValueError, TypeError):
                        record("cron", "unable_to_assess", reason="unsupported_schedule_or_history_gap")
            if checks['cron']['outcome'] != 'unable_to_assess' and any(f["check"] == "cron" for f in findings.values()): checks["cron"]["outcome"] = "finding"

    dependency = data("agent_brain")
    if dependency is not None:
        healthy = dependency.get("ready") is True
        record("agent_brain", "clear" if healthy else "finding", dependency, complete=True)
        if not healthy: finding("agent_brain", "agent_brain", "health", dependency, "dependency_readiness_failed", "ERROR", "https://railway.com/project/ddc9d9d6-98be-4854-93c3-94ed324e3279")
        elif state['alert_state'].get('agent_brain', {}).get('status') == 'open':
            notified = any(e['key'] == 'agent_brain' and e['delivery_status'] == 'delivered' for e in state['pending_alerts'].values())
            if notified:
                finding('agent_brain/recovery', 'agent_brain', 'health', dependency,
                        'dependency_readiness_recovered', 'INFO',
                        'https://railway.com/project/ddc9d9d6-98be-4854-93c3-94ed324e3279')

    # Expected warmup/unsampled metrics stay quiet. Changed actionable collection
    # failures still alert even when some evidence in that check remains available.
    for key, check in checks.items():
        if check.get('reason') in ('unsupported_schedule_or_history_gap', 'missing_stats_privilege', 'missing_stats_privilege_or_limit'):
            finding('coverage/'+key, key, 'monitoring', {'reason_code': check['reason']}, check['reason'])

    for key, previous in result["alert_state"].items():
        owner = previous.get("check")
        if key not in findings and previous.get("status") == "open" and (checks.get(owner, {}).get("complete") or key in resolved_keys):
            previous.update(status="resolved", resolved_at=now)
    new = []
    for key, item in findings.items():
        prior = result["alert_state"].get(key, {})
        ranks = {"INFO": 0, "WARN": 1, "ERROR": 2}
        changed = prior.get("status") != "open" or ranks[item["level"]] > ranks.get(prior.get("level"), -1)
        if item["category"] == "monitoring" and prior.get("signature") != item["signature"]:
            changed = True
        def magnitude(f):
            ev = f.get("evidence", {})
            if f["reason"] == "connection_pressure": return ev.get("percent", 0)//10
            if f["reason"] == "expired_chat_leases_require_review": return ev.get("expired_leases", 0)
            if f["reason"] == "cron_dispatch_failed": return ev.get("failures_last_hour", 0)
            if f["reason"] == "reset_valid_latency_regression": return ev.get("current_mean_ms", 0)
            if f["reason"] == "linear_capacity_estimate":
                days = ev.get("days_remaining_linear_estimate", 15)
                return 15-next(n for n in (1, 3, 7, 14, 15) if days <= n)
            current = ev.get("current", {})
            return current.get("server_errors", current.get("access_failures", ev.get("events", 0))) if isinstance(current, dict) else 0
        current_magnitude = magnitude(item)
        old_magnitude = prior.get("alerted_magnitude", 0)
        count_reasons = ("connection_pressure", "expired_chat_leases_require_review", "cron_dispatch_failed", "linear_capacity_estimate")
        if prior.get("status") == "open" and ranks[item["level"]] >= ranks.get(prior.get("level"), -1):
            changed |= current_magnitude > old_magnitude if item["reason"] in count_reasons else bool(old_magnitude and current_magnitude >= 2*old_magnitude)
        recurrence = prior.get("status") == "resolved"
        result["alert_state"][key] = {**prior, **item, "status": "open", "last_seen": now,
                                     "first_seen": prior.get("first_seen", now)}
        if changed:
            event_id = digest([key, item["signature"], now])
            if event_id not in result["pending_alerts"]:
                event = {**item, "id": event_id, "observed_at": now, "delivery_status": "pending", "recurrence": recurrence}
                result["pending_alerts"][event_id] = event
                result["alert_state"][key]["alerted_magnitude"] = current_magnitude
                new.append(event)
    result["checks"] = checks
    result["last_attempt_at"] = now
    result["policy_version"] = config["policy_version"]
    for key, item in raw.items():
        if key.startswith(("daily_", "hourly_")) and item.get("status") == "ok" and valid_data(key, item.get("data")):
            window = item.get("window", {})
            cache_key = str(window.get("start"))+"/"+str(window.get("end"))
            if window.get("start") and window.get("end"): result["log_windows"].setdefault(cache_key, item)
    result["log_windows"] = dict(sorted(result["log_windows"].items())[-100:])
    if any(v.get("complete") for v in checks.values()): result["last_successful_observation"] = now
    if all(c['outcome'] != 'unable_to_assess' for c in checks.values()): result["last_successful_run"] = now
    report = {"version": 1, "project_id": PROJECT, "observed_at": now,
              "coverage": "partial" if any(c["outcome"] == "unable_to_assess" for c in checks.values()) else "available",
              "checks": checks, "new_actionable_findings": new, "notification_sent": False,
              "hosting": result["hosting"], "policy_version": config["policy_version"]}
    return result, report
