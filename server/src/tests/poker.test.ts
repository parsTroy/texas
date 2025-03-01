import { describe, test, expect, beforeEach } from '@jest/globals';
import { GameState, Player } from '../types/poker';

const BIG_BLIND = 20;

// Mock game state setup
function createMockGameState(players: Player[]): GameState {
  return {
    players,
    communityCards: [],
    deck: [],
    pot: 40,
    currentBet: 20,
    phase: "pre-flop",
    activePlayerId: null,
    dealerId: null,
    smallBlind: 10,
    bigBlind: 20,
    lastBetPlayerId: null,
    maxPlayers: 6,
    availableSeats: []
  };
}

// Test helper to create a player
function createMockPlayer(id: string, name: string, chips: number = 1000, currentBet: number = 0): Player {
  return {
    id,
    name,
    chips,
    cards: [],
    isActive: true,
    currentBet,
    isTurn: false,
    isDealer: false,
    hasActed: false,
    isAllIn: false,
    isWinner: false,
    isSittingOut: false,
    seatNumber: null,
    isReadyToPlay: true
  };
}

describe('Poker Game Check Action Tests', () => {
  let gameState: GameState;
  let player1: Player;
  let player2: Player;

  beforeEach(() => {
    // Setup fresh game state before each test
    player1 = createMockPlayer('1', 'Player 1');
    player2 = createMockPlayer('2', 'Player 2');
    gameState = createMockGameState([player1, player2]);
  });

  test('Pre-flop: Small blind calls, big blind checks should move to flop', () => {
    // Setup pre-flop scenario
    gameState.phase = 'pre-flop';
    gameState.currentBet = BIG_BLIND;
    
    // Set dealer position
    player1.isDealer = true;
    
    // Small blind has called (total bet 20)
    player1.currentBet = BIG_BLIND;
    player1.hasActed = true;
    
    // Big blind player
    player2.currentBet = BIG_BLIND;
    player2.isTurn = true;
    gameState.activePlayerId = player2.id;

    // Simulate check action
    const shouldMoveToFlop = checkAction(gameState, player2);
    
    expect(shouldMoveToFlop).toBe(true);
    expect(player2.hasActed).toBe(true);
  });

  test('Post-flop: Both players check should move to next phase', () => {
    // Setup flop scenario
    gameState.phase = 'flop';
    gameState.currentBet = 0;
    
    // First player checks
    player1.currentBet = 0;
    player1.hasActed = true;
    
    // Second player's turn to check
    player2.currentBet = 0;
    player2.isTurn = true;
    gameState.activePlayerId = player2.id;

    const shouldMoveToNextPhase = checkAction(gameState, player2);
    
    expect(shouldMoveToNextPhase).toBe(true);
    expect(player2.hasActed).toBe(true);
  });

  test('Check should not be allowed when there is an existing bet', () => {
    gameState.phase = 'flop';
    gameState.currentBet = 50;
    
    player1.currentBet = 50;
    player1.hasActed = true;
    
    player2.currentBet = 0;
    player2.isTurn = true;
    gameState.activePlayerId = player2.id;

    expect(() => checkAction(gameState, player2)).toThrow();
  });

  test('First check should move to next player', () => {
    gameState.phase = 'flop';
    gameState.currentBet = 0;
    
    player1.isTurn = true;
    gameState.activePlayerId = player1.id;
    
    const shouldMoveToNextPhase = checkAction(gameState, player1);
    
    expect(shouldMoveToNextPhase).toBe(false);
    expect(player1.hasActed).toBe(true);
  });
});

// Simplified check action logic for testing
function checkAction(gameState: GameState, player: Player): boolean {
  if (gameState.currentBet > player.currentBet) {
    throw new Error("Cannot check - there is a bet to call");
  }
  
  player.hasActed = true;
  
  const activePlayers = gameState.players.filter(p => p.isActive);
  const allPlayersActed = activePlayers.every(p => p.hasActed || p.isAllIn || p.chips === 0);
  
  // Special handling for pre-flop big blind check
  const dealerIndex = gameState.players.findIndex(p => p.isDealer);
  const bigBlindIndex = (dealerIndex + 2) % gameState.players.length;
  const isPreFlop = gameState.phase === "pre-flop";
  const isBigBlindPlayer = gameState.players.indexOf(player) === bigBlindIndex;
  
  // Pre-flop completion conditions:
  // 1. We're in pre-flop phase
  // 2. The current player is the big blind
  // 3. All players have acted
  // 4. Everyone has matched the big blind or folded/all-in
  const allMatchBigBlind = activePlayers.every(p => 
    p.currentBet === BIG_BLIND || !p.isActive || p.isAllIn || p.chips === 0
  );
  const isPreFlopComplete = isPreFlop && isBigBlindPlayer && allPlayersActed && allMatchBigBlind;

  // Post-flop completion conditions:
  // 1. Not in pre-flop
  // 2. All players have acted
  // 3. No outstanding bets (everyone has checked or folded)
  const noOutstandingBets = activePlayers.every(p => 
    p.currentBet === 0 || !p.isActive || p.isAllIn || p.chips === 0
  );
  const isPostFlopComplete = !isPreFlop && allPlayersActed && noOutstandingBets;

  // Return true if we should move to next phase
  return isPreFlopComplete || isPostFlopComplete;
} 