from __future__ import annotations

from dataclasses import dataclass, field
from datetime import date


@dataclass
class NbaDraft:
    # Step 1
    name: str = ""
    description: str = ""
    effective_date: str = ""
    expiration_date: str = ""

    # Step 2 - Audience
    enrolled_autobill_pay: str = ""  # "yes" | "no" | ""
    credit_card_expiry_days: str = ""  # e.g. "45"

    # Step 3 - Engagement
    action_required: str = ""  # e.g. "Update Credit Card Information"
    account_credit_amount: str = ""  # e.g. "5"
    recurring_period: str = "Forever"
    apply_for: str = "Account"  # "Account" | "Line"
    memo_text: str = ""
    channels: list[str] = field(default_factory=list)  # e.g. ["Retail", "CARE"]

    def is_step1_complete(self) -> bool:
        return bool(self.name.strip() and self.description.strip() and self.effective_date and self.expiration_date)

    def is_step2_complete(self) -> bool:
        return bool(self.enrolled_autobill_pay in {"yes", "no"} and self.credit_card_expiry_days)

    def is_step3_complete(self) -> bool:
        return bool(self.action_required.strip() and self.account_credit_amount.strip() and self.memo_text.strip())


@dataclass(frozen=True)
class AssistantAnswer:
    question: str
    answer: str


def estimate_customers(draft: NbaDraft) -> int:
    """
    Mock estimate to match the design; replace with real analytics later.
    """
    base = 51_153
    if draft.enrolled_autobill_pay == "yes":
        base = int(base * 0.68)
    elif draft.enrolled_autobill_pay == "no":
        base = int(base * 0.32)

    try:
        days = int(draft.credit_card_expiry_days) if draft.credit_card_expiry_days else 0
    except ValueError:
        days = 0

    if days >= 60:
        base = int(base * 0.85)
    elif days >= 45:
        base = int(base * 0.75)
    elif days >= 30:
        base = int(base * 0.62)

    return max(base, 0)
