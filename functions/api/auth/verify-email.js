import { json } from "../../_lib/common.js";

export async function onRequestGet() {
  return json({ ok: true, message: "邮箱验证已关闭，账号注册后直接可用。" });
}
