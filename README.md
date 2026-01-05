## NBA – Next Best Action (Python MVP)

The generated app lives in `nba/`.

### Run locally

```bash
cd nba
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

Then open `http://localhost:8000`.

