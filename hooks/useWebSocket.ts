'use client';

import { useEffect, useRef, useState } from 'react';

interface WebSocketMessage {
    type: 'transcription' | 'video-analysis' | 'error' | 'ping' | 'pong';
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
            // Small delay for Chrome/Brave compatibility
            const userAgent = navigator.userAgent;
            const isChromeBased = userAgent.includes('Chrome') || userAgent.includes('Brave') || userAgent.includes('Chromium');
            const delay = isChromeBased ? 100 : 0;

            // Smart protocol handling for Chrome/Brave mixed content policy
            let finalUrl = url;
            const isHttps = location.protocol === 'https:';
            const isLocalhost = location.hostname === 'localhost' || location.hostname === '127.0.0.1';

            // Chrome/Brave mixed content rules:
            // HTTP page can only connect to WS (not WSS), regardless of localhost
            if (url.startsWith('wss://') && !isHttps) {
                console.warn('🚨 Chrome/Brave blocks WSS from HTTP. Converting to WS for compatibility...');
                console.warn('💡 For better security, consider using HTTPS in development or production.');
                finalUrl = url.replace('wss://', 'ws://');
                console.log(`🔄 Converted URL: ${finalUrl}`);

                // Set a user-friendly warning
                setError('Using insecure WebSocket (WS) due to HTTP page. Consider using HTTPS for secure connections.');
            }

            setTimeout(() => {
                try {
                    console.log(`🔌 Attempting to connect to WebSocket: ${finalUrl} (Retry ${retryCount}/${maxRetries})`);
                    console.log(`🌐 Browser: ${userAgent.includes('Chrome') ? 'Chrome' : userAgent.includes('Brave') ? 'Brave' : 'Other'}`);
                    console.log(`🔒 Page Protocol: ${location.protocol}, Original WSS: ${url.startsWith('wss://')}, Using: ${finalUrl.startsWith('wss://') ? 'WSS' : 'WS'}`);

                    // Chrome/Brave specific WebSocket options for better compatibility
                    const ws = new WebSocket(finalUrl);
                    wsRef.current = ws;

                    // Set binary type for Chrome/Brave compatibility
                    ws.binaryType = 'blob';

                    // Chrome/Brave specific headers (if supported)
                    try {
                        // Some servers require specific protocols
                        if (userAgent.includes('Chrome') || userAgent.includes('Brave')) {
                            console.log('🌐 Using Chrome/Brave optimized connection');
                        }
                    } catch (headerErr) {
                        console.warn('Could not set WebSocket headers:', headerErr);
                    }

                    // Add timeout for connection attempt (Chrome/Brave can hang)
                    const connectionTimeout = setTimeout(() => {
                        if (ws.readyState === WebSocket.CONNECTING) {
                            console.warn('⏰ WebSocket connection timeout, closing...');
                            ws.close();
                        }
                    }, 10000); // 10 second timeout

                    ws.onopen = () => {
                        console.log('✅ WebSocket connected successfully');
                        clearTimeout(connectionTimeout);
                        setIsConnected(true);
                        setError(null);
                        retryCount = 0; // Reset retry count on successful connection

                        // Send a ping to verify connection works (Chrome/Brave compatibility)
                        try {
                            ws.send(JSON.stringify({ type: 'ping', timestamp: Date.now() }));
                        } catch (err) {
                            console.warn('Failed to send ping:', err);
                        }
                    };

                    ws.onmessage = (event) => {
                        console.log('🔌 Raw WebSocket message received:', event.data);
                        try {
                            const message: WebSocketMessage = JSON.parse(event.data);
                            console.log('🔌 Parsed WebSocket message:', message);

                            // Ignore ping responses
                            if (message.type === 'pong') {
                                console.log('🏓 Received pong response');
                                return;
                            }

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
                        clearTimeout(connectionTimeout);
                        setIsConnected(false);

                        // Chrome/Brave specific close codes handling
                        const shouldReconnect = event.code !== 1000 && // Normal closure
                            event.code !== 1001 && // Going away
                            event.code !== 1005 && // No status received
                            retryCount < maxRetries;

                        if (shouldReconnect) {
                            retryCount++;
                            const delay = Math.min(1000 * Math.pow(2, retryCount), 10000); // Exponential backoff, max 10s
                            console.log(`🔄 Attempting to reconnect in ${delay}ms (${retryCount}/${maxRetries})`);

                            reconnectTimeout = setTimeout(() => {
                                connect();
                            }, delay);
                        } else if (retryCount >= maxRetries) {
                            console.error('❌ Max WebSocket reconnection attempts reached');
                            setError('WebSocket connection failed after multiple attempts. Please check if the server is running.');
                        } else {
                            console.log('WebSocket closed normally, not reconnecting');
                        }
                    };

                    ws.onerror = (error) => {
                        console.error('❌ WebSocket error:', error);
                        clearTimeout(connectionTimeout);

                        // More specific error messages for Chrome/Brave
                        const userAgent = navigator.userAgent;
                        let errorMessage = 'WebSocket connection failed.';

                        if (userAgent.includes('Chrome') || userAgent.includes('Brave')) {
                            errorMessage += ' Chrome/Brave WebSocket debugging:';
                            errorMessage += '\n1. Check if server is running and accessible';
                            errorMessage += '\n2. Try opening the WebSocket URL directly in browser';
                            errorMessage += '\n3. Check browser console for CORS or certificate errors';
                            errorMessage += '\n4. Verify the WebSocket server supports the required headers';

                            // Log additional debugging info
                            console.log('🔍 Chrome WebSocket Debug Info:');
                            console.log('- URL:', finalUrl);
                            console.log('- User Agent:', userAgent);
                            console.log('- Location:', window.location.href);
                            console.log('- Referrer:', document.referrer);
                            console.log('- Cookies enabled:', navigator.cookieEnabled);

                            // Test if we can reach the domain
                            fetch('https://projects.aux-rolplay.com', { mode: 'no-cors' })
                                .then(() => console.log('✅ Domain is reachable'))
                                .catch(e => console.log('❌ Domain unreachable:', e));
                        }

                        setError(errorMessage);
                    };
                } catch (err) {
                    console.error('❌ Failed to create WebSocket connection:', err);
                    setError('Failed to create WebSocket connection: ' + (err as Error).message);
                }
            }, delay); // Close the setTimeout
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