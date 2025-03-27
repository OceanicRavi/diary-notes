/*
  # Update storage bucket and policies for mortgage documents

  1. Storage Bucket
    - Ensure `mortgage-docs` bucket exists
  2. Security
    - Enable RLS
    - Update policies for both anonymous and authenticated users
    - Handle existing policies gracefully
*/

-- Create a new storage bucket for mortgage documents
INSERT INTO storage.buckets (id, name)
VALUES ('mortgage-docs', 'mortgage-docs')
ON CONFLICT DO NOTHING;

-- Enable RLS
ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DO $$ 
BEGIN
    DROP POLICY IF EXISTS "Allow anonymous uploads" ON storage.objects;
    DROP POLICY IF EXISTS "Allow anonymous reads" ON storage.objects;
    DROP POLICY IF EXISTS "Users can upload files" ON storage.objects;
    DROP POLICY IF EXISTS "Users can read files" ON storage.objects;
END $$;

-- Create policy to allow anonymous uploads
CREATE POLICY "Allow anonymous uploads"
ON storage.objects
FOR INSERT
TO anon
WITH CHECK (bucket_id = 'mortgage-docs');

-- Create policy to allow anonymous reads
CREATE POLICY "Allow anonymous reads"
ON storage.objects
FOR SELECT
TO anon
USING (bucket_id = 'mortgage-docs');

-- Create policy to allow authenticated uploads
CREATE POLICY "Users can upload files"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'mortgage-docs');

-- Create policy to allow authenticated reads
CREATE POLICY "Users can read files"
ON storage.objects
FOR SELECT
TO authenticated
USING (bucket_id = 'mortgage-docs');