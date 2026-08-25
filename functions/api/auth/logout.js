import { clearSessionCookie, getCookie, json } from "../../_lib/common.js";

export async function onRequestPost({ env, request }) {
  const token = getCookie(request, "cf_session");
  if (token) await env.FORUM_DB.prepare("DELETE FROM sessions WHERE token = ?").bind(token).run();
  return json({ ok: true }, 200, { "set-cookie": clearSessionCookie() });
}
