-- ════════════════════════════════════════════════════════════════
-- DashAds Pro — Setup do Banco de Dados Supabase
-- Execute este arquivo no SQL Editor do painel Supabase
-- https://supabase.com/dashboard/project/odbivlazrsrmvljxkqde/sql
-- ════════════════════════════════════════════════════════════════

-- 1. Extensão para criptografia de tokens
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ────────────────────────────────────────────────────────────────
-- 2. Tabela: profiles
-- Criada automaticamente quando um usuário se registra
-- ────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.profiles (
  id          UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  name        TEXT,
  email       TEXT,
  avatar_url  TEXT,
  plan        TEXT NOT NULL DEFAULT 'free',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Trigger: cria profile automaticamente ao criar usuário
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, name, email, avatar_url)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name'),
    NEW.email,
    NEW.raw_user_meta_data->>'avatar_url'
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ────────────────────────────────────────────────────────────────
-- 3. Tabela: facebook_tokens
-- Armazena o access_token do Facebook criptografado
-- ────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.facebook_tokens (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id                 UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  facebook_user_id        TEXT NOT NULL,
  access_token_encrypted  TEXT NOT NULL,
  token_expires_at        TIMESTAMPTZ,
  scopes                  TEXT[],
  created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id)
);

-- ────────────────────────────────────────────────────────────────
-- 4. Tabela: ad_accounts
-- Contas de anúncio Meta vinculadas ao usuário
-- ────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.ad_accounts (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id           UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  meta_account_id   TEXT NOT NULL,
  meta_account_name TEXT NOT NULL,
  business_id       TEXT,
  business_name     TEXT,
  currency          TEXT,
  account_status    INTEGER,
  is_selected       BOOLEAN NOT NULL DEFAULT FALSE,
  last_synced_at    TIMESTAMPTZ,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, meta_account_id)
);

-- ────────────────────────────────────────────────────────────────
-- 5. Row Level Security (RLS)
-- Cada usuário só acessa seus próprios dados
-- ────────────────────────────────────────────────────────────────

-- profiles
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
CREATE POLICY "Users can view own profile"
  ON public.profiles FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Users can update own profile"
  ON public.profiles FOR UPDATE USING (auth.uid() = id);

-- facebook_tokens
ALTER TABLE public.facebook_tokens ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can manage own tokens" ON public.facebook_tokens;
CREATE POLICY "Users can manage own tokens"
  ON public.facebook_tokens FOR ALL USING (auth.uid() = user_id);

-- ad_accounts
ALTER TABLE public.ad_accounts ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can manage own ad accounts" ON public.ad_accounts;
CREATE POLICY "Users can manage own ad accounts"
  ON public.ad_accounts FOR ALL USING (auth.uid() = user_id);

-- ────────────────────────────────────────────────────────────────
-- 6. Funções para criptografia de tokens do Facebook
-- ────────────────────────────────────────────────────────────────

-- Criptografa um token com uma chave
CREATE OR REPLACE FUNCTION public.encrypt_token(token TEXT, key TEXT)
RETURNS TEXT AS $$
BEGIN
  RETURN encode(pgp_sym_encrypt(token, key)::bytea, 'base64');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Descriptografa um token com uma chave
CREATE OR REPLACE FUNCTION public.decrypt_token(encrypted_token TEXT, key TEXT)
RETURNS TEXT AS $$
BEGIN
  RETURN pgp_sym_decrypt(decode(encrypted_token, 'base64')::bytea, key);
EXCEPTION WHEN OTHERS THEN
  RETURN encrypted_token; -- fallback: retorna o valor original se falhar
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ────────────────────────────────────────────────────────────────
-- 7. Índices para performance
-- ────────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_facebook_tokens_user_id ON public.facebook_tokens(user_id);
CREATE INDEX IF NOT EXISTS idx_ad_accounts_user_id ON public.ad_accounts(user_id);
CREATE INDEX IF NOT EXISTS idx_ad_accounts_selected ON public.ad_accounts(user_id, is_selected) WHERE is_selected = TRUE;
