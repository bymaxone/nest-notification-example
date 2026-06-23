-- Runs once on first volume initialization (data dir empty), against the default `postgres` DB.
-- Postgres lacks `CREATE DATABASE IF NOT EXISTS`, so use the \gexec guard to stay re-run-safe.
-- The entrypoint already creates POSTGRES_DB; this guard covers a renamed POSTGRES_DB.
SELECT 'CREATE DATABASE notification_example'
WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'notification_example')\gexec
