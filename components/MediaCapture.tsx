'use client';

import { useEffect, useRef, useState } from 'react';

interface MediaCaptureProps {
  onAudioData?: (audioData: Blob) => void;
  onVideoFrame?: (frame: string) => void;
  onStartCapture?: () => void;
  onStopCapture?: () => void;
}

export default function MediaCapture({ onAudioData, onVideoFrame, onStartCapture, onStopCapture }: MediaCaptureProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const audioCanvasRef = useRef<HTMLCanvasElement>(null);
  const captureCanvasRef = useRef<HTMLCanvasElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const frameIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const audioChunkTimerRef = useRef<NodeJS.Timeout | null>(null);

  const [isStreaming, setIsStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [permissionStatus, setPermissionStatus] = useState<'pending' | 'granted' | 'denied'>('pending');

  // Audio visualization
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const animationRef = useRef<number | null>(null);

  const startMediaCapture = async () => {
    try {
      setError(null);

      // Request camera and microphone access
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          width: { ideal: 1280 },
          height: { ideal: 720 },
          frameRate: { ideal: 30 }
        },
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          sampleRate: 44100
        }
      });

      streamRef.current = stream;
      setPermissionStatus('granted');

      // Display video in the video element
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play();
      }

      // Set up audio recording with more robust approach
      console.log('🎙️ Setting up MediaRecorder');

      let mimeType = 'audio/webm;codecs=opus';
      if (!MediaRecorder.isTypeSupported(mimeType)) {
        mimeType = 'audio/webm';
        console.log('🎙️ Falling back to audio/webm');
        if (!MediaRecorder.isTypeSupported(mimeType)) {
          mimeType = 'audio/wav';
          console.log('🎙️ Falling back to audio/wav');
        }
      }

      console.log('🎙️ Using MIME type:', mimeType);

      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: mimeType,
        audioBitsPerSecond: 128000
      });

      mediaRecorderRef.current = mediaRecorder;

      console.log('🎙️ MediaRecorder state:', mediaRecorder.state);

      // Collect audio chunks over time instead of relying on timeslice
      let audioChunks: Blob[] = [];

      const sendCollectedAudio = () => {
        if (audioChunks.length > 0) {
          const combinedBlob = new Blob(audioChunks, { type: mimeType });
          console.log('🎙️ Sending combined audio blob. Total chunks:', audioChunks.length, 'Combined size:', combinedBlob.size, 'bytes');

          if (combinedBlob.size > 1000 && onAudioData) {
            console.log('🎙️ Calling onAudioData with combined blob size:', combinedBlob.size);
            onAudioData(combinedBlob);
          } else {
            console.log('🎙️ Combined blob too small for Whisper:', combinedBlob.size, 'bytes');
          }

          audioChunks = []; // Reset chunks
        }
      };      // Send audio data in chunks
      mediaRecorder.ondataavailable = (event) => {
        console.log('🎙️ MediaRecorder data available. Size:', event.data.size, 'bytes');
        console.log('🎙️ Event data type:', event.data.type);

        if (event.data.size > 0) {
          audioChunks.push(event.data);
          console.log('🎙️ Added chunk to collection. Total chunks:', audioChunks.length);
        }
      };

      mediaRecorder.onstart = () => {
        console.log('🎙️ MediaRecorder started successfully');

        // Set up timer to send audio every 5 seconds
        audioChunkTimerRef.current = setInterval(() => {
          console.log('🎙️ Timer triggered - collecting audio chunks');
          if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
            sendCollectedAudio();
          }
        }, 5000);
      };

      mediaRecorder.onstop = () => {
        console.log('🎙️ MediaRecorder stopped');
        if (audioChunkTimerRef.current) {
          clearInterval(audioChunkTimerRef.current);
          audioChunkTimerRef.current = null;
        }
        sendCollectedAudio(); // Send any remaining chunks
      };

      mediaRecorder.onerror = (event) => {
        console.error('🎙️ MediaRecorder error:', event);
      };

      // Start recording continuously (no timeslice parameter)
      console.log('🎙️ Starting MediaRecorder in continuous mode');
      mediaRecorder.start();

      // Set up audio visualization
      setupAudioVisualization(stream);

      // Start video frame capture
      startFrameCapture();

      setIsStreaming(true);

      // Call the parent callback to start speech recognition
      if (onStartCapture) {
        onStartCapture();
      }
    } catch (err) {
      console.error('Error accessing media devices:', err);
      setError('Failed to access camera and microphone. Please grant permissions and try again.');
      setPermissionStatus('denied');
    }
  };

  const setupAudioVisualization = (stream: MediaStream) => {
    const AudioCtx = window.AudioContext || (window as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtx) {
      console.warn('Web Audio API not supported');
      return;
    }

    const audioContext = new AudioCtx();
    const analyser = audioContext.createAnalyser();
    const microphone = audioContext.createMediaStreamSource(stream);

    analyser.fftSize = 256;
    microphone.connect(analyser);

    audioContextRef.current = audioContext;
    analyserRef.current = analyser;

    drawAudioVisualization();
  };

  const drawAudioVisualization = () => {
    if (!audioCanvasRef.current || !analyserRef.current) return;

    const canvas = audioCanvasRef.current;
    const ctx = canvas.getContext('2d');
    const analyser = analyserRef.current;

    if (!ctx) return;

    // Create frequency data array
    const frequencyData = new Uint8Array(analyser.frequencyBinCount);
    analyser.getByteFrequencyData(frequencyData);

    ctx.fillStyle = 'rgb(15, 23, 42)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    const barWidth = (canvas.width / frequencyData.length) * 2.5;
    let barHeight;
    let x = 0;

    for (let i = 0; i < frequencyData.length; i++) {
      barHeight = (frequencyData[i] / 255) * canvas.height;

      // Create gradient effect
      const gradient = ctx.createLinearGradient(0, canvas.height - barHeight, 0, canvas.height);
      gradient.addColorStop(0, '#3b82f6');
      gradient.addColorStop(0.5, '#60a5fa');
      gradient.addColorStop(1, '#93c5fd');

      ctx.fillStyle = gradient;
      ctx.fillRect(x, canvas.height - barHeight, barWidth, barHeight);

      x += barWidth + 1;
    }

    animationRef.current = requestAnimationFrame(drawAudioVisualization);
  };

  const startFrameCapture = () => {
    if (!captureCanvasRef.current || !videoRef.current) return;

    // Capture a frame every 3 seconds for GPT-4o analysis
    frameIntervalRef.current = setInterval(() => {
      captureFrame();
    }, 3000);
  };

  const captureFrame = () => {
    if (!captureCanvasRef.current || !videoRef.current || !onVideoFrame) return;

    const canvas = captureCanvasRef.current;
    const video = videoRef.current;
    const ctx = canvas.getContext('2d');

    if (!ctx) return;

    // Set canvas size to match video
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;

    // Draw current video frame to canvas
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    // Convert to base64 image
    const frameData = canvas.toDataURL('image/jpeg', 0.8);
    onVideoFrame(frameData);
  };

  const stopMediaCapture = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
    }

    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }

    if (frameIntervalRef.current) {
      clearInterval(frameIntervalRef.current);
    }

    if (audioChunkTimerRef.current) {
      clearInterval(audioChunkTimerRef.current);
      audioChunkTimerRef.current = null;
    }

    if (animationRef.current) {
      cancelAnimationFrame(animationRef.current);
    }

    if (audioContextRef.current) {
      audioContextRef.current.close();
    }

    setIsStreaming(false);

    // Call the parent callback to stop speech recognition
    if (onStopCapture) {
      onStopCapture();
    }
  };

  useEffect(() => {
    return () => {
      stopMediaCapture();
    };
  }, []);

  return (
    <div className="space-y-6">
      <div className="flex gap-4 items-center justify-between bg-white rounded-xl p-6 shadow-sm border">
        <div className="flex gap-4 items-center">
          <button
            onClick={isStreaming ? stopMediaCapture : startMediaCapture}
            disabled={permissionStatus === 'denied'}
            className={`px-8 py-3 rounded-xl font-semibold transition-all duration-200 ${isStreaming
              ? 'bg-red-500 hover:bg-red-600 text-white shadow-lg hover:shadow-red-500/25'
              : 'bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-600 hover:to-emerald-600 text-white shadow-lg hover:shadow-green-500/25'
              } disabled:bg-gray-400 disabled:cursor-not-allowed disabled:shadow-none`}
          >
            {isStreaming ? '⏹️ Stop Capture' : '▶️ Start Capture'}
          </button>

          <div className={`px-4 py-2 rounded-full text-sm font-medium ${permissionStatus === 'granted' ? 'bg-green-100 text-green-800 border border-green-200' :
            permissionStatus === 'denied' ? 'bg-red-100 text-red-800 border border-red-200' :
              'bg-yellow-100 text-yellow-800 border border-yellow-200'
            }`}>
            {permissionStatus === 'granted' ? '✅ Permissions Granted' :
              permissionStatus === 'denied' ? '❌ Permissions Denied' :
                '⏳ Requesting Permissions...'}
          </div>
        </div>

        {isStreaming && (
          <div className="flex items-center gap-2 text-green-600">
            <div className="w-3 h-3 bg-green-500 rounded-full animate-pulse"></div>
            <span className="text-sm font-medium">Live</span>
          </div>
        )}
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-6 py-4 rounded-xl shadow-sm">
          <div className="flex items-center gap-2">
            <span className="text-red-500">⚠️</span>
            {error}
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Video Preview */}
        <div className="bg-white rounded-xl p-6 shadow-sm border">
          <h3 className="text-xl font-semibold mb-4 text-gray-800 flex items-center gap-2">
            🎥 Video Preview
          </h3>
          <div className="relative">
            <video
              ref={videoRef}
              autoPlay
              muted
              playsInline
              className="w-full rounded-lg border-2 border-gray-200 shadow-sm"
            />
            {!isStreaming && (
              <div className="absolute inset-0 bg-gray-100 rounded-lg flex items-center justify-center">
                <div className="text-center text-gray-500">
                  <div className="text-4xl mb-2">📹</div>
                  <p>Camera preview will appear here</p>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Audio Visualization */}
        <div className="bg-white rounded-xl p-6 shadow-sm border">
          <h3 className="text-xl font-semibold mb-4 text-gray-800 flex items-center gap-2">
            🎵 Audio Levels
          </h3>
          <div className="relative">
            <canvas
              ref={audioCanvasRef}
              width="400"
              height="200"
              className="w-full border-2 border-gray-200 rounded-lg shadow-sm"
            />
            {!isStreaming && (
              <div className="absolute inset-0 bg-gray-100 rounded-lg flex items-center justify-center">
                <div className="text-center text-gray-500">
                  <div className="text-4xl mb-2">🎤</div>
                  <p>Audio visualization will appear here</p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Hidden canvas for frame capture */}
      <canvas
        ref={captureCanvasRef}
        style={{ display: 'none' }}
      />
    </div>
  );
}