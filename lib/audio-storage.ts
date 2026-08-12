import { supabase } from "@/lib/supabase";

/**
 * Uploads base64 or blob audio data to Supabase Storage bucket 'speaking-recordings'
 * and returns the public HTTP URL.
 */
export async function uploadAudioToSupabaseStorage(
  audioData: string,
  submissionId: string,
  questionId: string
): Promise<string> {
  if (!audioData || typeof audioData !== "string") return audioData;

  // If already an HTTP/HTTPS URL, return directly
  if (audioData.startsWith("http://") || audioData.startsWith("https://")) {
    return audioData;
  }

  try {
    const bucketName = "speaking-recordings";

    // Ensure bucket exists or handle upload directly
    let fileBuffer: Uint8Array | Blob;
    let contentType = "audio/webm";

    if (audioData.startsWith("data:")) {
      const match = audioData.match(/^data:(audio\/[a-zA-Z0-9]+);base64,(.+)$/);
      if (match) {
        contentType = match[1];
        const base64Str = match[2];
        const binaryStr = atob(base64Str);
        const bytes = new Uint8Array(binaryStr.length);
        for (let i = 0; i < binaryStr.length; i++) {
          bytes[i] = binaryStr.charCodeAt(i);
        }
        fileBuffer = bytes;
      } else {
        return audioData;
      }
    } else {
      return audioData;
    }

    const fileExt = contentType.includes("mp3") ? "mp3" : "webm";
    const filePath = `${submissionId}/${questionId}_${Date.now()}.${fileExt}`;

    const { data: uploadData, error: uploadError } = await supabase.storage
      .from(bucketName)
      .upload(filePath, fileBuffer, {
        contentType,
        upsert: true,
      });

    if (uploadError) {
      console.warn(`Supabase Storage upload note for bucket '${bucketName}':`, uploadError.message);
      // Fallback: return data URL if storage upload fails or bucket is not public
      return audioData;
    }

    const { data: publicUrlData } = supabase.storage
      .from(bucketName)
      .getPublicUrl(uploadData.path);

    return publicUrlData.publicUrl;
  } catch (err) {
    console.error("Failed to upload audio to Supabase Storage:", err);
    return audioData;
  }
}
