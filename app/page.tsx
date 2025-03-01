"use client";

import React, { useEffect, useState } from "react";
import { PokerTable } from "./components/game/PokerTable";
import { GameState } from "./types/poker";
import io from "socket.io-client";

export default function Home() {
  const [gameState, setGameState] = useState<GameState>({
    players: [],
    communityCards: [],
    pot: 0,
    currentBet: 0,
    phase: "pre-flop",
    activePlayerId: null,
    dealerId: null,
    smallBlind: 10,
    bigBlind: 20,
    lastBetPlayerId: null,
  });
  const [playerId, setPlayerId] = useState<string>("");
  const [socket, setSocket] = useState<any>(null);
  const [playerName, setPlayerName] = useState("");
  const [isJoining, setIsJoining] = useState(false);

  useEffect(() => {
    const newSocket = io(process.env.NEXT_PUBLIC_WEBSOCKET_URL || "http://localhost:3001");
    setSocket(newSocket);

    newSocket.on("gameState", (newGameState: GameState) => {
      setGameState(newGameState);
    });

    newSocket.on("playerId", (id: string) => {
      setPlayerId(id);
    });

    return () => {
      newSocket.close();
    };
  }, []);

  const handleJoinGame = () => {
    if (!socket || !playerName) return;
    setIsJoining(true);
    socket.emit("joinGame", { name: playerName });
  };

  const handleAction = (action: string, amount?: number) => {
    if (!socket) return;
    socket.emit("gameAction", { action, amount, playerId });
  };

  if (!playerId) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-900">
        <div className="bg-white p-8 rounded-lg shadow-lg w-96">
          <h1 className="text-2xl font-bold mb-4 text-center">Join Poker Game</h1>
          <input
            type="text"
            placeholder="Enter your name"
            value={playerName}
            onChange={(e) => setPlayerName(e.target.value)}
            className="w-full px-4 py-2 mb-4 border rounded-md"
            disabled={isJoining}
          />
          <button
            onClick={handleJoinGame}
            disabled={!playerName || isJoining}
            className="w-full bg-blue-600 text-white py-2 rounded-md hover:bg-blue-700 disabled:bg-gray-400"
          >
            {isJoining ? "Joining..." : "Join Game"}
          </button>
        </div>
      </div>
    );
  }

  return (
    <main className="min-h-screen bg-gray-900 p-8">
      <PokerTable
        gameState={gameState}
        onAction={handleAction}
        playerId={playerId}
      />
    </main>
  );
}
