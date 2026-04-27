// ENVY Notification System - Complete

class NotificationSystem {
    constructor() {
        this.notifications = [];
        this.maxNotifications = 10;
        this.defaultDuration = 5000;
        this.container = null;
        this.soundEnabled = true;
        
        this.initialize();
    }
    
    initialize() {
        this.createContainer();
        this.loadSoundPreference();
    }
    
    createContainer() {
        // Check if container already exists
        let container = document.getElementById('notificationContainer');
        
        if (!container) {
            container = document.createElement('div');
            container.id = 'notificationContainer';
            container.style.cssText = `
                position: fixed;
                top: 80px;
                right: 20px;
                z-index: 9999;
                display: flex;
                flex-direction: column;
                gap: 10px;
                max-width: 380px;
                width: 100%;
                pointer-events: none;
            `;
            document.body.appendChild(container);
        }
        
        this.container = container;
    }
    
    createNotificationElement(notification) {
        const element = document.createElement('div');
        element.className = `notification glass-morphism notification-${notification.type}`;
        element.style.cssText = `
            padding: 16px 20px;
            border-radius: 12px;
            display: flex;
            align-items: flex-start;
            gap: 12px;
            pointer-events: auto;
            animation: slideInRight 0.3s ease-out;
            border-left: 4px solid ${this.getTypeColor(notification.type)};
            box-shadow: 0 10px 40px rgba(0, 0, 0, 0.3);
            cursor: pointer;
            transition: all 0.3s ease;
        `;
        
        // Icon
        const icon = document.createElement('div');
        icon.style.cssText = `
            width: 24px;
            height: 24px;
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            flex-shrink: 0;
            color: white;
        `;
        icon.style.backgroundColor = this.getTypeColor(notification.type);
        icon.innerHTML = this.getTypeIcon(notification.type);
        element.appendChild(icon);
        
        // Content
        const content = document.createElement('div');
        content.style.cssText = 'flex: 1;';
        
        const title = document.createElement('div');
        title.style.cssText = `
            font-weight: 600;
            margin-bottom: 4px;
            color: var(--accent-hover);
        `;
        title.textContent = notification.title || this.getTypeTitle(notification.type);
        content.appendChild(title);
        
        const message = document.createElement('div');
        message.style.cssText = `
            font-size: 14px;
            color: var(--accent-secondary);
            line-height: 1.4;
        `;
        message.textContent = notification.message;
        content.appendChild(message);
        
        element.appendChild(content);
        
        // Close button
        const closeBtn = document.createElement('button');
        closeBtn.style.cssText = `
            background: transparent;
            border: none;
            color: var(--accent-muted);
            cursor: pointer;
            font-size: 20px;
            padding: 0;
            width: 24px;
            height: 24px;
            display: flex;
            align-items: center;
            justify-content: center;
            border-radius: 6px;
            transition: all 0.2s;
            flex-shrink: 0;
        `;
        closeBtn.innerHTML = '×';
        closeBtn.onmouseover = () => closeBtn.style.backgroundColor = 'var(--glass-bg)';
        closeBtn.onmouseout = () => closeBtn.style.backgroundColor = 'transparent';
        closeBtn.onclick = () => this.dismiss(notification.id);
        element.appendChild(closeBtn);
        
        // Click to dismiss
        element.onclick = (e) => {
            if (e.target !== closeBtn && !closeBtn.contains(e.target)) {
                this.dismiss(notification.id);
            }
        };
        
        // Progress bar for auto-dismiss
        if (notification.duration && notification.duration > 0) {
            const progressBar = document.createElement('div');
            progressBar.style.cssText = `
                position: absolute;
                bottom: 0;
                left: 0;
                height: 3px;
                background: ${this.getTypeColor(notification.type)};
                border-radius: 0 0 0 12px;
                transition: width 0.1s linear;
            `;
            element.style.position = 'relative';
            element.style.overflow = 'hidden';
            element.appendChild(progressBar);
            
            let width = 100;
            const interval = setInterval(() => {
                width -= 100 / (notification.duration / 100);
                progressBar.style.width = width + '%';
                
                if (width <= 0) {
                    clearInterval(interval);
                }
            }, 100);
            
            notification.progressInterval = interval;
        }
        
        return element;
    }
    
    getTypeColor(type) {
        const colors = {
            success: '#10B981',
            error: '#EF4444',
            warning: '#F59E0B',
            info: '#3B82F6'
        };
        return colors[type] || colors.info;
    }
    
    getTypeIcon(type) {
        const icons = {
            success: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M5 12L10 17L19 8" stroke="white" stroke-width="3" stroke-linecap="round"/></svg>',
            error: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M18 6L6 18M6 6L18 18" stroke="white" stroke-width="2" stroke-linecap="round"/></svg>',
            warning: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M12 9V13M12 17H12.01" stroke="white" stroke-width="2" stroke-linecap="round"/><path d="M12 4L3 20H21L12 4Z" stroke="white" stroke-width="2"/></svg>',
            info: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="10" stroke="white" stroke-width="2"/><path d="M12 8V12M12 16H12.01" stroke="white" stroke-width="2" stroke-linecap="round"/></svg>'
        };
        return icons[type] || icons.info;
    }
    
    getTypeTitle(type) {
        const titles = {
            success: 'Success',
            error: 'Error',
            warning: 'Warning',
            info: 'Info'
        };
        return titles[type] || 'Notification';
    }
    
    notify(message, type = 'info', options = {}) {
        const id = Date.now() + Math.random();
        const notification = {
            id,
            message,
            type,
            title: options.title,
            duration: options.duration !== undefined ? options.duration : this.defaultDuration,
            ...options
        };
        
        this.notifications.push(notification);
        
        // Create and add element
        const element = this.createNotificationElement(notification);
        notification.element = element;
        this.container.appendChild(element);
        
        // Play sound if enabled
        if (this.soundEnabled && options.sound !== false) {
            this.playSound(type);
        }
        
        // Auto dismiss
        if (notification.duration && notification.duration > 0) {
            notification.timeout = setTimeout(() => {
                this.dismiss(id);
            }, notification.duration);
        }
        
        // Limit max notifications
        if (this.notifications.length > this.maxNotifications) {
            this.dismiss(this.notifications[0].id);
        }
        
        // Update notification badge
        this.updateBadge();
        
        return id;
    }
    
    success(message, options = {}) {
        return this.notify(message, 'success', options);
    }
    
    error(message, options = {}) {
        return this.notify(message, 'error', options);
    }
    
    warning(message, options = {}) {
        return this.notify(message, 'warning', options);
    }
    
    info(message, options = {}) {
        return this.notify(message, 'info', options);
    }
    
    dismiss(id) {
        const index = this.notifications.findIndex(n => n.id === id);
        
        if (index !== -1) {
            const notification = this.notifications[index];
            
            // Clear timeout
            if (notification.timeout) {
                clearTimeout(notification.timeout);
            }
            
            // Clear progress interval
            if (notification.progressInterval) {
                clearInterval(notification.progressInterval);
            }
            
            // Animate out
            if (notification.element) {
                notification.element.style.animation = 'slideOutRight 0.3s ease-out';
                notification.element.style.opacity = '0';
                notification.element.style.transform = 'translateX(100%)';
                
                setTimeout(() => {
                    if (notification.element && notification.element.parentNode) {
                        notification.element.parentNode.removeChild(notification.element);
                    }
                }, 300);
            }
            
            // Remove from array
            this.notifications.splice(index, 1);
        }
        
        // Update badge
        this.updateBadge();
    }
    
    dismissAll() {
        this.notifications.forEach(n => this.dismiss(n.id));
    }
    
    clearAll() {
        this.dismissAll();
    }
    
    updateBadge() {
        const badge = document.getElementById('notificationBadge');
        if (badge) {
            const count = this.notifications.length;
            badge.textContent = count;
            badge.style.display = count > 0 ? 'flex' : 'none';
        }
    }
    
    async playSound(type) {
    if (!this.soundEnabled) return;
    
    try {
        const audioContext = new (window.AudioContext || window.webkitAudioContext)();
        const oscillator = audioContext.createOscillator();
        const gainNode = audioContext.createGain();
        
        oscillator.connect(gainNode);
        gainNode.connect(audioContext.destination);
        
        if (type === 'success') {
            oscillator.type = 'sine';
            oscillator.frequency.setValueAtTime(523.25, audioContext.currentTime);
            oscillator.frequency.setValueAtTime(659.25, audioContext.currentTime + 0.1);
            oscillator.frequency.setValueAtTime(783.99, audioContext.currentTime + 0.2);
            gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
            gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.4);
            oscillator.start(audioContext.currentTime);
            oscillator.stop(audioContext.currentTime + 0.4);
        } else if (type === 'error') {
            oscillator.type = 'sawtooth';
            oscillator.frequency.setValueAtTime(440, audioContext.currentTime);
            oscillator.frequency.setValueAtTime(330, audioContext.currentTime + 0.1);
            oscillator.frequency.setValueAtTime(220, audioContext.currentTime + 0.2);
            gainNode.gain.setValueAtTime(0.2, audioContext.currentTime);
            gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.3);
            oscillator.start(audioContext.currentTime);
            oscillator.stop(audioContext.currentTime + 0.3);
        } else {
            oscillator.type = 'sine';
            oscillator.frequency.setValueAtTime(880, audioContext.currentTime);
            gainNode.gain.setValueAtTime(0.2, audioContext.currentTime);
            gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.15);
            oscillator.start(audioContext.currentTime);
            oscillator.stop(audioContext.currentTime + 0.15);
        }
        
        setTimeout(() => {
            audioContext.close();
        }, 1000);
    } catch (error) {
        console.debug('Sound playback prevented:', error);
    }
}
    
    loadSoundPreference() {
        // Load from user settings if available
        try {
            const settings = JSON.parse(localStorage.getItem('userSettings') || '{}');
            if (settings.sound_enabled !== undefined) {
                this.soundEnabled = settings.sound_enabled;
            }
        } catch (error) {
            // Use default
        }
    }
    
    setSoundEnabled(enabled) {
        this.soundEnabled = enabled;
    }
    
    isSoundEnabled() {
        return this.soundEnabled;
    }
}

// Add CSS animations
const style = document.createElement('style');
style.textContent = `
    @keyframes slideInRight {
        from {
            transform: translateX(100%);
            opacity: 0;
        }
        to {
            transform: translateX(0);
            opacity: 1;
        }
    }
    
    @keyframes slideOutRight {
        from {
            transform: translateX(0);
            opacity: 1;
        }
        to {
            transform: translateX(100%);
            opacity: 0;
        }
    }
    
    .notification {
        backdrop-filter: blur(12px);
        -webkit-backdrop-filter: blur(12px);
    }
    
    .notification:hover {
        transform: translateX(-4px) !important;
    }
`;
document.head.appendChild(style);

// Create and export singleton
export const notificationSystem = new NotificationSystem();