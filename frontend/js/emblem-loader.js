// Global Emblem Loader
import { supabase } from './supabase-client.js';

class EmblemLoader {
    constructor() {
        this.defaultEmblem = 'assets/icons/envy-emblem.svg';
        this.currentEmblem = null;
    }
    
    async loadSiteEmblem() {
        try {
            const { data, error } = await supabase
                .from('website_settings')
                .select('site_emblem_url')
                .single();
                
            if (error) throw error;
            
            if (data && data.site_emblem_url) {
                this.currentEmblem = data.site_emblem_url;
            } else {
                this.currentEmblem = this.defaultEmblem;
            }
            
            this.updateAllEmblems();
            return this.currentEmblem;
        } catch (error) {
            console.error('Error loading emblem:', error);
            this.currentEmblem = this.defaultEmblem;
            this.updateAllEmblems();
            return this.defaultEmblem;
        }
    }
    
    updateAllEmblems() {
        // Update all emblem images on the page
        const emblems = document.querySelectorAll('#siteEmblem, .brand-emblem, .auth-emblem, .sidebar-emblem, .footer-emblem');
        emblems.forEach(img => {
            if (img) {
                img.src = this.currentEmblem;
                img.onerror = () => {
                    img.src = this.defaultEmblem;
                };
            }
        });
    }
    
    getEmblemUrl() {
        return this.currentEmblem || this.defaultEmblem;
    }
}

export const emblemLoader = new EmblemLoader();