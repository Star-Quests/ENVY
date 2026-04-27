// ENVY Connection Monitor - Real-time Connection Status

import { supabase, db } from './supabase-client.js';
import { notificationSystem } from './notifications.js';

class ConnectionMonitor {
    constructor() {
        this.status = 'connecting'; // 'connected', 'connecting', 'disconnected'
        this.lastPing = Date.now();
        this.pingInterval = null;
        this.listeners = [];
        this.reconnectAttempts = 0;
        this.maxReconnectAttempts = 5;
        
        this.initialize();
    }
    
    initialize() {
        this.startMonitoring();
        this.setupSupabaseListener();
        this.updateConnectionBar();
    }
    
    startMonitoring() {
        // Ping every 10 seconds
        this.pingInterval = setInterval(() => {
            this.checkConnection();
        }, 10000);
        
        // Initial check
        this.checkConnection();
    }
    
    async checkConnection() {
        const startTime = Date.now();
        
        try {
            // Try to fetch a simple query
            const { error } = await supabase
                .from('connection_status')
                .select('status')
                .single();
                
            const latency = Date.now() - startTime;
            
            if (!error) {
                this.setStatus('connected', latency);
                this.reconnectAttempts = 0;
            } else {
                this.setStatus('disconnected');
            }
        } catch (error) {
            this.setStatus('disconnected');
        }
        
        this.lastPing = Date.now();
    }
    
    setStatus(status, latency = null) {
        const previousStatus = this.status;
        this.status = status;
        
        // Update database
        if (status !== previousStatus) {
            db.updateConnectionStatus(status).catch(console.error);
        }
        
        // Update UI
        this.updateConnectionBar(latency);
        
        // Notify listeners
        this.listeners.forEach(callback => callback(status, latency));
        
        // Show notification on status change
        if (previousStatus !== status) {
            if (status === 'connected') {
            } else if (status === 'disconnected') {
                this.attemptReconnect();
            }
        }
    }
    
    attemptReconnect() {
        if (this.reconnectAttempts >= this.maxReconnectAttempts) {
            console.error('Max reconnection attempts reached');
            return;
        }
        
        this.reconnectAttempts++;
        this.setStatus('connecting');
        
        setTimeout(() => {
            this.checkConnection();
        }, Math.min(1000 * Math.pow(2, this.reconnectAttempts), 30000));
    }
    
    updateConnectionBar(latency = null) {
        const bar = document.getElementById('connectionBar');
        const indicator = document.getElementById('connectionIndicator');
        const dot = document.querySelector('.connection-dot');
        const text = document.querySelector('.connection-text');
        
        if (!bar || !indicator) return;
        
        // Remove existing status classes
        dot?.classList.remove('status-connected', 'status-connecting', 'status-disconnected');
        
        switch (this.status) {
            case 'connected':
                dot?.classList.add('status-connected');
                if (text) {
                    text.textContent = 'Connected';
                }
                bar.style.borderBottomColor = 'var(--success)';
                break;
                
            case 'connecting':
                dot?.classList.add('status-connecting');
                if (text) text.textContent = 'Connecting...';
                bar.style.borderBottomColor = 'var(--warning)';
                break;
                
            case 'disconnected':
                dot?.classList.add('status-disconnected');
                if (text) text.textContent = 'Disconnected';
                bar.style.borderBottomColor = 'var(--error)';
                break;
        }
    }
    
    setupSupabaseListener() {
        // Listen for connection status changes in database
        realtime.subscribeToConnectionStatus((payload) => {
            if (payload.new && payload.new.status !== this.status) {
                this.status = payload.new.status;
                this.updateConnectionBar();
            }
        });
    }
    
    onStatusChange(callback) {
        this.listeners.push(callback);
    }
    
    getStatus() {
        return this.status;
    }
    
    isConnected() {
        return this.status === 'connected';
    }
    
    stop() {
        if (this.pingInterval) {
            clearInterval(this.pingInterval);
            this.pingInterval = null;
        }
    }
}

// Create and export singleton
export const connectionMonitor = new ConnectionMonitor();

// Import realtime for subscription
import { realtime } from './supabase-client.js';