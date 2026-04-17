
"""
smoke_ready_countdown.py
------------------------
PURPOSE
  Black-box smoke test to validate the "Countdown → Active flip" flow on your server:
    1) Player 1 (Alice) creates a game
    2) Player 1 and Player 2 (Bob) submit valid words (server auto-places them)
    3) Both click "I'm Ready" (POST /games/{id}/ready)
    4) Server flips status to "starting" (or "ready") and may set start_at
    5) Script polls /games/{id}/state until status becomes "active" (or "in_progress")

NOTE
  - This script **does not** drive your UI; it verifies server-side behavior only.
  - Your client app is expected to auto-navigate to the Board when status becomes "active".

HOW TO RUN
  1) Start your API server (from the project root):
       uvicorn app.main:app --reload
  2) Ensure 'requests' is installed:
       pip install requests
  3) Run this script:
       python smoke_ready_countdown.py --base-url http://127.0.0.1:8000

  Common flags:
    --timeout 40          # seconds to wait for status to flip to active
    --poll-interval 1.0   # seconds between /state polls
    --seed 42             # deterministic usernames in CI
    --report out.json     # write a machine-readable JSON report

EXIT CODE
  0 on success; 1 on first failure (also writes 'status: failed' in report if --report is used).
"""

from __future__ import annotations

import argparse
import json
import os
import random
import string
import sys
import time
from typing import Any, Dict, List, Tuple

try:
    import requests  # lightweight HTTP client
except Exception:
    print("This script needs 'requests'. Install with: pip install requests")
    sys.exit(2)

# ------------------------------ Small RNG helpers (for deterministic CI runs) ------------------------------
RNG = random.Random()

def set_seed(seed: int | None) -> None:
    """If a seed is provided, we seed our local RNG so the usernames are reproducible in CI."""
    if seed is not None:
        RNG.seed(seed)

def unique_suffix(n: int = 6) -> str:
    """Short random suffix to avoid collisions with existing DB rows during dev runs."""
    chars = string.ascii_lowercase + string.digits
    return "".join(RNG.choices(chars, k=n))

def uname(prefix: str) -> str:
    """Builds a unique username like 'alice_ab12cd'."""
    return f"{prefix}_{unique_suffix(6)}"


# ------------------------------ Thin HTTP wrappers with clear logging ------------------------------
def post_json(base: str, path: str, payload: Dict[str, Any],
              headers: Dict[str, str] | None = None) -> requests.Response:
    """
    POST a JSON body to base+path. We keep logs compact but informative so you can follow the flow.
    """
    url = f"{base}{path}"
    print(f"\nPOST {url}\n  payload = {payload}")
    r = requests.post(url, json=payload, headers=headers or {}, timeout=20)
    print(f"  -> {r.status_code}\n  body = {r.text[:500]}")
    return r

def get_json(base: str, path: str, headers: Dict[str, str] | None = None) -> requests.Response:
    """GET base+path. We log the status and the first ~500 chars of the body for debugging."""
    url = f"{base}{path}"
    print(f"\nGET  {url}")
    r = requests.get(url, headers=headers or {}, timeout=20)
    print(f"  -> {r.status_code}\n  body = {r.text[:500]}")
    return r

def require_status(resp: requests.Response, expected: int | tuple[int, ...],
                   label: str, summary: Dict[str, Any]) -> None:
    """
    Assert that the response status code is what we expect.
    - On mismatch, we record the failure and exit(1) so CI fails fast.
    """
    if isinstance(expected, int):
        expected = (expected,)
    if resp.status_code not in expected:
        err = {"label": label, "expected": list(expected), "got": resp.status_code, "body": safe_body(resp)}
        print(f"❌ {label}: expected {expected}, got {resp.status_code}")
        try:
            print("Response JSON:", resp.json())
        except Exception:
            print("Response Text:", resp.text)
        summary.setdefault("errors", []).append(err)
        finalize(summary, failed=True)
    print(f"✅ {label}")

def parse_json(resp: requests.Response, label: str, summary: Dict[str, Any]) -> Dict[str, Any]:
    """Return resp.json() or bail out with a clear message and a CI-friendly report entry."""
    try:
        return resp.json()
    except Exception:
        err = {"label": f"{label} (invalid JSON)", "body": safe_body(resp)}
        print(f"❌ {label}: response is not JSON")
        print(err["body"][:400])
        summary.setdefault("errors", []).append(err)
        finalize(summary, failed=True)
        raise AssertionError  # not reached

def safe_body(resp: requests.Response) -> str:
    """Safely get text for logging/reporting even if the response is strange."""
    try:
        return resp.text
    except Exception:
        return "<unreadable response body>"

def finalize(summary: Dict[str, Any], failed: bool) -> None:
    """
    Write a machine-readable JSON report (if requested), then exit with the proper code.
    - We strip internal keys (those starting with '_') out of the persisted report.
    """
    summary["status"] = "failed" if failed else "passed"
    if summary.get("_report_path"):
        try:
            with open(summary["_report_path"], "w", encoding="utf-8") as f:
                json.dump({k: v for k, v in summary.items() if not k.startswith("_")}, f, indent=2)
            print(f"📄 wrote report to {summary['_report_path']}")
        except Exception as e:
            print(f"⚠️ could not write report {summary['_report_path']}: {e}")
    sys.exit(1 if failed else 0)


# ------------------------------ API-specific helpers (match your server contract) ------------------------------
def register(base: str, username: str, password: str, summary: Dict[str, Any]) -> Tuple[int, str]:
    """POST /auth/register → returns (user_id, api_key)."""
    r = post_json(base, "/auth/register", {"username": username, "password": password})
    require_status(r, 200, "register", summary)
    j = parse_json(r, "register response", summary)
    uid, key = j.get("user_id"), j.get("api_key")
    if not isinstance(uid, int) or not isinstance(key, str):
        summary.setdefault("errors", []).append({"label": "register shape", "body": j})
        finalize(summary, failed=True)
    return uid, key

def login(base: str, username: str, password: str, summary: Dict[str, Any]) -> Tuple[int, str]:
    """POST /auth/login → returns (user_id, api_key). Used as a sanity check on auth."""
    r = post_json(base, "/auth/login", {"username": username, "password": password})
    require_status(r, 200, "login", summary)
    j = parse_json(r, "login response", summary)
    uid, key = j.get("user_id"), j.get("api_key")
    if not isinstance(uid, int) or not isinstance(key, str):
        summary.setdefault("errors", []).append({"label": "login shape", "body": j})
        finalize(summary, failed=True)
    return uid, key

def create_game(base: str, token: str, summary: Dict[str, Any]) -> int:
    """POST /games/create → {game_id}"""
    r = post_json(base, "/games/create", {}, headers={"Authorization": f"Bearer {token}"})
    require_status(r, 200, "create game", summary)
    j = parse_json(r, "create game response", summary)
    gid = j.get("game_id")
    if not isinstance(gid, int):
        summary.setdefault("errors", []).append({"label": "create game shape", "body": j})
        finalize(summary, failed=True)
    return gid

def join_game(base: str, token: str, game_id: int, summary: Dict[str, Any]) -> None:
    """POST /games/join → add second player to the game"""
    r = post_json(base, "/games/join", {"game_id": game_id}, headers={"Authorization": f"Bearer {token}"})
    require_status(r, 200, "join game", summary)

def submit_words(base: str, token: str, game_id: int, words: List[str], summary: Dict[str, Any]) -> bool:
    """
    POST /games/{id}/submit_words → server validates 2x4, 2x5, 1x6 and auto-places them.
    Returns True if server accepted (200); False otherwise.
    """
    r = post_json(base, f"/games/{game_id}/submit_words", {"words": words},
                  headers={"Authorization": f"Bearer {token}"})
    ok = (r.status_code == 200)
    print(f"{'✅' if ok else '❌'} submit words -> {r.status_code}")
    if not ok:
        print("    body:", r.text[:500])
    return ok

def ready(base: str, token: str, game_id: int, summary: Dict[str, Any]) -> Dict[str, Any]:
    """POST /games/{id}/ready → flips to 'starting' once both players are ready."""
    r = post_json(base, f"/games/{game_id}/ready", {}, headers={"Authorization": f"Bearer {token}"})
    # This smoke **requires** /ready. If missing (404), we fail intentionally.
    require_status(r, 200, "ready", summary)
    return parse_json(r, "ready response", summary)

def state(base: str, token: str, game_id: int, summary: Dict[str, Any]) -> Dict[str, Any]:
    """GET /games/{id}/state → returns GameStateOut (plus optional fields like start_at in some builds)."""
    r = get_json(base, f"/games/{game_id}/state", headers={"Authorization": f"Bearer {token}"})
    require_status(r, 200, "state", summary)
    return parse_json(r, "state response", summary)


# ------------------------------ Main scenario ------------------------------
def main() -> int:
    parser = argparse.ArgumentParser(description="Smoke test: Countdown → Active flip")
    parser.add_argument("--base-url", default=os.getenv("BASE_URL", "http://127.0.0.1:8000"))
    parser.add_argument("--password", default="Password123!")
    parser.add_argument("--timeout", type=float, default=40.0, help="Max seconds to wait for status=active")
    parser.add_argument("--poll-interval", type=float, default=1.0, help="Seconds between /state polls")
    parser.add_argument("--seed", type=int, default=None, help="Deterministic usernames in CI")
    parser.add_argument("--report", default=None, help="Write a JSON report to this path")
    args = parser.parse_args()

    set_seed(args.seed)

    base = args.base_url.rstrip("/")
    pwd  = args.password

    # 'summary' is written to --report (if provided) and helps you debug CI runs.
    summary: Dict[str, Any] = {
        "server": base,
        "status": "running",
        "seed": args.seed,
        "timeout": args.timeout,
        "poll_interval": args.poll_interval,
        "_report_path": args.report,
    }

    # --- 1) Register + login two users ---
    alice = uname("alice")
    bob   = uname("bob")
    summary["users"] = {"alice": alice, "bob": bob}
    print(f"Users: {alice}, {bob}")

    alice_id, alice_key = register(base, alice, pwd, summary)
    bob_id,   bob_key   = register(base, bob,   pwd, summary)
    # Quick login sanity
    login(base, alice, pwd, summary)
    login(base, bob,   pwd, summary)

    # --- 2) Create game as Alice; Bob joins ---
    gid = create_game(base, alice_key, summary)
    summary["game_id"] = gid
    join_game(base, bob_key, gid, summary)

    # --- 3) Submit words for both players ---
    # We try up to TWO curated sets to reduce auto-placement flakiness.
    wordsets = [
        ["LETTER","PLEAD","APPLE","PEEL","LEER"],   # 6,5,5,4,4
        ["EASTER","STARE","ASTER","RATE","TEAR"],   # 6,5,5,4,4
    ]

    accepted = False
    for idx, words in enumerate(wordsets, 1):
        print(f"\n--- Trying word set {idx}: {words}")
        ok1 = submit_words(base, alice_key, gid, words, summary)
        ok2 = submit_words(base, bob_key,   gid, words, summary) if ok1 else False
        if ok1 and ok2:
            accepted = True
            summary["words"] = words
            break

    if not accepted:
        summary.setdefault("errors", []).append({"label": "auto-placement failed", "body": "All curated word sets rejected."})
        finalize(summary, failed=True)

    # --- 4) Both click "I'm Ready" (/ready) ---
    # After the first ready, game may still be 'waiting'. After the second, expect 'starting' (or 'ready').
    r1 = ready(base, alice_key, gid, summary)
    r2 = ready(base, bob_key,   gid, summary)

    # Status should now be 'starting'/'ready'. Some builds also include 'start_at' in state.
    status_now = r2.get("status")
    summary["ready_status_after_both"] = status_now
    possible_starting = {"starting", "ready"}  # accept either keywording
    if status_now not in possible_starting:
        print(f"⚠️ After both /ready, server returned status={status_now!r} (expected one of {possible_starting}).")
        print("   Proceeding to poll for final 'active'/'in_progress' state...")

    # --- 5) Poll /state until we see 'active' (or 'in_progress') or we time out ---
    deadline = time.time() + args.timeout
    active_statuses = {"active", "in_progress"}
    start_at_seen = None
    while time.time() < deadline:
        s = state(base, alice_key, gid, summary)
        # If your server includes a 'start_at' field in this response, record it.
        if "start_at" in s and start_at_seen is None:
            start_at_seen = s["start_at"]
        if s.get("status") in active_statuses:
            summary["active_status"] = s.get("status")
            summary["start_at"] = start_at_seen
            print(f"\n🎉 Countdown complete: status is {s['status']!r}")
            finalize(summary, failed=False)
        time.sleep(args.poll_interval)

    # If we reach here, we never saw 'active'/'in_progress' before timeout.
    summary.setdefault("errors", []).append({
        "label": "timeout waiting for active",
        "expected_any_of": list(active_statuses),
        "last_known_status": status_now,
        "start_at": start_at_seen,
    })
    finalize(summary, failed=True)
    return 0  # not reached

if __name__ == "__main__":
    sys.exit(main())
