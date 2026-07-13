import { NextResponse } from 'next/server';

// Browser-like headers to avoid Cloudflare bot detection.
// json.edhrec.com now hangs for non-browser requests, so we scrape
// the main edhrec.com HTML page and extract its embedded __NEXT_DATA__.
const BROWSER_HEADERS = {
  'User-Agent':
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36',
  Accept:
    'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
  'Accept-Language': 'en-US,en;q=0.9',
};

const NEXT_DATA_START = '<script id="__NEXT_DATA__" type="application/json">';
const NEXT_DATA_END = '</script>';

async function scrapeEdhrecPage(url: string): Promise<Response> {
  return fetch(url, {
    headers: BROWSER_HEADERS,
    // Use no-store so Next.js doesn't cache the raw HTML;
    // we'll cache the extracted JSON ourselves below.
    cache: 'no-store',
    signal: AbortSignal.timeout(15000),
  });
}

function extractNextData(html: string): unknown | null {
  const startIdx = html.indexOf(NEXT_DATA_START);
  if (startIdx < 0) return null;
  const jsonStart = startIdx + NEXT_DATA_START.length;
  const jsonEnd = html.indexOf(NEXT_DATA_END, jsonStart);
  if (jsonEnd < 0) return null;
  return JSON.parse(html.substring(jsonStart, jsonEnd));
}

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

    // Try commanders page first, fall back to cards page
    const urls = [
      `https://edhrec.com/commanders/${slug}`,
      `https://edhrec.com/cards/${slug}`,
    ];

    let lastStatus = 500;
    for (const url of urls) {
      let res: Response;
      try {
        res = await scrapeEdhrecPage(url);
      } catch {
        continue;
      }

      if (!res.ok) {
        lastStatus = res.status;
        continue;
      }

      const html = await res.text();
      let nextData: unknown;
      try {
        nextData = extractNextData(html);
      } catch {
        continue;
      }

      if (!nextData) continue;

      // The __NEXT_DATA__ shape is:
      //   { props: { pageProps: { data: { container: { json_dict: { cardlists: [...] } } } } } }
      // Return just the inner data so the frontend sees the same structure it expects.
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const pageData = (nextData as any)?.props?.pageProps?.data;
      if (!pageData) continue;

      return NextResponse.json(pageData, {
        headers: {
          // Cache for 1 hour in the CDN / Next.js data cache
          'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=300',
        },
      });
    }

    return NextResponse.json(
      { error: `EDHREC returned status ${lastStatus}` },
      { status: lastStatus }
    );
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal Server Error' },
      { status: 500 }
    );
  }
}
