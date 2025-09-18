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

                {/* Current Emotion Bars - always show all 6 */}
                <div className="space-y-3">
                  <h3 className="text-lg font-semibold text-gray-800">Emotion Levels</h3>
                  {['happiness', 'sadness', 'excitement', 'calmness', 'stress', 'focus'].map((emotion) => {
                    const value = emotionHistory[emotionHistory.length - 1]?.emotions?.[emotion] ?? 0;
                    return (
                      <div key={emotion} className="space-y-1">
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
                              'bg-gray-400'
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
                    {['happiness', 'sadness', 'excitement', 'calmness', 'stress', 'focus'].map((emotion, emotionIndex) => {
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

        {/* Multiple AI Insights */}
        <div className="space-y-6">
          <div className="flex items-center gap-4 mb-8">
            <div className="p-3 bg-gradient-to-r from-purple-500 to-pink-500 rounded-2xl">
              <div className="text-2xl">🤖</div>
            </div>
            <div>
              <h2 className="text-3xl font-bold text-gray-900">AI Insights</h2>
              <p className="text-gray-600">Multiple intelligence analysis streams</p>
            </div>
          </div>

          {/* AI Insights Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
            
            {/* Sentiment Analysis */}
            <div className="bg-white/80 backdrop-blur-sm rounded-2xl border border-white/20 p-6 shadow-lg">
              <div className="flex items-center gap-3 mb-4">
                <div className="p-2 bg-gradient-to-r from-green-400 to-blue-500 rounded-lg">
                  <div className="text-lg">💭</div>
                </div>
                <h3 className="text-lg font-semibold text-gray-800">Sentiment Analysis</h3>
              </div>
              {aiInsights.sentiment ? (
                <div className="space-y-3">
                  <div className={`px-3 py-2 rounded-full text-sm font-medium ${
                    aiInsights.sentiment.sentiment === 'positive' ? 'bg-green-100 text-green-700' :
                    aiInsights.sentiment.sentiment === 'negative' ? 'bg-red-100 text-red-700' :
                    'bg-gray-100 text-gray-700'
                  }`}>
                    {aiInsights.sentiment.sentiment === 'positive' ? '😊 Positive' :
                     aiInsights.sentiment.sentiment === 'negative' ? '😔 Negative' :
                     '😐 Neutral'}
                  </div>
                  <div className="text-sm text-gray-600">
                    Confidence: {Math.round(aiInsights.sentiment.confidence * 100)}%
                  </div>
                  <div className="text-sm text-gray-700">
                    {aiInsights.sentiment.reasoning}
                  </div>
                  {aiInsights.sentiment.emotions && aiInsights.sentiment.emotions.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-2">
                      {aiInsights.sentiment.emotions.map((emotion, idx) => (
                        <span key={idx} className="px-2 py-1 bg-blue-50 text-blue-700 text-xs rounded-full">
                          {emotion}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              ) : (
                <div className="text-center text-gray-500 py-4">
                  <div className="text-2xl mb-2">�</div>
                  <p className="text-sm">Waiting for speech...</p>
                </div>
              )}
            </div>

            {/* Keywords Extraction */}
            <div className="bg-white/80 backdrop-blur-sm rounded-2xl border border-white/20 p-6 shadow-lg">
              <div className="flex items-center gap-3 mb-4">
                <div className="p-2 bg-gradient-to-r from-yellow-400 to-orange-500 rounded-lg">
                  <div className="text-lg">🔑</div>
                </div>
                <h3 className="text-lg font-semibold text-gray-800">Key Topics</h3>
              </div>
              {aiInsights.keywords ? (
                <div className="space-y-3">
                  <div className={`px-3 py-2 rounded-full text-sm font-medium ${
                    aiInsights.keywords.urgency === 'high' ? 'bg-red-100 text-red-700' :
                    aiInsights.keywords.urgency === 'medium' ? 'bg-yellow-100 text-yellow-700' :
                    'bg-green-100 text-green-700'
                  }`}>
                    {aiInsights.keywords.urgency === 'high' ? '🔴 High Priority' :
                     aiInsights.keywords.urgency === 'medium' ? '🟡 Medium Priority' :
                     '🟢 Low Priority'}
                  </div>
                  
                  {aiInsights.keywords.keywords && aiInsights.keywords.keywords.length > 0 && (
                    <div>
                      <p className="text-xs text-gray-500 mb-2">Keywords:</p>
                      <div className="flex flex-wrap gap-1">
                        {aiInsights.keywords.keywords.slice(0, 6).map((keyword, idx) => (
                          <span key={idx} className="px-2 py-1 bg-purple-50 text-purple-700 text-xs rounded-full">
                            {keyword}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                  
                  {aiInsights.keywords.categories && (
                    <div className="space-y-2">
                      {Object.entries(aiInsights.keywords.categories).map(([category, items]) => 
                        items.length > 0 && (
                          <div key={category}>
                            <p className="text-xs text-gray-500 capitalize">{category}:</p>
                            <div className="flex flex-wrap gap-1">
                              {items.slice(0, 3).map((item, idx) => (
                                <span key={idx} className="px-2 py-1 bg-indigo-50 text-indigo-700 text-xs rounded-full">
                                  {item}
                                </span>
                              ))}
                            </div>
                          </div>
                        )
                      )}
                    </div>
                  )}
                </div>
              ) : (
                <div className="text-center text-gray-500 py-4">
                  <div className="text-2xl mb-2">🔄</div>
                  <p className="text-sm">Analyzing topics...</p>
                </div>
              )}
            </div>

            {/* Translation (if available) */}
            {aiInsights.translation && (
              <div className="bg-white/80 backdrop-blur-sm rounded-2xl border border-white/20 p-6 shadow-lg">
                <div className="flex items-center gap-3 mb-4">
                  <div className="p-2 bg-gradient-to-r from-blue-400 to-purple-500 rounded-lg">
                    <div className="text-lg">🌐</div>
                  </div>
                  <h3 className="text-lg font-semibold text-gray-800">Translation</h3>
                </div>
                <div className="space-y-3">
                  <div className="text-sm">
                    <span className="text-gray-500">From:</span> {aiInsights.translation.sourceLanguage}
                  </div>
                  <div className="text-sm">
                    <span className="text-gray-500">To:</span> {aiInsights.translation.targetLanguage}
                  </div>
                  <div className="bg-blue-50 rounded-lg p-3 text-sm text-blue-800">
                    {aiInsights.translation.translatedText}
                  </div>
                  <div className="text-xs text-gray-500">
                    Confidence: {Math.round(aiInsights.translation.confidence * 100)}%
                  </div>
                </div>
              </div>
            )}

            {/* Video Analysis Summary */}
            {videoAnalyses.length > 0 && (
              <div className="bg-white/80 backdrop-blur-sm rounded-2xl border border-white/20 p-6 shadow-lg">
                <div className="flex items-center gap-3 mb-4">
                  <div className="p-2 bg-gradient-to-r from-pink-400 to-red-500 rounded-lg">
                    <div className="text-lg">👁️</div>
                  </div>
                  <h3 className="text-lg font-semibold text-gray-800">Visual Analysis</h3>
                </div>
                <div className="space-y-3">
                  <div className="text-sm text-gray-700 leading-relaxed max-h-32 overflow-y-auto">
                    {videoAnalyses[videoAnalyses.length - 1]?.description}
                  </div>
                  {videoAnalyses[videoAnalyses.length - 1]?.objects && (
                    <div>
                      <p className="text-xs text-gray-500 mb-2">Objects detected:</p>
                      <div className="flex flex-wrap gap-1">
                        {videoAnalyses[videoAnalyses.length - 1].objects.slice(0, 4).map((obj, idx) => (
                          <span key={idx} className="px-2 py-1 bg-green-50 text-green-700 text-xs rounded-full">
                            {obj}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                  {videoAnalyses[videoAnalyses.length - 1]?.scene && (
                    <div className="text-sm">
                      <span className="text-gray-500">Scene:</span> {videoAnalyses[videoAnalyses.length - 1].scene}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Transcription Summary */}
            {transcriptions.length > 0 && (
              <div className="bg-white/80 backdrop-blur-sm rounded-2xl border border-white/20 p-6 shadow-lg">
                <div className="flex items-center gap-3 mb-4">
                  <div className="p-2 bg-gradient-to-r from-teal-400 to-green-500 rounded-lg">
                    <div className="text-lg">🎤</div>
                  </div>
                  <h3 className="text-lg font-semibold text-gray-800">Speech Summary</h3>
                </div>
                <div className="space-y-3">
                  <div className="text-sm text-gray-500">
                    Total transcriptions: {transcriptions.length}
                  </div>
                  {transcriptions.length > 0 && (
                    <div className="bg-teal-50 rounded-lg p-3 text-sm text-teal-800 leading-relaxed max-h-32 overflow-y-auto">
                      {transcriptions[transcriptions.length - 1]?.text}
                    </div>
                  )}
                  <div className="text-xs text-gray-500">
                    Last updated: {new Date(transcriptions[transcriptions.length - 1]?.timestamp || Date.now()).toLocaleTimeString()}
                  </div>
                </div>
              </div>
            )}

            {/* Connection Status */}
            <div className="bg-white/80 backdrop-blur-sm rounded-2xl border border-white/20 p-6 shadow-lg">
              <div className="flex items-center gap-3 mb-4">
                <div className="p-2 bg-gradient-to-r from-gray-400 to-slate-500 rounded-lg">
                  <div className="text-lg">📡</div>
                </div>
                <h3 className="text-lg font-semibold text-gray-800">System Status</h3>
              </div>
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600">WebSocket:</span>
                  <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                    isConnected ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                  }`}>
                    {isConnected ? 'Connected' : 'Disconnected'}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600">Speech API:</span>
                  <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                    isSupported ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                  }`}>
                    {isSupported ? 'Ready' : 'Unavailable'}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600">Listening:</span>
                  <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                    isListening ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-700'
                  }`}>
                    {isListening ? 'Active' : 'Idle'}
                  </span>
                </div>
                {aiLoading && (
                  <div className="flex items-center gap-2 text-sm text-blue-600">
                    <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-blue-600"></div>
                    <span>AI Processing...</span>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}