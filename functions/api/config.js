import { json } from "../_lib/common.js";
export async function onRequestGet({ env }) {
  return json({ turnstileSiteKey: env.TURNSTILE_SITE_KEY || "" });
}
