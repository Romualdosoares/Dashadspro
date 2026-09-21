-- ============================================================
-- DashAds Pro — WhatsApp Reports Configuration
-- Run this in Supabase SQL editor
-- ============================================================

CREATE TABLE IF NOT EXISTS whatsapp_reports (
  id                uuid    PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id           uuid    REFERENCES auth.users ON DELETE CASCADE NOT NULL,
  phone             text    NOT NULL DEFAULT '',
  zapi_instance     text    NOT NULL DEFAULT '',
  zapi_token        text    NOT NULL DEFAULT '',
  schedule          text    NOT NULL DEFAULT 'manual'
                            CHECK (schedule IN ('manual','daily','weekly')),
  schedule_hours    int[]   NOT NULL DEFAULT ARRAY[11]
                            CHECK (cardinality(schedule_hours) <= 4
                              AND 0 <= ALL(schedule_hours)
                              AND 23 >= ALL(schedule_hours)),
  schedule_timezone text    NOT NULL DEFAULT 'America/Sao_Paulo',
  date_preset       text    NOT NULL DEFAULT 'today',
  enabled           boolean NOT NULL DEFAULT false,
  last_sent_at      timestamptz,
  created_at        timestamptz DEFAULT now(),
  updated_at        timestamptz DEFAULT now(),
  UNIQUE (user_id)
);

-- Row-Level Security
ALTER TABLE whatsapp_reports ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users manage own whatsapp config" ON whatsapp_reports;
CREATE POLICY "Users manage own whatsapp config"
  ON whatsapp_reports FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Auto-update updated_at
CREATE OR REPLACE FUNCTION update_whatsapp_reports_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_whatsapp_reports_updated_at ON whatsapp_reports;
CREATE TRIGGER trg_whatsapp_reports_updated_at
  BEFORE UPDATE ON whatsapp_reports
  FOR EACH ROW EXECUTE FUNCTION update_whatsapp_reports_updated_at();

ALTER FUNCTION update_whatsapp_reports_updated_at() SET search_path = public;
