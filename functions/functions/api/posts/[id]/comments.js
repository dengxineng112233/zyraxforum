import { json, now, readJson, requireUser, uid } from "../../../_lib/common.js";

export async function onRequestPost({ env, request, params }) {
  const auth = await requireUser(env, request);
  if (auth.error) return auth.error;
  const body = await readJson(request);
  const content = String(body?.body || "").trim();
  if (content.length < 1 || content.length > 500) return json({ error: "BAD_COMMENT", message: "回复需 1-500 字。" }, 400);
  const post = await env.FORUM_DB.prepare("SELECT id FROM posts WHERE id = ?").bind(params.id).first();
  if (!post) return json({ error: "NOT_FOUND", message: "主题不存在。" }, 404);
  const id = uid("c");
  const ts = now();
  await env.FORUM_DB.prepare("INSERT INTO comments (id, post_id, author_id, body, created_at) VALUES (?, ?, ?, ?, ?)")
    .bind(id, params.id, auth.user.id, content, ts)
    .run();
  return json({ comment: { id, post_id: params.id, author_id: auth.user.id, author: auth.user.username, body: content, created_at: ts } }, 201);
}


