"use client";

import React, { useEffect, useState } from "react";
import { PokerTable } from "./components/game/PokerTable";
import { TableJoinDialog } from "./components/game/TableJoinDialog";
import { GameState } from "./types/poker";
import io from "socket.io-client";

interface TableInfo {
  availableSeats: number[];
  minBuyIn: number;
  suggestedBuyIn: number;
  maxBuyIn: number;
}

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
    maxPlayers: 6,
    availableSeats: [],
  });
  const [playerId, setPlayerId] = useState<string>("");
  const [socket, setSocket] = useState<any>(null);
  const [playerName, setPlayerName] = useState("");
  const [isJoining, setIsJoining] = useState(false);
  const [showJoinDialog, setShowJoinDialog] = useState(false);
  const [tableInfo, setTableInfo] = useState<TableInfo | null>(null);

  useEffect(() => {
    const newSocket = io(process.env.NEXT_PUBLIC_WEBSOCKET_URL || "http://localhost:3001");
    setSocket(newSocket);

    newSocket.on("gameState", (newGameState: GameState) => {
      setGameState(newGameState);
    });

    newSocket.on("playerId", (id: string) => {
      setPlayerId(id);
    });

    newSocket.on("tableInfo", (info: TableInfo) => {
      setTableInfo(info);
      setShowJoinDialog(true);
    });

    newSocket.on("needsBuyIn", (info: TableInfo) => {
      setTableInfo(info);
      setShowJoinDialog(true);
    });

    newSocket.on("buyInError", (error: string) => {
      // Handle buy-in error (you could show this in a toast notification)
      console.error(error);
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

  const handleBuyIn = (seatNumber: number, amount: number) => {
    if (!socket) return;
    socket.emit("buyIn", { seatNumber, amount });
    setShowJoinDialog(false);
  };

  const handleAction = (action: string, amount?: number) => {
    if (!socket) return;
    
    if (action === "buyMoreChips") {
      const player = gameState.players.find(p => p.id === playerId);
      if (player && player.seatNumber !== null) {
        setTableInfo({
          availableSeats: [player.seatNumber],
          minBuyIn: gameState.bigBlind,
          suggestedBuyIn: gameState.bigBlind * 100,
          maxBuyIn: Infinity
        });
        setShowJoinDialog(true);
      }
      return;
    }
    
    socket.emit("action", { action, amount });
  };

  if (!playerId) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-gray-900 to-gray-800">
        <div className="relative w-96 perspective-[1000px]">
          {/* Background card with 3D effect */}
          <div 
            className="absolute inset-0 bg-gradient-to-br from-green-900 to-green-800 rounded-2xl shadow-[0_20px_60px_-15px_rgba(0,0,0,0.7)] border-8 border-amber-950/50 transform -rotate-x-12"
            style={{ transformStyle: 'preserve-3d' }}
          >
            {/* Card felt texture */}
            <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSI0IiBoZWlnaHQ9IjQiPgo8cmVjdCB3aWR0aD0iNCIgaGVpZ2h0PSI0IiBmaWxsPSIjMDAwMDAwMTAiPjwvcmVjdD4KPC9zdmc+')] opacity-50" />
            {/* Card rim highlight */}
            <div className="absolute inset-0 rounded-xl bg-gradient-to-b from-amber-600/10 to-transparent" />
          </div>

          {/* Content container */}
          <div className="relative p-8 transform -rotate-x-12" style={{ transformStyle: 'preserve-3d' }}>
            <div className="text-center mb-6">
              <h1 className="text-3xl font-bold text-white drop-shadow-[0_2px_4px_rgba(0,0,0,0.4)]">
                Join Poker Game
              </h1>
              <div className="mt-2 text-white/80 text-sm">
                Enter your name to join the table
              </div>
            </div>

            <div className="space-y-4">
              <div className="relative">
                <input
                  type="text"
                  placeholder="Enter your name"
                  value={playerName}
                  onChange={(e) => setPlayerName(e.target.value)}
                  disabled={isJoining}
                  className="w-full px-4 py-3 bg-black/40 backdrop-blur-sm text-white rounded-lg border border-white/10 shadow-[0_4px_12px_rgba(0,0,0,0.1)] focus:outline-none focus:ring-2 focus:ring-blue-500/50 disabled:opacity-50 disabled:cursor-not-allowed placeholder:text-white/50"
                />
                <div className="absolute inset-0 rounded-lg bg-gradient-to-t from-black/20 to-transparent pointer-events-none" />
              </div>

              <button
                onClick={handleJoinGame}
                disabled={!playerName || isJoining}
                className="w-full py-3 bg-gradient-to-b from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white rounded-lg text-lg font-semibold shadow-[0_4px_12px_rgba(0,0,0,0.2)] disabled:opacity-50 disabled:cursor-not-allowed transform hover:scale-105 transition-all duration-200 border border-white/10"
              >
                {isJoining ? (
                  <span className="flex items-center justify-center gap-2">
                    <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                    Joining...
                  </span>
                ) : (
                  "Join Game"
                )}
              </button>

              {/* Decorative chips */}
              <div className="absolute -left-8 -bottom-6 transform rotate-12">
                <div className="w-12 h-12 rounded-full bg-gradient-to-b from-red-400 to-red-600 border-2 border-t-white/20 border-b-black/20 shadow-lg" style={{ transform: 'rotateX(45deg)' }} />
              </div>
              <div className="absolute -right-4 -top-6 transform -rotate-12">
                <div className="w-10 h-10 rounded-full bg-gradient-to-b from-blue-400 to-blue-600 border-2 border-t-white/20 border-b-black/20 shadow-lg" style={{ transform: 'rotateX(45deg)' }} />
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <main className="min-h-screen bg-gray-900 p-8">
      {showJoinDialog && tableInfo && (
        <TableJoinDialog
          availableSeats={tableInfo.availableSeats}
          minBuyIn={tableInfo.minBuyIn}
          suggestedBuyIn={tableInfo.suggestedBuyIn}
          onJoin={handleBuyIn}
          onCancel={() => setShowJoinDialog(false)}
          players={gameState.players}
        />
      )}
      <PokerTable
        gameState={gameState}
        onAction={handleAction}
        playerId={playerId}
      />
    </main>
  );
}
