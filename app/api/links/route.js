import { NextResponse } from 'next/server';
import { getLinks, createLink } from '../../../data/db';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET() {
  try {
    const links = await getLinks();
    // Filter out config/settings links starting with underscore
    const publicLinks = links.filter(l => !l.code.startsWith('_'));
    // Sort by creation date descending
    publicLinks.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    return NextResponse.json({ success: true, links: publicLinks }, {
      headers: {
        'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0'
      }
    });
  } catch (error) {
    console.error("API GET Links error:", error);
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
    
    if (!body.code || !body.destinationUrl) {
      return NextResponse.json({ 
        success: false, 
        error: "Missing required fields: code and destinationUrl" 
      }, { status: 400 });
    }

    const code = body.code.toLowerCase().trim();
    if (code.startsWith('_')) {
      return NextResponse.json({ 
        success: false, 
        error: "Short code cannot start with an underscore." 
      }, { status: 400 });
    }
    if (!/^[a-zA-Z0-9-_]+$/.test(code)) {
      return NextResponse.json({ 
        success: false, 
        error: "Short code can only contain alphanumeric characters, hyphens, and underscores." 
      }, { status: 400 });
    }

    // Check if code is already taken
    const allLinks = await getLinks();
    const isTaken = allLinks.some(l => l.code === code);
    if (isTaken) {
      return NextResponse.json({ 
        success: false, 
        error: `Short code "${code}" is already in use.` 
      }, { status: 400 });
    }

    const link = await createLink(body);
    return NextResponse.json({ success: true, link });
  } catch (error) {
    console.error("API POST Link error:", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
