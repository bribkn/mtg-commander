import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const slug = searchParams.get('slug');

    if (!slug) {
      return NextResponse.json(
        { error: 'Missing slug parameter' },
        { status: 400 }
      );
    }

    // First try the commanders endpoint
    let edhrecUrl = `https://json.edhrec.com/pages/commanders/${slug}.json`;
    let res = await fetch(edhrecUrl, {
      next: { revalidate: 3600 }, // Cache for 1 hour
    });

    // If it fails or is 404, fallback to standard cards endpoint
    if (!res.ok) {
      edhrecUrl = `https://json.edhrec.com/pages/cards/${slug}.json`;
      res = await fetch(edhrecUrl, {
        next: { revalidate: 3600 }, // Cache for 1 hour
      });
    }

    if (!res.ok) {
      return NextResponse.json(
        { error: `EDHREC API returned status ${res.status}` },
        { status: res.status }
      );
    }

    const data = await res.json();
    return NextResponse.json(data);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal Server Error' },
      { status: 500 }
    );
  }
}
