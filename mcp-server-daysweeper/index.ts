import { Server, Tool } from "@modelcontextprotocol/sdk/server/index.js";
import fetch from "node-fetch";

const API_BASE = process.env.API_BASE || "https://daysweeper.vercel.app";
const KEY = process.env.INTERNAL_API_KEY || "";

async function api(path: string, init: any = {}) {
  const r = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers: { "content-type": "application/json", "x-api-key": KEY, ...(init.headers || {}) }
  });
  if (!r.ok) throw new Error(`API ${path} ${r.status}`);
  return r.json();
}

// Tools
const listCompanies: Tool = {
  name: "list_companies",
  description: "List companies with optional search",
  inputSchema: { type: "object", properties: { q: { type: "string" } } },
  async *call({ q }) { return { ok: true, items: await api(`/api/targets?q=${encodeURIComponent(q || "")}`) }; }
};

const getRoute: Tool = {
  name: "get_route",
  description: "Get route details by id",
  inputSchema: { type: "object", properties: { id: { type: "string" } }, required: ["id"] },
  async *call({ id }) { return await api(`/api/routes/${id}`); }
};

const server = new Server({ name: "daysweeper-mcp", version: "0.1.0" });
server.tool(listCompanies);
server.tool(getRoute);

server.start();
