-- ?? D1 ?????? views ??????? ALTER ?????Worker ???????
ALTER TABLE posts ADD COLUMN views INTEGER NOT NULL DEFAULT 0;
CREATE TABLE IF NOT EXISTS post_views (
  post_id TEXT NOT NULL,
  viewer_key TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  PRIMARY KEY (post_id, viewer_key),
  FOREIGN KEY (post_id) REFERENCES posts(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_posts_views ON posts(views DESC);
CREATE INDEX IF NOT EXISTS idx_post_views_post_id ON post_views(post_id);
