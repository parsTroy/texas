'use client';

import { useEffect, useState } from 'react';
import io, { Socket } from 'socket.io-client';

export function useSocket() {
  const [socket, setSocket] = useState<Socket | null>(null);

  useEffect(() => {
    const newSocket = io(process.env.NEXT_PUBLIC_WEBSOCKET_URL || "http://localhost:3001");
    setSocket(newSocket);

    return () => {
      newSocket.close();
    };
  }, []);

  return socket;
} 