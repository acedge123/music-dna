"""Private hourly Railway worker. Only operator reads and verified-owner Slack DMs."""
from __future__ import annotations

import argparse
import contextlib
import fcntl
import json
import os
from pathlib import Path
import re
import ssl
import tempfile
import time
from urllib import error, parse, request
from datetime import datetime, timedelta

from .core import PROJECT, RECIPIENT, UTC, LINK, advisor_objects, digest, empty_state, evaluate, iso, sql_snapshot, stamp, validate_state

ROOT = Path(__file__).resolve().parent


class Unavailable(Exception):
    """Stable sanitized failure code only; never include response bodies or credentials."""


class NoRedirect(request.HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        return None


class Http:
    def __init__(self):
        self.opener = request.build_opener(NoRedirect(), request.HTTPSHandler(context=ssl.create_default_context()))

    def json(self, url, token=None, payload=None):
        headers = {"Accept": "application/json"}
        if token: headers["Authorization"] = "Bearer " + token
        body = None
        if payload is not None:
            body = json.dumps(payload).encode()
            headers["Content-Type"] = "application/json"
        try:
            with self.opener.open(request.Request(url, data=body, headers=headers), timeout=25) as response:
                data = response.read(2_000_001)
                if len(data) > 2_000_000: raise Unavailable("response_too_large")
                return json.loads(data)
        except error.HTTPError as exc:
            raise Unavailable("http_"+str(exc.code)) from None
        except (error.URLError, TimeoutError, OSError):
            raise Unavailable("network_or_tls_failure") from None
        except (ValueError, UnicodeError):
            raise Unavailable("invalid_json") from None


def guard_sql(sql):
    clean = re.sub(r"--[^\n]*", "", sql).strip()
    if not re.match(r"\ABEGIN TRANSACTION READ ONLY;\s*SET LOCAL statement_timeout\s*=\s*'10s';", clean) or not clean.endswith("COMMIT;"):
        raise ValueError("readonly_transaction_and_timeout_required")
    if len(re.findall(r"\bSET\b", clean, re.I)) != 1:
        raise ValueError("unexpected_setting")
    if re.search(r"\b(INSERT|UPDATE|DELETE|MERGE|CREATE|ALTER|DROP|TRUNCATE|COPY|CALL|DO|GRANT|REVOKE|VACUUM|ANALYZE|REFRESH|RESET|DISCARD)\b", clean, re.I):
        raise ValueError("mutation_rejected")
    if re.search(r"\b(pg_cancel_backend|pg_terminate_backend|pg_read_file|pg_ls_dir|pg_stat_statements_reset|set_config|dblink|lo_import)\b|\bnet\s*\.", clean, re.I):
        raise ValueError("side_effect_or_sensitive_function_rejected")
    if re.search(r"\b(query|command|return_message|event_message|rolpassword)\b", clean, re.I):
        raise ValueError("raw_text_rejected")
    return clean


class Operator:
    def __init__(self, http=None, token=None):
        self.http = http or Http()
        self.token = token if token is not None else os.environ.get("SUPABASE_ACCESS_TOKEN")

    def api(self, path, payload=None, params=None):
        if not self.token: raise Unavailable("operator_credential_not_configured")
        base = "https://api.supabase.com/v1/projects/" + PROJECT
        url = base + path
        if params: url += "?" + parse.urlencode(params)
        return self.http.json(url, self.token, payload)

    def sql(self, name):
        if name not in ("capabilities", "snapshot", "performance", "chat-leases", "cron"):
            raise ValueError("unknown_template")
        sql = guard_sql((ROOT / "sql" / (name+".sql")).read_text())
        response = self.api("/database/query/read-only", {"query": sql})
        rows = response.get("result") if isinstance(response, dict) else response
        return sql_snapshot(rows)

    def advisors(self, category):
        # Only documented Management API advisor endpoints. MCP-only Health advisors
        # are recorded as unavailable, rather than guessing another hosted endpoint.
        if category not in ("security", "performance"):
            raise Unavailable("no_verified_hosted_health_advisor_endpoint")
        response = self.api("/advisors/"+category)
        if isinstance(response, dict) and isinstance(response.get("result"), dict): response = response["result"]
        return advisor_objects(category, response)

    def logs(self, window):
        sql = (ROOT / "sql" / "status-counts.clickhouse.sql").read_text()
        response = self.api("/analytics/endpoints/logs", params={"sql": sql, "iso_timestamp_start": window["start"], "iso_timestamp_end": window["end"]})
        if isinstance(response, dict) and response.get('error'):
            raise Unavailable('logs_query_rejected')
        if not isinstance(response, dict) or not isinstance(response.get("result"), list):
            raise Unavailable("invalid_log_aggregate_shape")
        return response["result"]


def windows(now):
    hour, day = now.replace(minute=0, second=0, microsecond=0), now.replace(hour=0, minute=0, second=0, microsecond=0)
    return {key: {"start": iso(start), "end": iso(end)} for key, start, end in (
        ("hourly_current", hour-timedelta(hours=1), hour),
        ("hourly_previous", hour-timedelta(hours=2), hour-timedelta(hours=1)),
        ("daily_current", day-timedelta(days=1), day),
        ("daily_previous", day-timedelta(days=2), day-timedelta(days=1)))}


def collect(state, config, operator=None, http=None, now=None):
    operator, http, now = operator or Operator(), http or Http(), now or datetime.now(UTC)
    if config.get("project_id") != PROJECT or config.get("slack_user_id") != RECIPIENT:
        raise ValueError("target_mismatch")
    results = {}
    def attempt(key, operation):
        try: results[key] = {"status": "ok", "data": operation()}
        except (Unavailable, ValueError) as exc:
            results[key] = {"status": "unable_to_assess", "reason": str(exc) if re.fullmatch(r"[a-z0-9_]+", str(exc)) else "invalid_provider_data"}
    attempt("capabilities", lambda: operator.sql("capabilities"))
    attempt("snapshot", lambda: operator.sql("snapshot"))
    cap = results["capabilities"].get("data", {})
    if cap.get("has_statements"):
        attempt("performance", lambda: operator.sql("performance"))
    else: results["performance"] = {"status": "unable_to_assess", "reason": "statements_extension_or_capability_unavailable"}
    if cap.get("has_chat_leases"): attempt("chat_leases", lambda: operator.sql("chat-leases"))
    else: results["chat_leases"] = {"status": "unable_to_assess", "reason": "chat_lease_catalog_unavailable"}
    if cap.get("has_cron") and cap.get("has_cron_history"): attempt("cron", lambda: operator.sql("cron"))
    elif cap.get("has_cron"): results["cron"] = {"status": "unable_to_assess", "reason": "cron_history_unavailable"}
    for category in ("health", "security", "performance"):
        attempt("advisors_"+category, lambda category=category: operator.advisors(category))
    for key, window in windows(now).items():
        cached = state["log_windows"].get(window["start"]+"/"+window["end"])
        if cached:
            results[key] = cached
        else:
            attempt(key, lambda window=window: operator.logs(window))
            results[key]["window"] = window
    def dependency():
        # Public readiness metadata only: no bearer, recommendation or model call.
        data = http.json("https://agent-brain-production-6956.up.railway.app/ready")
        checks = data.get("checks", {})
        return {"ready": data.get("ok") is True and checks.get("auth_configured") is True and checks.get("allow_unauthenticated") is False}
    attempt("agent_brain", dependency)
    return {"project_id": PROJECT, "observed_at": iso(now), "results": results}


def atomic_json(path, value):
    path = Path(path)
    data = json.dumps(value, indent=2, allow_nan=False).encode() + b"\n"
    fd, temp = tempfile.mkstemp(prefix=".monitor-", dir=path.parent)
    try:
        os.fchmod(fd, 0o600)
        with os.fdopen(fd, "wb") as stream:
            stream.write(data); stream.flush(); os.fsync(stream.fileno())
        os.replace(temp, path)
        directory = os.open(path.parent, os.O_RDONLY)
        try: os.fsync(directory)
        finally: os.close(directory)
    finally:
        if os.path.exists(temp): os.unlink(temp)


class Store:
    def __init__(self, directory):
        self.directory = Path(directory)

    @contextlib.contextmanager
    def locked(self):
        if not self.directory.is_dir(): raise ValueError("durable_state_directory_missing")
        with (self.directory / ".lock").open("a") as lock:
            fcntl.flock(lock, fcntl.LOCK_EX | fcntl.LOCK_NB)
            yield self

    def load(self):
        # Never create/reset a baseline on missing, corrupt or wrong-project state.
        data = json.loads((self.directory / "state.json").read_text())
        validate_state(data)
        return data

    def save(self, state):
        validate_state(state)
        current = self.directory / "state.json"
        if current.exists():
            old = self.load()
            atomic_json(self.directory / "state.last-good.json", old)
        atomic_json(current, state)


class Slack:
    def __init__(self, http=None, token=None):
        self.http = http or Http()
        self.token = token if token is not None else os.environ.get("SLACK_BOT_TOKEN")

    def api(self, method, payload):
        if not self.token: raise Unavailable("slack_credential_not_configured")
        url = 'https://slack.com/api/' + method
        response = self.http.json(url+'?'+parse.urlencode(payload), self.token) if method == 'users.info' else self.http.json(url, self.token, payload)
        if not response.get("ok"): raise Unavailable("slack_rejected_request")
        return response

    def recipient(self):
        user = self.api("users.info", {"user": RECIPIENT}).get("user", {})
        if user.get("id") != RECIPIENT or user.get("deleted") or user.get("is_bot"):
            raise Unavailable("slack_recipient_not_verified")
        channel = self.api("conversations.open", {"users": RECIPIENT}).get("channel", {})
        if not str(channel.get("id", "")).startswith("D"):
            raise Unavailable("slack_destination_not_dm")
        return channel["id"]

    def send(self, channel, text, identifier):
        response = self.api("chat.postMessage", {"channel": channel, "text": text, "unfurl_links": False, "unfurl_media": False})
        if response.get("channel") != channel or not response.get("ts"):
            raise Unavailable("slack_ambiguous_receipt")
        return {"confirmed": True, "user_id": RECIPIENT, "channel_id": channel,
                "message_ts": response["ts"], "alert_batch": identifier,
                "url": "https://thegigagency.slack.com/archives/"+channel+"/p"+response["ts"].replace(".", "")}


def message(events, observed_at):
    groups = {}
    for event in events:
        key = (event["level"], event["category"], event["reason"])
        groups[key] = groups.get(key, 0)+1
    times = sorted(e['observed_at'] for e in events)
    lines = ["Music DNA infrastructure — meaningful changes", "Project: "+PROJECT, "UTC observation window: "+times[0]+" → "+observed_at]
    for (level, category, reason), count in sorted(groups.items()):
        lines.append(f"{level} / {category}: {reason}; affected objects={count}")
    # Bounded numeric evidence only. Per-object details remain in durable state.
    for event in events[:4]:
        ev = event.get("evidence", {})
        numbers = {k: v for k, v in ev.items() if type(v) in (int, float)}
        window = ev.get("window")
        if window: lines.append("UTC window: "+str(window.get("start"))+" → "+str(window.get("end")))
        if numbers: lines.append("Measured: "+json.dumps(numbers, sort_keys=True))
    lines += ['Investigate: '+url for url in sorted({e['link'] for e in events})[:5]]
    lines += ["Next verification: review the affected object/check in the monitoring state and Dashboard; verify intended access or a comparable measurement window. Advisory notices are review signals, not proof of exploitation. No remediation was run."]
    return "\n".join(lines)[:4500]


def deliver(store, state, report, slack=None):
    slack = slack or Slack()
    candidates = [e for e in state['pending_alerts'].values() if e['delivery_status'] == 'pending']
    latest = {}
    for event in candidates:
        latest[event['key']] = event
    pending = []
    for event in candidates:
        current = state['alert_state'].get(event['key'], {})
        if latest[event['key']]['id'] == event['id'] and current.get('status') == 'open' and current.get('signature') == event['signature']:
            pending.append(event)
        else:
            event['delivery_status'] = 'superseded'
    if not pending: return state
    identifier = digest(sorted(e["id"] for e in pending))
    try: channel = slack.recipient()
    except Unavailable as exc:
        state["delivery"]["failure"] = str(exc)
        store.save(state)
        return state
    # Persist the attempt BEFORE transmission. A crash/timeout stays ambiguous;
    # never automatically replay an ambiguous or failed delivery.
    for event in pending:
        state["pending_alerts"][event["id"]].update(delivery_status="sending", attempted_at=report["observed_at"], batch=identifier)
    store.save(state)
    try:
        receipt = slack.send(channel, message(pending, report["observed_at"]), identifier)
    except Unavailable as exc:
        for event in pending: state["pending_alerts"][event["id"]]["delivery_status"] = "ambiguous"
        state["delivery"]["failure"] = str(exc)
        store.save(state)
        return state
    state["notification_receipts"].append(receipt)
    state["delivery"].update(verified=True, channel_id=channel, failure=None)
    for event in pending:
        state["pending_alerts"][event["id"]].update(delivery_status="delivered", receipt=receipt)
    store.save(state)
    report["notification_sent"] = True
    report["notification_receipt"] = receipt
    return state


def due_slot(now, last_slot=None):
    """One collection per UTC HH:05 slot, independent of manual smoke timings."""
    slot = (now-timedelta(minutes=5)).replace(minute=0, second=0, microsecond=0)
    return iso(slot) if not last_slot or stamp(last_slot) < slot else None


def run_once(store, config, send=False, slot=None):
    with store.locked():
        state = store.load()
        observation = collect(state, config)
        state, report = evaluate(state, observation, config)
        if slot is not None: state['last_scheduled_slot'] = slot
        state["hosting"] = {**state['hosting'], "execution_environment": "railway" if os.environ.get("RAILWAY_SERVICE_ID") else "manual", "last_worker_execution": observation['observed_at']}
        report["hosting"] = state["hosting"]
        store.save(state)
        if send: state = deliver(store, state, report)
        report['delivery'] = state['delivery']
        atomic_json(store.directory / "latest-run.json", report)
        print(json.dumps({"event": "monitor_run", "project_id": PROJECT, "observed_at": observation["observed_at"], "coverage": report["coverage"], "new_findings": len(report["new_actionable_findings"]), "notification_sent": report["notification_sent"]}), flush=True)


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--state-dir", required=True)
    parser.add_argument("--loop", action="store_true")
    parser.add_argument("--send", action="store_true")
    args = parser.parse_args()
    config = json.loads((ROOT / "config.json").read_text())
    store = Store(args.state_dir)
    while True:
        try:
            current = store.load()
            # Separate scheduler slots from manual checks: a recent smoke must
            # not postpone the next HH:05 run by an extra hour. No backfill.
            slot = due_slot(datetime.now(UTC), current.get('last_scheduled_slot'))
            if not args.loop or slot is not None:
                run_once(store, config, args.send, slot=slot if args.loop else None)
        except (ValueError, OSError, KeyError) as exc:
            print(json.dumps({"event": "monitor_unavailable", "project_id": PROJECT, "code": type(exc).__name__}), flush=True)
            if not args.loop: raise SystemExit(1) from None
        if not args.loop: break
        now = datetime.now(UTC)
        next_run = now.replace(minute=5, second=0, microsecond=0)
        if next_run <= now: next_run += timedelta(hours=1)
        time.sleep(max(1, (next_run-now).total_seconds()))


if __name__ == "__main__": main()
