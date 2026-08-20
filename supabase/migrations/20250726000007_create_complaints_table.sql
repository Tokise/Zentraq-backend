-- Create complaints table for storing custom complaint types
CREATE TABLE IF NOT EXISTS public.complaints (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    name TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_complaints_name ON public.complaints(name);

-- Create index for ordering by creation date
CREATE INDEX IF NOT EXISTS idx_complaints_created_at ON public.complaints(created_at DESC);

-- Enable Row Level Security
ALTER TABLE public.complaints ENABLE ROW LEVEL SECURITY;

-- Create policy for reading complaints (all authenticated users can read)
CREATE POLICY "Allow read access to complaints" ON public.complaints
    FOR SELECT USING (auth.role() = 'authenticated');

-- Create policy for inserting complaints (all authenticated users can insert)
CREATE POLICY "Allow insert access to complaints" ON public.complaints
    FOR INSERT WITH CHECK (auth.role() = 'authenticated');

-- Create policy for updating complaints (admins only)
CREATE POLICY "Allow update access to complaints" ON public.complaints
    FOR UPDATE USING (auth.role() = 'authenticated');

-- Create policy for deleting complaints (admins only)
CREATE POLICY "Allow delete access to complaints" ON public.complaints
    FOR DELETE USING (auth.role() = 'authenticated');

-- Grant table-level privileges to authenticated role (required for RLS to work)
GRANT SELECT, INSERT, UPDATE, DELETE ON public.complaints TO authenticated;

-- Insert default complaints
INSERT INTO public.complaints (name) VALUES
    ('General Checkup'),
    ('Fever'),
    ('Headache'),
    ('Cough / Colds'),
    ('Sore Throat'),
    ('Stomach Ache'),
    ('Injury / Cuts'),
    ('Skin Problem'),
    ('Eye Problem'),
    ('Allergic Reaction'),
    ('Dental')
ON CONFLICT DO NOTHING;