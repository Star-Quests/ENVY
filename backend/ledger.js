// File: backend/ledger.js
// ENVY Ledger Accounting Engine - FIXED VERSION

const BigNumber = require('bignumber.js');
const { v4: uuidv4 } = require('uuid');

BigNumber.config({ ROUNDING_MODE: BigNumber.ROUND_HALF_UP, DECIMAL_PLACES: 8 });

class Ledger {
  constructor(db) {
    this.db = db;
  }
  
  // Add transaction to ledger, manage cycles
  addTransaction(tx) {
    const { type, asset, amount, price, timestamp } = tx;
    const amountBN = new BigNumber(amount);
    const priceBN = new BigNumber(price);
    
    if (type === 'buy') {
      // Create new open cycle
      const cycleId = uuidv4();
      this.db.run(`
        INSERT INTO trade_cycles (
          id, asset, entry_date, entry_price, quantity, status, timer_start
        ) VALUES (?, ?, ?, ?, ?, 'open', ?)
      `, [cycleId, asset, timestamp, priceBN.toString(), amountBN.toString(), timestamp]);
      
      return cycleId;
      
    } else if (type === 'sell') {
      // Find oldest open cycle for this asset (FIFO)
      const cycles = this.db.exec(`
        SELECT * FROM trade_cycles 
        WHERE asset = ? AND status = 'open' 
        ORDER BY entry_date ASC
      `, [asset]);
      
      if (!cycles[0] || cycles[0].values.length === 0) {
        // No open cycle - create new sell cycle (short position)
        const cycleId = uuidv4();
        this.db.run(`
          INSERT INTO trade_cycles (
            id, asset, entry_date, entry_price, quantity, status, timer_start
          ) VALUES (?, ?, ?, ?, ?, 'open', ?)
        `, [cycleId, asset, timestamp, priceBN.toString(), amountBN.negated().toString(), timestamp]);
        return cycleId;
      }
      
      // Process sell against oldest cycle
      const columns = cycles[0].columns;
      const values = cycles[0].values[0];
      const cycle = {};
      columns.forEach((col, i) => {
        cycle[col] = values[i];
      });
      
      const cycleQuantity = new BigNumber(cycle.quantity);
      const cycleEntryPrice = new BigNumber(cycle.entry_price);
      const sellAmount = amountBN;
      
      // Calculate realized P/L using Bybit formula
      let realizedPL;
      if (cycleQuantity.gt(0)) {
        // Long position
        realizedPL = priceBN.minus(cycleEntryPrice).times(sellAmount);
      } else {
        // Short position
        realizedPL = cycleEntryPrice.minus(priceBN).times(sellAmount.abs());
      }
      
      const realizedPLPercent = realizedPL.dividedBy(cycleEntryPrice.times(sellAmount.abs())).times(100);
      const duration = cycle.timer_start ? Date.now() - cycle.timer_start : 0;
      
      // Close the cycle
      this.db.run(`
        UPDATE trade_cycles 
        SET exit_date = ?, exit_price = ?, realized_pl = ?, 
            realized_pl_percent = ?, status = 'closed', duration = ?
        WHERE id = ?
      `, [timestamp, priceBN.toString(), realizedPL.toString(), realizedPLPercent.toString(), duration, cycle.id]);
      
      return cycle.id;
      
    } else if (type === 'fee') {
      // Handle fee as reduction in profit
      const cycles = this.db.exec(`
        SELECT * FROM trade_cycles 
        WHERE asset = ? AND status = 'open' 
        ORDER BY entry_date DESC
      `, [asset]);
      
      if (cycles[0] && cycles[0].values.length > 0) {
        const columns = cycles[0].columns;
        const values = cycles[0].values[0];
        const cycle = {};
        columns.forEach((col, i) => {
          cycle[col] = values[i];
        });
        
        const currentPL = new BigNumber(cycle.realized_pl || 0);
        const feeBN = new BigNumber(amount);
        const newPL = currentPL.minus(feeBN);
        
        this.db.run(`
          UPDATE trade_cycles SET realized_pl = ? WHERE id = ?
        `, [newPL.toString(), cycle.id]);
        
        return cycle.id;
      }
    }
    
    return null;
  }
  
  // Remove transaction and revert cycle changes
  removeTransaction(tx) {
    const { id, type, asset, amount, cycle_id } = tx;
    
    if (cycle_id) {
      if (type === 'buy') {
        // Delete the cycle if it was a buy
        this.db.run(`DELETE FROM trade_cycles WHERE id = ?`, [cycle_id]);
      } else if (type === 'sell') {
        // Reopen the cycle
        this.db.run(`
          UPDATE trade_cycles 
          SET status = 'open', exit_date = NULL, exit_price = NULL, 
              realized_pl = NULL, realized_pl_percent = NULL
          WHERE id = ?
        `, [cycle_id]);
      }
    }
  }
  
  // Get portfolio summary - FIXED: Removed avgTrade, fixed calculations
  getPortfolioSummary(priceFeed) {
    // Get all open cycles
    const cycles = this.db.exec(`
      SELECT * FROM trade_cycles WHERE status = 'open'
    `);
    
    let totalCapitalBN = new BigNumber(0);
    let currentBalanceBN = new BigNumber(0);
    let totalProfitBN = new BigNumber(0);
    let totalLossBN = new BigNumber(0);
    const openPositions = [];
    
    if (cycles[0]) {
      const columns = cycles[0].columns;
      cycles[0].values.forEach(row => {
        const cycle = {};
        columns.forEach((col, i) => {
          cycle[col] = row[i];
        });
        
        const quantity = new BigNumber(cycle.quantity);
        const entryPrice = new BigNumber(cycle.entry_price);
        const entryValue = quantity.abs().times(entryPrice);
        totalCapitalBN = totalCapitalBN.plus(entryValue);
        
        // Get current price
        let currentPrice = entryPrice;
        if (priceFeed && priceFeed.getPrice) {
          const priceData = priceFeed.getPrice(cycle.asset);
          if (priceData) {
            currentPrice = new BigNumber(priceData.price);
          }
        }
        
        const currentValue = quantity.abs().times(currentPrice);
        
        // Calculate unrealized P/L based on position type
        let unrealizedPL;
        if (quantity.gt(0)) {
          // Long position
          unrealizedPL = currentPrice.minus(entryPrice).times(quantity);
        } else {
          // Short position
          unrealizedPL = entryPrice.minus(currentPrice).times(quantity.abs());
        }
        
        currentBalanceBN = currentBalanceBN.plus(currentValue);
        
        if (unrealizedPL.gt(0)) {
          totalProfitBN = totalProfitBN.plus(unrealizedPL);
        } else {
          totalLossBN = totalLossBN.plus(unrealizedPL.abs());
        }
        
        openPositions.push({
          id: cycle.id,
          asset: cycle.asset,
          quantity: quantity.toString(),
          entry_price: entryPrice.toString(),
          current_price: currentPrice.toString(),
          current_value: currentValue.toString(),
          unrealized_pl: unrealizedPL.toString(),
          average_cost: this.calculateAverageCost(cycle.asset)
        });
      });
    }
    
    // Get closed cycles stats (only wins/losses count)
    const closed = this.db.exec(`
      SELECT COUNT(*) as count,
             SUM(CASE WHEN CAST(realized_pl AS REAL) > 0 THEN 1 ELSE 0 END) as wins
      FROM trade_cycles 
      WHERE status = 'closed'
    `);
    
    let winRateBN = new BigNumber(0);
    let tradeCount = 0;
    
    if (closed[0] && closed[0].values[0]) {
      tradeCount = closed[0].values[0][0] || 0;
      const wins = closed[0].values[0][1] || 0;
      winRateBN = tradeCount > 0 ? new BigNumber(wins).dividedBy(tradeCount).times(100) : new BigNumber(0);
    }
    
    return {
      totalCapital: totalCapitalBN.toString(),
      currentBalance: currentBalanceBN.toString(),
      totalProfit: totalProfitBN.toString(),
      totalLoss: totalLossBN.toString(),
      winRate: winRateBN.toString(),
      openPositions,
      tradeCount
    };
  }
  
  // NEW: Calculate average cost for an asset
  calculateAverageCost(asset) {
    const buys = this.db.exec(`
      SELECT amount, price FROM transactions 
      WHERE asset = ? AND type = 'buy'
      ORDER BY timestamp ASC
    `, [asset]);
    
    if (!buys[0] || buys[0].values.length === 0) {
      return '0';
    }
    
    let totalCost = new BigNumber(0);
    let totalQuantity = new BigNumber(0);
    
    const columns = buys[0].columns;
    buys[0].values.forEach(row => {
      const amount = new BigNumber(row[0]);
      const price = new BigNumber(row[1]);
      totalCost = totalCost.plus(amount.times(price));
      totalQuantity = totalQuantity.plus(amount);
    });
    
    if (totalQuantity.eq(0)) return '0';
    return totalCost.dividedBy(totalQuantity).toString();
  }
  
  // Get open positions with average cost
  getOpenPositions(priceFeed) {
    const cycles = this.db.exec(`
      SELECT * FROM trade_cycles WHERE status = 'open' ORDER BY entry_date ASC
    `);
    
    const positions = [];
    if (cycles[0]) {
      const columns = cycles[0].columns;
      cycles[0].values.forEach(row => {
        const cycle = {};
        columns.forEach((col, i) => {
          cycle[col] = row[i];
        });
        
        const quantity = new BigNumber(cycle.quantity);
        const entryPrice = new BigNumber(cycle.entry_price);
        
        let currentPrice = entryPrice;
        if (priceFeed && priceFeed.getPrice) {
          const priceData = priceFeed.getPrice(cycle.asset);
          if (priceData) {
            currentPrice = new BigNumber(priceData.price);
          }
        }
        
        const currentValue = quantity.abs().times(currentPrice);
        
        // Calculate unrealized P/L based on position type
        let unrealizedPL;
        if (quantity.gt(0)) {
          unrealizedPL = currentPrice.minus(entryPrice).times(quantity);
        } else {
          unrealizedPL = entryPrice.minus(currentPrice).times(quantity.abs());
        }
        
        positions.push({
          id: cycle.id,
          asset: cycle.asset,
          quantity: quantity.toString(),
          entry_price: entryPrice.toString(),
          current_price: currentPrice.toString(),
          current_value: currentValue.toString(),
          unrealized_pl: unrealizedPL.toString(),
          average_cost: this.calculateAverageCost(cycle.asset)
        });
      });
    }
    
    return positions;
  }
  
  // Get trade history (closed cycles)
  getTradeHistory() {
    const result = this.db.exec(`
      SELECT * FROM trade_cycles 
      WHERE status = 'closed' 
      ORDER BY exit_date DESC
    `);
    
    const trades = [];
    if (result[0]) {
      const columns = result[0].columns;
      result[0].values.forEach(row => {
        const trade = {};
        columns.forEach((col, i) => {
          trade[col] = row[i];
        });
        trades.push(trade);
      });
    }
    
    return trades;
  }
  
  // Start timer for cycle
  startTimer(cycleId) {
    this.db.run(`
      UPDATE trade_cycles SET timer_start = ? WHERE id = ?
    `, [Date.now(), cycleId]);
  }
  
  // Stop timer for cycle
  stopTimer(cycleId) {
    const result = this.db.exec(`
      SELECT timer_start FROM trade_cycles WHERE id = ?
    `, [cycleId]);
    
    if (result[0] && result[0].values[0] && result[0].values[0][0]) {
      const timerStart = result[0].values[0][0];
      const duration = Date.now() - timerStart;
      
      this.db.run(`
        UPDATE trade_cycles SET timer_stop = ?, duration = ? WHERE id = ?
      `, [Date.now(), duration, cycleId]);
      
      return duration;
    }
    
    return 0;
  }
  
  // Format duration to HH:MM:SS
  static formatDuration(ms) {
    const seconds = Math.floor(ms / 1000);
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }
}

module.exports = Ledger;