const state = {
  user: null,
  socket: null
};

const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => Array.from(document.querySelectorAll(selector));

function showDashboard(show) {
  const authSection = $('#auth-section');
  const dashboard = $('#dashboard');
  if (show) {
    authSection.classList.add('hidden');
    dashboard.classList.remove('hidden');
  } else {
    authSection.classList.remove('hidden');
    dashboard.classList.add('hidden');
  }
}

function updateUserUI(user) {
  state.user = user;
  $('#user-name').textContent = user.username;
  $('#user-balance').textContent = user.balance.toFixed(2);
  $('#user-level').textContent = user.level;
  $('#user-xp').textContent = user.xp;
}

async function fetchJSON(url, options = {}) {
  const response = await fetch(url, {
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json'
    },
    ...options
  });
  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new Error(data.message || 'Request failed');
  }
  return response.json();
}

async function refreshData() {
  if (!state.user) return;
  try {
    const [{ transactions }, { rewards }] = await Promise.all([
      fetchJSON('/api/transactions'),
      fetchJSON('/api/rewards')
    ]);
    renderTransactions(transactions || []);
    renderRewards(rewards || []);
  } catch (err) {
    console.error(err);
  }
}

function renderTransactions(transactions) {
  const list = $('#transaction-list');
  list.innerHTML = '';
  transactions
    .slice()
    .reverse()
    .forEach((tx) => {
      const li = document.createElement('li');
      const amountText = typeof tx.amount === 'number' ? tx.amount.toFixed(2) : '';
      const betText = typeof tx.bet === 'number' ? tx.bet.toFixed(2) : null;
      const payoutText = typeof tx.payout === 'number' ? tx.payout.toFixed(2) : null;
      const multiplierText = typeof tx.multiplier === 'number' ? tx.multiplier.toFixed(2) : null;
      li.innerHTML = `
        <strong>${tx.type}</strong> ${amountText ? `&mdash; ${amountText}` : ''}
        <div class="muted">${new Date(tx.timestamp).toLocaleString()}</div>
        ${tx.description ? `<div>${tx.description}</div>` : ''}
        ${betText !== null ? `<div>Bet: ${betText}</div>` : ''}
        ${tx.result ? `<div>Result: ${tx.result}</div>` : ''}
        ${payoutText !== null ? `<div>Payout: ${payoutText}</div>` : ''}
        ${tx.crashPoint ? `<div>Crash @ ${tx.crashPoint}</div>` : ''}
        ${tx.autoCashOut ? `<div>Auto cash out @ ${tx.autoCashOut}</div>` : ''}
        ${multiplierText !== null ? `<div>Multiplier: ${multiplierText}</div>` : ''}
        ${Array.isArray(tx.hits) ? `<div>Hits: ${tx.hits.length}</div>` : ''}
      `;
      list.appendChild(li);
    });
}

function renderRewards(rewards) {
  const list = $('#rewards-list');
  list.innerHTML = '';
  rewards
    .slice()
    .reverse()
    .forEach((reward) => {
      const li = document.createElement('li');
      li.innerHTML = `
        <strong>${reward.type}</strong> &mdash; ${reward.amount}
        <div class="muted">${new Date(reward.timestamp).toLocaleString()}</div>
        ${reward.level ? `<div>Level reached: ${reward.level}</div>` : ''}
      `;
      list.appendChild(li);
    });
}

function displayGameResult(container, message, status) {
  container.className = `result ${status || ''}`;
  container.innerHTML = message;
}

function connectChat() {
  if (state.socket) {
    state.socket.disconnect();
  }
  state.socket = io({ withCredentials: true });
  const chatWindow = $('#chat-window');

  state.socket.on('chat-message', (payload) => {
    const div = document.createElement('div');
    div.className = 'chat-message';
    div.innerHTML = `<strong>${payload.username}:</strong> ${payload.message}`;
    chatWindow.appendChild(div);
    chatWindow.scrollTop = chatWindow.scrollHeight;
  });

  state.socket.on('error', (err) => {
    console.error('Chat error', err);
  });
}

function setupAuthForms() {
  $('#register-form').addEventListener('submit', async (event) => {
    event.preventDefault();
    const formData = new FormData(event.target);
    const payload = Object.fromEntries(formData.entries());
    try {
      const { user } = await fetchJSON('/api/register', {
        method: 'POST',
        body: JSON.stringify(payload)
      });
      updateUserUI(user);
      showDashboard(true);
      connectChat();
      await refreshData();
      event.target.reset();
    } catch (err) {
      alert(err.message);
    }
  });

  $('#login-form').addEventListener('submit', async (event) => {
    event.preventDefault();
    const formData = new FormData(event.target);
    const payload = Object.fromEntries(formData.entries());
    try {
      const { user } = await fetchJSON('/api/login', {
        method: 'POST',
        body: JSON.stringify(payload)
      });
      updateUserUI(user);
      showDashboard(true);
      connectChat();
      await refreshData();
      event.target.reset();
    } catch (err) {
      alert(err.message);
    }
  });
}

function setupWalletForms() {
  $('#deposit-form').addEventListener('submit', async (event) => {
    event.preventDefault();
    const formData = new FormData(event.target);
    const payload = Object.fromEntries(formData.entries());
    try {
      const { user } = await fetchJSON('/api/wallet/deposit', {
        method: 'POST',
        body: JSON.stringify(payload)
      });
      updateUserUI(user);
      await refreshData();
      event.target.reset();
    } catch (err) {
      alert(err.message);
    }
  });

  $('#withdraw-form').addEventListener('submit', async (event) => {
    event.preventDefault();
    const formData = new FormData(event.target);
    const payload = Object.fromEntries(formData.entries());
    try {
      const { user } = await fetchJSON('/api/wallet/withdraw', {
        method: 'POST',
        body: JSON.stringify(payload)
      });
      updateUserUI(user);
      await refreshData();
      event.target.reset();
    } catch (err) {
      alert(err.message);
    }
  });
}

function serializeNumbers(input) {
  if (!input) return [];
  return input
    .split(',')
    .map((n) => parseInt(n.trim(), 10))
    .filter((n) => !Number.isNaN(n));
}

function setupGameForms() {
  $$('.game').forEach((gameElement) => {
    const form = gameElement.querySelector('form');
    const resultContainer = gameElement.querySelector('.result');
    form.addEventListener('submit', async (event) => {
      event.preventDefault();
      const formData = new FormData(form);
      const payload = Object.fromEntries(formData.entries());
      const game = gameElement.dataset.game;

      if (payload.numbers) {
        payload.numbers = serializeNumbers(payload.numbers);
      }

      try {
        const response = await fetchJSON(`/api/games/${game}`, {
          method: 'POST',
          body: JSON.stringify(payload)
        });
        updateUserUI(response.user);
        await refreshData();
        resultContainer.className = 'result';
        displayGameResult(resultContainer, renderGameResponse(game, response), response.game.outcome || response.game.result);
      } catch (err) {
        displayGameResult(resultContainer, err.message, 'error');
      }
    });
  });
}

function renderGameResponse(game, response) {
  if (!response.game) return 'No result.';
  switch (game) {
    case 'blackjack':
      return `
        Dealer: ${response.game.dealerHand.map((c) => `${c.value}${c.suit}`).join(', ')} (${response.game.dealerValue})<br />
        Player: ${response.game.playerHand.map((c) => `${c.value}${c.suit}`).join(', ')} (${response.game.playerValue})<br />
        Result: ${response.game.result.toUpperCase()}<br />
        Payout: ${response.payout.toFixed(2)}
      `;
    case 'crash':
      return `
        Crash point: ${response.game.crashPoint}<br />
        Auto cash out: ${response.game.autoCashOut}<br />
        Outcome: ${response.game.outcome.toUpperCase()}<br />
        Payout: ${response.payout.toFixed(2)}
      `;
    case 'keno':
      return `
        Draw: ${response.game.draw.join(', ')}<br />
        Hits: ${response.game.hits.join(', ') || 'None'}<br />
        Matches: ${response.game.hitsCount}<br />
        Multiplier: ${response.game.payoutMultiplier}<br />
        Payout: ${response.payout.toFixed(2)}
      `;
    case 'plinko':
      return `
        Risk: ${response.game.riskLevel}<br />
        Slot: ${response.game.slot}<br />
        Multiplier: ${response.game.multiplier}<br />
        Payout: ${response.payout.toFixed(2)}
      `;
    default:
      return JSON.stringify(response.game);
  }
}

function setupControls() {
  $('#daily-bonus').addEventListener('click', async () => {
    try {
      const data = await fetchJSON('/api/rewards/daily', { method: 'POST' });
      updateUserUI(data.user);
      await refreshData();
      alert(`Daily bonus claimed: ${data.bonus}`);
    } catch (err) {
      alert(err.message);
    }
  });

  $('#logout-btn').addEventListener('click', async () => {
    await fetchJSON('/api/logout', { method: 'POST' }).catch(() => {});
    state.user = null;
    if (state.socket) {
      state.socket.disconnect();
    }
    showDashboard(false);
  });
}

function setupChat() {
  $('#chat-form').addEventListener('submit', (event) => {
    event.preventDefault();
    const input = $('#chat-input');
    const message = input.value.trim();
    if (!message) return;
    if (!state.socket) {
      alert('Connect to chat by logging in.');
      return;
    }
    state.socket.emit('chat-message', message);
    input.value = '';
  });
}

async function init() {
  setupAuthForms();
  setupWalletForms();
  setupGameForms();
  setupControls();
  setupChat();

  try {
    const { user } = await fetchJSON('/api/me');
    if (user) {
      updateUserUI(user);
      showDashboard(true);
      connectChat();
      await refreshData();
    }
  } catch (err) {
    console.log('No existing session');
  }
}

document.addEventListener('DOMContentLoaded', init);
