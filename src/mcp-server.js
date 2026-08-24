"use strict";

const { z } = require("zod");
const { McpServer } = require("@modelcontextprotocol/sdk/server/mcp.js");
const {
  StdioServerTransport,
} = require("@modelcontextprotocol/sdk/server/stdio.js");
const {
  StreamableHTTPServerTransport,
} = require("@modelcontextprotocol/sdk/server/streamableHttp.js");
const { CalendarClient } = require("./calendar-client");

const dateField = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Use YYYY-MM-DD")
  .describe("Calendar date in YYYY-MM-DD format");

const timeField = z
  .string()
  .regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Use HH:MM (24-hour)")
  .describe("Time in 24-hour HH:MM format");

function ok(summary, data) {
  return {
    content: [
      { type: "text", text: summary },
      { type: "text", text: JSON.stringify(data, null, 2) },
    ],
  };
}

function fail(message) {
  return {
    isError: true,
    content: [{ type: "text", text: `Error: ${message}` }],
  };
}

function describeEvents(events) {
  if (!events.length) return "No events found.";
  return events
    .map((e) => {
      const when = e.startTime
        ? `${e.startTime}${e.endTime ? `-${e.endTime}` : ""}`
        : "all day";
      const desc = e.description ? ` — ${e.description}` : "";
      return `#${e.id} [${e.date} ${when}] ${e.title}${desc}`;
    })
    .join("\n");
}

/**
 * Build an MCP server that exposes the calendar to agents (Claude, ChatGPT,
 * etc.). All tools operate against the shared Calendar REST API via the client.
 */
function createMcpServer(client = new CalendarClient()) {
  const server = new McpServer(
    { name: "calendar", version: "1.0.0" },
    {
      instructions:
        "Tools to view and manage a personal calendar of events. " +
        "Dates are YYYY-MM-DD and times are 24-hour HH:MM. " +
        "Use get_events_for_day to answer 'what do I have to do on <date>'.",
    }
  );

  server.registerTool(
    "get_current_date",
    {
      title: "Get current date",
      description:
        "Return today's date (YYYY-MM-DD) and time so you can resolve relative dates like 'today' or 'tomorrow'.",
      inputSchema: {},
    },
    async () => {
      const now = new Date();
      const date = now.toISOString().slice(0, 10);
      return ok(`Today is ${date}.`, { date, iso: now.toISOString() });
    }
  );

  server.registerTool(
    "get_events_for_day",
    {
      title: "Get events for a day",
      description:
        "List everything scheduled on a specific day. Use this to answer what the user has to do on a given date.",
      inputSchema: { date: dateField },
    },
    async ({ date }) => {
      try {
        const events = await client.getEventsForDay(date);
        return ok(
          `${events.length} event(s) on ${date}:\n${describeEvents(events)}`,
          events
        );
      } catch (err) {
        return fail(err.message);
      }
    }
  );

  server.registerTool(
    "list_events",
    {
      title: "List events",
      description:
        "List all events, or events within an optional date range (from/to inclusive, YYYY-MM-DD).",
      inputSchema: {
        from: dateField.optional(),
        to: dateField.optional(),
      },
    },
    async ({ from, to }) => {
      try {
        let events;
        if (from && to) {
          events = await client.getEventsInRange(from, to);
        } else if (from || to) {
          return fail("Provide both from and to for a range, or neither.");
        } else {
          events = await client.listEvents();
        }
        return ok(
          `${events.length} event(s):\n${describeEvents(events)}`,
          events
        );
      } catch (err) {
        return fail(err.message);
      }
    }
  );

  server.registerTool(
    "create_event",
    {
      title: "Create event",
      description:
        "Add a new event to the calendar. Title and date are required; startTime, endTime and description are optional.",
      inputSchema: {
        title: z.string().min(1).describe("What the event is"),
        date: dateField,
        startTime: timeField.optional(),
        endTime: timeField.optional(),
        description: z.string().optional().describe("Optional details/notes"),
      },
    },
    async (input) => {
      try {
        const event = await client.createEvent(input);
        return ok(`Created event #${event.id}: ${event.title} on ${event.date}.`, event);
      } catch (err) {
        return fail(err.message);
      }
    }
  );

  server.registerTool(
    "update_event",
    {
      title: "Update event",
      description:
        "Update fields of an existing event by id. Only provided fields are changed.",
      inputSchema: {
        id: z.number().int().positive().describe("Event id to update"),
        title: z.string().min(1).optional(),
        date: dateField.optional(),
        startTime: timeField.optional(),
        endTime: timeField.optional(),
        description: z.string().optional(),
      },
    },
    async ({ id, ...changes }) => {
      try {
        const event = await client.updateEvent(id, changes);
        return ok(`Updated event #${event.id}.`, event);
      } catch (err) {
        return fail(err.message);
      }
    }
  );

  server.registerTool(
    "delete_event",
    {
      title: "Delete event",
      description: "Delete an event from the calendar by its id.",
      inputSchema: { id: z.number().int().positive().describe("Event id to delete") },
    },
    async ({ id }) => {
      try {
        await client.deleteEvent(id);
        return ok(`Deleted event #${id}.`, { id, deleted: true });
      } catch (err) {
        return fail(err.message);
      }
    }
  );

  return server;
}

async function runStdio() {
  const server = createMcpServer();
  const transport = new StdioServerTransport();
  await server.connect(transport);
  // stderr so it never corrupts the stdio JSON-RPC stream on stdout.
  console.error("Calendar MCP server running on stdio");
}

async function runHttp(port) {
  const express = require("express");
  const app = express();
  app.use(express.json());

  // Stateless Streamable HTTP: a fresh server+transport per request keeps the
  // deployment simple and works with remote agent connectors.
  app.post("/mcp", async (req, res) => {
    const server = createMcpServer();
    const transport = new StreamableHTTPServerTransport({
      sessionIdGenerator: undefined,
    });
    res.on("close", () => {
      transport.close();
      server.close();
    });
    try {
      await server.connect(transport);
      await transport.handleRequest(req, res, req.body);
    } catch (err) {
      if (!res.headersSent) {
        res.status(500).json({
          jsonrpc: "2.0",
          error: { code: -32603, message: err.message },
          id: null,
        });
      }
    }
  });

  const methodNotAllowed = (_req, res) => {
    res.status(405).json({
      jsonrpc: "2.0",
      error: { code: -32000, message: "Method not allowed (stateless server)." },
      id: null,
    });
  };
  app.get("/mcp", methodNotAllowed);
  app.delete("/mcp", methodNotAllowed);

  app.get("/", (_req, res) => {
    res.json({ name: "calendar-mcp", transport: "streamable-http", endpoint: "/mcp" });
  });

  await new Promise((resolve) => {
    app.listen(port, "0.0.0.0", resolve);
  });
  console.error(`Calendar MCP server running on Streamable HTTP at :${port}/mcp`);
}

if (require.main === module) {
  const httpPort = process.env.MCP_HTTP_PORT;
  const useHttp = process.argv.includes("--http") || Boolean(httpPort);
  // When deployed as its own service (e.g. Railway), honor the injected PORT.
  const resolvedPort = Number(httpPort) || Number(process.env.PORT) || 3001;
  const start = useHttp ? runHttp(resolvedPort) : runStdio();
  start.catch((err) => {
    console.error("Fatal MCP server error:", err);
    process.exit(1);
  });
}

module.exports = { createMcpServer };
