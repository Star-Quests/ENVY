// ENVY Configuration - Complete

export const ENVYConfig = {
    // API Configuration - FIXED
    API_BASE_URL: 'http://localhost:3000/api',  // Force localhost
    
    WS_URL: 'ws://localhost:3000',
    
    // App Settings
    APP_NAME: 'ENVY',
    APP_VERSION: '1.0.0',
    
    // Default Settings
    DEFAULT_SETTINGS: {
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
    },
    
    // Asset Logo Fallbacks
    ASSET_LOGO_FALLBACK: 'assets/icons/default-crypto.svg',
    
    // Chart Colors
    CHART_COLORS: {
        profit: '#10B981',
        loss: '#EF4444',
        neutral: '#9CA3AF',
        grid: 'rgba(156, 163, 175, 0.1)'
    },
    
    // Pagination
    DEFAULT_PAGE_SIZE: 25,
    
    // Cache Settings
    CACHE_TTL: 30000, // 30 seconds
    
    // Feature Flags
    FEATURES: {
        livePrices: true,
        notifications: true,
        sounds: true,
        analytics: true,
        export: true
    }
};

// Freeze configuration to prevent modifications
Object.freeze(ENVYConfig);