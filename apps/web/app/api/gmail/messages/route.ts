import { NextResponse } from 'next/server';

export async function GET() {
  // Gmail message reading is disabled in Force. Force only sends daily task digest emails at 12:00 PM.
  return NextResponse.json({
    success: true,
    messages: [],
    count: 0,
    message: 'Gmail inbox fetching is disabled.',
  });
}
