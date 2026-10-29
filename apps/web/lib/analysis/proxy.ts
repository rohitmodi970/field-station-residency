import { NextRequest, NextResponse } from 'next/server';

function cloneAuthHeaders(request: NextRequest): Headers {
  const headers = new Headers();
  const cookie = request.headers.get('cookie');
  const authorization = request.headers.get('authorization') || request.headers.get('Authorization');

  if (cookie) headers.set('cookie', cookie);
  if (authorization) headers.set('authorization', authorization);

  return headers;
}

export async function proxyJsonRequest(
  request: NextRequest,
  targetPath: string,
  method: 'GET' | 'POST' | 'PATCH' | 'DELETE',
  body?: unknown
): Promise<NextResponse> {
  const targetUrl = new URL(targetPath, request.url);
  const headers = cloneAuthHeaders(request);
  headers.set('content-type', 'application/json');

  const response = await fetch(targetUrl, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
    cache: 'no-store',
  });

  const text = await response.text();
  return new NextResponse(text, {
    status: response.status,
    headers: {
      'content-type': response.headers.get('content-type') || 'application/json',
    },
  });
}

export async function proxyFormDataRequest(
  request: NextRequest,
  targetPath: string,
  formData: FormData
): Promise<NextResponse> {
  const targetUrl = new URL(targetPath, request.url);
  const headers = cloneAuthHeaders(request);

  const response = await fetch(targetUrl, {
    method: 'POST',
    headers,
    body: formData,
    cache: 'no-store',
  });

  const text = await response.text();
  return new NextResponse(text, {
    status: response.status,
    headers: {
      'content-type': response.headers.get('content-type') || 'application/json',
    },
  });
}
