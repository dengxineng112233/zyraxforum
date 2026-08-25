CREATE TABLE IF NOT EXISTS register_email_codes (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL COLLATE NOCASE,
  code_hash TEXT NOT NULL,
  attempt_count INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL,
  used_at INTEGER,
  ip_hash TEXT
);
CREATE INDEX IF NOT EXISTS idx_register_email_codes_email ON register_email_codes(email, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_register_email_codes_ip ON register_email_codes(ip_hash, created_at DESC);
