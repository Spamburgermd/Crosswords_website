
"""
smoke_username_rules_ci.py
--------------------------
Purpose:
  A focused black-box smoke test to validate the username rules of your /auth/register
  endpoint (and a quick login check for valid cases). This script is CI-friendly and
  can optionally write a JSON report.

What it checks:
  - INVALID usernames (expect HTTP 422 from Pydantic or 400 from manual validation):
      * too short: "", "a", "ab"
      * too long: 31 chars
      * invalid characters: space, hyphen, punctuation, symbols, unicode, tabs/newlines
  - VALID usernames (expect 200):
      * exactly 3 chars
      * underscores allowed
      * digits allowed
      * mixed case + digits + underscore
      * exactly 30 chars
    For each valid registration, it also tests /auth/login and verifies we get {user_id, api_key}.
  - DUPLICATE valid username should be rejected (400).

Usage:
  uvicorn app.main:app --reload
  pip install requests
  python smoke_username_rules_ci.py --base-url http://127.0.0.1:8000 --report username_report.json --seed 42

Exit code:
  0 on success; 1 on first failure. (If --report is set, a JSON report is written either way.)
"""

from __future__ import annotations

import argparse
import json
import os
import random
import string
import sys
import time
from typing import Any, Dict

try:
    import requests
except Exception:
    print("This script needs 'requests'. Install with: pip install requests")
    sys.exit(2)

# ------------------------------ Deterministic RNG (for CI) ------------------------------

RNG = random.Random()

def set_seed(seed: int | None):
    """Seed our local RNG so suffixes are reproducible (handy in CI)."""
    if seed is not None:
        RNG.seed(seed)

# ------------------------------ Small HTTP helpers ------------------------------

def post_json(base: str, path: str, payload: Dict[str, Any]):
    """POST JSON to base+path and return the response object."""
    url = f"{base}{path}"
    return requests.post(url, json=payload, timeout=15)

def expect_status(resp, expected_codes, label: str, quiet: bool, summary: Dict[str, Any]):
    """
    Fail-fast if the HTTP status code isn't one of the expected ones.
    We also append structured info to the summary so CI can parse it.
    """
    if isinstance(expected_codes, int):
        expected_codes = {expected_codes}
    ok = resp.status_code in expected_codes
    if not quiet:
        preview = resp.text.replace("\n", "\\n")[:300]
        print(f"{'✅' if ok else '❌'} {label}: got {resp.status_code} (expected {sorted(expected_codes)})")
        if not ok:
            print("    Body:", preview)
    if not ok:
        summary.setdefault("errors", []).append({
            "label": label,
            "expected": sorted(expected_codes),
            "got": resp.status_code,
            "body": safe_body(resp),
        })
        finalize_and_exit(summary, failed=True)

def parse_json(resp, label, summary: Dict[str, Any]):
    """Parse JSON or bail with a helpful error message & report entry."""
    try:
        return resp.json()
    except Exception:
        body = safe_body(resp)
        print(f"❌ {label}: response was not valid JSON")
        print(body[:400])
        summary.setdefault("errors", []).append({
            "label": f"{label} (invalid JSON)",
            "body": body
        })
        finalize_and_exit(summary, failed=True)

def safe_body(resp) -> str:
    try:
        return resp.text
    except Exception:
        return "<unreadable response body>"

def finalize_and_exit(summary: Dict[str, Any], failed: bool):
    """Write the JSON report if requested, then exit(1/0)."""
    summary["status"] = "failed" if failed else "passed"
    if summary.get("_report_path"):
        try:
            with open(summary["_report_path"], "w", encoding="utf-8") as f:
                json.dump({k: v for k, v in summary.items() if not k.startswith("_")}, f, indent=2)
            print(f"📄 wrote report to {summary['_report_path']}")
        except Exception as e:
            print(f"⚠️ could not write report {summary['_report_path']}: {e}")
    sys.exit(1 if failed else 0)

# ------------------------------ Username generation ------------------------------

def unique_suffix(length: int = 6) -> str:
    """Create a short suffix to avoid collisions in the DB."""
    # Use RNG for deterministic behavior under --seed
    chars = string.ascii_lowercase + string.digits
    return "".join(RNG.choices(chars, k=length))

# ------------------------------ Main test logic ------------------------------

def main() -> int:
    parser = argparse.ArgumentParser(description="Smoke test: username rule validation (CI-friendly)")
    parser.add_argument("--base-url", default=os.getenv("BASE_URL", "http://127.0.0.1:8000"))
    parser.add_argument("--password", default="Password123!")
    parser.add_argument("--quiet", action="store_true")
    parser.add_argument("--report", default=None, help="Write a JSON report to this path")
    parser.add_argument("--seed", type=int, default=None, help="Deterministic suffixes for CI")
    args = parser.parse_args()

    set_seed(args.seed)

    base = args.base_url.rstrip("/")
    pwd  = args.password
    q    = args.quiet

    summary: Dict[str, Any] = {
        "server": base,
        "seed": args.seed,
        "status": "running",
        "_report_path": args.report,
        "results": {
            "invalid": [],
            "valid": [],
            "duplicate": None,
        },
    }

    # INVALID USERNAMES — expect 422 (Pydantic) or 400 (manual)
    invalid_cases = [
        ("", "empty"),
        ("a", "1 char"),
        ("ab", "2 chars"),
        ("a"*31, "31 chars (too long)"),
        ("ab c", "contains space"),
        ("john-doe", "contains hyphen"),
        ("user!", "contains punctuation exclam"),
        ("weird$name", "contains symbol $"),
        ("汉字", "non-ASCII unicode"),
        ("tab\tname", "contains tab"),
        ("line\nbreak", "contains newline"),
    ]

    print("\n=== INVALID USERNAMES ===")
    for username, reason in invalid_cases:
        resp = post_json(base, "/auth/register", {"username": username, "password": pwd})
        expect_status(resp, {400, 422}, f"{username!r} invalid ({reason})", q, summary)
        summary["results"]["invalid"].append({"username": username, "reason": reason, "status": resp.status_code})

    # VALID USERNAMES — expect 200 and JSON with user_id+api_key, and login should also succeed
    valid_cases = [
        ("abc", "exactly 3 chars"),
        ("my_name", "underscore allowed"),
        ("user123", "digits allowed"),
        ("A_B_c_9", "mixed case + digits + underscore"),
        ("X"*30, "exactly 30 chars"),
    ]

    print("\n=== VALID USERNAMES ===")
    for base_name, reason in valid_cases:
        # Append a unique suffix to avoid DB collisions across runs
        uname = f"{base_name}_{unique_suffix(4)}"
        # 1) register
        r = post_json(base, "/auth/register", {"username": uname, "password": pwd})
        expect_status(r, 200, f"{uname!r} valid ({reason}) -> register", q, summary)
        data = parse_json(r, "register response", summary)
        if not isinstance(data.get("user_id"), int) or not isinstance(data.get("api_key"), str):
            summary.setdefault("errors", []).append({"label":"register shape", "body": data})
            finalize_and_exit(summary, failed=True)

        # 2) login
        r2 = post_json(base, "/auth/login", {"username": uname, "password": pwd})
        expect_status(r2, 200, f"{uname!r} valid -> login", q, summary)
        data2 = parse_json(r2, "login response", summary)
        if not isinstance(data2.get("user_id"), int) or not isinstance(data2.get("api_key"), str):
            summary.setdefault("errors", []).append({"label":"login shape", "body": data2})
            finalize_and_exit(summary, failed=True)

        summary["results"]["valid"].append({
            "username": uname,
            "reason": reason,
            "register_status": 200,
            "login_status": 200,
            "user_id": data.get("user_id"),
        })

    # DUPLICATE — expect 400
    print("\n=== DUPLICATE USERNAME ===")
    dup_name = f"dupuser_{unique_suffix(6)}"
    first = post_json(base, "/auth/register", {"username": dup_name, "password": pwd})
    expect_status(first, 200, "duplicate: first create", q, summary)
    second = post_json(base, "/auth/register", {"username": dup_name, "password": pwd})
    expect_status(second, 400, "duplicate: second create rejected", q, summary)
    summary["results"]["duplicate"] = {"username": dup_name, "first": first.status_code, "second": second.status_code}

    print("\n🎉 Username rule smoke test passed.")
    finalize_and_exit(summary, failed=False)
    return 0  # not reached

if __name__ == "__main__":
    sys.exit(main())
