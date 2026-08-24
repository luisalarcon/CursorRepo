# CursorRepo — Calendar

A calendar web app for seeing what you have to do on any given day, plus an
**agent-friendly MCP server** so assistants like Claude or ChatGPT can view and
manage your calendar for you.

- Month calendar view with per-day event counts.
- Click any day to see its events and add / edit / delete them.
- Events have a title, date, optional start/end time, and notes.
- Events persist to disk (`data/events.json`) so they survive restarts.
- A [Model Context Protocol](https://modelcontextprotocol.io) server exposes the
  calendar as tools, over **stdio** (Claude Desktop and local clients) and
  **Streamable HTTP** (remote connectors).

## Requirements

- Node.js >= 20 (the Cloud Agent default image ships Node 22)

## Getting started

```bash
npm ci        # install dependencies
npm start     # start the calendar API + web UI on http://localhost:3000
```

Open http://localhost:3000, pick a day, and add an event.

## Scripts

| Command             | Description                                            |
| ------------------- | ------------------------------------------------------ |
| `npm start`         | Start the calendar web app + REST API (port 3000)      |
| `npm run dev`       | Start the app with file watching                       |
| `npm run mcp`       | Start the MCP server over **stdio**                    |
| `npm run mcp:http`  | Start the MCP server over **Streamable HTTP** (3001)   |
| `npm test`          | Run the Jest test suite (REST API + MCP integration)   |
| `npm run lint`      | Lint with ESLint                                       |

## REST API

| Method   | Path                                          | Description                       |
| -------- | --------------------------------------------- | --------------------------------- |
| `GET`    | `/api/health`                                 | Health probe                      |
| `GET`    | `/api/events`                                 | List all events                   |
| `GET`    | `/api/events?date=YYYY-MM-DD`                 | Events on a single day            |
| `GET`    | `/api/events?from=YYYY-MM-DD&to=YYYY-MM-DD`   | Events in an inclusive date range |
| `GET`    | `/api/events/:id`                             | Get one event                     |
| `POST`   | `/api/events`                                 | Create an event                   |
| `PATCH`  | `/api/events/:id`                             | Update an event                   |
| `DELETE` | `/api/events/:id`                             | Delete an event                   |

Event shape: `{ title, date: "YYYY-MM-DD", startTime?: "HH:MM", endTime?: "HH:MM", description? }`.

## Connect an AI agent (MCP)

The MCP server talks to the calendar's REST API, so make sure the calendar app
is running (`npm start`) first. Set `CALENDAR_API_URL` if the API is not on
`http://localhost:3000`.

### Tools exposed

- `get_current_date` — resolve "today"/"tomorrow" to a real date.
- `get_events_for_day` — what's scheduled on a given day.
- `list_events` — all events, or a date range.
- `create_event` — add an event.
- `update_event` — change an event by id.
- `delete_event` — remove an event by id.

### Claude Desktop (stdio)

Add this to your Claude Desktop MCP config (`claude_desktop_config.json`):

```json
{
  "mcpServers": {
    "calendar": {
      "command": "node",
      "args": ["/absolute/path/to/CursorRepo/src/mcp-server.js"],
      "env": { "CALENDAR_API_URL": "http://localhost:3000" }
    }
  }
}
```

Then ask Claude things like "What do I have to do on 2026-08-24?" or
"Add a dentist appointment on Friday at 9am."

### Remote clients / ChatGPT (Streamable HTTP)

Start the HTTP transport and point your connector at the `/mcp` endpoint:

```bash
npm run mcp:http           # serves MCP at http://localhost:3001/mcp
```

## Deploy to Railway

This repo ships a `Dockerfile` and `railway.json`, so [Railway](https://railway.com)
can build and run it directly.

1. Push this repo to GitHub (already done if you're reading this in a PR).
2. In Railway: **New Project → Deploy from GitHub repo** and pick this repo.
3. Railway detects `railway.json` and builds the `Dockerfile`. No build/start
   config is needed — the app binds to the `PORT` Railway injects and the
   health check hits `/api/health`.
4. Under the service's **Settings → Networking**, click **Generate Domain** to
   get a public URL for the calendar.

That's it for the calendar web app + REST API.

### Persist events across deploys

The event store writes to `data/events.json`, and a container's filesystem is
ephemeral. To keep events across restarts/redeploys, add a **Volume** to the
service mounted at `/app/data` (the default `DATA_FILE` is
`/app/data/events.json`). Or set `DATA_FILE` to a path on your mounted volume.

### Expose the MCP server (optional)

The MCP server needs the calendar API to talk to (`CALENDAR_API_URL`). Two options:

- Run it **locally** (stdio) pointed at your deployed URL — nothing extra to
  deploy. Set `CALENDAR_API_URL=https://<your-app>.up.railway.app` in the
  Claude Desktop config shown above. Recommended.
- Deploy it as a **second Railway service** from the same repo: set the service's
  start command to `npm run mcp:http` and add `CALENDAR_API_URL` pointing at the
  calendar service (Railway private domain works, e.g.
  `http://<calendar-service>.railway.internal:<port>`). The MCP HTTP server binds
  the injected `PORT`. If you expose this publicly, add authentication first — the
  endpoint is currently unauthenticated.

## Project layout

```
public/    Calendar frontend (HTML/CSS/JS)
src/       Express app, server, event store, MCP server, calendar client
tests/     REST API tests + MCP stdio integration test
```
