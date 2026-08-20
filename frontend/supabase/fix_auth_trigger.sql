-- Fix for Supabase "Database error creating new user" (HTTP 500 / AuthRetryableFetchError)
-- Run this script in your Supabase Dashboard -> SQL Editor (https://supabase.com/dashboard/project/rhjnhwlkfegqbimgumxn/sql/new)

-- 1. Drop any broken triggers on auth.users
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP TRIGGER IF EXISTS handle_new_user_trigger ON auth.users;
DROP TRIGGER IF EXISTS on_auth_user_created_profile ON auth.users;

-- 2. Drop the trigger function that references missing tables (e.g., public.profiles)
DROP FUNCTION IF EXISTS public.handle_new_user();
DROP FUNCTION IF EXISTS public.handle_new_user_profile();
