import { checkLoginRateLimit, cleanupExpiredSessions, clearLoginAttempts, getClientIp, hashPassword, json, now, readJson, recordLoginAttempt, sessionCookie, uid, verifyPassword } from "../../_lib/common.js";

export async function onRequestPost({ env, request }) {
  const body = await readJson(request);
  const username = String(body?.username || "").trim();
  const password = String(body?.password || "");
  const attemptKey = `${getClientIp(request)}:${username.toLowerCase()}`;

  await cleanupExpiredSessions(env);
  if (!(await checkLoginRateLimit(env, attemptKey))) return json({ error: "RATE_LIMITED", message: "登录尝试太多，15 分钟后再试。" }, 429);

  const user = await env.FORUM_DB.prepare("SELECT id, username, email, email_verified, role, banned_at, banned_reason, password_hash, salt, created_at FROM users WHERE username = ? OR email = ?").bind(username, username.toLowerCase()).first();
  if (!user || !(await verifyPassword(password, user.salt, user.password_hash))) {
    await recordLoginAttempt(env, attemptKey);
    return json({ error: "BAD_LOGIN", message: "账号或密码错误。" }, 401);
  }
  if (user.banned_at) return json({ error: "BANNED", message: `账号已封禁：${user.banned_reason || "未填写原因"}` }, 403);

  if (!String(user.password_hash).startsWith("pbkdf2_sha256$")) {
    await env.FORUM_DB.prepare("UPDATE users SET password_hash = ? WHERE id = ?").bind(await hashPassword(password, user.salt), user.id).run();
  }
  await clearLoginAttempts(env, attemptKey);
  const token = uid("sess");
  const createdAt = now();
  const expiresAt = createdAt + 1000 * 60 * 60 * 24 * 30;
  await env.FORUM_DB.prepare("INSERT INTO sessions (token, user_id, created_at, expires_at) VALUES (?, ?, ?, ?)").bind(token, user.id, createdAt, expiresAt).run();
  const secure = new URL(request.url).protocol === "https:";
  return json({ user: { id: user.id, username: user.username, email: user.email, email_verified: user.email_verified, role: user.role, created_at: user.created_at } }, 200, { "set-cookie": sessionCookie(token, undefined, secure) });
}

