import { NextRequest, NextResponse } from "next/server";
import { executeLLMRequest } from "@/lib/llm/llmService";
import { RESIDENTS } from "@/data/residency";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { title = "", text = "", uniqueId = "", name = "" } = body;

    const cleanText = (text || "").trim();
    if (!cleanText) {
      return NextResponse.json({ error: "Entry text is required for pattern analysis" }, { status: 400 });
    }

    const residentSummaries = RESIDENTS.map(
      (r) => `- ${r.name} (${r.work}): pattern "${r.pattern || ""}"`
    ).join("\n");

    const prompt = `You are Force, an empathetic intelligence reading a resident's private journal entry.
Resident: ${name || "Resident"} (${uniqueId || "RES-USER"})
Entry Title: "${title || "Untitled"}"
Entry Content:
"${cleanText}"

Cohort members in the residency:
${residentSummaries}

Analyze this entry for deep emotional clarity, unspoken tensions, recurring patterns, and resonances with other residents.
Never use clinical therapy words or corporate jargon. Speak with literary sensitivity, precision, and brevity.

Respond ONLY with a valid JSON object matching this schema:
{
  "headline": "One sharp, beautiful sentence summarizing the emotional or intellectual center of this entry.",
  "coreTension": "What they are wrestling with or trying to balance (under 20 words).",
  "quote": "The single most revealing clause directly quoted from their entry.",
  "themes": [
    { "name": "Theme Name", "art": "meadow", "line": "Why this theme is present" },
    { "name": "Theme 2", "art": "hills", "line": "Why this theme is present" }
  ],
  "nextMove": "One small, specific creative or personal move they could take today.",
  "sharedWith": "Name of the cohort resident (e.g. Meera, Kabir, Ananya) who shares this energy, and why."
}`;

    const llmRes = await executeLLMRequest({
      prompt,
      provider: process.env.DEFAULT_LLM_PROVIDER || "claude",
      options: {
        rawPrompt: true,
        temperature: 0.3,
        maxTokens: 1500,
      },
    });

    if (llmRes.error) {
      return NextResponse.json({ error: llmRes.error }, { status: 500 });
    }

    let parsed: any;
    try {
      const cleanJson = llmRes.text
        .replace(/^```json\s*/i, "")
        .replace(/^```\s*/i, "")
        .replace(/\s*```$/i, "")
        .trim();
      parsed = JSON.parse(cleanJson);
    } catch {
      parsed = {
        headline: `You're writing into what matters, and the pattern shows up in how you make time for it.`,
        coreTension: `Balancing the immediate demands of building with the space to listen.`,
        quote: cleanText.slice(0, 60),
        themes: [{ name: "Focus", art: "water", line: "Present across your reflections" }],
        nextMove: "Protect one uninterrupted hour for this before tomorrow.",
      };
    }

    return NextResponse.json({
      success: true,
      analysis: parsed,
      model: llmRes.model,
    });
  } catch (err: any) {
    console.error("[Journal Analyze API] Error:", err);
    return NextResponse.json({ error: err?.message || "Internal server error" }, { status: 500 });
  }
}
