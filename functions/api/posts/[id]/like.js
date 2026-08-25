import { json, now, requireUser } from "../../../_lib/common.js";

export async function onRequestPost({ env, request, params }) {
  const auth = await requireUser(env, request);
  if (auth.error) return auth.error;
  const post = await env.FORUM_DB.prepare("SELECT id FROM posts WHERE id = ?").bind(params.id).first();
  if (!post) return json({ error: "NOT_FOUND", message: "主题不存在。" }, 404);
  const existing = await env.FORUM_DB.prepare("SELECT post_id FROM post_likes WHERE post_id = ? AND user_id = ?").bind(params.id, auth.user.id).first();
  if (existing) {
    await env.FORUM_DB.prepare("DELETE FROM post_likes WHERE post_id = ? AND user_id = ?").bind(params.id, auth.user.id).run();
  } else {
    await env.FORUM_DB.prepare("INSERT INTO post_likes (post_id, user_id, created_at) VALUES (?, ?, ?)").bind(params.id, auth.user.id, now()).run();
  }
  const row = await env.FORUM_DB.prepare("SELECT COUNT(*) count FROM post_likes WHERE post_id = ?").bind(params.id).first();
  return json({ liked: !existing, likesCount: Number(row.count || 0) });
}


