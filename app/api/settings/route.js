import { NextResponse } from 'next/server';
import { getGlobalSettings, updateGlobalSettings } from '../../../data/db';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET() {
  try {
    const settings = await getGlobalSettings();
    return NextResponse.json({ success: true, settings }, {
      headers: {
        'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0'
      }
    });
  } catch (error) {
    console.error("API GET Settings error:", error);
    return NextResponse.json({ success: false, error: error.message }, { 
      status: 500,
      headers: {
        'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate'
      }
    });
  }
}

export async function POST(request) {
  try {
    const body = await request.json();
    const settings = await updateGlobalSettings(body);
    return NextResponse.json({ success: true, settings });
  } catch (error) {
    console.error("API POST Settings error:", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
