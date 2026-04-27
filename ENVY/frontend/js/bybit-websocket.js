/**
 * ENVY Bybit WebSocket Service
 * True real-time price updates via WebSocket
 */

class BybitWebSocket {
    constructor() {
        this.ws = null;
        this.subscribers = new Map();
        this.isConnected = false;
        this.reconnectAttempts = 0;
        this.maxReconnectAttempts = 10;
        this.pingInterval = null;
        this.connectionListeners = [];
        this.priceCache = new Map();
    }

    connect() {
        if (this.ws && this.ws.readyState === WebSocket.OPEN) {
            return Promise.resolve();
        }

        return new Promise((resolve, reject) => {
            try {
                const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
this.ws = new WebSocket(`${wsProtocol}//${window.location.host}/ws/bybit`);
                
                this.ws.onopen = () => {
                    console.log('Bybit WebSocket connected');
                    this.isConnected = true;
                    this.reconnectAttempts = 0;
                    this.startPing();
                    this.resubscribeAll();
                    this.notifyConnectionListeners(true);
                    resolve();
                };

                this.ws.onmessage = (event) => this.handleMessage(event.data);
                this.ws.onerror = (error) => reject(error);
                
                this.ws.onclose = () => {
                    this.isConnected = false;
                    this.stopPing();
                    this.notifyConnectionListeners(false);
                    this.attemptReconnect();
                };

            } catch (error) {
                reject(error);
            }
        });
    }

    handleMessage(data) {
        try {
            const message = JSON.parse(data);
            
            if (message.topic && message.topic.startsWith('tickers.')) {
                const symbol = message.topic.replace('tickers.', '').replace('USDT', '');
                const ticker = message.data;
                
                const priceData = {
                    symbol: symbol,
                    price: parseFloat(ticker.lastPrice),
                    change24h: parseFloat(ticker.price24hPcnt) * 100,
                    high24h: parseFloat(ticker.highPrice24h),
                    low24h: parseFloat(ticker.lowPrice24h),
                    volume24h: parseFloat(ticker.volume24h),
                    timestamp: Date.now()
                };

                this.priceCache.set(symbol, priceData);

                const subscribers = this.subscribers.get(symbol) || [];
                subscribers.forEach(cb => cb(priceData));

                const wildcard = this.subscribers.get('*') || [];
                wildcard.forEach(cb => cb(symbol, priceData));
            }
        } catch (error) {
            console.error('Parse error:', error);
        }
    }

    subscribe(symbol, callback) {
        const upper = symbol.toUpperCase();
        
        if (!this.subscribers.has(upper)) {
            this.subscribers.set(upper, []);
        }
        
        this.subscribers.get(upper).push(callback);

        if (this.isConnected) {
            this.sendSubscription(upper);
        }

        // Send cached price immediately if available
        const cached = this.priceCache.get(upper);
        if (cached) {
            callback(cached);
        }

        return () => this.unsubscribe(upper, callback);
    }

    unsubscribe(symbol, callback) {
        const subs = this.subscribers.get(symbol);
        if (subs) {
            const index = subs.indexOf(callback);
            if (index > -1) subs.splice(index, 1);
            if (subs.length === 0) {
                this.subscribers.delete(symbol);
                this.sendUnsubscription(symbol);
            }
        }
    }

    sendSubscription(symbol) {
        if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;
        const msg = { op: 'subscribe', args: [`tickers.${symbol}USDT`] };
        this.ws.send(JSON.stringify(msg));
    }

    sendUnsubscription(symbol) {
        if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;
        const msg = { op: 'unsubscribe', args: [`tickers.${symbol}USDT`] };
        this.ws.send(JSON.stringify(msg));
    }

    resubscribeAll() {
        for (let symbol of this.subscribers.keys()) {
            if (symbol !== '*') this.sendSubscription(symbol);
        }
    }

    startPing() {
        this.pingInterval = setInterval(() => {
            if (this.ws && this.ws.readyState === WebSocket.OPEN) {
                this.ws.send(JSON.stringify({ op: 'ping' }));
            }
        }, 20000);
    }

    stopPing() {
        if (this.pingInterval) {
            clearInterval(this.pingInterval);
            this.pingInterval = null;
        }
    }

    attemptReconnect() {
        if (this.reconnectAttempts >= this.maxReconnectAttempts) return;
        this.reconnectAttempts++;
        setTimeout(() => this.connect().catch(() => {}), Math.min(1000 * Math.pow(2, this.reconnectAttempts), 30000));
    }

    onConnectionChange(callback) {
        this.connectionListeners.push(callback);
        callback(this.isConnected);
    }

    notifyConnectionListeners(connected) {
        this.connectionListeners.forEach(cb => cb(connected));
    }

    disconnect() {
        this.stopPing();
        if (this.ws) this.ws.close();
        this.isConnected = false;
    }

    getCachedPrice(symbol) {
        return this.priceCache.get(symbol.toUpperCase());
    }
}

export const bybitWS = new BybitWebSocket();
export default bybitWS;
