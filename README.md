# GambleX Platform

A feature-rich gambling demo built with Node.js and vanilla JavaScript. It provides multiple mini-games (Blackjack, Crash, Keno, Plinko), a full wallet, account system, level rewards, daily bonuses, and a live chat using Socket.IO.

## Features

- **User accounts** – Register and log in securely, backed by bcrypt hashing and server sessions.
- **Wallet system** – Deposit or withdraw simulated real-money balances and track transaction history.
- **Games** –
  - Blackjack against the house
  - Crash with auto cash-out
  - Keno (1–10 number picks, 20 draw)
  - Plinko with configurable risk tiers
- **Progression** – Earn XP on every wager, level up, and collect automated level rewards.
- **Rewards** – Claim a daily bonus and see a detailed reward history.
- **Live chat** – Socket.IO-powered lobby chat with authenticated user handles.

> ⚠️ **Compliance notice**: This project uses a simulated wallet for demonstration purposes. When deploying, integrate only with regulated payment processors that comply with regional gambling laws. Ensure you implement age verification, KYC, anti-fraud, and responsible gaming features before using real money.

## Getting started

```bash
npm install
npm run start
```

The application will listen on [http://localhost:3000](http://localhost:3000). Registration automatically seeds an account with 1000 credits to explore the games.

## Project structure

```
├── data
│   └── users.json          # Simple JSON storage for demo persistence
├── public
│   ├── index.html          # UI (vanilla JS + fetch)
│   ├── script.js           # Front-end logic
│   └── style.css           # Styling for the dashboard
├── server.js               # Express server, game logic, chat, wallet endpoints
├── package.json
└── README.md
```

## Available scripts

- `npm run start` – Start the production server
- `npm run dev` – Start the server with nodemon (auto reload)

## Testing plan

Manual QA checklist:

- Register and log in; ensure balances and sessions persist across refresh.
- Deposit and withdraw flows update the wallet correctly.
- Play each game (Blackjack, Crash, Keno, Plinko) and verify payouts update balance.
- Verify XP increments on wagers, levels increase, and rewards appear in history.
- Claim the daily bonus (once every 24 hours) and view reward history.
- Open multiple browser windows to confirm chat functionality and session isolation.

## Security notes

This is a teaching example. Before real-world deployment:

- Replace the file-based JSON store with a hardened database and encrypt sensitive data.
- Add rate limiting, input validation, and request logging.
- Use secure, secret environment variables for sessions.
- Integrate AML/KYC, geolocation restrictions, and enforce responsible gaming policies.

## License

MIT License. See [LICENSE](LICENSE) if added.
