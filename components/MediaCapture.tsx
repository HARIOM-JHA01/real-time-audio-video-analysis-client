'use client';

import { useEffect, useRef, useState, useCallback } from 'react';

interface MediaCaptureProps {
  onAudioData?: (audioData: Blob) => void;
  onVideoFrame?: (frame: string) => void;
  onStartCapture?: () => void;
  onStopCapture?: () => void;
}

export default function MediaCapture({ onAudioData, onVideoFrame, onStartCapture, onStopCapture }: MediaCaptureProps) {
  useEffect(() => {
    navigator.mediaDevices.enumerateDevices()
      .then(devices => console.log('Available media devices:', devices))
      .catch(err => console.error('Error enumerating devices:', err));
  }, []);

  const videoRef = useRef<HTMLVideoElement>(null);
  const audioCanvasRef = useRef<HTMLCanvasElement>(null);
  const captureCanvasRef = useRef<HTMLCanvasElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const frameIntervalRef = useRef<number | null>(null);
  const audioChunkTimerRef = useRef<number | null>(null);

  const [isStreaming, setIsStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [permissionStatus, setPermissionStatus] = useState<'pending' | 'granted' | 'denied'>('pending');

  // Audio visualization
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const animationRef = useRef<number | null>(null);

  // Helper: read permission state if Permissions API available
  const checkPermissions = async () => {
    try {
      const nav = navigator as Navigator & { permissions?: { query: (params: { name: string }) => Promise<{ state: 'granted' | 'denied' | 'prompt' }> } };
      if (nav.permissions && nav.permissions.query) {
        // camera and microphone permission names are "camera"/"microphone" in Chrome
        const cam = await nav.permissions.query({ name: 'camera' });
        const mic = await nav.permissions.query({ name: 'microphone' });
        if (cam.state === 'denied' || mic.state === 'denied') {
          setPermissionStatus('denied');
        } else if (cam.state === 'granted' && mic.state === 'granted') {
          setPermissionStatus('granted');
        } else {
          setPermissionStatus('pending');
        }
      }
    } catch {
      // Permissions API may not be present — keep 'pending' until we actually request
    }
  };

  useEffect(() => {
    checkPermissions();
  }, []);

  const startMediaCapture = async () => {
    setError(null);

    // Chrome requires secure context; guide user if not secure.
    if (!window.isSecureContext && location.hostname !== 'localhost') {
      setError('getUserMedia requires a secure context (HTTPS). Use https or localhost.');
      setPermissionStatus('denied');
      return;
    }

    try {
      // FIRST: request a simple permission prompt. This is the part Chrome expects.
      console.log('Requesting simple getUserMedia({audio: true, video: true}) to prompt permissions');
      const initialStream = await navigator.mediaDevices.getUserMedia({ audio: true, video: true });

      // Set basic stream and UI
      streamRef.current = initialStream;
      setPermissionStatus('granted');

      if (videoRef.current) {
        videoRef.current.srcObject = initialStream;
        // play may reject on some autoplay policies; catch it
        videoRef.current.play().catch(() => { /* ignore autoplay rejection */ });
      }

      // Now we can enumerate devices and, if desired, pick a specific device with exact constraint safely.
      const devices = await navigator.mediaDevices.enumerateDevices();
      console.log('Devices after permission:", devices');

      // pick first non-empty device id (optional)
      const videoDevice = devices.find(d => d.kind === 'videoinput' && d.deviceId && d.deviceId !== 'default' && d.deviceId !== '');
      const audioDevice = devices.find(d => d.kind === 'audioinput' && d.deviceId && d.deviceId !== 'default' && d.deviceId !== '');

      // Build final constraints only if we want to pin a device — otherwise keep using the initialStream
      let finalStream: MediaStream | null = initialStream;
      if (videoDevice || audioDevice) {
        // Build constraints with exact() only if we actually have non-empty ids
        const constraints: MediaStreamConstraints = {
          video: videoDevice ? { deviceId: { exact: videoDevice.deviceId } } : true,
          audio: audioDevice ? { deviceId: { exact: audioDevice.deviceId } } : true
        };

        // Try to get final stream with device pinning (if this fails, fall back to initialStream)
        try {
          console.log('Requesting pinned devices with constraints:', constraints);
          const pinned = await navigator.mediaDevices.getUserMedia(constraints);
          finalStream = pinned;
          // stop tracks from initialStream that are not used to avoid duplicates if different
          if (initialStream !== pinned) {
            initialStream.getTracks().forEach(t => t.stop());
          }
        } catch (err) {
          console.warn('Pinned device getUserMedia failed; continuing with initialStream', err);
          // keep finalStream as initialStream
        }
      }

      streamRef.current = finalStream;

      // Setup MediaRecorder
      let mimeType = 'audio/webm;codecs=opus';
      if (!MediaRecorder.isTypeSupported(mimeType)) {
        mimeType = 'audio/webm';
        if (!MediaRecorder.isTypeSupported(mimeType)) {
          mimeType = '';
        }
      }
      console.log('Using mimeType for recorder:', mimeType || 'default');

      const mediaRecorder = mimeType ? new MediaRecorder(finalStream!, { mimeType, audioBitsPerSecond: 128000 }) : new MediaRecorder(finalStream!);
      mediaRecorderRef.current = mediaRecorder;

      let audioChunks: Blob[] = [];
      const sendCollectedAudio = () => {
        if (audioChunks.length > 0) {
          const combinedBlob = new Blob(audioChunks, { type: mimeType || audioChunks[0]?.type || 'audio/webm' });
          console.log('Sending combined blob size:', combinedBlob.size);
          if (combinedBlob.size > 1000 && onAudioData) onAudioData(combinedBlob);
          audioChunks = [];
        }
      };

      mediaRecorder.ondataavailable = (event: BlobEvent) => {
        if (event.data && event.data.size > 0) {
          audioChunks.push(event.data);
        }
      };

      mediaRecorder.onstart = () => {
        // timer every 5s to combine chunks
        audioChunkTimerRef.current = window.setInterval(() => {
          if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
            sendCollectedAudio();
          }
        }, 5000);
      };

      mediaRecorder.onstop = () => {
        if (audioChunkTimerRef.current) {
          clearInterval(audioChunkTimerRef.current);
          audioChunkTimerRef.current = null;
        }
        sendCollectedAudio();
      };

      mediaRecorder.onerror = (ev) => console.error('MediaRecorder error', ev);

      mediaRecorder.start(); // continuous

      // Audio visualization: create/resume AudioContext
      setupAudioVisualization(finalStream!);

      // video element already set above for initialStream; ensure final stream applied
      if (videoRef.current && finalStream) {
        videoRef.current.srcObject = finalStream;
        videoRef.current.play().catch(() => { });
      }

      // Start frame capture
      startFrameCapture();

      setIsStreaming(true);
      if (onStartCapture) onStartCapture();
    } catch (err) {
      // err is unknown, so we need to type guard
      const errorObj = err as Error & { name?: string };
      console.error('Failed to start capture:', err);
      if (errorObj && (errorObj.name === 'NotAllowedError' || errorObj.name === 'SecurityError')) {
        setError('Permission denied. Check Chrome site settings (Camera / Microphone) or use HTTPS / localhost.');
      } else if (errorObj && errorObj.name === 'NotFoundError') {
        setError('No camera/microphone found. Please connect a device.');
      } else if (errorObj && errorObj.name === 'OverconstrainedError') {
        setError('Requested device not found. Try allowing default devices or check connected devices.');
      } else {
        setError('Failed to access camera and microphone. Please grant permissions and try again.');
      }
      setPermissionStatus('denied');
    }
  };

  const setupAudioVisualization = (stream: MediaStream) => {
    const AudioCtx: typeof AudioContext | undefined = window.AudioContext || (window as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtx) {
      console.warn('Web Audio API not supported');
      return;
    }

    let audioContext = audioContextRef.current;
    if (!audioContext) {
      audioContext = new AudioCtx();
      audioContextRef.current = audioContext;
    }

    // Resume if suspended (Chrome often suspends it)
    if (audioContext && audioContext.state === 'suspended') {
      audioContext.resume().catch(() => { /* ignore */ });
    }

    if (audioContext) {
      const analyser = audioContext.createAnalyser();
      analyser.fftSize = 256;

      const microphone = audioContext.createMediaStreamSource(stream);
      microphone.connect(analyser);

      analyserRef.current = analyser;
      drawAudioVisualization();
    }
  };

  const drawAudioVisualization = () => {
    if (!audioCanvasRef.current || !analyserRef.current) return;
    const canvas = audioCanvasRef.current;
    const ctx = canvas.getContext('2d');
    const analyser = analyserRef.current;
    if (!ctx) return;

    const frequencyData = new Uint8Array(analyser.frequencyBinCount);
    analyser.getByteFrequencyData(frequencyData);

    ctx.fillStyle = 'rgb(15, 23, 42)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    const barWidth = (canvas.width / frequencyData.length) * 2.5;
    let x = 0;

    for (let i = 0; i < frequencyData.length; i++) {
      const barHeight = (frequencyData[i] / 255) * canvas.height;

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
    // every 3 seconds
    frameIntervalRef.current = window.setInterval(() => {
      captureFrame();
    }, 3000);
  };

  const captureFrame = () => {
    if (!captureCanvasRef.current || !videoRef.current || !onVideoFrame) return;
    const canvas = captureCanvasRef.current;
    const video = videoRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    canvas.width = video.videoWidth || 640;
    canvas.height = video.videoHeight || 480;

    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    const frameData = canvas.toDataURL('image/jpeg', 0.8);
    onVideoFrame(frameData);
  };

  const stopMediaCapture = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }

    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
      mediaRecorderRef.current = null;
    }

    if (frameIntervalRef.current) {
      clearInterval(frameIntervalRef.current);
      frameIntervalRef.current = null;
    }

    if (audioChunkTimerRef.current) {
      clearInterval(audioChunkTimerRef.current);
      audioChunkTimerRef.current = null;
    }

    if (animationRef.current) {
      cancelAnimationFrame(animationRef.current);
      animationRef.current = null;
    }

    if (audioContextRef.current) {
      audioContextRef.current.close().catch(() => { });
      audioContextRef.current = null;
      analyserRef.current = null;
    }

    setIsStreaming(false);
    if (onStopCapture) onStopCapture();
  }, [onStopCapture]);

  useEffect(() => {
    return () => {
      stopMediaCapture();
    };
  }, [stopMediaCapture]);

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

      <canvas
        ref={captureCanvasRef}
        style={{ display: 'none' }}
      />
    </div>
  );
}
