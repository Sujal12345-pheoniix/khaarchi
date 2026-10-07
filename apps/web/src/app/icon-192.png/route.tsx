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
          borderRadius: '42px',
          position: 'relative',
        }}
      >
        <div
          style={{
            fontSize: 84,
            fontWeight: 900,
            color: 'white',
            letterSpacing: '-2px',
          }}
        >
          HE
        </div>
        <div
          style={{
            position: 'absolute',
            top: 24,
            right: 24,
            width: 22,
            height: 22,
            borderRadius: '50%',
            background: '#10b981',
          }}
        />
      </div>
    ),
    {
      width: 192,
      height: 192,
    }
  );
}
