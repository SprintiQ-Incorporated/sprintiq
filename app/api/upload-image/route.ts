import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient, getAuthUser } from "@/lib/supabase/server";
import { v4 as uuidv4 } from "uuid";
import { verifyCsrfToken } from "@/lib/csrf-protection";

export async function POST(request: NextRequest) {
  try {
    // =========================================================================
    // 0. VERIFY CSRF TOKEN
    // =========================================================================
    const csrfValid = await verifyCsrfToken(request);
    if (!csrfValid) {
      return NextResponse.json(
        { error: "Invalid CSRF token" },
        { status: 403 }
      );
    }

    const supabase = await createServerSupabaseClient();

    const { user } = await getAuthUser(supabase);

    if (!user) {
      return NextResponse.json({ success: false, message: "User not authenticated." }, { status: 401 });
    }
    const formData = await request.formData();
    const file = formData.get("file") as File;
    const type = formData.get("type") as string;

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    // Validate file MIME type
    if (!file.type.startsWith("image/")) {
      return NextResponse.json(
        { error: "File must be an image" },
        { status: 400 }
      );
    }

    // Validate file extension against whitelist
    const allowedExtensions = ["jpg", "jpeg", "png", "gif", "webp", "svg"];
    const fileExtension = file.name.split(".").pop()?.toLowerCase();
    if (!fileExtension || !allowedExtensions.includes(fileExtension)) {
      return NextResponse.json(
        { error: `Invalid file extension. Allowed: ${allowedExtensions.join(", ")}` },
        { status: 400 }
      );
    }

    // Validate type parameter
    const allowedTypes = ["insight", "uploads"];
    if (type && !allowedTypes.includes(type)) {
      return NextResponse.json(
        { error: `Invalid upload type. Allowed: ${allowedTypes.join(", ")}` },
        { status: 400 }
      );
    }

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      return NextResponse.json(
        { error: "File size must be less than 5MB" },
        { status: 400 }
      );
    }

    // Generate unique filename
    const fileName = `${uuidv4()}.${fileExtension}`;

    // Create folder structure based on type
    const folderPath = type === "insight" ? "insights" : "uploads";
    const filePath = `${folderPath}/${user.id}/${fileName}`;

    // Upload to Supabase Storage
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from("images")
      .upload(filePath, file, {
        cacheControl: "3600",
        upsert: true,
      });

    if (uploadError) {
      console.error("Error uploading image:", uploadError);

      // Provide helpful error message for missing bucket
      if (uploadError.message?.includes("Bucket not found")) {
        return NextResponse.json(
          {
            error:
              "Storage bucket not configured. Please contact your administrator to set up the 'images' storage bucket in Supabase.",
          },
          { status: 500 }
        );
      }

      return NextResponse.json(
        { error: `Error uploading image: ${uploadError.message}` },
        { status: 500 }
      );
    }

    // Get public URL
    const { data: publicUrlData } = supabase.storage
      .from("images")
      .getPublicUrl(filePath);

    return NextResponse.json({
      url: publicUrlData.publicUrl,
      path: filePath,
    });
  } catch (error) {
    console.error("Error in upload-image:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
