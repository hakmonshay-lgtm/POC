## NBA – Next Best Action Marketing Tool (MVP)

Prototype app implementing the **NBA wizard + Legal approval gate + audit/AI artifact logging** with a Cricket-inspired UI.

### Run locally

```bash
cd nba
npm install
npm run db:migrate
npm run dev
```

Open `http://localhost:3000`.

### Seeded users / role switching

Use the **user switcher** in the top header (sets a cookie):

- Marketing: `morgan@company.test`
- Legal: `lena@company.test`
- Analyst: `dana@company.test`

### Key routes

- `/nba`: NBA listing + create/clone
- `/nba/:id/edit`: 6-step wizard (General, Audience, Action, Offers, Comms, Summary)
- `/legal`: Legal review queue (items in `IN_REVIEW`)
- `/analytics`: seeded funnel metrics

### Arbitration API (MVP)

After publishing an NBA, call:

- `GET /api/arbitrate/:customerId`

Returns the top eligible NBA for the customer with **reason codes**, and stores an `ArbitrationScore` record.
