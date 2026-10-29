import { ImageResponse } from 'next/og';

export const runtime = 'nodejs';
export const alt = 'Force';
export const size = {
  width: 1200,
  height: 630,
};
export const contentType = 'image/png';

export default async function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: '#0d0c0b',
          color: '#ece6db',
          fontFamily: 'sans-serif',
          position: 'relative',
        }}
      >
        {/* Subtle border framing */}
        <div
          style={{
            position: 'absolute',
            inset: 24,
            border: '1px solid rgba(236, 230, 219, 0.12)',
            borderRadius: 16,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: '#141210',
          }}
        >
          {/* Top badges */}
          <div
            style={{
              position: 'absolute',
              top: 28,
              left: 36,
              right: 36,
              display: 'flex',
              justifyContent: 'space-between',
              fontSize: 16,
              color: 'rgba(236, 230, 219, 0.38)',
              fontFamily: 'monospace',
            }}
          >
            <span>Force</span>
            <span>Pl. 00</span>
          </div>

          {/* Centered Logo */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              marginBottom: 20,
            }}
          >
            <svg
              width="160"
              height="121"
              viewBox="4 2 198 150"
              fill="#c98a72"
            >
              <path d="M85.3772 32.024L16.1691 18.3645C10.9033 17.3252 6 21.3553 6 26.7227C6 30.8625 8.97598 34.4031 13.0541 35.1152L72.9119 45.5665C76.784 46.2426 79.6096 49.6043 79.6096 53.535C79.6096 57.649 76.5216 61.1077 72.4339 61.5723L51.7716 63.9202C42.8656 64.9323 39.49 76.1065 46.3462 81.8801C48.8875 84.0202 52.311 84.7903 55.5239 83.9448L86.0883 75.9016C91.2213 74.5508 94.7989 69.9099 94.7989 64.6022V43.4869C94.7989 37.9062 90.8529 33.1043 85.3772 32.024Z" />
              <path d="M120.579 32.024L189.787 18.3645C195.053 17.3252 199.956 21.3553 199.956 26.7227C199.956 30.8625 196.98 34.4031 192.902 35.1152L133.044 45.5665C129.172 46.2426 126.346 49.6043 126.346 53.535C126.346 57.649 129.434 61.1077 133.522 61.5723L153.915 63.8896C162.691 64.8869 165.865 76.0069 158.939 81.4872C156.537 83.3876 153.391 84.069 150.418 83.3327L120.032 75.8074C114.819 74.5162 111.157 69.837 111.157 64.466V43.4869C111.157 37.9062 115.104 33.1043 120.579 32.024Z" />
              <path d="M102.979 5.8418H105.315C107.897 5.84184 109.989 7.9345 109.989 10.5156C109.989 13.0968 107.897 15.1894 105.315 15.1895H102.979C100.397 15.1894 98.3047 13.0968 98.3047 10.5156C98.3047 7.93448 100.397 5.84181 102.979 5.8418Z" />
              <path d="M111.157 143.714V66.5989C111.157 63.3724 113.773 60.7568 116.999 60.7568C120.226 60.7568 122.841 63.3724 122.841 66.5989V143.714C122.841 146.94 120.226 149.556 116.999 149.556C113.773 149.556 111.157 146.94 111.157 143.714Z" />
            </svg>
          </div>

          <div
            style={{
              fontSize: 44,
              fontWeight: 600,
              letterSpacing: '-0.02em',
              color: '#ece6db',
              marginBottom: 12,
            }}
          >
            Force
          </div>

          <div
            style={{
              fontSize: 22,
              color: 'rgba(236, 230, 219, 0.62)',
              maxWidth: 720,
              textAlign: 'center',
              lineHeight: 1.4,
            }}
          >
            Somewhere, someone thinks like you.
          </div>

          {/* Bottom badges */}
          <div
            style={{
              position: 'absolute',
              bottom: 28,
              left: 36,
              right: 36,
              display: 'flex',
              justifyContent: 'space-between',
              fontSize: 16,
              color: 'rgba(236, 230, 219, 0.38)',
              fontFamily: 'monospace',
            }}
          >
            <span>Field between you and yourself</span>
            <span>d = 1.00</span>
          </div>
        </div>
      </div>
    ),
    {
      ...size,
    }
  );
}
