import { useState, useEffect, useRef, useCallback } from 'react';

interface SpeechRecognitionResult {
    text: string;
    confidence: number;
    isFinal: boolean;
    timestamp: number;
}

interface UseWebSpeechAPIReturn {
    isListening: boolean;
    startListening: () => void;
    stopListening: () => void;
    isSupported: boolean;
    error: string | null;
    results: SpeechRecognitionResult[];
}

// Extend the Window interface to include webkitSpeechRecognition
declare global {
    interface Window {
        SpeechRecognition: any;
        webkitSpeechRecognition: any;
    }
}

export const useWebSpeechAPI = (): UseWebSpeechAPIReturn => {
    const [isListening, setIsListening] = useState(false);
    const [isSupported, setIsSupported] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [results, setResults] = useState<SpeechRecognitionResult[]>([]);

    const recognitionRef = useRef<any>(null);

    // Check for browser support
    useEffect(() => {
        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;

        if (SpeechRecognition) {
            setIsSupported(true);
            console.log('✅ Web Speech API is supported');
        } else {
            setIsSupported(false);
            console.log('❌ Web Speech API is not supported in this browser');
            setError('Speech recognition not supported in this browser');
        }
    }, []);

    // Initialize speech recognition
    const initializeRecognition = useCallback(() => {
        if (!isSupported) return null;

        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        const recognition = new SpeechRecognition();

        // Configuration
        recognition.continuous = true;           // Keep listening
        recognition.interimResults = true;       // Get interim results
        recognition.lang = 'en-US';             // Set language
        recognition.maxAlternatives = 1;        // Number of alternatives

        // Event handlers
        recognition.onstart = () => {
            console.log('🎤 Speech recognition started');
            setIsListening(true);
            setError(null);
        };

        recognition.onend = () => {
            console.log('🛑 Speech recognition ended');
            setIsListening(false);
        };

        recognition.onerror = (event: any) => {
            console.error('❌ Speech recognition error:', event.error);
            setError(`Speech recognition error: ${event.error}`);
            setIsListening(false);
        };

        recognition.onresult = (event: any) => {
            console.log('🎤 Speech recognition result received');

            for (let i = event.resultIndex; i < event.results.length; i++) {
                const result = event.results[i];
                const transcript = result[0].transcript;
                const confidence = result[0].confidence;
                const isFinal = result.isFinal;

                console.log('📝 Transcript:', transcript, 'Final:', isFinal, 'Confidence:', confidence);

                const speechResult: SpeechRecognitionResult = {
                    text: transcript,
                    confidence: confidence || 0.9, // Fallback confidence
                    isFinal,
                    timestamp: Date.now()
                };

                setResults(prev => {
                    // For interim results, replace the last interim result
                    // For final results, add to the list
                    if (isFinal) {
                        return [...prev, speechResult];
                    } else {
                        // Replace last interim result or add new one
                        const newResults = [...prev];
                        const lastIndex = newResults.length - 1;

                        if (lastIndex >= 0 && !newResults[lastIndex].isFinal) {
                            newResults[lastIndex] = speechResult;
                        } else {
                            newResults.push(speechResult);
                        }

                        return newResults;
                    }
                });
            }
        };

        return recognition;
    }, [isSupported]);

    const startListening = useCallback(() => {
        if (!isSupported) {
            setError('Speech recognition not supported');
            return;
        }

        try {
            if (recognitionRef.current) {
                recognitionRef.current.stop();
            }

            recognitionRef.current = initializeRecognition();

            if (recognitionRef.current) {
                recognitionRef.current.start();
                console.log('🎤 Starting speech recognition...');
            }
        } catch (err) {
            console.error('❌ Error starting speech recognition:', err);
            setError('Failed to start speech recognition');
        }
    }, [isSupported, initializeRecognition]);

    const stopListening = useCallback(() => {
        if (recognitionRef.current) {
            recognitionRef.current.stop();
            console.log('🛑 Stopping speech recognition...');
        }
    }, []);

    // Cleanup on unmount
    useEffect(() => {
        return () => {
            if (recognitionRef.current) {
                recognitionRef.current.stop();
            }
        };
    }, []);

    return {
        isListening,
        startListening,
        stopListening,
        isSupported,
        error,
        results
    };
};