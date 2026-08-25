import { hashPassword, json, now, readJson, uid } from "../../../_lib/common.js";
export async function onRequestPost({ env, request }) {
  const body = await readJson(request);
  const token = String(body?.token || "");
  const password = String(body?.password || "");
  if (password.length < 8) return json({ error: "BAD_PASSWORD", message: "密码至少 8 位。" }, 400);
  const row = await env.FORUM_DB.prepare("SELECT token, user_id FROM password_resets WHERE token = ? AND used_at IS NULL AND expires_at > ?").bind(token, now()).first();
  if (!row) return json({ error: "BAD_TOKEN", message: "重置链接无效或已过期。" }, 400);
  const salt = uid("salt");
  const passwordHash = await hashPassword(password, salt);
  await env.FORUM_DB.batch([
    env.FORUM_DB.prepare("UPDATE users SET password_hash = ?, salt = ? WHERE id = ?").bind(passwordHash, salt, row.user_id),
    env.FORUM_DB.prepare("UPDATE password_resets SET used_at = ? WHERE token = ?").bind(now(), token),
    env.FORUM_DB.prepare("DELETE FROM sessions WHERE user_id = ?").bind(row.user_id),
  ]);
  return json({ ok: true, message: "密码已重置，请重新登录。" });
}
