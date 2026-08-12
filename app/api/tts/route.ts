import { NextResponse } from "next/server";
import crypto from "crypto";

// Helper to encode strings to Base64URL
function base64UrlEncode(str: string): string {
  return Buffer.from(str)
    .toString("base64")
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");
}

// Generate Google Cloud OAuth2 Access Token using Service Account Private Key
async function getGcpAccessToken(clientEmail: string, privateKey: string): Promise<string | null> {
  try {
    const now = Math.floor(Date.now() / 1000);
    const header = { alg: "RS256", typ: "JWT" };
    const payload = {
      iss: clientEmail,
      scope: "https://www.googleapis.com/auth/cloud-platform",
      aud: "https://oauth2.googleapis.com/token",
      exp: now + 3600,
      iat: now,
    };

    const encodedHeader = base64UrlEncode(JSON.stringify(header));
    const encodedPayload = base64UrlEncode(JSON.stringify(payload));
    const unsignedToken = `${encodedHeader}.${encodedPayload}`;

    // Clean escaped newlines if passed in env
    const formattedPrivateKey = privateKey.replace(/\\n/g, "\n");

    const signer = crypto.createSign("RSA-SHA256");
    signer.update(unsignedToken);
    const signature = signer
      .sign(formattedPrivateKey, "base64")
      .replace(/=/g, "")
      .replace(/\+/g, "-")
      .replace(/\//g, "_");

    const jwt = `${unsignedToken}.${signature}`;

    const res = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
        assertion: jwt,
      }),
    });

    if (!res.ok) {
      console.warn("GCP OAuth2 Token fetch status:", res.status);
      return null;
    }

    const data = await res.json();
    return data.access_token || null;
  } catch (err) {
    console.error("GCP OAuth2 Token Exception:", err);
    return null;
  }
}

// Helper to wrap raw L16 PCM audio in a playable standard WAV container
function pcmToWav(pcmBuffer: Buffer, sampleRate: number = 24000): Buffer {
  const numChannels = 1;
  const bitsPerSample = 16;
  const byteRate = sampleRate * numChannels * (bitsPerSample / 8);
  const blockAlign = numChannels * (bitsPerSample / 8);
  const subChunk2Size = pcmBuffer.length;
  const chunkSize = 36 + subChunk2Size;

  const header = Buffer.alloc(44);

  header.write("RIFF", 0);
  header.writeUInt32LE(chunkSize, 4);
  header.write("WAVE", 8);
  header.write("fmt ", 12);
  header.writeUInt32LE(16, 16);
  header.writeUInt16LE(1, 20);
  header.writeUInt16LE(numChannels, 22);
  header.writeUInt32LE(sampleRate, 24);
  header.writeUInt32LE(byteRate, 28);
  header.writeUInt16LE(blockAlign, 32);
  header.writeUInt16LE(bitsPerSample, 34);
  header.write("data", 36);
  header.writeUInt32LE(subChunk2Size, 40);

  return Buffer.concat([header, pcmBuffer]);
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const text = searchParams.get("text") || "hello";
  const gender = searchParams.get("gender") || "Female";
  let langParam = searchParams.get("lang");

  // Language Detection (Vietnamese vs English)
  const hasViChars = /[àáảãạăắằẳẵặâấầẩẫậèéẻẽẹêếềểễệđìíỉĩịòóỏõọôốồổỗộơớờởỡợùúủũụưứừửữựỳýỷỹỵ]/i.test(text);
  const hasCommonViWords = /\b(xin|chao|cac|ban|bai|doc|nghe|cau|hoi|hoc|sinh|giao|vien|tra|loi|doan|van|ngu|canh)\b/i.test(text);
  
  const isVi = (langParam && langParam.startsWith("vi")) || hasViChars || hasCommonViWords;
  const isMale = gender.toLowerCase() === "male";
  const langCode = isVi ? "vi-VN" : "en-US";

  const gcpClientEmail = process.env.GCP_CLIENT_EMAIL;
  const gcpPrivateKey = process.env.GCP_PRIVATE_KEY;
  const googleApiKey = process.env.GOOGLE_API_KEY;

  // 1. Unified Google Cloud TTS API Engine with Identical 3-Tier Fallback Architecture for Both Languages
  if (gcpClientEmail && gcpPrivateKey) {
    try {
      const accessToken = await getGcpAccessToken(gcpClientEmail, gcpPrivateKey);
      if (accessToken) {
        // Uniform Tiered Fallback Matrix per Gender:
        // Vietnamese Male Voices: vi-VN-Wavenet-B (Northern Male) -> vi-VN-Wavenet-C (Southern Male) -> vi-VN-Standard-B
        // Vietnamese Female Voices: vi-VN-Neural2-A -> vi-VN-Wavenet-A -> vi-VN-Standard-A
        const voiceCandidates = isVi
          ? [
              isMale ? "vi-VN-Wavenet-B" : "vi-VN-Neural2-A", // Tier 1: Male = WaveNet-B, Female = Neural2-A
              isMale ? "vi-VN-Wavenet-C" : "vi-VN-Wavenet-A", // Tier 2: Male = WaveNet-C, Female = WaveNet-A
              isMale ? "vi-VN-Standard-B" : "vi-VN-Standard-A", // Tier 3: Male = Standard-B, Female = Standard-A
            ]
          : [
              isMale ? "en-US-Chirp3-HD-D" : "en-US-Chirp3-HD-F", // Tier 1: Chirp3-HD
              isMale ? "en-US-Wavenet-D" : "en-US-Wavenet-F",     // Tier 2: WaveNet
              isMale ? "en-US-Standard-D" : "en-US-Standard-F",   // Tier 3: Standard
            ];

        for (const voiceName of voiceCandidates) {
          try {
            const ttsRes = await fetch("https://texttospeech.googleapis.com/v1/text:synthesize", {
              method: "POST",
              headers: {
                Authorization: `Bearer ${accessToken}`,
                "Content-Type": "application/json",
              },
              body: JSON.stringify({
                input: { text },
                voice: { languageCode: langCode, name: voiceName },
                audioConfig: { audioEncoding: "MP3" },
              }),
            });

            if (ttsRes.ok) {
              const ttsData = await ttsRes.json();
              if (ttsData.audioContent) {
                const mp3Buffer = Buffer.from(ttsData.audioContent, "base64");
                return new NextResponse(new Uint8Array(mp3Buffer), {
                  headers: {
                    "Content-Type": "audio/mpeg",
                    "Cache-Control": "public, max-age=86400",
                  },
                });
              }
            } else {
              console.warn(`GCP Cloud TTS Voice ${voiceName} (${langCode}) returned HTTP status ${ttsRes.status}. Falling back to next tier...`);
            }
          } catch (vErr) {
            console.error(`GCP Voice ${voiceName} synthesis error:`, vErr);
          }
        }
      }
    } catch (gcpErr) {
      console.error("GCP Cloud TTS synthesis exception:", gcpErr);
    }
  }

  // 2. Secondary Option: Gemini AI Multimodal TTS
  if (googleApiKey) {
    const ttsModels = ["gemini-2.5-flash-preview-tts", "gemini-3.1-flash-tts-preview"];

    for (const modelName of ttsModels) {
      try {
        const voiceName = isMale ? "Algenib" : "Achernar";
        const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${googleApiKey}`;

        const response = await fetch(geminiUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contents: [{ parts: [{ text }] }],
            generationConfig: {
              responseModalities: ["AUDIO"],
              speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName } } },
            },
          }),
        });

        if (response.ok) {
          const data = await response.json();
          const inlineData = data.candidates?.[0]?.content?.parts?.[0]?.inlineData;

          if (inlineData && inlineData.data) {
            const pcmBuffer = Buffer.from(inlineData.data, "base64");
            const wavBuffer = pcmToWav(pcmBuffer, 24000);
            return new NextResponse(new Uint8Array(wavBuffer), {
              headers: {
                "Content-Type": "audio/wav",
                "Cache-Control": "public, max-age=86400",
              },
            });
          }
        }
      } catch (err) {
        console.error(`Gemini TTS model ${modelName} request failed:`, err);
      }
    }
  }

  // 3. Final High-Availability Fallback: Google Neural TTS Engine
  try {
    const cleanLang = isVi ? "vi" : "en";
    const googleUrl = `https://translate.google.com/translate_tts?client=tw-ob&tl=${cleanLang}&q=${encodeURIComponent(text)}`;
    const res = await fetch(googleUrl, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      },
    });

    if (res.ok) {
      const audioBuffer = await res.arrayBuffer();
      return new NextResponse(audioBuffer, {
        headers: {
          "Content-Type": "audio/mpeg",
          "Cache-Control": "public, max-age=86400",
        },
      });
    }
  } catch (e: any) {
    console.error("TTS proxy fallback exception:", e);
  }

  return NextResponse.json({ error: "TTS_FAILED", message: "Không thể tạo âm thanh." }, { status: 500 });
}
