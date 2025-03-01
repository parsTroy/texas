export type Suit = "hearts" | "diamonds" | "clubs" | "spades";
export type Rank = "2" | "3" | "4" | "5" | "6" | "7" | "8" | "9" | "10" | "J" | "Q" | "K" | "A";

export interface Card {
  suit: string;
  rank: string;
}

export interface HandResult {
  name: string;
  description: string;
  cards: Card[];
}

export interface Player {
  id: string;
  name: string;
  chips: number;
  cards: Card[];
  isActive: boolean;
  currentBet: number;
  isTurn: boolean;
  isDealer: boolean;
  hasActed: boolean;
  isAllIn: boolean;
  isWinner: boolean;
  isSittingOut: boolean;
  seatNumber: number | null;
  isReadyToPlay: boolean;
}

export interface GameState {
  players: Player[];
  communityCards: Card[];
  pot: number;
  currentBet: number;
  phase: string;
  activePlayerId: string | null;
  dealerId: string | null;
  smallBlind: number;
  bigBlind: number;
  lastBetPlayerId: string | null;
  maxPlayers: number;
  availableSeats: number[];
}

export interface GameAction {
  type: "fold" | "check" | "call" | "raise";
  playerId: string;
  amount?: number;
}

export interface TableInfo {
  availableSeats: number[];
  minBuyIn: number;
  suggestedBuyIn: number;
  maxBuyIn: number;
}

export interface BuyInRequest {
  amount: number;
  seatNumber: number;
}

export interface GameNotification {
  type: 'waiting-for-players' | 'new-game' | 'game-end' | 'hand-winner' | 'dealing' | 'phase-change' | 'action-required';
  message: string;
  winner?: Player;
  winningHand?: HandResult;
  duration?: number;
  nextGameCountdown?: number;
} 