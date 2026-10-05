# hangout server

NestJS + TypeORM + PostgreSQL. Every instant is stored and sent as UTC;
converting to someone's zone happens only for display.

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
