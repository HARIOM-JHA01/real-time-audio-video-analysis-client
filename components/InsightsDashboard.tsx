'use client';

import { useState, useEffect } from 'react';

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

interface AIInsights {
  sentiment?: {
    sentiment: string;
    confidence: number;
    emotions: string[];
    reasoning: string;
  };
  keywords?: {
    keywords: string[];
    categories: {
      business: string[];
      time: string[];
      emotions: string[];
      actions: string[];
    };
    urgency: string;
  };
  translation?: {
    originalText: string;
    translatedText: string;
    sourceLanguage: string;
    targetLanguage: string;
    confidence: number;
  };
}

interface InsightsDashboardProps {
  transcriptions: Transcription[];
  videoAnalyses: VideoAnalysis[];
  isConnected: boolean;
  aiInsights?: AIInsights;
  aiLoading?: boolean;
}

export default function InsightsDashboard({
  transcriptions,
  videoAnalyses,
  isConnected,
  aiInsights,
  aiLoading
}: InsightsDashboardProps) {
  const [currentTranscription, setCurrentTranscription] = useState<string>('');
  const [latestVideoAnalysis, setLatestVideoAnalysis] = useState<VideoAnalysis | null>(null);
  const [isListening, setIsListening] = useState<boolean>(false);

  // Debug AI insights
  useEffect(() => {
    console.log('📊 Dashboard AI insights update:', {
      hasAIInsights: !!aiInsights,
      aiInsightsKeys: aiInsights ? Object.keys(aiInsights) : [],
      sentiment: aiInsights?.sentiment,
      keywords: aiInsights?.keywords,
      translation: aiInsights?.translation
    });
  }, [aiInsights]);

  useEffect(() => {
    // Update current transcription with the latest
    if (transcriptions.length > 0) {
      const latest = transcriptions[transcriptions.length - 1];
      setCurrentTranscription(latest.text);
      setIsListening(true);

      // Reset listening status after 3 seconds of no new transcriptions
      const timer = setTimeout(() => setIsListening(false), 3000);
      return () => clearTimeout(timer);
    }
  }, [transcriptions]);

  useEffect(() => {
    // Update latest video analysis
    if (videoAnalyses.length > 0) {
      setLatestVideoAnalysis(videoAnalyses[videoAnalyses.length - 1]);
    }
  }, [videoAnalyses]);

  const formatTime = (timestamp: number) => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString();
  };

  return (
    <div className="space-y-8">
      {/* Connection Status */}
      <div className="bg-white rounded-xl p-6 shadow-sm border">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className={`w-4 h-4 rounded-full ${isConnected ? 'bg-green-500 animate-pulse' : 'bg-red-500'}`} />
            <span className="text-lg font-semibold">
              {isConnected ? '🟢 Connected to Server' : '🔴 Disconnected from Server'}
            </span>
          </div>

          {isConnected && (
            <div className="flex items-center gap-2 text-sm text-gray-600">
              <span>Status:</span>
              <span className="text-green-600 font-medium">Online</span>
            </div>
          )}
        </div>
      </div>

      {/* Current Insights */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Live Transcription */}
        <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-xl border border-blue-200 p-6 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-xl font-semibold text-blue-900 flex items-center gap-2">
              🎤 Live Transcription
            </h3>
            {isListening && (
              <div className="flex items-center gap-2 text-blue-600">
                <div className="w-2 h-2 bg-blue-500 rounded-full animate-ping"></div>
                <span className="text-sm font-medium">Listening...</span>
              </div>
            )}
          </div>

          <div className="min-h-[120px] p-4 bg-white/70 rounded-lg border border-blue-200">
            {currentTranscription ? (
              <p className="text-gray-800 leading-relaxed text-lg">{currentTranscription}</p>
            ) : (
              <div className="flex items-center justify-center h-full text-gray-500 italic">
                <div className="text-center">
                  <div className="text-3xl mb-2">👂</div>
                  <p>Listening for speech...</p>
                </div>
              </div>
            )}
          </div>

          {transcriptions.length > 0 && (
            <div className="mt-3 text-sm text-blue-700 flex items-center justify-between">
              <span>Last updated: {formatTime(transcriptions[transcriptions.length - 1].timestamp)}</span>
              <span className="bg-blue-100 px-2 py-1 rounded-full text-xs">
                {transcriptions.length} transcription{transcriptions.length !== 1 ? 's' : ''}
              </span>
            </div>
          )}
        </div>

        {/* Video Scene Analysis */}
        <div className="bg-gradient-to-br from-purple-50 to-pink-50 rounded-xl border border-purple-200 p-6 shadow-sm">
          <h3 className="text-xl font-semibold mb-4 text-purple-900 flex items-center gap-2">
            👁️ Scene Analysis
          </h3>

          <div className="min-h-[120px] p-4 bg-white/70 rounded-lg border border-purple-200">
            {latestVideoAnalysis ? (
              <div className="space-y-3">
                <p className="text-gray-800 leading-relaxed text-lg">{latestVideoAnalysis.description}</p>
                {latestVideoAnalysis.objects && latestVideoAnalysis.objects.length > 0 && (
                  <div className="flex flex-wrap gap-1">
                    {latestVideoAnalysis.objects.map((object, index) => (
                      <span
                        key={index}
                        className="px-3 py-1 bg-purple-100 text-purple-800 text-sm rounded-full border border-purple-200"
                      >
                        {object}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              <div className="flex items-center justify-center h-full text-gray-500 italic">
                <div className="text-center">
                  <div className="text-3xl mb-2">👀</div>
                  <p>Waiting for video analysis...</p>
                </div>
              </div>
            )}
          </div>

          {latestVideoAnalysis && (
            <div className="mt-3 text-sm text-purple-700 flex items-center justify-between">
              <span>Last updated: {formatTime(latestVideoAnalysis.timestamp)}</span>
              <span className="bg-purple-100 px-2 py-1 rounded-full text-xs">
                {videoAnalyses.length} analysis{videoAnalyses.length !== 1 ? 'es' : ''}
              </span>
            </div>
          )}
        </div>
      </div>

      {/* AI Insights Section */}
      {aiInsights && Object.keys(aiInsights).length > 0 && (
        <div className="bg-gradient-to-br from-green-50 to-emerald-50 rounded-xl border border-green-200 p-6 shadow-sm">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-xl font-semibold text-green-900 flex items-center gap-2">
              🤖 AI Insights
            </h3>
            {aiLoading && (
              <div className="flex items-center gap-2 text-green-600">
                <div className="w-3 h-3 bg-green-500 rounded-full animate-pulse"></div>
                <span className="text-sm">Analyzing...</span>
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {/* Sentiment Analysis */}
            {aiInsights.sentiment && (
              <div className="bg-white/70 rounded-lg p-4 border border-green-200">
                <h4 className="font-semibold text-green-800 mb-2 flex items-center gap-2">
                  💭 Sentiment
                </h4>
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <span className={`px-3 py-1 rounded-full text-sm font-medium ${aiInsights.sentiment.sentiment === 'positive' ? 'bg-green-100 text-green-800' :
                      aiInsights.sentiment.sentiment === 'negative' ? 'bg-red-100 text-red-800' :
                        'bg-gray-100 text-gray-800'
                      }`}>
                      {aiInsights.sentiment.sentiment}
                    </span>
                    <span className="text-xs text-gray-600">
                      {Math.round(aiInsights.sentiment.confidence * 100)}%
                    </span>
                  </div>
                  {aiInsights.sentiment.emotions.length > 0 && (
                    <div className="flex flex-wrap gap-1">
                      {aiInsights.sentiment.emotions.map((emotion, idx) => (
                        <span key={idx} className="px-2 py-1 bg-blue-100 text-blue-700 text-xs rounded-full">
                          {emotion}
                        </span>
                      ))}
                    </div>
                  )}
                  <p className="text-sm text-gray-600 italic">{aiInsights.sentiment.reasoning}</p>
                </div>
              </div>
            )}

            {/* Keywords */}
            {aiInsights.keywords && (
              <div className="bg-white/70 rounded-lg p-4 border border-green-200">
                <h4 className="font-semibold text-green-800 mb-2 flex items-center gap-2">
                  🔑 Keywords
                </h4>
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <span className={`px-3 py-1 rounded-full text-sm font-medium ${aiInsights.keywords.urgency === 'high' ? 'bg-red-100 text-red-800' :
                      aiInsights.keywords.urgency === 'medium' ? 'bg-yellow-100 text-yellow-800' :
                        'bg-gray-100 text-gray-800'
                      }`}>
                      {aiInsights.keywords.urgency} urgency
                    </span>
                  </div>
                  {aiInsights.keywords.keywords.length > 0 && (
                    <div className="flex flex-wrap gap-1">
                      {aiInsights.keywords.keywords.slice(0, 8).map((keyword, idx) => (
                        <span key={idx} className="px-2 py-1 bg-purple-100 text-purple-700 text-xs rounded-full">
                          {keyword}
                        </span>
                      ))}
                    </div>
                  )}
                  {Object.entries(aiInsights.keywords.categories).map(([category, words]) => (
                    words.length > 0 && (
                      <div key={category} className="text-xs">
                        <span className="font-medium capitalize text-gray-700">{category}:</span>
                        <span className="text-gray-600 ml-1">{words.slice(0, 3).join(', ')}</span>
                      </div>
                    )
                  ))}
                </div>
              </div>
            )}

            {/* Translation */}
            {aiInsights.translation && (
              <div className="bg-white/70 rounded-lg p-4 border border-green-200">
                <h4 className="font-semibold text-green-800 mb-2 flex items-center gap-2">
                  🌐 Translation
                </h4>
                <div className="space-y-2">
                  <div className="text-xs text-gray-600">
                    {aiInsights.translation.sourceLanguage} → {aiInsights.translation.targetLanguage}
                  </div>
                  <div className="text-sm">
                    <div className="font-medium text-gray-700 mb-1">Original:</div>
                    <div className="text-gray-600 italic">{aiInsights.translation.originalText.substring(0, 100)}...</div>
                  </div>
                  <div className="text-sm">
                    <div className="font-medium text-gray-700 mb-1">Translation:</div>
                    <div className="text-gray-800">{aiInsights.translation.translatedText}</div>
                  </div>
                  <div className="text-xs text-gray-500">
                    Confidence: {Math.round(aiInsights.translation.confidence * 100)}%
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* History Sections */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Transcription History */}
        <div className="bg-white rounded-xl border p-6 shadow-sm">
          <h3 className="text-xl font-semibold mb-4 text-gray-800 flex items-center gap-2">
            📝 Transcription History
          </h3>
          <div className="max-h-80 overflow-y-auto space-y-3">
            {transcriptions.length > 0 ? (
              transcriptions.slice(-10).reverse().map((transcription, index) => (
                <div key={index} className="p-4 bg-gray-50 rounded-lg border hover:bg-gray-100 transition-colors">
                  <p className="text-gray-800 leading-relaxed">{transcription.text}</p>
                  <div className="flex justify-between items-center mt-3 text-sm text-gray-600">
                    <span>{formatTime(transcription.timestamp)}</span>
                    {transcription.confidence && (
                      <span className="bg-green-100 text-green-800 px-2 py-1 rounded-full text-xs font-medium">
                        {Math.round(transcription.confidence * 100)}% confidence
                      </span>
                    )}
                  </div>
                </div>
              ))
            ) : (
              <div className="text-center text-gray-500 italic py-8">
                <div className="text-3xl mb-2">📭</div>
                <p>No transcriptions yet</p>
              </div>
            )}
          </div>
        </div>

        {/* Video Analysis History */}
        <div className="bg-white rounded-xl border p-6 shadow-sm">
          <h3 className="text-xl font-semibold mb-4 text-gray-800 flex items-center gap-2">
            🎬 Video Analysis History
          </h3>
          <div className="max-h-80 overflow-y-auto space-y-3">
            {videoAnalyses.length > 0 ? (
              videoAnalyses.slice(-5).reverse().map((analysis, index) => (
                <div key={index} className="p-4 bg-gray-50 rounded-lg border hover:bg-gray-100 transition-colors">
                  <p className="text-gray-800 leading-relaxed">{analysis.description}</p>
                  <div className="mt-3 text-sm text-gray-600">
                    {formatTime(analysis.timestamp)}
                  </div>
                  {analysis.objects && analysis.objects.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-3">
                      {analysis.objects.map((object, objIndex) => (
                        <span
                          key={objIndex}
                          className="px-2 py-1 bg-blue-100 text-blue-800 text-xs rounded-full"
                        >
                          {object}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              ))
            ) : (
              <div className="text-center text-gray-500 italic py-8">
                <div className="text-3xl mb-2">🎭</div>
                <p>No video analyses yet</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}