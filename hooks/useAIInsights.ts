import { useState, useCallback } from 'react';

interface SentimentResult {
    sentiment: 'positive' | 'negative' | 'neutral';
    confidence: number;
    emotions: string[];
    reasoning: string;
}

interface KeywordResult {
    keywords: string[];
    categories: {
        business: string[];
        time: string[];
        emotions: string[];
        actions: string[];
    };
    urgency: 'low' | 'medium' | 'high';
}

interface SpeechCoachResult {
    fillerWords: {
        count: number;
        words: string[];
        percentage: number;
    };
    speakingPace: {
        wordsPerMinute: number;
        assessment: 'too slow' | 'good' | 'too fast';
    };
    confidence: {
        level: 'low' | 'medium' | 'high';
        indicators: string[];
    };
    feedback: string[];
}

interface TranslationResult {
    originalText: string;
    translatedText: string;
    sourceLanguage: string;
    targetLanguage: string;
    confidence: number;
}

interface UseAIInsightsReturn {
    analyzeSentiment: (text: string, language?: string) => Promise<SentimentResult | null>;
    extractKeywords: (text: string, language?: string) => Promise<KeywordResult | null>;
    analyzeSpeech: (text: string, duration: number, language?: string) => Promise<SpeechCoachResult | null>;
    translateText: (text: string, sourceLanguage: string, targetLanguage: string) => Promise<TranslationResult | null>;
    isLoading: boolean;
    error: string | null;
}

export const useAIInsights = (): UseAIInsightsReturn => {
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const callOpenAI = useCallback(async (prompt: string, maxTokens: number = 500) => {
        try {
            const response = await fetch('/api/ai-insights', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ prompt, maxTokens }),
            });

            if (!response.ok) {
                throw new Error('Failed to get AI insights');
            }

            const data = await response.json();
            let cleanResponse = data.response;

            // Clean up markdown code blocks if present
            if (cleanResponse.includes('```json')) {
                cleanResponse = cleanResponse.replace(/```json\s*/g, '').replace(/```\s*/g, '');
            }

            // Remove any leading/trailing whitespace
            cleanResponse = cleanResponse.trim();

            console.log('🤖 Cleaned AI response:', cleanResponse);

            return cleanResponse;
        } catch (err) {
            console.error('AI Insights API error:', err);
            throw err;
        }
    }, []); const analyzeSentiment = useCallback(async (text: string, language: string = 'en'): Promise<SentimentResult | null> => {
        setIsLoading(true);
        setError(null);

        try {
            const languageContext = language.startsWith('es') ? 'Spanish' : 'English';

            const prompt = `Analyze the sentiment of this ${languageContext} text and respond with a JSON object:

Text: "${text}"

Respond with exactly this JSON structure:
{
  "sentiment": "positive|negative|neutral",
  "confidence": 0.0-1.0,
  "emotions": ["emotion1", "emotion2"],
  "reasoning": "brief explanation"
}

Be precise and analyze the emotional tone, context, and word choice.`;

            const response = await callOpenAI(prompt, 300);
            console.log('🤖 Raw sentiment response:', response);

            const result = JSON.parse(response);
            console.log('🤖 Parsed sentiment result:', result);

            return result;
        } catch (err) {
            console.error('❌ Sentiment analysis error:', err);
            setError('Failed to analyze sentiment');
            return null;
        } finally {
            setIsLoading(false);
        }
    }, [callOpenAI]);

    const extractKeywords = useCallback(async (text: string, language: string = 'en'): Promise<KeywordResult | null> => {
        setIsLoading(true);
        setError(null);

        try {
            const languageContext = language.startsWith('es') ? 'Spanish' : 'English';

            const prompt = `Extract keywords and categorize them from this ${languageContext} text:

Text: "${text}"

Respond with exactly this JSON structure:
{
  "keywords": ["keyword1", "keyword2"],
  "categories": {
    "business": ["meeting", "deadline"],
    "time": ["today", "tomorrow"],
    "emotions": ["happy", "stressed"],
    "actions": ["call", "send"]
  },
  "urgency": "low|medium|high"
}

Focus on important terms, business context, temporal indicators, and action items.`;

            const response = await callOpenAI(prompt, 400);
            console.log('🤖 Raw keywords response:', response);

            const result = JSON.parse(response);
            console.log('🤖 Parsed keywords result:', result);

            return result;
        } catch (err) {
            console.error('❌ Keywords extraction error:', err);
            setError('Failed to extract keywords');
            return null;
        } finally {
            setIsLoading(false);
        }
    }, [callOpenAI]);

    const analyzeSpeech = useCallback(async (text: string, duration: number, language: string = 'en'): Promise<SpeechCoachResult | null> => {
        setIsLoading(true);
        setError(null);

        try {
            const languageContext = language.startsWith('es') ? 'Spanish' : 'English';
            const wordCount = text.split(/\s+/).length;
            const wordsPerMinute = Math.round((wordCount / duration) * 60);

            const prompt = `Analyze this ${languageContext} speech for public speaking coaching:

Text: "${text}"
Duration: ${duration} seconds
Word count: ${wordCount}
Words per minute: ${wordsPerMinute}

Respond with exactly this JSON structure:
{
  "fillerWords": {
    "count": 0,
    "words": ["um", "uh"],
    "percentage": 0.0
  },
  "speakingPace": {
    "wordsPerMinute": ${wordsPerMinute},
    "assessment": "too slow|good|too fast"
  },
  "confidence": {
    "level": "low|medium|high",
    "indicators": ["clear articulation", "hesitation"]
  },
  "feedback": ["specific feedback point 1", "specific feedback point 2"]
}

Analyze filler words, speaking pace (ideal: 150-160 WPM), confidence indicators, and provide constructive feedback.`;

            const response = await callOpenAI(prompt, 500);
            const result = JSON.parse(response);

            return result;
        } catch (err) {
            setError('Failed to analyze speech');
            return null;
        } finally {
            setIsLoading(false);
        }
    }, [callOpenAI]);

    const translateText = useCallback(async (text: string, sourceLanguage: string, targetLanguage: string): Promise<TranslationResult | null> => {
        setIsLoading(true);
        setError(null);

        try {
            const sourceLang = sourceLanguage.startsWith('es') ? 'Spanish' : 'English';
            const targetLang = targetLanguage.startsWith('es') ? 'Spanish' : 'English';

            const prompt = `Translate this text from ${sourceLang} to ${targetLang}:

Text: "${text}"

Respond with exactly this JSON structure:
{
  "originalText": "${text}",
  "translatedText": "translated version",
  "sourceLanguage": "${sourceLang}",
  "targetLanguage": "${targetLang}",
  "confidence": 0.0-1.0
}

Provide a natural, accurate translation that preserves meaning and context.`;

            const response = await callOpenAI(prompt, 300);
            const result = JSON.parse(response);

            return result;
        } catch (err) {
            setError('Failed to translate text');
            return null;
        } finally {
            setIsLoading(false);
        }
    }, [callOpenAI]);

    return {
        analyzeSentiment,
        extractKeywords,
        analyzeSpeech,
        translateText,
        isLoading,
        error
    };
};