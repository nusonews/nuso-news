import { NextResponse } from 'next/server';

export const runtime = 'edge';

export async function GET() {
  const data = {
    applinks: {
      apps: [],
      details: [
        {
          // Replace ABC123XYZ with your Apple Developer Team ID and com.flexroute.app with your App Bundle ID
          appID: "ABC123XYZ.com.flexroute.app",
          paths: ["/*"]
        }
      ]
    },
    webcredentials: {
      apps: ["ABC123XYZ.com.flexroute.app"]
    }
  };

  return new NextResponse(JSON.stringify(data, null, 2), {
    status: 200,
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'public, max-age=86400, must-revalidate'
    }
  });
}
