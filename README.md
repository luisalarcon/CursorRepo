# CursorRepo — Task Board

A small full-stack demo app used to exercise the Cloud Agent development environment
end to end: an Express JSON API backed by an in-memory store, served alongside a
modern vanilla-JS frontend.

## Requirements

- Node.js >= 20 (the Cloud Agent default image ships Node 22)

## Getting started

```bash
npm ci        # install dependencies from the lockfile
npm start     # start the server on http://localhost:3000
```

Then open http://localhost:3000 and add, complete, and delete tasks.

## Scripts

| Command        | Description                                  |
| -------------- | -------------------------------------------- |
| `npm start`    | Start the production server                  |
| `npm run dev`  | Start the server with file watching          |
| `npm test`     | Run the Jest + supertest API test suite      |
| `npm run lint` | Lint the codebase with ESLint                |

## API

| Method   | Path                     | Description              |
| -------- | ------------------------ | ------------------------ |
| `GET`    | `/api/health`            | Health probe             |
| `GET`    | `/api/tasks`             | List tasks               |
| `POST`   | `/api/tasks`             | Create a task            |
| `PATCH`  | `/api/tasks/:id/toggle`  | Toggle a task's done flag |
| `DELETE` | `/api/tasks/:id`         | Delete a task            |

## Project layout

```
public/    Static frontend (HTML/CSS/JS)
src/       Express app, server bootstrap, in-memory store
tests/     API tests (Jest + supertest)
```
