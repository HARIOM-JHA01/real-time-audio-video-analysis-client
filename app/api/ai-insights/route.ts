import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';

const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
});

export async function POST(request: NextRequest) {
    try {
        const { prompt, maxTokens = 500 } = await request.json();

        if (!prompt) {
            return NextResponse.json(
                { error: 'Prompt is required' },
                { status: 400 }
            );
        }

        console.log('🤖 AI Insights request:', { promptLength: prompt.length, maxTokens });

        const completion = await openai.chat.completions.create({
            model: 'gpt-4o',
            messages: [
                {
                    role: 'system',
                    content: 'You are an AI assistant specialized in analyzing speech and text for sentiment, keywords, and providing coaching feedback. Always respond with valid JSON as requested. Be precise and helpful.'
                },
                {
                    role: 'user',
                    content: prompt
                }
            ],
            max_tokens: maxTokens,
            temperature: 0.3, // Lower temperature for more consistent JSON responses
        });

        const response = completion.choices[0]?.message?.content;

        if (!response) {
            throw new Error('No response from OpenAI');
        }

        console.log('🤖 AI Insights response:', { responseLength: response.length });

        return NextResponse.json({
            response,
            usage: completion.usage
        });

    } catch (error) {
        console.error('❌ AI Insights API error:', error);

        return NextResponse.json(
            { error: 'Failed to process AI insights request' },
            { status: 500 }
        );
    }
}