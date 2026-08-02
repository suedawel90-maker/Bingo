const socket = io();
const tg = window.Telegram?.WebApp;
if (tg) tg.expand();

const telegramUser = tg?.initDataUnsafe?.user || {
  id: 12345678,
  first_name: "TestUser",
  username: "testuser"
};

let playerCards = new Map();
let activeCardId = null;

function announceNumber(text) {
  if ('speechSynthesis' in window) {
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = 1.0;
    utterance.pitch = 1.1;
    speechSynthesis.speak(utterance);
  }
}

socket.emit("auth_user", telegramUser);

socket.on("user_data", (user) => {
  document.getElementById("user-name").textContent = user.firstName;
  document.getElementById("user-balance").textContent = user.walletBalance;
});

socket.on("selection_timer_tick", (data) => {
  const banner = document.getElementById("timer-banner");
  banner.textContent = `⏱️ Select your cards! ${data.timeLeft}s remaining`;
  if (data.timeLeft <= 10 && tg?.HapticFeedback) {
    tg.HapticFeedback.impactOccurred("light");
  }
});

socket.on("phase_changed", (data) => {
  const banner = document.getElementById("timer-banner");
  if (data.phase === "SELECTION") {
    banner.textContent = "⏱️ Select your cards! 60s remaining (Max 4)";
    playerCards.clear();
    activeCardId = null;
    renderTabs();
    document.getElementById("player-card-container").innerHTML = "";
    document.getElementById("current-number").textContent = "--";
    document.getElementById("called-numbers-list").innerHTML = "";
  } else {
    banner.textContent = "🔒 Selection closed! Calling numbers...";
  }
});

socket.on("card_assigned", ({ card, newBalance }) => {
  document.getElementById("user-balance").textContent = newBalance;

  playerCards.set(card.cardId, {
    cardId: card.cardId,
    grid: card.grid,
    markedSet: new Set([12])
  });

  if (!activeCardId) activeCardId = card.cardId;

  renderTabs();
  renderBingoCard();
});

function renderTabs() {
  const tabsContainer = document.getElementById("card-tabs");
  tabsContainer.innerHTML = "";

  playerCards.forEach((cardData, cId) => {
    const tab = document.createElement("div");
    tab.className = `card-tab ${cId === activeCardId ? "active" : ""}`;
    tab.textContent = `Card #${cId}`;
    tab.onclick = () => {
      activeCardId = cId;
      renderTabs();
      renderBingoCard();
    };
    tabsContainer.appendChild(tab);
  });
}

function renderBingoCard() {
  const container = document.getElementById("player-card-container");
  container.innerHTML = "";

  if (!activeCardId || !playerCards.has(activeCardId)) return;

  const currentCard = playerCards.get(activeCardId);

  currentCard.grid.forEach((num, index) => {
    const cell = document.createElement("div");
    cell.className = "cell";
    cell.dataset.index = index;

    if (index === 12) {
      cell.classList.add("free-space", "marked");
      cell.textContent = "FREE";
    } else {
      cell.textContent = num;
      if (currentCard.markedSet.has(index)) cell.classList.add("marked");
    }
    container.appendChild(cell);
  });
}

socket.on("number_called", (data) => {
  const { currentNumber, announcement, calledNumbersList, totalCalledCount } = data;

  document.getElementById("current-number").textContent = announcement;
  document.getElementById("called-count").textContent = totalCalledCount;

  announceNumber(announcement);

  const listContainer = document.getElementById("called-numbers-list");
  listContainer.innerHTML = "";
  calledNumbersList.forEach((num, idx) => {
    const ball = document.createElement("div");
    ball.className = "number-ball" + (idx === calledNumbersList.length - 1 ? " latest" : "");
    ball.textContent = num;
    listContainer.appendChild(ball);
  });
  listContainer.scrollLeft = listContainer.scrollWidth;

  playerCards.forEach((cardData) => {
    cardData.grid.forEach((num, index) => {
      if (index !== 12 && num === currentNumber) {
        cardData.markedSet.add(index);

        if (cardData.cardId === activeCardId) {
          const cell = document.querySelector(`.cell[data-index="${index}"]`);
          if (cell && !cell.classList.contains("marked")) {
            cell.classList.add("marked", "just-marked");
            if (tg?.HapticFeedback) tg.HapticFeedback.notificationOccurred("success");
          }
        }
      }
    });
  });
});

socket.on("bingo_declared", (data) => {
  announceNumber("Bingo!");
  alert(`🏆 Round Over! Winner(s): ${data.winners.map(w => w.winner.first_name).join(", ")} | Prize Pool: ${data.totalWinnerPool} ETB`);
});

socket.on("error_msg", (msg) => alert(msg));
