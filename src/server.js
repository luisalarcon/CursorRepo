"use strict";

const path = require("path");
const { createApp } = require("./app");
const { EventStore } = require("./store");

const PORT = process.env.PORT || 3000;
const HOST = process.env.HOST || "0.0.0.0";
const DATA_FILE =
  process.env.DATA_FILE || path.join(__dirname, "..", "data", "events.json");

const store = new EventStore({ filePath: DATA_FILE });
const app = createApp(store);

const server = app.listen(PORT, HOST, () => {
  console.log(`Calendar API listening on http://${HOST}:${PORT}`);
  console.log(`Events persisted to ${DATA_FILE}`);
});

function shutdown(signal) {
  console.log(`Received ${signal}, shutting down.`);
  server.close(() => process.exit(0));
}

process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));

module.exports = { server };
