-- ============================================================
-- Our Home / Naqisna - Minimal Supabase Schema (blob model)
-- المطلوب فقط: app_homes + admin_ads
-- نفّذ مرة واحدة في Supabase SQL Editor
-- ============================================================

-- 0) حذف أي جداول غير مطلوبة (النموذج القديم + جداول غير مستخدمة)
DROP TABLE IF EXISTS public.orders CASCADE;
DROP TABLE IF EXISTS public.expenses CASCADE;
DROP TABLE IF EXISTS public.notifications CASCADE;
DROP TABLE IF EXISTS public.order_lists CASCADE;
DROP TABLE IF EXISTS public.profiles CASCADE;
DROP TABLE IF EXISTS public.homes CASCADE;
DROP TABLE IF EXISTS public.admin_jokes CASCADE;
DROP TABLE IF EXISTS public.audio_items CASCADE;
DROP TABLE IF EXISTS public.comedy_messages CASCADE;
DROP TABLE IF EXISTS public.members CASCADE;
DROP TABLE IF EXISTS public.users CASCADE;
DROP TABLE IF EXISTS public.ads CASCADE;

-- 1) جدول المزامنة الأساسي (كل بيانات البيت كـ JSONB)
CREATE TABLE IF NOT EXISTS public.app_homes (
  code TEXT PRIMARY KEY,
  data JSONB NOT NULL DEFAULT '{}'::jsonb,
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 2) جدول إعلانات الأدمن (مستخدم فعلياً في admin.html)
CREATE TABLE IF NOT EXISTS public.admin_ads (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  image TEXT,
  link TEXT,
  position TEXT DEFAULT 'top',
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================================
-- RLS + Grants (آمن لإعادة التشغيل)
-- ============================================================
ALTER TABLE public.app_homes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_ads ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public App Homes Access" ON public.app_homes;
CREATE POLICY "Public App Homes Access" ON public.app_homes
  FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Public Ads Access" ON public.admin_ads;
CREATE POLICY "Public Ads Access" ON public.admin_ads
  FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

GRANT USAGE ON SCHEMA public TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.app_homes TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.admin_ads TO anon, authenticated;

-- ============================================================
-- Realtime (المزامنة اللحظية للطلبات)
-- ============================================================
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'app_homes') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.app_homes;
  END IF;
END $$;
