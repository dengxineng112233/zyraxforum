-- Replace admin user. Password hash generated locally; plaintext is not stored.
DELETE FROM sessions WHERE user_id IN (SELECT id FROM users WHERE username = 'admin' OR email = 'admin@example.com');
DELETE FROM users WHERE username = 'admin' OR email = 'admin@example.com';

INSERT INTO users (id, username, email, email_verified, password_hash, salt, role, banned_at, banned_reason, created_at)
VALUES ('u_mt45itwi_e175b9f9dbf895aee6a801992a5b53d4', 'admin', 'admin@example.com', 1, 'pbkdf2_sha256$100000$56c89f06ee345b100bff15fd7b29966f99bbcb52aa6327b6da4bb015779c5cdf', 'salt_mt45itwi_7f92c42377651ab3b4788051c2788ccf', 'admin', NULL, NULL, 1787389439202);
