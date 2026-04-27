// ENVY Backend Server - Complete API Implementation
// Run with: node server.js

import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import axios from 'axios';
import { createClient } from '@supabase/supabase-js';
import { v2 as cloudinary } from 'cloudinary';
import multer from 'multer';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import fs from 'fs';
import WebSocket, { WebSocketServer } from 'ws';
import http from 'http';
import jwt from 'jsonwebtoken';

// Load environment variables
dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Initialize Express
const app = express();
const server = http.createServer(app);
const wss = new WebSocketServer({ server });

// Initialize Supabase
const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE
);

// Initialize Cloudinary
cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET
});

// Configure multer for file uploads
const storage = multer.memoryStorage();
const upload = multer({
    storage: storage,
    limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
    fileFilter: (req, file, cb) => {
        const allowedTypes = /jpeg|jpg|png|gif|svg|webp/;
        const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
        const mimetype = allowedTypes.test(file.mimetype);
        
        if (mimetype && extname) {
            return cb(null, true);
        } else {
            cb(new Error('Only image files are allowed'));
        }
    }
});

// Middleware
app.use(cors({
    origin: ['http://localhost:3000', 'http://localhost:5500', 'http://127.0.0.1:5500', 'https://envy-trading.onrender.com'],
    credentials: true
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve static files from frontend directory
app.use(express.static(path.join(__dirname, '../frontend')));

// Authentication middleware
const authenticateToken = async (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    
    if (!token) {
        return res.status(401).json({ error: 'Access token required' });
    }
    
    try {
        const { data: { user }, error } = await supabase.auth.getUser(token);
        
        if (error || !user) {
            return res.status(403).json({ error: 'Invalid or expired token' });
        }
        
        req.user = user;
        next();
    } catch (error) {
        return res.status(403).json({ error: 'Invalid token' });
    }
};

// Admin middleware
const requireAdmin = async (req, res, next) => {
    if (!req.user) {
        return res.status(401).json({ error: 'Authentication required' });
    }
    
    const { data: profile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', req.user.id)
        .single();
        
    if (!profile || profile.role !== 'admin') {
        return res.status(403).json({ error: 'Admin access required' });
    }
    
    next();
};

// =============================================
// WEBSOCKET CONNECTION FOR LIVE PRICE UPDATES
// =============================================

const clients = new Map();

wss.on('connection', (ws) => {
    const clientId = Date.now().toString();
    clients.set(clientId, { ws, subscriptions: [] });
    
    console.log(`Client ${clientId} connected`);
    
    ws.on('message', async (message) => {
        try {
            const data = JSON.parse(message);
            
            if (data.type === 'subscribe') {
                const client = clients.get(clientId);
                if (client && !client.subscriptions.includes(data.symbol)) {
                    client.subscriptions.push(data.symbol);
                }
            } else if (data.type === 'unsubscribe') {
                const client = clients.get(clientId);
                if (client) {
                    client.subscriptions = client.subscriptions.filter(s => s !== data.symbol);
                }
            }
        } catch (error) {
            console.error('WebSocket message error:', error);
        }
    });
    
    ws.on('close', () => {
        clients.delete(clientId);
        console.log(`Client ${clientId} disconnected`);
    });
});

// Broadcast price updates to subscribed clients
async function broadcastPriceUpdates() {
    const allSymbols = new Set();
    clients.forEach(client => {
        client.subscriptions.forEach(symbol => allSymbols.add(symbol));
    });
    
    if (allSymbols.size === 0) return;
    
    try {
        const symbols = Array.from(allSymbols).join(',');
        const response = await axios.get(`https://api.bybit.com/v5/market/tickers?category=spot&symbol=${symbols}`);
        
        if (response.data.retCode === 0) {
            const tickers = response.data.result.list;
            
            clients.forEach(client => {
                const updates = {};
                tickers.forEach(ticker => {
                    if (client.subscriptions.includes(ticker.symbol)) {
                        updates[ticker.symbol] = {
                            price: parseFloat(ticker.lastPrice),
                            change24h: parseFloat(ticker.price24hPcnt) * 100,
                            high24h: parseFloat(ticker.highPrice24h),
                            low24h: parseFloat(ticker.lowPrice24h),
                            volume24h: parseFloat(ticker.volume24h)
                        };
                    }
                });
                
                if (Object.keys(updates).length > 0) {
                    client.ws.send(JSON.stringify({
                        type: 'price_update',
                        data: updates
                    }));
                }
            });
        }
    } catch (error) {
        console.error('Price broadcast error:', error.message);
    }
}

// Broadcast every 3 seconds
setInterval(broadcastPriceUpdates, 3000);

// =============================================
// BYBIT API ROUTES (Public Price Data)
// =============================================

// Get all available assets from Bybit
app.get('/api/bybit/assets', async (req, res) => {
    try {
        const response = await axios.get('https://api.bybit.com/v5/market/instruments-info?category=spot');
        
        if (response.data.retCode === 0) {
            const assets = response.data.result.list
                .filter(item => item.status === 'Trading')
                .map(item => ({
                    symbol: item.symbol.replace('USDT', ''),
                    name: item.symbol.replace('USDT', ''),
                    baseCoin: item.baseCoin,
                    quoteCoin: item.quoteCoin
                }))
                .filter((value, index, self) => 
                    index === self.findIndex(t => t.symbol === value.symbol)
                );
                
            res.json(assets);
        } else {
            res.status(500).json({ error: 'Failed to fetch assets' });
        }
    } catch (error) {
        console.error('Error fetching assets:', error.message);
        res.status(500).json({ error: 'Failed to fetch assets' });
    }
});

// Get current price for a symbol
app.get('/api/bybit/price', async (req, res) => {
    const { symbol } = req.query;
    
    if (!symbol) {
        return res.status(400).json({ error: 'Symbol required' });
    }
    
    try {
        const bybitSymbol = symbol.includes('USDT') ? symbol : `${symbol}USDT`;
        const response = await axios.get(`https://api.bybit.com/v5/market/tickers?category=spot&symbol=${bybitSymbol}`);
        
        if (response.data.retCode === 0) {
            const ticker = response.data.result.list[0];
            res.json({
                symbol: symbol,
                price: parseFloat(ticker.lastPrice),
                change24h: parseFloat(ticker.price24hPcnt) * 100,
                high24h: parseFloat(ticker.highPrice24h),
                low24h: parseFloat(ticker.lowPrice24h)
            });
        } else {
            res.status(500).json({ error: 'Failed to fetch price' });
        }
    } catch (error) {
        console.error('Error fetching price:', error.message);
        res.status(500).json({ error: 'Failed to fetch price' });
    }
});

// Get multiple prices
app.get('/api/bybit/prices', async (req, res) => {
    const { symbols } = req.query;
    
    if (!symbols) {
        return res.status(400).json({ error: 'Symbols required' });
    }
    
    try {
        const symbolList = symbols.split(',');
        const bybitSymbols = symbolList.map(s => s.includes('USDT') ? s : `${s}USDT`).join(',');
        const response = await axios.get(`https://api.bybit.com/v5/market/tickers?category=spot&symbol=${bybitSymbols}`);
        
        if (response.data.retCode === 0) {
            const prices = {};
            response.data.result.list.forEach(ticker => {
                const symbol = ticker.symbol.replace('USDT', '');
                prices[symbol] = {
                    price: parseFloat(ticker.lastPrice),
                    change24h: parseFloat(ticker.price24hPcnt) * 100,
                    high24h: parseFloat(ticker.highPrice24h),
                    low24h: parseFloat(ticker.lowPrice24h)
                };
            });
            res.json({ prices });
        } else {
            res.status(500).json({ error: 'Failed to fetch prices' });
        }
    } catch (error) {
        console.error('Error fetching prices:', error.message);
        res.status(500).json({ error: 'Failed to fetch prices' });
    }
});

// Get historical kline data
app.get('/api/bybit/klines', async (req, res) => {
    const { symbol, interval = '60', limit = 100 } = req.query;
    
    if (!symbol) {
        return res.status(400).json({ error: 'Symbol required' });
    }
    
    try {
        const bybitSymbol = symbol.includes('USDT') ? symbol : `${symbol}USDT`;
        const response = await axios.get(
            `https://api.bybit.com/v5/market/kline?category=spot&symbol=${bybitSymbol}&interval=${interval}&limit=${limit}`
        );
        
        if (response.data.retCode === 0) {
            const klines = response.data.result.list.map(k => ({
                time: parseInt(k[0]),
                open: parseFloat(k[1]),
                high: parseFloat(k[2]),
                low: parseFloat(k[3]),
                close: parseFloat(k[4]),
                volume: parseFloat(k[5])
            })).reverse();
            
            res.json({ klines });
        } else {
            res.status(500).json({ error: 'Failed to fetch klines' });
        }
    } catch (error) {
        console.error('Error fetching klines:', error.message);
        res.status(500).json({ error: 'Failed to fetch klines' });
    }
});

// =============================================
// COINGECKO API ROUTES (Asset Logos)
// =============================================

// Get coin logo URL
app.get('/api/coingecko/logo/:symbol', async (req, res) => {
    const { symbol } = req.params;
    
    try {
        // Use CoinGecko's simple API to get coin data
        const response = await axios.get(`https://api.coingecko.com/api/v3/coins/${symbol.toLowerCase()}`);
        
        if (response.data) {
            res.json({
                symbol: symbol.toUpperCase(),
                logo: response.data.image?.small || response.data.image?.thumb
            });
        } else {
            res.status(404).json({ error: 'Coin not found' });
        }
    } catch (error) {
        // Fallback to known logo URLs
        const knownLogos = {
            'BTC': 'https://assets.coingecko.com/coins/images/1/small/bitcoin.png',
            'ETH': 'https://assets.coingecko.com/coins/images/279/small/ethereum.png',
            'SOL': 'https://assets.coingecko.com/coins/images/4128/small/solana.png',
            'BNB': 'https://assets.coingecko.com/coins/images/825/small/bnb-icon2_2x.png',
            'XRP': 'https://assets.coingecko.com/coins/images/44/small/xrp-symbol-white-128.png',
            'ADA': 'https://assets.coingecko.com/coins/images/975/small/cardano.png',
            'DOGE': 'https://assets.coingecko.com/coins/images/5/small/dogecoin.png',
            'MATIC': 'https://assets.coingecko.com/coins/images/4713/small/polygon.png',
            'DOT': 'https://assets.coingecko.com/coins/images/12171/small/polkadot.png',
            'AVAX': 'https://assets.coingecko.com/coins/images/12559/small/Avalanche_Circle_RedWhite_Trans.png'
        };
        
        if (knownLogos[symbol.toUpperCase()]) {
            res.json({
                symbol: symbol.toUpperCase(),
                logo: knownLogos[symbol.toUpperCase()]
            });
        } else {
            res.status(404).json({ error: 'Logo not found' });
        }
    }
});

// =============================================
// CLOUDINARY UPLOAD ROUTES
// =============================================

// Upload avatar
app.post('/api/upload/avatar', authenticateToken, upload.single('avatar'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: 'No file uploaded' });
        }
        
        const b64 = Buffer.from(req.file.buffer).toString('base64');
        const dataURI = `data:${req.file.mimetype};base64,${b64}`;
        
        const result = await cloudinary.uploader.upload(dataURI, {
            folder: 'envy/avatars',
            public_id: `${req.user.id}_${Date.now()}`,
            transformation: [
                { width: 200, height: 200, crop: 'fill', gravity: 'face' }
            ]
        });
        
        // Update user profile with avatar URL
        const { error: updateError } = await supabase
            .from('profiles')
            .update({ avatar_url: result.secure_url })
            .eq('id', req.user.id);
            
        if (updateError) throw updateError;
            
        res.json({
            url: result.secure_url,
            message: 'Avatar uploaded successfully'
        });
    } catch (error) {
        console.error('Avatar upload error:', error);
        res.status(500).json({ error: 'Failed to upload avatar' });
    }
});

// Upload site emblem (Admin only)
app.post('/api/upload/emblem', authenticateToken, requireAdmin, upload.single('emblem'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: 'No file uploaded' });
        }
        
        // Convert buffer to base64
        const b64 = Buffer.from(req.file.buffer).toString('base64');
        const dataURI = `data:${req.file.mimetype};base64,${b64}`;
        
        // Upload to Cloudinary
        const result = await cloudinary.uploader.upload(dataURI, {
            folder: 'envy/site',
            public_id: 'site_emblem',
            overwrite: true,
            transformation: [
                { width: 100, height: 100, crop: 'fit' }
            ]
        });
        
        // Update website settings in database
        await supabase
            .from('website_settings')
            .upsert({
                id: 1,
                site_emblem_url: result.secure_url,
                updated_by: req.user.id,
                updated_at: new Date().toISOString()
            });
            
        res.json({
            url: result.secure_url,
            message: 'Emblem uploaded successfully'
        });
    } catch (error) {
        console.error('Emblem upload error:', error);
        res.status(500).json({ error: 'Failed to upload emblem' });
    }
});

// =============================================
// USER & AUTH ROUTES
// =============================================

// Get current user profile
app.get('/api/user/profile', authenticateToken, async (req, res) => {
    try {
        const { data: profile } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', req.user.id)
            .single();
            
        const { data: settings } = await supabase
            .from('user_settings')
            .select('*')
            .eq('user_id', req.user.id)
            .single();
            
        res.json({
            profile,
            settings
        });
    } catch (error) {
        console.error('Error fetching profile:', error);
        res.status(500).json({ error: 'Failed to fetch profile' });
    }
});

// Update user profile
app.put('/api/user/profile', authenticateToken, async (req, res) => {
    try {
        const { full_name, profile_visibility } = req.body;
        
        const { error } = await supabase
            .from('profiles')
            .update({ full_name })
            .eq('id', req.user.id);
            
        if (error) throw error;
        
        if (profile_visibility) {
            await supabase
                .from('user_settings')
                .update({ profile_visibility })
                .eq('user_id', req.user.id);
        }
        
        res.json({ message: 'Profile updated successfully' });
    } catch (error) {
        console.error('Error updating profile:', error);
        res.status(500).json({ error: 'Failed to update profile' });
    }
});

// =============================================
// TRADES ROUTES
// =============================================

// Get user trades with pagination
app.get('/api/trades', authenticateToken, async (req, res) => {
    try {
        const { page = 1, limit = 25, status, asset } = req.query;
        const from = (page - 1) * limit;
        const to = from + limit - 1;
        
        let query = supabase
            .from('trades')
            .select('*', { count: 'exact' })
            .eq('user_id', req.user.id)
            .order('created_at', { ascending: false });
            
        if (status && status !== 'all') {
            query = query.eq('status', status);
        }
        
        if (asset && asset !== 'all') {
            query = query.eq('asset_symbol', asset);
        }
        
        const { data, count, error } = await query.range(from, to);
        
        if (error) throw error;
        
        res.json({
            trades: data,
            total: count,
            page: parseInt(page),
            totalPages: Math.ceil(count / limit)
        });
    } catch (error) {
        console.error('Error fetching trades:', error);
        res.status(500).json({ error: 'Failed to fetch trades' });
    }
});

// Create trade
app.post('/api/trades', authenticateToken, async (req, res) => {
    try {
        const trade = {
            ...req.body,
            user_id: req.user.id
        };
        
        const { data, error } = await supabase
            .from('trades')
            .insert([trade])
            .select()
            .single();
            
        if (error) throw error;
        
        // Update holdings
        await updateHoldings(req.user.id, data);
        
        res.json(data);
    } catch (error) {
        console.error('Error creating trade:', error);
        res.status(500).json({ error: 'Failed to create trade' });
    }
});

// Update trade
app.put('/api/trades/:id', authenticateToken, async (req, res) => {
    try {
        const { id } = req.params;
        
        // Verify ownership
        const { data: existing } = await supabase
            .from('trades')
            .select('user_id')
            .eq('id', id)
            .single();
            
        if (!existing || existing.user_id !== req.user.id) {
            return res.status(403).json({ error: 'Unauthorized' });
        }
        
        const { data, error } = await supabase
            .from('trades')
            .update(req.body)
            .eq('id', id)
            .select()
            .single();
            
        if (error) throw error;
        
        res.json(data);
    } catch (error) {
        console.error('Error updating trade:', error);
        res.status(500).json({ error: 'Failed to update trade' });
    }
});

// Delete trade
app.delete('/api/trades/:id', authenticateToken, async (req, res) => {
    try {
        const { id } = req.params;
        
        // Verify ownership
        const { data: existing } = await supabase
            .from('trades')
            .select('user_id')
            .eq('id', id)
            .single();
            
        if (!existing || existing.user_id !== req.user.id) {
            return res.status(403).json({ error: 'Unauthorized' });
        }
        
        const { error } = await supabase
            .from('trades')
            .delete()
            .eq('id', id);
            
        if (error) throw error;
        
        res.json({ message: 'Trade deleted successfully' });
    } catch (error) {
        console.error('Error deleting trade:', error);
        res.status(500).json({ error: 'Failed to delete trade' });
    }
});

// =============================================
// HOLDINGS ROUTES
// =============================================

// Get user holdings
app.get('/api/holdings', authenticateToken, async (req, res) => {
    try {
        const { data, error } = await supabase
            .from('holdings')
            .select('*')
            .eq('user_id', req.user.id);
            
        if (error) throw error;
        
        res.json(data);
    } catch (error) {
        console.error('Error fetching holdings:', error);
        res.status(500).json({ error: 'Failed to fetch holdings' });
    }
});

// Helper function to update holdings
async function updateHoldings(userId, trade) {
    const { data: holding } = await supabase
        .from('holdings')
        .select('*')
        .eq('user_id', userId)
        .eq('asset_symbol', trade.asset_symbol)
        .single();
        
    if (holding) {
        let newAmount = holding.total_amount;
        let newCost = holding.average_cost * holding.total_amount;
        
        if (trade.trade_type === 'buy') {
            newAmount += trade.amount;
            newCost += trade.amount * trade.entry_price;
        } else {
            newAmount -= trade.amount;
            newCost -= trade.amount * holding.average_cost;
        }
        
        if (newAmount <= 0.00000001) {
            await supabase
                .from('holdings')
                .delete()
                .eq('id', holding.id);
        } else {
            const newAvgCost = newCost / newAmount;
            await supabase
                .from('holdings')
                .update({
                    total_amount: newAmount,
                    average_cost: newAvgCost
                })
                .eq('id', holding.id);
        }
    } else if (trade.trade_type === 'buy') {
        await supabase
            .from('holdings')
            .insert([{
                user_id: userId,
                asset_symbol: trade.asset_symbol,
                asset_logo: trade.asset_logo,
                total_amount: trade.amount,
                average_cost: trade.entry_price
            }]);
    }
}

// =============================================
// PLANNER ROUTES
// =============================================

// Save analysis
app.post('/api/planner/analysis', authenticateToken, async (req, res) => {
    try {
        const analysis = {
            ...req.body,
            user_id: req.user.id
        };
        
        const { data, error } = await supabase
            .from('planner_analyses')
            .insert([analysis])
            .select()
            .single();
            
        if (error) throw error;
        
        res.json(data);
    } catch (error) {
        console.error('Error saving analysis:', error);
        res.status(500).json({ error: 'Failed to save analysis' });
    }
});

// Get saved analyses
app.get('/api/planner/analyses', authenticateToken, async (req, res) => {
    try {
        const { data, error } = await supabase
            .from('planner_analyses')
            .select('*')
            .eq('user_id', req.user.id)
            .order('created_at', { ascending: false })
            .limit(20);
            
        if (error) throw error;
        
        res.json(data);
    } catch (error) {
        console.error('Error fetching analyses:', error);
        res.status(500).json({ error: 'Failed to fetch analyses' });
    }
});

// =============================================
// SETTINGS ROUTES
// =============================================

// Get user settings
app.get('/api/settings', authenticateToken, async (req, res) => {
    try {
        const { data, error } = await supabase
            .from('user_settings')
            .select('*')
            .eq('user_id', req.user.id)
            .single();
            
        if (error && error.code !== 'PGRST116') throw error;
        
        res.json(data || {});
    } catch (error) {
        console.error('Error fetching settings:', error);
        res.status(500).json({ error: 'Failed to fetch settings' });
    }
});

// Update user settings
app.put('/api/settings', authenticateToken, async (req, res) => {
    try {
        const settings = {
            ...req.body,
            user_id: req.user.id,
            updated_at: new Date().toISOString()
        };
        
        const { data, error } = await supabase
            .from('user_settings')
            .upsert(settings, { onConflict: 'user_id' })
            .select()
            .single();
            
        if (error) {
            console.error('Settings update error:', error);
            return res.status(500).json({ error: error.message });
        }
        
        res.json(data);
    } catch (error) {
        console.error('Error updating settings:', error);
        res.status(500).json({ error: 'Failed to update settings' });
    }
});

// =============================================
// ADMIN ROUTES
// =============================================

// Get all users (Admin only)
app.get('/api/admin/users', authenticateToken, requireAdmin, async (req, res) => {
    try {
        const { page = 1, limit = 25 } = req.query;
        const from = (page - 1) * limit;
        const to = from + limit - 1;
        
        const { data, count, error } = await supabase
            .from('profiles')
            .select('*', { count: 'exact' })
            .order('created_at', { ascending: false })
            .range(from, to);
            
        if (error) throw error;
        
        res.json({
            users: data,
            total: count,
            page: parseInt(page),
            totalPages: Math.ceil(count / limit)
        });
    } catch (error) {
        console.error('Error fetching users:', error);
        res.status(500).json({ error: 'Failed to fetch users' });
    }
});

// Update user role (Admin only)
app.put('/api/admin/users/:id/role', authenticateToken, requireAdmin, async (req, res) => {
    try {
        const { id } = req.params;
        const { role } = req.body;
        
        const emblem = role === 'admin' ? 'crown' : 'neutral';
        
        const { error } = await supabase
            .from('profiles')
            .update({ role, emblem_type: emblem })
            .eq('id', id);
            
        if (error) throw error;
        
        // Log action
        await supabase
            .from('admin_logs')
            .insert([{
                admin_id: req.user.id,
                action_type: role === 'admin' ? 'user_upgrade' : 'user_downgrade',
                target_user_id: id,
                details: `Role changed to ${role}`
            }]);
            
        res.json({ message: 'User role updated successfully' });
    } catch (error) {
        console.error('Error updating user role:', error);
        res.status(500).json({ error: 'Failed to update user role' });
    }
});

// Get all trades (Admin only)
app.get('/api/admin/trades', authenticateToken, requireAdmin, async (req, res) => {
    try {
        const { page = 1, limit = 25, userId } = req.query;
        const from = (page - 1) * limit;
        const to = from + limit - 1;
        
        let query = supabase
            .from('trades')
            .select(`
                *,
                user:user_id (email, full_name)
            `, { count: 'exact' })
            .order('created_at', { ascending: false });
            
        if (userId && userId !== 'all') {
            query = query.eq('user_id', userId);
        }
        
        const { data, count, error } = await query.range(from, to);
        
        if (error) throw error;
        
        res.json({
            trades: data,
            total: count,
            page: parseInt(page),
            totalPages: Math.ceil(count / limit)
        });
    } catch (error) {
        console.error('Error fetching trades:', error);
        res.status(500).json({ error: 'Failed to fetch trades' });
    }
});

// Delete any trade (Admin only)
app.delete('/api/admin/trades/:id', authenticateToken, requireAdmin, async (req, res) => {
    try {
        const { id } = req.params;
        
        const { error } = await supabase
            .from('trades')
            .delete()
            .eq('id', id);
            
        if (error) throw error;
        
        // Log action
        await supabase
            .from('admin_logs')
            .insert([{
                admin_id: req.user.id,
                action_type: 'trade_delete',
                details: `Deleted trade ${id}`
            }]);
            
        res.json({ message: 'Trade deleted successfully' });
    } catch (error) {
        console.error('Error deleting trade:', error);
        res.status(500).json({ error: 'Failed to delete trade' });
    }
});

// Get admin logs
app.get('/api/admin/logs', authenticateToken, requireAdmin, async (req, res) => {
    try {
        const { page = 1, limit = 25, actionType } = req.query;
        const from = (page - 1) * limit;
        const to = from + limit - 1;
        
        let query = supabase
            .from('admin_logs')
            .select(`
                *,
                admin:admin_id (full_name, email),
                target:target_user_id (full_name, email)
            `, { count: 'exact' })
            .order('created_at', { ascending: false });
            
        if (actionType && actionType !== 'all') {
            query = query.eq('action_type', actionType);
        }
        
        const { data, count, error } = await query.range(from, to);
        
        if (error) throw error;
        
        res.json({
            logs: data,
            total: count,
            page: parseInt(page),
            totalPages: Math.ceil(count / limit)
        });
    } catch (error) {
        console.error('Error fetching logs:', error);
        res.status(500).json({ error: 'Failed to fetch logs' });
    }
});

// Get website settings
app.get('/api/admin/settings', authenticateToken, requireAdmin, async (req, res) => {
    try {
        const { data, error } = await supabase
            .from('website_settings')
            .select('*')
            .single();
            
        if (error && error.code !== 'PGRST116') throw error;
        
        res.json(data || {});
    } catch (error) {
        console.error('Error fetching settings:', error);
        res.status(500).json({ error: 'Failed to fetch settings' });
    }
});

// Update website settings
app.put('/api/admin/settings', authenticateToken, requireAdmin, async (req, res) => {
    try {
        const settings = {
            ...req.body,
            id: 1,
            updated_by: req.user.id,
            updated_at: new Date().toISOString()
        };
        
        const { data, error } = await supabase
            .from('website_settings')
            .upsert(settings)
            .select()
            .single();
            
        if (error) throw error;
        
        // Log action
        await supabase
            .from('admin_logs')
            .insert([{
                admin_id: req.user.id,
                action_type: 'settings_change',
                details: 'Updated website settings'
            }]);
            
        res.json(data);
    } catch (error) {
        console.error('Error updating settings:', error);
        res.status(500).json({ error: 'Failed to update settings' });
    }
});

// Get overview stats
app.get('/api/admin/stats', authenticateToken, requireAdmin, async (req, res) => {
    try {
        const [userCount, adminCount, tradeCount, activeCount] = await Promise.all([
            supabase.from('profiles').select('*', { count: 'exact', head: true }),
            supabase.from('profiles').select('*', { count: 'exact', head: true }).eq('role', 'admin'),
            supabase.from('trades').select('*', { count: 'exact', head: true }),
            supabase.from('profiles').select('*', { count: 'exact', head: true })
                .gte('updated_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
        ]);
        
        res.json({
            totalUsers: userCount.count,
            totalAdmins: adminCount.count,
            totalTrades: tradeCount.count,
            activeToday: activeCount.count
        });
    } catch (error) {
        console.error('Error fetching stats:', error);
        res.status(500).json({ error: 'Failed to fetch stats' });
    }
});

// =============================================
// HEALTH CHECK
// =============================================

app.get('/api/health', (req, res) => {
    res.json({
        status: 'healthy',
        timestamp: new Date().toISOString(),
        uptime: process.uptime()
    });
});

// =============================================
// SPA FALLBACK - Serve index.html for all other routes
// =============================================

app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, '../frontend/index.html'));
});

// =============================================
// START SERVER
// =============================================

const PORT = process.env.PORT || 3000;

server.listen(PORT, () => {
    console.log(`\x1b[36m%s\x1b[0m`, '╔════════════════════════════════════════════╗');
    console.log(`\x1b[36m%s\x1b[0m`, '║        ENVY Server Running                   ║');
    console.log(`\x1b[36m%s\x1b[0m`, '╚════════════════════════════════════════════╝');
    console.log(`\x1b[32m%s\x1b[0m`, `✅ Server: http://localhost:${PORT}`);
    console.log(`\x1b[32m%s\x1b[0m`, `✅ WebSocket: ws://localhost:${PORT}`);
    console.log(`\x1b[32m%s\x1b[0m`, `✅ Environment: ${process.env.NODE_ENV || 'development'}`);
    console.log('');
});

export default app;