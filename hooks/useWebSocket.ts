'use client';

import { useEffect, useRef, useState } from 'react';

interface WebSocketMessage {
    type: 'transcription' | 'video-analysis' | 'error';
    data: any;
    timestamp: number;
}

interface UseWebSocketReturn {
    isConnected: boolean;
    sendMessage: (message: any) => void;
    sendAudioData: (audioBlob: Blob) => void;
    sendVideoFrame: (frameData: string) => void;
    messages: WebSocketMessage[];
    error: string | null;
}

export function useWebSocket(url: string): UseWebSocketReturn {
    const wsRef = useRef<WebSocket | null>(null);
    const [isConnected, setIsConnected] = useState(false);
    const [messages, setMessages] = useState<WebSocketMessage[]>([]);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        let reconnectTimeout: NodeJS.Timeout;
        let retryCount = 0;
        const maxRetries = 5;

        const connect = () => {
            try {
                console.log(`🔌 Attempting to connect to WebSocket: ${url} (Retry ${retryCount}/${maxRetries})`);
                const ws = new WebSocket(url);
                wsRef.current = ws;

                ws.onopen = () => {
                    console.log('✅ WebSocket connected successfully');
                    setIsConnected(true);
                    setError(null);
                    retryCount = 0; // Reset retry count on successful connection
                };

                ws.onmessage = (event) => {
                    console.log('🔌 Raw WebSocket message received:', event.data);
                    try {
                        const message: WebSocketMessage = JSON.parse(event.data);
                        console.log('🔌 Parsed WebSocket message:', message);
                        setMessages(prev => {
                            console.log('🔌 Adding message to state. Previous count:', prev.length);
                            return [...prev, message];
                        });
                    } catch (err) {
                        console.error('❌ Failed to parse WebSocket message:', err, 'Raw data:', event.data);
                    }
                };

                ws.onclose = (event) => {
                    console.log('❌ WebSocket disconnected. Code:', event.code, 'Reason:', event.reason);
                    setIsConnected(false);

                    // Only attempt to reconnect if under retry limit and not manually closed
                    if (retryCount < maxRetries && event.code !== 1000) {
                        retryCount++;
                        const delay = Math.min(1000 * Math.pow(2, retryCount), 10000); // Exponential backoff, max 10s
                        console.log(`🔄 Attempting to reconnect in ${delay}ms (${retryCount}/${maxRetries})`);

                        reconnectTimeout = setTimeout(() => {
                            connect();
                        }, delay);
                    } else if (retryCount >= maxRetries) {
                        console.error('❌ Max WebSocket reconnection attempts reached');
                        setError('WebSocket connection failed after multiple attempts. Please check if the server is running.');
                    }
                };

                ws.onerror = (error) => {
                    console.error('❌ WebSocket error:', error);
                    setError('WebSocket connection failed. Make sure the server is running on the correct port.');
                };
            } catch (err) {
                console.error('❌ Failed to create WebSocket connection:', err);
                setError('Failed to create WebSocket connection');
            }
        };

        connect();

        return () => {
            if (reconnectTimeout) {
                clearTimeout(reconnectTimeout);
            }
            if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
                wsRef.current.close(1000, 'Component unmounted'); // Normal closure
            }
        };
    }, [url]);

    const sendMessage = (message: any) => {
        if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
            wsRef.current.send(JSON.stringify(message));
        } else {
            console.warn('WebSocket is not connected');
        }
    };

    const sendAudioData = async (audioBlob: Blob) => {
        console.log('🎤 Attempting to send audio data. Blob size:', audioBlob.size, 'bytes');
        console.log('🎤 Audio blob type:', audioBlob.type);
        console.log('🎤 WebSocket ready state:', wsRef.current?.readyState);

        if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
            // Convert blob to base64 for transmission
            const reader = new FileReader();
            reader.onload = () => {
                const base64Data = reader.result as string;
                const audioMessage = {
                    type: 'audio',
                    data: base64Data.split(',')[1], // Remove data:audio/webm;base64, prefix
                    mimeType: audioBlob.type, // Include MIME type for better Whisper processing
                    timestamp: Date.now()
                };

                console.log('🎤 Sending audio message:', {
                    type: audioMessage.type,
                    dataLength: audioMessage.data.length,
                    mimeType: audioMessage.mimeType,
                    timestamp: audioMessage.timestamp
                });

                sendMessage(audioMessage);
            };
            reader.readAsDataURL(audioBlob);
        } else {
            console.warn('❌ Cannot send audio data - WebSocket is not connected. State:', wsRef.current?.readyState);
        }
    }; const sendVideoFrame = (frameData: string) => {
        if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
            sendMessage({
                type: 'video-frame',
                data: frameData.split(',')[1], // Remove data:image/jpeg;base64, prefix
                timestamp: Date.now()
            });
        }
    };

    return {
        isConnected,
        sendMessage,
        sendAudioData,
        sendVideoFrame,
        messages,
        error
    };
}