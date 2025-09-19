'use client';

import { useState, useCallback, useEffect } from 'react';
import { useVisionEmotion } from '@/hooks/useVisionEmotion';
import MediaCapture from '@/components/MediaCapture';
import InsightsDashboard from '@/components/InsightsDashboard';
import { useWebSocket } from '@/hooks/useWebSocket';
import { useWebSpeechAPI } from '@/hooks/useWebSpeechAPI';
import { useAIInsights } from '@/hooks/useAIInsights';
import Image from 'next/image';

interface Transcription {
  text: string;
  timestamp: number;
  confidence?: number;
  language?: string;
  detectedLanguage?: string;
}

interface VideoAnalysis {
  description: string;
  timestamp: number;
  objects?: string[];
  scene?: string;
  emotions?: { [key: string]: number };
  mood?: string;
}

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

interface TranslationResult {
  originalText: string;
  translatedText: string;
  sourceLanguage: string;
  targetLanguage: string;
  confidence: number;
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

export default function Home() {
  const [transcriptions, setTranscriptions] = useState<Transcription[]>([]);
  const [videoAnalyses, setVideoAnalyses] = useState<VideoAnalysis[]>([]);
  const [isCapturing, setIsCapturing] = useState(false);
  const [emotionHistory, setEmotionHistory] = useState<Array<{
    timestamp: number;
    emotions: { [key: string]: number };
    mood: string;
  }>>([]);
  const [aiInsights, setAIInsights] = useState<{
    sentiment?: SentimentResult;
    keywords?: KeywordResult;
    speechCoach?: SpeechCoachResult;
    translation?: TranslationResult;
  }>({});

  // Vision emotion analysis
  const { analyzeFrame: analyzeVisionFrame } = useVisionEmotion();

  // Smart WebSocket URL selection
  const getWebSocketUrl = () => {
    const isLocalDev = typeof window !== 'undefined' && window.location.hostname === 'localhost';
    const isHttps = typeof window !== 'undefined' && window.location.protocol === 'https:';

    // For now, prioritize local development server since remote server seems down
    if (isLocalDev) {
      if (isHttps) {
        return 'wss://localhost:4000'; // Try secure local first
      } else {
        return 'ws://localhost:4000'; // Insecure local for HTTP
      }
    } else if (isHttps) {
      // Production HTTPS - use secure WebSocket with correct Nginx path
      return 'wss://projects.aux-rolplay.com/real-time-audio-video-analysis/';
    } else {
      // Fallback for other cases
      return 'wss://projects.aux-rolplay.com/real-time-audio-video-analysis/';
    }
  };

  // WebSocket connection to server (for video only now)
  const { isConnected, sendVideoFrame, messages } = useWebSocket(getWebSocketUrl());

  // Web Speech API for transcription
  const {
    isListening,
    startListening,
    stopListening,
    isSupported,
    error: speechError,
    results: speechResults,
    currentLanguage,
    setLanguage
  } = useWebSpeechAPI();

  // AI Insights for sentiment, keywords, etc.
  const {
    analyzeSentiment,
    extractKeywords,
    translateText,
    isLoading: aiLoading
  } = useAIInsights();  // Debug state tracking
  useEffect(() => {
    console.log('🔄 App state update:', {
      transcriptionsCount: transcriptions.length,
      videoAnalysesCount: videoAnalyses.length,
      speechResultsCount: speechResults.length,
      isConnected,
      isCapturing,
      isListening,
      speechSupported: isSupported,
      speechError: speechError,
      currentLanguage,
      messagesCount: messages.length,
      aiInsightsKeys: Object.keys(aiInsights),
      hasAIInsights: Object.keys(aiInsights).length > 0
    });
  }, [transcriptions, videoAnalyses, speechResults, isConnected, isCapturing, isListening, isSupported, speechError, currentLanguage, messages, aiInsights]);

  // Extract emotions from text using keyword analysis
  const extractEmotionsFromText = useCallback((text: string): { [key: string]: number } => {
    const lowerText = text.toLowerCase();
    const emotions: { [key: string]: number } = {};

    // Happiness indicators
    const happinessWords = ['happy', 'joy', 'joyful', 'great', 'amazing', 'wonderful', 'excellent', 'fantastic', 'love', 'excited', 'cheerful', 'pleased', 'delighted', 'content', 'upbeat', 'good', 'awesome', 'perfect'];
    const happinessScore = happinessWords.reduce((score, word) => 
      score + (lowerText.includes(word) ? 0.15 : 0), 0);
    emotions.happiness = Math.min(happinessScore, 1.0);

    // Sadness indicators
    const sadnessWords = ['sad', 'melancholy', 'down', 'depressed', 'gloomy', 'unhappy', 'sorrowful', 'disappointed', 'upset', 'terrible', 'awful', 'bad', 'horrible'];
    const sadnessScore = sadnessWords.reduce((score, word) => 
      score + (lowerText.includes(word) ? 0.2 : 0), 0);
    emotions.sadness = Math.min(sadnessScore, 1.0);

    // Excitement indicators
    const excitementWords = ['excited', 'energetic', 'enthusiastic', 'thrilled', 'animated', 'vibrant', 'wow', 'incredible', 'unbelievable', 'amazing', 'fantastic'];
    const excitementScore = excitementWords.reduce((score, word) => 
      score + (lowerText.includes(word) ? 0.2 : 0), 0);
    emotions.excitement = Math.min(excitementScore, 1.0);

    // Calmness indicators
    const calmnessWords = ['calm', 'peaceful', 'relaxed', 'serene', 'tranquil', 'composed', 'steady', 'quiet', 'still', 'gentle'];
    const calmnessScore = calmnessWords.reduce((score, word) => 
      score + (lowerText.includes(word) ? 0.2 : 0), 0);
    emotions.calmness = Math.min(calmnessScore, 1.0);

    // Stress indicators
    const stressWords = ['stressed', 'tense', 'anxious', 'worried', 'overwhelmed', 'frantic', 'agitated', 'nervous', 'concerned', 'trouble', 'problem', 'difficult', 'hard'];
    const stressScore = stressWords.reduce((score, word) => 
      score + (lowerText.includes(word) ? 0.2 : 0), 0);
    emotions.stress = Math.min(stressScore, 1.0);

    // Focus indicators
    const focusWords = ['focused', 'concentrated', 'attentive', 'engaged', 'absorbed', 'thinking', 'considering', 'working', 'studying'];
    const focusScore = focusWords.reduce((score, word) => 
      score + (lowerText.includes(word) ? 0.2 : 0), 0);
    emotions.focus = Math.min(focusScore, 1.0);

    // Default neutral state if no emotions detected
    const totalEmotions = Object.values(emotions).reduce((sum, val) => sum + val, 0);
    if (totalEmotions === 0) {
      emotions.neutral = 0.7;
    }

    return emotions;
  }, []);

  // Perform AI analysis on transcribed text
  const performAIAnalysis = useCallback(async (text: string, language: string) => {
    try {
      console.log('🤖 Starting AI analysis for:', text.substring(0, 50) + '...');

      // Extract emotions from the transcribed text
      const emotions = extractEmotionsFromText(text);
      console.log('😊 Emotions extracted from audio:', emotions);

      // Add emotions to emotion history
      const emotionData = {
        timestamp: Date.now(),
        emotions,
        mood: 'neutral', // Could be enhanced with mood extraction
        source: 'audio'
      };

      setEmotionHistory(prev => [...prev.slice(-19), emotionData]); // Keep last 20 entries

      // Run sentiment analysis and keyword extraction in parallel
      const [sentiment, keywords] = await Promise.all([
        analyzeSentiment(text, language),
        extractKeywords(text, language)
      ]);

      if (sentiment) {
        console.log('💭 Sentiment analysis:', sentiment);
        setAIInsights(prev => {
          const newInsights = { ...prev, sentiment };
          console.log('💭 Updated AI insights with sentiment:', newInsights);
          return newInsights;
        });
      }

      if (keywords) {
        console.log('🔑 Keywords extracted:', keywords);
        setAIInsights(prev => {
          const newInsights = { ...prev, keywords };
          console.log('🔑 Updated AI insights with keywords:', newInsights);
          return newInsights;
        });
      }

      // If not English, also provide translation
      if (language.startsWith('es')) {
        const translation = await translateText(text, language, 'en-US');
        if (translation) {
          console.log('🌐 Translation:', translation);
          setAIInsights(prev => ({ ...prev, translation }));
        }
      }

    } catch (error) {
      console.error('❌ AI analysis error:', error);
    }
  }, [analyzeSentiment, extractKeywords, translateText, extractEmotionsFromText]);

  // Handle speech recognition results with AI analysis
  useEffect(() => {
    console.log('🎤 Processing speech results:', speechResults.length, 'total results');
    
    speechResults.forEach(async (result, index) => {
      console.log(`🎤 Processing result ${index}:`, {
        text: result.text,
        isFinal: result.isFinal,
        confidence: result.confidence,
        timestamp: result.timestamp
      });

      // Process both interim and final results for better responsiveness
      if (result.text && result.text.trim().length > 2) {
        console.log('🎤 Adding transcription:', result.isFinal ? 'FINAL' : 'INTERIM');

        // Add transcription to state
        setTranscriptions(prev => {
          const newTranscription = {
            text: result.text.trim(),
            timestamp: result.timestamp,
            confidence: result.confidence,
            language: result.language,
            detectedLanguage: result.detectedLanguage
          };

          // For interim results, replace the last interim result if it exists
          if (!result.isFinal) {
            const newResults = [...prev];
            const lastIndex = newResults.length - 1;

            // If the last result was also interim (no confidence usually means interim)
            if (lastIndex >= 0 && (!newResults[lastIndex].confidence || newResults[lastIndex].confidence < 0.95)) {
              console.log('🎤 Replacing last interim result');
              newResults[lastIndex] = newTranscription;
              return newResults;
            } else {
              console.log('🎤 Adding new interim result');
              return [...prev, newTranscription];
            }
          } else {
            // For final results, avoid duplicates but add new ones
            const exists = prev.some(t =>
              t.text === newTranscription.text &&
              Math.abs(t.timestamp - newTranscription.timestamp) < 2000
            );

            if (!exists) {
              console.log('🎤 Adding new FINAL transcription to state');

              // Trigger AI analysis for meaningful final text
              if (result.text.trim().length > 3) {
                console.log('🎤 Triggering AI analysis for:', result.text.trim());
                performAIAnalysis(result.text.trim(), result.language);
              }

              return [...prev, newTranscription];
            } else {
              console.log('🎤 Duplicate final result, skipping');
            }
          }

          return prev;
        });
      } else {
        console.log('🎤 Skipping empty or too short result:', result.text);
      }
    });
  }, [speechResults, performAIAnalysis]);

  // Handle incoming WebSocket messages
  useEffect(() => {
    console.log('📨 Processing messages:', messages.length, 'total messages');

    messages.forEach((message, index) => {
      console.log(`📨 Message ${index + 1}:`, message);

      switch (message.type) {
        case 'transcription':
          console.log('🎤 Transcription received:', {
            text: message.data.text || message.data,
            confidence: message.data.confidence,
            timestamp: message.timestamp
          });

          setTranscriptions(prev => {
            const newTranscription = {
              text: message.data.text || message.data,
              timestamp: message.timestamp,
              confidence: message.data.confidence
            };
            console.log('🎤 Adding transcription to state:', newTranscription);
            console.log('🎤 Previous transcriptions count:', prev.length);
            return [...prev, newTranscription];
          });
          break;

        case 'video-analysis':
          console.log('🎥 Video analysis received:', message.data);

          // Extract emotion data and add to history
          const emotionData = {
            timestamp: message.timestamp,
            emotions: message.data.emotions || {},
            mood: message.data.mood || 'neutral',
            source: 'video'
          };

          setEmotionHistory(prev => [...prev.slice(-19), emotionData]); // Keep last 20 entries

          setVideoAnalyses(prev => [...prev, {
            description: message.data.description || message.data,
            timestamp: message.timestamp,
            objects: message.data.objects,
            scene: message.data.scene,
            emotions: message.data.emotions,
            mood: message.data.mood
          }]);
          break;

        case 'error':
          console.error('❌ Server error:', message.data);
          break;

        default:
          console.warn('❓ Unknown message type:', message.type, message);
      }
    });
  }, [messages]);

  const handleAudioData = useCallback(async (audioBlob: Blob) => {
    console.log('🎤 Audio data received (not used for transcription):', audioBlob.size, 'bytes');
    // We're using Web Speech API instead of sending audio to server
  }, []);

  const handleVideoFrame = useCallback(async (frameData: string) => {
    sendVideoFrame(frameData);
    // Also run vision-based emotion analysis
    // Remove data URL prefix if present
    const base64Image = frameData.startsWith('data:image') ? frameData.split(',')[1] : frameData;
    try {
      const visionResult = await analyzeVisionFrame(base64Image);
      if (visionResult) {
        // Add to emotion history
        setEmotionHistory(prev => [
          ...prev.slice(-19),
          {
            timestamp: Date.now(),
            emotions: visionResult.emotions || {},
            mood: visionResult.mood || 'neutral',
            source: 'vision'
          }
        ]);
        // Add to video analyses
        setVideoAnalyses(prev => [
          ...prev,
          {
            description: visionResult.description,
            timestamp: Date.now(),
            objects: visionResult.objects,
            scene: visionResult.scene,
            emotions: visionResult.emotions,
            mood: visionResult.mood
          }
        ]);
      }
    } catch (err) {
      console.error('Vision emotion analysis failed:', err);
    }
  }, [sendVideoFrame, analyzeVisionFrame]);

  // Start/stop capture handlers
  const handleStartCapture = useCallback(() => {
    console.log('🎥 Starting capture...', { isSupported, speechError });
    setIsCapturing(true);
    
    if (isSupported && !speechError) {
      console.log('🎤 Starting speech recognition...');
      startListening();
    } else {
      console.warn('⚠️ Speech recognition not available:', { isSupported, speechError });
    }
  }, [isSupported, speechError, startListening]);

  const handleStopCapture = useCallback(() => {
    console.log('🛑 Stopping capture...');
    setIsCapturing(false);
    stopListening();
  }, [stopListening]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-purple-50">
      <div className="max-w-7xl mx-auto p-6 space-y-6">
        {/* Modern Header */}
        <div className="text-center bg-white/80 backdrop-blur-sm rounded-3xl p-8 shadow-xl border border-white/20">
          <div className="flex items-center justify-center gap-4 mb-6">
            {/* <div className="text-5xl animate-pulse">🎭</div> */}
            <Image src="/rolplay-logo.webp" alt="RolPlay Logo" width={80} height={80} className="rounded-full" />
            <h1 className="text-5xl font-black bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 bg-clip-text text-transparent">
              RolPlay AI Analytics
            </h1>
          </div>
          <p className="text-xl text-gray-600 max-w-3xl mx-auto leading-relaxed">
            Advanced emotion detection and real-time mood analysis powered by AI
          </p>
          <div className="flex items-center justify-center gap-6 mt-8 flex-wrap">
            <div className="flex items-center gap-3 bg-gradient-to-r from-blue-500/10 to-blue-600/10 px-4 py-2 rounded-full">
              <span className="w-3 h-3 bg-blue-500 rounded-full animate-pulse"></span>
              <span className="text-sm font-medium text-blue-700">Multi-Modal Insights</span>
            </div>
            <div className="flex items-center gap-3 bg-gradient-to-r from-green-500/10 to-green-600/10 px-4 py-2 rounded-full">
              <span className="w-3 h-3 bg-green-500 rounded-full animate-pulse"></span>
              <span className="text-sm font-medium text-green-700">Emotion Detection</span>
            </div>
            <div className="flex items-center gap-3 bg-gradient-to-r from-purple-500/10 to-purple-600/10 px-4 py-2 rounded-full">
              <span className="w-3 h-3 bg-purple-500 rounded-full animate-pulse"></span>
              <span className="text-sm font-medium text-purple-700">Real-time Analysis</span>
            </div>
          </div>

          {/* Connection Status */}
          <div className="flex items-center justify-center gap-4 mt-6 pt-6 border-t border-gray-200">
            <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium ${
              isConnected 
                ? 'bg-green-100 text-green-700 border border-green-200' 
                : 'bg-red-100 text-red-700 border border-red-200'
            }`}>
              <span className={`w-2 h-2 rounded-full ${isConnected ? 'bg-green-500' : 'bg-red-500'}`}></span>
              {isConnected ? 'Connected' : 'Disconnected'}
            </div>
            <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium ${
              isSupported && !speechError
                ? 'bg-blue-100 text-blue-700 border border-blue-200' 
                : 'bg-yellow-100 text-yellow-700 border border-yellow-200'
            }`}>
              <span className={`w-2 h-2 rounded-full ${isSupported && !speechError ? 'bg-blue-500' : 'bg-yellow-500'}`}></span>
              {speechError ? 'Speech Error' : isSupported ? 'Speech Ready' : 'Speech Unavailable'}
            </div>
          </div>

          {/* Error Messages */}
          {speechError && (
            <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg">
              <div className="flex items-center gap-2 text-red-700">
                <span className="text-sm">⚠️</span>
                <span className="text-sm font-medium">Speech Recognition Error:</span>
              </div>
              <p className="text-sm text-red-600 mt-1">{speechError}</p>
              <button
                onClick={() => {
                  console.log('🔄 Retrying speech recognition...');
                  stopListening();
                  setTimeout(() => startListening(), 500);
                }}
                className="mt-2 px-3 py-1 bg-red-100 hover:bg-red-200 text-red-700 text-xs rounded-md transition-colors"
              >
                Retry
              </button>
            </div>
          )}

          {/* Language Selector */}
          <div className="flex items-center justify-center gap-4 mt-4">
            <span className="text-sm font-medium text-gray-700">Language:</span>
            <select
              value={currentLanguage}
              onChange={(e) => setLanguage(e.target.value)}
              className="px-4 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent bg-white shadow-sm"
            >
              <option value="en-US">🇺🇸 English (US)</option>
              <option value="es-ES">🇪🇸 Español (España)</option>
              <option value="es-MX">🇲🇽 Español (México)</option>
            </select>
          </div>

          {/* Debug Panel for Speech Recognition */}
          {process.env.NODE_ENV === 'development' && (
            <div className="mt-4 p-3 bg-gray-50 border border-gray-200 rounded-lg text-xs">
              <div className="font-semibold text-gray-700 mb-2">🐛 Debug Info:</div>
              <div className="grid grid-cols-2 gap-2 text-gray-600">
                <div>Speech Results: {speechResults.length}</div>
                <div>Transcriptions: {transcriptions.length}</div>
                <div>Is Listening: {isListening ? '✅' : '❌'}</div>
                <div>Is Supported: {isSupported ? '✅' : '❌'}</div>
                <div>Error: {speechError || 'None'}</div>
                <div>Language: {currentLanguage}</div>
              </div>
              {speechResults.length > 0 && (
                <div className="mt-2">
                  <div className="font-semibold text-gray-700">Last Result:</div>
                  <div className="text-gray-600 italic">"{speechResults[speechResults.length - 1]?.text}"</div>
                  <div className="text-gray-500">Final: {speechResults[speechResults.length - 1]?.isFinal ? '✅' : '❌'}</div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Media Capture and Analysis Section */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
          {/* Video Preview */}
          <div className="bg-white/80 backdrop-blur-sm rounded-3xl border border-white/20 p-8 shadow-xl h-fit min-h-[500px]">
            <div className="flex items-center gap-4 mb-8">
              <div className="p-3 bg-gradient-to-r from-indigo-500 to-purple-500 rounded-2xl">
                <div className="text-2xl">🎥</div>
              </div>
              <div>
                <h2 className="text-3xl font-bold text-gray-900">Video Preview</h2>
                <p className="text-gray-600">Real-time video capture</p>
              </div>
            </div>
            <MediaCapture
              onAudioData={handleAudioData}
              onVideoFrame={handleVideoFrame}
              onStartCapture={handleStartCapture}
              onStopCapture={handleStopCapture}
            />
          </div>

          {/* Current Emotion Analysis */}
          <div className="bg-white/80 backdrop-blur-sm rounded-3xl border border-white/20 p-8 shadow-xl h-fit min-h-[500px]">
            <div className="flex items-center gap-4 mb-8">
              <div className="p-3 bg-gradient-to-r from-pink-500 to-rose-500 rounded-2xl">
                <div className="text-2xl">😊</div>
              </div>
              <div>
                <h2 className="text-3xl font-bold text-gray-900">Current Emotions</h2>
                <p className="text-gray-600">Real-time emotion detection</p>
              </div>
            </div>
            
            {/* Current Emotion Display */}
            {emotionHistory.length > 0 && (
              <div className="space-y-6 h-full flex flex-col justify-between">
                <div className="bg-gradient-to-r from-purple-50 to-pink-50 rounded-2xl p-6">
                  <h3 className="text-lg font-semibold text-gray-800 mb-4">Current Mood</h3>
                  <div className="text-center">
                    <div className="text-6xl mb-3">
                      {emotionHistory[emotionHistory.length - 1]?.mood === 'happy' && '😊'}
                      {emotionHistory[emotionHistory.length - 1]?.mood === 'sad' && '😢'}
                      {emotionHistory[emotionHistory.length - 1]?.mood === 'excited' && '🤩'}
                      {emotionHistory[emotionHistory.length - 1]?.mood === 'calm' && '😌'}
                      {emotionHistory[emotionHistory.length - 1]?.mood === 'focused' && '🤔'}
                      {emotionHistory[emotionHistory.length - 1]?.mood === 'stressed' && '😰'}
                      {(!emotionHistory[emotionHistory.length - 1]?.mood || emotionHistory[emotionHistory.length - 1]?.mood === 'neutral') && '😐'}
                    </div>
                    <p className="text-xl font-medium text-gray-700 capitalize">
                      {emotionHistory[emotionHistory.length - 1]?.mood || 'neutral'}
                    </p>
                  </div>
                </div>

                {/* Current Emotion Bars - always show all 8 */}
                <div className="space-y-3">
                  <h3 className="text-lg font-semibold text-gray-800">Emotion Levels</h3>
                  {['happiness', 'sadness', 'excitement', 'calmness', 'stress', 'focus', 'angry', 'neutral'].map((emotion, emotionIndex) => {
                    const value = emotionHistory[emotionHistory.length - 1]?.emotions?.[emotion] ?? 0;
                    return (
                      <div key={emotionIndex} className="space-y-1">
                        <div className="flex justify-between text-sm">
                          <span className="capitalize text-gray-700">{emotion}</span>
                          <span className="text-gray-500">{Math.round(value * 100)}%</span>
                        </div>
                        <div className="w-full bg-gray-200 rounded-full h-2">
                          <div
                            className={`h-2 rounded-full transition-all duration-300 ${
                              emotion === 'happiness' ? 'bg-yellow-400' :
                              emotion === 'sadness' ? 'bg-blue-400' :
                              emotion === 'excitement' ? 'bg-orange-400' :
                              emotion === 'calmness' ? 'bg-green-400' :
                              emotion === 'stress' ? 'bg-red-400' :
                              emotion === 'focus' ? 'bg-purple-400' :
                              emotion === 'angry' ? 'bg-rose-600' :
                              emotion === 'neutral' ? 'bg-gray-400' :
                              'bg-gray-300'
                            }`}
                            style={{ width: `${value * 100}%` }}
                          ></div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
            
            {emotionHistory.length === 0 && (
              <div className="text-center py-20 text-gray-500 h-full flex flex-col justify-center">
                <div className="text-8xl mb-6">🎭</div>
                <h3 className="text-xl font-medium mb-2">Emotion Detection Ready</h3>
                <p className="text-gray-400">Start video capture to see real-time emotion analysis</p>
                <div className="mt-8 space-y-2">
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div className="bg-gradient-to-r from-purple-400 to-pink-400 h-2 rounded-full w-0"></div>
                  </div>
                  <p className="text-sm text-gray-400">Waiting for first analysis...</p>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Emotion Timeline Graphs */}
        <div className="bg-white/80 backdrop-blur-sm rounded-3xl border border-white/20 p-8 shadow-xl">
          <div className="flex items-center gap-4 mb-8">
            <div className="p-3 bg-gradient-to-r from-green-500 to-teal-500 rounded-2xl">
              <div className="text-2xl">📈</div>
            </div>
            <div>
              <h2 className="text-3xl font-bold text-gray-900">Emotion Timeline</h2>
              <p className="text-gray-600">Track emotional changes over time</p>
            </div>
          </div>
          
          {emotionHistory.length > 1 ? (
            <div className="space-y-6">
              {/* Timeline Graph */}
              <div className="bg-gradient-to-r from-blue-50 to-purple-50 rounded-2xl p-6">
                <h3 className="text-lg font-semibold text-gray-800 mb-4">Emotion Trends</h3>
                <div className="relative h-64 w-full">
                  <svg className="w-full h-full" viewBox="0 0 800 200">
                    {/* Grid lines */}
                    {[0, 1, 2, 3, 4].map(i => (
                      <line 
                        key={i} 
                        x1="50" 
                        y1={40 + i * 32} 
                        x2="750" 
                        y2={40 + i * 32} 
                        stroke="#e5e7eb" 
                        strokeWidth="1"
                      />
                    ))}
                    
                    {/* Emotion lines */}
                    {['happiness', 'sadness', 'excitement', 'calmness', 'stress', 'focus'].map((emotion) => {
                      const color = {
                        happiness: '#fbbf24',
                        sadness: '#60a5fa',
                        excitement: '#fb7185',
                        calmness: '#34d399',
                        stress: '#f87171',
                        focus: '#a78bfa'
                      }[emotion];
                      
                      const points = emotionHistory.slice(-20).map((entry, index) => {
                        const x = 50 + (index / 19) * 700;
                        const y = 168 - (entry.emotions[emotion] || 0) * 128;
                        return `${x},${y}`;
                      }).join(' ');
                      
                      return (
                        <polyline 
                          key={emotion}
                          fill="none" 
                          stroke={color} 
                          strokeWidth="2"
                          points={points}
                        />
                      );
                    })}
                    
                    {/* Y-axis labels */}
                    <text x="25" y="45" textAnchor="middle" className="text-xs fill-gray-500">100%</text>
                    <text x="25" y="105" textAnchor="middle" className="text-xs fill-gray-500">50%</text>
                    <text x="25" y="175" textAnchor="middle" className="text-xs fill-gray-500">0%</text>
                  </svg>
                </div>
                
                {/* Legend */}
                <div className="flex flex-wrap gap-4 mt-4 justify-center">
                  {[
                    { emotion: 'happiness', color: '#fbbf24', emoji: '😊' },
                    { emotion: 'sadness', color: '#60a5fa', emoji: '😢' },
                    { emotion: 'excitement', color: '#fb7185', emoji: '🤩' },
                    { emotion: 'calmness', color: '#34d399', emoji: '😌' },
                    { emotion: 'stress', color: '#f87171', emoji: '😰' },
                    { emotion: 'focus', color: '#a78bfa', emoji: '🤔' }
                  ].map(({ emotion, color, emoji }) => (
                    <div key={emotion} className="flex items-center gap-2 text-sm">
                      <div className="w-3 h-3 rounded-full" style={{ backgroundColor: color }}></div>
                      <span className="capitalize text-gray-700">{emoji} {emotion}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            <div className="text-center py-12 text-gray-500">
              <div className="text-6xl mb-4">📊</div>
              <p>Emotion timeline will appear after video analysis starts</p>
            </div>
          )}
        </div>

        {/* AI Insights Dashboard */}
        <InsightsDashboard
          transcriptions={transcriptions}
          videoAnalyses={videoAnalyses}
          emotionHistory={emotionHistory}
          isConnected={isConnected}
          aiInsights={aiInsights}
          aiLoading={aiLoading}
        />
      </div>
    </div>
  );
}