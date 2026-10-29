// apps/web/app/api/transcribe/route.ts
// POST /api/transcribe: a recorded answer (multipart "file") → its words via Deepgram or ElevenLabs.
// Supports all browsers without native speech recognition.

export const maxDuration = 60;

export async function POST(req: Request) {
  const start = performance.now();
  console.log("📥 [POST /api/transcribe] Audio transcription request received");

  const deepgramKey = process.env.DEEPGRAM_API_KEY;
  const elevenlabsKey = process.env.ELEVENLABS_API_KEY;

  if (!deepgramKey && !elevenlabsKey) {
    console.warn("⚠️ [Transcribe] Neither DEEPGRAM_API_KEY nor ELEVENLABS_API_KEY configured.");
    return Response.json({ text: "" }, { status: 503 });
  }

  const form = await req.formData().catch(() => null);
  const file = form?.get("file");
  if (!(file instanceof Blob) || !file.size) {
    console.error("❌ [Transcribe] No valid audio file attached in form data.");
    return Response.json({ error: "Expected an audio file." }, { status: 400 });
  }

  console.log(`🎙️ [Transcribe Data Source] Audio blob: ${file.size} bytes, mimeType: "${file.type || "audio/webm"}"`);
  const arrayBuffer = await file.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);

  // 1. Try Deepgram Nova-2 (super fast, robust)
  if (deepgramKey) {
    try {
      console.log("⚡ [Transcribe] Sending audio buffer to Deepgram Nova-2 API...");
      const dgStart = performance.now();
      const dgRes = await fetch("https://api.deepgram.com/v1/listen?smart_format=true&model=nova-2", {
        method: "POST",
        headers: {
          Authorization: `Token ${deepgramKey}`,
          "Content-Type": file.type || "audio/webm",
        },
        body: buffer,
      });

      if (dgRes.ok) {
        const dgData = await dgRes.json();
        const transcript = dgData.results?.channels?.[0]?.alternatives?.[0]?.transcript || "";
        const clean = transcript.replace(/\([^)]*\)|\[[^\]]*\]/g, " ").replace(/\s+/g, " ").trim();
        const duration = Math.round(performance.now() - dgStart);
        console.log(`✅ [Transcribe: Deepgram Success] (${duration}ms) Transcript: "${clean}"`);
        return Response.json({ text: clean, source: "deepgram_nova_2" });
      } else {
        const errText = await dgRes.text();
        console.warn(`⚠️ [Transcribe] Deepgram replied with ${dgRes.status}: ${errText}`);
      }
    } catch (e: any) {
      console.warn("⚠️ [Transcribe] Deepgram attempt error, trying ElevenLabs if available:", e?.message);
    }
  }

  // 2. Try ElevenLabs Scribe
  if (elevenlabsKey) {
    try {
      console.log("⚡ [Transcribe] Sending audio buffer to ElevenLabs Scribe API...");
      const elStart = performance.now();
      const body = new FormData();
      body.set("model_id", "scribe_v2");
      body.set("file", file, "answer");

      const elRes = await fetch("https://api.elevenlabs.io/v1/speech-to-text", {
        method: "POST",
        headers: { "xi-api-key": elevenlabsKey },
        body,
      });

      if (elRes.ok) {
        const out = (await elRes.json()) as { text?: string };
        const clean = (out.text ?? "").replace(/\([^)]*\)|\[[^\]]*\]/g, " ").replace(/\s+/g, " ").trim();
        const duration = Math.round(performance.now() - elStart);
        console.log(`✅ [Transcribe: ElevenLabs Success] (${duration}ms) Transcript: "${clean}"`);
        return Response.json({ text: clean, source: "elevenlabs_scribe" });
      }
    } catch (e: any) {
      console.error("❌ [Transcribe] ElevenLabs failed:", e?.message);
    }
  }

  const duration = Math.round(performance.now() - start);
  console.warn(`⚠️ [Transcribe Failed] (${duration}ms) - Returning empty text`);
  return Response.json({ text: "", source: "none" }, { status: 502 });
}
