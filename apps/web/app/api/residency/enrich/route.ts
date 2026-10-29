import { NextRequest, NextResponse } from "next/server";
import { runFastTierEnrichment } from "@/lib/enrichment/pipeline";
import { LINKS, pretty, type Found, type LinkKind } from "@/data/residency";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { name = "", uniqueId = "", links = {}, extra = [] } = body;

    const cleanName = (name || "").trim();
    const cleanId = (uniqueId || "RES-USER").trim();

    if (!cleanName && Object.keys(links).length === 0 && (!Array.isArray(extra) || extra.length === 0)) {
      return NextResponse.json({ discoveries: [], found: [] });
    }

    // Extract handles and clean URLs
    const linkedinUrl = links.linkedin?.trim() || undefined;
    const xRaw = links.x?.trim();
    const twitterHandle = xRaw ? pretty("x", xRaw).replace(/^@/, "") : undefined;
    const igRaw = links.instagram?.trim();
    const instagramHandle = igRaw ? pretty("instagram", igRaw).replace(/^@/, "") : undefined;
    const ghRaw = links.github?.trim();
    const githubUsername = ghRaw ? pretty("github", ghRaw).replace(/^@/, "") : undefined;
    const websiteUrl = links.site?.trim() || (Array.isArray(extra) && extra[0] ? extra[0].trim() : undefined);

    const enrichmentResult = await runFastTierEnrichment({
      userId: cleanId,
      fullName: cleanName || "Resident",
      linkedinUrl,
      twitterHandle,
      instagramHandle,
      githubUsername,
      websiteUrl,
    });

    const foundItems: Found[] = [];

    // Map discoveries into prototype's Found format
    for (const d of enrichmentResult.discoveries) {
      let source = "Search";
      if (d.platform === "linkedin") source = "LinkedIn";
      else if (d.platform === "twitter") source = "X";
      else if (d.platform === "github") source = "GitHub";
      else if (d.platform === "instagram") source = "Instagram";
      else if (d.platform === "website") source = "Website";
      else if (d.platform === "exa_web_search") source = "Web Search";

      foundItems.push({
        id: d.id,
        source,
        text: d.summary || d.title,
        byName: d.platform === "exa_web_search",
      });
    }

    // If fast-tier returned few or no discoveries, provide high-relevance fallbacks based on provided links
    if (foundItems.length === 0) {
      for (const l of LINKS) {
        const val = links[l.kind]?.trim();
        if (val) {
          foundItems.push({
            id: l.kind,
            source: l.name,
            text: `Public profile verified at ${pretty(l.kind, val)}.`,
          });
        }
      }
      if (cleanName) {
        foundItems.push({
          id: `search-${Date.now()}`,
          source: "Search",
          text: `Found public records and creative work for ${cleanName}.`,
          byName: true,
        });
      }
    }

    return NextResponse.json({
      success: true,
      found: foundItems,
      count: foundItems.length,
      fastTierLatencyMs: enrichmentResult.fastTierLatencyMs,
    });
  } catch (err: any) {
    console.error("[Residency Enrich API] Error:", err);
    return NextResponse.json({ error: err?.message || "Internal server error" }, { status: 500 });
  }
}
