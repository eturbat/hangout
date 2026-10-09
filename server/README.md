# hangout server

NestJS + TypeORM + PostgreSQL. Every instant is stored and sent as UTC;
converting to someone's time zone happens only for display.

## Run it

```bash
nix-shell                 # from the repo root: Node + Postgres (or see "Without Nix" in the root README)
cd server
cp .env.example .env      # then put your username in DATABASE_URL
npm install
npm test                  # unit tests, no database needed
npm run test:e2e          # integration tests: need Postgres running
npm run start:dev
curl localhost:3000/api/health   # {"status":"ok","database":"up"}
```

## API (all under `/api`)

These are the calls `hangout/src/api.ts` makes.

| Method | Path                                         | Body                         | Returns |
| ------ | -------------------------------------------- | ---------------------------- | ------- |
| GET    | `/health`                                    |                              | `{ status, database }`, or 503 if Postgres is unreachable |
| POST   | `/events`                                    | `title, description?, mode?, dates[], timeZone, dayStartMinutes, dayEndMinutes, slotMinutes?` | `{ id }` |
| GET    | `/events/:id`                                |                              | the event, `participants` (names), `maxCount`, and every slot as `{ start, count, names }` |
| POST   | `/events/:id/participants`                   | `name`                       | `{ participantId, name, slots[] }` |
| PUT    | `/events/:id/participants/:pid/availability` | `slots[]` (UTC ISO strings)  | the refreshed event |
| DELETE | `/events/:id/participants/:pid`              |                              | 204 |

- **Times.** `dayStartMinutes` and `dayEndMinutes` are minutes after midnight
  in the event's `timeZone` (540 = 9:00 AM; 1440 = end of day).
- **Names are the sign-in.** Signing in with a name that already exists signs
  you in as that person, so anyone who enters a name can edit that name's
  times, the same as on when2meet.
- **Saving replaces.** Each save replaces the person's whole selection, in one
  transaction.
- **Errors.** The server answers 400 for invalid input (including fields it
  doesn't expect) and 404 for unknown events or people.

## Files

| File | What it does |
| ---- | ------------ |
| `src/main.ts` | Loads `.env`, applies `app.setup.ts`, optional CORS, starts listening |
| `src/app.setup.ts` | The `/api` prefix and request validation, shared by `main.ts` and the API tests |
| `src/app.module.ts` | Connects to Postgres; entities from feature modules register themselves |
| `src/env.ts` | Reads `server/.env` with Node's built-in loader |
| `src/health.controller.ts` | `GET /api/health` |
| `src/events/entities/` | The tables: `HangoutEvent`, `Participant`, `TimeSlot`, with their factory methods and behavior |
| `src/events/dto/` | Request bodies and their validation rules |
| `src/events/responses/` | `EventDetails` and `JoinResult`, the exact JSON the frontend reads |
| `src/events/events.controller.ts` | The routes; turns requests into `EventsService` calls |
| `src/events/events.service.ts` | Creates events, signs people in, saves and removes availability |
| `src/events/events.exceptions.ts` | Error classes extending NestJS's 404 and 400 exceptions |
| `src/scheduling/zoned-time.ts` | Low-level time zone conversions on the built-in `Intl` API. An exact copy lives in `hangout/src/lib/`; a test fails if they differ |
| `src/scheduling/time-zone.service.ts` | `TimeZoneService`: checks an event's dates, hours and zone, and lists its slots in UTC |
| `src/scheduling/availability-aggregator.service.ts` | `AvailabilityAggregator`: asks each participant who is free in each slot |
| `src/scheduling/heatmap.ts` | `SlotSummary` and `Heatmap` |
| `src/testing/test-database.ts` | Points the integration tests at their own database |

## Tables

| Table          | Key                         | Holds                                                     |
| -------------- | --------------------------- | --------------------------------------------------------- |
| `events`       | `id` (random UUID)          | Title, dates, time zone, daily window, slot length        |
| `participants` | `id` (UUID); unique `(eventId, name)` | A name someone joined under.                    |
| `time_slots`   | `(participantId, startUtc)` | One row per slot someone marked free, as an exact UTC moment |

Deleting an event deletes its participants, and deleting a participant
deletes their slots.

## How time zones work

Only two places convert between UTC and someone's local clock: the
server's `TimeZoneService`, which turns "9 AM to 5 PM in Los Angeles" into
UTC slots, and the browser, which draws those slots in the viewer's zone.
`generateSlots()` converts only the two edges of each day's window and steps
through real time in between, so a daylight saving day automatically has
one hour fewer or one more.

If you change `src/scheduling/zoned-time.ts`, run `npm run sync:shared` in
`hangout/` to copy it to the frontend.

## Tests

| Command            | What it checks | Needs Postgres |
| ------------------ | -------------- | -------------- |
| `npm test`         | Unit tests: time zones and daylight saving (both 2026 Los Angeles changes, the EU change, Kathmandu, Lord Howe Island), the heatmap, the response shapes, entity methods, health check | No |
| `npm run test:e2e` | Integration tests: the tables (keys, column types, cascading deletes), and every API route called with `fetch` like the frontend does | Yes |

The integration tests use their own database, `hangout_test`. They create
it the first time and empty it on every run, so your data in `hangout` is
never touched. Set `TEST_DATABASE_URL` to use a different one.
