'use client';

import { useState, useCallback, useEffect } from 'react';
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
      isConnected,
      isCapturing,
      isListening,
      speechSupported: isSupported,
      messagesCount: messages.length,
      aiInsightsKeys: Object.keys(aiInsights),
      hasAIInsights: Object.keys(aiInsights).length > 0
    });
  }, [transcriptions, videoAnalyses, isConnected, isCapturing, isListening, isSupported, messages, aiInsights]);

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
    speechResults.forEach(async result => {
      if (result.isFinal) {
        console.log('🎤 Final transcription:', result);

        // Add transcription to state
        setTranscriptions(prev => {
          const newTranscription = {
            text: result.text.trim(),
            timestamp: result.timestamp,
            confidence: result.confidence,
            language: result.language,
            detectedLanguage: result.detectedLanguage
          };

          // Avoid duplicates
          const exists = prev.some(t =>
            t.text === newTranscription.text &&
            Math.abs(t.timestamp - newTranscription.timestamp) < 1000
          );

          if (!exists) {
            console.log('🎤 Adding new transcription to state');

            // Trigger AI analysis for meaningful text
            if (result.text.trim().length > 5) {  // Reduced from 20 for testing
              performAIAnalysis(result.text.trim(), result.language);
            }

            return [...prev, newTranscription];
          }

          return prev;
        });
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

  const handleVideoFrame = useCallback((frameData: string) => {
    sendVideoFrame(frameData);
  }, [sendVideoFrame]);

  // Start/stop capture handlers
  const handleStartCapture = useCallback(() => {
    setIsCapturing(true);
    if (isSupported) {
      startListening();
    }
  }, [isSupported, startListening]);

  const handleStopCapture = useCallback(() => {
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
              <span className="text-sm font-medium text-blue-700">GPT-4o Vision</span>
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
              isSupported 
                ? 'bg-blue-100 text-blue-700 border border-blue-200' 
                : 'bg-yellow-100 text-yellow-700 border border-yellow-200'
            }`}>
              <span className={`w-2 h-2 rounded-full ${isSupported ? 'bg-blue-500' : 'bg-yellow-500'}`}></span>
              Speech {isSupported ? 'Ready' : 'Unavailable'}
            </div>
          </div>

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
        </div>

        {/* Media Capture Section */}
        <div className="bg-white/80 backdrop-blur-sm rounded-3xl border border-white/20 p-8 shadow-xl">
          <div className="flex items-center gap-4 mb-8">
            <div className="p-3 bg-gradient-to-r from-indigo-500 to-purple-500 rounded-2xl">
              <div className="text-2xl">🎥</div>
            </div>
            <div>
              <h2 className="text-3xl font-bold text-gray-900">Media Capture</h2>
              <p className="text-gray-600">Real-time video and audio processing</p>
            </div>
          </div>
          <MediaCapture
            onAudioData={handleAudioData}
            onVideoFrame={handleVideoFrame}
            onStartCapture={handleStartCapture}
            onStopCapture={handleStopCapture}
          />
        </div>

        {/* Insights Dashboard */}
        <div>
          <div className="flex items-center gap-4 mb-8">
            <div className="p-3 bg-gradient-to-r from-pink-500 to-rose-500 rounded-2xl">
              <div className="text-2xl">📊</div>
            </div>
            <div>
              <h2 className="text-3xl font-bold text-gray-900">Live Insights</h2>
              <p className="text-gray-600">Emotion analysis and mood tracking</p>
            </div>
          </div>
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
    </div>
  );
}