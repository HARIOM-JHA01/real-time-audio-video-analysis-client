import { useRef, useEffect, useState, useCallback } from 'react';

export interface DeepgramTranscript {
  transcript: string;
  isFinal: boolean;
}

export function useDeepgramTranscription(proxyWsUrl: string) {
  const wsRef = useRef<WebSocket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [transcripts, setTranscripts] = useState<DeepgramTranscript[]>([]);

  // Connect to proxy WebSocket
  const connect = useCallback(() => {
    try {
      if (wsRef.current && wsRef.current.readyState !== WebSocket.CLOSED) {
        console.log('🎤 Closing existing WebSocket connection before reconnecting');
        wsRef.current.close();
      }
      
      // Handle various WebSocket URL compatibility issues
      let finalUrl = proxyWsUrl;
      if (typeof window !== 'undefined') {
        const isHttps = window.location.protocol === 'https:';
        const isLocalhost = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
        
        // Chrome/Brave mixed content rules: HTTP page can only connect to WS (not WSS)
        if (proxyWsUrl.startsWith('wss://') && !isHttps) {
          console.warn('🎤 Browser blocks WSS from HTTP pages. Converting to WS.');
          finalUrl = proxyWsUrl.replace('wss://', 'ws://');
        }
        
        // Adjust URL based on development vs production
        if (isLocalhost) {
          // In development, ensure we're using the correct port (4000 for Deepgram proxy)
          finalUrl = isHttps ? 'wss://localhost:4000' : 'ws://localhost:4000';
        }
      }
      
      console.log('🎤 Connecting to Deepgram proxy at:', finalUrl);
      const ws = new WebSocket(finalUrl);
      wsRef.current = ws;
      
      // Add timeout for connection
      const connectionTimeout = setTimeout(() => {
        if (ws.readyState !== WebSocket.OPEN) {
          console.error('🎤 Connection to Deepgram proxy timed out');
          ws.close();
          setIsConnected(false);
        }
      }, 5000);
      
      ws.onopen = () => {
        clearTimeout(connectionTimeout);
        console.log('🎤 Connected to Deepgram proxy WebSocket');
        setIsConnected(true);
      };
      
      ws.onclose = (event) => {
        clearTimeout(connectionTimeout);
        console.log('🎤 Disconnected from Deepgram proxy WebSocket:', event.code, event.reason);
        setIsConnected(false);
      };
      
      ws.onerror = (event) => {
        clearTimeout(connectionTimeout);
        // Create a safer error object that can be logged
        const errorInfo = { 
          message: 'WebSocket connection error',
          url: finalUrl
        };
        console.error('🎤 Deepgram WebSocket error:', errorInfo);
        setIsConnected(false);
      };
      
      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          console.log('🎤 Received message from Deepgram proxy:', data);
          if (data.type === 'transcription') {
            setTranscripts((prev) => [...prev, { 
              transcript: data.transcript, 
              isFinal: data.isFinal 
            }]);
            console.log('🎤 Added transcript:', data.transcript, 'isFinal:', data.isFinal);
          }
        } catch (err) {
          console.error('🎤 Error parsing Deepgram message:', err, event.data);
          // Ignore non-JSON
        }
      };
    } catch (err) {
      console.error('🎤 Failed to initialize WebSocket connection:', err);
      setIsConnected(false);
    }
  }, [proxyWsUrl]);

  // Send audio chunk (Uint8Array or ArrayBuffer)
  const sendAudio = useCallback((audio: ArrayBuffer | Uint8Array) => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      console.log('🎤 Sending audio chunk to Deepgram, size:', audio.byteLength);
      wsRef.current.send(audio);
    } else {
      console.warn('🎤 Cannot send audio: WebSocket not connected');
    }
  }, []);

  // Cleanup
  useEffect(() => {
    return () => {
      if (wsRef.current) wsRef.current.close();
    };
  }, []);

  return { connect, isConnected, sendAudio, transcripts };
}
