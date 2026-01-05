# NBA – Next Best Action (Python MVP)

This is a small **Python FastAPI** app that recreates the provided “Next Best Action” UI:

- Create NBA screen (multi-step configuration)
- Review NBA screen
- Right-side “NBA Assistant” chat panel (mocked answers)

## Run locally

```bash
cd nba
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

Open `http://localhost:8000`.

