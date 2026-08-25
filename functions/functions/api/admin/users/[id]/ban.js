import { json, now, readJson, requireAdmin } from "../../../../_lib/common.js";
export async function onRequestPost({ env, request, params }) {
  const auth = await requireAdmin(env, request);
  if (auth.error) return auth.error;
  if (params.id === auth.user.id) return json({ error: "SELF_BAN", message: "不能封禁自己。" }, 400);
  const body = await readJson(request);
  const reason = String(body?.reason || "违反社区规则").slice(0, 160);
  await env.FORUM_DB.prepare("UPDATE users SET banned_at = ?, banned_reason = ? WHERE id = ?").bind(now(), reason, params.id).run();
  await env.FORUM_DB.prepare("DELETE FROM sessions WHERE user_id = ?").bind(params.id).run();
  return json({ ok: true });
}
export async function onRequestDelete({ env, request, params }) {
  const auth = await requireAdmin(env, request);
  if (auth.error) return auth.error;
  await env.FORUM_DB.prepare("UPDATE users SET banned_at = NULL, banned_reason = NULL WHERE id = ?").bind(params.id).run();
  return json({ ok: true });
}
