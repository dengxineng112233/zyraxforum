import worker from "../src/worker.js";

const REQUIRED_D1_ENV = [
  ["CLOUDFLARE_ACCOUNT_ID", "CF_ACCOUNT_ID"],
  ["CLOUDFLARE_D1_DATABASE_ID", "CF_D1_DATABASE_ID", "D1_DATABASE_ID"],
  ["CLOUDFLARE_API_TOKEN", "CF_D1_API_TOKEN", "CF_API_TOKEN"],
];

function envValue(names) {
  for (const name of names) {
    const value = process.env[name];
    if (value) return value;
  }
  return "";
}

function normalizeParam(value) {
  if (value === null || value === undefined) return null;
  return String(value);
}

function getD1Config() {
  const accountId = envValue(REQUIRED_D1_ENV[0]);
  const databaseId = envValue(REQUIRED_D1_ENV[1]);
  const apiToken = envValue(REQUIRED_D1_ENV[2]);
  return { accountId, databaseId, apiToken };
}

class D1HttpStatement {
  constructor(db, sql, params = []) {
    this.db = db;
    this.sql = sql;
    this.params = params;
  }

  bind(...params) {
    return new D1HttpStatement(this.db, this.sql, params.map(normalizeParam));
  }

  async all() {
    const result = await this.db.query(this.sql, this.params);
    return {
      results: Array.isArray(result.results) ? result.results : [],
      meta: result.meta || {},
      success: result.success !== false,
    };
  }

  async first() {
    const rows = await this.all();
    return rows.results[0] || null;
  }

  async run() {
    const result = await this.db.query(this.sql, this.params);
    return {
      results: Array.isArray(result.results) ? result.results : [],
      meta: result.meta || {},
      success: result.success !== false,
    };
  }
}

class D1HttpDatabase {
  constructor(config) {
    this.accountId = config.accountId;
    this.databaseId = config.databaseId;
    this.apiToken = config.apiToken;
    this.configured = !!(this.accountId && this.databaseId && this.apiToken);
    this.endpoint = `https://api.cloudflare.com/client/v4/accounts/${this.accountId}/d1/database/${this.databaseId}/query`;
  }

  prepare(sql) {
    return new D1HttpStatement(this, sql);
  }

  async query(sql, params = []) {
    const results = await this.request({ sql, params: params.map(normalizeParam) });
    return results[0] || { results: [], meta: {}, success: true };
  }

  async batch(statements) {
    const batch = statements.map(statement => ({
      sql: statement.sql,
      params: statement.params.map(normalizeParam),
    }));
    return this.request({ batch });
  }

  async request(body) {
    if (!this.accountId || !this.databaseId || !this.apiToken) {
      throw new Error("D1_HTTP_CONFIG_MISSING: set CLOUDFLARE_ACCOUNT_ID, CLOUDFLARE_D1_DATABASE_ID, CLOUDFLARE_API_TOKEN in Vercel Environment Variables.");
    }

    const response = await fetch(this.endpoint, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${this.apiToken}`,
      },
      body: JSON.stringify(body),
    });

    const payload = await response.json().catch(() => ({}));
    if (!response.ok || payload.success === false) {
      const detail = payload.errors?.map(error => error.message).join("; ") || response.statusText || "Cloudflare D1 query failed";
      throw new Error(`D1_HTTP_ERROR ${response.status}: ${detail}`);
    }

    return Array.isArray(payload.result) ? payload.result : [payload.result || {}];
  }
}

function buildEnv() {
  const appBaseUrl = process.env.APP_BASE_URL || (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "");
  return {
    ...process.env,
    FORUM_DB: new D1HttpDatabase(getD1Config()),
    ADMIN_USERNAMES: process.env.ADMIN_USERNAMES || "admin",
    APP_BASE_URL: appBaseUrl,
  };
}

function rawHeaders(req) {
  const headers = new Headers();
  for (const [key, value] of Object.entries(req.headers || {})) {
    if (Array.isArray(value)) headers.set(key, value.join(", "));
    else if (value !== undefined) headers.set(key, String(value));
  }
  return headers;
}

async function readBody(req) {
  const chunks = [];
  for await (const chunk of req) chunks.push(Buffer.from(chunk));
  return Buffer.concat(chunks);
}

async function toFetchRequest(req) {
  const protocol = req.headers["x-forwarded-proto"] || "https";
  const host = req.headers.host || "localhost";
  const incomingUrl = new URL(`${protocol}://${host}${req.url}`);

  if ((incomingUrl.pathname === "/api" || incomingUrl.pathname === "/api/") && incomingUrl.searchParams.has("path")) {
    const routedPath = incomingUrl.searchParams.get("path") || "";
    incomingUrl.pathname = `/api/${routedPath.replace(/^\/+/, "")}`;
    incomingUrl.searchParams.delete("path");
  }

  const url = incomingUrl.toString();
  const init = { method: req.method, headers: rawHeaders(req) };

  if (req.method !== "GET" && req.method !== "HEAD") {
    const body = await readBody(req);
    if (body.length) init.body = body;
  }

  return new Request(url, init);
}

async function sendFetchResponse(res, response) {
  res.statusCode = response.status;
  response.headers.forEach((value, key) => {
    res.setHeader(key, value);
  });

  const body = Buffer.from(await response.arrayBuffer());
  res.end(body);
}

export default async function handler(req, res) {
  try {
    const request = await toFetchRequest(req);
    const response = await worker.fetch(request, buildEnv());
    await sendFetchResponse(res, response);
  } catch (err) {
    res.statusCode = 500;
    res.setHeader("content-type", "application/json; charset=utf-8");
    res.end(JSON.stringify({ error: "VERCEL_D1_EXCEPTION", message: String(err?.message || err) }));
  }
}
