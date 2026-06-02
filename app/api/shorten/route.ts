import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const targetUrl = searchParams.get('url');

  if (!targetUrl) {
    return NextResponse.json({ error: 'Missing url parameter' }, { status: 400 });
  }

  // --- Primary: CleanURI (POST, JSON, no registration, no intermediate page) ---
  try {
    const response = await fetch('https://cleanuri.com/api/v1/shorten', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: `url=${encodeURIComponent(targetUrl)}`,
      next: { revalidate: 0 },
    });

    if (!response.ok) {
      throw new Error(`cleanuri returned status ${response.status}`);
    }

    const data = await response.json() as { result_url?: string; error?: string };
    if (!data.result_url || !data.result_url.startsWith('http')) {
      throw new Error(data.error ?? 'cleanuri returned no valid URL');
    }

    return new Response(data.result_url, {
      status: 200,
      headers: { 'Content-Type': 'text/plain' },
    });
  } catch (err) {
    console.warn('Primary shortener cleanuri.com failed, falling back to da.gd:', err);
  }

  // --- Fallback: da.gd (GET, plain text, no registration, no intermediate page) ---
  try {
    const response = await fetch(`https://da.gd/s?url=${encodeURIComponent(targetUrl)}`, {
      method: 'GET',
      next: { revalidate: 0 },
    });

    if (!response.ok) {
      throw new Error(`da.gd returned status ${response.status}`);
    }

    const shortUrl = (await response.text()).trim();
    if (!shortUrl || !shortUrl.startsWith('http')) {
      throw new Error('da.gd returned invalid short URL');
    }

    return new Response(shortUrl, {
      status: 200,
      headers: { 'Content-Type': 'text/plain' },
    });
  } catch (fallbackErr) {
    console.error('All URL shortening services failed:', fallbackErr);
    return NextResponse.json({ error: 'URL shortening services unavailable' }, { status: 502 });
  }
}
