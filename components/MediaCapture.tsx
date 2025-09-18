'use client';

import { useEffect, useRef, useState, useCallback } from 'react';

interface MediaCaptureProps {
  onAudioData?: (audioData: Blob) => void;
  onVideoFrame?: (frame: string) => void;
  onStartCapture?: () => void;
  onStopCapture?: () => void;
}

export default function MediaCapture({ onAudioData, onVideoFrame, onStartCapture, onStopCapture }: MediaCaptureProps) {
  // Removed complex permission checking - let getUserMedia handle it directly
  useEffect(() => {
    // Simple device enumeration for logging (optional)
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

  const startMediaCapture = async () => {
    setError(null);

    try {
      // Simple, direct approach like your working vanilla JS
      console.log('Requesting getUserMedia with simple constraints');
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });

      // Store the stream
      streamRef.current = stream;
      setPermissionStatus('granted');

      // Set up video element
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play().catch(err => {
          console.warn('Video autoplay failed:', err);
        });
      }

      // Setup MediaRecorder for audio capture
      if (onAudioData) {
        let mediaRecorder: MediaRecorder | null = null;
        let mimeType = '';
        let workingConfig: { mimeType: string; options: MediaRecorderOptions } | null = null;

        // Try different configurations in order of preference
        const configs: { mimeType: string; options: MediaRecorderOptions }[] = [
          { mimeType: '', options: {} }, // Default first (most compatible)
          { mimeType: 'audio/webm', options: {} },
          { mimeType: 'audio/mp4', options: {} },
          { mimeType: 'audio/ogg', options: {} },
          { mimeType: 'audio/webm;codecs=opus', options: {} },
        ];

        // Test each configuration by actually trying to start recording
        for (const config of configs) {
          try {
            console.log('Testing MediaRecorder config:', config);

            let testRecorder: MediaRecorder;
            if (config.mimeType === '' || MediaRecorder.isTypeSupported(config.mimeType)) {
              if (config.mimeType === '') {
                testRecorder = new MediaRecorder(stream);
              } else {
                testRecorder = new MediaRecorder(stream, {
                  mimeType: config.mimeType,
                  ...config.options
                });
              }

              // Test if start() actually works
              await new Promise<void>((resolve, reject) => {
                const timeout = setTimeout(() => {
                  reject(new Error('Start timeout'));
                }, 1000);

                testRecorder.onstart = () => {
                  clearTimeout(timeout);
                  testRecorder.stop(); // Stop the test immediately
                  resolve();
                };

                testRecorder.onerror = (ev) => {
                  clearTimeout(timeout);
                  reject(ev);
                };

                try {
                  testRecorder.start();
                } catch (err) {
                  clearTimeout(timeout);
                  reject(err);
                }
              });

              // If we get here, this config works!
              workingConfig = config;
              mimeType = config.mimeType;
              console.log('✅ Found working MediaRecorder config:', config);
              break;
            }
          } catch (err) {
            console.warn('❌ MediaRecorder config failed:', config, err);
          }
        }

        if (!workingConfig) {
          console.warn('No working MediaRecorder configuration found, continuing without audio recording');
          // Continue without MediaRecorder - just do video and visualization
        } else {
          // Create the actual MediaRecorder with the working config
          if (workingConfig.mimeType === '') {
            mediaRecorder = new MediaRecorder(stream);
          } else {
            mediaRecorder = new MediaRecorder(stream, {
              mimeType: workingConfig.mimeType,
              ...workingConfig.options
            });
          }

          mediaRecorderRef.current = mediaRecorder;

          let audioChunks: Blob[] = [];
          const sendCollectedAudio = () => {
            if (audioChunks.length > 0) {
              const combinedBlob = new Blob(audioChunks, { type: mimeType || audioChunks[0]?.type || 'audio/webm' });
              console.log('Sending combined blob size:', combinedBlob.size);
              if (combinedBlob.size > 1000) onAudioData(combinedBlob);
              audioChunks = [];
            }
          };

          mediaRecorder.ondataavailable = (event: BlobEvent) => {
            if (event.data && event.data.size > 0) {
              audioChunks.push(event.data);
            }
          };

          mediaRecorder.onstart = () => {
            console.log('✅ MediaRecorder started successfully');
            // timer every 5s to combine chunks
            audioChunkTimerRef.current = window.setInterval(() => {
              if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
                sendCollectedAudio();
              }
            }, 5000);
          };

          mediaRecorder.onstop = () => {
            console.log('MediaRecorder stopped');
            if (audioChunkTimerRef.current) {
              clearInterval(audioChunkTimerRef.current);
              audioChunkTimerRef.current = null;
            }
            sendCollectedAudio();
          };

          mediaRecorder.onerror = (ev) => {
            console.error('MediaRecorder error', ev);
            // Try to recover by stopping and restarting
            if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
              try {
                mediaRecorderRef.current.stop();
              } catch (e) {
                console.warn('Error stopping MediaRecorder:', e);
              }
            }
          };

          try {
            mediaRecorder.start();
            console.log('📹 Starting MediaRecorder with working config...');
          } catch (startError) {
            console.error('Failed to start MediaRecorder even with tested config:', startError);
            // Continue without recording
            mediaRecorderRef.current = null;
          }
        }
      }

      // Setup audio visualization
      setupAudioVisualization(stream);

      // Start frame capture if callback provided
      if (onVideoFrame) {
        startFrameCapture();
      }

      setIsStreaming(true);
      if (onStartCapture) onStartCapture();

    } catch (err) {
      const errorObj = err as Error & { name?: string };
      console.error('Failed to start capture:', err);

      if (errorObj && errorObj.name === 'NotAllowedError') {
        setError('Permission denied. Please allow camera and microphone access.');
      } else if (errorObj && errorObj.name === 'NotFoundError') {
        setError('No camera/microphone found. Please connect a device.');
      } else if (errorObj && errorObj.name === 'OverconstrainedError') {
        setError('Camera/microphone constraints not supported.');
      } else if (errorObj && errorObj.name === 'NotSupportedError') {
        setError('MediaRecorder not supported in this browser. Try Chrome, Firefox, or Safari.');
      } else if (errorObj?.message?.includes('MediaRecorder')) {
        setError('Audio recording failed. This might work without audio recording features.');
        // Continue without audio recording
        try {
          console.log('Attempting to continue without MediaRecorder...');
          const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
          streamRef.current = stream;
          setPermissionStatus('granted');

          if (videoRef.current) {
            videoRef.current.srcObject = stream;
            videoRef.current.play().catch(err => console.warn('Video autoplay failed:', err));
          }

          setupAudioVisualization(stream);

          if (onVideoFrame) {
            startFrameCapture();
          }

          setIsStreaming(true);
          if (onStartCapture) onStartCapture();
          return; // Exit the catch block successfully
        } catch (recoveryErr) {
          console.error('Recovery attempt failed:', recoveryErr);
        }
      } else {
        setError('Error accessing media devices: ' + (errorObj?.message || 'Unknown error'));
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
              className="w-full rounded-lg border-2 border-gray-200 shadow-sm scale-x-[-1]"
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

        {/* Audio Levels Section - Hidden for cleaner UI */}
        <div className="hidden bg-white rounded-xl p-6 shadow-sm border">
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
