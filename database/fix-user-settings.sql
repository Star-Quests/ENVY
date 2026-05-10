-- AUTO-FIX: User Settings Table Fix
-- Run this in Supabase SQL Editor

DROP TABLE IF EXISTS public.user_settings CASCADE;

CREATE TABLE public.user_settings (
    user_id UUID PRIMARY KEY,
    theme TEXT DEFAULT 'dark',
    accent_color TEXT DEFAULT '#9CA3AF',
    trading_mode TEXT DEFAULT 'spot',
    sound_enabled BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE public.user_settings DISABLE ROW LEVEL SECURITY;

GRANT ALL ON public.user_settings TO authenticated;
GRANT ALL ON public.user_settings TO anon;
GRANT ALL ON public.user_settings TO service_role;

SELECT 'User settings table fixed!' as result;
