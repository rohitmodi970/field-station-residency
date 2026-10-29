import { NextRequest, NextResponse } from 'next/server';

const ONAIROS_TARGET = 'https://api2.onairos.uk';

async function handleProxy(req: NextRequest, params: { path: string[] }) {
  try {
    const subpath = params.path.join('/');
    const search = req.nextUrl.search;
    const targetUrl = `${ONAIROS_TARGET}/${subpath}${search}`;

    const headers: Record<string, string> = {
      'Content-Type': req.headers.get('content-type') || 'application/json',
      'User-Agent': 'ForceV2/1.0.0',
    };

    const auth = req.headers.get('authorization');
    if (auth) headers['Authorization'] = auth;

    const apiKey =
      req.headers.get('x-api-key') ||
      process.env.ONAIROS_API_KEY?.trim() ||
      process.env.NEXT_PUBLIC_ONAIROS_API_KEY?.trim();
    if (apiKey) {
      headers['x-api-key'] = apiKey;
      if (!auth) headers['Authorization'] = `Bearer ${apiKey}`;
    }

    let body: string | undefined;
    if (req.method !== 'GET' && req.method !== 'HEAD') {
      body = await req.text();
    }

    const response = await fetch(targetUrl, {
      method: req.method,
      headers,
      body,
    });

    const data = await response.text();
    return new NextResponse(data, {
      status: response.status,
      headers: {
        'Content-Type': response.headers.get('content-type') || 'application/json',
      },
    });
  } catch (err: any) {
    console.error('❌ [OnairosProxy] Error forwarding request:', err);
    return NextResponse.json(
      { error: err.message || 'Onairos proxy error' },
      { status: 502 }
    );
  }
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  return handleProxy(req, await params);
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  return handleProxy(req, await params);
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  return handleProxy(req, await params);
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204 });
}
