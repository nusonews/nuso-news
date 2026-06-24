import { NextResponse } from 'next/server';
import { getLinks, updateLink, deleteLink } from '../../../../data/db';

export const runtime = 'nodejs';

export async function PUT(request, { params }) {
  try {
    const { id } = await params;
    const body = await request.json();

    if (!id) {
      return NextResponse.json({ success: false, error: "Missing link ID" }, { status: 400 });
    }

    if (body.code) {
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

      // Check if code is taken by another link
      const allLinks = await getLinks();
      const isTaken = allLinks.some(l => l.code === code && l.id !== id);
      if (isTaken) {
        return NextResponse.json({ 
          success: false, 
          error: `Short code "${code}" is already in use by another link.` 
        }, { status: 400 });
      }
    }

    const updated = await updateLink(id, body);
    if (!updated) {
      return NextResponse.json({ success: false, error: "Link not found" }, { status: 404 });
    }

    return NextResponse.json({ success: true, link: updated });
  } catch (error) {
    console.error("API PUT Link error:", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function DELETE(request, { params }) {
  try {
    const { id } = await params;
    if (!id) {
      return NextResponse.json({ success: false, error: "Missing link ID" }, { status: 400 });
    }

    const success = await deleteLink(id);
    if (!success) {
      return NextResponse.json({ success: false, error: "Link not found or could not be deleted" }, { status: 404 });
    }

    return NextResponse.json({ success: true, message: "Link deleted successfully" });
  } catch (error) {
    console.error("API DELETE Link error:", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
