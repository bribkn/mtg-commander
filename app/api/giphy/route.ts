import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const q = searchParams.get('q') || '';
    const type = searchParams.get('type') || 'stickers';

    // Prioritize GIPHY_APIKEY, then GIPHY_API_KEY, then fallback to public beta key
    const apiKey = process.env.GIPHY_APIKEY || process.env.GIPHY_API_KEY || 'dc6zaTOxFJmzC';

    const endpoint = type === 'stickers' ? 'stickers' : 'gifs';
    const url = `https://api.giphy.com/v1/${endpoint}/search?api_key=${apiKey}&q=${encodeURIComponent(
      q
    )}&limit=24&rating=pg`;

    const res = await fetch(url);
    if (!res.ok) {
      return NextResponse.json(
        { error: `GIPHY API returned status ${res.status}` },
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
