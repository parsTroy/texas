"use client";

import React, { useState, useEffect } from "react";
import { Card, GameState, Player } from "../../types/poker";

interface PokerTableProps {
  gameState: GameState;
  onAction: (action: string, amount?: number) => void;
  playerId: string;
}

const TURN_TIME_LIMIT = 30;

interface ChipStack {
  value: number;
  count: number;
}

// Add game state notification types
type GameNotification = {
  type: 'waiting-for-players' | 'new-game' | 'game-end' | 'hand-winner';
  message: string;
  winner?: Player;
  duration?: number;
};

// Add chip stack images for different denominations
const CHIP_IMAGES = {
  1: { emoji: "🔵", color: "from-blue-400 to-blue-600" },
  5: { emoji: "🔴", color: "from-red-400 to-red-600" },
  10: { emoji: "🟣", color: "from-purple-400 to-purple-600" },
  25: { emoji: "🟢", color: "from-green-400 to-green-600" },
  100: { emoji: "⚫️", color: "from-gray-700 to-gray-900" },
} as const;

function getChipStacks(amount: number): ChipStack[] {
  const stacks: ChipStack[] = [];
  const denominations = [100, 25, 10, 5, 1];
  
  let remaining = amount;
  for (const denom of denominations) {
    const count = Math.floor(remaining / denom);
    if (count > 0) {
      stacks.push({ value: denom, count });
      remaining %= denom;
    }
  }
  return stacks;
}

function getPlayerPosition(index: number, totalPlayers: number): string {
  // Only position opponent players around the table
  const positions = {
    2: ["top-1/3 left-1/3", "top-1/3 right-1/3"],
    3: ["top-1/3 left-1/4", "top-1/3", "top-1/3 right-1/4"],
    4: ["top-1/3 left-1/4", "top-1/3", "top-1/3 right-1/4", "top-1/2 right-1/4"],
    6: [
      "top-1/3 left-1/4",
      "top-1/3",
      "top-1/3 right-1/4",
      "top-1/2 right-1/4",
      "top-1/2",
      "top-1/2 left-1/4",
    ],
  };

  return positions[totalPlayers as keyof typeof positions]?.[index] ?? "top-0 left-0";
}

export function PokerTable({ gameState, onAction, playerId }: PokerTableProps) {
  const [selectedAmount, setSelectedAmount] = useState<number>(0);
  const [customAmount, setCustomAmount] = useState<number>(0);
  const [timeLeft, setTimeLeft] = useState<number>(TURN_TIME_LIMIT);
  const [notification, setNotification] = useState<GameNotification | null>(null);
  const currentPlayer = gameState.players.find(p => p.id === playerId);
  const isPlayerTurn = currentPlayer?.isTurn ?? false;

  // Calculate min raise
  const minRaise = Math.max(
    gameState.currentBet * 2,
    gameState.currentBet + gameState.bigBlind
  );

  // Calculate pot percentages
  const potPercentages = {
    ten: Math.floor(gameState.pot * 0.1),
    quarter: Math.floor(gameState.pot * 0.25),
    half: Math.floor(gameState.pot * 0.5),
    eightyPercent: Math.floor(gameState.pot * 0.8)
  };

  // Handle game state notifications
  useEffect(() => {
    let timeoutId: NodeJS.Timeout;

    const showNotification = (newNotification: GameNotification) => {
      setNotification(newNotification);
      if (newNotification.duration && newNotification.duration > 0) {
        timeoutId = setTimeout(() => setNotification(null), newNotification.duration);
      }
    };

    // Clear any existing notification if phase changes
    if (notification?.type !== 'waiting-for-players') {
      setNotification(null);
    }

    if (gameState.phase === 'waiting-for-players' && gameState.players.length === 1) {
      showNotification({
        type: 'waiting-for-players',
        message: 'Waiting for more players to join...',
        duration: -1 // Show indefinitely
      });
    } else if (gameState.phase === 'game-start') {
      showNotification({
        type: 'new-game',
        message: 'New Game Starting...',
        duration: 5000 // 5 seconds
      });
    } else if (gameState.phase === 'game-end') {
      const winner = gameState.players.find(p => p.isWinner);
      if (winner) {
        showNotification({
          type: 'game-end',
          message: `${winner.name} wins the hand!`,
          winner,
          duration: 12000 // Increased to 12 seconds
        });
      }
    }

    return () => {
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
    };
  }, [gameState.phase, gameState.players.length]);

  useEffect(() => {
    if (isPlayerTurn) {
      setTimeLeft(TURN_TIME_LIMIT);
      const timer = setInterval(() => {
        setTimeLeft((prev) => Math.max(0, prev - 1));
      }, 1000);
      return () => clearInterval(timer);
    }
  }, [isPlayerTurn]);

  return (
    <div className="relative w-full max-w-4xl aspect-[2/1] mx-auto mt-24">
      {/* Game State Notifications */}
      {notification && (
        <div className="fixed inset-0 flex items-center justify-center z-30 pointer-events-none">
          <div className={`transform transition-all duration-500 ${
            notification ? 'scale-100 opacity-100' : 'scale-95 opacity-0'
          }`}>
            {notification.type === 'waiting-for-players' && (
              <div className="bg-gradient-to-b from-purple-500 to-purple-600 text-white px-8 py-6 rounded-xl shadow-[0_8px_32px_rgba(0,0,0,0.4)] border-2 border-white/20 backdrop-blur-lg">
                <div className="text-4xl font-bold mb-2">👥 Waiting for Players</div>
                <div className="text-xl text-white/90 flex items-center gap-3">
                  {notification.message}
                  <div className="flex gap-1">
                    <div className="w-2 h-2 rounded-full bg-white/80 animate-bounce" style={{ animationDelay: '0ms' }} />
                    <div className="w-2 h-2 rounded-full bg-white/80 animate-bounce" style={{ animationDelay: '150ms' }} />
                    <div className="w-2 h-2 rounded-full bg-white/80 animate-bounce" style={{ animationDelay: '300ms' }} />
                  </div>
                </div>
              </div>
            )}
            {notification.type === 'new-game' && (
              <div className="bg-gradient-to-b from-blue-500 to-blue-600 text-white px-8 py-6 rounded-xl shadow-[0_8px_32px_rgba(0,0,0,0.4)] border-2 border-white/20 backdrop-blur-lg">
                <div className="text-4xl font-bold mb-2">🎲 New Game</div>
                <div className="text-xl text-white/90">Dealing cards...</div>
              </div>
            )}
            {notification.type === 'game-end' && notification.winner && (
              <div className="bg-gradient-to-b from-yellow-500 to-amber-600 text-white px-8 py-6 rounded-xl shadow-[0_8px_32px_rgba(0,0,0,0.4)] border-2 border-white/20 backdrop-blur-lg">
                <div className="text-4xl font-bold mb-2">🏆 Winner!</div>
                <div className="text-2xl">{notification.winner.name}</div>
                <div className="text-xl text-white/90 mt-2">
                  Wins {gameState.pot} chips
                </div>
                <div className="text-sm text-white/70 mt-4">
                  Next game starting soon...
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Table Surface with 2.5D effect */}
      <div className="absolute inset-0 bg-gradient-to-b from-green-900 to-green-800 rounded-[50%] shadow-[inset_0_0_100px_rgba(0,0,0,0.5),0_20px_60px_-20px_rgba(0,0,0,0.8)] border-8 border-amber-950/50 overflow-hidden">
        {/* Table felt texture */}
        <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSI0IiBoZWlnaHQ9IjQiPgo8cmVjdCB3aWR0aD0iNCIgaGVpZ2h0PSI0IiBmaWxsPSIjMDAwMDAwMTAiPjwvcmVjdD4KPC9zdmc+')] opacity-50" />
        {/* Table rim highlight */}
        <div className="absolute inset-0 rounded-[50%] bg-gradient-to-b from-amber-600/10 to-transparent" />
      </div>

      {/* Community Cards - Moved lower */}
      <div className="absolute top-[60%] left-1/2 -translate-x-1/2 -translate-y-1/2 flex gap-4 perspective-[1000px]">
        {gameState.communityCards.map((card, i) => (
          <div
            key={`${card.suit}-${card.rank}-${i}`}
            className={`w-20 h-32 rounded-lg flex flex-col items-center justify-between p-2 transform transition-transform hover:scale-105 ${
              card.suit === "spades" ? "bg-gradient-to-br from-gray-800 to-gray-900" :
              card.suit === "hearts" ? "bg-gradient-to-br from-red-500 to-red-600" :
              card.suit === "diamonds" ? "bg-gradient-to-br from-blue-500 to-blue-600" :
              "bg-gradient-to-br from-green-500 to-green-600"
            } shadow-[0_10px_20px_rgba(0,0,0,0.3)] border border-white/10`}
            style={{ transform: `rotateX(10deg) translateZ(20px)` }}
          >
            <div className="text-xl font-bold text-white drop-shadow-lg">{card.rank}</div>
            <div className="text-3xl text-white filter drop-shadow-lg transform transition-transform hover:scale-110">
              {card.suit === "hearts" ? "♥" : card.suit === "diamonds" ? "♦" : card.suit === "clubs" ? "♣" : "♠"}
            </div>
            <div className="text-xl font-bold text-white drop-shadow-lg rotate-180">{card.rank}</div>
          </div>
        ))}
      </div>

      {/* Pot Display - Simplified and moved higher */}
      {gameState.pot > 0 && (
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2">
          <div className="text-2xl font-bold text-white bg-black/80 px-6 py-3 rounded-full shadow-lg">
            Pot: {gameState.pot}
          </div>
        </div>
      )}

      {/* Opponent Players */}
      <div className="absolute inset-0">
        {gameState.players
          .filter(player => player.id !== playerId)
          .map((player, index) => {
            const position = getPlayerPosition(index, gameState.players.length - 1);
            return (
              <div
                key={player.id}
                className={`absolute ${position} p-3 bg-black/80 backdrop-blur-sm rounded-lg text-white shadow-xl border border-white/10 transform transition-all duration-200 ${player.isTurn ? 'scale-110 ring-2 ring-yellow-400' : ''}`}
                style={{ transform: `translate(-50%, -50%) ${player.isTurn ? 'scale(1.1)' : ''}` }}
              >
                {/* Position Indicators for Opponents */}
                <div className="absolute -bottom-8 left-1/2 -translate-x-1/2 flex gap-4">
                  {player.isDealer && (
                    <div className="w-10 h-10 rounded-full bg-gradient-to-b from-yellow-300 to-yellow-600 flex items-center justify-center text-black font-bold shadow-[0_4px_8px_rgba(0,0,0,0.3)] border-2 border-t-white/40 border-b-black/40 transform hover:scale-110 transition-transform"
                      style={{ transform: 'rotateX(45deg)', transformStyle: 'preserve-3d' }}>
                      D
                    </div>
                  )}
                  {gameState.players[(gameState.players.findIndex(p => p.isDealer) + 1) % gameState.players.length].id === player.id && (
                    <div className="w-10 h-10 rounded-full bg-gradient-to-b from-blue-400 to-blue-700 flex items-center justify-center text-white font-bold shadow-[0_4px_8px_rgba(0,0,0,0.3)] border-2 border-t-white/40 border-b-black/40 transform hover:scale-110 transition-transform"
                      style={{ transform: 'rotateX(45deg)', transformStyle: 'preserve-3d' }}>
                      SB
                    </div>
                  )}
                  {gameState.players[(gameState.players.findIndex(p => p.isDealer) + 2) % gameState.players.length].id === player.id && (
                    <div className="w-10 h-10 rounded-full bg-gradient-to-b from-red-400 to-red-700 flex items-center justify-center text-white font-bold shadow-[0_4px_8px_rgba(0,0,0,0.3)] border-2 border-t-white/40 border-b-black/40 transform hover:scale-110 transition-transform"
                      style={{ transform: 'rotateX(45deg)', transformStyle: 'preserve-3d' }}>
                      BB
                    </div>
                  )}
                </div>

                <div className="text-sm font-bold mb-1">{player.name}</div>
                
                {/* Current Bet Display - Moved lower */}
                {player.currentBet > 0 && (
                  <div className="absolute -bottom-32 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2">
                    <div className="flex flex-wrap justify-center gap-2 min-w-[100px]">
                      {getChipStacks(player.currentBet).map(({ value, count }, i) => (
                        <div
                          key={`bet-${value}-${i}`}
                          className="relative"
                        >
                          <div className="flex flex-col-reverse items-center">
                            {Array(Math.min(count, 3)).fill(0).map((_, j) => (
                              <div
                                key={`chip-${j}`}
                                className={`w-8 h-8 rounded-full bg-gradient-to-b ${CHIP_IMAGES[value as keyof typeof CHIP_IMAGES].color} -mb-6 transform hover:scale-110 transition-transform shadow-[0_2px_4px_rgba(0,0,0,0.3)] border-2 border-t-white/20 border-b-black/20 flex items-center justify-center font-bold text-white text-xs`}
                                style={{ 
                                  marginBottom: j === 0 ? 0 : '-1.5rem',
                                  transform: `translateY(${j * 1}px) rotateX(45deg)`,
                                  transformStyle: 'preserve-3d'
                                }}
                              >
                                {value}
                              </div>
                            ))}
                          </div>
                          {count > 3 && (
                            <div className="absolute -right-2 -top-2 bg-black/80 text-white text-xs px-2 py-0.5 rounded-full shadow-lg">
                              x{count}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                    <div className="text-xs bg-black/90 px-2 py-1 rounded-full shadow-lg">
                      Bet: {player.currentBet}
                    </div>
                  </div>
                )}

                {player.isTurn && (
                  <div className="text-xs text-yellow-400 font-bold mt-1">
                    Time: {timeLeft}s
                  </div>
                )}

                {/* Opponent Cards */}
                {player.cards.length > 0 && (
                  <div className="flex gap-2 mt-2 perspective-[1000px]">
                    {Array(2).fill(0).map((_, i) => (
                      <div
                        key={`card-back-${i}`}
                        className="w-10 h-14 bg-gradient-to-br from-blue-700 to-blue-900 rounded-md shadow-lg border border-white/20 transform hover:scale-105 transition-transform"
                        style={{ transform: 'rotateX(10deg) translateZ(2px)' }}
                      >
                        <div className="w-full h-full rounded-md bg-[url('data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSI4IiBoZWlnaHQ9IjgiPgo8cmVjdCB3aWR0aD0iOCIgaGVpZ2h0PSI4IiBmaWxsPSIjZmZmZmZmMDUiPjwvcmVjdD4KPHBhdGggZD0iTTAgMEw4IDhNOCAwTDAgOCIgc3Ryb2tlPSIjZmZmZmZmMTAiIHN0cm9rZS13aWR0aD0iMSI+PC9wYXRoPgo8L3N2Zz4=')] opacity-50" />
                      </div>
                    ))}
                  </div>
                )}

                {/* Chips Display */}
                <div className="text-xs font-semibold mt-2 bg-black/60 px-3 py-1 rounded-full text-center">
                  {player.chips} chips
                </div>
              </div>
            );
          })}
      </div>

      {/* Current Player's Cards and Info - Fixed at bottom */}
      {currentPlayer && (
        <div className="fixed bottom-8 left-1/2 -translate-x-1/2 flex flex-col items-center gap-4">
          {/* Game Status Indicator */}
          {!isPlayerTurn && gameState.activePlayerId && (
            <div className="text-lg text-white/90 bg-black/80 px-6 py-3 rounded-full shadow-lg mb-2 flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-yellow-400 animate-pulse" />
              Waiting for {gameState.players.find(p => p.id === gameState.activePlayerId)?.name ?? 'other player'} to act...
            </div>
          )}

          {/* Position Markers */}
          <div className="flex gap-4 mb-2">
            {currentPlayer.isDealer && (
              <div className="w-12 h-12 rounded-full bg-gradient-to-b from-yellow-300 to-yellow-600 flex items-center justify-center text-black text-lg font-bold shadow-[0_4px_8px_rgba(0,0,0,0.3)] border-2 border-t-white/40 border-b-black/40 transform hover:scale-110 transition-transform"
                style={{ transform: 'rotateX(45deg)', transformStyle: 'preserve-3d' }}>
                D
              </div>
            )}
            {gameState.players[(gameState.players.findIndex(p => p.isDealer) + 1) % gameState.players.length].id === currentPlayer.id && (
              <div className="w-12 h-12 rounded-full bg-gradient-to-b from-blue-400 to-blue-700 flex items-center justify-center text-white text-lg font-bold shadow-[0_4px_8px_rgba(0,0,0,0.3)] border-2 border-t-white/40 border-b-black/40 transform hover:scale-110 transition-transform"
                style={{ transform: 'rotateX(45deg)', transformStyle: 'preserve-3d' }}>
                SB
              </div>
            )}
            {gameState.players[(gameState.players.findIndex(p => p.isDealer) + 2) % gameState.players.length].id === currentPlayer.id && (
              <div className="w-12 h-12 rounded-full bg-gradient-to-b from-red-400 to-red-700 flex items-center justify-center text-white text-lg font-bold shadow-[0_4px_8px_rgba(0,0,0,0.3)] border-2 border-t-white/40 border-b-black/40 transform hover:scale-110 transition-transform"
                style={{ transform: 'rotateX(45deg)', transformStyle: 'preserve-3d' }}>
                BB
              </div>
            )}
          </div>

          {/* Current Player's Bet */}
          {currentPlayer.currentBet > 0 && (
            <div className="flex flex-col items-center gap-3 mb-4">
              <div className="flex flex-wrap justify-center gap-2 min-w-[120px]">
                {getChipStacks(currentPlayer.currentBet).map(({ value, count }, i) => (
                  <div key={`bet-${value}-${i}`} className="relative">
                    <div className="flex flex-col-reverse items-center">
                      {Array(Math.min(count, 3)).fill(0).map((_, j) => (
                        <div
                          key={`chip-${j}`}
                          className={`w-10 h-10 rounded-full bg-gradient-to-b ${CHIP_IMAGES[value as keyof typeof CHIP_IMAGES].color} -mb-7 transform hover:scale-110 transition-transform shadow-[0_3px_6px_rgba(0,0,0,0.3)] border-2 border-t-white/20 border-b-black/20 flex items-center justify-center font-bold text-white text-sm`}
                          style={{ 
                            marginBottom: j === 0 ? 0 : '-1.75rem',
                            transform: `translateY(${j * 1.5}px) rotateX(45deg)`,
                            transformStyle: 'preserve-3d'
                          }}
                        >
                          {value}
                        </div>
                      ))}
                    </div>
                    {count > 3 && (
                      <div className="absolute -right-3 -top-2 bg-black/80 text-white text-sm px-2 py-0.5 rounded-full shadow-lg">
                        x{count}
                      </div>
                    )}
                  </div>
                ))}
              </div>
              <div className="text-sm bg-black/90 px-3 py-1.5 rounded-full shadow-lg">
                Bet: {currentPlayer.currentBet}
              </div>
            </div>
          )}

          {/* Current Player's Cards */}
          {currentPlayer.cards.length > 0 && (
            <div className="flex gap-6 perspective-[1000px]">
              {currentPlayer.cards.map((card, i) => (
                <div
                  key={`${card.suit}-${card.rank}-${i}`}
                  className={`w-32 h-48 rounded-lg flex flex-col items-center justify-between p-4 transform hover:scale-105 transition-all duration-200 ${
                    card.suit === "spades" ? "bg-gradient-to-br from-gray-800 to-gray-900" :
                    card.suit === "hearts" ? "bg-gradient-to-br from-red-500 to-red-600" :
                    card.suit === "diamonds" ? "bg-gradient-to-br from-blue-500 to-blue-600" :
                    "bg-gradient-to-br from-green-500 to-green-600"
                  } shadow-[0_20px_25px_-5px_rgba(0,0,0,0.3),0_10px_10px_-5px_rgba(0,0,0,0.2)] border border-white/10`}
                  style={{ transform: `rotateX(15deg) translateZ(40px)` }}
                >
                  <div className="text-3xl font-bold text-white drop-shadow-lg">{card.rank}</div>
                  <div className="text-5xl text-white filter drop-shadow-lg transform transition-transform hover:scale-110">
                    {card.suit === "hearts" ? "♥" : card.suit === "diamonds" ? "♦" : card.suit === "clubs" ? "♣" : "♠"}
                  </div>
                  <div className="text-3xl font-bold text-white drop-shadow-lg rotate-180">{card.rank}</div>
                </div>
              ))}
            </div>
          )}

          {/* Current Player's Chips */}
          <div className="text-lg font-bold text-white bg-black/80 px-6 py-3 rounded-full shadow-lg mt-4">
            {currentPlayer.chips} chips
          </div>
        </div>
      )}

      {/* Player Controls */}
      {isPlayerTurn ? (
        <div className="fixed bottom-8 right-8 flex flex-col gap-4 p-6 bg-black/90 backdrop-blur-md rounded-xl border border-white/10 shadow-2xl z-20 max-w-md">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
            <span className="text-white/90 text-sm">Your turn - {timeLeft}s</span>
          </div>
          
          {/* Action Buttons */}
          <div className="flex gap-2">
            <button
              onClick={() => onAction("fold")}
              className="px-4 py-2 bg-gradient-to-b from-red-500 to-red-600 text-white rounded-lg text-sm font-semibold shadow-lg hover:from-red-600 hover:to-red-700 transform hover:scale-105 transition-all duration-200"
            >
              Fold
            </button>
            {gameState.currentBet === currentPlayer?.currentBet && (
              <button
                onClick={() => onAction("check")}
                className="px-4 py-2 bg-gradient-to-b from-blue-500 to-blue-600 text-white rounded-lg text-sm font-semibold shadow-lg hover:from-blue-600 hover:to-blue-700 transform hover:scale-105 transition-all duration-200"
              >
                Check
              </button>
            )}
            {gameState.currentBet > (currentPlayer?.currentBet ?? 0) && (
              <button
                onClick={() => onAction("call")}
                className="px-4 py-2 bg-gradient-to-b from-blue-500 to-blue-600 text-white rounded-lg text-sm font-semibold shadow-lg hover:from-blue-600 hover:to-blue-700 transform hover:scale-105 transition-all duration-200"
              >
                Call ({gameState.currentBet - (currentPlayer?.currentBet ?? 0)})
              </button>
            )}
            <button
              onClick={() => onAction("raise", currentPlayer?.chips ?? 0)}
              className="px-4 py-2 bg-gradient-to-b from-purple-500 to-purple-600 text-white rounded-lg text-sm font-semibold shadow-lg hover:from-purple-600 hover:to-purple-700 transform hover:scale-105 transition-all duration-200"
            >
              All-In
            </button>
          </div>

          {/* Bet Size Controls */}
          <div className="grid grid-cols-2 gap-2">
            {/* Pot Percentage Buttons */}
            <button
              onClick={() => {
                const amount = Math.max(minRaise, Math.min(potPercentages.ten, currentPlayer?.chips ?? 0));
                setCustomAmount(amount);
              }}
              className="px-3 py-2 bg-gradient-to-b from-green-500/80 to-green-600/80 text-white rounded-lg text-sm font-semibold shadow-lg hover:from-green-600/80 hover:to-green-700/80 transition-all duration-200"
            >
              10% Pot ({potPercentages.ten})
            </button>
            <button
              onClick={() => {
                const amount = Math.max(minRaise, Math.min(potPercentages.quarter, currentPlayer?.chips ?? 0));
                setCustomAmount(amount);
              }}
              className="px-3 py-2 bg-gradient-to-b from-green-500/80 to-green-600/80 text-white rounded-lg text-sm font-semibold shadow-lg hover:from-green-600/80 hover:to-green-700/80 transition-all duration-200"
            >
              25% Pot ({potPercentages.quarter})
            </button>
            <button
              onClick={() => {
                const amount = Math.max(minRaise, Math.min(potPercentages.half, currentPlayer?.chips ?? 0));
                setCustomAmount(amount);
              }}
              className="px-3 py-2 bg-gradient-to-b from-green-500/80 to-green-600/80 text-white rounded-lg text-sm font-semibold shadow-lg hover:from-green-600/80 hover:to-green-700/80 transition-all duration-200"
            >
              50% Pot ({potPercentages.half})
            </button>
            <button
              onClick={() => {
                const amount = Math.max(minRaise, Math.min(potPercentages.eightyPercent, currentPlayer?.chips ?? 0));
                setCustomAmount(amount);
              }}
              className="px-3 py-2 bg-gradient-to-b from-green-500/80 to-green-600/80 text-white rounded-lg text-sm font-semibold shadow-lg hover:from-green-600/80 hover:to-green-700/80 transition-all duration-200"
            >
              80% Pot ({potPercentages.eightyPercent})
            </button>
          </div>

          {/* Custom Raise Input */}
          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <input
                type="number"
                value={customAmount}
                onChange={(e) => {
                  const value = Number(e.target.value);
                  setCustomAmount(Math.max(minRaise, Math.min(value, currentPlayer?.chips ?? 0)));
                }}
                className="w-full px-3 py-2 rounded-lg text-sm bg-white/10 border border-white/20 text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                min={minRaise}
                max={currentPlayer?.chips ?? 0}
                placeholder={`Min raise: ${minRaise}`}
              />
              <span className="absolute right-2 top-1/2 -translate-y-1/2 text-white/50 text-xs">
                Min: {minRaise}
              </span>
            </div>
            <button
              onClick={() => onAction("raise", customAmount)}
              disabled={customAmount < minRaise}
              className={`px-4 py-2 bg-gradient-to-b text-white rounded-lg text-sm font-semibold shadow-lg transform hover:scale-105 transition-all duration-200 ${
                customAmount >= minRaise
                  ? "from-green-500 to-green-600 hover:from-green-600 hover:to-green-700"
                  : "from-gray-500 to-gray-600 opacity-50 cursor-not-allowed"
              }`}
            >
              Raise to {customAmount}
            </button>
          </div>
        </div>
      ) : (
        <div className="fixed bottom-8 right-8 p-6 bg-black/60 backdrop-blur-sm rounded-xl border border-white/10 shadow-xl z-20">
          <div className="text-white/60 text-sm italic">
            Waiting for your turn...
          </div>
        </div>
      )}

      {/* Game Info - Moved slightly higher */}
      <div className="absolute top-2 left-1/2 -translate-x-1/2 text-white text-center bg-black/80 backdrop-blur-sm px-6 py-3 rounded-xl border border-white/10 shadow-xl">
        <div className="text-sm mt-1">
          Blinds: {gameState.smallBlind}/{gameState.bigBlind}
        </div>
        <div className="text-sm capitalize mt-1 text-yellow-400">
          {gameState.phase.replace("-", " ")}
        </div>
      </div>
    </div>
  );
}