## NBA Studio (MVP)

This is a lightweight **Next Best Action (NBA)** marketing tool MVP:

- **Marketing**: create NBAs via a 6-step wizard (General → Audience → Action → Benefit → Comms → Summary)
- **Legal**: approve/reject customer-facing templates (gates scheduling/publishing)
- **Analyst**: view simple analytics + run arbitration API

It uses **Next.js App Router** with a local **SQLite** DB (`nba/data/nba.db`) created automatically on first run.

## Getting Started

From the `nba/` directory:

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

### Key URLs

- **NBA list**: `/nbas`
- **Create NBA (wizard)**: `/nbas/new`
- **Legal inbox**: `/legal` (switch role to `legal` in the top bar)
- **Analytics**: `/analytics`

### Useful APIs

- **List NBAs**: `GET /api/nba`
- **Get NBA snapshot**: `GET /api/nba/:id`
- **Arbitration (single best action)**: `GET /api/arbitration/top?customerId=CUST-0001`
- **Analytics summary**: `GET /api/analytics/summary?nbaId=:id`
- **Simulate offers**: `POST /api/simulate/issue` with `{ nbaId, count, channel }`

### Notes / Scope

- Audience builder is JSON-based for this MVP (no drag/drop UI yet).
- AI assistance is a **stubbed heuristic** endpoint (`POST /api/ai/suggest`) with audit logging to `ai_artifact`.
- Legal approval gate is enforced when transitioning to **Scheduled**/**Published**.

