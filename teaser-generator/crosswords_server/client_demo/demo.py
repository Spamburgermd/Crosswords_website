# client_demo/demo.py
# Purpose: tiny script to show how to call the API from Python (while you build your React Native app).
# Run the server first:
#   uvicorn app.main:app --reload
# Then run:
#   python client_demo/demo.py

import requests

BASE = "http://127.0.0.1:8000"

def post(path, json=None, token=None):
    headers = {"Authorization": f"Bearer {token}"} if token else {}
    r = requests.post(f"{BASE}{path}", json=json, headers=headers)
    r.raise_for_status()
    return r.json()

def get(path, token=None):
    headers = {"Authorization": f"Bearer {token}"} if token else {}
    r = requests.get(f"{BASE}{path}", headers=headers)
    r.raise_for_status()
    return r.json()

def main():
    # 1) Register or login two users
    u1 = post("/auth/register", {"username": "alice", "password": "password123"})
    u2 = post("/auth/register", {"username": "bob", "password": "password123"})

    # 2) Create a game as Alice, then Bob joins
    game = post("/games/create", token=u1["api_key"])
    game_id = game["game_id"]
    post("/games/join", {"game_id": game_id}, token=u2["api_key"])

    # 3) Submit words (in dev mode, if you haven't provided the word list, any A-Z words will pass)
    alice_words = ["TREE", "BIRD", "APPLE", "TABLE", "PLANET"]
    # TREE (4), BIRD (4), APPLE (5), TABLE (5), PLANET (6)
    post(f"/games/{game_id}/submit_words", {"words": alice_words}, token=u1["api_key"])

    bob_words = ["WIND", "FROG", "CHAIR", "MOUSE", "ORANGE"]
    post(f"/games/{game_id}/submit_words", {"words": bob_words}, token=u2["api_key"])

    # 4) Check state from Alice's perspective
    state = get(f"/games/{game_id}/state", token=u1["api_key"])
    print("STATE after submissions:", state)

    # 5) Alice makes a guess at Bob's first word (index 0) - guess length must match
    guess = post(f"/games/{game_id}/guess", {"target_word_index": 0, "guess_word": "SAND"}, token=u1["api_key"])
    print("ALICE GUESS FEEDBACK:", guess)

    # 6) Now it's Bob's turn
    state2 = get(f"/games/{game_id}/state", token=u2["api_key"])
    print("STATE (Bob):", state2)

if __name__ == "__main__":
    main()
