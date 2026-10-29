import type { Metadata } from 'next';
import FunMaskingClient from './FunMaskingClient';

   const siteUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://www.findmyforce.com';

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: 'A small circle for people who want to feel more alive.',
  description:
    'An intentional community of curious, kind, generous people who want to do more interesting things — with and for each other.',
  alternates: {
    canonical: `${siteUrl}/funmaxxing`,
  },
  openGraph: {
    title: 'A small circle for people who want to feel more alive.',
    description:
      'An intentional community of curious, kind, generous people who want to do more interesting things — with and for each other.',
    url: `${siteUrl}/funmaxxing`,
    siteName: 'Force',
    locale: 'en_US',
    type: 'website',
    images: [
      {
        url: '/og/funmaxxing.png',
        width: 1200,
        height: 630,
        type: 'image/png',
        alt: 'Force',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'A small circle for people who want to feel more alive.',
    description:
      'An intentional community of curious, kind, generous people who want to do more interesting things — with and for each other.',
    images: ['/og/funmaxxing.png'],
  },
};

export default function FunMaskingPage() {
  return <FunMaskingClient />;
}
