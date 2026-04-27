// ENVY Settings JavaScript - Complete User Customization

import { ENVYConfig } from './config.js';
import { supabase } from './supabase-client.js';
import { connectionMonitor } from './connection-monitor.js';
import { notificationSystem } from './notifications.js';
import { getAssetLogoUrl } from './crypto-logos.js';
class SettingsManager {
    constructor() {
        this.user = null;
        this.userProfile = null;
        this.userSettings = null;
        this.assets = [];
        this.favoriteAssets = ['BTC', 'ETH', 'SOL'];
        this.tempSelectedAssets = [];
        this.settingsChanged = false;
        this.confirmCallback = null;
        
        this.initialize();
    }
    
    async initialize() {
        await this.checkAuth();
        await this.loadUserData();
        await this.loadAssets();
        this.setupEventListeners();
        this.updateGreeting();
        this.updateDateTime();
        this.checkAdminStatus();
        this.loadSettingsIntoForm();
        this.renderFavoriteAssets();
    }
    
    async checkAuth() {
        const { data: { user }, error } = await supabase.auth.getUser();
        
        if (error || !user) {
            window.location.href = 'auth.html';
            return;
        }
        
        this.user = user;
        
        const { data: profile } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', user.id)
            .single();
            
        this.userProfile = profile;
        this.updateUserDisplay();
    }
    
    async loadUserData() {
        const { data: settings } = await supabase
            .from('user_settings')
            .select('*')
            .eq('user_id', this.user.id)
            .single();
            
        this.userSettings = settings || {};
        
        if (settings?.favorite_assets) {
            this.favoriteAssets = settings.favorite_assets;
        }
    }
    
    async loadAssets() {
    try {
        const response = await fetch('/api/proxy/bybit-assets');
        const data = await response.json();
        
        if (data.retCode === 0 && data.result.list) {
            const seen = new Set();
            this.assets = data.result.list
                .filter(item => item.status === 'Trading' && item.quoteCoin === 'USDT')
                .map(item => ({
                    symbol: item.baseCoin,
                    name: item.baseCoin,
                    logoUrl: this.getAssetLogo(item.baseCoin)
                }))
                .filter(asset => {
                    if (seen.has(asset.symbol)) return false;
                    seen.add(asset.symbol);
                    return true;
                })
                .sort((a, b) => a.symbol.localeCompare(b.symbol));
        }
        } catch (error) {
            console.error('Error loading assets:', error);
            this.assets = this.getFallbackAssets();
        }
    }
    
    getFallbackAssets() {
        return [
            { symbol: 'BTC', name: 'Bitcoin' },
            { symbol: 'ETH', name: 'Ethereum' },
            { symbol: 'SOL', name: 'Solana' },
            { symbol: 'BNB', name: 'Binance Coin' },
            { symbol: 'XRP', name: 'Ripple' },
            { symbol: 'ADA', name: 'Cardano' },
            { symbol: 'DOGE', name: 'Dogecoin' },
            { symbol: 'MATIC', name: 'Polygon' },
            { symbol: 'DOT', name: 'Polkadot' },
            { symbol: 'AVAX', name: 'Avalanche' }
        ];
    }
    
    loadSettingsIntoForm() {
        const s = this.userSettings;

        // FIRST: Reset all form elements to ensure clean state
    // Appearance
    document.getElementById('themeSelect').value = 'dark';
    document.getElementById('accentColorPicker').value = '#9CA3AF';
    document.getElementById('accentColorValue').textContent = '#9CA3AF';
    document.getElementById('fontStyleSelect').value = 'Inter';
    document.getElementById('fontSizeSlider').value = '16';
    document.getElementById('fontSizeValue').textContent = '16px';
    document.getElementById('glassIntensitySlider').value = '50';
    document.getElementById('glassIntensityValue').textContent = '50%';
    document.getElementById('borderRadiusSlider').value = '8';
    document.getElementById('borderRadiusValue').textContent = '8px';
    document.getElementById('layoutDensitySelect').value = 'comfortable';
    document.getElementById('sidebarCollapsedToggle').checked = false;
    
    // THEN: Override with actual settings if they exist
    if (s.theme) document.getElementById('themeSelect').value = s.theme;
    if (s.accent_color) {
        document.getElementById('accentColorPicker').value = s.accent_color;
        document.getElementById('accentColorValue').textContent = s.accent_color;
    }
        
        // Appearance
        if (s.theme) document.getElementById('themeSelect').value = s.theme;
        if (s.accent_color) {
            document.getElementById('accentColorPicker').value = s.accent_color;
            document.getElementById('accentColorValue').textContent = s.accent_color;
        }
        if (s.font_style) document.getElementById('fontStyleSelect').value = s.font_style;
        if (s.font_size) {
            const fontSize = parseInt(s.font_size) || 16;
            document.getElementById('fontSizeSlider').value = fontSize;
            document.getElementById('fontSizeValue').textContent = fontSize + 'px';
        }
        if (s.glass_intensity) {
            document.getElementById('glassIntensitySlider').value = s.glass_intensity;
            document.getElementById('glassIntensityValue').textContent = s.glass_intensity + '%';
        }
        if (s.border_radius) {
            document.getElementById('borderRadiusSlider').value = s.border_radius;
            document.getElementById('borderRadiusValue').textContent = s.border_radius + 'px';
        }
        if (s.layout_density) document.getElementById('layoutDensitySelect').value = s.layout_density;
        if (s.sidebar_collapsed) {
            document.getElementById('sidebarCollapsedToggle').checked = s.sidebar_collapsed;
        }
        
        // Trading
        if (s.trading_mode) {
            this.setTradingMode(s.trading_mode);
        }
        if (s.default_fee_rate) {
            document.getElementById('defaultFeeInput').value = s.default_fee_rate;
        }
        if (s.holdings_sort) document.getElementById('holdingsSortSelect').value = s.holdings_sort;
        if (s.row_highlighting !== undefined) {
            document.getElementById('rowHighlightingToggle').checked = s.row_highlighting;
        }
        if (s.animation_intensity) {
            document.getElementById('animationIntensitySlider').value = s.animation_intensity;
            document.getElementById('animationIntensityValue').textContent = s.animation_intensity + '%';
        }
        
        // Data & Display
        if (s.default_form_mode) document.getElementById('formModeSelect').value = s.default_form_mode;
        if (s.auto_clear_form !== undefined) {
            document.getElementById('autoClearFormToggle').checked = s.auto_clear_form;
        }
        if (s.decimal_precision) document.getElementById('decimalPrecisionSelect').value = s.decimal_precision;
        if (s.timer_format) document.getElementById('timerFormatSelect').value = s.timer_format;
        if (s.trade_age_color !== undefined) {
            document.getElementById('tradeAgeColorToggle').checked = s.trade_age_color;
        }
        if (s.retracement_unit) document.getElementById('retracementUnitSelect').value = s.retracement_unit;
        if (s.export_format) document.getElementById('exportFormatSelect').value = s.export_format;
        
        // Notifications
        if (s.sound_enabled !== undefined) {
            document.getElementById('soundEnabledToggle').checked = s.sound_enabled;
        }
        
        // Account
        document.getElementById('emailInput').value = this.user.email;
        if (this.userProfile?.full_name) {
            document.getElementById('fullNameInput').value = this.userProfile.full_name;
        }
        if (s.profile_visibility) document.getElementById('profileVisibilitySelect').value = s.profile_visibility;
    }
    
    setTradingMode(mode) {
    document.getElementById('spotModeBtn').classList.toggle('active', mode === 'spot');
    document.getElementById('futuresModeBtn').classList.toggle('active', mode === 'futures');
}

updateTradingModeDisplay() {
    const mode = this.userSettings?.trading_mode || 'spot';
    const spotBtn = document.getElementById('spotModeBtn');
    const futuresBtn = document.getElementById('futuresModeBtn');
    
    if (spotBtn && futuresBtn) {
        spotBtn.classList.toggle('active', mode === 'spot');
        futuresBtn.classList.toggle('active', mode === 'futures');
    }
}
    
    setupEventListeners() {
        // Tab switching
        document.querySelectorAll('.tab-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const tab = btn.dataset.tab;
                this.switchTab(tab);
            });
        });
        
        // Save all settings
        document.getElementById('saveAllSettingsBtn').addEventListener('click', () => {
            this.saveAllSettings();
        });
        
        // Theme select
        document.getElementById('themeSelect').addEventListener('change', () => this.markSettingsChanged());
        
        // Accent color
        document.getElementById('accentColorPicker').addEventListener('input', (e) => {
            document.getElementById('accentColorValue').textContent = e.target.value;
            document.documentElement.style.setProperty('--accent-primary', e.target.value);
            this.markSettingsChanged();
        });
        
        // Color presets
        document.querySelectorAll('.color-preset').forEach(btn => {
            btn.addEventListener('click', () => {
                const color = btn.dataset.color;
                document.getElementById('accentColorPicker').value = color;
                document.getElementById('accentColorValue').textContent = color;
                document.documentElement.style.setProperty('--accent-primary', color);
                this.markSettingsChanged();
            });
        });
        
        // Font style - ENHANCED
        document.getElementById('fontStyleSelect').addEventListener('change', (e) => {
            const font = e.target.value;
            if (font === 'Inter') {
                document.documentElement.style.setProperty('--font-primary', "'Inter', -apple-system, BlinkMacSystemFont, sans-serif", 'important');
            } else if (font === 'system-ui') {
                document.documentElement.style.setProperty('--font-primary', "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif", 'important');
            } else {
                document.documentElement.style.setProperty('--font-primary', `'${font}', -apple-system, BlinkMacSystemFont, sans-serif`, 'important');
            }
            document.body.style.fontFamily = `var(--font-primary)`;
            this.markSettingsChanged();
        });
        
        // Font size slider
        document.getElementById('fontSizeSlider').addEventListener('input', (e) => {
            document.getElementById('fontSizeValue').textContent = e.target.value + 'px';
            document.documentElement.style.fontSize = e.target.value + 'px';
            this.markSettingsChanged();
        });
        
        // Glass intensity
        document.getElementById('glassIntensitySlider').addEventListener('input', (e) => {
            document.getElementById('glassIntensityValue').textContent = e.target.value + '%';
            const intensity = e.target.value / 100;
            document.documentElement.style.setProperty('--glass-bg', `rgba(17, 17, 17, ${0.5 + intensity * 0.3})`);
            document.documentElement.style.setProperty('--glass-blur', `blur(${8 + intensity * 8}px)`);
            this.markSettingsChanged();
        });
        
        // Border radius
        document.getElementById('borderRadiusSlider').addEventListener('input', (e) => {
            document.getElementById('borderRadiusValue').textContent = e.target.value + 'px';
            document.documentElement.style.setProperty('--radius-md', e.target.value + 'px');
            document.documentElement.style.setProperty('--radius-lg', (parseInt(e.target.value) + 4) + 'px');
            document.documentElement.style.setProperty('--radius-xl', (parseInt(e.target.value) + 8) + 'px');
            this.markSettingsChanged();
        });
        
        // Layout density
        document.getElementById('layoutDensitySelect').addEventListener('change', () => this.markSettingsChanged());
        
        // Sidebar toggle - save immediately when toggled
document.getElementById('sidebarCollapsedToggle').addEventListener('change', (e) => {
    const isCollapsed = e.target.checked;
    
    // Apply immediately to current page
    const sidebar = document.getElementById('sidebar');
    if (sidebar) {
        if (isCollapsed) {
            sidebar.classList.add('collapsed');
        } else {
            sidebar.classList.remove('collapsed');
        }
    }
    
    // Save to localStorage immediately
    localStorage.setItem('sidebarCollapsed', isCollapsed);
    
    // Mark settings as changed
    this.markSettingsChanged();
    
    // Save to database immediately (auto-save)
    this.saveSidebarPreference(isCollapsed);
});

        
        // Trading mode
        document.getElementById('spotModeBtn').addEventListener('click', () => {
            this.setTradingMode('spot');
            this.markSettingsChanged();
        });
        
        document.getElementById('futuresModeBtn').addEventListener('click', () => {
            this.setTradingMode('futures');
            this.markSettingsChanged();
        });
        
        // Add favorite asset
        document.getElementById('addFavoriteAssetBtn').addEventListener('click', () => {
            this.showAssetSelectionModal();
        });
        
        // Default fee
        document.getElementById('defaultFeeInput').addEventListener('change', () => this.markSettingsChanged());
        
        // Holdings sort
        document.getElementById('holdingsSortSelect').addEventListener('change', () => this.markSettingsChanged());
        
        // Row highlighting
        document.getElementById('rowHighlightingToggle').addEventListener('change', () => this.markSettingsChanged());
        
        // Animation intensity
        document.getElementById('animationIntensitySlider').addEventListener('input', (e) => {
            document.getElementById('animationIntensityValue').textContent = e.target.value + '%';
            const speed = e.target.value / 100;
            document.documentElement.style.setProperty('--transition-fast', `${150 * speed}ms`);
            document.documentElement.style.setProperty('--transition-base', `${250 * speed}ms`);
            this.markSettingsChanged();
        });
        
        // Form mode
        document.getElementById('formModeSelect').addEventListener('change', () => this.markSettingsChanged());
        
        // Auto clear form
        document.getElementById('autoClearFormToggle').addEventListener('change', () => this.markSettingsChanged());
        
        // Decimal precision
        document.getElementById('decimalPrecisionSelect').addEventListener('change', () => this.markSettingsChanged());
        
        // Timer format
        document.getElementById('timerFormatSelect').addEventListener('change', () => this.markSettingsChanged());
        
        // Trade age color
        document.getElementById('tradeAgeColorToggle').addEventListener('change', () => this.markSettingsChanged());
        
        // Retracement unit
        document.getElementById('retracementUnitSelect').addEventListener('change', () => this.markSettingsChanged());
        
        // Export format
        document.getElementById('exportFormatSelect').addEventListener('change', () => this.markSettingsChanged());
        
        // Sound enabled
        document.getElementById('soundEnabledToggle').addEventListener('change', () => this.markSettingsChanged());
        
        // Test sounds
        document.getElementById('testSuccessSound').addEventListener('click', () => {
            this.playSound('success');
        });
        
        document.getElementById('testErrorSound').addEventListener('click', () => {
            this.playSound('error');
        });
        
        // Upload avatar
        document.getElementById('uploadAvatarBtn').addEventListener('click', () => {
            document.getElementById('avatarFileInput').click();
        });
        
        document.getElementById('avatarFileInput').addEventListener('change', (e) => {
            this.uploadAvatar(e.target.files[0]);
        });
        
        // Full name
        document.getElementById('fullNameInput').addEventListener('change', () => this.markSettingsChanged());
        
        // Profile visibility
        document.getElementById('profileVisibilitySelect').addEventListener('change', () => this.markSettingsChanged());
        
        // Change password
        document.getElementById('passwordChangeForm').addEventListener('submit', (e) => {
            e.preventDefault();
            this.changePassword();
        });
        
        // Reset settings
        document.getElementById('resetSettingsBtn').addEventListener('click', () => {
            this.confirmAction(
                'Reset Settings',
                'Are you sure you want to reset all settings to default? This will not affect your trade history.',
                () => this.resetToDefaults()
            );
        });
        
        // Export all data
        document.getElementById('exportAllDataBtn').addEventListener('click', () => {
            this.exportAllData();
        });
        
        // Delete all trades
        document.getElementById('deleteAllTradesBtn').addEventListener('click', () => {
            this.confirmAction(
                'Delete All Trades',
                'Are you absolutely sure you want to delete ALL your trades? This action cannot be undone.',
                () => this.deleteAllTrades()
            );
        });
        
        // Delete account
        document.getElementById('deleteAccountBtn').addEventListener('click', () => {
            this.confirmAction(
                'Delete Account',
                'Are you absolutely sure you want to delete your account? All your data will be permanently lost.',
                () => this.deleteAccount()
            );
        });
        
        // Modal close buttons
        document.getElementById('closeAssetModal').addEventListener('click', () => {
            document.getElementById('assetSelectionModal').classList.remove('active');
        });
        
        document.getElementById('cancelAssetBtn').addEventListener('click', () => {
            document.getElementById('assetSelectionModal').classList.remove('active');
        });
        
        document.getElementById('confirmAssetBtn').addEventListener('click', () => {
            this.addSelectedAssets();
        });
        
        // Asset search
        document.getElementById('modalAssetSearch').addEventListener('input', (e) => {
            this.filterModalAssets(e.target.value);
        });
        
        // Confirm modal
        document.getElementById('closeConfirmModal').addEventListener('click', () => {
            document.getElementById('confirmModal').classList.remove('active');
        });
        
        document.getElementById('cancelConfirmBtn').addEventListener('click', () => {
            document.getElementById('confirmModal').classList.remove('active');
        });
        
        document.getElementById('confirmActionBtn').addEventListener('click', () => {
            if (this.confirmCallback) {
                this.confirmCallback();
            }
            document.getElementById('confirmModal').classList.remove('active');
        });
        
        // Sidebar
        document.getElementById('sidebarToggle').addEventListener('click', () => {
            document.getElementById('sidebar').classList.toggle('collapsed');
        });
        
        document.getElementById('mobileMenuBtn').addEventListener('click', () => {
            document.getElementById('sidebar').classList.toggle('mobile-open');
        });
        
        // Logout
        document.getElementById('logoutBtn').addEventListener('click', (e) => {
            e.preventDefault();
            this.logout();
        });
    }
    
    switchTab(tabId) {
        document.querySelectorAll('.tab-btn').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.tab === tabId);
        });
        
        document.querySelectorAll('.settings-panel').forEach(panel => {
            panel.classList.toggle('active', panel.id === `${tabId}-panel`);
        });
    }
    
    markSettingsChanged() {
    this.settingsChanged = true;
}

async saveSidebarPreference(collapsed) {
    if (!this.user) return;
    
    const { error } = await supabase
        .from('user_settings')
        .upsert({
            user_id: this.user.id,
            sidebar_collapsed: collapsed,
            updated_at: new Date().toISOString()
        }, { 
            onConflict: 'user_id',
            ignoreDuplicates: false 
        });
        
    if (!error) {
        console.log('Sidebar preference saved:', collapsed);
    }
}
    
    async saveAllSettings() {
        const settings = this.collectSettings();
        
        const { error } = await supabase
            .from('user_settings')
            .upsert({
                user_id: this.user.id,
                ...settings,
                updated_at: new Date().toISOString()
            }, { 
                onConflict: 'user_id',
                ignoreDuplicates: false 
            });
            
        if (error) {
            console.error('Error saving settings:', error);
            notificationSystem.error('Failed to save settings');
            return;
        }
        
        const fullName = document.getElementById('fullNameInput').value;
        if (fullName !== this.userProfile?.full_name) {
            await supabase
                .from('profiles')
                .update({ full_name: fullName })
                .eq('id', this.user.id);
        }
        
        this.settingsChanged = false;
        this.userSettings = { ...this.userSettings, ...settings };
        
        notificationSystem.success('Settings saved successfully');
        
        this.applySettings(settings);
    }
    
    collectSettings() {
        return {
            theme: document.getElementById('themeSelect').value,
            accent_color: document.getElementById('accentColorPicker').value,
            font_style: document.getElementById('fontStyleSelect').value,
            font_size: document.getElementById('fontSizeSlider').value + 'px',
            glass_intensity: parseInt(document.getElementById('glassIntensitySlider').value),
            border_radius: parseInt(document.getElementById('borderRadiusSlider').value),
            layout_density: document.getElementById('layoutDensitySelect').value,
            sidebar_collapsed: document.getElementById('sidebarCollapsedToggle').checked,
            
            trading_mode: document.getElementById('spotModeBtn').classList.contains('active') ? 'spot' : 'futures',
            favorite_assets: this.favoriteAssets,
            default_fee_rate: parseFloat(document.getElementById('defaultFeeInput').value),
            holdings_sort: document.getElementById('holdingsSortSelect').value,
            row_highlighting: document.getElementById('rowHighlightingToggle').checked,
            animation_intensity: parseInt(document.getElementById('animationIntensitySlider').value),
            
            default_form_mode: document.getElementById('formModeSelect').value,
            auto_clear_form: document.getElementById('autoClearFormToggle').checked,
            decimal_precision: parseInt(document.getElementById('decimalPrecisionSelect').value),
            timer_format: document.getElementById('timerFormatSelect').value,
            trade_age_color: document.getElementById('tradeAgeColorToggle').checked,
            retracement_unit: document.getElementById('retracementUnitSelect').value,
            export_format: document.getElementById('exportFormatSelect').value,
            
            sound_enabled: document.getElementById('soundEnabledToggle').checked
        };
    }
    
    applySettings(settings) {
        if (settings.theme) {
            document.body.className = `${settings.theme}-theme`;
        }
        
        if (settings.accent_color) {
            document.documentElement.style.setProperty('--accent-primary', settings.accent_color);
        }
        
        // Apply font
        if (settings.font_style) {
            if (settings.font_style === 'Inter') {
                document.documentElement.style.setProperty('--font-primary', "'Inter', -apple-system, BlinkMacSystemFont, sans-serif", 'important');
            } else if (settings.font_style === 'system-ui') {
                document.documentElement.style.setProperty('--font-primary', "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif", 'important');
            } else {
                document.documentElement.style.setProperty('--font-primary', `'${settings.font_style}', -apple-system, BlinkMacSystemFont, sans-serif`, 'important');
            }
            document.body.style.fontFamily = `var(--font-primary)`;
        }
        
        if (settings.font_size) {
            document.documentElement.style.fontSize = settings.font_size;
        }
        
        if (settings.glass_intensity) {
            const intensity = settings.glass_intensity / 100;
            document.documentElement.style.setProperty('--glass-bg', `rgba(17, 17, 17, ${0.5 + intensity * 0.3})`);
        }
        
        if (settings.animation_intensity) {
            const speed = settings.animation_intensity / 100;
            document.documentElement.style.setProperty('--transition-base', `${250 * speed}ms`);
        }

            // Apply sidebar state
    if (settings.sidebar_collapsed !== undefined) {
        const sidebar = document.getElementById('sidebar');
        if (sidebar) {
            if (settings.sidebar_collapsed) {
                sidebar.classList.add('collapsed');
            } else {
                sidebar.classList.remove('collapsed');
            }
        }
        localStorage.setItem('sidebarCollapsed', settings.sidebar_collapsed);
    }
    }
    
    renderFavoriteAssets() {
        const container = document.getElementById('selectedFavorites');
        container.innerHTML = '';
        
        this.favoriteAssets.forEach(symbol => {
            const asset = this.assets.find(a => a.symbol === symbol) || { symbol, name: symbol };
            const tag = document.createElement('div');
            tag.className = 'favorite-asset-tag';
            
            const logoUrl = this.getAssetLogo(symbol);
            
            tag.innerHTML = `
                <img src="${logoUrl}" alt="${symbol}" onerror="this.src='assets/icons/default-crypto.svg'">
                <span>${symbol}</span>
                <button onclick="settingsManager.removeFavoriteAsset('${symbol}')">&times;</button>
            `;
            
            container.appendChild(tag);
        });
    }
    
    removeFavoriteAsset(symbol) {
        this.favoriteAssets = this.favoriteAssets.filter(s => s !== symbol);
        this.renderFavoriteAssets();
        this.markSettingsChanged();
    }
    
    showAssetSelectionModal() {
        this.tempSelectedAssets = [...this.favoriteAssets];
        
        const listContainer = document.getElementById('modalAssetList');
        listContainer.innerHTML = '';
        
        this.assets.forEach(asset => {
            if (this.favoriteAssets.includes(asset.symbol)) return;
            
            const item = document.createElement('div');
            item.className = 'asset-list-item';
            item.dataset.symbol = asset.symbol;
            
            const logoUrl = this.getAssetLogo(asset.symbol);
            
            item.innerHTML = `
                <img src="${logoUrl}" alt="${asset.symbol}" onerror="this.src='assets/icons/default-crypto.svg'">
                <div>
                    <div style="font-weight: 500;">${asset.name}</div>
                    <div style="font-size: 12px; color: var(--accent-muted);">${asset.symbol}</div>
                </div>
                <input type="checkbox" ${this.tempSelectedAssets.includes(asset.symbol) ? 'checked' : ''}>
            `;
            
            item.addEventListener('click', (e) => {
                if (e.target.type !== 'checkbox') {
                    const checkbox = item.querySelector('input[type="checkbox"]');
                    checkbox.checked = !checkbox.checked;
                }
                
                const checkbox = item.querySelector('input[type="checkbox"]');
                if (checkbox.checked) {
                    if (!this.tempSelectedAssets.includes(asset.symbol)) {
                        this.tempSelectedAssets.push(asset.symbol);
                    }
                } else {
                    this.tempSelectedAssets = this.tempSelectedAssets.filter(s => s !== asset.symbol);
                }
                
                item.classList.toggle('selected', checkbox.checked);
            });
            
            listContainer.appendChild(item);
        });
        
        document.getElementById('assetSelectionModal').classList.add('active');
    }
    
    filterModalAssets(query) {
        const items = document.querySelectorAll('.asset-list-item');
        items.forEach(item => {
            const text = item.textContent.toLowerCase();
            item.style.display = text.includes(query.toLowerCase()) ? 'flex' : 'none';
        });
    }
    
    addSelectedAssets() {
        this.favoriteAssets = [...this.tempSelectedAssets];
        this.renderFavoriteAssets();
        this.markSettingsChanged();
        
        document.getElementById('assetSelectionModal').classList.remove('active');
        notificationSystem.success('Favorite assets updated');
    }
    
    async uploadAvatar(file) {
        if (!file) return;
        
        const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml'];
        if (!allowedTypes.includes(file.type)) {
            notificationSystem.error('Please upload an image file (JPEG, PNG, GIF, WEBP, SVG)');
            return;
        }
        
        if (file.size > 5 * 1024 * 1024) {
            notificationSystem.error('File size must be less than 5MB');
            return;
        }
        
        const formData = new FormData();
        formData.append('avatar', file);
        
        const { data: { session } } = await supabase.auth.getSession();
        
        if (!session) {
            notificationSystem.error('Not authenticated');
            return;
        }
        
        const uploadBtn = document.getElementById('uploadAvatarBtn');
        const originalText = uploadBtn.innerHTML;
        uploadBtn.disabled = true;
        uploadBtn.innerHTML = '<span class="spinner"></span> Uploading...';
        
        try {
            const response = await fetch(`${ENVYConfig.API_BASE_URL}/upload/avatar`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${session.access_token}`
                },
                body: formData
            });
            
            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || 'Upload failed');
            }
            
            const data = await response.json();
            
            if (data.url) {
                document.getElementById('profileAvatarPreview').src = data.url;
                
                const sidebarAvatar = document.getElementById('userAvatar');
                if (sidebarAvatar) sidebarAvatar.src = data.url;
                
                const headerAvatar = document.getElementById('headerUserAvatar');
                if (headerAvatar) headerAvatar.src = data.url;
                
                localStorage.setItem('user_avatar', data.url);
                
                notificationSystem.success('Profile picture updated successfully');
            }
        } catch (error) {
            console.error('Error uploading avatar:', error);
            notificationSystem.error(error.message || 'Failed to upload avatar');
        } finally {
            uploadBtn.disabled = false;
            uploadBtn.innerHTML = originalText;
        }
    }
    
    async changePassword() {
        const currentPassword = document.getElementById('currentPassword').value;
        const newPassword = document.getElementById('newPassword').value;
        const confirmPassword = document.getElementById('confirmPassword').value;
        
        if (!currentPassword || !newPassword || !confirmPassword) {
            notificationSystem.error('Please fill in all password fields');
            return;
        }
        
        if (newPassword !== confirmPassword) {
            notificationSystem.error('New passwords do not match');
            return;
        }
        
        if (newPassword.length < 8) {
            notificationSystem.error('Password must be at least 8 characters');
            return;
        }
        
        const { error } = await supabase.auth.updateUser({
            password: newPassword
        });
        
        if (error) {
            console.error('Error changing password:', error);
            notificationSystem.error(error.message);
            return;
        }
        
        document.getElementById('currentPassword').value = '';
        document.getElementById('newPassword').value = '';
        document.getElementById('confirmPassword').value = '';
        
        notificationSystem.success('Password changed successfully');
    }
    
    async resetToDefaults() {
    const defaultSettings = {
        user_id: this.user.id,
        theme: 'dark',
        accent_color: '#9CA3AF',
        font_style: 'Inter',
        font_size: '16px',
        glass_intensity: 50,
        border_radius: 8,
        layout_density: 'comfortable',
        sidebar_collapsed: false,
        trading_mode: 'spot',
        favorite_assets: ['BTC', 'ETH', 'SOL'],
        default_fee_rate: 0.10,
        holdings_sort: 'highest_value',
        row_highlighting: true,
        animation_intensity: 50,
        default_form_mode: 'simple',
        auto_clear_form: true,
        decimal_precision: 2,
        timer_format: 'full',
        trade_age_color: true,
        retracement_unit: 'percentage',
        export_format: 'csv',
        sound_enabled: true
    };
    
    try {
        // Step 1: Delete existing settings first
        const { error: deleteError } = await supabase
            .from('user_settings')
            .delete()
            .eq('user_id', this.user.id);
        
        if (deleteError) {
            console.error('Error deleting settings:', deleteError);
        }
        
        // Step 2: Insert fresh default settings
        const { error: insertError } = await supabase
            .from('user_settings')
            .insert([defaultSettings]);
            
        if (insertError) {
            // If delete+insert fails, try upsert
            const { error: upsertError } = await supabase
                .from('user_settings')
                .upsert(defaultSettings, { onConflict: 'user_id' });
                
            if (upsertError) {
                console.error('Error resetting settings:', upsertError);
                notificationSystem.error('Failed to reset settings');
                return;
            }
        }
        
        // Step 3: Update local state
        this.userSettings = defaultSettings;
        this.favoriteAssets = ['BTC', 'ETH', 'SOL'];
        this.settingsChanged = false;
        
        // Step 4: Save to localStorage for immediate effect
        localStorage.setItem('userSettings', JSON.stringify(defaultSettings));
        
        // Step 5: Reload all form fields with default values
        this.loadSettingsIntoForm();
        
        // Step 6: Re-render favorite assets
        this.renderFavoriteAssets();
        
        // Step 7: Apply settings immediately to the UI
        document.body.className = 'dark-theme';
        document.documentElement.style.setProperty('--accent-primary', '#9CA3AF', 'important');
        document.documentElement.style.setProperty('--accent-secondary', '#9CA3AF', 'important');
        document.documentElement.style.setProperty('--font-primary', "'Inter', -apple-system, BlinkMacSystemFont, sans-serif", 'important');
        document.body.style.fontFamily = 'var(--font-primary)';
        document.documentElement.style.fontSize = '16px';
        document.documentElement.style.setProperty('--glass-bg', 'rgba(17, 17, 17, 0.65)', 'important');
        document.documentElement.style.setProperty('--glass-blur', 'blur(12px)', 'important');
        document.documentElement.style.setProperty('--radius-md', '8px', 'important');
        document.documentElement.style.setProperty('--transition-base', '250ms', 'important');
        
        // Step 8: Reset sidebar if needed
        const sidebar = document.getElementById('sidebar');
        if (sidebar) {
            sidebar.classList.remove('collapsed');
        }
        localStorage.setItem('sidebarCollapsed', 'false');
        
        // Step 9: Update the trading mode display
        this.updateTradingModeDisplay();
        
        // Step 10: Show success notification
        notificationSystem.success('Settings reset to defaults successfully');
        
    } catch (error) {
        console.error('Error in resetToDefaults:', error);
        notificationSystem.error('Failed to reset settings');
    }
}
    
    async exportAllData() {
        const [trades, holdings, analyses] = await Promise.all([
            supabase.from('trades').select('*').eq('user_id', this.user.id),
            supabase.from('holdings').select('*').eq('user_id', this.user.id),
            supabase.from('planner_analyses').select('*').eq('user_id', this.user.id)
        ]);
        
        const exportData = {
            profile: this.userProfile,
            settings: this.userSettings,
            trades: trades.data || [],
            holdings: holdings.data || [],
            analyses: analyses.data || [],
            exported_at: new Date().toISOString()
        };
        
        const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `envy-export-${new Date().toISOString().split('T')[0]}.json`;
        a.click();
        URL.revokeObjectURL(url);
        
        notificationSystem.success('Data exported successfully');
    }
    
    async deleteAllTrades() {
        const { error } = await supabase
            .from('trades')
            .delete()
            .eq('user_id', this.user.id);
            
        if (error) {
            console.error('Error deleting trades:', error);
            notificationSystem.error('Failed to delete trades');
            return;
        }
        
        await supabase
            .from('holdings')
            .delete()
            .eq('user_id', this.user.id);
            
        notificationSystem.success('All trades deleted');
    }
    
    async deleteAccount() {
    notificationSystem.info('Deleting your account...');
    
    try {
        const userId = this.user.id;
        
        // Step 1: Delete all user data from public tables
        await supabase.from('user_settings').delete().eq('user_id', userId);
        await supabase.from('planner_analyses').delete().eq('user_id', userId);
        await supabase.from('holdings').delete().eq('user_id', userId);
        await supabase.from('trades').delete().eq('user_id', userId);
        await supabase.from('profiles').delete().eq('id', userId);
        
        // Step 2: Delete auth user using Supabase Admin API
        const SUPABASE_URL = 'https://hqeptxdwcetfygftdbdn.supabase.co';
        const SUPABASE_SERVICE_ROLE = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhxZXB0eGR3Y2V0ZnlnZnRkYmRuIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NjE4MzU2NiwiZXhwIjoyMDkxNzU5NTY2fQ.v2HDd3g0nbbcpx3iA30Bz7xUcNP6QCpP87Px9zC6x5I';
        
        const response = await fetch(`${SUPABASE_URL}/auth/v1/admin/users/${userId}`, {
            method: 'DELETE',
            headers: {
                'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE}`,
                'apikey': SUPABASE_SERVICE_ROLE
            }
        });
        
        if (!response.ok) {
            console.error('Delete failed:', await response.text());
        }
        
        // Step 3: Clear local data and sign out
        localStorage.clear();
        sessionStorage.clear();
        await supabase.auth.signOut();
        
        notificationSystem.success('Account deleted permanently.');
        
        setTimeout(() => {
            window.location.href = 'index.html';
        }, 1500);
        
    } catch (error) {
        console.error('Error:', error);
        // Emergency cleanup
        localStorage.clear();
        await supabase.auth.signOut();
        window.location.href = 'index.html';
    }
}
    
    confirmAction(title, message, callback) {
        document.getElementById('confirmModalTitle').textContent = title;
        document.getElementById('confirmModalMessage').textContent = message;
        this.confirmCallback = callback;
        document.getElementById('confirmModal').classList.add('active');
    }
    
    playSound(type) {
    try {
        const audioContext = new (window.AudioContext || window.webkitAudioContext)();
        const oscillator = audioContext.createOscillator();
        const gainNode = audioContext.createGain();
        
        oscillator.connect(gainNode);
        gainNode.connect(audioContext.destination);
        
        if (type === 'success') {
            // Pleasant ascending tone
            oscillator.type = 'sine';
            oscillator.frequency.setValueAtTime(523.25, audioContext.currentTime); // C5
            oscillator.frequency.setValueAtTime(659.25, audioContext.currentTime + 0.1); // E5
            oscillator.frequency.setValueAtTime(783.99, audioContext.currentTime + 0.2); // G5
            gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
            gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.4);
            oscillator.start(audioContext.currentTime);
            oscillator.stop(audioContext.currentTime + 0.4);
        } else if (type === 'error') {
            // Descending buzz tone
            oscillator.type = 'sawtooth';
            oscillator.frequency.setValueAtTime(440, audioContext.currentTime); // A4
            oscillator.frequency.setValueAtTime(330, audioContext.currentTime + 0.1); // E4
            oscillator.frequency.setValueAtTime(220, audioContext.currentTime + 0.2); // A3
            gainNode.gain.setValueAtTime(0.2, audioContext.currentTime);
            gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.3);
            oscillator.start(audioContext.currentTime);
            oscillator.stop(audioContext.currentTime + 0.3);
        } else {
            // Default notification sound - short beep
            oscillator.type = 'sine';
            oscillator.frequency.setValueAtTime(880, audioContext.currentTime); // A5
            gainNode.gain.setValueAtTime(0.2, audioContext.currentTime);
            gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.15);
            oscillator.start(audioContext.currentTime);
            oscillator.stop(audioContext.currentTime + 0.15);
        }
        
        // Clean up
        setTimeout(() => {
            audioContext.close();
        }, 1000);
    } catch (error) {
        console.log('Sound playback not supported:', error);
    }
}
    
    getAssetLogo(symbol) {
    return getAssetLogoUrl(symbol);
}
    
    updateGreeting() {
        const greetingElement = document.getElementById('userGreeting');
        const hour = new Date().getHours();
        let greeting = 'Good ';
        
        if (hour < 12) greeting += 'morning';
        else if (hour < 18) greeting += 'afternoon';
        else greeting += 'evening';
        
        greetingElement.textContent = greeting;
    }
    
    updateDateTime() {
        const timeElement = document.getElementById('headerTime');
        
        const update = () => {
            const now = new Date();
            timeElement.textContent = now.toLocaleTimeString('en-US', { 
                hour: '2-digit', 
                minute: '2-digit',
                second: '2-digit'
            });
        };
        
        update();
        setInterval(update, 1000);
    }
    
    updateUserDisplay() {
        const userNameElement = document.getElementById('userName');
        const userAvatar = document.getElementById('userAvatar');
        const userEmblem = document.getElementById('userEmblem');
        
        if (this.userProfile) {
            userNameElement.textContent = this.userProfile.full_name || this.user.email.split('@')[0];
            
            if (this.userProfile.avatar_url) {
                userAvatar.src = this.userProfile.avatar_url;
                document.getElementById('profileAvatarPreview').src = this.userProfile.avatar_url;
            }
            
            if (this.userProfile.role === 'admin') {
                userEmblem.textContent = '👑';
                userEmblem.className = 'user-emblem crown';
            }
        }
    }
    
    async checkAdminStatus() {
        if (this.userProfile?.role === 'admin') {
            document.getElementById('adminLink').style.display = 'flex';
        }
    }
    
    async logout() {
    // Clear all user data first
    if (window.clearAllUserData) {
        window.clearAllUserData();
    }
    
    await supabase.auth.signOut();
    window.location.href = 'index.html';
}
}

// Initialize settings when DOM is ready
let settingsManager;
document.addEventListener('DOMContentLoaded', () => {
    settingsManager = new SettingsManager();
    window.settingsManager = settingsManager;
});

// Warn about unsaved changes
window.addEventListener('beforeunload', (e) => {
    if (settingsManager?.settingsChanged) {
        e.preventDefault();
        e.returnValue = 'You have unsaved settings changes. Are you sure you want to leave?';
    }
});