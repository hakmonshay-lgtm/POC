from __future__ import annotations

import json
from datetime import datetime
from pathlib import Path
from typing import Any

from fastapi import FastAPI, Form, Request
from fastapi.responses import HTMLResponse, JSONResponse, RedirectResponse
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates
from starlette.middleware.sessions import SessionMiddleware

from .models import AssistantAnswer, NbaDraft, estimate_customers


APP_DIR = Path(__file__).resolve().parent
templates = Jinja2Templates(directory=str(APP_DIR / "templates"))

def _mmddyyyy(value: str) -> str:
    v = (value or "").strip()
    if not v:
        return ""
    # HTML date input typically posts YYYY-MM-DD.
    try:
        dt = datetime.strptime(v, "%Y-%m-%d")
        return dt.strftime("%m/%d/%Y")
    except Exception:
        return v


templates.env.filters["mmddyyyy"] = _mmddyyyy


def _get_draft(request: Request) -> NbaDraft:
    raw = request.session.get("draft")
    if not raw:
        return NbaDraft()
    try:
        data = json.loads(raw)
    except Exception:
        return NbaDraft()
    return NbaDraft(**{k: v for k, v in data.items() if hasattr(NbaDraft(), k)})


def _save_draft(request: Request, draft: NbaDraft) -> None:
    request.session["draft"] = json.dumps(draft.__dict__)


def _assistant_seed_questions() -> list[str]:
    return [
        "How many customers are enrolled for Auto pay?",
        "How many customers are on iOS OS?",
        "How many customers have more than 3 lines?",
    ]


def _assistant_answer(question: str, draft: NbaDraft) -> AssistantAnswer:
    q = question.strip().lower()
    if "auto pay" in q or "autopay" in q or "auto-bill" in q:
        enrolled = int(estimate_customers(NbaDraft(enrolled_autobill_pay="yes", credit_card_expiry_days="45")) / 0.75)
        return AssistantAnswer(question=question, answer=f"Estimated enrolled in Auto-bill Pay: {enrolled:,} customers.")
    if "ios" in q:
        return AssistantAnswer(question=question, answer="Estimated iOS customers: 18,420 (mocked).")
    if "more than 3" in q or "3 lines" in q:
        return AssistantAnswer(question=question, answer="Estimated customers with >3 lines: 6,105 (mocked).")
    return AssistantAnswer(
        question=question,
        answer="I can help with NBA questions. Try asking about audience size, Auto-bill Pay enrollment, or credit card expiry.",
    )


app = FastAPI(title="NBA – Next Best Action (MVP)")
app.add_middleware(SessionMiddleware, secret_key="dev-secret-key-change-me", same_site="lax")
app.mount("/static", StaticFiles(directory=str(APP_DIR / "static")), name="static")


@app.get("/", response_class=HTMLResponse)
def root() -> RedirectResponse:
    return RedirectResponse(url="/create", status_code=303)


@app.get("/create", response_class=HTMLResponse)
def create_get(request: Request) -> HTMLResponse:
    draft = _get_draft(request)
    ctx: dict[str, Any] = {
        "request": request,
        "draft": draft,
        "step": "create",
        "assistant_questions": _assistant_seed_questions(),
        "customers_estimate": estimate_customers(draft) if draft.is_step2_complete() else None,
    }
    return templates.TemplateResponse("create.html", ctx)


@app.post("/create")
def create_post(
    request: Request,
    action: str = Form(default="save"),
    name: str = Form(default=""),
    description: str = Form(default=""),
    effective_date: str = Form(default=""),
    expiration_date: str = Form(default=""),
    enrolled_autobill_pay: str = Form(default=""),
    credit_card_expiry_days: str = Form(default=""),
    action_required: str = Form(default=""),
    account_credit_amount: str = Form(default=""),
    recurring_period: str = Form(default="Forever"),
    apply_for: str = Form(default="Account"),
    memo_text: str = Form(default=""),
    channels: list[str] = Form(default_factory=list),
) -> RedirectResponse:
    draft = _get_draft(request)
    draft.name = name
    draft.description = description
    draft.effective_date = effective_date
    draft.expiration_date = expiration_date
    draft.enrolled_autobill_pay = enrolled_autobill_pay
    draft.credit_card_expiry_days = credit_card_expiry_days
    draft.action_required = action_required
    draft.account_credit_amount = account_credit_amount
    draft.recurring_period = recurring_period
    draft.apply_for = apply_for
    draft.memo_text = memo_text
    draft.channels = channels

    _save_draft(request, draft)

    if action == "review":
        return RedirectResponse(url="/review", status_code=303)
    return RedirectResponse(url="/create", status_code=303)


@app.get("/review", response_class=HTMLResponse)
def review_get(request: Request) -> HTMLResponse:
    draft = _get_draft(request)
    ctx: dict[str, Any] = {
        "request": request,
        "draft": draft,
        "step": "review",
        "assistant_questions": _assistant_seed_questions(),
        "customers_estimate": estimate_customers(draft) if draft.is_step2_complete() else None,
    }
    return templates.TemplateResponse("review.html", ctx)


@app.post("/submit")
def submit_post(request: Request) -> RedirectResponse:
    # In a real system this would persist to a DB and kick off workflows.
    request.session["submitted"] = True
    return RedirectResponse(url="/review?submitted=1", status_code=303)


@app.post("/assistant")
async def assistant_post(request: Request) -> JSONResponse:
    payload = await request.json()
    question = str(payload.get("message", "")).strip()
    draft = _get_draft(request)
    ans = _assistant_answer(question, draft)
    return JSONResponse({"question": ans.question, "answer": ans.answer})

