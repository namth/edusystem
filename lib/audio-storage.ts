/**
 * Uploads base64 audio data to Supabase Storage via /api/uploads
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
    let contentType = "audio/webm";
    let blob: Blob;

    if (audioData.startsWith("data:")) {
      const match = audioData.match(/^data:(audio\/[a-zA-Z0-9.\-_+]+);base64,(.+)$/);
      if (match) {
        contentType = match[1];
        const base64Str = match[2];
        const binaryStr = atob(base64Str);
        const bytes = new Uint8Array(binaryStr.length);
        for (let i = 0; i < binaryStr.length; i++) {
          bytes[i] = binaryStr.charCodeAt(i);
        }
        blob = new Blob([bytes], { type: contentType });
      } else {
        return audioData;
      }
    } else {
      return audioData;
    }

    const fileExt = contentType.includes("mp3") ? "mp3" : "webm";
    const formData = new FormData();
    formData.append("kind", "speaking");
    formData.append("file", blob, `${submissionId}_${questionId}.${fileExt}`);

    const res = await fetch("/api/uploads", {
      method: "POST",
      body: formData,
    });

    if (!res.ok) {
      console.warn("Upload speaking audio failed with status:", res.status);
      return audioData;
    }

    const data = await res.json().catch(() => null);
    if (data?.success && data?.url) {
      return data.url;
    }

    return audioData;
  } catch (err) {
    console.error("Failed to upload audio to /api/uploads:", err);
    return audioData;
  }
}
