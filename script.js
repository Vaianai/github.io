const gameState = {
    players: [],
    dealer: {
        hand: [],
        value: 0
    },
    deck: [],
    activePlayerIndex: -1,
    roundInProgress: false,
    loggedUser: null,
    lastMoneyTick: Date.now()
};

const allowedDomains = [".edu", "@studenti.", "@istituto."];

const GOOGLE_ID_CONTAINER = "google-signin";
const MONEY_INCREMENT = 10;
const MONEY_INTERVAL = 60 * 1000;

const suits = [
    { symbol: "♠", className: "suit-spades" },
    { symbol: "♥", className: "suit-hearts" },
    { symbol: "♦", className: "suit-diamonds" },
    { symbol: "♣", className: "suit-clubs" }
];

const ranks = ["A", "2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K"];

const elements = {
    authPanel: document.getElementById("auth-panel"),
    authStatus: document.getElementById("auth-status"),
    authWarning: document.getElementById("auth-warning"),
    tableLayout: document.getElementById("table-layout"),
    playersArea: document.getElementById("players-area"),
    dealerHand: document.getElementById("dealer-hand"),
    dealerValue: document.getElementById("dealer-value"),
    leaderboard: document.getElementById("leaderboard-list"),
    moneyTicker: document.getElementById("money-ticker"),
    addPlayerBtn: document.getElementById("add-player"),
    startRoundBtn: document.getElementById("start-round"),
    hitBtn: document.getElementById("hit-button"),
    standBtn: document.getElementById("stand-button"),
    resetTableBtn: document.getElementById("reset-table"),
    playerTemplate: document.getElementById("player-template")
};

function initializeGoogleButton() {
    if (!window.google || !window.google.accounts || !window.google.accounts.id) {
        console.warn("Google Identity Services non disponibile in questa anteprima.");
        return;
    }

    window.google.accounts.id.initialize({
        client_id: document.getElementById("g_id_onload").dataset.client_id,
        callback: handleCredentialResponse,
        ux_mode: "popup"
    });

    window.google.accounts.id.renderButton(
        document.getElementById(GOOGLE_ID_CONTAINER),
        {
            theme: "filled_black",
            size: "large",
            width: 280,
            text: "continue_with",
            shape: "pill"
        }
    );
}

window.addEventListener("DOMContentLoaded", () => {
    initializeGoogleButton();
    loadState();
    wireEvents();
    startMoneyTicker();
    renderLeaderboard();
});

function handleCredentialResponse(response) {
    try {
        const payload = decodeCredential(response.credential);
        const email = payload.email || "";
        const name = payload.name || payload.given_name || "Giocatore";

        if (!isInstitutionalEmail(email)) {
            elements.authWarning.textContent = "Accesso negato: utilizza esclusivamente la tua email istituzionale.";
            elements.authStatus.textContent = "Accesso negato";
            if (window.google?.accounts?.id) {
                window.google.accounts.id.disableAutoSelect();
                window.google.accounts.id.prompt();
            }
            return;
        }

        gameState.loggedUser = {
            id: payload.sub,
            name,
            email
        };

        elements.authStatus.textContent = `Accesso eseguito come ${name}`;
        elements.authWarning.textContent = "";
        elements.authPanel.hidden = true;
        elements.tableLayout.hidden = false;

        ensureUserPlayer();
        renderPlayers();
        renderLeaderboard();
    } catch (error) {
        console.error("Errore durante l'autenticazione", error);
        elements.authWarning.textContent = "Si è verificato un problema con l'accesso. Riprova.";
    }
}

function decodeCredential(credential) {
    const [, payload] = credential.split(".");
    if (!payload) {
        throw new Error("Token JWT non valido");
    }
    const decoded = atob(payload.replace(/-/g, "+").replace(/_/g, "/"));
    return JSON.parse(decodeURIComponent(escape(decoded)));
}

function isInstitutionalEmail(email) {
    return allowedDomains.some((domain) => email.toLowerCase().includes(domain));
}

function ensureUserPlayer() {
    if (!gameState.loggedUser) return;
    const exists = gameState.players.some((player) => player.id === gameState.loggedUser.id);
    if (!exists) {
        const newPlayer = createPlayer(gameState.loggedUser.name, gameState.loggedUser.email, gameState.loggedUser.id);
        gameState.players.unshift(newPlayer);
        saveState();
    }
    enableStartButton();
}

function createPlayer(name, email, id = crypto.randomUUID()) {
    return {
        id,
        name,
        email,
        wins: 0,
        balance: 100,
        totalWinnings: 0,
        hand: [],
        value: 0,
        status: ""
    };
}

function wireEvents() {
    elements.addPlayerBtn.addEventListener("click", () => {
        const name = prompt("Nome del nuovo giocatore?");
        if (!name) return;
        const email = prompt("Email del giocatore?") || "ospite@example.com";
        const player = createPlayer(name.trim(), email.trim());
        gameState.players.push(player);
        saveState();
        renderPlayers();
        renderLeaderboard();
        enableStartButton();
    });

    elements.startRoundBtn.addEventListener("click", startRound);
    elements.hitBtn.addEventListener("click", () => playerHit(gameState.activePlayerIndex));
    elements.standBtn.addEventListener("click", () => playerStand(gameState.activePlayerIndex));
    elements.resetTableBtn.addEventListener("click", resetTable);
}

function startRound() {
    if (gameState.players.length === 0) {
        alert("Aggiungi almeno un giocatore per iniziare.");
        return;
    }
    gameState.roundInProgress = true;
    gameState.deck = createShuffledDeck();
    gameState.dealer.hand = [];
    gameState.dealer.value = 0;
    gameState.activePlayerIndex = 0;

    gameState.players.forEach((player) => {
        player.hand = [drawCard(), drawCard()];
        player.value = calculateHandValue(player.hand);
        player.status = "In gioco";
    });

    gameState.dealer.hand = [drawCard(), drawCard()];
    gameState.dealer.value = calculateHandValue(gameState.dealer.hand);

    renderHands(true);
    updateActivePlayerControls();
    elements.startRoundBtn.disabled = true;
}

function playerHit(index) {
    const player = gameState.players[index];
    if (!player || !gameState.roundInProgress) return;
    player.hand.push(drawCard());
    player.value = calculateHandValue(player.hand);
    if (player.value > 21) {
        player.status = "Sballato";
        advanceToNextPlayer();
    }
    renderHands(true);
}

function playerStand(index) {
    const player = gameState.players[index];
    if (!player || !gameState.roundInProgress) return;
    player.status = "In attesa del dealer";
    advanceToNextPlayer();
    renderHands(true);
}

function advanceToNextPlayer() {
    gameState.activePlayerIndex += 1;
    if (gameState.activePlayerIndex >= gameState.players.length) {
        dealerTurn();
    } else {
        updateActivePlayerControls();
    }
}

function dealerTurn() {
    const dealer = gameState.dealer;
    while (dealer.value < 17) {
        dealer.hand.push(drawCard());
        dealer.value = calculateHandValue(dealer.hand);
    }

    settleBets();
    renderHands(false);
    gameState.roundInProgress = false;
    gameState.activePlayerIndex = -1;
    updateActivePlayerControls();
    elements.startRoundBtn.disabled = false;
    saveState();
    renderLeaderboard();
}

function settleBets() {
    const dealerValue = gameState.dealer.value;
    const dealerBust = dealerValue > 21;

    gameState.players.forEach((player) => {
        const playerBust = player.value > 21;
        let status;

        if (playerBust) {
            status = "Sballato";
        } else if (dealerBust || player.value > dealerValue) {
            status = "Vittoria";
            player.wins += 1;
            player.totalWinnings += 50;
            player.balance += 50;
        } else if (player.value === dealerValue) {
            status = "Pareggio";
        } else {
            status = "Sconfitta";
            player.balance = Math.max(0, player.balance - 25);
        }

        player.status = status;
    });
}

function drawCard() {
    if (gameState.deck.length === 0) {
        gameState.deck = createShuffledDeck();
    }
    return gameState.deck.pop();
}

function createShuffledDeck() {
    const deck = [];
    suits.forEach((suit) => {
        ranks.forEach((rank) => {
            deck.push({ rank, suit });
        });
    });
    for (let i = deck.length - 1; i > 0; i -= 1) {
        const j = Math.floor(Math.random() * (i + 1));
        [deck[i], deck[j]] = [deck[j], deck[i]];
    }
    return deck;
}

function calculateHandValue(hand) {
    let total = 0;
    let aces = 0;

    hand.forEach((card) => {
        if (card.rank === "A") {
            total += 11;
            aces += 1;
        } else if (["K", "Q", "J"].includes(card.rank)) {
            total += 10;
        } else {
            total += Number(card.rank);
        }
    });

    while (total > 21 && aces > 0) {
        total -= 10;
        aces -= 1;
    }

    return total;
}

function renderPlayers() {
    elements.playersArea.innerHTML = "";
    gameState.players.forEach((player) => {
        const playerNode = elements.playerTemplate.content.firstElementChild.cloneNode(true);
        playerNode.dataset.playerId = player.id;
        playerNode.querySelector(".player-name").textContent = player.name;
        playerNode.querySelector(".hand-value").textContent = `Valore: ${player.value ?? 0}`;
        playerNode.querySelector(".player-status").textContent = player.status || "In attesa";
        playerNode.querySelector(".player-status").className = `player-status ${player.status === "Vittoria" ? "win" : player.status === "Sconfitta" || player.status === "Sballato" ? "lose" : ""}`;

        const handContainer = playerNode.querySelector(".hand");
        (player.hand || []).forEach((card) => {
            handContainer.appendChild(createCardElement(card));
        });

        elements.playersArea.appendChild(playerNode);
    });
}

function renderHands(hideDealerHoleCard) {
    renderPlayers();
    elements.dealerHand.innerHTML = "";

    gameState.dealer.hand.forEach((card, index) => {
        const hideCard = hideDealerHoleCard && index === 0 && gameState.roundInProgress;
        elements.dealerHand.appendChild(createCardElement(card, hideCard));
    });

    const dealerValueDisplay = hideDealerHoleCard && gameState.roundInProgress
        ? "Valore: ?"
        : `Valore: ${gameState.dealer.value}`;
    elements.dealerValue.textContent = dealerValueDisplay;
}

function createCardElement(card, hide = false) {
    const cardElement = document.createElement("div");
    cardElement.classList.add("card");

    if (hide) {
        cardElement.classList.add("back");
        return cardElement;
    }

    cardElement.classList.add(card.suit.className);

    const rank = document.createElement("span");
    rank.classList.add("rank");
    rank.textContent = card.rank;

    const suit = document.createElement("span");
    suit.classList.add("suit");
    suit.textContent = card.suit.symbol;

    cardElement.append(rank, suit);
    return cardElement;
}

function updateActivePlayerControls() {
    const activePlayer = gameState.players[gameState.activePlayerIndex];
    const isPlayersTurn = Boolean(activePlayer && gameState.roundInProgress);
    elements.hitBtn.disabled = !isPlayersTurn;
    elements.standBtn.disabled = !isPlayersTurn;

    const playerNodes = [...elements.playersArea.querySelectorAll(".player")];
    playerNodes.forEach((node) => {
        node.classList.toggle(
            "active",
            node.dataset.playerId === activePlayer?.id
        );
    });
}

function renderLeaderboard() {
    const sortedPlayers = [...gameState.players].sort((a, b) => b.wins - a.wins || b.totalWinnings - a.totalWinnings);
    elements.leaderboard.innerHTML = "";

    sortedPlayers.forEach((player) => {
        const listItem = document.createElement("li");
        listItem.innerHTML = `<strong>${player.name}</strong> — Vittorie: ${player.wins} · Denaro vinto: $${player.totalWinnings}`;
        elements.leaderboard.appendChild(listItem);
    });
}

function enableStartButton() {
    elements.startRoundBtn.disabled = gameState.players.length === 0 || gameState.roundInProgress;
}

function resetTable() {
    if (!confirm("Sicuro di voler azzerare il tavolo e la classifica?")) return;
    gameState.players = [];
    gameState.dealer = { hand: [], value: 0 };
    gameState.deck = [];
    gameState.activePlayerIndex = -1;
    gameState.roundInProgress = false;
    gameState.loggedUser = null;
    saveState();
    renderPlayers();
    renderLeaderboard();
    renderHands(false);
    elements.tableLayout.hidden = true;
    elements.authPanel.hidden = false;
    elements.authStatus.textContent = "Accesso richiesto";
    elements.startRoundBtn.disabled = true;
}

function saveState() {
    const persistableState = {
        players: gameState.players,
        lastMoneyTick: gameState.lastMoneyTick
    };
    localStorage.setItem("blackjackState", JSON.stringify(persistableState));
}

function loadState() {
    const raw = localStorage.getItem("blackjackState");
    if (!raw) return;
    try {
        const saved = JSON.parse(raw);
        gameState.players = saved.players || [];
        gameState.lastMoneyTick = saved.lastMoneyTick || Date.now();
    } catch (error) {
        console.error("Impossibile caricare lo stato salvato", error);
    }
}

function startMoneyTicker() {
    updateMoneyTicker();
    setInterval(() => {
        const now = Date.now();
        if (now - gameState.lastMoneyTick >= MONEY_INTERVAL) {
            const cycles = Math.floor((now - gameState.lastMoneyTick) / MONEY_INTERVAL);
            const generated = cycles * MONEY_INCREMENT;
            gameState.players.forEach((player) => {
                player.balance += generated;
                player.totalWinnings += generated;
            });
            gameState.lastMoneyTick += cycles * MONEY_INTERVAL;
            saveState();
            renderLeaderboard();
            updateMoneyTicker(generated);
        } else {
            updateMoneyTicker();
        }
    }, 1000);
}

function updateMoneyTicker(amount = 0) {
    if (amount > 0) {
        elements.moneyTicker.textContent = `$${amount} generati nell'ultimo minuto`;
    } else {
        const nextTick = Math.max(0, MONEY_INTERVAL - (Date.now() - gameState.lastMoneyTick));
        const seconds = Math.ceil(nextTick / 1000);
        elements.moneyTicker.textContent = `Nuovi $${MONEY_INCREMENT} in ${seconds}s`;
    }
}
