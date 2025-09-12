'use client';

import { useState, useCallback, useEffect } from 'react';
import MediaCapture from '@/components/MediaCapture';
import InsightsDashboard from '@/components/InsightsDashboard';
import { useWebSocket } from '@/hooks/useWebSocket';

interface Transcription {
  text: string;
  timestamp: number;
  confidence?: number;
}

interface VideoAnalysis {
  description: string;
  timestamp: number;
  objects?: string[];
  scene?: string;
}

export default function Home() {
  const [transcriptions, setTranscriptions] = useState<Transcription[]>([]);
  const [videoAnalyses, setVideoAnalyses] = useState<VideoAnalysis[]>([]);

  // WebSocket connection to server
  const { isConnected, sendAudioData, sendVideoFrame, messages } = useWebSocket('ws://localhost:4000');

  // Handle incoming WebSocket messages
  useEffect(() => {
    messages.forEach((message) => {
      switch (message.type) {
        case 'transcription':
          setTranscriptions(prev => [...prev, {
            text: message.data.text || message.data,
            timestamp: message.timestamp,
            confidence: message.data.confidence
          }]);
          break;
        case 'video-analysis':
          setVideoAnalyses(prev => [...prev, {
            description: message.data.description || message.data,
            timestamp: message.timestamp,
            objects: message.data.objects,
            scene: message.data.scene
          }]);
          break;
        case 'error':
          console.error('Server error:', message.data);
          break;
      }
    });
  }, [messages]);

  const handleAudioData = useCallback((audioBlob: Blob) => {
    sendAudioData(audioBlob);
  }, [sendAudioData]);

  const handleVideoFrame = useCallback((frameData: string) => {
    sendVideoFrame(frameData);
  }, [sendVideoFrame]);

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
              <span>Deepgram Speech-to-Text</span>
            </div>
            <div className="flex items-center gap-2 text-sm text-gray-500">
              <span className="w-2 h-2 bg-purple-500 rounded-full"></span>
              <span>Real-time Processing</span>
            </div>
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
          />
        </div>
      </div>
    </div>
  );
}