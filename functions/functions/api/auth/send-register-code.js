import {
  emailCodeHash,
  ensureRegisterCodes,
  getClientIp,
  json,
  makeEmailCode,
  now,
  readJson,
  sendMail,
  sha256Hex,
  uid,
  validEmail,
} from "../../_lib/common.js";

export async function onRequestPost({ env, request }) {
  await ensureRegisterCodes(env);

  const body = await readJson(request);
  const email = String(body?.email || "").trim().toLowerCase();
  if (!validEmail(email)) return json({ error: "BAD_EMAIL", message: "邮箱格式不正确。" }, 400);

  const exists = await env.FORUM_DB.prepare("SELECT id FROM users WHERE email = ?").bind(email).first();
  if (exists) return json({ error: "EMAIL_EXISTS", message: "该邮箱已经注册。" }, 409);

  const ts = now();
  const since = ts - 10 * 60 * 1000;
  const ipHash = await sha256Hex(getClientIp(request));

  await env.FORUM_DB.prepare("DELETE FROM register_email_codes WHERE expires_at < ? OR used_at IS NOT NULL").bind(ts - 24 * 60 * 60 * 1000).run();

  const emailCount = await env.FORUM_DB.prepare("SELECT COUNT(*) count FROM register_email_codes WHERE email = ? AND created_at >= ?").bind(email, since).first();
  const ipCount = await env.FORUM_DB.prepare("SELECT COUNT(*) count FROM register_email_codes WHERE ip_hash = ? AND created_at >= ?").bind(ipHash, since).first();
  if (Number(emailCount?.count || 0) >= 5 || Number(ipCount?.count || 0) >= 10) {
    return json({ error: "RATE_LIMITED", message: "验证码发送太频繁，10 分钟后再试。" }, 429);
  }

  const code = makeEmailCode();
  const codeHash = await emailCodeHash(email, code);
  await env.FORUM_DB.prepare("INSERT INTO register_email_codes (id, email, code_hash, attempt_count, created_at, expires_at, ip_hash) VALUES (?, ?, ?, 0, ?, ?, ?)")
    .bind(uid("ec"), email, codeHash, ts, ts + 10 * 60 * 1000, ipHash)
    .run();

  try {
    const mail = await sendMail(env, {
      to: email,
      subject: "ZyraxForum 注册验证码",
      text: `你的 ZyraxForum 注册验证码是：${code}\n\n10 分钟内有效。`,
    });
    return json({
      ok: true,
      message: mail.provider === "dev-log" ? "验证码已生成。当前未配置邮件服务，已返回 devCode 方便测试。" : "验证码已发送，请查看邮箱。",
      devCode: mail.provider === "dev-log" ? code : undefined,
    });
  } catch (err) {
    return json({ error: "MAIL_FAILED", message: String(err?.message || err) }, 502);
  }
}
