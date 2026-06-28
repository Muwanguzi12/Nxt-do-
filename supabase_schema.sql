-- ====================================================================
-- SUPABASE DATABASE SCHEMA SETUP
-- Target Database: PostgreSQL / Supabase
-- Features: Email Magic Link Support, Real-Time Profiles, & Financial Ledger
-- Instructions: Copy and run this script in the Supabase SQL Editor (https://database.supabase.com)
-- ====================================================================

-- Enable UUID Extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- --------------------------------------------------------------------
-- 1. PROFILES TABLE
-- --------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    alias TEXT NOT NULL,
    email TEXT UNIQUE,
    phone TEXT,
    whatsapp TEXT,
    photo TEXT DEFAULT 'https://picsum.photos/seed/me/200/200',
    role TEXT NOT NULL DEFAULT 'VIEWER', -- 'VIEWER' or 'HOST'
    gender TEXT,
    interests TEXT[] DEFAULT '{}',
    category TEXT, -- e.g., 'Hookup', 'Callboy', 'Callgirl', 'Massage', etc.
    bio TEXT,
    age INTEGER,
    pesapal_key TEXT,
    pesapal_secret TEXT,
    pesapal_env TEXT DEFAULT 'sandbox',
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable Row Level Security (RLS) on Profiles
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Profiles RLS Policies:
-- 1. Anyone can view profiles (needed for discoverability/listing hosts)
CREATE POLICY "Public profiles are viewable by everyone" 
ON public.profiles FOR SELECT 
USING (true);

-- 2. Users can only update/insert their own profile
CREATE POLICY "Users can insert their own profile" 
ON public.profiles FOR INSERT 
WITH CHECK (auth.uid() = id);

CREATE POLICY "Users can update their own profile" 
ON public.profiles FOR UPDATE 
USING (auth.uid() = id) 
WITH CHECK (auth.uid() = id);


-- --------------------------------------------------------------------
-- 2. TRANSACTIONS TABLE (FINANCIAL LEDGER)
-- --------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.transactions (
    id TEXT PRIMARY KEY, -- Using frontend generated 'TXN-...' format or UUID
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    amount NUMERIC(12, 2) NOT NULL CHECK (amount >= 0),
    service_name TEXT NOT NULL, -- e.g. 'deposit', 'WHATSAPP_UNLOCK', etc.
    status TEXT NOT NULL DEFAULT 'Pending', -- 'Pending', 'Completed', 'Failed'
    provider TEXT NOT NULL DEFAULT 'PESAPAL',
    tracking_id TEXT, -- Pesapal orderTrackingId
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable Row Level Security (RLS) on Transactions
ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;

-- Transactions RLS Policies:
-- 1. Users can view their own financial ledger
CREATE POLICY "Users can view their own transactions" 
ON public.transactions FOR SELECT 
USING (auth.uid() = user_id);

-- 2. Users can log their own transactions
CREATE POLICY "Users can insert their own transactions" 
ON public.transactions FOR INSERT 
WITH CHECK (auth.uid() = user_id);

-- 3. System can update transactions (admins/triggers)
CREATE POLICY "Users can update their own transactions"
ON public.transactions FOR UPDATE
USING (auth.uid() = user_id);


-- --------------------------------------------------------------------
-- 3. AUTH USER SIGN-UP TRIGGER (MAGIC LINK & EMAIL SYNC)
-- --------------------------------------------------------------------
-- This trigger automatically handles Magic Link or standard email sign-ups by creating
-- a corresponding public.profiles entry with default metadata. When the user completes
-- their onboarding questionnaire, the frontend upserts/updates the remaining fields.

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
    default_alias TEXT;
BEGIN
    -- Coalesce fallback: Use the email username portion as the default alias
    default_alias := COALESCE(
        new.raw_user_meta_data->>'alias', 
        SPLIT_PART(new.email, '@', 1)
    );

    INSERT INTO public.profiles (
        id, 
        email, 
        phone,
        alias, 
        role, 
        photo, 
        updated_at
    )
    VALUES (
        new.id,
        new.email,
        new.phone,
        default_alias,
        COALESCE(new.raw_user_meta_data->>'role', 'VIEWER'),
        COALESCE(new.raw_user_meta_data->>'photo', 'https://picsum.photos/seed/me/200/200'),
        NOW()
    )
    ON CONFLICT (id) DO UPDATE SET
        email = COALESCE(excluded.email, public.profiles.email),
        phone = COALESCE(excluded.phone, public.profiles.phone),
        updated_at = NOW();
        
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Re-create the trigger on auth.users table
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW 
    EXECUTE PROCEDURE public.handle_new_user();

-- --------------------------------------------------------------------
-- 4. REAL-TIME REPLICATION CONFIGURATION
-- --------------------------------------------------------------------
-- Enable real-time updates for both tables if you wish to use live syncing
alter publication supabase_realtime add table public.profiles;
alter publication supabase_realtime add table public.transactions;
