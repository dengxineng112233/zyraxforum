import { getCurrentUser, json } from "../_lib/common.js";

export async function onRequestGet({ env, request }) {
  const user = await getCurrentUser(env, request);
  return json({ user });
}

