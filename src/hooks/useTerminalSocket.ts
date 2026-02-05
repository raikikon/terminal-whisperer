import { useEffect, useRef, useState, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';

interface UseTerminalSocketOptions {
  backendUrl: string;
  onOutput: (data: string) => void;
  onConnected: (sessionId: string) => void;
  onDisconnected: () => void;
  onTerminalClosed: (exitCode: number) => void;
}

export function useTerminalSocket({
  backendUrl,
  onOutput,
  onConnected,
  onDisconnected,
  onTerminalClosed,
}: UseTerminalSocketOptions) {
  const socketRef = useRef<Socket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(null);

  useEffect(() => {
    const socket = io(backendUrl, {
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
    });

    socketRef.current = socket;

    socket.on('connect', () => {
      console.log('Socket connected');
    });

    socket.on('connected', (data: { message: string; sessionId: string }) => {
      setIsConnected(true);
      setSessionId(data.sessionId);
      onConnected(data.sessionId);
    });

    socket.on('terminal-output', (data: string) => {
      onOutput(data);
    });

    socket.on('terminal-closed', (data: { exitCode: number }) => {
      onTerminalClosed(data.exitCode);
    });

    socket.on('disconnect', () => {
      setIsConnected(false);
      setSessionId(null);
      onDisconnected();
    });

    socket.on('connect_error', (error) => {
      console.error('Connection error:', error);
    });

    return () => {
      socket.disconnect();
    };
  }, [backendUrl, onOutput, onConnected, onDisconnected, onTerminalClosed]);

  const sendInput = useCallback((input: string) => {
    if (socketRef.current?.connected) {
      socketRef.current.emit('terminal-input', input);
    }
  }, []);

  const resize = useCallback((cols: number, rows: number) => {
    if (socketRef.current?.connected) {
      socketRef.current.emit('resize', { cols, rows });
    }
  }, []);

  return {
    isConnected,
    sessionId,
    sendInput,
    resize,
  };
}
