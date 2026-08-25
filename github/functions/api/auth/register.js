import {
  cleanupExpiredSessions,
  emailCodeHash,
  ensureRegisterCodes,
  hashPassword,
  isAdminUsername,
  json,
  normalizeCode,
  now,
  readJson,
  sessionCookie,
  timingSafeEqualHex,
  uid,
  validEmail,
  validUsername,
} from "../../_lib/common.js";

export async function onRequestPost({ env, request }) {
  await ensureRegisterCodes(env);

  const body = await readJson(request);
  const username = String(body?.username || "").trim().replace(/\s+/g, "_");
  const email = String(body?.email || "").trim().toLowerCase();
  const password = String(body?.password || "");
  const verificationCode = normalizeCode(body?.verificationCode);

  await cleanupExpiredSessions(env);
  if (!validUsername(username)) return json({ error: "BAD_USERNAME", message: "用户名需 2-24 位，只能含中文、字母、数字、_ 或 -。" }, 400);
  if (!validEmail(email)) return json({ error: "BAD_EMAIL", message: "邮箱格式不正确。" }, 400);
  if (verificationCode.length !== 6) return json({ error: "BAD_CODE", message: "请输入 6 位邮箱验证码。" }, 400);
  if (password.length < 8) return json({ error: "BAD_PASSWORD", message: "密码至少 8 位。" }, 400);

  const exists = await env.FORUM_DB.prepare("SELECT id FROM users WHERE username = ? OR email = ?").bind(username, email).first();
  if (exists) return json({ error: "USER_EXISTS", message: "用户名或邮箱已存在。" }, 409);

  const codeRow = await env.FORUM_DB.prepare("SELECT id, code_hash, attempt_count, expires_at FROM register_email_codes WHERE email = ? AND used_at IS NULL ORDER BY created_at DESC LIMIT 1").bind(email).first();
  if (!codeRow || Number(codeRow.expires_at || 0) < now()) return json({ error: "CODE_EXPIRED", message: "验证码不存在或已过期，请重新发送。" }, 400);
  if (Number(codeRow.attempt_count || 0) >= 5) return json({ error: "CODE_LOCKED", message: "验证码错误次数太多，请重新发送。" }, 429);

  const inputHash = await emailCodeHash(email, verificationCode);
  if (!timingSafeEqualHex(inputHash, codeRow.code_hash)) {
    await env.FORUM_DB.prepare("UPDATE register_email_codes SET attempt_count = attempt_count + 1 WHERE id = ?").bind(codeRow.id).run();
    return json({ error: "BAD_CODE", message: "验证码错误。" }, 400);
  }

  const userId = uid("u");
  const salt = uid("salt");
  const passwordHash = await hashPassword(password, salt);
  const role = isAdminUsername(env, username) ? "admin" : "user";
  const createdAt = now();
  const token = uid("sess");
  const expiresAt = createdAt + 1000 * 60 * 60 * 24 * 30;

  await env.FORUM_DB.batch([
    env.FORUM_DB.prepare("INSERT INTO users (id, username, email, email_verified, password_hash, salt, role, created_at) VALUES (?, ?, ?, 1, ?, ?, ?, ?)").bind(userId, username, email, passwordHash, salt, role, createdAt),
    env.FORUM_DB.prepare("UPDATE register_email_codes SET used_at = ? WHERE id = ?").bind(createdAt, codeRow.id),
    env.FORUM_DB.prepare("INSERT INTO sessions (token, user_id, created_at, expires_at) VALUES (?, ?, ?, ?)").bind(token, userId, createdAt, expiresAt),
  ]);

  const secure = new URL(request.url).protocol === "https:";
  return json({ user: { id: userId, username, email, email_verified: 1, role, created_at: createdAt } }, 201, { "set-cookie": sessionCookie(token, undefined, secure) });
}
