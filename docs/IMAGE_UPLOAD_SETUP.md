# Image Upload Setup for Insights

This document explains how to set up image upload functionality for the insights management system.

## Overview

The image upload feature allows admins to upload images directly when creating or editing insights, in addition to entering image URLs manually.

## Setup Instructions

### 1. Supabase Storage Bucket Setup

Run the following SQL script in your Supabase SQL editor:

```sql
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
```

### 2. Database Migration

Run the insights table migration:

```bash
# Execute the SQL script
psql -h your-supabase-host -U postgres -d postgres -f scripts/add-insights-table.sql
```

### 3. Features

#### Image Upload Component

- **File Upload**: Drag and drop or click to upload images
- **URL Input**: Manually enter image URLs
- **Preview**: Real-time preview of selected images
- **Validation**: File type and size validation (max 5MB)
- **Remove**: Easy removal of uploaded images

#### Supported Formats

- JPEG (.jpg, .jpeg)
- PNG (.png)
- GIF (.gif)
- WebP (.webp)

#### File Size Limits

- Maximum file size: 5MB
- Optimized for web performance

### 4. Usage

#### For Admins

1. Navigate to `/admin/insights`
2. Click "Add Insight" or edit an existing insight
3. Use the "Post Image" field to:
   - Upload an image file directly
   - Enter an image URL manually
4. Preview the image before saving
5. Remove the image if needed

#### For Users

- Images are displayed on the `/insights` page
- Responsive design adapts to different screen sizes
- Fallback handling for broken image URLs

### 5. API Endpoints

#### Upload Image

```
POST /api/upload-image
Content-Type: multipart/form-data

Parameters:
- file: Image file
- type: "insight" (for insights)
```

#### Response

```json
{
  "url": "https://your-project.supabase.co/storage/v1/object/public/images/insights/user-id/filename.jpg",
  "path": "insights/user-id/filename.jpg"
}
```

### 6. Security

- **Authentication Required**: Only authenticated users can upload images
- **File Type Validation**: Only image files are accepted
- **Size Limits**: 5MB maximum file size
- **User Isolation**: Users can only access their own uploaded images
- **Public Read Access**: Images are publicly readable for display

### 7. Storage Structure

```
images/
├── insights/
│   └── {user-id}/
│       ├── {uuid1}.jpg
│       ├── {uuid2}.png
│       └── ...
└── uploads/
    └── {user-id}/
        └── ...
```

### 8. Troubleshooting

#### Common Issues

1. **"Bucket not found" error**

   - Ensure the `images` bucket is created in Supabase
   - Run the storage setup SQL script

2. **Upload fails**

   - Check file size (must be < 5MB)
   - Verify file type is supported
   - Ensure user is authenticated

3. **Images not displaying**
   - Check if the image URL is accessible
   - Verify storage policies are set correctly
   - Check browser console for errors

#### Debug Steps

1. Check Supabase Storage dashboard
2. Verify storage policies
3. Test with a small image file
4. Check network tab for upload requests
5. Verify authentication status

### 9. Customization

#### Modify File Size Limit

Update the `file_size_limit` in the storage bucket creation:

```sql
UPDATE storage.buckets
SET file_size_limit = 10485760  -- 10MB
WHERE id = 'images';
```

#### Add More File Types

Update the `allowed_mime_types` array:

```sql
UPDATE storage.buckets
SET allowed_mime_types = ARRAY['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml']
WHERE id = 'images';
```

#### Change Storage Path

Modify the file path in `/api/upload-image/route.ts`:

```typescript
const folderPath = type === "insight" ? "blog-images" : "uploads";
```

## Support

For issues or questions about the image upload functionality, please check:

1. Supabase Storage documentation
2. Network tab for API errors
3. Browser console for JavaScript errors
4. Supabase logs for server-side issues
