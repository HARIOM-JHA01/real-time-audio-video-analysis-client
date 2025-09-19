import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const { base64Image } = await request.json();
    if (!base64Image) {
      return NextResponse.json({ error: 'Image is required' }, { status: 400 });
    }
    // Forward to backend server (adjust port/path as needed)
    const backendRes = await fetch('http://localhost:15002/vision-analysis', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ base64Image })
    });
    if (!backendRes.ok) {
      const errText = await backendRes.text();
      return NextResponse.json({ error: errText }, { status: 500 });
    }
    const result = await backendRes.json();
    return NextResponse.json({ result });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to process vision analysis' }, { status: 500 });
  }
}
