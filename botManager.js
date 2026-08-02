const BOT_NAMES = [
  "Abebe", "Almaz", "Bekele", "Chala", "Dawit", "Eleni", "Fikru", "Girma", "Hana", "Kassahun",
  "Lidet", "Makeda", "Nigust", "Obang", "Pappas", "Robel", "Selam", "Tewodros", "Urji", "Yared",
  "Zeberga", "Aster", "Biniam", "Desta", "Ephrem", "Getachew", "Hiwot", "Jemila", "Kebede", "Lemma"
];

const BOTS = BOT_NAMES.map((name, index) => ({
  id: 900000 + index + 1,
  first_name: `${name} 🤖`,
  isBot: true
}));

const WINNING_PATTERNS = [
  [0, 1, 2, 3, 4], [5, 6, 7, 8, 9], [10, 11, 12, 13, 14], [15, 16, 17, 18, 19], [20, 21, 22, 23, 24],
  [0, 5, 10, 15, 20], [1, 6, 11, 16, 21], [2, 7, 12, 17, 22], [3, 8, 13, 18, 23], [4, 9, 14, 19, 24],
  [0, 6, 12, 18, 24], [4, 8, 12, 16, 20]
];

class BotManager {
  constructor(cardsGenerator) {
    this.cardsGenerator = cardsGenerator;
    this.activeBotCards = [];
    this.roundCounter = 0;
    this.winningNumbersSequence = [];
  }

  populateRoundWithBots(targetBotCount = 30) {
    this.activeBotCards = [];
    this.winningNumbersSequence = [];

    this.roundCounter++;
    if (this.roundCounter > 50) this.roundCounter = 1;

    const isFiftyRound = (this.roundCounter === 50);
    const availableCards = this.cardsGenerator.getAllCardsStatus().filter(c => !c.isTaken);
    const shuffledBots = [...BOTS].sort(() => 0.5 - Math.random()).slice(0, targetBotCount);

    for (const bot of shuffledBots) {
      if (availableCards.length === 0) break;

      const cardsToBuy = Math.min(Math.floor(Math.random() * 4) + 1, availableCards.length);

      for (let i = 0; i < cardsToBuy; i++) {
        if (availableCards.length === 0) break;

        const randomIndex = Math.floor(Math.random() * availableCards.length);
        const chosenCardMeta = availableCards.splice(randomIndex, 1)[0];

        const result = this.cardsGenerator.selectCard(chosenCardMeta.cardId, bot, 4);
        if (result.success) {
          this.activeBotCards.push({
            bot,
            cardId: chosenCardMeta.cardId,
            grid: result.card.grid,
            markedSet: new Set([12])
          });
        }
      }
    }

    if (isFiftyRound) {
      const winnersCount = Math.min(5, this.activeBotCards.length);
      const selectedWinners = this.activeBotCards.slice(0, winnersCount);
      const commonPattern = WINNING_PATTERNS[0];
      const requiredNumbers = new Set();

      selectedWinners.forEach(w => {
        commonPattern.forEach(idx => {
          const val = w.grid[idx];
          if (val !== "FREE") requiredNumbers.add(val);
        });
      });

      this.winningNumbersSequence = Array.from(requiredNumbers);
    } else {
      if (this.activeBotCards.length > 0) {
        const winnerCard = this.activeBotCards[Math.floor(Math.random() * this.activeBotCards.length)];
        const chosenPattern = WINNING_PATTERNS[Math.floor(Math.random() * WINNING_PATTERNS.length)];

        this.winningNumbersSequence = chosenPattern
          .map(idx => winnerCard.grid[idx])
          .filter(val => val !== "FREE");
      }
    }
  }

  getNextRiggedNumber(calledNumbers) {
    const calledSet = new Set(calledNumbers);

    for (const num of this.winningNumbersSequence) {
      if (!calledSet.has(num)) return num;
    }

    let nextNum;
    do {
      nextNum = Math.floor(Math.random() * 75) + 1;
    } while (calledSet.has(nextNum));

    return nextNum;
  }

  processCalledNumber(number, ioCallback) {
    const winnersThisTurn = [];

    for (const botData of this.activeBotCards) {
      const { bot, cardId, grid, markedSet } = botData;

      grid.forEach((val, idx) => {
        if (val === number) markedSet.add(idx);
      });

      if (this.checkBingoWin(markedSet)) {
        winnersThisTurn.push({ winner: bot, cardId });
      }
    }

    if (winnersThisTurn.length > 0) {
      ioCallback(winnersThisTurn);
      return true;
    }
    return false;
  }

  checkBingoWin(markedSet) {
    return WINNING_PATTERNS.some(pattern => pattern.every(index => markedSet.has(index)));
  }
}

module.exports = BotManager;
