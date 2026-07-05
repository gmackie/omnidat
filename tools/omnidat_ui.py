from __future__ import annotations

import argparse
import html
import json
import time
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from typing import Any
from urllib.parse import parse_qs, urlparse

from tools.omnidat_activity import load_passports, read_activity_records
from tools.omnidat_queue import read_orders
from tools.omnidat_radio_pad import handle_command


START_TIME = time.monotonic()
REQUIRED_SEED_FILES = [
    "packet-services.json",
    "campsite-apps.sample.json",
    "activity-passports.sample.json",
    "queue-apps.sample.json",
]


def build_state(data_dir: Path, queue_dir: Path, activity_dir: Path) -> dict[str, Any]:
    apps = load_optional_json(data_dir / "campsite-apps.sample.json")
    passports = list(load_passports(data_dir).values())
    orders = read_orders(queue_dir)
    activities = read_activity_records(activity_dir)
    return {
        "apps": apps,
        "passports": passports,
        "orders": orders,
        "activities": activities,
        "app_count": len(apps),
        "passport_count": len(passports),
        "order_count": len(orders),
        "activity_count": len(activities),
    }


def render_home(state: dict[str, Any]) -> str:
    rows = "\n".join(
        f"""
        <tr>
          <td><code>{escape(app['address'])}</code></td>
          <td>{escape(app['app_name'])}</td>
          <td>{escape(app['template'])}</td>
          <td>{escape(app['directory_status'])}</td>
          <td>{escape(app['status'])}</td>
        </tr>
        """
        for app in state["apps"]
    )
    passport_rows = "\n".join(
        f"<tr><td><code>{escape(item['passport_id'])}</code></td><td>{escape(item['handle'])}</td></tr>"
        for item in state["passports"]
    )
    order_rows = "\n".join(
        f"""
        <tr>
          <td><code>{escape(order.get('ticket_id', ''))}</code></td>
          <td>{escape(order.get('passport_id', ''))}</td>
          <td>{escape(order.get('status', ''))}</td>
          <td>{escape(str(order.get('queue_position', '')))}</td>
        </tr>
        """
        for order in state["orders"][-8:]
    )
    activity_rows = "\n".join(
        f"""
        <tr>
          <td><code>{escape(record.get('activity_id', ''))}</code></td>
          <td>{escape(record.get('identity_id', ''))}</td>
          <td>{escape(record.get('action', ''))}</td>
          <td>{escape(record.get('service_address', ''))}</td>
        </tr>
        """
        for record in state["activities"][-8:]
    )
    return f"""<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>OMNIDAT Field Office</title>
  <style>
    :root {{
      color-scheme: light;
      --paper: #f7f5ef;
      --ink: #171717;
      --rule: #2f3b43;
      --panel: #ffffff;
      --green: #164b36;
      --red: #8f1d1d;
      --blue: #203f70;
      --amber: #8b5f00;
    }}
    * {{ box-sizing: border-box; }}
    body {{
      margin: 0;
      background: var(--paper);
      color: var(--ink);
      font: 14px/1.45 ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
    }}
    header {{
      border-bottom: 4px double var(--rule);
      padding: 18px 24px 14px;
      background: #fffefa;
    }}
    h1 {{
      margin: 0;
      font-size: 24px;
      letter-spacing: 0;
    }}
    main {{
      display: grid;
      grid-template-columns: minmax(0, 1.35fr) minmax(280px, 0.65fr);
      gap: 16px;
      padding: 16px;
      max-width: 1280px;
      margin: 0 auto;
    }}
    section {{
      background: var(--panel);
      border: 1px solid var(--rule);
      padding: 12px;
      min-width: 0;
    }}
    h2 {{
      margin: 0 0 10px;
      font-size: 15px;
      text-transform: uppercase;
    }}
    .metrics {{
      display: grid;
      grid-template-columns: repeat(4, minmax(0, 1fr));
      gap: 8px;
      margin-bottom: 16px;
    }}
    .metric {{
      border: 1px solid var(--rule);
      background: #f3f6f2;
      padding: 10px;
      min-height: 64px;
    }}
    .metric strong {{
      display: block;
      font-size: 22px;
      color: var(--green);
    }}
    table {{
      width: 100%;
      border-collapse: collapse;
    }}
    th, td {{
      border-bottom: 1px solid #c8c6bd;
      padding: 6px 5px;
      text-align: left;
      vertical-align: top;
    }}
    th {{
      color: var(--blue);
      font-size: 12px;
    }}
    form {{
      display: grid;
      gap: 8px;
    }}
    input, button {{
      font: inherit;
      min-height: 38px;
      border: 1px solid var(--rule);
      background: #fff;
      color: var(--ink);
      padding: 8px;
      width: 100%;
    }}
    button {{
      background: var(--green);
      color: #fff;
      cursor: pointer;
    }}
    code {{
      color: var(--red);
    }}
    .stack {{
      display: grid;
      gap: 16px;
    }}
    @media (max-width: 820px) {{
      main {{ grid-template-columns: 1fr; }}
      .metrics {{ grid-template-columns: repeat(2, minmax(0, 1fr)); }}
    }}
  </style>
</head>
<body>
  <header>
    <h1>OMNIDAT Field Office</h1>
    <div>Packet Clearing / Radio PAD / Activity Bureau</div>
  </header>
  <main>
    <div>
      <div class="metrics">
        <div class="metric"><strong>{state['app_count']}</strong>APPS</div>
        <div class="metric"><strong>{state['passport_count']}</strong>PASSPORTS</div>
        <div class="metric"><strong>{state['order_count']}</strong>ORDERS</div>
        <div class="metric"><strong>{state['activity_count']}</strong>ACTIVITY</div>
      </div>
      <section>
        <h2>Packet Applications</h2>
        <table>
          <thead><tr><th>ADDR</th><th>SERVICE</th><th>TEMPLATE</th><th>DIR</th><th>STATUS</th></tr></thead>
          <tbody>{rows}</tbody>
        </table>
      </section>
    </div>
    <div class="stack">
      <section>
        <h2>Radio PAD</h2>
        <form action="/radio" method="get">
          <input name="command" value="DIR" aria-label="Radio PAD command">
          <button type="submit">Submit Command</button>
        </form>
      </section>
      <section>
        <h2>Passports</h2>
        <table><tbody>{passport_rows}</tbody></table>
      </section>
      <section>
        <h2>Recent Orders</h2>
        <table><thead><tr><th>TKT</th><th>PASS</th><th>STATUS</th><th>POS</th></tr></thead><tbody>{order_rows}</tbody></table>
      </section>
      <section>
        <h2>Recent Activity</h2>
        <table><thead><tr><th>ACT</th><th>ID</th><th>ACTION</th><th>SVC</th></tr></thead><tbody>{activity_rows}</tbody></table>
      </section>
    </div>
  </main>
</body>
</html>
"""


def handle_health(
    data_dir: Path,
    queue_dir: Path,
    activity_dir: Path,
) -> tuple[int, dict[str, str], str]:
    checks = {
        "seed_data": check_seed_data(data_dir),
        "runtime_dirs": check_runtime_dirs(queue_dir, activity_dir),
    }
    status = determine_status(checks)
    payload = {
        "service": "omnidat-field-office",
        "status": status,
        "timestamp": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        "uptime": int(time.monotonic() - START_TIME),
        "checks": checks,
    }
    return (
        200 if status in {"healthy", "degraded"} else 503,
        {"Content-Type": "application/json"},
        json.dumps(payload, sort_keys=True) + "\n",
    )


def handle_state(
    data_dir: Path,
    queue_dir: Path,
    activity_dir: Path,
    journal_db: Path | None = None,
) -> tuple[int, dict[str, str], str]:
    """Machine-readable field-office status for the Raspi/PBX dashboard.

    Bundles the operational state (apps, passports, orders, activity), the
    health check, and — when a field kit journal exists — its authority and
    sync backlog, so a local dashboard can render without scraping HTML.
    """
    state = build_state(data_dir, queue_dir, activity_dir)
    checks = {
        "seed_data": check_seed_data(data_dir),
        "runtime_dirs": check_runtime_dirs(queue_dir, activity_dir),
    }
    status = determine_status(checks)
    payload = {
        "service": "omnidat-field-office",
        "status": status,
        "timestamp": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        "uptime": int(time.monotonic() - START_TIME),
        "checks": checks,
        "counts": {
            "apps": state["app_count"],
            "passports": state["passport_count"],
            "orders": state["order_count"],
            "activities": state["activity_count"],
        },
        "state": state,
        "journal": journal_status(journal_db),
    }
    return (
        200 if status in {"healthy", "degraded"} else 503,
        {"Content-Type": "application/json"},
        json.dumps(payload, sort_keys=True) + "\n",
    )


def journal_status(journal_db: Path | None) -> dict[str, Any]:
    if journal_db is None or not journal_db.exists():
        return {"present": False}
    from tools.omnidat_journal import JournalStore

    store = JournalStore(journal_db)
    try:
        entries = store.entries()
        unpushed = store.unpushed()
        return {
            "present": True,
            "source_id": store.source_id,
            "total": len(entries),
            "unpushed": len(unpushed),
        }
    finally:
        store.close()


def check_seed_data(data_dir: Path) -> dict[str, str]:
    missing = [
        filename
        for filename in REQUIRED_SEED_FILES
        if not (data_dir / filename).exists()
    ]
    if missing:
        return {
            "status": "fail",
            "message": f"missing seed files: {', '.join(missing)}",
        }
    return {
        "status": "pass",
        "message": f"{len(REQUIRED_SEED_FILES)} seed files present",
    }


def check_runtime_dirs(queue_dir: Path, activity_dir: Path) -> dict[str, str]:
    for directory in [queue_dir, activity_dir]:
        directory.mkdir(parents=True, exist_ok=True)
    return {
        "status": "pass",
        "message": "queue and activity directories writable",
    }


def determine_status(checks: dict[str, dict[str, str]]) -> str:
    statuses = {check["status"] for check in checks.values()}
    if "fail" in statuses:
        return "unhealthy"
    if "warn" in statuses:
        return "degraded"
    return "healthy"


def handle_radio_query(
    query: dict[str, list[str]],
    data_dir: Path,
    queue_dir: Path,
    activity_dir: Path,
    log_path: Path,
) -> tuple[int, dict[str, str], str]:
    command = query.get("command", ["HELP"])[0]
    try:
        response = handle_command(
            command,
            data_dir=data_dir,
            queue_dir=queue_dir,
            activity_dir=activity_dir,
            log_path=log_path,
        )
        status = 200
    except Exception as exc:  # pragma: no cover - exercised by live operator use
        response = f"OMNIDAT FIELD PAD\nERROR {exc}\nCLR 99"
        status = 400
    body = render_shell_response(command, response)
    return status, {"Content-Type": "text/html; charset=utf-8"}, body


def render_shell_response(command: str, response: str) -> str:
    return f"""<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>OMNIDAT Radio PAD</title>
  <style>
    body {{ margin: 0; padding: 20px; background: #111; color: #f4f1df; font: 15px/1.45 ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; }}
    a {{ color: #9fc3ff; }}
    pre {{ white-space: pre-wrap; border: 1px solid #777; padding: 16px; background: #050505; }}
  </style>
</head>
<body>
  <a href="/">FIELD OFFICE</a>
  <h1>RADIO PAD</h1>
  <div>COMMAND: <code>{escape(command)}</code></div>
  <pre>{escape(response)}</pre>
</body>
</html>
"""


def make_handler(
    data_dir: Path,
    queue_dir: Path,
    activity_dir: Path,
    log_path: Path,
    journal_db: Path | None = None,
) -> type[BaseHTTPRequestHandler]:
    class OmnidatHandler(BaseHTTPRequestHandler):
        def do_GET(self) -> None:  # noqa: N802 - stdlib method name
            parsed = urlparse(self.path)
            if parsed.path == "/":
                state = build_state(data_dir, queue_dir, activity_dir)
                self.respond(200, {"Content-Type": "text/html; charset=utf-8"}, render_home(state))
                return
            if parsed.path in {"/api/health", "/api/health/live", "/api/health/ready"}:
                self.respond(*handle_health(data_dir, queue_dir, activity_dir))
                return
            if parsed.path == "/api/state":
                self.respond(*handle_state(data_dir, queue_dir, activity_dir, journal_db))
                return
            if parsed.path == "/radio":
                self.respond(*handle_radio_query(parse_qs(parsed.query), data_dir, queue_dir, activity_dir, log_path))
                return
            self.respond(404, {"Content-Type": "text/plain; charset=utf-8"}, "not found\n")

        def respond(self, status: int, headers: dict[str, str], body: str) -> None:
            encoded = body.encode("utf-8")
            self.send_response(status)
            for key, value in headers.items():
                self.send_header(key, value)
            self.send_header("Content-Length", str(len(encoded)))
            self.end_headers()
            self.wfile.write(encoded)

        def log_message(self, format: str, *args: Any) -> None:
            return

    return OmnidatHandler


def load_optional_json(path: Path) -> list[dict[str, Any]]:
    if not path.exists():
        return []
    return json.loads(path.read_text())


def escape(value: Any) -> str:
    return html.escape(str(value), quote=True)


def main() -> int:
    parser = argparse.ArgumentParser(description="Serve the OMNIDAT Field Office UI.")
    parser.add_argument("--data-dir", default="data", type=Path)
    parser.add_argument("--queue-dir", default="build/queue", type=Path)
    parser.add_argument("--activity-dir", default="build/activity", type=Path)
    parser.add_argument("--log", default="build/events.jsonl", type=Path)
    parser.add_argument("--host", default="127.0.0.1")
    parser.add_argument("--port", type=int, default=8828)
    parser.add_argument(
        "--journal-db",
        type=Path,
        default=None,
        help="Field kit journal SQLite path; exposed via /api/state when present.",
    )
    args = parser.parse_args()

    handler = make_handler(
        args.data_dir, args.queue_dir, args.activity_dir, args.log, args.journal_db
    )
    server = ThreadingHTTPServer((args.host, args.port), handler)
    print(f"http://{args.host}:{args.port}")
    server.serve_forever()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
