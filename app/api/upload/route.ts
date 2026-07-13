import { NextRequest, NextResponse } from 'next/server';
import { UTApi } from 'uploadthing/server';

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get('image') as File | null;
    if (!file) {
      return NextResponse.json({ error: 'No file provided.' }, { status: 400 });
    }

    // --- Primary upload: UploadThing (handles both images and videos) ---
    try {
      const utapi = new UTApi();
      const response = await utapi.uploadFiles(file);

      if (response && response.data) {
        const url = response.data.ufsUrl || response.data.url;
        return NextResponse.json({ data: { url } });
      }

      const errMessage = response?.error?.message || 'Unknown UploadThing error';
      console.warn('UploadThing did not return a URL, falling back to ImgBB:', errMessage);
    } catch (uploadthingErr: unknown) {
      console.warn(
        'UploadThing upload failed, falling back to ImgBB:',
        uploadthingErr instanceof Error ? uploadthingErr.message : uploadthingErr
      );
    }

    // --- Fallback: ImgBB (images only) ---
    if (file.type.startsWith('video/') || file.name.endsWith('.webm')) {
      // Videos have no ImgBB fallback
      return NextResponse.json(
        { error: 'UploadThing failed and ImgBB does not support video files.' },
        { status: 500 }
      );
    }

    const apiKey = process.env.IMGBB_APIKEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: 'UploadThing failed and ImgBB API key is not configured.' },
        { status: 500 }
      );
    }

    const imgbbFormData = new FormData();
    imgbbFormData.append('image', file);

    const res = await fetch(`https://api.imgbb.com/1/upload?key=${apiKey}`, {
      method: 'POST',
      body: imgbbFormData,
    });

    if (!res.ok) {
      const errText = await res.text();
      return NextResponse.json(
        { error: `ImgBB fallback upload failed: ${errText}` },
        { status: res.status }
      );
    }

    // ImgBB returns { data: { url, ... }, status, success }
    // Shape is already compatible with what callers expect.
    const data = await res.json();
    return NextResponse.json(data);
  } catch (error: unknown) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Server error uploading file' },
      { status: 500 }
    );
  }
}

