/**
 * ENVY Site Settings Module
 * Checks maintenance mode and announcements before page load
 */

import { supabase } from './supabase-client.js';

class SiteSettings {
    constructor() {
        this.settings = null;
    }

    /**
     * Check if site is accessible (handles maintenance mode)
     * Returns true if access is allowed, false if blocked
     */
    async checkAccess() {
    try {
        // ==========================================
        // NEVER block the auth page!
        // Users must be able to sign in
        // ==========================================
        const currentPage = window.location.pathname.split('/').pop();
        if (currentPage === 'auth.html' || currentPage === 'index.html') {
            return { allowed: true };
        }
        
        const { data, error } = await supabase
            .from('website_settings')
            .select('*')
            .single();

        if (error) {
            // No settings found - allow access
            return { allowed: true };
        }

        this.settings = data;

        // Check maintenance mode
        if (data.maintenance_mode) {
            // Check if current user is logged in AND is admin
            const { data: { user } } = await supabase.auth.getUser();
            
            if (!user) {
                // User not logged in - redirect to auth page
                return { 
                    allowed: false, 
                    reason: 'maintenance',
                    message: 'Site is under maintenance. Please sign in as an administrator to access the site.',
                    redirectToAuth: true
                };
            }

            // Check if user is admin
            const { data: profile } = await supabase
                .from('profiles')
                .select('role')
                .eq('id', user.id)
                .single();

            if (!profile || profile.role !== 'admin') {
                return { 
                    allowed: false, 
                    reason: 'maintenance',
                    message: 'Site is under maintenance. Only administrators can access the site right now. Please check back later.',
                    redirectToAuth: false
                };
            }
        }

        return { allowed: true, settings: data };
    } catch (error) {
        console.error('Error checking site settings:', error);
        // Allow access if check fails (prevent total lockout)
        return { allowed: true };
    }
}

    /**
     * Show maintenance page
     */
    showMaintenancePage(message, showLoginButton = false) {
    document.body.innerHTML = `
        <div style="
            display: flex;
            align-items: center;
            justify-content: center;
            min-height: 100vh;
            background: #0A0A0A;
            font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
        ">
            <div style="text-align: center; padding: 40px; max-width: 500px;">
                <div style="font-size: 64px; margin-bottom: 20px;">🔧</div>
                <h1 style="color: #E5E7EB; font-size: 32px; font-weight: 700; margin-bottom: 16px;">
                    Under Maintenance
                </h1>
                <p style="color: #9CA3AF; font-size: 16px; margin-bottom: 32px; line-height: 1.6;">
                    ${message || 'ENVY is currently undergoing scheduled maintenance. We\'ll be back shortly.'}
                </p>
                ${showLoginButton ? `
                <a href="auth.html" style="
                    display: inline-block;
                    padding: 12px 32px;
                    background: linear-gradient(135deg, #9CA3AF, #E5E7EB);
                    color: #0A0A0A;
                    text-decoration: none;
                    border-radius: 9999px;
                    font-weight: 600;
                    font-size: 16px;
                    transition: transform 0.2s;
                " onmouseover="this.style.transform='translateY(-2px)'" onmouseout="this.style.transform='translateY(0)'">
                    Administrator Sign In
                </a>
                ` : ''}
                <div style="color: #6B7280; font-size: 14px; margin-top: 24px;">
                    If you are an administrator, please sign in to access the site.
                </div>
            </div>
        </div>
    `;
}

    /**
     * Get announcement if one exists
     */
    async getAnnouncement() {
        try {
            const { data, error } = await supabase
                .from('website_settings')
                .select('announcement, announcement_updated_at')
                .single();

            if (error || !data || !data.announcement) {
                return null;
            }

            // Don't show announcements older than 7 days
            const updateDate = new Date(data.announcement_updated_at);
            const now = new Date();
            const daysDiff = (now - updateDate) / (1000 * 60 * 60 * 24);

            if (daysDiff > 7) {
                return null;
            }

            return data.announcement;
        } catch (error) {
            console.error('Error fetching announcement:', error);
            return null;
        }
    }

    /**
     * Show announcement banner at top of page
     */
    showAnnouncementBanner(message) {
        const banner = document.createElement('div');
        banner.id = 'siteAnnouncementBanner';
        banner.style.cssText = `
            position: fixed;
            top: 28px;
            left: 0;
            right: 0;
            z-index: 9998;
            background: linear-gradient(135deg, #9CA3AF, #6B7280);
            color: #0A0A0A;
            padding: 12px 20px;
            text-align: center;
            font-weight: 600;
            font-size: 14px;
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 12px;
            font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
        `;

        banner.innerHTML = `
            <span>📢</span>
            <span style="flex: 1; text-align: center;">${message}</span>
            <button onclick="document.getElementById('siteAnnouncementBanner').remove()" 
                    style="
                        background: rgba(0,0,0,0.2);
                        border: none;
                        color: #0A0A0A;
                        cursor: pointer;
                        font-size: 18px;
                        padding: 4px 12px;
                        border-radius: 4px;
                        font-weight: 700;
                    ">&times;</button>
        `;

        // Insert after connection bar
        const connectionBar = document.getElementById('connectionBar');
        if (connectionBar && connectionBar.parentNode) {
            connectionBar.parentNode.insertBefore(banner, connectionBar.nextSibling);
        } else {
            document.body.prepend(banner);
        }

        // Adjust content margin
        const mainContent = document.querySelector('.main-content');
        if (mainContent) {
            mainContent.style.marginTop = '72px'; // 28px bar + 44px banner
        }
    }
}

export const siteSettings = new SiteSettings();