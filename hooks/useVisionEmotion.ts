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
      console.log('Sending frame for vision analysis, image length:', base64Image.length);
      const response = await fetch('/api/vision-analysis', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ base64Image })
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error(`Vision analysis failed with status ${response.status}:`, errorText);
        throw new Error(`Failed to analyze frame: ${errorText}`);
      }
      
      const data = await response.json();
      console.log('Vision analysis result:', data);
      return data.result as VisionEmotionResult;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Vision analysis failed';
      console.error('Vision analysis error:', errorMessage);
      setError(errorMessage);
      return null;
    } finally {
      setIsLoading(false);
    }
  }, []);

  return { analyzeFrame, isLoading, error };
}
