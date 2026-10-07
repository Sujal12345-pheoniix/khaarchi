import { ImageResponse } from 'next/og';

export const runtime = 'edge';

export async function GET() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)',
          borderRadius: '112px',
          position: 'relative',
        }}
      >
        <div
          style={{
            fontSize: 220,
            fontWeight: 900,
            color: 'white',
            letterSpacing: '-6px',
          }}
        >
          HE
        </div>
        <div
          style={{
            position: 'absolute',
            top: 64,
            right: 64,
            width: 56,
            height: 56,
            borderRadius: '50%',
            background: '#10b981',
          }}
        />
      </div>
    ),
    {
      width: 512,
      height: 512,
    }
  );
}
