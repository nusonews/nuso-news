import { NextResponse } from 'next/server';

export const runtime = 'edge';

export async function GET() {
  const data = [
    {
      relation: ["delegate_permission/common.handle_all_urls"],
      target: {
        namespace: "android_app",
        // Replace with your Android application package name
        package_name: "com.flexroute.app",
        // Replace with your app SHA-256 certificate fingerprint
        sha256_cert_fingerprints: [
          "14:6D:E9:83:C5:22:75:40:AA:D2:C7:43:AF:0E:98:FE:45:B1:05:41:88:2E:70:C4:B8:31:85:24:D1:6C:54:19"
        ]
      }
    }
  ];

  return new NextResponse(JSON.stringify(data, null, 2), {
    status: 200,
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'public, max-age=86400, must-revalidate'
    }
  });
}
