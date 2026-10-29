/** @type {import('next').NextConfig} */
import process from 'node:process'

const nextConfig = {
  transpilePackages: ["@workspace/ui"],

  compiler: {
    // Allow production console logs for Onairos integration and runtime diagnostics
    removeConsole: false,
  },

  images: {
    domains: [
      "cdn.pixabay.com",
      "res.cloudinary.com",
      "hebbkx1anhila5yf.public.blob.vercel-storage.com",
      "images.unsplash.com",
      "drive.google.com",
      "lh3.googleusercontent.com",
      "lh1.googleusercontent.com",
      "lh2.googleusercontent.com",
      "lh4.googleusercontent.com",
      "lh5.googleusercontent.com",
      "lh6.googleusercontent.com",
      "letsenhance.io",
      "vefhdxvamzusfsaphdyo.supabase.co",
      "framerusercontent.com"
    ],
  },
  
  experimental: {
    serverActions: {
      bodySizeLimit: '250mb'
    },
    largePageDataBytes: 256 * 1024,
  },

  serverRuntimeConfig: {
    maxDuration: 300,
  },

  async rewrites() {
    return {
      // beforeFiles: Runs BEFORE any Next.js page check
      // Root "/" always goes to Framer landing page
      beforeFiles: [
        {
          source: '/',
          destination: 'https://persistent-humor-310280.framer.app/',
        },
        {
          source: '/fun-maxxing',
          destination: '/funmaxxing',
        },
        {
          source: '/fun-masking',
          destination: '/funmaxxing',
        },
        {
          source: '/fun-maxxxxxing',
          destination: '/funmaxxing',
        },
      ],
      // afterFiles: Runs AFTER checking Next.js pages/public files
      // API and proxy rewrites
      afterFiles: [
        // PostHog proxy to avoid ad blockers
        {
          source: '/ph/static/:path*',
          destination: 'https://us-assets.i.posthog.com/static/:path*',
        },
        {
          source: '/ph/:path*',
          destination: 'https://us.i.posthog.com/:path*',
        },
        // API rewrites
        {
          source: '/api/aitopia/:path*',
          destination: 'https://extensions.aitopia.ai/:path*',
        },
        {
          source: '/api/sentiment/:path*',
          destination: `${process.env.SA_MODEL_LINK || 'http://127.0.0.1:8000'}/:path*`,
          has: [
            {
              type: 'header',
              key: 'content-type',
              value: '(.*?)',
            },
          ],
        },
      ],
      // fallback: Runs ONLY when no Next.js page/route matches
      // Unknown paths (Framer subpages like /about, /pricing) get proxied to Framer
      fallback: [
        {
          source: '/:path*',
          destination: 'https://persistent-humor-310280.framer.app/:path*',
        },
      ],
    };
  },

  async headers() {
    return [
      {
        source: '/api/:path*',
        headers: [
          { key: 'Access-Control-Allow-Credentials', value: 'true' },
          { key: 'Access-Control-Allow-Origin', value: '*' },
          { key: 'Access-Control-Allow-Methods', value: 'GET,DELETE,PATCH,POST,PUT,OPTIONS' },
          { key: 'Access-Control-Allow-Headers', value: 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization' },
        ],
      },
      {
        source: '/api/media/upload',
        headers: [
          { key: 'Access-Control-Allow-Credentials', value: 'true' },
          { key: 'Access-Control-Allow-Origin', value: '*' },
          { key: 'Access-Control-Allow-Methods', value: 'POST, OPTIONS' },
          { key: 'Access-Control-Allow-Headers', value: 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization' },
          { key: 'Access-Control-Max-Age', value: '86400' },
          { key: 'Keep-Alive', value: 'timeout=300, max=1000' },
          { key: 'Connection', value: 'keep-alive' },
        ],
      },
      {
        source: '/api/aitopia/:path*',
        headers: [
          { key: 'Access-Control-Allow-Credentials', value: 'true' },
          { key: 'Access-Control-Allow-Origin', value: '*' },
          { key: 'Access-Control-Allow-Methods', value: 'GET,DELETE,PATCH,POST,PUT,OPTIONS' },
          { key: 'Access-Control-Allow-Headers', value: 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization' },
        ],
      },
      {
        source: '/api/sentiment/:path*',
        headers: [
          { key: 'Access-Control-Allow-Credentials', value: 'true' },
          { key: 'Access-Control-Allow-Origin', value: '*' },
          { key: 'Access-Control-Allow-Methods', value: 'GET,DELETE,PATCH,POST,PUT,OPTIONS' },
          { key: 'Access-Control-Allow-Headers', value: 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization' },
        ],
      },
      {
        source: '/(.*)',
        headers: [
          {
            key: 'Content-Security-Policy',
            value: `
              default-src 'self';
              script-src 'self' 'unsafe-inline' 'unsafe-eval' blob: https://cdn.jsdelivr.net https://js.puter.com https://*.puter.com https://us-assets.i.posthog.com https://va.vercel-scripts.com https://accounts.google.com https://*.google.com https://framerusercontent.com https://*.framerusercontent.com https://framer.com https://*.framer.com https://app.framerstatic.com https://*.framerstatic.com https://onairos.uk https://*.onairos.uk;
              worker-src 'self' blob: data:;
              style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://accounts.google.com https://*.framerusercontent.com https://db.onlinewebfonts.com;
              font-src 'self' https://fonts.gstatic.com https://assets.codepen.io https://fonts.googleapis.com https://framerusercontent.com https://*.framerusercontent.com https://db.onlinewebfonts.com data:;
              img-src 'self' data: blob: https://*.googleusercontent.com https://*.pixabay.com https://*.cloudinary.com https://*.vercel-storage.com https://*.unsplash.com https://drive.google.com https://letsenhance.io https://*.giphy.com https://*.supabase.co https://framerusercontent.com https://*.framerusercontent.com https://*.framer.com https://force-web.vercel.app;
              media-src 'self' blob: https://drive.google.com https://*.googleusercontent.com https://*.supabase.co https://framerusercontent.com https://*.framerusercontent.com https://force-web.vercel.app;
              connect-src 'self' data: ${process.env.SA_MODEL_LINK || 'http://localhost:8000'} https://fonts.googleapis.com https://fonts.gstatic.com https://js.puter.com https://*.puter.com https://api.puter.com wss://api.puter.com wss://*.puter.com wss://puter.com https://extensions.aitopia.ai https://cdn.jsdelivr.net https://tessdata.projectnaptha.com https://www.googleapis.com https://accounts.google.com https://*.google.com https://api2.onairos.uk https://*.onairos.uk https://onairos.uk wss://api2.onairos.uk wss://*.onairos.uk https://drive.google.com https://*.supabase.co wss://*.supabase.co https://us.i.posthog.com https://us-assets.i.posthog.com https://app.posthog.com https://va.vercel-scripts.com https://vitals.vercel-insights.com https://*.framer.com https://events.framer.com https://framerusercontent.com https://*.framerusercontent.com https://app.framerstatic.com https://*.framerstatic.com wss://collab.findmyforce.com;
              frame-src 'self' http://localhost:3000 https://localhost:3000 https://*.puter.com https://puter.com https://accounts.google.com https://*.google.com https://drive.google.com https://framer.com https://*.framer.com https://onairos.uk https://*.onairos.uk https://api2.onairos.uk;
            `.replace(/\n/g, '').replace(/\s{2,}/g, ' ').trim()
          },
          {
            key: 'Cross-Origin-Opener-Policy',
            value: 'same-origin-allow-popups',
          },
        ]
      },
    ];
  },
};

export default nextConfig;