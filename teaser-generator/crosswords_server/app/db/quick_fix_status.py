# quick_fix_status.py
import sqlite3

conn = sqlite3.connect("crosswords.db")  # or your DATABASE_URL path
cur = conn.cursor()

# Set NULL -> 'waiting'
cur.execute("UPDATE game SET status='waiting' WHERE status IS NULL;")

# Optional: if both players have words_submitted=1 and ready=1, force 'starting' (no start_at calc here)
# (Useful only if you got stuck right after Ready and want to force a clean slate to try again.)
# cur.execute("""
#   UPDATE game
#   SET status='waiting', start_at=NULL
#   WHERE status NOT IN ('waiting','starting','active','finished') OR status IS NULL;
# """)

conn.commit()
conn.close()
print("Backfill complete.")
