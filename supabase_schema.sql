-- ==============================================================================
-- Student Face Dataset Collection PWA — Supabase Database & Storage Setup
-- Copy and paste this script into your Supabase project's SQL Editor and click RUN.
-- ==============================================================================

-- 1. Create the Students Table
CREATE TABLE IF NOT EXISTS public.students (
    reg_no TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    dept TEXT NOT NULL DEFAULT 'IT',
    section TEXT NOT NULL DEFAULT 'A',
    email TEXT,
    photo_urls JSONB DEFAULT '{}'::jsonb,
    quality_scores JSONB DEFAULT '{}'::jsonb,
    status TEXT DEFAULT 'complete',
    device_info TEXT,
    created_at TIMESTAMPTZ DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- 2. Enable Row Level Security (RLS)
ALTER TABLE public.students ENABLE ROW LEVEL SECURITY;

-- 3. RLS Policies: Allow anyone with the anon key to Insert, Select, and Update records
DROP POLICY IF EXISTS "Allow anonymous insert on students" ON public.students;
CREATE POLICY "Allow anonymous insert on students"
ON public.students FOR INSERT
TO anon, authenticated
WITH CHECK (true);

DROP POLICY IF EXISTS "Allow anonymous select on students" ON public.students;
CREATE POLICY "Allow anonymous select on students"
ON public.students FOR SELECT
TO anon, authenticated
USING (true);

DROP POLICY IF EXISTS "Allow anonymous update on students" ON public.students;
CREATE POLICY "Allow anonymous update on students"
ON public.students FOR UPDATE
TO anon, authenticated
USING (true);

DROP POLICY IF EXISTS "Allow anonymous delete on students" ON public.students;
CREATE POLICY "Allow anonymous delete on students"
ON public.students FOR DELETE
TO anon, authenticated
USING (true);

-- 4. Create the 'student-faces' Storage Bucket
INSERT INTO storage.buckets (id, name, public)
VALUES ('student-faces', 'student-faces', true)
ON CONFLICT (id) DO UPDATE SET public = true;

-- 5. Storage Policies: Allow uploads and downloads for student-faces bucket
DROP POLICY IF EXISTS "Allow public uploads to student-faces" ON storage.objects;
CREATE POLICY "Allow public uploads to student-faces"
ON storage.objects FOR INSERT
TO anon, authenticated
WITH CHECK (bucket_id = 'student-faces');

DROP POLICY IF EXISTS "Allow public select from student-faces" ON storage.objects;
CREATE POLICY "Allow public select from student-faces"
ON storage.objects FOR SELECT
TO anon, authenticated
USING (bucket_id = 'student-faces');

DROP POLICY IF EXISTS "Allow public update in student-faces" ON storage.objects;
CREATE POLICY "Allow public update in student-faces"
ON storage.objects FOR UPDATE
TO anon, authenticated
USING (bucket_id = 'student-faces');

DROP POLICY IF EXISTS "Allow public delete in student-faces" ON storage.objects;
CREATE POLICY "Allow public delete in student-faces"
ON storage.objects FOR DELETE
TO anon, authenticated
USING (bucket_id = 'student-faces');
