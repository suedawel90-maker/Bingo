const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const mongoose = require("mongoose");
const path = require("path");

const walletService = require("./walletService");
const cardsGen = require("./cardsGenerator");
const BotManager = require("./botManager");

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

mongoose.connect(process.env.MONGO_URI || "mongodb://localhost:27017/telegram_bingo");

const CARD_PRICE = 10;
const SELECTION_TIME_SECONDS = 60;
const HOUSE_COMMISSION_PERCENT = 20;
const MAX_CARDS_PER_PLAYER = 4;

const botManager = new BotManager(cardsGen);

let gameState = {
  isGameActive: false,
  isSelectionPhase: true,
  selectionTimer: SELECTION_TIME_SECONDS,
  calledNumbers: [],
  selectionInterval: null,
  callerInterval: null
};

function startCardSelectionPhase() {
  gameState.isGameActive = false;
  gameState.isSelectionPhase = true;
  gameState.selectionTimer = SELECTION_TIME_SECONDS;
  gameState.calledNumbers = [];

  cardsGen.resetAllCards();

  io.emit("phase_changed", {
    phase: "SELECTION",
    duration: SELECTION_TIME_SECONDS,
    cardPrice: CARD_PRICE,
    maxCards: MAX_CARDS_PER_PLAYER
  });

  if (gameState.selectionInterval) clearInterval(gameState.selectionInterval);

  gameState.selectionInterval = setInterval(() => {
    gameState.selectionTimer--;
    io.emit("selection_timer_tick", { timeLeft: gameState.selectionTimer });

    if (gameState.selectionTimer <= 0) {
      clearInterval(gameState.selectionInterval);
      startNumberCallingPhase();
    }
  }, 1000);
}

function startNumberCallingPhase() {
  gameState.isSelectionPhase = false;
  gameState.isGameActive = true;

  botManager.populateRoundWithBots(Math.floor(Math.random() * 10) + 25);

  io.emit("phase_changed", {
    phase: "PLAYING",
    totalCardsInPlay: cardsGen.getTakenCardsCount()
  });

  if (gameState.callerInterval) clearInterval(gameState.callerInterval);

  gameState.callerInterval = setInterval(() => {
    if (gameState.calledNumbers.length >= 75) {
      endRoundAndRestart();
      return;
    }

    const nextNum = botManager.getNextRiggedNumber(gameState.calledNumbers);
    gameState.calledNumbers.push(nextNum);

    const letter = getBingoLetter(nextNum);

    io.emit("number_called", {
      currentNumber: nextNum,
      letter,
      announcement: `${letter} ${nextNum}`,
      calledNumbersList: gameState.calledNumbers,
      totalCalledCount: gameState.calledNumbers.length
    });

    botManager.processCalledNumber(nextNum, async (winningList) => {
      clearInterval(gameState.callerInterval);

      const totalGross = cardsGen.getTakenCardsCount() * CARD_PRICE;
      const houseFee = Math.floor(totalGross * (HOUSE_COMMISSION_PERCENT / 100));
      const totalWinnerPool = totalGross - houseFee;
      const prizePerWinner = Math.floor(totalWinnerPool / winningList.length);

      for (const item of winningList) {
        if (!item.winner.isBot) {
          await walletService.addBalance(item.winner.id, prizePerWinner);
        }
      }

      io.emit("bingo_declared", {
        winners: winningList,
        prizePerWinner,
        totalWinnerPool,
        houseFee,
        finalCalledNumbers: gameState.calledNumbers
      });

      setTimeout(() => startCardSelectionPhase(), 6000);
    });

  }, 3500);
}

function getBingoLetter(num) {
  if (num <= 15) return "B";
  if (num <= 30) return "I";
  if (num <= 45) return "N";
  if (num <= 60) return "G";
  return "O";
}

function endRoundAndRestart() {
  clearInterval(gameState.callerInterval);
  io.emit("game_over");
  setTimeout(() => startCardSelectionPhase(), 5000);
}

io.on("connection", (socket) => {
  socket.on("auth_user", async (telegramUser) => {
    try {
      const dbUser = await walletService.getOrCreateUser(telegramUser);
      socket.emit("user_data", dbUser);
      socket.emit("cards_update", cardsGen.getAllCardsStatus());
    } catch (e) {
      socket.emit("error_msg", e.message);
    }
  });

  socket.on("pick_card", async ({ cardId, user }) => {
    if (!gameState.isSelectionPhase) {
      return socket.emit("error_msg", "Card selection is closed for active round!");
    }

    try {
      await walletService.deductBalance(user.id, CARD_PRICE);
      const result = cardsGen.selectCard(cardId, user, MAX_CARDS_PER_PLAYER);

      if (result.success) {
        const updatedUser = await walletService.getOrCreateUser(user);
        socket.emit("card_assigned", { 
          card: result.card, 
          newBalance: updatedUser.walletBalance,
          userCardCount: cardsGen.getUserCardCount(user.id)
        });
        io.emit("cards_update", cardsGen.getAllCardsStatus());
      } else {
        await walletService.addBalance(user.id, CARD_PRICE);
        socket.emit("error_msg", result.reason);
      }
    } catch (e) {
      socket.emit("error_msg", e.message);
    }
  });
});

app.post("/api/deposit", async (req, res) => {
  try {
    const { userId, amount, receiptInput } = req.body;
    const result = await walletService.processDeposit(userId, amount, receiptInput);
    res.json({ success: true, ...result });
  } catch (e) {
    res.status(400).json({ success: false, error: e.message });
  }
});

app.post("/api/withdraw", async (req, res) => {
  try {
    const { userId, amount, phone } = req.body;
    const result = await walletService.requestWithdrawal(userId, amount, phone);
    res.json({ success: true, ...result });
  } catch (e) {
    res.status(400).json({ success: false, error: e.message });
  }
});

server.listen(3000, () => {
  console.log("🚀 Server running on port 3000");
  startCardSelectionPhase();
});
