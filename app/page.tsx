'use client';

import { useState, useCallback, useEffect } from 'react';
import MediaCapture from '@/components/MediaCapture';
import InsightsDashboard from '@/components/InsightsDashboard';
import { useWebSocket } from '@/hooks/useWebSocket';
import { useWebSpeechAPI } from '@/hooks/useWebSpeechAPI';
import { useAIInsights } from '@/hooks/useAIInsights';

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
  const [aiInsights, setAIInsights] = useState<{
    sentiment?: SentimentResult;
    keywords?: KeywordResult;
    speechCoach?: SpeechCoachResult;
    translation?: TranslationResult;
  }>({});

  // WebSocket connection to server (for video only now)
  const { isConnected, sendVideoFrame, messages } = useWebSocket('wss://projects.aux-rolplay.com/real-time-audio-video-analysis');

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

  // Perform AI analysis on transcribed text
  const performAIAnalysis = useCallback(async (text: string, language: string) => {
    try {
      console.log('🤖 Starting AI analysis for:', text.substring(0, 50) + '...');

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
  }, [analyzeSentiment, extractKeywords, translateText]);

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

          setVideoAnalyses(prev => [...prev, {
            description: message.data.description || message.data,
            timestamp: message.timestamp,
            objects: message.data.objects,
            scene: message.data.scene
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
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-blue-50">
      <div className="max-w-7xl mx-auto p-8 space-y-8">
        {/* Header */}
        <div className="text-center bg-white rounded-2xl p-8 shadow-lg border">
          <div className="flex items-center justify-center gap-3 mb-4">
            <div className="text-4xl">🤖</div>
            <h1 className="text-4xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
              Real-time Audio & Video Analysis
            </h1>
          </div>
          <p className="text-xl text-gray-600 max-w-2xl mx-auto">
            AI-powered live insights from your camera and microphone using cutting-edge technology
          </p>
          <div className="flex items-center justify-center gap-4 mt-6">
            <div className="flex items-center gap-2 text-sm text-gray-500">
              <span className="w-2 h-2 bg-blue-500 rounded-full"></span>
              <span>GPT-4o Vision</span>
            </div>
            <div className="flex items-center gap-2 text-sm text-gray-500">
              <span className="w-2 h-2 bg-green-500 rounded-full"></span>
              <span>Web Speech API</span>
            </div>
            <div className="flex items-center gap-2 text-sm text-gray-500">
              <span className="w-2 h-2 bg-purple-500 rounded-full"></span>
              <span>Real-time Processing</span>
            </div>
          </div>

          {/* Language Selector */}
          <div className="flex items-center justify-center gap-4 mt-6 pt-4 border-t border-gray-200">
            <span className="text-sm font-medium text-gray-700">Speech Language:</span>
            <select
              value={currentLanguage}
              onChange={(e) => setLanguage(e.target.value)}
              className="px-3 py-1 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="en-US">🇺🇸 English (US)</option>
              <option value="es-ES">🇪🇸 Español (España)</option>
              <option value="es-MX">🇲🇽 Español (México)</option>
            </select>
            <span className="text-xs text-gray-500">
              Current: {currentLanguage === 'en-US' ? 'English' : 'Spanish'}
            </span>
          </div>
        </div>

        {/* Media Capture Section */}
        <div className="bg-white rounded-2xl border p-8 shadow-lg">
          <div className="flex items-center gap-3 mb-6">
            <div className="text-2xl">🎥</div>
            <h2 className="text-3xl font-semibold text-gray-900">Media Capture</h2>
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
          <div className="flex items-center gap-3 mb-6">
            <div className="text-2xl">📊</div>
            <h2 className="text-3xl font-semibold text-gray-900">Live Insights</h2>
          </div>
          <InsightsDashboard
            transcriptions={transcriptions}
            videoAnalyses={videoAnalyses}
            isConnected={isConnected}
            aiInsights={aiInsights}
            aiLoading={aiLoading}
          />
        </div>
      </div>
    </div>
  );
}