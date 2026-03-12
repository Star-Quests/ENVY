# ENVY - Professional Crypto Trading Journal

A sophisticated trading journal application with real-time price tracking, FIFO accounting, trade planning, and GitHub backup.

## Features

### Dashboard
- Live prices with logos and 24h changes
- Portfolio summary (total capital, balance, profit/loss)
- Current holdings with unrealized P/L
- Recent trades history
- Auto-updates every 2 seconds

### Journal
- Complete transaction ledger
- Buy/sell tracking with FIFO accounting
- Trade duration timer
- Profit/loss calculation
- Delete transactions with automatic reconciliation

### Planner
- Isolated trade simulation
- Real-time price fetching
- Take profit/stop loss calculation
- Risk/reward ratio
- Trailing stop calculation
- Save plans for later execution

### Settings
- Enable/disable tracked assets
- Auto-discover new Bybit assets
- GitHub backup (manual + auto every 5 minutes)
- Memory format (reset all data)

## Installation

1. Clone repository
2. Install dependencies: `npm install`
3. Create `.env` file with your GitHub token
4. Start backend: `npm run dev`
5. Start frontend: `npm run frontend`

## Technology

- Backend: Node.js + Express + SQLite
- Frontend: HTML/CSS/JS + WebSocket
- Real-time data: Bybit WebSocket API
- Logos: CoinGecko with local caching
- Backup: GitHub API

## Financial Precision

- Prices: 8 decimals storage
- Quantities: 8 decimals
- USDT values: 2 decimals display
- ROI/RiskReward: 2 decimals
- ROUND HALF UP throughout

## Design

- Dark terminal theme
- Glassmorphism panels
- Fonts: Orbitron, Rajdhani, Audiowide, Exo 2
- No emojis, professional look
- Asset logos everywhere