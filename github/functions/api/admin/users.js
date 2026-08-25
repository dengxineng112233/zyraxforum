import { json, requireAdmin } from "../../_lib/common.js";
export async function onRequestGet({ env, request }) {
  const auth = await requireAdmin(env, request);
  if (auth.error) return auth.error;
  const rows = await env.FORUM_DB.prepare("SELECT id, username, email, email_verified, role, banned_at, banned_reason, created_at FROM users ORDER BY created_at DESC LIMIT 200").all();
  return json({ users: rows.results || [] });
}
