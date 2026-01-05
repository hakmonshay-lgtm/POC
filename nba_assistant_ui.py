import os
import sqlite3
import ssl
import urllib3
from flask import Flask, render_template_string, request, jsonify
from langchain_openai import ChatOpenAI
from langchain_community.utilities import SQLDatabase
from langchain_community.agent_toolkits import SQLDatabaseToolkit
from langchain_community.agent_toolkits.sql.base import create_sql_agent
from langchain_core.messages import SystemMessage
from dotenv import load_dotenv
import webbrowser
from threading import Timer

# Disable SSL warnings (matches original behavior)
urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)
ssl._create_default_https_context = ssl._create_unverified_context
os.environ["CURL_CA_BUNDLE"] = ""
os.environ["REQUESTS_CA_BUNDLE"] = ""

load_dotenv()

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
DB_PATH = os.path.join(SCRIPT_DIR, "Cricket_customers.db")

OPENAI_API_KEY = os.environ.get("OPENAI_API_KEY")
if not OPENAI_API_KEY:
    print("Please set OPENAI_API_KEY in your .env file")
    raise SystemExit(1)

app = Flask(__name__)
agent = None

HTML_TEMPLATE = r"""
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Next Best Action - NBA Assistant</title>
  <style>
    :root{
      --bg: #f4f6f9;
      --text: #111827;
      --muted: #6b7280;
      --border: #e5e7eb;
      --card: #ffffff;
      --brand-black: #0b0b0b;
      --brand-green: #74b900;
      --brand-green-dark: #5ea100;
      --primary: #1f6feb;
      --chip: #eef2ff;
      --shadow: 0 10px 25px rgba(0,0,0,.08);
      --radius: 14px;
      --radius-lg: 18px;
      --font: ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Arial, "Noto Sans", "Helvetica Neue", sans-serif;
    }

    *{box-sizing:border-box}
    body{
      margin:0;
      font-family: var(--font);
      color: var(--text);
      background: var(--bg);
    }

    /* Top bar (matches screenshot vibe) */
    .topbar{
      background: var(--brand-black);
      color:#fff;
      height:72px;
      display:flex;
      align-items:center;
      justify-content:space-between;
      padding:0 22px;
    }
    .brand{
      display:flex;
      align-items:center;
      gap:14px;
      min-width: 280px;
    }
    .brand .logo{
      font-weight:900;
      letter-spacing:.3px;
      font-size:28px;
      line-height:1;
      text-transform:lowercase;
    }
    .brand .logo span{
      color:#8bd400;
    }
    .brand .sub{
      display:flex;
      flex-direction:column;
      gap:6px;
      margin-left:6px;
    }
    .brand .welcome{
      font-weight:600;
      font-size:14px;
      opacity:.95;
      white-space:nowrap;
    }
    .pill{
      width:fit-content;
      padding:3px 10px;
      border-radius:999px;
      background:#1f8f00;
      color:#fff;
      font-size:11px;
      font-weight:700;
      letter-spacing:.4px;
    }
    .topnav{
      display:flex;
      align-items:center;
      gap:18px;
      font-size:13px;
      opacity:.95;
      white-space:nowrap;
    }
    .topnav .sep{opacity:.35}
    .menuBtn{
      border:0;
      background:#2a6fbb;
      color:#fff;
      padding:10px 14px;
      border-radius:999px;
      font-weight:700;
      cursor:pointer;
      display:flex;
      align-items:center;
      gap:8px;
    }
    .menuIcon{
      width:14px;height:14px;display:inline-block;
      background: radial-gradient(circle at 25% 25%, #fff 2px, transparent 3px),
                  radial-gradient(circle at 75% 25%, #fff 2px, transparent 3px),
                  radial-gradient(circle at 25% 75%, #fff 2px, transparent 3px),
                  radial-gradient(circle at 75% 75%, #fff 2px, transparent 3px);
    }

    /* Page */
    .page{
      max-width: 1200px;
      margin: 0 auto;
      padding: 18px 18px 30px;
    }

    .stepper{
      margin: 14px auto 10px;
      max-width: 520px;
      display:flex;
      align-items:center;
      justify-content:center;
      gap:18px;
      color: var(--muted);
      font-size:12px;
      font-weight:700;
    }
    .step{
      display:flex;
      flex-direction:column;
      align-items:center;
      gap:6px;
      min-width: 120px;
    }
    .bar{
      width:120px;height:4px;border-radius:999px;background:#d1d5db;
      position:relative; overflow:hidden;
    }
    .bar.active::after{
      content:"";
      position:absolute;left:0;top:0;bottom:0;width:62%;
      background:#f4c542;
      border-radius:999px;
    }

    .titleBlock{
      text-align:center;
      margin-top:6px;
      margin-bottom: 18px;
    }
    .titleBlock h1{
      margin:0;
      font-size:44px;
      letter-spacing:-.6px;
    }
    .titleBlock .subhead{
      margin-top:4px;
      font-weight:700;
      color:#111827;
      opacity:.9;
    }

    .layout{
      display:grid;
      grid-template-columns: minmax(0, 1fr) 340px;
      gap: 18px;
      align-items:start;
    }
    @media (max-width: 980px){
      .layout{grid-template-columns: 1fr;}
      .brand{min-width: 0;}
      .topnav{display:none;}
    }

    .card{
      background: var(--card);
      border: 1px solid var(--border);
      border-radius: var(--radius-lg);
      box-shadow: var(--shadow);
    }
    .card.padded{padding:18px;}

    /* Left column form */
    .detailsCard{
      border: 2px solid #5b8bd6;
      background: #edf4ff;
      box-shadow:none;
    }
    .fieldRow{
      display:grid;
      grid-template-columns: 1fr 1fr;
      gap: 16px;
    }
    @media (max-width: 760px){
      .fieldRow{grid-template-columns: 1fr;}
    }
    .field{
      margin-bottom: 14px;
    }
    .label{
      display:flex;
      align-items:center;
      justify-content:space-between;
      font-size:13px;
      font-weight:700;
      color:#1f2937;
      margin-bottom:8px;
    }
    .counter{
      font-size:12px;
      color: var(--muted);
      font-weight:600;
    }
    .input, .date{
      width:100%;
      height:44px;
      border-radius:999px;
      border:1px solid #9ca3af;
      padding:0 14px;
      background:#fff;
      font-size:14px;
      outline:none;
    }
    .input:focus, .date:focus{
      border-color: var(--primary);
      box-shadow: 0 0 0 3px rgba(31,111,235,.15);
    }
    .dateWrap{position:relative;}
    .dateIcon{
      position:absolute;
      right:12px; top:50%;
      transform:translateY(-50%);
      width:18px;height:18px;
      border:2px solid #2a6fbb;
      border-radius:4px;
      opacity:.9;
    }
    .dateIcon::after{
      content:"";
      position:absolute;left:2px;right:2px;top:6px;height:2px;
      background:#2a6fbb;
    }

    .sectionTitle{
      font-weight:900;
      font-size:18px;
      margin:0 0 14px 0;
    }
    .sectionHeader{
      display:flex;
      align-items:center;
      justify-content:space-between;
      padding: 18px 18px 0;
    }
    .actions{
      display:flex; gap:14px; align-items:center;
      font-size:12px; font-weight:700;
    }
    .actions a{
      text-decoration:none;
      color:#2563eb;
      display:flex; gap:6px; align-items:center;
    }
    .actions a.muted{color:#9ca3af; pointer-events:none;}

    .configs{
      padding: 0 18px 18px;
    }
    .divider{height:1px;background:var(--border); margin: 14px 0;}

    .stepTitle{
      display:flex; align-items:center; gap:10px;
      font-weight:900;
      margin: 8px 0 12px;
    }
    .chev{
      width:10px;height:10px;border-right:2px solid #111827;border-bottom:2px solid #111827;
      transform: rotate(45deg);
      opacity:.8;
    }
    .columns{
      display:grid;
      grid-template-columns: 220px 1fr;
      gap: 16px;
      min-height: 320px;
    }
    @media (max-width: 760px){
      .columns{grid-template-columns:1fr;}
    }
    .sidePanel{
      border:1px solid var(--border);
      border-radius: 12px;
      overflow:hidden;
      background:#fff;
    }
    .sidePanel .panelTitle{
      padding:10px 12px;
      font-weight:900;
      font-size:13px;
      border-bottom:1px solid var(--border);
      background:#fafafa;
    }
    .sidePanel .group{
      padding:10px 12px;
      border-bottom:1px solid var(--border);
    }
    .sidePanel .group:last-child{border-bottom:0;}
    .groupName{
      font-weight:900;
      font-size:12px;
      margin-bottom:10px;
      color:#111827;
    }
    .item{
      display:flex;
      align-items:center;
      justify-content:space-between;
      padding:8px 0;
      font-size:13px;
      color:#2563eb;
      font-weight:700;
      cursor:pointer;
    }
    .item .left{
      display:flex; gap:8px; align-items:center;
    }
    .infoDot{
      width:18px;height:18px;border-radius:999px;
      display:inline-flex;align-items:center;justify-content:center;
      border:1px solid #93c5fd;
      color:#2563eb;
      font-size:12px;
      font-weight:900;
    }
    .plus{
      width:18px;height:18px;border-radius:999px;
      display:inline-flex;align-items:center;justify-content:center;
      border:1px solid #93c5fd;
      color:#2563eb;
      font-size:14px;
      font-weight:900;
    }
    .emptyState{
      height: 100%;
      border:1px dashed #d1d5db;
      border-radius: 12px;
      background:#fff;
      display:flex;
      align-items:center;
      justify-content:center;
      padding: 18px;
      text-align:center;
      color: var(--muted);
    }
    .emptyState h3{
      margin: 10px 0 6px;
      color:#111827;
      font-size:14px;
      font-weight:900;
    }

    /* Right column: NBA Assistant */
    .assistant{
      border-radius: var(--radius-lg);
      overflow:hidden;
      border: 3px solid var(--brand-green-dark);
      background:#fff;
      position:sticky;
      top: 18px;
    }
    .assistantHeader{
      background: var(--brand-green);
      color:#fff;
      padding: 14px 14px 12px;
      position:relative;
      text-align:center;
    }
    .assistantHeader .spark{
      width:34px;height:34px;border-radius:10px;
      background: rgba(255,255,255,.22);
      display:inline-flex;align-items:center;justify-content:center;
      margin-bottom:6px;
      font-weight:900;
    }
    .assistantHeader .title{
      font-weight:1000;
      letter-spacing:.2px;
    }
    .assistantHeader .subtitle{
      opacity:.95;
      font-size:12px;
      font-weight:700;
      margin-top:2px;
    }
    .collapse{
      position:absolute;right:10px;top:10px;
      width:26px;height:26px;border-radius:999px;
      border: 0;
      background: rgba(255,255,255,.24);
      color:#fff;
      font-weight:900;
      cursor:pointer;
      line-height:26px;
    }
    .assistantBody{
      display:flex;
      flex-direction:column;
      height: 520px;
      background:#fff;
    }
    .chat{
      flex:1;
      padding: 12px 12px 6px;
      overflow:auto;
      background:#fff;
    }
    .chatBubble{
      display:flex;
      margin: 8px 0;
    }
    .chatBubble.user{justify-content:flex-end;}
    .chatBubble .msg{
      max-width: 90%;
      padding: 8px 10px;
      border-radius: 14px;
      font-size: 12px;
      line-height: 1.35;
      border: 1px solid #e5e7eb;
      background:#f3f4f6;
      color:#111827;
      white-space: pre-wrap;
    }
    .chatBubble.user .msg{
      background:#d1d5db;
    }
    .quickQs{
      padding: 8px 12px 6px;
      display:flex;
      flex-direction:column;
      gap:6px;
    }
    .qchip{
      width:fit-content;
      border-radius: 999px;
      padding: 6px 10px;
      background:#e5e7eb;
      font-size: 11px;
      border: 1px solid #d1d5db;
      cursor:pointer;
    }
    .assistantInput{
      border-top: 1px solid var(--border);
      padding: 10px 10px 12px;
      display:flex;
      gap: 10px;
      align-items:center;
      background:#fff;
    }
    .assistantInput input{
      flex:1;
      height: 36px;
      border-radius: 999px;
      border: 1px solid #d1d5db;
      padding: 0 12px;
      outline:none;
      font-size: 12px;
    }
    .assistantInput input:focus{
      border-color: var(--brand-green-dark);
      box-shadow: 0 0 0 3px rgba(94,161,0,.15);
    }
    .send{
      width:34px;height:34px;border-radius: 999px;
      border: 0;
      background:#2a6fbb;
      color:#fff;
      cursor:pointer;
      font-weight:900;
    }
    .send:disabled{opacity:.6; cursor:not-allowed;}
    .typing{
      display:none;
      padding: 8px 12px 12px;
      font-size: 12px;
      color: var(--muted);
    }
    .typing.active{display:block;}

    /* Footer actions (bottom of page) */
    .footerBar{
      margin-top: 16px;
      display:flex;
      justify-content:space-between;
      align-items:center;
      padding: 12px 10px;
      color: var(--muted);
    }
    .btn{
      border-radius: 999px;
      border: 1px solid #93c5fd;
      background:#fff;
      color:#2563eb;
      padding: 10px 14px;
      font-weight:800;
      cursor:pointer;
    }
    .btn.primary{
      border-color:#93c5fd;
      background:#fff;
    }
    .btn.disabled{
      opacity:.45; cursor:not-allowed;
    }
  </style>
</head>
<body>
  <div class="topbar">
    <div class="brand">
      <div class="logo">cric<span>k</span>et</div>
      <div class="sub">
        <div class="welcome">Welcome, Topher</div>
        <div class="pill">SUPER ADMIN</div>
      </div>
    </div>

    <div class="topnav">
      <div>Promotion</div>
      <div class="sep">|</div>
      <button class="menuBtn" type="button"><span class="menuIcon"></span> Menu</button>
      <div>Logout</div>
    </div>
  </div>

  <div class="page">
    <div class="stepper">
      <div class="step">
        <div class="bar active"></div>
        <div>Create NBA</div>
      </div>
      <div class="step">
        <div class="bar"></div>
        <div>Review NBA</div>
      </div>
    </div>

    <div class="titleBlock">
      <h1>Next Best Action</h1>
      <div class="subhead">Add Details</div>
    </div>

    <div class="layout">
      <!-- LEFT -->
      <div>
        <div class="card padded detailsCard">
          <div class="field">
            <div class="label">
              <span>Request Name</span>
              <span class="counter" id="nameCount">0/75</span>
            </div>
            <input class="input" id="requestName" maxlength="75" value="Summer 2024" />
          </div>

          <div class="field">
            <div class="label">
              <span>Request Description</span>
              <span class="counter" id="descCount">0/75</span>
            </div>
            <input class="input" id="requestDesc" maxlength="75" value="Summer 2024" />
          </div>

          <div class="fieldRow">
            <div class="field">
              <div class="label"><span>Effective Date</span></div>
              <div class="dateWrap">
                <input class="date" id="effectiveDate" value="02/06/2024" />
                <span class="dateIcon" aria-hidden="true"></span>
              </div>
            </div>
            <div class="field">
              <div class="label"><span>Expiration Date</span></div>
              <div class="dateWrap">
                <input class="date" id="expirationDate" value="02/15/2024" />
                <span class="dateIcon" aria-hidden="true"></span>
              </div>
            </div>
          </div>
        </div>

        <div class="card" style="margin-top:16px;">
          <div class="sectionHeader">
            <div class="sectionTitle">Request Configurations</div>
            <div class="actions">
              <a href="javascript:void(0)">&#x2398; Duplicate</a>
              <a class="muted" href="javascript:void(0)">&#x1F5D1; Remove</a>
            </div>
          </div>

          <div class="configs">
            <div class="divider"></div>
            <div class="stepTitle"><span class="chev"></span> Step 1: Define Audience</div>

            <div class="columns">
              <div class="sidePanel">
                <div class="panelTitle">Customer</div>
                <div class="group">
                  <div class="item"><div class="left"><span class="infoDot">i</span>Type</div><span class="plus">+</span></div>
                  <div class="item"><div class="left"><span class="infoDot">i</span>Status</div><span class="plus">+</span></div>
                  <div class="item"><div class="left"><span class="infoDot">i</span>Multi-line</div><span class="plus">+</span></div>
                  <div class="item"><div class="left"><span class="infoDot">i</span>Tenure</div><span class="plus">+</span></div>
                  <div class="item"><div class="left"><span class="infoDot">i</span>Auto-bill Pay</div><span class="plus">+</span></div>
                  <div class="item"><div class="left"><span class="infoDot">i</span>Credit Card Expiry+</div><span class="plus">+</span></div>
                  <div class="item"><div class="left"><span class="infoDot">i</span>Upload List</div><span class="plus">+</span></div>
                </div>
                <div class="panelTitle">Activity History</div>
                <div class="group">
                  <div class="item"><div class="left"><span class="infoDot">i</span>Payment History</div><span class="plus">+</span></div>
                  <div class="item"><div class="left"><span class="infoDot">i</span>Purchase History</div><span class="plus">+</span></div>
                </div>
              </div>

              <div class="emptyState">
                <div>
                  <div style="font-size:44px; line-height:1;">🧞‍♀️</div>
                  <h3>No Audience Configured</h3>
                  <div>Add the attributes to configure the audience.</div>
                </div>
              </div>
            </div>

            <div class="divider"></div>
            <div class="stepTitle" style="opacity:.45;"><span class="chev" style="transform:rotate(-45deg)"></span> Step 2: Define Engagement</div>
          </div>
        </div>

        <div class="footerBar">
          <button class="btn" type="button">Previous</button>
          <div style="display:flex; gap:10px; align-items:center;">
            <button class="btn" type="button" style="border-color:#d1d5db;color:#6b7280;">Cancel</button>
            <button class="btn primary" type="button">Save Draft</button>
            <button class="btn disabled" type="button" disabled>Review</button>
          </div>
        </div>
      </div>

      <!-- RIGHT -->
      <div class="assistant" id="assistantCard">
        <div class="assistantHeader">
          <button class="collapse" id="collapseBtn" type="button" title="Collapse">–</button>
          <div class="spark">✦</div>
          <div class="title">NBA Assistant</div>
          <div class="subtitle">Ask questions about NBA.</div>
        </div>
        <div class="assistantBody" id="assistantBody">
          <div class="chat" id="chat"></div>
          <div class="quickQs">
            <div class="qchip" onclick="ask('How many customers are enrolled for Auto pay?')">How many customers are enrolled for Auto pay?</div>
            <div class="qchip" onclick="ask('How many customers are on iOS OS?')">How many customers are on iOS OS?</div>
            <div class="qchip" onclick="ask('How many customers have more than 3 lines?')">How many customers have more than 3 lines?</div>
          </div>
          <div class="typing" id="typing">NBA Assistant is thinking…</div>
          <div class="assistantInput">
            <input id="msg" placeholder="Ask me anything" />
            <button class="send" id="sendBtn" type="button" title="Send">➤</button>
          </div>
        </div>
      </div>
    </div>
  </div>

  <script>
    const nameEl = document.getElementById('requestName');
    const descEl = document.getElementById('requestDesc');
    const nameCount = document.getElementById('nameCount');
    const descCount = document.getElementById('descCount');
    const chat = document.getElementById('chat');
    const msg = document.getElementById('msg');
    const sendBtn = document.getElementById('sendBtn');
    const typing = document.getElementById('typing');
    const collapseBtn = document.getElementById('collapseBtn');
    const assistantBody = document.getElementById('assistantBody');

    function updateCounts(){
      nameCount.textContent = `${nameEl.value.length}/75`;
      descCount.textContent = `${descEl.value.length}/75`;
    }
    nameEl.addEventListener('input', updateCounts);
    descEl.addEventListener('input', updateCounts);
    updateCounts();

    function addBubble(role, text){
      const wrap = document.createElement('div');
      wrap.className = `chatBubble ${role}`;
      const bubble = document.createElement('div');
      bubble.className = 'msg';
      bubble.textContent = text;
      wrap.appendChild(bubble);
      chat.appendChild(wrap);
      chat.scrollTop = chat.scrollHeight;
    }

    function setTyping(on){
      typing.classList.toggle('active', !!on);
      chat.scrollTop = chat.scrollHeight;
    }

    async function send(){
      const q = (msg.value || '').trim();
      if (!q) return;
      msg.value = '';
      addBubble('user', q);
      sendBtn.disabled = true;
      setTyping(true);
      try{
        const res = await fetch('/query', {
          method: 'POST',
          headers: {'Content-Type': 'application/json'},
          body: JSON.stringify({question: q})
        });
        const data = await res.json();
        setTyping(false);
        if (data && data.success){
          addBubble('assistant', data.answer);
        } else {
          addBubble('assistant', 'Error: ' + (data && data.error ? data.error : 'Unknown error'));
        }
      }catch(e){
        setTyping(false);
        addBubble('assistant', 'Error: Failed to connect to the server. ' + e.message);
      }finally{
        sendBtn.disabled = false;
        msg.focus();
      }
    }

    function ask(q){
      msg.value = q;
      send();
    }
    window.ask = ask;

    sendBtn.addEventListener('click', send);
    msg.addEventListener('keydown', (e) => {
      if (e.key === 'Enter'){
        e.preventDefault();
        send();
      }
    });

    collapseBtn.addEventListener('click', () => {
      const isHidden = assistantBody.style.display === 'none';
      assistantBody.style.display = isHidden ? 'flex' : 'none';
      collapseBtn.textContent = isHidden ? '–' : '+';
    });

    // Initial helper message
    addBubble('assistant', "Hi! I'm the NBA Assistant. Ask me questions and I'll query the customer database for answers.");
  </script>
</body>
</html>
"""


def initialize_agent() -> bool:
    """Initialize the SQL agent."""
    global agent

    print("Initializing NBA (DB) Assistant...")

    if not os.path.exists(DB_PATH):
        print(f"❌ Database file not found at: {DB_PATH}")
        return False

    try:
        conn = sqlite3.connect(DB_PATH)
        cursor = conn.cursor()
        cursor.execute("SELECT name FROM sqlite_master WHERE type='table';")
        tables = cursor.fetchall()
        conn.close()

        print(f"✓ Database found with tables: {[t[0] for t in tables]}")

        db = SQLDatabase.from_uri(f"sqlite:///{DB_PATH}")

        # Keep SSL verification disabled like original
        import httpx

        http_client = httpx.Client(verify=False)

        llm = ChatOpenAI(
            model_name="gpt-4o-mini",
            temperature=0,
            max_tokens=1000,
            timeout=30,
            max_retries=2,
            request_timeout=30,
            http_client=http_client,
        )

        toolkit = SQLDatabaseToolkit(db=db, llm=llm)

        system_message = SystemMessage(
            content=(
                "You are the NBA Assistant embedded in the Next Best Action UI. "
                "You answer user questions by querying the Cricket Customers SQLite database. "
                "\n\nRules:\n"
                "1) Provide clear, concise answers with concrete counts.\n"
                "2) Verify table/column names before querying.\n"
                "3) Use valid SQL and limit results when listing.\n"
                "4) NEVER modify the database (no INSERT/UPDATE/DELETE/ALTER/DROP).\n"
            )
        )

        agent = create_sql_agent(
            llm=llm,
            toolkit=toolkit,
            agent_type="openai-tools",
            verbose=True,
            system_message=system_message,
            max_iterations=15,
            max_execution_time=60,
            handle_parsing_errors=True,
        )

        print("✓ Agent initialized successfully!")
        return True
    except Exception as e:
        print(f"❌ Error initializing agent: {e}")
        return False


@app.route("/")
def index():
    return render_template_string(HTML_TEMPLATE)


@app.route("/query", methods=["POST"])
def query():
    try:
        data = request.json or {}
        question = (data.get("question") or "").strip()

        if not question:
            return jsonify({"success": False, "error": "No question provided"})

        if agent is None:
            return jsonify({"success": False, "error": "Agent not initialized"})

        response = agent.invoke({"input": question})
        return jsonify({"success": True, "answer": response.get("output", "")})
    except Exception as e:
        return jsonify({"success": False, "error": str(e)})


def open_browser():
    webbrowser.open("http://localhost:5000")


if __name__ == "__main__":
    print("=" * 60)
    print("Next Best Action - NBA Assistant (DB Chat)")
    print("=" * 60)

    if initialize_agent():
        print("\nStarting web server...")
        print("Opening browser at http://localhost:5000")
        Timer(1, open_browser).start()
        app.run(debug=False, port=5000)
    else:
        print("\n❌ Failed to initialize agent. Please check your configuration.")

