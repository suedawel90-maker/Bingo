class CardsGenerator {
  constructor() {
    this.cards = new Map();
    this.userCardCounts = new Map();
    this.initCards();
  }

  initCards() {
    this.cards.clear();
    this.userCardCounts.clear();
    for (let i = 1; i <= 600; i++) {
      this.cards.set(i, {
        cardId: i,
        grid: this.generateBingoGrid(),
        isTaken: false,
        owner: null
      });
    }
  }

  generateBingoGrid() {
    const fillCol = (min, max) => {
      const set = new Set();
      while (set.size < 5) set.add(Math.floor(Math.random() * (max - min + 1)) + min);
      return Array.from(set);
    };

    const b = fillCol(1, 15);
    const i = fillCol(16, 30);
    const n = fillCol(31, 45);
    const g = fillCol(46, 60);
    const o = fillCol(61, 75);

    n[2] = "FREE";

    const grid = [];
    for (let r = 0; r < 5; r++) {
      grid.push(b[r], i[r], n[r], g[r], o[r]);
    }
    return grid;
  }

  getUserCardCount(userId) {
    return this.userCardCounts.get(String(userId)) || 0;
  }

  selectCard(cardId, user, maxLimit = 4) {
    const card = this.cards.get(Number(cardId));
    if (!card) return { success: false, reason: "Card does not exist." };
    if (card.isTaken) return { success: false, reason: "Card already taken." };

    const userIdStr = String(user.id);
    const currentCount = this.getUserCardCount(userIdStr);

    if (currentCount >= maxLimit) {
      return {
        success: false,
        reason: `Maximum limit reached! You can purchase up to ${maxLimit} cards per round.`
      };
    }

    card.isTaken = true;
    card.owner = user;
    this.userCardCounts.set(userIdStr, currentCount + 1);

    return { success: true, card };
  }

  getAllCardsStatus() {
    return Array.from(this.cards.values()).map(c => ({
      cardId: c.cardId,
      isTaken: c.isTaken,
      ownerName: c.owner ? c.owner.first_name : null,
      ownerId: c.owner ? c.owner.id : null
    }));
  }

  getTakenCardsCount() {
    return Array.from(this.cards.values()).filter(c => c.isTaken).length;
  }

  resetAllCards() {
    this.initCards();
  }
}

module.exports = new CardsGenerator();
