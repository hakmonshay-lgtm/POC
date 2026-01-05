function qs(sel, root = document) {
  return root.querySelector(sel);
}
function qsa(sel, root = document) {
  return Array.from(root.querySelectorAll(sel));
}

function initSteps() {
  qsa("[data-step]").forEach((stepEl) => {
    const btn = qs("[data-step-toggle]", stepEl);
    if (!btn) return;
    btn.addEventListener("click", () => stepEl.classList.toggle("step--collapsed"));
  });
}

function initCounts() {
  qsa("[data-count]").forEach((el) => {
    const key = el.getAttribute("data-count");
    const target = qs(`[data-count-value="${key}"]`);
    if (!target) return;
    const update = () => (target.textContent = String((el.value || "").length));
    el.addEventListener("input", update);
    update();
  });

  // Memo textarea count
  const memo = qs('textarea[name="memo_text"]');
  const memoTarget = qs('[data-count-value="memo_text"]');
  if (memo && memoTarget) {
    const update = () => (memoTarget.textContent = String((memo.value || "").length));
    memo.addEventListener("input", update);
    update();
  }
}

function initAssistant() {
  const root = qs("[data-assistant]");
  if (!root) return;

  const messages = qs("[data-assistant-messages]", root);
  const input = qs("[data-assistant-input]", root);
  const send = qs("[data-assistant-send]", root);
  const min = qs("[data-assistant-min]", root);

  const append = (q, a) => {
    const wrap = document.createElement("div");
    wrap.className = "msg";
    const qEl = document.createElement("div");
    qEl.className = "msg__q";
    qEl.textContent = q;
    const aEl = document.createElement("div");
    aEl.className = "msg__a";
    aEl.textContent = a;
    wrap.appendChild(qEl);
    wrap.appendChild(aEl);
    messages.appendChild(wrap);
    messages.scrollTop = messages.scrollHeight;
  };

  const ask = async (text) => {
    const q = (text || "").trim();
    if (!q) return;
    input.value = "";
    append(q, "…");
    const last = messages.lastElementChild;
    const answerEl = last ? last.querySelector(".msg__a") : null;

    try {
      const resp = await fetch("/assistant", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: q }),
      });
      const data = await resp.json();
      if (answerEl) answerEl.textContent = data.answer || "No answer.";
    } catch {
      if (answerEl) answerEl.textContent = "Sorry — I couldn't reach the assistant endpoint.";
    }
  };

  send?.addEventListener("click", () => ask(input.value));
  input?.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      ask(input.value);
    }
  });
  qsa("[data-suggestion]", root).forEach((btn) => {
    btn.addEventListener("click", () => ask(btn.getAttribute("data-suggestion") || ""));
  });

  min?.addEventListener("click", () => root.classList.toggle("assistant--minimized"));
}

document.addEventListener("DOMContentLoaded", () => {
  initSteps();
  initCounts();
  initAssistant();
});

