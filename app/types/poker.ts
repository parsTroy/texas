export type Suit = "hearts" | "diamonds" | "clubs" | "spades";
export type Rank = "2" | "3" | "4" | "5" | "6" | "7" | "8" | "9" | "10" | "J" | "Q" | "K" | "A";

export interface Card {
  suit: Suit;
  rank: Rank;
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
}

export interface GameState {
  players: Player[];
  communityCards: Card[];
  pot: number;
  currentBet: number;
  phase: "pre-flop" | "flop" | "turn" | "river" | "showdown";
  activePlayerId: string | null;
  dealerId: string | null;
  smallBlind: number;
  bigBlind: number;
  lastBetPlayerId: string | null;
}

export interface GameAction {
  type: "fold" | "check" | "call" | "raise";
  playerId: string;
  amount?: number;
}

export interface TableConfig {
  maxPlayers: number;
  smallBlind: number;
  bigBlind: number;
  minBuyIn: number;
  maxBuyIn: number;
} 