"use client";

import React, { useState, useEffect } from "react";
import { Card, GameState, Player } from "../../types/poker";

interface PokerTableProps {
  gameState: GameState;
  onAction: (action: string, amount?: number) => void;
  playerId: string;
}

const TURN_TIME_LIMIT = 30;

export function PokerTable({ gameState, onAction, playerId }: PokerTableProps) {
  const [selectedAmount, setSelectedAmount] = useState<number>(0);
  const [timeLeft, setTimeLeft] = useState<number>(TURN_TIME_LIMIT);
  const currentPlayer = gameState.players.find(p => p.id === playerId);
  const isPlayerTurn = currentPlayer?.isTurn ?? false;

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
    <div className="relative w-full max-w-4xl aspect-[2/1] bg-green-800 rounded-[50%] p-4 mx-auto">
      {/* Community Cards */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 flex gap-3">
        {gameState.communityCards.map((card, i) => (
          <div
            key={`${card.suit}-${card.rank}-${i}`}
            className={`w-20 h-32 rounded-lg flex flex-col items-center justify-between p-2 shadow-lg ${
              card.suit === "spades" ? "bg-gray-900" :
              card.suit === "hearts" ? "bg-red-600" :
              card.suit === "diamonds" ? "bg-blue-600" :
              "bg-green-600"
            }`}
          >
            <div className="text-xl font-bold text-white">{card.rank}</div>
            <div className="text-3xl text-white">
              {card.suit === "hearts" ? "♥" : card.suit === "diamonds" ? "♦" : card.suit === "clubs" ? "♣" : "♠"}
            </div>
            <div className="text-xl font-bold text-white rotate-180">{card.rank}</div>
          </div>
        ))}
      </div>

      {/* Players */}
      <div className="absolute inset-0">
        {gameState.players.map((player, index) => {
          const position = getPlayerPosition(index, gameState.players.length);
          return (
            <div
              key={player.id}
              className={`absolute ${position} p-2 bg-black/50 rounded-lg text-white`}
              style={{ transform: "translate(-50%, -50%)" }}
            >
              <div className="text-sm font-bold">{player.name}</div>
              <div className="text-xs">Chips: {player.chips}</div>
              {player.isDealer && <div className="text-xs">Dealer</div>}
              {player.currentBet > 0 && <div className="text-xs">Bet: {player.currentBet}</div>}
              {player.isTurn && (
                <div className="text-xs text-yellow-400">
                  Time: {timeLeft}s
                </div>
              )}
              {/* Player Cards - Only show small cards for other players */}
              {player.cards.length > 0 && player.id !== playerId && (
                <div className="flex gap-1 mt-1">
                  {Array(2).fill(0).map((_, i) => (
                    <div
                      key={`card-back-${i}`}
                      className="w-8 h-12 bg-blue-800 rounded-sm border border-white flex items-center justify-center"
                    >
                      <div className="w-5 h-9 border-2 border-white rounded-sm"></div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Current Player's Cards - Fixed at bottom center */}
      {currentPlayer && currentPlayer.cards && currentPlayer.cards.length > 0 && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 flex gap-3 z-10">
          {currentPlayer.cards.map((card, i) => (
            <div
              key={`${card.suit}-${card.rank}-${i}`}
              className={`w-24 h-36 rounded-lg flex flex-col items-center justify-between p-3 shadow-lg ${
                card.suit === "spades" ? "bg-gray-900" :
                card.suit === "hearts" ? "bg-red-600" :
                card.suit === "diamonds" ? "bg-blue-600" :
                "bg-green-600"
              }`}
            >
              <div className="text-2xl font-bold text-white">{card.rank}</div>
              <div className="text-4xl text-white">
                {card.suit === "hearts" ? "♥" : card.suit === "diamonds" ? "♦" : card.suit === "clubs" ? "♣" : "♠"}
              </div>
              <div className="text-2xl font-bold text-white rotate-180">{card.rank}</div>
            </div>
          ))}
        </div>
      )}

      {/* Player Controls - Moved to right side */}
      {isPlayerTurn && (
        <div className="fixed bottom-6 right-8 flex flex-col gap-4 p-6 bg-black/70 rounded-lg z-20">
          <div className="flex gap-4">
            <button
              onClick={() => onAction("fold")}
              className="px-6 py-3 bg-red-600 text-white rounded-md text-lg font-semibold hover:bg-red-700"
            >
              Fold
            </button>
            {gameState.currentBet === currentPlayer?.currentBet && (
              <button
                onClick={() => onAction("check")}
                className="px-6 py-3 bg-blue-600 text-white rounded-md text-lg font-semibold hover:bg-blue-700"
              >
                Check
              </button>
            )}
            {gameState.currentBet > (currentPlayer?.currentBet ?? 0) && (
              <button
                onClick={() => onAction("call")}
                className="px-6 py-3 bg-blue-600 text-white rounded-md text-lg font-semibold hover:bg-blue-700"
              >
                Call ({gameState.currentBet - (currentPlayer?.currentBet ?? 0)})
              </button>
            )}
          </div>
          <div className="flex items-center gap-3">
            <input
              type="number"
              value={selectedAmount}
              onChange={(e) => setSelectedAmount(Number(e.target.value))}
              className="w-28 px-3 py-3 rounded-md text-lg"
              min={gameState.currentBet * 2}
              max={currentPlayer?.chips ?? 0}
            />
            <button
              onClick={() => onAction("raise", selectedAmount)}
              className="px-6 py-3 bg-green-600 text-white rounded-md text-lg font-semibold hover:bg-green-700"
            >
              Raise
            </button>
          </div>
        </div>
      )}

      {/* Game Info */}
      <div className="absolute top-4 left-1/2 -translate-x-1/2 text-white text-center">
        <div className="font-bold">Pot: {gameState.pot}</div>
        <div className="text-sm">
          Blinds: {gameState.smallBlind}/{gameState.bigBlind}
        </div>
        <div className="text-sm capitalize">
          Phase: {gameState.phase.replace("-", " ")}
        </div>
      </div>
    </div>
  );
}

function getPlayerPosition(index: number, totalPlayers: number): string {
  const positions = {
    2: ["bottom-0 left-1/4", "bottom-0 right-1/4"],
    3: ["bottom-0 left-1/4", "top-0 center", "bottom-0 right-1/4"],
    4: ["bottom-0 left-1/4", "top-0 left-1/4", "top-0 right-1/4", "bottom-0 right-1/4"],
    6: [
      "bottom-0 left-1/4",
      "top-1/3 left-0",
      "top-0 left-1/3",
      "top-0 right-1/3",
      "top-1/3 right-0",
      "bottom-0 right-1/4",
    ],
  };

  return positions[totalPlayers as keyof typeof positions]?.[index] ?? "top-0 left-0";
} 