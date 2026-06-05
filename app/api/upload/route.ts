import { NextRequest, NextResponse } from 'next/server';
import { UTApi } from 'uploadthing/server';

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get('image') as File | null;
    if (!file) {
      return NextResponse.json({ error: 'No file provided.' }, { status: 400 });
    }

    // Check if it is a video (e.g. WebM)
    if (file.type.startsWith('video/') || file.name.endsWith('.webm')) {
      try {
        const utapi = new UTApi();
        const response = await utapi.uploadFiles(file);
        
        if (response && response.data) {
          const url = response.data.ufsUrl || response.data.url;
          return NextResponse.json({
            data: {
              url: url
            }
          });
        } else {
          const errMessage = response?.error?.message || 'Unknown Uploadthing error';
          return NextResponse.json({ error: `Uploadthing failed: ${errMessage}` }, { status: 500 });
        }
      } catch (uploadthingErr: any) {
        console.error('Uploadthing upload failed:', uploadthingErr);
        return NextResponse.json({ error: `Uploadthing failed: ${uploadthingErr.message || uploadthingErr}` }, { status: 500 });
      }
    }

    // Otherwise, handle as image and upload to ImgBB
    const apiKey = process.env.IMGBB_APIKEY;
    if (!apiKey) {
      return NextResponse.json({ error: 'ImgBB API key is not configured on the server.' }, { status: 500 });
    }

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
