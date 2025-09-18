import { useState, useEffect, useRef, useCallback } from 'react';

interface SpeechRecognitionResult {
    text: string;
    confidence: number;
    isFinal: boolean;
    timestamp: number;
    language: string;
    detectedLanguage?: string;
}

interface UseWebSpeechAPIReturn {
    isListening: boolean;
    startListening: (language?: string) => void;
    stopListening: () => void;
    isSupported: boolean;
    error: string | null;
    results: SpeechRecognitionResult[];
    currentLanguage: string;
    setLanguage: (language: string) => void;
    supportedLanguages: string[];
}

// Extend the Window interface to include webkitSpeechRecognition
declare global {
    interface Window {
        SpeechRecognition: any;
        webkitSpeechRecognition: any;
    }
}

// Simple language detection based on common words
const detectLanguage = (text: string, currentLang: string): string => {
    const lowerText = text.toLowerCase();

    // Spanish indicators
    const spanishWords = ['el', 'la', 'y', 'de', 'en', 'un', 'es', 'se', 'no', 'te', 'lo', 'le', 'da', 'su', 'por', 'son', 'con', 'para', 'una', 'que', 'pero', 'como', 'muy', 'donde', 'cuando', 'porque', 'mientras', 'hola', 'gracias', 'por favor'];

    // English indicators
    const englishWords = ['the', 'and', 'of', 'in', 'to', 'a', 'is', 'it', 'you', 'that', 'he', 'was', 'for', 'on', 'are', 'as', 'with', 'his', 'they', 'at', 'be', 'this', 'have', 'from', 'or', 'one', 'had', 'by', 'word', 'but', 'not', 'what', 'all', 'were', 'we', 'when', 'your', 'can', 'said', 'there', 'each', 'which', 'she', 'do', 'how', 'their', 'if', 'will', 'up', 'other', 'about', 'out', 'many', 'then', 'them', 'these', 'so', 'some', 'her', 'would', 'make', 'like', 'into', 'him', 'time', 'has', 'two', 'more', 'very', 'after', 'words', 'long', 'than', 'first', 'been', 'call', 'who', 'its', 'now', 'find', 'long', 'down', 'day', 'did', 'get', 'come', 'made', 'may', 'part'];

    const words = lowerText.split(/\s+/);
    let spanishScore = 0;
    let englishScore = 0;

    words.forEach(word => {
        if (spanishWords.includes(word)) spanishScore++;
        if (englishWords.includes(word)) englishScore++;
    });

    // If we detect significant Spanish content, suggest Spanish
    if (spanishScore > englishScore && spanishScore > 0) {
        return 'es-ES';
    }

    // Default to current language or English
    return currentLang;
};

export const useWebSpeechAPI = (): UseWebSpeechAPIReturn => {
    const [isListening, setIsListening] = useState(false);
    const [isSupported, setIsSupported] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [results, setResults] = useState<SpeechRecognitionResult[]>([]);
    const [currentLanguage, setCurrentLanguage] = useState('en-US');

    const supportedLanguages = ['en-US', 'es-ES', 'es-MX'];

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
    const initializeRecognition = useCallback((language: string = currentLanguage) => {
        if (!isSupported) return null;

        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        const recognition = new SpeechRecognition();

        // Configuration
        recognition.continuous = true;           // Keep listening
        recognition.interimResults = true;       // Get interim results
        recognition.lang = language;             // Set language dynamically
        recognition.maxAlternatives = 3;        // Get more alternatives for language detection
        
        // Additional configuration for better performance
        if ('serviceURI' in recognition) {
            // Some browsers support service URI for better recognition
        }
        
        // Set grammars for better accuracy (if supported)
        if ('grammars' in recognition && (window as any).SpeechGrammarList) {
            const grammar = '#JSGF V1.0; grammar phrases; public <phrase> = hello | goodbye | yes | no | please | thank you | excuse me | sorry ;';
            const speechRecognitionList = new (window as any).SpeechGrammarList();
            speechRecognitionList.addFromString(grammar, 1);
            recognition.grammars = speechRecognitionList;
        }

        // Event handlers
        recognition.onstart = () => {
            console.log('🎤 Speech recognition started in', language);
            setIsListening(true);
            setError(null);
        };

        recognition.onend = () => {
            console.log('🛑 Speech recognition ended');
            setIsListening(false);
            
            // Auto-restart if we're supposed to be listening and it wasn't an error that stopped it
            if (isListening && !error) {
                console.log('🔄 Auto-restarting speech recognition...');
                setTimeout(() => {
                    try {
                        recognition.start();
                    } catch (e) {
                        console.log('⚠️ Could not auto-restart recognition:', e);
                    }
                }, 100); // Small delay before restart
            }
        };

        recognition.onerror = (event: any) => {
            console.error('❌ Speech recognition error:', event.error);
            
            // Handle different error types more gracefully
            let errorMessage = '';
            switch (event.error) {
                case 'no-speech':
                    // This is not really an error - just no speech detected
                    console.log('ℹ️ No speech detected, continuing to listen...');
                    // Don't show this as an error to the user, just log it
                    return; // Don't set error state for no-speech
                    
                case 'audio-capture':
                    errorMessage = 'Microphone access denied or not available';
                    break;
                    
                case 'not-allowed':
                    errorMessage = 'Microphone permission denied. Please allow microphone access.';
                    break;
                    
                case 'network':
                    errorMessage = 'Network error during speech recognition';
                    break;
                    
                case 'service-not-allowed':
                    errorMessage = 'Speech recognition service not allowed';
                    break;
                    
                default:
                    errorMessage = `Speech recognition error: ${event.error}`;
            }
            
            setError(errorMessage);
            setIsListening(false);
        };

        recognition.onresult = (event: any) => {
            console.log('🎤 Speech recognition result received in', language);

            for (let i = event.resultIndex; i < event.results.length; i++) {
                const result = event.results[i];
                const transcript = result[0].transcript;
                const confidence = result[0].confidence;
                const isFinal = result.isFinal;

                console.log('📝 Transcript:', transcript, 'Final:', isFinal, 'Confidence:', confidence, 'Language:', language);

                // Simple language detection based on common words
                const detectedLanguage = detectLanguage(transcript, language);

                const speechResult: SpeechRecognitionResult = {
                    text: transcript,
                    confidence: confidence || 0.9, // Fallback confidence
                    isFinal,
                    timestamp: Date.now(),
                    language,
                    detectedLanguage
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
    }, [isSupported, currentLanguage]);

    const startListening = useCallback((language?: string) => {
        const langToUse = language || currentLanguage;

        if (!isSupported) {
            setError('Speech recognition not supported');
            return;
        }

        // Clear any previous errors
        setError(null);

        try {
            // Stop any existing recognition
            if (recognitionRef.current) {
                recognitionRef.current.stop();
                recognitionRef.current = null;
            }

            // Small delay to ensure previous recognition is fully stopped
            setTimeout(() => {
                recognitionRef.current = initializeRecognition(langToUse);

                if (recognitionRef.current) {
                    recognitionRef.current.start();
                    console.log('🎤 Starting speech recognition in', langToUse);
                    setCurrentLanguage(langToUse);
                }
            }, 100);
        } catch (err) {
            console.error('❌ Error starting speech recognition:', err);
            setError('Failed to start speech recognition. Please check microphone permissions.');
        }
    }, [isSupported, initializeRecognition, currentLanguage]);

    const stopListening = useCallback(() => {
        if (recognitionRef.current) {
            recognitionRef.current.stop();
            console.log('🛑 Stopping speech recognition...');
        }
    }, []);

    const setLanguage = useCallback((language: string) => {
        if (supportedLanguages.includes(language)) {
            setCurrentLanguage(language);
            console.log('🌐 Language changed to:', language);
        } else {
            console.warn('❌ Unsupported language:', language);
        }
    }, [supportedLanguages]);

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
        results,
        currentLanguage,
        setLanguage,
        supportedLanguages
    };
};