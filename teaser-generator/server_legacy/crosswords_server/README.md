# CrosSwords — FastAPI Server (Starter)

This is a minimal, well-commented FastAPI backend for your CrosSwords game.
It includes users, games, word submissions, turn-based guesses, and progress tracking.

## Quickstart

1. **Create a virtual environment and install deps**

   ```bash
   cd crosswords_server
   python -m venv .venv
   # Windows:
   .venv\\Scripts\\activate
   # macOS/Linux:
   # source .venv/bin/activate

   pip install -r requirements.txt
   ```

2. **(Optional) Configure environment**

   ```bash
   copy .env.example .env   # Windows
   # or: cp .env.example .env
   # then edit SECRET_KEY and DATABASE_URL if you want
   ```

3. **Word list**: The server uses `data/wordlist_EOWL_mod.txt` by default. If missing, it will soft-allow A–Z words.

4. **Run the server**

   ```bash
   uvicorn app.main:app --reload
   ```

5. **Try the demo client** (in another terminal)

   ```bash
   python client_demo/demo.py
   ```

6. **Explore the API docs**

   - Open your browser to: http://127.0.0.1:8000/docs

## Integrating with your existing Python MVP

- You can keep using your current Python UI while transitioning:
  - Replace your local word validation with a call to `POST /games/{id}/submit_words`.
  - Use `GET /games/{id}/state` to display whose turn it is and the two progress counts.
  - Use `POST /games/{id}/guess` for the guessing action; render the per-letter colors returned.

> Later we can add websockets or Supabase/Firebase to push turns in realtime instead of polling.

## Folder Map

See `docs/ARCHITECTURE.md` for an overview and `docs/API.md` for endpoint details.
