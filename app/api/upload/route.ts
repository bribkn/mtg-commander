import { NextRequest, NextResponse } from 'next/server';

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
        const pixeldrainFormData = new FormData();
        pixeldrainFormData.append('file', file);

        const res = await fetch('https://pixeldrain.com/api/file', {
          method: 'POST',
          body: pixeldrainFormData,
        });

        if (res.ok) {
          const data = await res.json();
          if (data.success && data.id) {
            return NextResponse.json({
              data: {
                url: `https://pixeldrain.com/api/file/${data.id}`
              }
            });
          }
        }
      } catch (pixeldrainErr) {
        console.error('Pixeldrain upload failed, falling back to Catbox:', pixeldrainErr);
      }

      // Fallback to Catbox.moe
      try {
        const catboxFormData = new FormData();
        catboxFormData.append('reqtype', 'fileupload');
        catboxFormData.append('fileToUpload', file);

        const res = await fetch('https://catbox.moe/user/api.php', {
          method: 'POST',
          body: catboxFormData,
        });

        if (res.ok) {
          const catboxUrl = (await res.text()).trim();
          return NextResponse.json({
            data: {
              url: catboxUrl
            }
          });
        } else {
          const errText = await res.text();
          return NextResponse.json({ error: `Upload failed on all providers (Pixeldrain failed, and Catbox failed: ${errText})` }, { status: res.status });
        }
      } catch (catboxErr: any) {
        return NextResponse.json({ error: `Upload failed on all providers. Catbox exception: ${catboxErr.message || catboxErr}` }, { status: 500 });
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
