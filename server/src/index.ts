import express from "express";
import { createServer } from "http";
import { Server } from "socket.io";
import { GameState, Player, Card, BuyInRequest } from "./types/poker";
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
const TURN_TIME_LIMIT = 60; // seconds
const SMALL_BLIND = 10;
const BIG_BLIND = 20;
const INITIAL_CHIPS = 1000;
const MAX_PLAYERS = 6;
const MIN_BUY_IN = BIG_BLIND;
const SUGGESTED_BUY_IN = BIG_BLIND * 100;

// Game state
let gameState: GameState = {
  players: [],
  communityCards: [],
  deck: [],
  pot: 0,
  currentBet: 0,
  phase: "pre-flop",
  activePlayerId: null,
  dealerId: null,
  smallBlind: SMALL_BLIND,
  bigBlind: BIG_BLIND,
  lastBetPlayerId: null,
  maxPlayers: MAX_PLAYERS,
  availableSeats: Array.from({ length: MAX_PLAYERS }, (_, i) => i),
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

function handleTimerExpiration(playerId: string) {
  const player = gameState.players.find(p => p.id === playerId);
  if (!player) return;

  // Set player to sitting out
  player.isSittingOut = true;
  player.isActive = false;
  
  // Handle their current bet based on number of active players
  const activePlayers = gameState.players.filter(p => p.isActive);
  
  if (activePlayers.length <= 1) {
    // If only one or no players remain active, award pot to last active player
    const winner = activePlayers[0];
    if (winner) {
      winner.chips += gameState.pot;
      winner.isWinner = true;
      io.emit("gameState", gameState);
      
      setTimeout(() => {
        startNewRound();
      }, 3000);
      return;
    }
  }
  
  // Otherwise, keep their bet in the pot and continue the game
  updateGameState();
}

function startTurnTimer() {
  if (turnTimer) clearTimeout(turnTimer);
  
  turnTimer = setTimeout(() => {
    const currentPlayer = gameState.players.find(p => p.isTurn);
    if (currentPlayer) {
      handleTimerExpiration(currentPlayer.id);
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

  // Emit dealing notification
  io.emit("notification", {
    type: "dealing",
    message: "Dealing cards...",
    duration: 5000
  });

  // Deal cards to players after a delay
  setTimeout(() => {
    gameState.players.forEach((player: Player) => {
      const [playerCards, remainingDeck] = dealCards(deck, 2);
      player.cards = playerCards;
      deck = remainingDeck;
      // Reset player state for new round
      player.hasActed = false;
      player.isAllIn = false;
      player.isWinner = false;
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
      p.isActive = true;
      
      if (i === smallBlindIndex && p.chips >= SMALL_BLIND) {
        p.chips -= SMALL_BLIND;
        p.currentBet = SMALL_BLIND;
        gameState.pot += SMALL_BLIND;
      } else if (i === bigBlindIndex && p.chips >= BIG_BLIND) {
        p.chips -= BIG_BLIND;
        p.currentBet = BIG_BLIND;
        gameState.pot += BIG_BLIND;
        gameState.lastBetPlayerId = p.id;
      }
    });

    // Ensure currentBet reflects the big blind
    gameState.currentBet = BIG_BLIND;

    gameState.dealerId = gameState.players[newDealerIndex].id;
    gameState.activePlayerId = gameState.players[firstToActIndex].id;

    // Mark big blind player as not having acted yet (they get to act last pre-flop)
    const bigBlindPlayer = gameState.players[bigBlindIndex];
    bigBlindPlayer.hasActed = false;

    // Emit updated game state with dealt cards
    io.emit("gameState", gameState);
    
    // Emit action notification for first player
    const firstPlayer = gameState.players[firstToActIndex];
    io.emit("notification", {
      type: "action-required",
      message: `${firstPlayer.name}'s turn to act`,
      duration: TURN_TIME_LIMIT * 1000
    });

    startTurnTimer();
  }, 5000);
}

function nextPhase() {
  if (turnTimer) clearTimeout(turnTimer);

  // Reset all player bets and hasActed flags before moving to next phase
  gameState.players.forEach((p) => {
    if (p.isActive && !p.isAllIn) {
      p.currentBet = 0;
      p.hasActed = false;
    }
  });
  gameState.currentBet = 0;
  gameState.lastBetPlayerId = null;

  // Check if all active players are all-in
  const activePlayers = gameState.players.filter(p => p.isActive);
  const allPlayersAllIn = activePlayers.length >= 2 && 
    activePlayers.every(p => p.isAllIn || p.chips === 0);

  const moveToNextPhaseWithDelay = () => {
    let phaseNotification = "";
    let delay = allPlayersAllIn ? 8000 : 0;

    switch (gameState.phase) {
      case "pre-flop":
        phaseNotification = "Dealing the flop...";
        gameState.phase = "flop";
        setTimeout(() => {
          const [flopCards, remainingDeck] = dealCards(deck, 3);
          gameState.communityCards = flopCards;
          deck = remainingDeck;
          
          // Find first active player after dealer that isn't all-in
          const dealerIndex = gameState.players.findIndex(p => p.isDealer);
          let nextPlayerIndex = (dealerIndex + 1) % gameState.players.length;
          while (
            nextPlayerIndex !== dealerIndex &&
            (!gameState.players[nextPlayerIndex].isActive || gameState.players[nextPlayerIndex].isAllIn)
          ) {
            nextPlayerIndex = (nextPlayerIndex + 1) % gameState.players.length;
          }

          // Update active player
          gameState.players.forEach((p, i) => {
            p.isTurn = i === nextPlayerIndex;
            if (p.isActive && !p.isAllIn) {
              p.hasActed = false;
            }
          });
          gameState.activePlayerId = gameState.players[nextPlayerIndex].id;

          io.emit("gameState", gameState);
          
          if (!allPlayersAllIn) {
            io.emit("notification", {
              type: "action-required",
              message: `${gameState.players[nextPlayerIndex].name}'s turn to act`,
              duration: TURN_TIME_LIMIT * 1000
            });
            startTurnTimer();
          } else {
            setTimeout(() => moveToNextPhaseWithDelay(), delay);
          }
        }, 2000);
        break;

      case "flop":
        phaseNotification = "Dealing the turn...";
        gameState.phase = "turn";
        setTimeout(() => {
          const [turnCard, remainingDeckTurn] = dealCards(deck, 1);
          gameState.communityCards.push(...turnCard);
          deck = remainingDeckTurn;
          io.emit("gameState", gameState);
          
          if (!allPlayersAllIn) {
            resetBettingRound();
          } else {
            setTimeout(() => moveToNextPhaseWithDelay(), delay);
          }
        }, 2000);
        break;

      case "turn":
        phaseNotification = "Dealing the river...";
        gameState.phase = "river";
        setTimeout(() => {
          const [riverCard, remainingDeckRiver] = dealCards(deck, 1);
          gameState.communityCards.push(...riverCard);
          deck = remainingDeckRiver;
          io.emit("gameState", gameState);
          
          if (!allPlayersAllIn) {
            resetBettingRound();
          } else {
            setTimeout(() => moveToNextPhaseWithDelay(), delay);
          }
        }, 2000);
        break;

      case "river":
        phaseNotification = "Showdown!";
        gameState.phase = "showdown";
        setTimeout(() => {
          determineWinner();
          io.emit("gameState", gameState);
          
          // Start new round after delay
          setTimeout(() => {
            startNewRound();
          }, 10000);
        }, 2000);
        break;
    }

    if (phaseNotification) {
      io.emit("notification", {
        type: "phase-change",
        message: phaseNotification,
        duration: 2000
      });
    }
  };

  moveToNextPhaseWithDelay();
}

function resetBettingRound() {
  gameState.players.forEach((p) => {
    if (p.isActive && !p.isAllIn) {
      p.hasActed = false;
      p.currentBet = 0;
    }
  });
  gameState.currentBet = 0;
  gameState.lastBetPlayerId = null;

  // Find first active player after dealer
  const dealerIndex = gameState.players.findIndex((p: Player) => p.isDealer);
  let nextPlayerIndex = (dealerIndex + 1) % gameState.players.length;
  while (!gameState.players[nextPlayerIndex].isActive || gameState.players[nextPlayerIndex].isAllIn) {
    nextPlayerIndex = (nextPlayerIndex + 1) % gameState.players.length;
  }

  gameState.players.forEach((p, i) => {
    p.isTurn = i === nextPlayerIndex;
  });
  gameState.activePlayerId = gameState.players[nextPlayerIndex].id;

  const activePlayer = gameState.players[nextPlayerIndex];
  io.emit("notification", {
    type: "action-required",
    message: `${activePlayer.name}'s turn to act`,
    duration: TURN_TIME_LIMIT * 1000
  });

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
          gameState.pot = 0; // Clear the pot after awarding it
          winner.isWinner = true;
          
          // Start countdown for next hand
          let countdown = 5; // 5 seconds countdown
          const countdownInterval = setInterval(() => {
            io.emit("notification", {
              type: "game-end",
              message: `${winner.name} wins - all other players folded!`,
              winner,
              duration: 5000,
              nextGameCountdown: countdown
            });
            countdown--;
            
            if (countdown < 0) {
              clearInterval(countdownInterval);
              startNewRound();
            }
          }, 1000);
        } else {
          // Continue with normal game flow if more than one player is still active
          updateGameState();
        }
      }, 750);
      return;

    case "check":
      // Simple check validation - can check if current bet is matched
      const canCheck = player.currentBet === gameState.currentBet;
      
      if (!canCheck) {
        console.log("Invalid check - player must match current bet to check");
        return;
      }

      // Mark player as acted
      player.hasActed = true;
      break;

    case "call":
      const callAmount = Math.min(gameState.currentBet - player.currentBet, player.chips);
      player.chips -= callAmount;
      player.currentBet += callAmount;
      gameState.pot += callAmount;
      player.hasActed = true;
      
      if (player.chips === 0) {
        player.isAllIn = true;
      }
      break;

    case "raise":
      if (!amount) return;
      const isAllIn = amount >= player.chips;
      const isValidRaise = isAllIn || amount >= gameState.currentBet * 2;
      if (!isValidRaise) return;

      const raiseAmount = Math.min(amount - player.currentBet, player.chips);
      player.chips -= raiseAmount;
      player.currentBet += raiseAmount;
      gameState.currentBet = player.currentBet;
      gameState.pot += raiseAmount;
      player.hasActed = true;
      gameState.lastBetPlayerId = player.id;
      
      // Reset hasActed for other players since there's a new bet
      gameState.players.forEach((p) => {
        if (p.id !== player.id && p.isActive && !p.isAllIn) {
          p.hasActed = false;
        }
      });

      if (player.chips === 0) {
        player.isAllIn = true;
      }
      break;
  }

  updateGameState();
}

// New consolidated function to handle game state updates
function updateGameState() {
  const activePlayers = gameState.players.filter(p => p.isActive && !p.isAllIn);
  const allPlayersActed = activePlayers.every(p => p.hasActed);
  const allBetsMatched = activePlayers.every(p => p.currentBet === gameState.currentBet);

  // If betting round is complete, move to next phase
  if (allPlayersActed && allBetsMatched) {
    nextPhase();
    return;
  }

  // Find next active player
  const currentPlayerIndex = gameState.players.findIndex(p => p.isTurn);
  let nextPlayerIndex = (currentPlayerIndex + 1) % gameState.players.length;
  
  // Find next eligible player
  while (
    nextPlayerIndex !== currentPlayerIndex &&
    (!gameState.players[nextPlayerIndex].isActive || 
     gameState.players[nextPlayerIndex].isAllIn)
  ) {
    nextPlayerIndex = (nextPlayerIndex + 1) % gameState.players.length;
  }

  // Update active player
  gameState.players.forEach((p, i) => {
    p.isTurn = i === nextPlayerIndex;
  });
  gameState.activePlayerId = gameState.players[nextPlayerIndex].id;

  // Emit notification for next player's turn
  const nextPlayer = gameState.players[nextPlayerIndex];
  io.emit("notification", {
    type: "action-required",
    message: `${nextPlayer.name}'s turn to act`,
    duration: TURN_TIME_LIMIT * 1000
  });

  // Start turn timer and emit updated state
  startTurnTimer();
  io.emit("gameState", gameState);
}

function dealCommunityCards(count: number) {
  const [cards, remainingDeck] = dealCards(deck, count);
  gameState.communityCards.push(...cards);
  deck = remainingDeck;
}

function moveToNextPhase() {
  // Reset player bets and hasActed flags
  gameState.players.forEach((p) => {
    p.currentBet = 0;
    p.hasActed = false;
  });
  gameState.currentBet = 0;

  // Deal community cards based on current phase
  switch (gameState.phase) {
    case "pre-flop":
      dealCommunityCards(3); // Flop
      gameState.phase = "flop";
      break;
    case "flop":
      dealCommunityCards(1); // Turn
      gameState.phase = "turn";
      break;
    case "turn":
      dealCommunityCards(1); // River
      gameState.phase = "river";
      break;
    case "river":
      // Move to showdown
      gameState.phase = "showdown";
      determineWinner();
      break;
    case "showdown":
      startNewRound();
      break;
  }

  // Emit updated game state after each phase change
  io.emit("gameState", gameState);
}

function moveToNextPlayer() {
  const activePlayerIndex = gameState.players.findIndex((p) => p.isTurn);
  let nextPlayerIndex = (activePlayerIndex + 1) % gameState.players.length;

  // Find next active player who isn't all-in
  while (
    nextPlayerIndex !== activePlayerIndex &&
    (!gameState.players[nextPlayerIndex].isActive ||
      gameState.players[nextPlayerIndex].isAllIn)
  ) {
    nextPlayerIndex = (nextPlayerIndex + 1) % gameState.players.length;
  }

  // Update turn
  gameState.players.forEach((p, i) => {
    p.isTurn = i === nextPlayerIndex;
  });

  // Start turn timer for next player
  startTurnTimer();
}

function determineWinner() {
  // TODO: Implement poker hand evaluation logic
  // For now, just pick a random active player as winner
  const activePlayers = gameState.players.filter((p) => p.isActive);
  if (activePlayers.length > 0) {
    const winner = activePlayers[Math.floor(Math.random() * activePlayers.length)];
    winner.isWinner = true;
    winner.chips += gameState.pot;

    // Check for players who are out of chips
    gameState.players.forEach((player) => {
      if (player.chips === 0 && !player.isSittingOut) {
        player.isSittingOut = true;
        player.isReadyToPlay = false;
        // Notify the player they need to buy in
        io.to(player.id).emit("needsBuyIn", {
          minBuyIn: MIN_BUY_IN,
          suggestedBuyIn: SUGGESTED_BUY_IN,
          availableSeats: [player.seatNumber as number]
        });
      }
    });

    // Start countdown for next hand
    let countdown = 5; // 5 seconds countdown
    const countdownInterval = setInterval(() => {
      io.emit("notification", {
        type: "game-end",
        message: `${winner.name} wins!`,
        winner,
        duration: 5000,
        nextGameCountdown: countdown
      });
      countdown--;
      
      if (countdown < 0) {
        clearInterval(countdownInterval);
        startNewRound();
      }
    }, 1000);
  }
}

// Socket.IO connection handling
io.on("connection", (socket) => {
  console.log("Client connected:", socket.id);

  socket.on("joinGame", ({ name }) => {
    // Don't automatically add player to table, just create them
    const newPlayer: Player = {
      id: socket.id,
      name,
      chips: 0,
      cards: [],
      isActive: false,
      currentBet: 0,
      isTurn: false,
      isDealer: false,
      hasActed: false,
      isAllIn: false,
      isWinner: false,
      isSittingOut: true,
      seatNumber: null,
      isReadyToPlay: false,
    };

    gameState.players.push(newPlayer);
    socket.emit("playerId", socket.id);
    
    // Send available seats and buy-in information
    socket.emit("tableInfo", {
      availableSeats: gameState.availableSeats,
      minBuyIn: MIN_BUY_IN,
      suggestedBuyIn: SUGGESTED_BUY_IN,
      maxBuyIn: Infinity, // No maximum buy-in
    });
    
    io.emit("gameState", gameState);
  });

  socket.on("buyIn", ({ amount, seatNumber }: BuyInRequest) => {
    const player = gameState.players.find(p => p.id === socket.id);
    if (!player) return;

    // Validate buy-in amount and seat
    if (amount < MIN_BUY_IN || !gameState.availableSeats.includes(seatNumber)) {
      socket.emit("buyInError", "Invalid buy-in amount or seat number");
      return;
    }

    // Update player state
    player.chips = amount;
    player.seatNumber = seatNumber;
    player.isSittingOut = false;
    player.isReadyToPlay = true;

    // Remove seat from available seats
    gameState.availableSeats = gameState.availableSeats.filter(s => s !== seatNumber);

    // If we have 2 or more ready players and game isn't in progress, start new round
    const readyPlayers = gameState.players.filter(p => p.isReadyToPlay && !p.isSittingOut);
    if (readyPlayers.length >= 2 && gameState.phase === "pre-flop" && gameState.communityCards.length === 0) {
      startNewRound();
    } else {
      io.emit("gameState", gameState);
    }
  });

  socket.on("sitOut", () => {
    const player = gameState.players.find(p => p.id === socket.id);
    if (!player) return;

    player.isSittingOut = true;
    player.isActive = false;
    player.isReadyToPlay = false;

    // If player was in current hand, handle as if they timed out
    if (player.isTurn) {
      handleTimerExpiration(player.id);
    }

    io.emit("gameState", gameState);
  });

  socket.on("sitIn", () => {
    const player = gameState.players.find(p => p.id === socket.id);
    if (!player || player.chips < MIN_BUY_IN) return;

    player.isSittingOut = false;
    player.isReadyToPlay = true;

    // Player will be included in next hand
    io.emit("gameState", gameState);
  });

  socket.on("addChips", ({ amount }: { amount: number }) => {
    const player = gameState.players.find(p => p.id === socket.id);
    if (!player || amount < MIN_BUY_IN) return;

    player.chips += amount;
    io.emit("gameState", gameState);
  });

  socket.on("action", ({ action, amount }) => {
    const player = gameState.players.find((p) => p.id === socket.id);
    if (!player || !player.isTurn) return;

    // Call the main handleAction function instead of having separate logic
    handleAction(action, amount, socket.id);
  });

  socket.on("disconnect", () => {
    const player = gameState.players.find(p => p.id === socket.id);
    
    if (player) {
      // Add their seat back to available seats if they had one
      if (player.seatNumber !== null) {
        gameState.availableSeats.push(player.seatNumber);
        gameState.availableSeats.sort((a, b) => a - b);
      }

      // If they were in current hand, handle as timeout
      if (player.isTurn) {
        handleTimerExpiration(player.id);
      }
    }

    if (turnTimer && gameState.activePlayerId === socket.id) {
      clearTimeout(turnTimer);
    }
    
    gameState.players = gameState.players.filter(p => p.id !== socket.id);
    
    // Reset game if not enough players
    if (gameState.players.filter(p => !p.isSittingOut).length < 2) {
      gameState = {
        ...gameState,
        communityCards: [],
        deck: [],
        pot: 0,
        currentBet: 0,
        phase: "pre-flop",
        activePlayerId: null,
        dealerId: null,
        lastBetPlayerId: null,
      };
    }
    
    io.emit("gameState", gameState);
  });
});

httpServer.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
}); 