/*
  # Create storage bucket for mortgage documents

  1. New Storage Bucket
    - `mortgage-docs` bucket for storing uploaded documents
  2. Security
    - Enable RLS on the bucket
    - Add policy for authenticated users to upload and read their own files
*/

-- Create a new storage bucket for mortgage documents
INSERT INTO storage.buckets (id, name)
VALUES ('mortgage-docs', 'mortgage-docs')
ON CONFLICT DO NOTHING;

-- Enable RLS
ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;

-- Create policy to allow authenticated users to upload files
CREATE POLICY "Users can upload files"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'mortgage-docs');

-- Create policy to allow authenticated users to read their own files
CREATE POLICY "Users can read own files"
ON storage.objects
FOR SELECT
TO authenticated
USING (bucket_id = 'mortgage-docs' AND auth.uid() = owner);