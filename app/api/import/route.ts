import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const source = searchParams.get('source');
  const id = searchParams.get('id');

  if (!source || !id) {
    return NextResponse.json({ error: 'Missing source or id parameters.' }, { status: 400 });
  }

  try {
    let apiUrl = '';
    if (source === 'moxfield') {
      apiUrl = `https://api2.moxfield.com/v3/decks/all/${id}`;
    } else if (source === 'archidekt') {
      apiUrl = `https://archidekt.com/api/decks/${id}/`;
    } else {
      return NextResponse.json({ error: 'Unsupported source.' }, { status: 400 });
    }

    const headers: Record<string, string> = {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Accept': 'application/json',
    };

    if (source === 'moxfield') {
      headers['Referer'] = 'https://www.moxfield.com/';
      headers['Origin'] = 'https://www.moxfield.com';
    } else if (source === 'archidekt') {
      headers['Referer'] = 'https://archidekt.com/';
      headers['Origin'] = 'https://archidekt.com';
    }

    const res = await fetch(apiUrl, { headers });

    if (!res.ok) {
      return NextResponse.json(
        { error: `Import failed: external API returned status ${res.status}` },
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
