import { useState, useCallback } from 'react';

export interface VisionEmotionResult {
  description: string;
  objects?: string[];
  scene?: string;
  mood?: string;
  emotions?: { [key: string]: number };
}

export function useVisionEmotion() {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const analyzeFrame = useCallback(async (base64Image: string): Promise<VisionEmotionResult | null> => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await fetch('/api/vision-analysis', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ base64Image })
      });
      if (!response.ok) throw new Error('Failed to analyze frame');
      const data = await response.json();
      return data.result as VisionEmotionResult;
    } catch (err) {
      setError('Vision analysis failed');
      return null;
    } finally {
      setIsLoading(false);
    }
  }, []);

  return { analyzeFrame, isLoading, error };
}
