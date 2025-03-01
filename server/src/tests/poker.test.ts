import { GameState, Player } from '../types/poker';

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
    gameState.currentBet = 20; // Big blind amount
    
    // Small blind has called (total bet 20)
    player1.currentBet = 20;
    player1.hasActed = true;
    
    // Big blind player
    player2.currentBet = 20;
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
  const allBetsEqual = activePlayers.every(p => p.currentBet === gameState.currentBet || p.isAllIn || p.chips === 0);
  const isPreFlopBigBlindCheck = gameState.phase === "pre-flop" && 
    player.currentBet === gameState.bigBlind && 
    activePlayers.every(p => p.currentBet === gameState.bigBlind || !p.isActive);

  // Return true if we should move to next phase
  return (allPlayersActed && allBetsEqual) || isPreFlopBigBlindCheck;
} 