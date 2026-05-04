-- Create images storage bucket for uploaded images
-- This script should be run in the Supabase SQL editor

-- Create the images storage bucket
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'images',
  'images',
  true,
  5242880, -- 5MB limit
  ARRAY['image/jpeg', 'image/png', 'image/gif', 'image/webp']
)
ON CONFLICT (id) DO NOTHING;

-- Create storage policies for the images bucket
-- Allow authenticated users to upload images
CREATE POLICY "Allow authenticated users to upload images" ON storage.objects
FOR INSERT WITH CHECK (
  bucket_id = 'images' 
  AND auth.role() = 'authenticated'
);

-- Allow public read access to images
CREATE POLICY "Allow public read access to images" ON storage.objects
FOR SELECT USING (bucket_id = 'images');

-- Allow users to update their own uploaded images
CREATE POLICY "Allow users to update their own images" ON storage.objects
FOR UPDATE USING (
  bucket_id = 'images' 
  AND auth.uid()::text = (storage.foldername(name))[1]
);

-- Allow users to delete their own uploaded images
CREATE POLICY "Allow users to delete their own images" ON storage.objects
FOR DELETE USING (
  bucket_id = 'images' 
  AND auth.uid()::text = (storage.foldername(name))[1]
);

-- Note: If policies already exist, you may need to drop them first:
-- DROP POLICY IF EXISTS "Allow authenticated users to upload images" ON storage.objects;
-- DROP POLICY IF EXISTS "Allow public read access to images" ON storage.objects;
-- DROP POLICY IF EXISTS "Allow users to update their own images" ON storage.objects;
-- DROP POLICY IF EXISTS "Allow users to delete their own images" ON storage.objects; 