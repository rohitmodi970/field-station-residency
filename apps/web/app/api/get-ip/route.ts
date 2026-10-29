import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  try {
    // Try to get IP from request headers first
    const forwarded = request.headers.get('x-forwarded-for');
    const realIp = request.headers.get('x-real-ip');
    const clientIp = request.headers.get('x-client-ip');
    
    // Check various header sources
    let ip = forwarded?.split(',')[0] || realIp || clientIp;
    
    // If no IP found in headers, try external services
    if (!ip || ip === '127.0.0.1' || ip === '::1') {
      const ipServices = [
        'https://api.ipify.org?format=json',
        'https://ipapi.co/json/',
        'https://api.ip.sb/ip',
        'https://ipinfo.io/json'
      ];

      for (const service of ipServices) {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 5000);
        try {
          const response = await fetch(service, {
            method: 'GET',
            headers: {
              'Accept': 'application/json, text/plain, */*',
              'User-Agent': 'Mozilla/5.0'
            },
            signal: controller.signal
          });

          if (!response.ok) {
            // try next service
            continue;
          }

          // Attempt to parse JSON first, fall back to text. Use clone() to avoid
          // consuming the response body on a failed parse.
          let data: any = null;
          try {
            data = await response.clone().json();
          } catch (jsonErr) {
            try {
              const txt = await response.text();
              // Some services return a bare IP or other text — extract IPv4/IPv6
              const ipMatch = txt.match(/([0-9]{1,3}(?:\.[0-9]{1,3}){3})|([0-9a-fA-F:]+)/);
              if (ipMatch) {
                ip = ipMatch[0];
              } else if (txt && txt.trim()) {
                ip = txt.trim();
              }
            } catch (txtErr) {
              console.warn(`Failed to read text from ${service}:`, txtErr);
            }
          }

          if (data) {
            if (typeof data === 'string') {
              ip = data;
            } else if (data.ip) {
              ip = data.ip;
            } else if (data.query) {
              ip = data.query;
            } else if (data.address) {
              ip = data.address;
            }
          }

          if (ip) break;
        } catch (serviceError) {
          if ((serviceError as any).name === 'AbortError') {
            console.warn(`Fetch to ${service} aborted due to timeout`);
          } else {
            console.warn(`Failed to fetch from ${service}:`, serviceError);
          }
        } finally {
          clearTimeout(timeoutId);
        }
      }
    }
    
    return NextResponse.json({ 
      ip: ip || '0.0.0.0',
      source: ip ? 'detected' : 'fallback'
    });
    
  } catch (error) {
    console.error('Error getting IP address:', error);
    return NextResponse.json({ 
      ip: '0.0.0.0',
      source: 'fallback',
      error: 'Failed to detect IP'
    });
  }
}