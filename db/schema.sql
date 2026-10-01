-- Neon Postgres schema. Safe to run repeatedly.

CREATE TABLE IF NOT EXISTS users (
  uid           text PRIMARY KEY,
  email         text,
  last_login_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS settings (
  uid           text PRIMARY KEY REFERENCES users(uid) ON DELETE CASCADE,
  base_currency text NOT NULL DEFAULT 'USD',
  display_name  text
);

CREATE TABLE IF NOT EXISTS entries (
  id                    text PRIMARY KEY,
  uid                   text NOT NULL REFERENCES users(uid) ON DELETE CASCADE,
  type                  text NOT NULL CHECK (type IN ('credit', 'debit')),
  ledger_group          text NOT NULL CHECK (ledger_group IN ('primary', 'secondary')),
  category              text NOT NULL,
  description           text NOT NULL DEFAULT '',
  amount                numeric(16, 2) NOT NULL,
  currency              text NOT NULL,
  date                  date NOT NULL,
  source                text,
  debt_id               text,
  salary_profile_id     text,
  salary_occurrence_key text,
  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now(),
  UNIQUE (uid, salary_occurrence_key)
);
CREATE INDEX IF NOT EXISTS entries_uid_date_idx ON entries (uid, date DESC);

CREATE TABLE IF NOT EXISTS debts (
  id            text PRIMARY KEY,
  uid           text NOT NULL REFERENCES users(uid) ON DELETE CASCADE,
  ledger_group  text NOT NULL CHECK (ledger_group IN ('primary', 'secondary')),
  name          text NOT NULL,
  category      text NOT NULL DEFAULT '',
  kind          text NOT NULL,
  balance       numeric(16, 2) NOT NULL,
  currency      text NOT NULL,
  notes         text,
  updated_at    timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS debts_uid_idx ON debts (uid);

CREATE TABLE IF NOT EXISTS salary_profiles (
  id             text PRIMARY KEY,
  uid            text NOT NULL REFERENCES users(uid) ON DELETE CASCADE,
  name           text NOT NULL,
  ledger_group   text NOT NULL CHECK (ledger_group IN ('primary', 'secondary')),
  amount         numeric(16, 2) NOT NULL,
  currency       text NOT NULL,
  effective_date date NOT NULL,
  pay_days       integer[],
  pay_day        integer,
  active         boolean NOT NULL DEFAULT true,
  updated_at     timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS salary_profiles_uid_idx ON salary_profiles (uid);
