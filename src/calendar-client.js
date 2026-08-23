"use strict";

/**
 * Thin HTTP client for the Calendar REST API. The MCP server uses this so that
 * agents and the web UI share exactly one source of truth (the running API).
 */
class CalendarClient {
  constructor(baseUrl = process.env.CALENDAR_API_URL || "http://localhost:3000") {
    this.baseUrl = baseUrl.replace(/\/$/, "");
  }

  async _request(method, pathname, body) {
    const res = await fetch(`${this.baseUrl}${pathname}`, {
      method,
      headers: { "Content-Type": "application/json" },
      body: body ? JSON.stringify(body) : undefined,
    });

    if (res.status === 204) return null;

    const text = await res.text();
    const data = text ? JSON.parse(text) : null;
    if (!res.ok) {
      const message = (data && data.error) || `Request failed (${res.status})`;
      throw new Error(message);
    }
    return data;
  }

  health() {
    return this._request("GET", "/api/health");
  }

  listEvents() {
    return this._request("GET", "/api/events");
  }

  getEventsForDay(date) {
    return this._request("GET", `/api/events?date=${encodeURIComponent(date)}`);
  }

  getEventsInRange(from, to) {
    const q = `from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`;
    return this._request("GET", `/api/events?${q}`);
  }

  createEvent(event) {
    return this._request("POST", "/api/events", event);
  }

  updateEvent(id, changes) {
    return this._request("PATCH", `/api/events/${id}`, changes);
  }

  deleteEvent(id) {
    return this._request("DELETE", `/api/events/${id}`);
  }
}

module.exports = { CalendarClient };
