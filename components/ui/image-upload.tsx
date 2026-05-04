"use client";

import React, { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Upload, X, Image as ImageIcon, Loader2 } from "lucide-react";
import Image from "next/image";
import { csrfFetch } from "@/hooks/useCsrfFetch";

interface ImageUploadProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  label?: string;
  className?: string;
  disabled?: boolean;
}

export function ImageUpload({
  value,
  onChange,
  placeholder = "Upload an image or enter URL",
  label = "Image",
  className = "",
  disabled = false,
}: ImageUploadProps) {
  const [isUploading, setIsUploading] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string>(value);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = async (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith("image/")) {
      alert("Please select an image file");
      return;
    }

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      alert("File size must be less than 5MB");
      return;
    }

    setIsUploading(true);

    try {
      // Create FormData for upload
      const formData = new FormData();
      formData.append("file", file);
      formData.append("type", "insight");

      // Upload to our API
      const response = await csrfFetch("/api/upload-image", {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        throw new Error("Upload failed");
      }

      const data = await response.json();

      if (data.url) {
        setPreviewUrl(data.url);
        onChange(data.url);
      } else {
        throw new Error("No URL returned from upload");
      }
    } catch (error) {
      console.error("Upload error:", error);
      alert("Failed to upload image. Please try again or use a URL instead.");
    } finally {
      setIsUploading(false);
    }
  };

  const handleUrlChange = (url: string) => {
    setPreviewUrl(url);
    onChange(url);
  };

  const handleRemoveImage = () => {
    setPreviewUrl("");
    onChange("");
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  return (
    <div className={`space-y-4 ${className}`}>
      <Label>{label}</Label>

      {/* Image Preview */}
      {previewUrl && (
        <div className="relative w-full h-48 border rounded-lg overflow-hidden bg-gray-100">
          <Image
            src={previewUrl}
            alt="Preview"
            fill
            className="object-cover"
            onError={() => setPreviewUrl("")}
          />
          <Button
            type="button"
            variant="destructive"
            size="sm"
            className="absolute top-2 right-2"
            onClick={handleRemoveImage}
            disabled={disabled}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      )}

      {/* Upload Controls */}
      <div className="space-y-3">
        {/* File Upload */}
        <div className="flex items-center gap-3">
          <Input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={handleFileSelect}
            className="hidden"
            disabled={disabled}
          />
          <Button
            type="button"
            variant="outline"
            onClick={() => fileInputRef.current?.click()}
            disabled={disabled || isUploading}
            className="flex items-center gap-2"
          >
            {isUploading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Upload className="h-4 w-4" />
            )}
            {isUploading ? "Uploading..." : "Upload Image"}
          </Button>
          <span className="text-sm text-muted-foreground">
            Max 5MB, JPG, PNG, GIF
          </span>
        </div>

        {/* URL Input */}
        <div className="flex items-center gap-2">
          <ImageIcon className="h-4 w-4 text-muted-foreground" />
          <Input
            type="url"
            placeholder={placeholder}
            value={previewUrl}
            onChange={(e) => handleUrlChange(e.target.value)}
            disabled={disabled}
            className="flex-1"
          />
        </div>
      </div>
    </div>
  );
}
