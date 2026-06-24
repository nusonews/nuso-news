import { NextResponse } from 'next/server';
import { getLinks, createLink } from '../../../data/db';

export const runtime = 'nodejs';

export async function GET() {
  try {
    const links = await getLinks();
    // Sort by creation date descending
    links.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    return NextResponse.json({ success: true, links });
  } catch (error) {
    console.error("API GET Links error:", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
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
