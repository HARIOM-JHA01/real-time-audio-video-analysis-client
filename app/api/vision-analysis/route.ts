import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const { base64Image } = await request.json();
    if (!base64Image) {
      return NextResponse.json({ error: 'Image is required' }, { status: 400 });
    }
    // Use env variable for backend URL
    const baseUrl = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:4000';
    const backendUrl = `${baseUrl.replace(/\/$/, '')}/vision-analysis`;
    console.log("Calling backend vision analysis:", backendUrl);
    const backendRes = await fetch(backendUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ base64Image })
    });
    if (!backendRes.ok) {
      const errText = await backendRes.text();
      console.error(`Vision analysis failed with status ${backendRes.status}:`, errText);
      return NextResponse.json({ error: errText }, { status: backendRes.status });
    }
    const result = await backendRes.json();
    return NextResponse.json({ result });
  } catch (error) {
    console.error('Vision analysis error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Failed to process vision analysis';
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}
