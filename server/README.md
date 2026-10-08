# hangout server

NestJS + TypeORM + PostgreSQL. Every instant is stored and sent as UTC;
converting to someone's zone happens only for display.

## Running with the database

Postgres comes from `shell.nix` in the repo root and only runs while that
nix-shell is open.

```bash
# 1. From the repo root (not server/): starts Postgres and, on first run,
#    creates the "hangout" database in .nix-shell/db
nix-shell

# 2. One-time setup
cd server
cp .env.example .env
#    In .env: replace YOUR_USERNAME with the output of `whoami`, and set
#    EDIT_TOKEN_SECRET to the output of `openssl rand -base64 32`
npm install

# 3. Start the API (restarts when files change)
npm run start:dev
#    hangout server listening on http://localhost:3000/api (try /api/health)

# 4. In a second terminal: check that the server can reach the database
curl localhost:3000/api/health
#    {"status":"ok","database":"up"}   (503 if Postgres isn't reachable)
```

Good to know:

- **Run `nix-shell` from the repo root.** The database lives in
  `<where you ran it>/.nix-shell/db`, so running it from `server/` gives you a
  second, empty database.
- **Exiting a nix-shell stops Postgres**, including for any other nix-shell
  you have open. Keep the first shell open while you work. Your data stays in
  `.nix-shell/db` and comes back the next time you enter the shell.
- **Tables are created automatically** from the entity classes when the
  server starts (TypeORM `synchronize`). Set `DB_SYNCHRONIZE=false` in `.env`
  once the database holds data you want to keep.
- **Look at the data** (inside nix-shell): `psql --host=$PGDATA hangout`
- **Postgres log:** `.nix-shell/db/log/`
- **Start over with an empty database:** exit every nix-shell, then
  `rm -rf .nix-shell` from the repo root.
- **"Port 5432 already in use"** means another Postgres is running (a system
  one, or another nix-shell). Stop it, or uncomment the `port = 5433` line in
  `shell.nix`, run `rm -rf .nix-shell`, and change the port in `DATABASE_URL`.
- **`DATABASE_URL is not set`** means `server/.env` is missing. Start the
  server from inside `server/` so it finds the file.

## Layout

| Path                                             | What                                                        |
| ------------------------------------------------ | ----------------------------------------------------------- |
| `src/scheduling/zoned-time.ts`                   | Timezone primitives on the built-in `Intl` API. No imports, so the frontend can reuse it. |
| `src/scheduling/time-zone.service.ts`            | `TimeZoneService`: validates an event's schedule, generates its UTC slots. |
| `src/scheduling/availability-aggregator.service.ts` | `AvailabilityAggregator`: who is free in each slot (heatmap data). |
| `src/events/entities/`                           | `HangoutEvent`, `Participant`, `TimeSlot` (TypeORM).         |
| `src/events/events.service.ts`                   | Create / view / join / save / delete.                       |
| `src/security/`                                  | scrypt password hashing and HMAC edit tokens.               |

## API (all under `/api`)

| Method | Path                                            | Body                                   | Returns |
| ------ | ----------------------------------------------- | -------------------------------------- | ------- |
| POST   | `/events`                                       | `title, description?, mode?, dates[], timeZone, dayStartMinutes, dayEndMinutes, slotMinutes?` | `{ id }` |
| GET    | `/events/:id`                                   |                                        | event + every slot with `count` and `names` |
| POST   | `/events/:id/participants`                      | `name, password?`                      | `{ participantId, name, editToken, slots[] }` |
| PUT    | `/events/:id/participants/:pid/availability`    | `slots[]` (UTC ISO); header `X-Edit-Token` | refreshed event |
| DELETE | `/events/:id/participants/:pid`                 | header `X-Edit-Token`                  | 204 |

`dayStartMinutes`/`dayEndMinutes` are minutes after midnight in the event's
`timeZone` (540 = 09:00; 1440 = end of day). Saving replaces the participant's
whole selection in one transaction.

## Try it with curl

```bash
EVENT=$(curl -s localhost:3000/api/events -H 'Content-Type: application/json' -d '{
  "title": "Study call", "dates": ["2026-10-07"], "timeZone": "America/Los_Angeles",
  "dayStartMinutes": 540, "dayEndMinutes": 1020, "slotMinutes": 60 }' | sed -E 's/.*"id":"([^"]+)".*/\1/')

curl -s localhost:3000/api/events/$EVENT/participants -H 'Content-Type: application/json' -d '{"name":"Luca"}'
# copy participantId and editToken from the output, then:
curl -s -X PUT localhost:3000/api/events/$EVENT/participants/PID/availability \
  -H 'Content-Type: application/json' -H 'X-Edit-Token: TOKEN' \
  -d '{"slots":["2026-10-07T16:00:00.000Z","2026-10-07T17:00:00.000Z"]}'
```

## Tests

`npm test` runs without a database. Expected values in the timezone tests are
literal UTC strings worked out from published offsets, never computed with the
code under test, including both 2026 fall DST changes (EU Oct 25, US Nov 1).
