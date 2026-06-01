import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  try {
    const apiKey = process.env.IMGBB_APIKEY;
    if (!apiKey) {
      return NextResponse.json({ error: 'ImgBB API key is not configured on the server.' }, { status: 500 });
    }

    const formData = await req.formData();
    const file = formData.get('image') as File | null;
    if (!file) {
      return NextResponse.json({ error: 'No image file provided.' }, { status: 400 });
    }

    // Forward the file directly to ImgBB using FormData
    const imgbbFormData = new FormData();
    imgbbFormData.append('image', file);

    const res = await fetch(`https://api.imgbb.com/1/upload?key=${apiKey}`, {
      method: 'POST',
      body: imgbbFormData,
    });

    if (!res.ok) {
      const errText = await res.text();
      return NextResponse.json({ error: `ImgBB upload failed: ${errText}` }, { status: res.status });
    }

    const data = await res.json();
    return NextResponse.json(data);
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Server error uploading file' }, { status: 500 });
  }
}
