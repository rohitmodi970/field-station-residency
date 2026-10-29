import { NextRequest, NextResponse } from "next/server";
import { executeLLMRequest } from "@/lib/llm/llmService";
import { RESIDENTS, SAMPLE_ANSWERS } from "@/data/residency";

interface AnalyzeRequestPayload {
  answers: string[];
  name?: string;
  uniqueId?: string;
  links?: Record<string, string>;
  onairosData?: any;
  provider?: string;
}

function extractOnairosAnalysisContext(data: any): string {
  if (!data || typeof data !== "object") return "";

  const sections: string[] = [];

  // 1. Personality Archetype
  const archetype =
    data.archetype ||
    data.traits?.archetype ||
    data.userProfile?.archetype ||
    data.apiResponse?.archetype ||
    data.apiResponse?.traits?.archetype;
  if (archetype && typeof archetype === "string") {
    sections.push(`- Personality Archetype: "${archetype.trim()}"`);
  }

  // 2. Behavioral Footprint Summary
  const userSummary =
    data.userSummary ||
    data.traits?.user_summary ||
    data.userProfile?.user_summary ||
    data.apiResponse?.user_summary ||
    data.apiResponse?.traits?.user_summary;
  if (userSummary && typeof userSummary === "string") {
    sections.push(`- Behavioral Footprint & Work Style Summary: "${userSummary.trim()}"`);
  }

  // 3. Observed Strengths & Positive Traits
  let traitsList: string[] = [];
  if (Array.isArray(data.topTraits) && data.topTraits.length > 0) {
    traitsList = data.topTraits.slice(0, 8).map(([trait, val]: any) => {
      const score = typeof val === "number" ? val : val?.score ?? "";
      const evidence = typeof val === "object" && val?.evidence ? ` (${val.evidence})` : "";
      return `${trait}${score !== "" ? ` [${score}/100]` : ""}${evidence}`;
    });
  } else {
    const rawPos =
      data.positive_traits ||
      data.traits?.positive_traits ||
      data.apiResponse?.positive_traits ||
      data.apiResponse?.traits?.positive_traits;
    if (rawPos && typeof rawPos === "object") {
      traitsList = Object.entries(rawPos).slice(0, 8).map(([trait, val]: any) => {
        const score = typeof val === "number" ? val : (val as any)?.score ?? "";
        const evidence = typeof val === "object" && (val as any)?.evidence ? ` (${(val as any).evidence})` : "";
        return `${trait}${score !== "" ? ` [${score}/100]` : ""}${evidence}`;
      });
    }
  }
  if (traitsList.length > 0) {
    sections.push(`- Key Strengths & Cognitive Traits: ${traitsList.join(", ")}`);
  }

  // 4. Growth Edges / Traits to Improve
  let growthList: string[] = [];
  if (Array.isArray(data.traitsToImprove) && data.traitsToImprove.length > 0) {
    growthList = data.traitsToImprove.slice(0, 4).map(([trait, val]: any) => {
      const score = typeof val === "number" ? val : val?.score ?? "";
      return `${trait}${score !== "" ? ` [${score}/100]` : ""}`;
    });
  } else {
    const rawGrowth =
      data.traits_to_improve ||
      data.traits?.traits_to_improve ||
      data.apiResponse?.traits_to_improve ||
      data.apiResponse?.traits?.traits_to_improve;
    if (rawGrowth && typeof rawGrowth === "object") {
      growthList = Object.entries(rawGrowth).slice(0, 4).map(([trait, val]: any) => {
        const score = typeof val === "number" ? val : (val as any)?.score ?? "";
        return `${trait}${score !== "" ? ` [${score}/100]` : ""}`;
      });
    }
  }
  if (growthList.length > 0) {
    sections.push(`- Growth Tensions & Edges: ${growthList.join(", ")}`);
  }

  // 5. Behavioral Nudges
  const rawNudges = data.nudges || data.traits?.nudges || data.apiResponse?.traits?.nudges || data.userProfile?.nudges;
  if (Array.isArray(rawNudges) && rawNudges.length > 0) {
    const nudgeTexts = rawNudges
      .slice(0, 4)
      .map((n: any) => (typeof n === "string" ? n.trim() : n?.text?.trim()))
      .filter(Boolean);
    if (nudgeTexts.length > 0) {
      sections.push(`- Behavioral Insights & Nudges: ${nudgeTexts.join(" | ")}`);
    }
  }

  // 6. Psychometrics (Big Five OCEAN)
  const traitsObj = data.traits || data.apiResponse?.traits || data.personality;
  if (traitsObj && typeof traitsObj === "object") {
    const ocean: string[] = [];
    const keys = ["openness", "conscientiousness", "extraversion", "agreeableness", "neuroticism"];
    for (const k of keys) {
      const val = traitsObj[k] ?? traitsObj[k.toLowerCase()];
      if (typeof val === "number") {
        ocean.push(`${k}: ${val <= 1.0 ? Math.round(val * 100) : val}%`);
      }
    }
    if (ocean.length > 0) {
      sections.push(`- Big Five Psychometrics: ${ocean.join(", ")}`);
    }
  }

  // 7. Interests & Topics
  const rawInterests = data.interests || data.rawPayload?.interests || data.apiResponse?.interests;
  if (Array.isArray(rawInterests) && rawInterests.length > 0) {
    sections.push(`- Authentic Topic Interests: ${rawInterests.slice(0, 10).join(", ")}`);
  }

  // 8. Connected Platform Sources
  const platforms = data.connectedSources || data.connectedPlatforms || data.source_platforms;
  if (Array.isArray(platforms) && platforms.length > 0) {
    sections.push(`- Connected Authentic Footprints: ${platforms.join(", ")}`);
  }

  return sections.join("\n");
}

export async function POST(req: NextRequest) {
  try {
    const body: AnalyzeRequestPayload = await req.json();
    const { answers = [], name = "", uniqueId = "", links = {}, onairosData, provider } = body;

    const validAnswers = Array.isArray(answers) ? answers.filter((a) => typeof a === "string" && a.trim().length > 0) : [];
    const effectiveAnswers = [
      validAnswers[0] || SAMPLE_ANSWERS[0] || "Building and exploring",
      validAnswers[1] || SAMPLE_ANSWERS[1] || "Focusing on core craft",
      validAnswers[2] || SAMPLE_ANSWERS[2] || "Meaningful partnerships and focus",
    ];

    const participantName = (name || "Resident").trim();
    const cleanId = (uniqueId || "RES-USER").trim();

    // Prepare context about the cohort members for pairing
    const residentSummaries = RESIDENTS.map(
      (r) => `- ID: ${r.id}, Name: ${r.name}, Work: ${r.work}, Pattern: ${r.pattern || ""}`
    ).join("\n");

    const onairosSummary = extractOnairosAnalysisContext(onairosData);
    const onairosBlock = onairosSummary
      ? `\nOnairos Footprint Insights (Private digital activity consented by resident):\n${onairosSummary}\n`
      : "";

    const prompt = `You are Force, an empathetic intelligence for a creative & technical residency cohort.
A resident (${participantName}, Unique ID: ${cleanId}) has answered three residency onboarding questions:

Answer 1 (What are you working on here?):
"${effectiveAnswers[0]}"

Answer 2 (What's the part you keep coming back to, even when nobody asks?):
"${effectiveAnswers[1]}"

Answer 3 (What would make this residency a win for you, beyond the work?):
"${effectiveAnswers[2]}"

Links provided: ${JSON.stringify(links)}
${onairosBlock}
Cohort Residents in the space:
${residentSummaries}

Analyze their exact words in synthesis with their Onairos personality profile and behavioral summary with deep perceptual precision.
Never diagnose, never grade, never use corporate jargon. Look for tension, recurring desires, and how they actually think.
Use the Onairos archetype, strengths, and behavioral summary to ground your understanding of their craft instincts and cognitive style, but keep the headline and pattern points directly anchored to what they said and do.

Respond ONLY with a valid, raw JSON object (no markdown code blocks, no explanation) matching this schema:
{
  "headline": "One sharp sentence summarizing what their three answers add up to.",
  "points": [
    {
      "id": "p1",
      "text": "What Force notices about their instinct or way of working (under 16 words)",
      "why": "Quoted exact clause from Answer 1, 2, 3, or evidence from their Onairos patterns"
    },
    {
      "id": "p2",
      "text": "Another pattern in how they make decisions or what pulls them",
      "why": "Quoted exact clause or Onairos pattern"
    },
    {
      "id": "p3",
      "text": "What they value in people or environment",
      "why": "Quoted exact clause or Onairos pattern"
    },
    {
      "id": "p4",
      "text": "The hidden question or craft detail they care about",
      "why": "Quoted exact clause or Onairos pattern"
    }
  ],
  "intents": [
    {
      "id": "i1",
      "title": "Short 2-3 word title of their main project drive",
      "label": "Full descriptive title of their work",
      "line": "What they're building toward",
      "quote": "Short direct quote from Answer 1"
    },
    {
      "id": "i2",
      "title": "Short 2-3 word title of their recurring curiosity",
      "label": "The part they keep coming back to",
      "line": "How they work it out",
      "quote": "Short direct quote from Answer 2"
    },
    {
      "id": "i3",
      "title": "Short 2-3 word title of residency success",
      "label": "What makes this residency a win",
      "line": "What they need beyond the work",
      "quote": "Short direct quote from Answer 3"
    }
  ],
  "themes": [
    { "id": "t1", "title": "Theme 1", "label": "Theme 1 Description", "art": "meadow" },
    { "id": "t2", "title": "Theme 2", "label": "Theme 2 Description", "art": "hills" },
    { "id": "t3", "title": "Theme 3", "label": "Theme 3 Description", "art": "water" },
    { "id": "t4", "title": "Theme 4", "label": "Theme 4 Description", "art": "park" }
  ],
  "pairedResidentIds": ["meera", "kabir"]
}`;

    const llmRes = await executeLLMRequest({
      prompt,
      provider: provider || process.env.DEFAULT_LLM_PROVIDER || "claude",
      options: {
        rawPrompt: true,
        temperature: 0.35,
        maxTokens: 2500,
      },
    });

    if (llmRes.error) {
      console.error("[Residency Analysis] LLM error:", llmRes.error);
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
    } catch (parseErr) {
      console.warn("[Residency Analysis] Failed to parse LLM JSON, raw text:", llmRes.text);
      // Fallback response with structured heuristic
      return NextResponse.json({
        headline: `You're building something specific, and you lead by talking directly with the people it serves.`,
        points: [
          { id: "p1", text: "You build for someone specific, not a generic market.", why: `“${effectiveAnswers[0]?.slice(0, 50) || "Specific focus"}…”` },
          { id: "p2", text: "You learn by talking to people, even when you should be writing code.", why: `“${effectiveAnswers[1]?.slice(0, 50) || "Direct calls"}…”` },
          { id: "p3", text: "You judge this residency by who you leave with, not just output.", why: `“${effectiveAnswers[2]?.slice(0, 50) || "Two or three people"}…”` },
        ],
        rawText: llmRes.text,
      });
    }

    return NextResponse.json({
      success: true,
      analysis: parsed,
      model: llmRes.model,
    });
  } catch (err: any) {
    console.error("[Residency Analysis] Exception:", err);
    return NextResponse.json({ error: err?.message || "Internal server error" }, { status: 500 });
  }
}
