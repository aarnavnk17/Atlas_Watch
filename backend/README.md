# AtlasWatch Backend

Express + MongoDB API for the AtlasWatch mobile client and operations dashboard.

## Setup

```bash
cd backend
npm install
cp .env.example .env      # then fill in the values below
npm start
```

### Required environment

| Variable | Purpose |
| --- | --- |
| `MONGODB_URI` | Mongo connection string. Keep it out of version control. |
| `JWT_SECRET` | Signs user session tokens. Required in production; rotating it signs everyone out. |
| `ADMIN_API_KEY` | Guards `/admin/*`, `/sos/alerts` and geofence management. The dashboard prompts for it. |

Generate the secrets with:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Outside production, missing secrets are replaced by ephemeral values that reset on
every restart — the server logs a warning and, for the admin key, prints the
generated value so local dev still works.

Optional variables (`CORS_ORIGINS`, `LOCATION_RETENTION_DAYS`, `UPLOAD_MAX_BYTES`,
`TWILIO_*`) are documented in `.env.example`.

## Authentication

`POST /register` and `POST /login` return a JWT:

```json
{ "success": true, "token": "eyJhbGci...", "email": "user@example.com" }
```

Every user-scoped endpoint takes it as `Authorization: Bearer <token>` and derives
the account from the verified token. An `email` value in a query string or body is
never used to select records — it identifies nobody.

Operator endpoints (`/admin/*`, `/sos/alerts`, `POST|PUT|DELETE /geofences`) take
`x-admin-key: <ADMIN_API_KEY>` instead.

## Scripts

| Command | Description |
| --- | --- |
| `npm start` | Run the API (connects to Mongo first; exits if unreachable). |
| `npm run dev` | Same with `--watch`. |
| `npm test` | Unit tests for the risk rules, scoring engine, and auth enforcement. |
| `npm run seed-crime-data` | Load `data/crime_data.json` into the `CrimeStat` collection and build the 2dsphere index. |
| `npm run normalize-emails` | One-time migration: lower-case stored emails. Run once after upgrading. |
| `npm run legacy-sqlite-migrate` | Historical import from the retired SQLite database. |

## Layout

```
app.js                  Express wiring (CORS, helmet, rate limits, routes)
index.js                Entrypoint — connects to Mongo, then listens
config.js               Environment configuration and secret handling
models/                 Mongoose schemas
routes/                 One module per resource
middleware/             Auth (JWT + admin key) and error handling
services/riskAnalysis.js  Movement/anomaly rules (pure, unit-tested)
ai_danger_engine.js     Danger scoring engine
lib/crimeData.js        Loads data/crime_data.json — the one crime dataset
scripts/                Seeding and migrations
test/                   node:test suites
```

`data/crime_data.json` is the single source of truth for crime statistics: the
rule engine reads it, `seed-crime-data` loads it into MongoDB, and the Flutter
client bundles the same file as an asset for its offline fallback. Do not
re-declare these numbers anywhere else.

## Emergency notifications

`POST /sos` records the alert and then notifies the user's emergency contacts
server-side. With `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN` and
`TWILIO_FROM_NUMBER` set it sends SMS; without them each intended recipient is
recorded on the alert as `skipped` with the reason, so an unconfigured deployment
is visible rather than silent.

## Security notes

- Secrets belong in the environment (or the host's secret manager), never in this
  repository. If a credential has ever been committed, rotate it — removing the
  file does not remove it from git history.
- Raw location history is retained for `LOCATION_RETENTION_DAYS` (default 7) via a
  TTL index; it exists to power anomaly detection, not to build a permanent
  movement record.
- Uploaded documents are served only through `GET /documents/:id/file`, which
  requires the owner's token.
