-- SQL Migration: Add queue_number column to public.consultations table
ALTER TABLE public.consultations 
ADD COLUMN IF NOT EXISTS queue_number text;
