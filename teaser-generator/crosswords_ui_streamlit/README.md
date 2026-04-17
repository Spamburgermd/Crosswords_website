# Crossword Battleship — Modularized (with real TWL)

This build includes your actual `twl.py` for dictionary checks.

## Run
```bash
pip install -r requirements.txt
streamlit run app/app.py
```

## Layout
- `app/app.py` – entry point
- `app/ui.py` – Streamlit UI
- `app/game_logic/validation.py` – TWL checks, word cleaning, validation
- `app/game_logic/placement.py` – crossword auto-placement
- `app/game_logic/scoring.py` – feedback logic (greens, yellows, blues, grays)
- `app/game_logic/state.py` – lightweight state
- `app/utils/constants.py` – grid constants
- `app/data/twl.py` – **your** TWL module (copied in)
