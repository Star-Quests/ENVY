// ENVY Global JavaScript - Common Functionality

import { supabase, auth, db } from './supabase-client.js';
import { connectionMonitor } from './connection-monitor.js';
import { notificationSystem } from './notifications.js';
import { ENVYConfig } from './config.js';
import { siteSettings } from './site-settings.js';
// Global initialization
document.addEventListener('DOMContentLoaded', async () => {
    console.log(`ENVY v${ENVYConfig.APP_VERSION} initialized`);
    
    // Show loading overlay immediately
    const loadingOverlay = document.createElement('div');
    loadingOverlay.id = 'settings-loading-overlay';
    loadingOverlay.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background: #0A0A0A;
        z-index: 9999;
        display: flex;
        align-items: center;
        justify-content: center;
        opacity: 1;
        transition: opacity 0.2s ease;
    `;
    loadingOverlay.innerHTML = `
        <div style="text-align: center;">
            <div class="spinner" style="width: 48px; height: 48px; margin: 0 auto 16px;"></div>
            <p style="color: #9CA3AF; font-family: 'Inter', sans-serif;">Loading ENVY...</p>
        </div>
    `;
    document.body.appendChild(loadingOverlay);
    
    // Block page interaction while loading
    document.body.style.overflow = 'hidden';
    
    try {
        // ==========================================
        // CHECK MAINTENANCE MODE FIRST
        // ==========================================
        const access = await siteSettings.checkAccess();
        
        if (!access.allowed) {
    loadingOverlay.remove();
    document.body.style.overflow = '';
    
    const showLogin = access.redirectToAuth === true;
    siteSettings.showMaintenancePage(access.message, showLogin);
    return;
}
        
        // ==========================================
        // CHECK FOR ANNOUNCEMENTS
        // ==========================================
        const announcement = await siteSettings.getAnnouncement();
        if (announcement) {
            siteSettings.showAnnouncementBanner(announcement);
        }
        
        // Continue with normal initialization
        await checkPageAccess();
        await loadAndApplySettings();
        document.body.offsetHeight;
        initializeSidebar();
        initializeMobileMenu();
        initializeDropdowns();
        initializeModals();
        setupKeyboardShortcuts();
        initializeTooltips();
    } finally {
        loadingOverlay.style.opacity = '0';
        setTimeout(() => {
            loadingOverlay.remove();
            document.body.style.overflow = '';
        }, 200);
    }
});

// Check if user has access to current page
async function checkPageAccess() {
    const protectedPages = ['dashboard.html', 'journal.html', 'planner.html', 'settings.html', 'admin.html'];
    const currentPage = window.location.pathname.split('/').pop();
    
    if (protectedPages.includes(currentPage)) {
        const { user, error } = await auth.getUser();
        
        if (error || !user) {
            window.location.href = 'auth.html';
            return;
        }
        
        // Check admin access
        if (currentPage === 'admin.html') {
            const { isAdmin } = await db.isAdmin(user.id);
            
            if (!isAdmin) {
                notificationSystem.error('Admin access required');
                window.location.href = 'dashboard.html';
                return;
            }
        }
    }
}

// Sidebar functionality
function initializeSidebar() {
    const sidebar = document.getElementById('sidebar');
    const toggle = document.getElementById('sidebarToggle');
    
    if (!sidebar || !toggle) return;
    
    // Load saved state from localStorage FIRST (instant)
    const savedState = localStorage.getItem('sidebarCollapsed');
    if (savedState === 'true') {
        sidebar.classList.add('collapsed');
    } else if (savedState === 'false') {
        sidebar.classList.remove('collapsed');
    }
    
    toggle.addEventListener('click', async () => {
        sidebar.classList.toggle('collapsed');
        const isCollapsed = sidebar.classList.contains('collapsed');
        
        // Save to localStorage immediately
        localStorage.setItem('sidebarCollapsed', isCollapsed);
        
        // Save to database if user is logged in
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (user) {
                await supabase
                    .from('user_settings')
                    .upsert({
                        user_id: user.id,
                        sidebar_collapsed: isCollapsed,
                        updated_at: new Date().toISOString()
                    }, { onConflict: 'user_id' });
            }
        } catch (error) {
            console.error('Failed to save sidebar preference:', error);
        }
    });
}

// Mobile menu - Optimized for instant response
function initializeMobileMenu() {
    const menuBtn = document.getElementById('mobileMenuBtn');
    const sidebar = document.getElementById('sidebar');
    
    if (!menuBtn || !sidebar) {
        console.log('Menu elements not found');
        return;
    }
    
    console.log('Mobile menu setup complete');
    
    let overlay = document.querySelector('.sidebar-overlay');
    if (!overlay) {
        overlay = document.createElement('div');
        overlay.className = 'sidebar-overlay';
        document.body.appendChild(overlay);
    }
    
    let isOpen = false;
    
    function openMenu() {
        isOpen = true;
        sidebar.classList.add('mobile-open');
        menuBtn.classList.add('active');
        overlay.classList.add('active');
        document.body.style.overflow = 'hidden';
    }
    
    function closeMenu() {
        isOpen = false;
        sidebar.classList.remove('mobile-open');
        menuBtn.classList.remove('active');
        overlay.classList.remove('active');
        document.body.style.overflow = '';
    }
    
    menuBtn.onclick = function(e) {
        e.preventDefault();
        e.stopPropagation();
        if (isOpen) {
            closeMenu();
        } else {
            openMenu();
        }
    };
    
    overlay.onclick = function() {
        closeMenu();
    };
    
    sidebar.querySelectorAll('a').forEach(link => {
        link.onclick = function() {
            setTimeout(closeMenu, 100);
        };
    });
    
    document.onkeydown = function(e) {
        if (e.key === 'Escape' && isOpen) {
            closeMenu();
        }
    };
    
    window.onresize = function() {
        if (window.innerWidth > 768 && isOpen) {
            closeMenu();
        }
    };
}

// Dropdown functionality
function initializeDropdowns() {
    document.addEventListener('click', (e) => {
        document.querySelectorAll('.dropdown.active').forEach(dropdown => {
            if (!dropdown.contains(e.target)) {
                dropdown.classList.remove('active');
            }
        });
    });
}

// Modal functionality
function initializeModals() {
    document.querySelectorAll('.modal').forEach(modal => {
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                modal.classList.remove('active');
            }
        });
    });
    
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            document.querySelectorAll('.modal.active').forEach(modal => {
                modal.classList.remove('active');
            });
        }
    });
}

// Load user avatar from profile
async function loadUserAvatar() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    
    const { data: profile } = await supabase
        .from('profiles')
        .select('avatar_url')
        .eq('id', user.id)
        .single();
        
    if (profile?.avatar_url) {
        document.querySelectorAll('#userAvatar, #headerUserAvatar, #sidebarAvatar, #profileAvatarPreview').forEach(img => {
            if (img) img.src = profile.avatar_url;
        });
        
        localStorage.setItem('user_avatar', profile.avatar_url);
    }
}

// Call on page load
document.addEventListener('DOMContentLoaded', loadUserAvatar);

// Load and apply user settings
async function loadAndApplySettings() {
    // STEP 1: Apply from localStorage IMMEDIATELY (synchronous)
    const cachedSettings = localStorage.getItem('userSettings');
    if (cachedSettings) {
        try {
            const settings = JSON.parse(cachedSettings);
            applyAllSettings(settings);
            console.log('⚡ Applied cached settings immediately');
        } catch (e) {
            console.error('Failed to parse cached settings:', e);
        }
    }
    
    // STEP 2: Fetch fresh settings from database
    try {
        const { user } = await auth.getUser();
        if (!user) return;
        
        const { data: settings } = await db.getSettings(user.id);
        if (!settings) return;
        
        // Only update if different from cache
        const cached = localStorage.getItem('userSettings');
        if (cached !== JSON.stringify(settings)) {
            localStorage.setItem('userSettings', JSON.stringify(settings));
            applyAllSettings(settings);
            console.log('🔄 Updated settings from database');
        }
        
    } catch (error) {
        console.error('Error loading settings from database:', error);
    }
}

// Apply all settings at once
function applyAllSettings(settings) {
    // Apply theme
    if (settings.theme) {
        applyTheme(settings.theme);
    }
    
    // Apply accent color
    if (settings.accent_color) {
        document.documentElement.style.setProperty('--accent-primary', settings.accent_color, 'important');
        document.documentElement.style.setProperty('--accent-secondary', settings.accent_color, 'important');
        console.log('✅ Accent applied:', settings.accent_color);
    }
    
    // Apply font style
    if (settings.font_style) {
        applyFont(settings.font_style);
        console.log('✅ Font applied:', settings.font_style);
    }
    
    // Apply font size
    if (settings.font_size) {
        const fontSize = parseInt(settings.font_size) || 16;
        document.documentElement.style.fontSize = fontSize + 'px';
    }
    
        // Apply sidebar state from settings
    if (settings.sidebar_collapsed !== undefined) {
        const sidebar = document.getElementById('sidebar');
        if (sidebar) {
            if (settings.sidebar_collapsed) {
                sidebar.classList.add('collapsed');
            } else {
                sidebar.classList.remove('collapsed');
            }
            localStorage.setItem('sidebarCollapsed', settings.sidebar_collapsed);
        }
    }

    // Apply glass intensity
    if (settings.glass_intensity) {
        const intensity = settings.glass_intensity / 100;
        document.documentElement.style.setProperty('--glass-bg', `rgba(17, 17, 17, ${0.5 + intensity * 0.3})`, 'important');
        document.documentElement.style.setProperty('--glass-blur', `blur(${8 + intensity * 8}px)`, 'important');
    }
    
    // Apply border radius
    if (settings.border_radius) {
        document.documentElement.style.setProperty('--radius-md', settings.border_radius + 'px', 'important');
    }
    
    // Apply animation intensity
    if (settings.animation_intensity) {
        const speed = settings.animation_intensity / 100;
        document.documentElement.style.setProperty('--transition-base', `${250 * speed}ms`, 'important');
    }
    
    // Apply notification sound preference
    if (settings.sound_enabled !== undefined) {
        notificationSystem.setSoundEnabled(settings.sound_enabled);
    }
}

// Apply theme
function applyTheme(theme) {
    if (theme === 'system') {
        const isDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
        document.body.className = isDark ? 'dark-theme' : 'light-theme';
        
        window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', (e) => {
            if (localStorage.getItem('theme') === 'system') {
                document.body.className = e.matches ? 'dark-theme' : 'light-theme';
            }
        });
    } else {
        document.body.className = `${theme}-theme`;
    }
}

// Apply font
function applyFont(fontFamily) {
    if (!fontFamily || fontFamily === 'Inter') {
        document.documentElement.style.setProperty('--font-primary', "'Inter', -apple-system, BlinkMacSystemFont, sans-serif", 'important');
    } else if (fontFamily === 'system-ui') {
        document.documentElement.style.setProperty('--font-primary', "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif", 'important');
    } else {
        document.documentElement.style.setProperty('--font-primary', `'${fontFamily}', -apple-system, BlinkMacSystemFont, sans-serif`, 'important');
    }
    
    document.body.style.fontFamily = `var(--font-primary)`;
}

// Keyboard shortcuts
function setupKeyboardShortcuts() {
    document.addEventListener('keydown', (e) => {
        if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
            e.preventDefault();
            const searchInput = document.querySelector('input[type="search"], .search-input');
            if (searchInput) searchInput.focus();
        }
        
        if ((e.ctrlKey || e.metaKey) && e.key === '/') {
            e.preventDefault();
            const sidebar = document.getElementById('sidebar');
            if (sidebar) {
                sidebar.classList.toggle('collapsed');
                localStorage.setItem('sidebarCollapsed', sidebar.classList.contains('collapsed'));
            }
        }
        
        if (e.key === 'Escape') {
            document.querySelectorAll('.modal.active, .dropdown.active').forEach(el => {
                el.classList.remove('active');
            });
        }
    });
}

// Tooltips
function initializeTooltips() {
    document.querySelectorAll('[data-tooltip]').forEach(element => {
        element.addEventListener('mouseenter', (e) => {
            const tooltip = document.createElement('div');
            tooltip.className = 'tooltip glass-morphism';
            tooltip.textContent = element.dataset.tooltip;
            tooltip.style.cssText = `
                position: absolute;
                padding: 8px 12px;
                border-radius: 8px;
                font-size: 13px;
                z-index: 9999;
                pointer-events: none;
                white-space: nowrap;
            `;
            
            document.body.appendChild(tooltip);
            
            const rect = element.getBoundingClientRect();
            tooltip.style.left = rect.left + (rect.width / 2) - (tooltip.offsetWidth / 2) + 'px';
            tooltip.style.top = rect.top - tooltip.offsetHeight - 8 + 'px';
            
            element.tooltipElement = tooltip;
        });
        
        element.addEventListener('mouseleave', () => {
            if (element.tooltipElement) {
                element.tooltipElement.remove();
                element.tooltipElement = null;
            }
        });
    });
}

// Utility Functions
window.formatNumber = (num, decimals = 2) => {
    if (num === null || num === undefined || isNaN(num)) return '0.00';
    return new Intl.NumberFormat('en-US', {
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals
    }).format(num);
};

window.formatCurrency = (num) => {
    if (num === null || num === undefined || isNaN(num)) return '$0.00';
    return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD'
    }).format(num);
};

window.formatPercent = (num) => {
    if (num === null || num === undefined || isNaN(num)) return '0.00%';
    const sign = num >= 0 ? '+' : '';
    return sign + num.toFixed(2) + '%';
};

window.formatDate = (timestamp) => {
    return new Date(timestamp).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric'
    });
};

window.formatDateTime = (timestamp) => {
    return new Date(timestamp).toLocaleString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });
};

window.formatTimeAgo = (timestamp) => {
    const now = new Date();
    const then = new Date(timestamp);
    const diff = now - then;
    
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);
    
    if (minutes < 1) return 'Just now';
    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    if (days < 7) return `${days}d ago`;
    
    return formatDate(timestamp);
};

window.debounce = (func, wait) => {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
};

window.throttle = (func, limit) => {
    let inThrottle;
    return function(...args) {
        if (!inThrottle) {
            func.apply(this, args);
            inThrottle = true;
            setTimeout(() => inThrottle = false, limit);
        }
    };
};

// Clear all user data on logout
window.clearAllUserData = function() {
    // Clear localStorage
    localStorage.removeItem('userSettings');
    localStorage.removeItem('user_avatar');
    localStorage.removeItem('site_emblem');
    
    // Clear sessionStorage
    sessionStorage.clear();
    
    // Reset to default theme
    document.body.className = 'dark-theme';
    document.documentElement.style.fontSize = '16px';
    document.documentElement.style.setProperty('--accent-primary', '#9CA3AF', 'important');
    document.documentElement.style.setProperty('--font-primary', "'Inter', -apple-system, BlinkMacSystemFont, sans-serif", 'important');
    document.body.style.fontFamily = 'var(--font-primary)';
    
    console.log('🧹 All user data cleared');
};

// Export for use in other modules
export const globalUtils = {
    formatNumber: window.formatNumber,
    formatCurrency: window.formatCurrency,
    formatPercent: window.formatPercent,
    formatDate: window.formatDate,
    formatDateTime: window.formatDateTime,
    formatTimeAgo: window.formatTimeAgo,
    debounce: window.debounce,
    throttle: window.throttle
};

// Fix for mobile viewport issues
(function() {
    function setVH() {
        const vh = window.innerHeight * 0.01;
        document.documentElement.style.setProperty('--vh', `${vh}px`);
    }
    
    setVH();
    window.addEventListener('resize', setVH);
    window.addEventListener('orientationchange', setVH);
    
    const ua = navigator.userAgent;
    if (/iPhone|iPad|iPod/.test(ua)) {
        document.documentElement.classList.add('ios');
    } else if (/Android/.test(ua)) {
        document.documentElement.classList.add('android');
    }
    
    if (/Samsung|SM-/.test(ua)) {
        document.documentElement.classList.add('samsung');
    }
    
    document.addEventListener('touchstart', (e) => {
        if (e.touches.length > 1) {
            e.preventDefault();
        }
    }, { passive: false });
    
    let lastTouchEnd = 0;
    document.addEventListener('touchend', (e) => {
        const now = Date.now();
        if (now - lastTouchEnd <= 300) {
            e.preventDefault();
        }
        lastTouchEnd = now;
    }, false);

    // Re-apply settings after everything loads (overrides any CSS)
    window.addEventListener('load', () => {
        const savedSettings = localStorage.getItem('userSettings');
        if (savedSettings) {
            try {
                const settings = JSON.parse(savedSettings);
                if (settings.accent_color) {
                    document.documentElement.style.setProperty('--accent-primary', settings.accent_color, 'important');
                    document.documentElement.style.setProperty('--accent-secondary', settings.accent_color, 'important');
                    console.log('🔄 Re-applied accent on load:', settings.accent_color);
                }
                if (settings.theme) {
                    document.body.className = `${settings.theme}-theme`;
                }
                // Re-apply font on load
                if (settings.font_style) {
                    if (settings.font_style === 'Inter') {
                        document.documentElement.style.setProperty('--font-primary', "'Inter', -apple-system, BlinkMacSystemFont, sans-serif", 'important');
                    } else if (settings.font_style === 'system-ui') {
                        document.documentElement.style.setProperty('--font-primary', "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif", 'important');
                    } else {
                        document.documentElement.style.setProperty('--font-primary', `'${settings.font_style}', -apple-system, BlinkMacSystemFont, sans-serif`, 'important');
                    }
                    document.body.style.fontFamily = `var(--font-primary)`;
                    console.log('🔄 Re-applied font on load:', settings.font_style);
                }
                if (settings.font_size) {
                    document.documentElement.style.fontSize = settings.font_size;
                }
                            // Re-apply sidebar state
                if (settings.sidebar_collapsed !== undefined) {
                    const sidebar = document.getElementById('sidebar');
                if (sidebar) {
                    if (settings.sidebar_collapsed) {
                        sidebar.classList.add('collapsed');
                    } else {
                        sidebar.classList.remove('collapsed');
                    }
                }
            }
            } catch (e) {
                console.error('Failed to re-apply settings:', e);
            }
        }
    });
})();