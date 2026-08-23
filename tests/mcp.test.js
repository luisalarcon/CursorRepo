"use strict";

const path = require("path");
const { createApp } = require("../src/app");
const { EventStore } = require("../src/store");
const { Client } = require("@modelcontextprotocol/sdk/client/index.js");
const {
  StdioClientTransport,
} = require("@modelcontextprotocol/sdk/client/stdio.js");

describe("Calendar MCP server (stdio)", () => {
  let httpServer;
  let client;
  let transport;

  beforeAll(async () => {
    const app = createApp(new EventStore());
    await new Promise((resolve) => {
      httpServer = app.listen(0, "127.0.0.1", resolve);
    });
    const { port } = httpServer.address();
    const baseUrl = `http://127.0.0.1:${port}`;

    transport = new StdioClientTransport({
      command: process.execPath,
      args: [path.join(__dirname, "..", "src", "mcp-server.js")],
      env: { ...process.env, CALENDAR_API_URL: baseUrl },
    });
    client = new Client({ name: "test-client", version: "1.0.0" });
    await client.connect(transport);
  }, 20000);

  afterAll(async () => {
    if (client) await client.close();
    if (httpServer) await new Promise((r) => httpServer.close(r));
  });

  function textOf(result) {
    return (result.content || []).map((c) => c.text).join("\n");
  }

  test("exposes the calendar tools", async () => {
    const { tools } = await client.listTools();
    const names = tools.map((t) => t.name);
    expect(names).toEqual(
      expect.arrayContaining([
        "get_current_date",
        "get_events_for_day",
        "list_events",
        "create_event",
        "update_event",
        "delete_event",
      ])
    );
  });

  test("get_current_date returns a YYYY-MM-DD date", async () => {
    const res = await client.callTool({ name: "get_current_date", arguments: {} });
    expect(res.isError).toBeFalsy();
    expect(textOf(res)).toMatch(/\d{4}-\d{2}-\d{2}/);
  });

  test("creates, lists, updates, and deletes an event via tools", async () => {
    const created = await client.callTool({
      name: "create_event",
      arguments: {
        title: "Standup",
        date: "2026-08-24",
        startTime: "09:00",
        description: "Daily sync",
      },
    });
    expect(created.isError).toBeFalsy();
    expect(textOf(created)).toMatch(/Created event #\d+/);

    const day = await client.callTool({
      name: "get_events_for_day",
      arguments: { date: "2026-08-24" },
    });
    expect(textOf(day)).toMatch(/Standup/);
    expect(textOf(day)).toMatch(/1 event\(s\) on 2026-08-24/);

    // Grab the id from the structured JSON payload.
    const events = JSON.parse(day.content[1].text);
    const id = events[0].id;

    const updated = await client.callTool({
      name: "update_event",
      arguments: { id, startTime: "10:30" },
    });
    expect(textOf(updated)).toMatch(/Updated event/);
    expect(JSON.parse(updated.content[1].text).startTime).toBe("10:30");

    const removed = await client.callTool({
      name: "delete_event",
      arguments: { id },
    });
    expect(textOf(removed)).toMatch(/Deleted event/);

    const after = await client.callTool({
      name: "get_events_for_day",
      arguments: { date: "2026-08-24" },
    });
    expect(textOf(after)).toMatch(/No events found/);
  });

  test("surfaces validation errors from the API", async () => {
    const res = await client.callTool({
      name: "create_event",
      arguments: { title: "No date but bad", date: "2026-13-40" },
    });
    expect(res.isError).toBe(true);
    expect(textOf(res)).toMatch(/date/i);
  });
});
