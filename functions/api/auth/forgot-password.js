import { appBaseUrl, json, now, readJson, sendMail, uid, validEmail } from "../../_lib/common.js";
export async function onRequestPost({ env, request }) {
  const body = await readJson(request);
  const email = String(body?.email || "").trim().toLowerCase();
  if (!validEmail(email)) return json({ error: "BAD_EMAIL", message: "邮箱格式不正确。" }, 400);
  const user = await env.FORUM_DB.prepare("SELECT id, email FROM users WHERE email = ?").bind(email).first();
  if (!user) return json({ ok: true, message: "如果邮箱存在，重置链接已发送。" });
  const token = uid("reset");
  const ts = now();
  await env.FORUM_DB.prepare("INSERT INTO password_resets (token, user_id, created_at, expires_at) VALUES (?, ?, ?, ?)").bind(token, user.id, ts, ts + 1000 * 60 * 30).run();
  const resetUrl = `${appBaseUrl(env, request)}/reset-password/?token=${encodeURIComponent(token)}`;
  const mail = await sendMail(env, { to: email, subject: "重置你的 CloudForum 密码", text: `打开链接重置密码：\n${resetUrl}\n\n链接 30 分钟内有效。` });
  return json({ ok: true, message: "如果邮箱存在，重置链接已发送。", devResetUrl: mail.provider === "dev-log" ? resetUrl : undefined });
}

