import { json } from "../_lib/common.js";

export async function onRequestGet({ env }) {
  if (!env.FORUM_DB) {
    return json({
      ok: false,
      d1Bound: false,
      error: "D1_NOT_BOUND",
      message: "缺少 D1 绑定 FORUM_DB。请在 Worker Settings -> Bindings 里绑定 D1，变量名 FORUM_DB。",
    }, 500);
  }

  if (env.FORUM_DB.configured === false) {
    return json({
      ok: false,
      d1Bound: false,
      error: "D1_HTTP_CONFIG_MISSING",
      message: "Vercel 环境变量缺失。请设置 CLOUDFLARE_ACCOUNT_ID、CLOUDFLARE_D1_DATABASE_ID、CLOUDFLARE_API_TOKEN。",
    }, 500);
  }

  try {
    const row = await env.FORUM_DB.prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'users'").first();
    return json({
      ok: !!row,
      d1Bound: true,
      usersTable: !!row,
      message: row ? "D1 正常。" : "D1 已绑定，但还没执行 schema/d1.sql。可打开 /schema/d1.sql 复制初始化 SQL。",
    });
  } catch (err) {
    return json({ ok: false, d1Bound: true, error: "D1_ERROR", message: String(err?.message || err) }, 500);
  }
}
