// apps/web/app/api/residency/graph/connection/route.ts
// GET /api/residency/graph/connection?resident=...
// Returns connection detail with a specific resident.

import cohort from "@/contract/fixtures/cohort.json";
import { personId, type Connection } from "@/contract/residency";
import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  const searchParams = req.nextUrl.searchParams;
  const resident = searchParams.get("resident");
  if (!resident) {
    return NextResponse.json({ error: "Missing resident query parameter" }, { status: 400 });
  }

  const pid = personId(resident);
  const connections = cohort.connections as Connection[];
  const match = connections.find((c) => c.source === pid || c.target === pid) ?? null;

  return NextResponse.json(match);
}
