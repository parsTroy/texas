import React, { useState } from 'react';
import { Player } from '../../types/poker';

interface TableJoinDialogProps {
  availableSeats: number[];
  minBuyIn: number;
  suggestedBuyIn: number;
  onJoin: (seatNumber: number, buyInAmount: number) => void;
  onCancel: () => void;
  players: Player[];
}

export function TableJoinDialog({
  availableSeats,
  minBuyIn,
  suggestedBuyIn,
  onJoin,
  onCancel,
  players
}: TableJoinDialogProps) {
  const [selectedSeat, setSelectedSeat] = useState<number | null>(null);
  const [buyInAmount, setBuyInAmount] = useState<number>(suggestedBuyIn);
  const [error, setError] = useState<string>("");

  const handleJoin = () => {
    if (selectedSeat === null) {
      setError("Please select a seat");
      return;
    }

    if (buyInAmount < minBuyIn) {
      setError(`Minimum buy-in is ${minBuyIn} chips`);
      return;
    }

    onJoin(selectedSeat, buyInAmount);
  };

  // Create array of all possible seats
  const allSeats = Array.from({ length: 6 }, (_, i) => i);

  return (
    <div className="fixed inset-0 flex items-center justify-center z-50">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
      <div className="relative bg-gradient-to-b from-gray-800 to-gray-900 p-8 rounded-xl shadow-2xl border border-white/10 max-w-md w-full mx-4">
        <h2 className="text-2xl font-bold text-white mb-6">Join Table</h2>

        {/* Seat Selection */}
        <div className="mb-6">
          <label className="block text-white text-sm font-medium mb-2">
            Select Seat
          </label>
          <div className="grid grid-cols-3 gap-3">
            {allSeats.map((seat) => {
              const isOccupied = players.some(p => p.seatNumber === seat);
              const isAvailable = availableSeats.includes(seat);
              
              return (
                <button
                  key={seat}
                  onClick={() => isAvailable && setSelectedSeat(seat)}
                  disabled={!isAvailable || isOccupied}
                  className={`p-4 rounded-lg border-2 transition-all duration-200 ${
                    selectedSeat === seat
                      ? 'border-blue-500 bg-blue-500/20'
                      : isOccupied
                      ? 'border-red-500/50 bg-red-500/10 opacity-50 cursor-not-allowed'
                      : !isAvailable
                      ? 'border-gray-500/50 bg-gray-500/10 opacity-50 cursor-not-allowed'
                      : 'border-white/10 hover:border-white/30 bg-black/20'
                  }`}
                >
                  <div className="text-white font-medium">
                    Seat {seat + 1}
                    {isOccupied && (
                      <div className="text-xs opacity-75">
                        {players.find(p => p.seatNumber === seat)?.name}
                      </div>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Buy-in Amount */}
        <div className="mb-6">
          <label className="block text-white text-sm font-medium mb-2">
            Buy-in Amount (Min: {minBuyIn})
          </label>
          <div className="flex gap-2">
            <input
              type="number"
              value={buyInAmount}
              onChange={(e) => setBuyInAmount(Math.max(0, parseInt(e.target.value) || 0))}
              className="flex-1 px-4 py-2 bg-black/40 text-white rounded-lg border border-white/10 focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Enter amount"
            />
            <button
              onClick={() => setBuyInAmount(suggestedBuyIn)}
              className="px-4 py-2 bg-gradient-to-b from-blue-500 to-blue-600 text-white rounded-lg hover:from-blue-600 hover:to-blue-700 transition-colors"
            >
              Suggested ({suggestedBuyIn})
            </button>
          </div>
        </div>

        {/* Error Message */}
        {error && (
          <div className="mb-4 text-red-400 text-sm">
            {error}
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex gap-4">
          <button
            onClick={handleJoin}
            className="flex-1 px-6 py-3 bg-gradient-to-b from-green-500 to-green-600 text-white rounded-lg font-semibold hover:from-green-600 hover:to-green-700 transition-colors"
          >
            Join Table
          </button>
          <button
            onClick={onCancel}
            className="px-6 py-3 bg-gradient-to-b from-gray-600 to-gray-700 text-white rounded-lg font-semibold hover:from-gray-700 hover:to-gray-800 transition-colors"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
} 