-- ENVY Trading Journal Database Schema
-- Execute this in Supabase SQL Editor

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- USERS TABLE (Extends Supabase auth.users)
CREATE TABLE public.profiles (
    id UUID REFERENCES auth.users ON DELETE CASCADE PRIMARY KEY,
    email TEXT UNIQUE NOT NULL,
    full_name TEXT,
    avatar_url TEXT,
    role TEXT DEFAULT 'user' CHECK (role IN ('user', 'admin')),
    emblem_type TEXT DEFAULT 'neutral',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- USER SETTINGS TABLE (Per-user customization)
CREATE TABLE public.user_settings (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE UNIQUE,
    
    -- Appearance
    theme TEXT DEFAULT 'dark',
    accent_color TEXT DEFAULT '#9CA3AF',
    font_style TEXT DEFAULT 'Inter',
    font_size TEXT DEFAULT 'medium',
    glass_intensity INTEGER DEFAULT 50,
    border_radius INTEGER DEFAULT 8,
    layout_density TEXT DEFAULT 'comfortable',
    
    -- Sidebar
    sidebar_collapsed BOOLEAN DEFAULT FALSE,
    
    -- Trading Mode
    trading_mode TEXT DEFAULT 'spot' CHECK (trading_mode IN ('spot', 'futures')),
    
    -- Data Entry
    default_form_mode TEXT DEFAULT 'simple',
    auto_clear_form BOOLEAN DEFAULT TRUE,
    default_fee_rate DECIMAL(5,2) DEFAULT 0.1,
    decimal_precision INTEGER DEFAULT 2,
    
    -- Timer Settings
    timer_format TEXT DEFAULT 'full',
    trade_age_color BOOLEAN DEFAULT TRUE,
    
    -- Dashboard
    holdings_sort TEXT DEFAULT 'highest_value',
    row_highlighting BOOLEAN DEFAULT TRUE,
    animation_intensity INTEGER DEFAULT 50,
    
    -- Crypto Preferences
    favorite_assets TEXT[] DEFAULT ARRAY['BTC', 'ETH', 'SOL'],
    
    -- Account
    profile_visibility TEXT DEFAULT 'private',
    export_format TEXT DEFAULT 'csv',
    
    -- Planner
    retracement_unit TEXT DEFAULT 'percentage',
    
    -- Notifications
    sound_enabled BOOLEAN DEFAULT TRUE,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- TRADES TABLE (Journal entries)
CREATE TABLE public.trades (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    
    -- Trade Details
    asset_symbol TEXT NOT NULL,
    asset_logo TEXT,
    trade_type TEXT CHECK (trade_type IN ('buy', 'sell')),
    amount DECIMAL(20,8) NOT NULL,
    entry_price DECIMAL(20,8) NOT NULL,
    exit_price DECIMAL(20,8),
    fee DECIMAL(20,8) DEFAULT 0,
    
    -- Calculated Fields
    profit_loss DECIMAL(20,8),
    profit_loss_percentage DECIMAL(10,2),
    trade_duration INTERVAL,
    
    -- Status & Timers
    status TEXT DEFAULT 'open' CHECK (status IN ('open', 'closed', 'paused')),
    started_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    ended_at TIMESTAMP WITH TIME ZONE,
    paused_at TIMESTAMP WITH TIME ZONE,
    
    -- Additional Info
    notes TEXT,
    tags TEXT[],
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- PORTFOLIO HOLDINGS TABLE
CREATE TABLE public.holdings (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    
    asset_symbol TEXT NOT NULL,
    asset_logo TEXT,
    total_amount DECIMAL(20,8) NOT NULL DEFAULT 0,
    average_cost DECIMAL(20,8) NOT NULL DEFAULT 0,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    UNIQUE(user_id, asset_symbol)
);

-- PLANNER ANALYSES TABLE
CREATE TABLE public.planner_analyses (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    
    asset_symbol TEXT NOT NULL,
    entry_price DECIMAL(20,8) NOT NULL,
    amount DECIMAL(20,8) NOT NULL,
    profit_target DECIMAL(20,8) NOT NULL,
    loss_tolerance DECIMAL(20,8) NOT NULL,
    
    -- Calculated Results
    take_profit_price DECIMAL(20,8),
    stop_loss_price DECIMAL(20,8),
    potential_profit DECIMAL(20,8),
    potential_loss DECIMAL(20,8),
    risk_reward_ratio DECIMAL(10,2),
    roi_percentage DECIMAL(10,2),
    
    -- Trailing Stop Options (JSON)
    trailing_stop_options JSONB,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ADMIN ACTIONS LOG
CREATE TABLE public.admin_logs (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    admin_id UUID REFERENCES public.profiles(id),
    action_type TEXT NOT NULL,
    target_user_id UUID REFERENCES public.profiles(id),
    details JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- WEBSITE SETTINGS (Admin controlled)
CREATE TABLE public.website_settings (
    id INTEGER PRIMARY KEY DEFAULT 1,
    site_emblem_url TEXT,
    maintenance_mode BOOLEAN DEFAULT FALSE,
    updated_by UUID REFERENCES public.profiles(id),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- CONNECTION STATUS TABLE (For monitoring)
CREATE TABLE public.connection_status (
    id INTEGER PRIMARY KEY DEFAULT 1,
    status TEXT DEFAULT 'connected' CHECK (status IN ('connected', 'connecting', 'disconnected')),
    last_ping TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX idx_trades_user_id ON public.trades(user_id);
CREATE INDEX idx_trades_status ON public.trades(status);
CREATE INDEX idx_trades_asset ON public.trades(asset_symbol);
CREATE INDEX idx_holdings_user_id ON public.holdings(user_id);
CREATE INDEX idx_planner_user_id ON public.planner_analyses(user_id);

-- ROW LEVEL SECURITY POLICIES

-- Profiles: Users can read all, update only their own
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view all profiles"
    ON public.profiles FOR SELECT
    USING (true);

CREATE POLICY "Users can update own profile"
    ON public.profiles FOR UPDATE
    USING (auth.uid() = id);

CREATE POLICY "Only admins can insert/delete profiles"
    ON public.profiles FOR ALL
    USING (EXISTS (
        SELECT 1 FROM public.profiles
        WHERE id = auth.uid() AND role = 'admin'
    ));

-- User Settings: Full control for own settings
ALTER TABLE public.user_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own settings"
    ON public.user_settings FOR ALL
    USING (auth.uid() = user_id);

-- Trades: Full control for own trades
ALTER TABLE public.trades ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own trades"
    ON public.trades FOR ALL
    USING (auth.uid() = user_id);

-- Holdings: Full control for own holdings
ALTER TABLE public.holdings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own holdings"
    ON public.holdings FOR ALL
    USING (auth.uid() = user_id);

-- Admin Logs: Only admins can view
ALTER TABLE public.admin_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Only admins can view logs"
    ON public.admin_logs FOR SELECT
    USING (EXISTS (
        SELECT 1 FROM public.profiles
        WHERE id = auth.uid() AND role = 'admin'
    ));

-- Website Settings: Anyone can view, only admins can modify
ALTER TABLE public.website_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view website settings"
    ON public.website_settings FOR SELECT
    USING (true);

CREATE POLICY "Only admins can modify website settings"
    ON public.website_settings FOR ALL
    USING (EXISTS (
        SELECT 1 FROM public.profiles
        WHERE id = auth.uid() AND role = 'admin'
    ));

-- FUNCTIONS & TRIGGERS

-- Auto-update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_profiles_updated_at
    BEFORE UPDATE ON public.profiles
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_user_settings_updated_at
    BEFORE UPDATE ON public.user_settings
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_trades_updated_at
    BEFORE UPDATE ON public.trades
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.profiles (id, email, full_name, avatar_url)
    VALUES (NEW.id, NEW.email, NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'avatar_url');
    
    INSERT INTO public.user_settings (user_id)
    VALUES (NEW.id);
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_new_user();

-- Calculate trade P/L function
CREATE OR REPLACE FUNCTION calculate_trade_pl()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.exit_price IS NOT NULL AND NEW.entry_price IS NOT NULL THEN
        IF NEW.trade_type = 'buy' THEN
            NEW.profit_loss = (NEW.exit_price - NEW.entry_price) * NEW.amount;
        ELSE
            NEW.profit_loss = (NEW.entry_price - NEW.exit_price) * NEW.amount;
        END IF;
        
        NEW.profit_loss_percentage = (NEW.profit_loss / (NEW.entry_price * NEW.amount)) * 100;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER calculate_pl_on_update
    BEFORE UPDATE ON public.trades
    FOR EACH ROW
    EXECUTE FUNCTION calculate_trade_pl();