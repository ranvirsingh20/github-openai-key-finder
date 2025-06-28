import { OpenAI } from 'openai';
import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const { apiKey } = await request.json();

    if (!apiKey) {
      return NextResponse.json(
        { valid: false, error: 'API key is required' },
        { status: 400 }
      );
    }

    const openai = new OpenAI({
      apiKey: apiKey,
    });

    // Test the API key with a minimal request
    await openai.models.list();

    return NextResponse.json({ valid: true });
  } catch (error: any) {
    return NextResponse.json({
      valid: false,
      error: error.message || 'Invalid API key',
    });
  }
}