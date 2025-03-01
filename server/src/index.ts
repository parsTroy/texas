import express from "express";
import { createServer } from "http";
import { Server } from "socket.io";
import { GameState, Player, Card } from "./types/poker";
import { createDeck, shuffleDeck, dealCards } from "./lib/poker";

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: process.env.CLIENT_URL || "http://localhost:3000",
    methods: ["GET", "POST"],
  },
});

const PORT = process.env.PORT || 3001;

// Game configuration
const TURN_TIME_LIMIT = 30; // seconds
const SMALL_BLIND = 10;
const BIG_BLIND = 20;
const INITIAL_CHIPS = 1000;

// Game state
let gameState: GameState = {
  players: [],
  communityCards: [],
  pot: 0,
  currentBet: 0,
  phase: "pre-flop",
  activePlayerId: null,
  dealerId: null,
  smallBlind: SMALL_BLIND,
  bigBlind: BIG_BLIND,
  lastBetPlayerId: null,
};

let deck: Card[] = [];
let turnTimer: NodeJS.Timeout | null = null;

function resetPlayerActions() {
  gameState.players.forEach((player: Player) => {
    player.hasActed = false;
    player.currentBet = 0;
    player.isActive = true;
  });
}

function startTurnTimer() {
  if (turnTimer) clearTimeout(turnTimer);
  
  turnTimer = setTimeout(() => {
    const currentPlayer = gameState.players.find(p => p.isTurn);
    if (currentPlayer) {
      // Auto-fold if player doesn't act in time
      handleAction("fold", undefined, currentPlayer.id);
    }
  }, TURN_TIME_LIMIT * 1000);
}

function startNewRound() {
  resetPlayerActions();
  deck = shuffleDeck(createDeck());
  gameState.communityCards = [];
  gameState.pot = 0;
  gameState.currentBet = 0;
  gameState.phase = "pre-flop";
  gameState.lastBetPlayerId = null;

  // Deal cards to players
  gameState.players.forEach((player: Player) => {
    const [playerCards, remainingDeck] = dealCards(deck, 2);
    player.cards = playerCards;
    deck = remainingDeck;
  });

  // Move dealer button and set blinds
  const dealerIndex = gameState.players.findIndex((p: Player) => p.isDealer);
  const newDealerIndex = dealerIndex === -1 ? 0 : (dealerIndex + 1) % gameState.players.length;
  const smallBlindIndex = (newDealerIndex + 1) % gameState.players.length;
  const bigBlindIndex = (newDealerIndex + 2) % gameState.players.length;
  const firstToActIndex = (newDealerIndex + 3) % gameState.players.length;

  // Set dealer and blinds
  gameState.players.forEach((p: Player, i: number) => {
    p.isDealer = i === newDealerIndex;
    p.isTurn = i === firstToActIndex;
    
    if (i === smallBlindIndex) {
      p.chips -= SMALL_BLIND;
      p.currentBet = SMALL_BLIND;
      gameState.pot += SMALL_BLIND;
    } else if (i === bigBlindIndex) {
      p.chips -= BIG_BLIND;
      p.currentBet = BIG_BLIND;
      gameState.pot += BIG_BLIND;
      gameState.lastBetPlayerId = p.id;
    }
  });

  gameState.dealerId = gameState.players[newDealerIndex].id;
  gameState.activePlayerId = gameState.players[firstToActIndex].id;
  gameState.currentBet = BIG_BLIND;

  startTurnTimer();
  io.emit("gameState", gameState);
}

function nextPhase() {
  if (turnTimer) clearTimeout(turnTimer);

  switch (gameState.phase) {
    case "pre-flop":
      gameState.phase = "flop";
      const [flopCards, remainingDeck] = dealCards(deck, 3);
      gameState.communityCards = flopCards;
      deck = remainingDeck;
      break;
    case "flop":
      gameState.phase = "turn";
      const [turnCard, remainingDeckTurn] = dealCards(deck, 1);
      gameState.communityCards.push(...turnCard);
      deck = remainingDeckTurn;
      break;
    case "turn":
      gameState.phase = "river";
      const [riverCard, remainingDeckRiver] = dealCards(deck, 1);
      gameState.communityCards.push(...riverCard);
      deck = remainingDeckRiver;
      break;
    case "river":
      gameState.phase = "showdown";
      // Implement showdown logic here
      setTimeout(() => {
        startNewRound();
      }, 3000);
      return;
  }

  // Reset for new betting round
  resetPlayerActions();
  gameState.currentBet = 0;
  gameState.lastBetPlayerId = null;

  // First to act is first active player after dealer
  const dealerIndex = gameState.players.findIndex((p: Player) => p.isDealer);
  let nextPlayerIndex = (dealerIndex + 1) % gameState.players.length;
  while (!gameState.players[nextPlayerIndex].isActive || gameState.players[nextPlayerIndex].chips === 0) {
    nextPlayerIndex = (nextPlayerIndex + 1) % gameState.players.length;
  }

  gameState.players.forEach((p: Player, i: number) => {
    p.isTurn = i === nextPlayerIndex;
  });
  gameState.activePlayerId = gameState.players[nextPlayerIndex].id;

  startTurnTimer();
  io.emit("gameState", gameState);
}

function handleAction(action: string, amount: number | undefined, playerId: string) {
  if (playerId !== gameState.activePlayerId) return;

  const playerIndex = gameState.players.findIndex((p: Player) => p.id === playerId);
  const player = gameState.players[playerIndex];
  
  if (turnTimer) clearTimeout(turnTimer);

  switch (action) {
    case "fold":
      player.isActive = false;
      player.hasActed = true;
      
      // Emit fold action immediately so all players see it
      io.emit("gameState", gameState);
      
      // Count active players after a short delay to ensure fold animation is seen
      setTimeout(() => {
        const activePlayers = gameState.players.filter(p => p.isActive);
        
        // If only one player remains active, they win
        if (activePlayers.length === 1) {
          const winner = activePlayers[0];
          winner.chips += gameState.pot;
          
          // Emit the win state
          io.emit("gameState", gameState);
          
          // Start new round after showing the win
          setTimeout(() => {
            startNewRound();
          }, 1500);
          return;
        } else {
          // Continue with normal game flow if more than one player is still active
          handleNextTurn();
        }
      }, 750);
      return;
    case "check":
      if (gameState.currentBet > player.currentBet) return;
      player.hasActed = true;
      break;
    case "call":
      const callAmount = gameState.currentBet - player.currentBet;
      player.chips -= callAmount;
      player.currentBet = gameState.currentBet;
      gameState.pot += callAmount;
      player.hasActed = true;
      break;
    case "raise":
      if (!amount || amount < gameState.currentBet * 2) return;
      const raiseAmount = amount - player.currentBet;
      player.chips -= raiseAmount;
      player.currentBet = amount;
      gameState.currentBet = amount;
      gameState.pot += raiseAmount;
      player.hasActed = true;
      gameState.lastBetPlayerId = player.id;
      break;
  }

  // Find next active player
  let nextPlayerIndex = (playerIndex + 1) % gameState.players.length;
  while (
    !gameState.players[nextPlayerIndex].isActive ||
    gameState.players[nextPlayerIndex].chips === 0
  ) {
    nextPlayerIndex = (nextPlayerIndex + 1) % gameState.players.length;
    if (nextPlayerIndex === playerIndex) break;
  }

  // Update active player
  gameState.players.forEach((p: Player, i: number) => {
    p.isTurn = i === nextPlayerIndex;
  });
  gameState.activePlayerId = gameState.players[nextPlayerIndex].id;

  // Check if betting round is complete
  const activePlayers = gameState.players.filter((p: Player) => p.isActive);
  const allPlayersActed = activePlayers.every(
    (p: Player) => p.hasActed || p.chips === 0
  );
  const allBetsEqual = activePlayers.every(
    (p: Player) => p.currentBet === gameState.currentBet || !p.isActive || p.chips === 0
  );

  if (allPlayersActed && allBetsEqual) {
    nextPhase();
  } else {
    startTurnTimer();
    io.emit("gameState", gameState);
  }
}

// Add this new function to handle the next turn logic
function handleNextTurn() {
  const playerIndex = gameState.players.findIndex((p: Player) => p.id === gameState.activePlayerId);
  
  // Find next active player
  let nextPlayerIndex = (playerIndex + 1) % gameState.players.length;
  while (
    !gameState.players[nextPlayerIndex].isActive ||
    gameState.players[nextPlayerIndex].chips === 0
  ) {
    nextPlayerIndex = (nextPlayerIndex + 1) % gameState.players.length;
    if (nextPlayerIndex === playerIndex) break;
  }

  // Update active player
  gameState.players.forEach((p: Player, i: number) => {
    p.isTurn = i === nextPlayerIndex;
  });
  gameState.activePlayerId = gameState.players[nextPlayerIndex].id;

  // Check if betting round is complete
  const activePlayers = gameState.players.filter((p: Player) => p.isActive);
  const allPlayersActed = activePlayers.every(
    (p: Player) => p.hasActed || p.chips === 0
  );
  const allBetsEqual = activePlayers.every(
    (p: Player) => p.currentBet === gameState.currentBet || !p.isActive || p.chips === 0
  );

  if (allPlayersActed && allBetsEqual) {
    nextPhase();
  } else {
    startTurnTimer();
    io.emit("gameState", gameState);
  }
}

// Socket.IO connection handling
io.on("connection", (socket) => {
  console.log("Client connected:", socket.id);

  socket.on("joinGame", ({ name }) => {
    const newPlayer: Player = {
      id: socket.id,
      name,
      chips: INITIAL_CHIPS,
      cards: [],
      isActive: true,
      currentBet: 0,
      isTurn: false,
      isDealer: gameState.players.length === 0,
      hasActed: false,
    };

    gameState.players.push(newPlayer);
    socket.emit("playerId", socket.id);

    if (gameState.players.length >= 2 && gameState.phase === "pre-flop" && gameState.communityCards.length === 0) {
      startNewRound();
    } else {
      io.emit("gameState", gameState);
    }
  });

  socket.on("gameAction", ({ action, amount, playerId }) => {
    handleAction(action, amount, playerId);
  });

  socket.on("disconnect", () => {
    if (turnTimer && gameState.activePlayerId === socket.id) {
      clearTimeout(turnTimer);
    }
    
    gameState.players = gameState.players.filter((p: Player) => p.id !== socket.id);
    if (gameState.players.length < 2) {
      gameState = {
        players: gameState.players,
        communityCards: [],
        pot: 0,
        currentBet: 0,
        phase: "pre-flop",
        activePlayerId: null,
        dealerId: null,
        smallBlind: SMALL_BLIND,
        bigBlind: BIG_BLIND,
        lastBetPlayerId: null,
      };
    }
    io.emit("gameState", gameState);
  });
});

httpServer.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
}); 