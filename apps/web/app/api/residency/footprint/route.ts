// apps/web/app/api/residency/footprint/route.ts
// POST /api/residency/footprint: with the resident's say-so, what's public about them, from
// the links they gave and a search of their name, each finding with its sources. Nothing is
// kept on the server; the resident keeps or removes each finding on their own page.

import { hasClaude, readFootprint } from "@/server/claude";

export const maxDuration = 120;

export async function POST(req: Request) {
  const start = performance.now();
  console.log("\n================================================================================");
  console.log("📥 [SERVER API: POST /api/residency/footprint] FOOTPRINT & LINKS INTAKE");

  let body: { name?: string; links?: string[]; consent?: boolean };
  try {
    body = await req.json();
  } catch {
    console.error("❌ [Footprint] Expected valid JSON body.");
    return Response.json({ error: "Expected a name and links." }, { status: 400 });
  }

  if (!body.consent) {
    console.warn("⚠️ [Footprint] Request rejected: resident consent not granted.");
    return Response.json({ error: "Only with the resident's say-so." }, { status: 403 });
  }

  const name = (body.name ?? "").trim();
  const links = (body.links ?? []).filter((l) => typeof l === "string" && l.trim()).slice(0, 8);
  
  console.log(`👤 [FOOTPRINT RESIDENT]: "${name}"`);
  console.log(`🔗 [FOOTPRINT LINKS DATA RECEIVED (${links.length})]:`);
  if (links.length > 0) {
    links.forEach((l, i) => console.log(`   ${i + 1}. [URL]: ${l}`));
  } else {
    console.log("   (No external links provided)");
  }

  if (!name) return Response.json({ findings: [], read: [] });
  if (!hasClaude()) {
    console.warn("⚠️ [Footprint] Anthropic API key not configured, returning empty findings");
    return Response.json({ findings: [], read: [] }, { status: 503 });
  }

  try {
    console.log("🤖 [Footprint] Asking Claude Haiku 4.5 to read public presence from links...");
    const res = await readFootprint(name, links);
    const duration = Math.round(performance.now() - start);
    console.log(`✅ [Footprint Success] (${duration}ms) Found ${res.findings.length} findings, ${res.read.length} sources read:`);
    res.findings.forEach((f, i) => {
      console.log(`   Finding ${i + 1} [${f.label}]: "${f.text}" (Sources: ${f.sources.map((s) => s.title).join(", ")})`);
    });
    console.log("================================================================================\n");
    return Response.json(res);
  } catch (e: any) {
    console.error("❌ [Footprint Error]:", e?.message || e);
    return Response.json({ findings: [], read: [], ...(process.env.NODE_ENV !== "production" && { detail: String(e) }) }, { status: 502 });
  }
}
