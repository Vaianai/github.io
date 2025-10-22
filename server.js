const express = require('express');
const session = require('express-session');
const bodyParser = require('body-parser');
const bcrypt = require('bcryptjs');
const cors = require('cors');
const { v4: uuidv4 } = require('uuid');
const path = require('path');
const fs = require('fs-extra');
const http = require('http');
const socketIo = require('socket.io');

const DATA_DIR = path.join(__dirname, 'data');
const USERS_FILE = path.join(DATA_DIR, 'users.json');

const app = express();
const server = http.createServer(app);
const io = socketIo(server);

const sessionMiddleware = session({
  secret: 'super-secret-key',
  resave: false,
  saveUninitialized: false
});

app.use(cors({
  origin: true,
  credentials: true
}));
app.use(bodyParser.json());
app.use(sessionMiddleware);
app.use(express.static(path.join(__dirname, 'public')));

let users = [];

function loadUsers() {
  try {
    const raw = fs.readFileSync(USERS_FILE, 'utf-8');
    const parsed = JSON.parse(raw);
    users = parsed.users || [];
  } catch (err) {
    console.error('Failed to load users data:', err);
    users = [];
  }
}

function saveUsers() {
  try {
    fs.ensureDirSync(DATA_DIR);
    fs.writeFileSync(USERS_FILE, JSON.stringify({ users }, null, 2));
  } catch (err) {
    console.error('Failed to save users data:', err);
  }
}

function sanitizeUser(user) {
  if (!user) {
    return null;
  }
  const { passwordHash, ...rest } = user;
  return rest;
}

function ensureUserCollections(user) {
  if (!user.transactions) user.transactions = [];
  if (!user.rewards) user.rewards = [];
}

function authRequired(req, res, next) {
  const userId = req.session.userId;
  if (!userId) {
    return res.status(401).json({ message: 'Unauthorized' });
  }
  const user = users.find((u) => u.id === userId);
  if (!user) {
    return res.status(401).json({ message: 'Unauthorized' });
  }
  ensureUserCollections(user);
  req.user = user;
  next();
}

function updateLevel(user, xpEarned) {
  const xpMultiplier = 1;
  user.xp = (user.xp || 0) + xpEarned * xpMultiplier;
  const newLevel = Math.floor(user.xp / 1000) + 1;
  if (newLevel > (user.level || 1)) {
    user.level = newLevel;
    const reward = 50 * newLevel;
    user.balance += reward;
    user.rewards = user.rewards || [];
    user.rewards.push({
      type: 'level-up',
      amount: reward,
      timestamp: new Date().toISOString(),
      level: newLevel
    });
  } else {
    user.level = user.level || 1;
  }
}

function handleBet(user, amount) {
  if (amount <= 0) {
    return { ok: false, message: 'Bet amount must be positive' };
  }
  if (user.balance < amount) {
    return { ok: false, message: 'Insufficient balance' };
  }
  user.balance -= amount;
  updateLevel(user, amount);
  return { ok: true };
}

function blackjackGame() {
  const createDeck = () => {
    const suits = ['♠', '♥', '♦', '♣'];
    const values = [
      'A',
      '2',
      '3',
      '4',
      '5',
      '6',
      '7',
      '8',
      '9',
      '10',
      'J',
      'Q',
      'K'
    ];
    const deck = [];
    suits.forEach((suit) => {
      values.forEach((value) => deck.push({ value, suit }));
    });
    return deck;
  };

  const getCardValue = (card) => {
    if (['J', 'Q', 'K'].includes(card.value)) return 10;
    if (card.value === 'A') return 11;
    return parseInt(card.value, 10);
  };

  const calculateHandValue = (hand) => {
    let value = hand.reduce((sum, card) => sum + getCardValue(card), 0);
    let aces = hand.filter((card) => card.value === 'A').length;

    while (value > 21 && aces > 0) {
      value -= 10;
      aces -= 1;
    }
    return value;
  };

  const deck = createDeck();
  const drawCard = () => deck.splice(Math.floor(Math.random() * deck.length), 1)[0];

  const playerHand = [drawCard(), drawCard()];
  const dealerHand = [drawCard(), drawCard()];

  while (calculateHandValue(playerHand) < 17) {
    playerHand.push(drawCard());
  }

  while (calculateHandValue(dealerHand) < 17) {
    dealerHand.push(drawCard());
  }

  const playerValue = calculateHandValue(playerHand);
  const dealerValue = calculateHandValue(dealerHand);

  let result;
  if (playerValue > 21) {
    result = 'lose';
  } else if (dealerValue > 21) {
    result = 'win';
  } else if (playerValue > dealerValue) {
    result = 'win';
  } else if (playerValue < dealerValue) {
    result = 'lose';
  } else {
    result = 'push';
  }

  return {
    playerHand,
    dealerHand,
    playerValue,
    dealerValue,
    result
  };
}

function crashGame(autoCashOut) {
  const randomCrash = Math.max(1.0, Math.random() * (Math.random() * 10 + 1)).toFixed(2);
  const crashed = parseFloat(randomCrash);
  const auto = parseFloat(autoCashOut);
  let outcome = 'lose';
  if (auto <= crashed) {
    outcome = 'win';
  }
  return { crashPoint: crashed, autoCashOut: auto, outcome };
}

function kenoGame(playerNumbers) {
  const available = Array.from({ length: 80 }, (_, i) => i + 1);
  const draw = [];
  while (draw.length < 20) {
    const idx = Math.floor(Math.random() * available.length);
    draw.push(available[idx]);
    available.splice(idx, 1);
  }
  const hits = playerNumbers.filter((num) => draw.includes(num));
  let payoutMultiplier = 0;
  const hitsCount = hits.length;
  if (hitsCount >= 10) {
    payoutMultiplier = 100;
  } else if (hitsCount === 9) {
    payoutMultiplier = 50;
  } else if (hitsCount === 8) {
    payoutMultiplier = 20;
  } else if (hitsCount === 7) {
    payoutMultiplier = 10;
  } else if (hitsCount === 6) {
    payoutMultiplier = 5;
  } else if (hitsCount === 5) {
    payoutMultiplier = 3;
  } else if (hitsCount === 4) {
    payoutMultiplier = 2;
  } else if (hitsCount === 3) {
    payoutMultiplier = 1.5;
  } else if (hitsCount === 2) {
    payoutMultiplier = 1.2;
  }

  return {
    draw,
    hits,
    hitsCount,
    payoutMultiplier
  };
}

const PLINKO_MULTIPLIERS = {
  low: [0.5, 0.8, 0.9, 1, 1.2, 1.5, 2],
  medium: [0.2, 0.5, 0.8, 1, 1.5, 2.5, 4],
  high: [0.1, 0.2, 0.5, 1, 2, 5, 10]
};

function plinkoGame(riskLevel) {
  const options = PLINKO_MULTIPLIERS[riskLevel] || PLINKO_MULTIPLIERS.medium;
  const index = Math.floor(Math.random() * options.length);
  const multiplier = options[index];
  return {
    riskLevel,
    multiplier,
    slot: index
  };
}

app.get('/api/status', (req, res) => {
  res.json({ status: 'ok' });
});

app.post('/api/register', async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(400).json({ message: 'Username and password are required' });
  }
  if (users.find((u) => u.username === username)) {
    return res.status(400).json({ message: 'Username already exists' });
  }
  const passwordHash = await bcrypt.hash(password, 10);
  const newUser = {
    id: uuidv4(),
    username,
    passwordHash,
    balance: 1000,
    level: 1,
    xp: 0,
    rewards: [],
    transactions: [],
    lastDailyBonus: null
  };
  users.push(newUser);
  saveUsers();
  req.session.userId = newUser.id;
  res.json({ user: sanitizeUser(newUser) });
});

app.post('/api/login', async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(400).json({ message: 'Username and password are required' });
  }
  const user = users.find((u) => u.username === username);
  if (!user) {
    return res.status(400).json({ message: 'Invalid username or password' });
  }
  const match = await bcrypt.compare(password, user.passwordHash);
  if (!match) {
    return res.status(400).json({ message: 'Invalid username or password' });
  }
  req.session.userId = user.id;
  res.json({ user: sanitizeUser(user) });
});

app.post('/api/logout', (req, res) => {
  req.session.destroy(() => {
    res.json({ message: 'Logged out' });
  });
});

app.get('/api/me', authRequired, (req, res) => {
  res.json({ user: sanitizeUser(req.user) });
});

app.post('/api/wallet/deposit', authRequired, (req, res) => {
  const { amount, description } = req.body;
  const value = parseFloat(amount);
  if (!value || value <= 0) {
    return res.status(400).json({ message: 'Deposit amount must be positive' });
  }
  req.user.balance += value;
  req.user.transactions.push({
    id: uuidv4(),
    type: 'deposit',
    amount: value,
    description: description || 'Manual deposit',
    timestamp: new Date().toISOString()
  });
  saveUsers();
  res.json({ user: sanitizeUser(req.user) });
});

app.post('/api/wallet/withdraw', authRequired, (req, res) => {
  const { amount, description } = req.body;
  const value = parseFloat(amount);
  if (!value || value <= 0) {
    return res.status(400).json({ message: 'Withdrawal amount must be positive' });
  }
  if (req.user.balance < value) {
    return res.status(400).json({ message: 'Insufficient balance' });
  }
  req.user.balance -= value;
  req.user.transactions.push({
    id: uuidv4(),
    type: 'withdrawal',
    amount: value,
    description: description || 'Withdrawal request',
    timestamp: new Date().toISOString()
  });
  saveUsers();
  res.json({ user: sanitizeUser(req.user) });
});

app.post('/api/rewards/daily', authRequired, (req, res) => {
  const now = new Date();
  const lastClaim = req.user.lastDailyBonus ? new Date(req.user.lastDailyBonus) : null;
  if (lastClaim && now - lastClaim < 24 * 60 * 60 * 1000) {
    return res.status(400).json({ message: 'Daily bonus already claimed' });
  }
  const bonus = 100;
  req.user.balance += bonus;
  req.user.lastDailyBonus = now.toISOString();
  req.user.rewards.push({
    type: 'daily-bonus',
    amount: bonus,
    timestamp: req.user.lastDailyBonus
  });
  saveUsers();
  res.json({ user: sanitizeUser(req.user), bonus });
});

app.post('/api/games/blackjack', authRequired, (req, res) => {
  const { bet } = req.body;
  const betAmount = parseFloat(bet);
  if (!betAmount || betAmount <= 0) {
    return res.status(400).json({ message: 'Bet must be greater than zero' });
  }
  const betResult = handleBet(req.user, betAmount);
  if (!betResult.ok) {
    return res.status(400).json({ message: betResult.message });
  }
  const game = blackjackGame();
  let payout = 0;
  if (game.result === 'win') {
    payout = betAmount * 2;
  } else if (game.result === 'push') {
    payout = betAmount;
  }
  req.user.balance += payout;
  req.user.transactions.push({
    id: uuidv4(),
    type: 'blackjack',
    bet: betAmount,
    payout,
    result: game.result,
    timestamp: new Date().toISOString()
  });
  saveUsers();
  res.json({
    game,
    betAmount,
    payout,
    balance: req.user.balance,
    user: sanitizeUser(req.user)
  });
});

app.post('/api/games/crash', authRequired, (req, res) => {
  const { bet, autoCashOut } = req.body;
  const betAmount = parseFloat(bet);
  if (!betAmount || betAmount <= 0) {
    return res.status(400).json({ message: 'Bet must be greater than zero' });
  }
  const betResult = handleBet(req.user, betAmount);
  if (!betResult.ok) {
    return res.status(400).json({ message: betResult.message });
  }
  const auto = Math.max(1, parseFloat(autoCashOut) || 2.0);
  const game = crashGame(auto);
  let payout = 0;
  if (game.outcome === 'win') {
    payout = betAmount * parseFloat(game.autoCashOut);
  }
  req.user.balance += payout;
  req.user.transactions.push({
    id: uuidv4(),
    type: 'crash',
    bet: betAmount,
    payout,
    crashPoint: game.crashPoint,
    autoCashOut: game.autoCashOut,
    outcome: game.outcome,
    timestamp: new Date().toISOString()
  });
  saveUsers();
  res.json({
    game,
    betAmount,
    payout,
    balance: req.user.balance,
    user: sanitizeUser(req.user)
  });
});

app.post('/api/games/keno', authRequired, (req, res) => {
  const { bet, numbers } = req.body;
  const betAmount = parseFloat(bet);
  if (!Array.isArray(numbers) || numbers.length === 0) {
    return res.status(400).json({ message: 'Numbers are required' });
  }
  if (!betAmount || betAmount <= 0) {
    return res.status(400).json({ message: 'Bet must be greater than zero' });
  }
  const sanitizedNumbers = [...new Set(numbers.map((n) => parseInt(n, 10)))].filter(
    (n) => n >= 1 && n <= 80
  );
  if (sanitizedNumbers.length === 0 || sanitizedNumbers.length > 10) {
    return res.status(400).json({
      message: 'Choose between 1 and 10 unique numbers between 1 and 80'
    });
  }
  const betResult = handleBet(req.user, betAmount);
  if (!betResult.ok) {
    return res.status(400).json({ message: betResult.message });
  }
  const game = kenoGame(sanitizedNumbers);
  const payout = betAmount * game.payoutMultiplier;
  req.user.balance += payout;
  req.user.transactions.push({
    id: uuidv4(),
    type: 'keno',
    bet: betAmount,
    payout,
    hits: game.hits,
    draw: game.draw,
    timestamp: new Date().toISOString()
  });
  saveUsers();
  res.json({
    game,
    betAmount,
    payout,
    balance: req.user.balance,
    user: sanitizeUser(req.user)
  });
});

app.post('/api/games/plinko', authRequired, (req, res) => {
  const { bet, risk } = req.body;
  const betAmount = parseFloat(bet);
  if (!betAmount || betAmount <= 0) {
    return res.status(400).json({ message: 'Bet must be greater than zero' });
  }
  const betResult = handleBet(req.user, betAmount);
  if (!betResult.ok) {
    return res.status(400).json({ message: betResult.message });
  }
  const game = plinkoGame(risk || 'medium');
  const payout = betAmount * game.multiplier;
  req.user.balance += payout;
  req.user.transactions.push({
    id: uuidv4(),
    type: 'plinko',
    bet: betAmount,
    payout,
    risk: game.riskLevel,
    multiplier: game.multiplier,
    timestamp: new Date().toISOString()
  });
  saveUsers();
  res.json({
    game,
    betAmount,
    payout,
    balance: req.user.balance,
    user: sanitizeUser(req.user)
  });
});

app.get('/api/transactions', authRequired, (req, res) => {
  res.json({ transactions: req.user.transactions || [] });
});

app.get('/api/rewards', authRequired, (req, res) => {
  res.json({ rewards: req.user.rewards || [] });
});

io.use((socket, next) => {
  sessionMiddleware(socket.request, {}, next);
});

io.on('connection', (socket) => {
  const sessionData = socket.request.session;
  let user = null;
  if (sessionData && sessionData.userId) {
    user = users.find((u) => u.id === sessionData.userId);
  }

  if (!user) {
    socket.emit('error', 'Authentication required for chat.');
    socket.disconnect();
    return;
  }

  socket.on('chat-message', (message) => {
    if (!message || typeof message !== 'string') return;
    const payload = {
      id: uuidv4(),
      username: user.username,
      message: message.substring(0, 200),
      timestamp: new Date().toISOString()
    };
    io.emit('chat-message', payload);
  });

  socket.on('disconnect', () => {});
});

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

loadUsers();
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
