import crypto from "crypto";
import { NextResponse } from "next/server";
import { requireRole } from "@/lib/api-auth";
import { getServerSupabaseClient } from "@/lib/supabase-server";

const ALLOWED_IMAGE_TYPES = new Set([
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/gif",
]);

function getExtensionFromMime(mime: string): string {
  const m = mime.toLowerCase();
  if (m === "image/jpeg") return "jpg";
  if (m === "image/png") return "png";
  if (m === "image/webp") return "webp";
  if (m === "image/gif") return "gif";
  if (m === "audio/webm") return "webm";
  if (m === "audio/mpeg" || m === "audio/mp3") return "mp3";
  if (m === "audio/wav" || m === "audio/x-wav" || m === "audio/wave") return "wav";
  if (m === "audio/ogg") return "ogg";
  if (m === "audio/m4a" || m === "audio/x-m4a" || m === "audio/mp4") return "m4a";

  const sub = m.split("/")[1] || "bin";
  return sub.replace(/[^a-z0-9]/gi, "") || "bin";
}

export async function POST(req: Request) {
  // Yêu cầu đăng nhập dòng đầu tiên
  const auth = await requireRole(["ADMIN", "TEACHER", "STUDENT"]);
  if (auth.error) return auth.error;
  const { user } = auth;

  try {
    let formData: FormData;
    try {
      formData = await req.formData();
    } catch {
      return NextResponse.json(
        { success: false, error: "Yêu cầu phải là multipart form data" },
        { status: 400 }
      );
    }

    const kind = formData.get("kind");
    const file = formData.get("file");

    if (
      !kind ||
      typeof kind !== "string" ||
      !["audio", "image", "speaking"].includes(kind)
    ) {
      return NextResponse.json(
        { success: false, error: "Loại upload (kind) không hợp lệ" },
        { status: 400 }
      );
    }

    // Kiểm tra quyền theo từng loại kind
    if (kind === "audio" || kind === "image") {
      if (user.role !== "ADMIN" && user.role !== "TEACHER") {
        return NextResponse.json(
          { success: false, error: "Bạn không có quyền upload loại file này" },
          { status: 403 }
        );
      }
    } else if (kind === "speaking") {
      if (user.role !== "STUDENT" && user.role !== "ADMIN" && user.role !== "TEACHER") {
        return NextResponse.json(
          { success: false, error: "Bạn không có quyền upload loại file này" },
          { status: 403 }
        );
      }
    }

    if (!file || !(file instanceof File)) {
      return NextResponse.json(
        { success: false, error: "Thiếu file upload" },
        { status: 400 }
      );
    }

    let bucket = "";
    let maxSizeBytes = 0;
    const fileType = file.type.toLowerCase();

    if (kind === "audio") {
      bucket = "audio-assets";
      maxSizeBytes = 15 * 1024 * 1024;
      if (!fileType.startsWith("audio/")) {
        return NextResponse.json(
          { success: false, error: "Loại file âm thanh không hợp lệ" },
          { status: 400 }
        );
      }
    } else if (kind === "image") {
      bucket = "flashcard-assets";
      maxSizeBytes = 5 * 1024 * 1024;
      if (!ALLOWED_IMAGE_TYPES.has(fileType)) {
        return NextResponse.json(
          { success: false, error: "Loại file ảnh không hợp lệ" },
          { status: 400 }
        );
      }
    } else if (kind === "speaking") {
      bucket = "speaking-recordings";
      maxSizeBytes = 15 * 1024 * 1024;
      if (!fileType.startsWith("audio/")) {
        return NextResponse.json(
          { success: false, error: "Loại file audio speaking không hợp lệ" },
          { status: 400 }
        );
      }
    }

    if (file.size > maxSizeBytes) {
      return NextResponse.json(
        { success: false, error: "Dung lượng file vượt quá giới hạn cho phép" },
        { status: 400 }
      );
    }

    const ext = getExtensionFromMime(fileType);
    const fileName = `${Date.now()}_${crypto.randomUUID()}.${ext}`;
    const path = `${user.userId}/${fileName}`;

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    const supabase = getServerSupabaseClient();
    const { error: uploadError } = await supabase.storage
      .from(bucket)
      .upload(path, buffer, {
        contentType: file.type,
        upsert: false,
      });

    if (uploadError) {
      console.error("Supabase Storage upload error:", uploadError.message);
      return NextResponse.json(
        { success: false, error: uploadError.message },
        { status: 502 }
      );
    }

    const { data: publicUrlData } = supabase.storage
      .from(bucket)
      .getPublicUrl(path);

    return NextResponse.json(
      {
        success: true,
        url: publicUrlData.publicUrl,
        path,
      },
      { status: 201 }
    );
  } catch (err: any) {
    console.error("POST /api/uploads error:", err);
    return NextResponse.json(
      { success: false, error: err.message || "Lỗi xử lý file upload" },
      { status: 500 }
    );
  }
}
