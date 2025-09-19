import { useState, useCallback } from 'react';

export interface TranscriptionResult {
    text: string;
    confidence: number;
    isFinal: boolean;
    timestamp: number;
}

export function useTranscription() {
    const [isTranscribing, setIsTranscribing] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const transcribeAudio = useCallback(async (audioBlob: Blob): Promise<TranscriptionResult | null> => {
        if (isTranscribing) {
            console.log('🎤 Already transcribing, skipping...');
            return null;
        }

        setIsTranscribing(true);
        setError(null);

        return new Promise((resolve) => {
            const reader = new FileReader();
            reader.onload = async () => {
                try {
                    const base64Data = reader.result as string;
                    const audioData = base64Data.split(',')[1]; // Remove data:audio/webm;base64, prefix

                    console.log('🎤 Sending audio to REST API, size:', audioBlob.size, 'bytes');

                    const response = await fetch('https://localhost:4000/transcribe', {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                        },
                        body: JSON.stringify({
                            audioData: audioData,
                            mimeType: audioBlob.type
                        })
                    });

                    if (response.ok) {
                        const result = await response.json();
                        console.log('🎤 Transcription result:', result);

                        const transcriptionResult: TranscriptionResult = {
                            text: result.text || '',
                            confidence: result.confidence || 0.9,
                            isFinal: result.isFinal || true,
                            timestamp: result.timestamp || Date.now()
                        };

                        resolve(transcriptionResult);
                    } else {
                        const errorText = await response.text();
                        console.error('🎤 Transcription API error:', response.status, response.statusText, errorText);
                        setError(`Transcription failed: ${response.status}`);
                        resolve(null);
                    }
                } catch (error) {
                    console.error('🎙️ Error calling transcription API:', error);
                    setError('Network error during transcription');
                    resolve(null);
                } finally {
                    setIsTranscribing(false);
                }
            };

            reader.onerror = () => {
                console.error('🎙️ Error reading audio blob');
                setError('Error reading audio data');
                setIsTranscribing(false);
                resolve(null);
            };

            reader.readAsDataURL(audioBlob);
        });
    }, [isTranscribing]);

    return {
        transcribeAudio,
        isTranscribing,
        error
    };
}