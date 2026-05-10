// ENVY Supabase Client - Complete

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0';

// Supabase configuration
const SUPABASE_URL = 'https://hqeptxdwcetfygftdbdn.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhxZXB0eGR3Y2V0ZnlnZnRkYmRuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzYxODM1NjYsImV4cCI6MjA5MTc1OTU2Nn0.YdWXnPznILFD7oXBU8SZza2XIv1Gsdo-Iu_0wsuZA-U';

// Create Supabase client
export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
        storage: window.localStorage
    }
});

// Auth helper functions
export const auth = {
    async signUp(email, password, fullName) {
        const { data, error } = await supabase.auth.signUp({
            email,
            password,
            options: {
                data: {
                    full_name: fullName
                }
            }
        });
        
        return { data, error };
    },
    
    async signIn(email, password) {
        const { data, error } = await supabase.auth.signInWithPassword({
            email,
            password
        });
        
        return { data, error };
    },
    
    async signOut() {
        const { error } = await supabase.auth.signOut();
        return { error };
    },
    
    async getSession() {
        const { data: { session }, error } = await supabase.auth.getSession();
        return { session, error };
    },
    
    async getUser() {
        const { data: { user }, error } = await supabase.auth.getUser();
        return { user, error };
    },
    
    async resetPassword(email) {
        const { data, error } = await supabase.auth.resetPasswordForEmail(email);
        return { data, error };
    },
    
    async updatePassword(newPassword) {
        const { data, error } = await supabase.auth.updateUser({
            password: newPassword
        });
        return { data, error };
    },
    
    onAuthStateChange(callback) {
        return supabase.auth.onAuthStateChange(callback);
    }
};

// Database helper functions
export const db = {
    // Profiles
    async getProfile(userId) {
        const { data, error } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', userId)
            .single();
        return { data, error };
    },
    
    async updateProfile(userId, updates) {
        const { data, error } = await supabase
            .from('profiles')
            .update(updates)
            .eq('id', userId);
        return { data, error };
    },
    
    // Settings
    async getSettings(userId) {
        const { data, error } = await supabase
            .from('user_settings')
            .select('*')
            .eq('user_id', userId)
            .single();
        return { data, error };
    },
    
    async updateSettings(userId, settings) {
        const { data, error } = await supabase
            .from('user_settings')
            .upsert({
                user_id: userId,
                ...settings,
                updated_at: new Date().toISOString()
            });
        return { data, error };
    },
    
    // Trades
    async getTrades(userId, options = {}) {
        let query = supabase
            .from('trades')
            .select('*', { count: 'exact' })
            .eq('user_id', userId)
            .order('created_at', { ascending: false });
            
        if (options.status) {
            query = query.eq('status', options.status);
        }
        
        if (options.asset) {
            query = query.eq('asset_symbol', options.asset);
        }
        
        if (options.limit) {
            query = query.limit(options.limit);
        }
        
        if (options.offset) {
            query = query.range(options.offset, options.offset + (options.limit || 25) - 1);
        }
        
        const { data, count, error } = await query;
        return { data, count, error };
    },
    
    async createTrade(trade) {
        const { data, error } = await supabase
            .from('trades')
            .insert([trade])
            .select()
            .single();
        return { data, error };
    },
    
    async updateTrade(tradeId, updates) {
        const { data, error } = await supabase
            .from('trades')
            .update(updates)
            .eq('id', tradeId)
            .select()
            .single();
        return { data, error };
    },
    
    async deleteTrade(tradeId) {
        const { error } = await supabase
            .from('trades')
            .delete()
            .eq('id', tradeId);
        return { error };
    },
    
    // Holdings
    async getHoldings(userId) {
        const { data, error } = await supabase
            .from('holdings')
            .select('*')
            .eq('user_id', userId);
        return { data, error };
    },
    
    // Planner Analyses
    async saveAnalysis(analysis) {
        const { data, error } = await supabase
            .from('planner_analyses')
            .insert([analysis])
            .select()
            .single();
        return { data, error };
    },
    
    async getAnalyses(userId, limit = 20) {
        const { data, error } = await supabase
            .from('planner_analyses')
            .select('*')
            .eq('user_id', userId)
            .order('created_at', { ascending: false })
            .limit(limit);
        return { data, error };
    },
    
    // Admin
    async isAdmin(userId) {
        const { data, error } = await supabase
            .from('profiles')
            .select('role')
            .eq('id', userId)
            .single();
        return { isAdmin: data?.role === 'admin', error };
    },
    
    // Website Settings
    async getWebsiteSettings() {
        const { data, error } = await supabase
            .from('website_settings')
            .select('*')
            .single();
        return { data, error };
    },
    
    // Connection Status
    async updateConnectionStatus(status) {
        const { error } = await supabase
            .from('connection_status')
            .upsert({
                id: 1,
                status,
                last_ping: new Date().toISOString()
            });
        return { error };
    }
};

// Realtime subscriptions
export const realtime = {
    subscribeToTrades(userId, callback) {
        return supabase
            .channel('trades_channel')
            .on(
                'postgres_changes',
                {
                    event: '*',
                    schema: 'public',
                    table: 'trades',
                    filter: `user_id=eq.${userId}`
                },
                callback
            )
            .subscribe();
    },
    
    subscribeToHoldings(userId, callback) {
        return supabase
            .channel('holdings_channel')
            .on(
                'postgres_changes',
                {
                    event: '*',
                    schema: 'public',
                    table: 'holdings',
                    filter: `user_id=eq.${userId}`
                },
                callback
            )
            .subscribe();
    },
    
    subscribeToConnectionStatus(callback) {
        return supabase
            .channel('connection_channel')
            .on(
                'postgres_changes',
                {
                    event: 'UPDATE',
                    schema: 'public',
                    table: 'connection_status'
                },
                callback
            )
            .subscribe();
    }
};

// Storage helpers
export const storage = {
    async uploadAvatar(userId, file) {
        const fileExt = file.name.split('.').pop();
        const fileName = `${userId}_${Date.now()}.${fileExt}`;
        
        const { data, error } = await supabase.storage
            .from('avatars')
            .upload(fileName, file, {
                cacheControl: '3600',
                upsert: true
            });
            
        if (error) return { data: null, error };
        
        const { data: { publicUrl } } = supabase.storage
            .from('avatars')
            .getPublicUrl(fileName);
            
        return { data: publicUrl, error: null };
    },
    
    getAvatarUrl(path) {
        if (!path) return null;
        
        const { data: { publicUrl } } = supabase.storage
            .from('avatars')
            .getPublicUrl(path);
            
        return publicUrl;
    }
};

export default supabase;