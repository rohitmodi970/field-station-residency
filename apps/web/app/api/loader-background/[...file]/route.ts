import { NextResponse } from 'next/server';
import fs from 'fs/promises';
import path from 'path';

const ALLOWED_DIR = path.resolve(process.cwd(), '..', '..', '..', 'loader-background', 'public');

function contentTypeFor(ext: string) {
  switch (ext.toLowerCase()) {
    case '.jpg':
    case '.jpeg':
      return 'image/jpeg';
    case '.png':
      return 'image/png';
    case '.svg':
      return 'image/svg+xml';
    case '.webp':
      return 'image/webp';
    case '.gif':
      return 'image/gif';
    default:
      return 'application/octet-stream';
  }
}

type RouteContext = { params: Promise<{ file: string[] }> };

export async function GET(_req: Request, { params }: RouteContext) {
  try {
    const { file } = await params;
    const segments = file || [];
    if (!segments.length) return new NextResponse('Not found', { status: 404 });

    // Prevent path traversal by resolving and verifying prefix
    const requested = path.join(...segments);
    const abs = path.resolve(ALLOWED_DIR, requested);
    if (!abs.startsWith(ALLOWED_DIR)) return new NextResponse('Not allowed', { status: 403 });

    const data = await fs.readFile(abs);
    const ext = path.extname(abs);
    const ct = contentTypeFor(ext);

    return new NextResponse(data, {
      status: 200,
      headers: { 'Content-Type': ct, 'Cache-Control': 'public, max-age=3600' },
    });
  } catch (err) {
    return new NextResponse('Not found', { status: 404 });
  }
}
