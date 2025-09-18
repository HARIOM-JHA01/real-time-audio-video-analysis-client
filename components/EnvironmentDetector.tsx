'use client';


import { useState, useEffect } from 'react';

// Extend the Window interface for speech recognition properties
type SpeechRecognitionWindow = typeof window & {
  SpeechRecognition?: typeof window.SpeechRecognition;
  webkitSpeechRecognition?: typeof window.SpeechRecognition;
  mozSpeechRecognition?: typeof window.SpeechRecognition;
  msSpeechRecognition?: typeof window.SpeechRecognition;
};

interface EnvironmentInfo {
  browser: string;
  browserVersion: string;
  os: string;
  deviceType: string;
  screenResolution: string;
  language: string;
  timezone: string;
  webRTCSupported: boolean;
  speechRecognitionSupported: boolean;
  mediaDevicesSupported: boolean;
  webSocketSupported: boolean;
}

export default function EnvironmentDetector() {
  const [envInfo, setEnvInfo] = useState<EnvironmentInfo | null>(null);
  const [isDetecting, setIsDetecting] = useState(true);

  useEffect(() => {
    const detectEnvironment = async (): Promise<EnvironmentInfo> => {
      // Browser detection
      const userAgent = navigator.userAgent;
      let browser = 'Unknown';
      let browserVersion = 'Unknown';

      if (userAgent.includes('Chrome') && !userAgent.includes('Edg')) {
        browser = 'Chrome';
        const match = userAgent.match(/Chrome\/(\d+)/);
        browserVersion = match ? match[1] : 'Unknown';
      } else if (userAgent.includes('Firefox')) {
        browser = 'Firefox';
        const match = userAgent.match(/Firefox\/(\d+)/);
        browserVersion = match ? match[1] : 'Unknown';
      } else if (userAgent.includes('Safari') && !userAgent.includes('Chrome')) {
        browser = 'Safari';
        const match = userAgent.match(/Version\/(\d+)/);
        browserVersion = match ? match[1] : 'Unknown';
      } else if (userAgent.includes('Edg')) {
        browser = 'Edge';
        const match = userAgent.match(/Edg\/(\d+)/);
        browserVersion = match ? match[1] : 'Unknown';
      }

      // OS detection
      let os = 'Unknown';
      if (userAgent.includes('Win')) os = 'Windows';
      else if (userAgent.includes('Mac')) os = 'macOS';
      else if (userAgent.includes('Linux')) os = 'Linux';
      else if (userAgent.includes('Android')) os = 'Android';
      else if (userAgent.includes('iPhone') || userAgent.includes('iPad')) os = 'iOS';

      // Device type detection
      let deviceType = 'Desktop';
      if (/Mobile|Android|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(userAgent)) {
        deviceType = 'Mobile';
      } else if (/Tablet|iPad/i.test(userAgent)) {
        deviceType = 'Tablet';
      }

      // Screen resolution
      const screenResolution = `${screen.width}x${screen.height}`;

      // Language and timezone
      const language = navigator.language || 'Unknown';
      const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'Unknown';

      // Feature detection
      const webRTCSupported = !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia);
      const speechRecognitionSupported = !!(
        (window as SpeechRecognitionWindow).SpeechRecognition ||
        (window as SpeechRecognitionWindow).webkitSpeechRecognition ||
        (window as SpeechRecognitionWindow).mozSpeechRecognition ||
        (window as SpeechRecognitionWindow).msSpeechRecognition
      );
      const mediaDevicesSupported = !!navigator.mediaDevices;
      const webSocketSupported = !!window.WebSocket;

      return {
        browser,
        browserVersion,
        os,
        deviceType,
        screenResolution,
        language,
        timezone,
        webRTCSupported,
        speechRecognitionSupported,
        mediaDevicesSupported,
        webSocketSupported
      };
    };

    const runDetection = async () => {
      try {
        const info = await detectEnvironment();
        setEnvInfo(info);
        setIsDetecting(false);
      } catch (error) {
        console.error('Environment detection failed:', error);
        setIsDetecting(false);
      }
    };

    runDetection();
  }, []);

  const getCompatibilityStatus = (envInfo: EnvironmentInfo) => {
    const requiredFeatures = [
      envInfo.webRTCSupported,
      envInfo.speechRecognitionSupported,
      envInfo.mediaDevicesSupported,
      envInfo.webSocketSupported
    ];
    
    const supportedCount = requiredFeatures.filter(Boolean).length;
    
    if (supportedCount === 4) return { status: 'excellent', color: 'text-green-600', bg: 'bg-green-50' };
    if (supportedCount >= 3) return { status: 'good', color: 'text-yellow-600', bg: 'bg-yellow-50' };
    return { status: 'limited', color: 'text-red-600', bg: 'bg-red-50' };
  };

  if (isDetecting) {
    return (
      <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-xl p-4 border border-blue-200 backdrop-blur-sm">
        <div className="flex items-center space-x-2">
          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
          <span className="text-sm text-blue-700">Detecting environment...</span>
        </div>
      </div>
    );
  }

  if (!envInfo) {
    return (
      <div className="bg-gradient-to-br from-red-50 to-pink-50 rounded-xl p-4 border border-red-200">
        <span className="text-sm text-red-700">⚠️ Environment detection failed</span>
      </div>
    );
  }

  const compatibility = getCompatibilityStatus(envInfo);

  return (
    <div className="bg-gradient-to-br from-slate-50 to-gray-50 rounded-xl p-4 border border-gray-200 backdrop-blur-sm">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-gray-800 flex items-center">
          🖥️ Environment Status
        </h3>
        <div className={`px-2 py-1 rounded-full text-xs font-medium ${compatibility.bg} ${compatibility.color}`}>
          {compatibility.status === 'excellent' && '✅ Excellent'}
          {compatibility.status === 'good' && '⚠️ Good'}
          {compatibility.status === 'limited' && '❌ Limited'}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
        <div className="space-y-1">
          <div className="flex justify-between">
            <span className="text-gray-600">Browser:</span>
            <span className="font-medium text-gray-800">{envInfo.browser} {envInfo.browserVersion}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-600">OS:</span>
            <span className="font-medium text-gray-800">{envInfo.os}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-600">Device:</span>
            <span className="font-medium text-gray-800">{envInfo.deviceType}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-600">Resolution:</span>
            <span className="font-medium text-gray-800">{envInfo.screenResolution}</span>
          </div>
        </div>

        <div className="space-y-1">
          <div className="flex justify-between">
            <span className="text-gray-600">WebRTC:</span>
            <span className={`font-medium ${envInfo.webRTCSupported ? 'text-green-600' : 'text-red-600'}`}>
              {envInfo.webRTCSupported ? '✅' : '❌'}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-600">Speech API:</span>
            <span className={`font-medium ${envInfo.speechRecognitionSupported ? 'text-green-600' : 'text-red-600'}`}>
              {envInfo.speechRecognitionSupported ? '✅' : '❌'}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-600">Media Devices:</span>
            <span className={`font-medium ${envInfo.mediaDevicesSupported ? 'text-green-600' : 'text-red-600'}`}>
              {envInfo.mediaDevicesSupported ? '✅' : '❌'}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-600">WebSocket:</span>
            <span className={`font-medium ${envInfo.webSocketSupported ? 'text-green-600' : 'text-red-600'}`}>
              {envInfo.webSocketSupported ? '✅' : '❌'}
            </span>
          </div>
        </div>
      </div>

      {!envInfo.speechRecognitionSupported && (
        <div className="mt-3 p-2 bg-amber-50 border border-amber-200 rounded-lg">
          <p className="text-xs text-amber-700">
            ⚠️ Speech recognition not supported. Try Chrome or Edge for best experience.
          </p>
        </div>
      )}
    </div>
  );
}