// ENVY Admin JavaScript - Complete Admin Panel

import { ENVYConfig } from './config.js';
import { supabase } from './supabase-client.js';
import { connectionMonitor } from './connection-monitor.js';
import { notificationSystem } from './notifications.js';

class AdminManager {
    constructor() {
        this.user = null;
        this.userProfile = null;
        this.isAdmin = false;
        this.users = [];
        this.trades = [];
        this.logs = [];
        this.selectedUser = null;
        this.currentPage = 1;
        this.pageSize = 25;
        this.totalPages = 1;
        this.confirmCallback = null;
        this.charts = {};
        
        this.initialize();
    }
    
    async initialize() {
        await this.checkAuth();
        
        if (!this.isAdmin) {
            notificationSystem.error('Access denied. Admin privileges required.');
            window.location.href = 'dashboard.html';
            return;
        }
        
        this.setupEventListeners();
        this.updateGreeting();
        this.updateDateTime();
        this.loadOverviewData();
        this.loadUsers();
        this.loadTrades();
        this.loadLogs();
        this.loadSiteSettings();
        await this.initializeCharts();
    }
    
    async checkAuth() {
    const { data: { user }, error } = await supabase.auth.getUser();
    
    if (error || !user) {
        window.location.href = 'auth.html';
        return;
    }
    
    this.user = user;
    
    // Update last_active_at timestamp on login
    await supabase
        .from('profiles')
        .update({ 
            updated_at: new Date().toISOString(),
            last_active_at: new Date().toISOString()
        })
        .eq('id', user.id);
    
    const { data: profile } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single();
        
    this.userProfile = profile;
    this.isAdmin = profile?.role === 'admin';
    this.updateUserDisplay();
}
    
    setupEventListeners() {
        // Tab switching
        document.querySelectorAll('.admin-tab').forEach(tab => {
            tab.addEventListener('click', () => {
                const tabId = tab.dataset.tab;
                this.switchTab(tabId);
            });
        });
        
        // User search
        document.getElementById('userSearchInput').addEventListener('input', (e) => {
            this.filterUsers(e.target.value);
        });
        
        // Export users
        document.getElementById('exportUsersBtn').addEventListener('click', () => {
            this.exportUsers();
        });
        
        // Trade filters
        document.getElementById('tradeUserFilter').addEventListener('change', () => {
            this.currentPage = 1;
            this.loadTrades();
        });
        
        document.getElementById('tradeSearchInput').addEventListener('input', (e) => {
            this.filterTrades(e.target.value);
        });
        
        // Log filter
        document.getElementById('logFilterSelect').addEventListener('change', () => {
            this.currentPage = 1;
            this.loadLogs();
        });
        
        // Export logs
        document.getElementById('exportLogsBtn').addEventListener('click', () => {
            this.exportLogs();
        });
        
        // Emblem upload
        document.getElementById('uploadEmblemBtn').addEventListener('click', () => {
            document.getElementById('emblemFileInput').click();
        });
        
        document.getElementById('emblemFileInput').addEventListener('change', (e) => {
            this.uploadEmblem(e.target.files[0]);
        });
        
        document.getElementById('resetEmblemBtn').addEventListener('click', () => {
            this.resetEmblem();
        });
        
        // Maintenance mode
        document.getElementById('maintenanceModeToggle').addEventListener('change', (e) => {
            this.toggleMaintenanceMode(e.target.checked);
        });
        
        // Announcement
document.getElementById('publishAnnouncementBtn').addEventListener('click', () => {
    this.publishAnnouncement();
});

document.getElementById('clearAnnouncementBtn').addEventListener('click', () => {
    this.confirmAction(
        'Clear Announcement',
        'Are you sure you want to remove the current announcement? Users will no longer see it.',
        () => this.clearAnnouncement()
    );
});
        
        document.getElementById('clearAnnouncementBtn').addEventListener('click', () => {
            document.getElementById('announcementText').value = '';
        });
        
        // Pagination
        document.getElementById('prevUserPageBtn').addEventListener('click', () => this.changeUserPage(-1));
        document.getElementById('nextUserPageBtn').addEventListener('click', () => this.changeUserPage(1));
        document.getElementById('prevTradePageBtn').addEventListener('click', () => this.changeTradePage(-1));
        document.getElementById('nextTradePageBtn').addEventListener('click', () => this.changeTradePage(1));
        document.getElementById('prevLogPageBtn').addEventListener('click', () => this.changeLogPage(-1));
        document.getElementById('nextLogPageBtn').addEventListener('click', () => this.changeLogPage(1));
        
        // Modals
        document.getElementById('closeUserDetailsModal').addEventListener('click', () => {
            document.getElementById('userDetailsModal').classList.remove('active');
        });
        
        document.getElementById('closeUserDetailsBtn').addEventListener('click', () => {
            document.getElementById('userDetailsModal').classList.remove('active');
        });
        
        document.getElementById('saveUserChangesBtn').addEventListener('click', () => {
            this.saveUserChanges();
        });
        
        document.getElementById('closePasswordModal').addEventListener('click', () => {
            document.getElementById('changePasswordModal').classList.remove('active');
        });
        
        document.getElementById('cancelPasswordBtn').addEventListener('click', () => {
            document.getElementById('changePasswordModal').classList.remove('active');
        });
        
        document.getElementById('confirmPasswordBtn').addEventListener('click', () => {
            this.confirmPasswordChange();
        });
        
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
    document.querySelectorAll('.admin-tab').forEach(tab => {
        tab.classList.toggle('active', tab.dataset.tab === tabId);
    });
    
    document.querySelectorAll('.admin-panel').forEach(panel => {
        panel.classList.toggle('active', panel.id === `${tabId}-panel`);
    });
    
    // Force fix for logs panel visibility
    if (tabId === 'logs') {
        const logsPanel = document.getElementById('logs-panel');
        if (logsPanel) {
            logsPanel.style.opacity = '1';
            logsPanel.style.height = 'auto';
            logsPanel.style.animation = 'none';
        }
    }
    
    if (tabId === 'overview') {
        setTimeout(() => this.updateCharts(), 100);
    }
}
    
    async loadOverviewData() {
    // Get total users
    const { count: userCount } = await supabase
        .from('profiles')
        .select('*', { count: 'exact', head: true });
        
    // Get admin count
    const { count: adminCount } = await supabase
        .from('profiles')
        .select('*', { count: 'exact', head: true })
        .eq('role', 'admin');
        
    // Get total trades
    const { count: tradeCount } = await supabase
        .from('trades')
        .select('*', { count: 'exact', head: true });
        
    // Get active today (updated within 24h)
const yesterday = new Date();
yesterday.setDate(yesterday.getDate() - 1);

const { count: activeCount } = await supabase
    .from('profiles')
    .select('*', { count: 'exact', head: true })
    .gte('updated_at', yesterday.toISOString());
    
// Also count users with recent activity (within 7 days)
const lastWeek = new Date();
lastWeek.setDate(lastWeek.getDate() - 7);

const { count: recentCount } = await supabase
    .from('profiles')
    .select('*', { count: 'exact', head: true })
    .gte('updated_at', lastWeek.toISOString());
        
    // Update UI
    document.getElementById('totalUsers').textContent = userCount || 0;
    document.getElementById('overviewTotalUsers').textContent = userCount || 0;
    document.getElementById('adminCount').textContent = adminCount || 0;
    document.getElementById('totalTrades').textContent = tradeCount || 0;
    document.getElementById('overviewTotalTrades').textContent = tradeCount || 0;
    document.getElementById('activeToday').textContent = activeCount || 0;
    document.getElementById('overviewActiveToday').textContent = `${activeCount || 0} active / ${recentCount || 0} this week`;
    
    // Load recent activity
    await this.loadRecentActivity();
}
    
    async loadRecentActivity() {
        const { data: logs } = await supabase
            .from('admin_logs')
            .select(`
                *,
                admin:admin_id (full_name, email),
                target:target_user_id (full_name, email)
            `)
            .order('created_at', { ascending: false })
            .limit(10);
            
        const container = document.getElementById('recentActivityList');
        
        if (!logs || logs.length === 0) {
            container.innerHTML = '<p class="empty-message">No recent activity</p>';
            return;
        }
        
        container.innerHTML = '';
        
        logs.forEach(log => {
            const item = document.createElement('div');
            item.className = 'activity-item';
            
            const icon = this.getActivityIcon(log.action_type);
            
            item.innerHTML = `
                <div class="activity-icon">${icon}</div>
                <div class="activity-details">
                    <div class="activity-title">
                        ${log.admin?.full_name || 'System'} ${this.formatAction(log.action_type)}
                        ${log.target ? log.target.full_name || log.target.email : ''}
                    </div>
                    <div class="activity-meta">${log.details || ''}</div>
                </div>
                <div class="activity-time">${this.formatTimeAgo(log.created_at)}</div>
            `;
            
            container.appendChild(item);
        });
    }
    
    getActivityIcon(action) {
        const icons = {
            'user_upgrade': '👑',
            'user_downgrade': '⬇️',
            'password_change': '🔐',
            'settings_change': '⚙️',
            'trade_delete': '🗑️'
        };
        return icons[action] || '📝';
    }
    
    formatAction(action) {
        const actions = {
            'user_upgrade': 'upgraded',
            'user_downgrade': 'downgraded',
            'password_change': 'changed password for',
            'settings_change': 'updated settings',
            'trade_delete': 'deleted trade from'
        };
        return actions[action] || action;
    }
    
    async loadUsers() {
        const from = (this.currentPage - 1) * this.pageSize;
        const to = from + this.pageSize - 1;
        
        const { data: users, count } = await supabase
            .from('profiles')
            .select('*', { count: 'exact' })
            .order('created_at', { ascending: false })
            .range(from, to);
            
        this.users = users || [];
        this.totalPages = Math.ceil(count / this.pageSize);
        
        this.renderUsersTable();
        this.updateUserPagination();
        this.populateUserFilter();
    }
    
    renderUsersTable() {
    const tbody = document.getElementById('usersTableBody');
    tbody.innerHTML = '';
    
    if (this.users.length === 0) {
        tbody.innerHTML = '<tr><td colspan="8" class="empty-message">No users found</td></tr>';
        return;
    }
    
    this.users.forEach(user => {
        const row = document.createElement('tr');
        
        // Get accurate last activity time
        const lastActivity = user.updated_at || user.created_at;
        const lastActivityDate = new Date(lastActivity);
        const now = new Date();
        const hoursSinceActivity = (now - lastActivityDate) / (1000 * 60 * 60);
        
        // Status logic:
        // - Active: logged in within last 24 hours
        // - Recent: logged in within last 7 days
        // - Inactive: no login for 7+ days or never logged in
        let status = 'Inactive';
        let statusClass = 'inactive';
        
        if (hoursSinceActivity <= 24) {
    status = 'Active';
    statusClass = 'active';
} else if (hoursSinceActivity <= 168) {
    status = 'Recent';
    statusClass = 'recent';
}
        
        const lastActiveText = this.formatTimeAgo(lastActivity);
        
        row.innerHTML = `
            <td>
                <div class="user-cell">
                    <img src="${user.avatar_url || 'assets/icons/user-avatar.svg'}" alt="Avatar" class="user-avatar-small">
                    <div class="user-info">
                        <span class="user-name">${user.full_name || 'N/A'}</span>
                        <span class="user-email">${user.id.substring(0, 8)}...</span>
                    </div>
                </div>
            </td>
            <td>${user.email}</td>
            <td>
                <span class="role-badge ${user.role}">${user.role}</span>
            </td>
            <td>
                <span class="status-badge ${statusClass}" title="${status === 'Active' ? 'Online in last 24h' : status === 'Recent' ? 'Online in last 7 days' : 'Inactive for 7+ days'}">
                    ${status === 'Active' ? '🟢 ' : status === 'Recent' ? '🟡 ' : '🔴 '}${status}
                </span>
            </td>
            <td>-</td>
            <td>${this.formatDate(user.created_at)}</td>
            <td>${lastActiveText}</td>
            <td>
                <div class="action-buttons">
                    <button class="action-btn" onclick="adminManager.viewUser('${user.id}')" title="View Details">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                            <circle cx="12" cy="12" r="3" fill="currentColor"/>
                            <path d="M22 12C22 12 19 18 12 18C5 18 2 12 2 12C2 12 5 6 12 6C19 6 22 12 22 12Z" stroke="currentColor" stroke-width="2"/>
                        </svg>
                    </button>
                    ${user.role !== 'admin' ? `
                        <button class="action-btn upgrade-btn" onclick="adminManager.upgradeUser('${user.id}')" title="Upgrade to Admin">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                                <path d="M12 4V20M20 12H4" stroke="currentColor" stroke-width="2"/>
                            </svg>
                        </button>
                    ` : `
                        <button class="action-btn downgrade-btn" onclick="adminManager.downgradeUser('${user.id}')" title="Downgrade to User">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                                <path d="M5 12H19" stroke="currentColor" stroke-width="2"/>
                            </svg>
                        </button>
                    `}
                    <button class="action-btn" onclick="adminManager.changeUserPassword('${user.id}')" title="Change Password">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                            <path d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" stroke="currentColor" stroke-width="2"/>
                            <path d="M12 3v4m0 10v4M3 12h4m10 0h4" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
                        </svg>
                    </button>
                </div>
            </td>
        `;
        
        tbody.appendChild(row);
    });
}
    
    filterUsers(query) {
        const rows = document.querySelectorAll('#usersTableBody tr');
        rows.forEach(row => {
            const text = row.textContent.toLowerCase();
            row.style.display = text.includes(query.toLowerCase()) ? '' : 'none';
        });
    }
    
    async viewUser(userId) {
        const { data: user } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', userId)
            .single();
            
        if (!user) return;
        
        this.selectedUser = user;
        
        // Get user stats
        const { count: tradeCount } = await supabase
            .from('trades')
            .select('*', { count: 'exact', head: true })
            .eq('user_id', userId);
            
        const { data: trades } = await supabase
            .from('trades')
            .select('profit_loss')
            .eq('user_id', userId)
            .not('profit_loss', 'is', null);
            
        const totalPL = trades?.reduce((sum, t) => sum + (t.profit_loss || 0), 0) || 0;
        
        const body = document.getElementById('userDetailsBody');
        body.innerHTML = `
            <div class="user-details-grid">
                <div class="detail-item">
                    <span class="detail-label">User ID</span>
                    <span class="detail-value">${user.id}</span>
                </div>
                <div class="detail-item">
                    <span class="detail-label">Email</span>
                    <span class="detail-value">${user.email}</span>
                </div>
                <div class="detail-item">
                    <span class="detail-label">Full Name</span>
                    <input type="text" id="editFullName" class="setting-input" value="${user.full_name || ''}">
                </div>
                <div class="detail-item">
                    <span class="detail-label">Role</span>
                    <select id="editRole" class="setting-select">
                        <option value="user" ${user.role === 'user' ? 'selected' : ''}>User</option>
                        <option value="admin" ${user.role === 'admin' ? 'selected' : ''}>Admin</option>
                    </select>
                </div>
                <div class="detail-item">
                    <span class="detail-label">Total Trades</span>
                    <span class="detail-value">${tradeCount || 0}</span>
                </div>
                <div class="detail-item">
                    <span class="detail-label">Total P/L</span>
                    <span class="detail-value ${totalPL >= 0 ? 'positive' : 'negative'}">
                        ${totalPL >= 0 ? '+' : ''}$${Math.abs(totalPL).toFixed(2)}
                    </span>
                </div>
                <div class="detail-item">
                    <span class="detail-label">Joined</span>
                    <span class="detail-value">${this.formatDateTime(user.created_at)}</span>
                </div>
                <div class="detail-item">
                    <span class="detail-label">Last Active</span>
                    <span class="detail-value">${this.formatDateTime(user.updated_at)}</span>
                </div>
                <div class="detail-full">
                    <span class="detail-label">Emblem Type</span>
                    <select id="editEmblem" class="setting-select">
                        <option value="neutral" ${user.emblem_type === 'neutral' ? 'selected' : ''}>Neutral</option>
                        <option value="crown" ${user.emblem_type === 'crown' ? 'selected' : ''}>Crown</option>
                    </select>
                </div>
            </div>
        `;
        
        document.getElementById('userDetailsModal').classList.add('active');
    }
    
    async saveUserChanges() {
        if (!this.selectedUser) return;
        
        const fullName = document.getElementById('editFullName').value;
        const role = document.getElementById('editRole').value;
        const emblem = document.getElementById('editEmblem').value;
        
        const { error } = await supabase
            .from('profiles')
            .update({
                full_name: fullName,
                role: role,
                emblem_type: emblem
            })
            .eq('id', this.selectedUser.id);
            
        if (error) {
            notificationSystem.error('Failed to update user');
            return;
        }
        
        // Log the action
        await this.logAction(
            role === 'admin' ? 'user_upgrade' : 'user_downgrade',
            this.selectedUser.id,
            `Role changed to ${role}`
        );
        
        document.getElementById('userDetailsModal').classList.remove('active');
        this.loadUsers();
        notificationSystem.success('User updated successfully');
    }
    
    async upgradeUser(userId) {
        this.confirmAction(
            'Upgrade User',
            'Are you sure you want to upgrade this user to Admin?',
            async () => {
                const { error } = await supabase
                    .from('profiles')
                    .update({ role: 'admin', emblem_type: 'crown' })
                    .eq('id', userId);
                    
                if (error) {
                    notificationSystem.error('Failed to upgrade user');
                    return;
                }
                
                await this.logAction('user_upgrade', userId, 'Upgraded to admin');
                this.loadUsers();
                notificationSystem.success('User upgraded to Admin');
            }
        );
    }
    
    async downgradeUser(userId) {
        this.confirmAction(
            'Downgrade User',
            'Are you sure you want to downgrade this user from Admin?',
            async () => {
                const { error } = await supabase
                    .from('profiles')
                    .update({ role: 'user', emblem_type: 'neutral' })
                    .eq('id', userId);
                    
                if (error) {
                    notificationSystem.error('Failed to downgrade user');
                    return;
                }
                
                await this.logAction('user_downgrade', userId, 'Downgraded to user');
                this.loadUsers();
                notificationSystem.success('User downgraded to User');
            }
        );
    }
    
    changeUserPassword(userId) {
        this.selectedUser = { id: userId };
        
        const { data: user } = this.users.find(u => u.id === userId);
        
        document.getElementById('passwordModalUserInfo').textContent = 
            `Change password for ${user?.email || userId}`;
        
        document.getElementById('changePasswordModal').classList.add('active');
    }
    
    async confirmPasswordChange() {
        if (!this.selectedUser) return;
        
        const newPassword = document.getElementById('newUserPassword').value;
        const confirmPassword = document.getElementById('confirmUserPassword').value;
        
        if (!newPassword || !confirmPassword) {
            notificationSystem.error('Please fill in both password fields');
            return;
        }
        
        if (newPassword !== confirmPassword) {
            notificationSystem.error('Passwords do not match');
            return;
        }
        
        if (newPassword.length < 8) {
            notificationSystem.error('Password must be at least 8 characters');
            return;
        }
        
        // Note: Admin password reset requires edge function or service role
        // This is a simplified version
        const { error } = await supabase.auth.admin.updateUserById(
            this.selectedUser.id,
            { password: newPassword }
        );
        
        if (error) {
            console.error('Error changing password:', error);
            notificationSystem.error('Failed to change password');
            return;
        }
        
        await this.logAction('password_change', this.selectedUser.id, 'Password changed by admin');
        
        document.getElementById('changePasswordModal').classList.remove('active');
        document.getElementById('newUserPassword').value = '';
        document.getElementById('confirmUserPassword').value = '';
        
        notificationSystem.success('Password changed successfully');
    }
    
    async loadTrades() {
        const filterUser = document.getElementById('tradeUserFilter').value;
        
        let query = supabase
            .from('trades')
            .select(`
                *,
                user:user_id (email, full_name)
            `, { count: 'exact' });
            
        if (filterUser !== 'all') {
            query = query.eq('user_id', filterUser);
        }
        
        const from = (this.currentPage - 1) * this.pageSize;
        const to = from + this.pageSize - 1;
        
        const { data: trades, count } = await query
            .order('created_at', { ascending: false })
            .range(from, to);
            
        this.trades = trades || [];
        this.totalPages = Math.ceil(count / this.pageSize);
        
        this.renderTradesTable();
        this.updateTradePagination();
    }
    
    renderTradesTable() {
        const tbody = document.getElementById('adminTradesTableBody');
        tbody.innerHTML = '';
        
        if (this.trades.length === 0) {
            tbody.innerHTML = '<tr><td colspan="10" class="empty-message">No trades found</td></tr>';
            return;
        }
        
        this.trades.forEach(trade => {
            const row = document.createElement('tr');
            
            row.innerHTML = `
                <td>${trade.user?.full_name || trade.user?.email || 'N/A'}</td>
                <td>${trade.asset_symbol}</td>
                <td>
                    <span class="type-badge ${trade.trade_type}">${trade.trade_type}</span>
                </td>
                <td>${this.formatNumber(trade.amount, 8)}</td>
                <td>$${this.formatNumber(trade.entry_price)}</td>
                <td>${trade.exit_price ? '$' + this.formatNumber(trade.exit_price) : '-'}</td>
                <td class="${trade.profit_loss >= 0 ? 'positive' : 'negative'}">
                    ${trade.profit_loss ? (trade.profit_loss >= 0 ? '+' : '') + '$' + this.formatNumber(trade.profit_loss) : '-'}
                </td>
                <td>
                    <span class="status-badge ${trade.status}">${trade.status}</span>
                </td>
                <td>${this.formatDate(trade.created_at)}</td>
                <td>
                    <div class="action-buttons">
                        <button class="action-btn delete-btn" onclick="adminManager.deleteTrade('${trade.id}')" title="Delete Trade">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                                <path d="M4 7H20M10 11V17M14 11V17M5 7L6 19C6 20.1046 6.89543 21 8 21H16C17.1046 21 18 20.1046 18 19L19 7M9 7V4C9 3.44772 9.44772 3 10 3H14C14.5523 3 15 3.44772 15 4V7" stroke="currentColor" stroke-width="2"/>
                            </svg>
                        </button>
                    </div>
                </td>
            `;
            
            tbody.appendChild(row);
        });
    }
    
    filterTrades(query) {
        const rows = document.querySelectorAll('#adminTradesTableBody tr');
        rows.forEach(row => {
            const text = row.textContent.toLowerCase();
            row.style.display = text.includes(query.toLowerCase()) ? '' : 'none';
        });
    }
    
    deleteTrade(tradeId) {
        this.confirmAction(
            'Delete Trade',
            'Are you sure you want to delete this trade? This action cannot be undone.',
            async () => {
                const { error } = await supabase
                    .from('trades')
                    .delete()
                    .eq('id', tradeId);
                    
                if (error) {
                    notificationSystem.error('Failed to delete trade');
                    return;
                }
                
                await this.logAction('trade_delete', null, `Deleted trade ${tradeId}`);
                this.loadTrades();
                this.loadOverviewData();
                notificationSystem.success('Trade deleted successfully');
            }
        );
    }
    
    populateUserFilter() {
        const filter = document.getElementById('tradeUserFilter');
        filter.innerHTML = '<option value="all">All Users</option>';
        
        this.users.forEach(user => {
            const option = document.createElement('option');
            option.value = user.id;
            option.textContent = user.full_name || user.email;
            filter.appendChild(option);
        });
    }
    
    async loadLogs() {
    const filter = document.getElementById('logFilterSelect').value;
    
    if (!this.logCurrentPage) this.logCurrentPage = 1;
    const pageSize = 25;
    
    let query = supabase
        .from('admin_logs')
        .select(`
            *,
            admin:admin_id (full_name, email),
            target:target_user_id (full_name, email)
        `, { count: 'exact' });
        
    if (filter !== 'all') {
        query = query.eq('action_type', filter);
    }
    
    const from = (this.logCurrentPage - 1) * pageSize;
    const to = from + pageSize - 1;
    
    const { data: logs, count, error } = await query
        .order('created_at', { ascending: false })
        .range(from, to);
        
    if (error) {
        console.error('Error loading logs:', error);
        return;
    }
    
    this.logs = logs || [];
    this.logTotalPages = Math.ceil((count || 0) / pageSize);
    
    this.renderLogsTable();
    this.updateLogPagination();
}
    
    renderLogsTable() {
    const tbody = document.getElementById('logsTableBody');
    tbody.innerHTML = '';
    
    if (!this.logs || this.logs.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="5" style="text-align: center; padding: 40px;">
                    <div style="font-size: 48px;">📋</div>
                    <h4>No Activity Logs Yet</h4>
                    <p style="color: var(--accent-muted);">Admin actions will appear here</p>
                </td>
            </tr>`;
        return;
    }
    
    this.logs.forEach(log => {
        const row = document.createElement('tr');
        
        let detailText = '-';
        if (log.details) {
            detailText = typeof log.details === 'object' 
                ? (log.details.message || JSON.stringify(log.details))
                : String(log.details);
        }
        
        row.innerHTML = `
            <td>${this.getActivityIcon(log.action_type)} ${log.admin?.full_name || log.admin?.email || 'System'}</td>
            <td><span class="log-action ${log.action_type}">${this.formatAction(log.action_type)}</span></td>
            <td>${log.target?.full_name || log.target?.email || 'N/A'}</td>
            <td>${detailText}</td>
            <td>${this.formatTimeAgo(log.created_at)}</td>
        `;
        
        tbody.appendChild(row);
    });
}
    
    async logAction(action, targetUserId, details) {
    const logEntry = {
        admin_id: this.user.id,
        action_type: action,
        target_user_id: targetUserId,
        details: { message: details },  // Store as JSON object
        created_at: new Date().toISOString()
    };
    
    const { error } = await supabase
        .from('admin_logs')
        .insert([logEntry]);
        
    if (error) {
        console.error('Error logging action:', error);
    }
}
    
    async loadSiteSettings() {
    const { data: settings } = await supabase
        .from('website_settings')
        .select('*')
        .single();
        
    if (settings) {
        if (settings.site_emblem_url) {
            document.getElementById('siteEmblem').src = settings.site_emblem_url;
            document.getElementById('siteEmblemPreview').src = settings.site_emblem_url;
        }
        
        document.getElementById('maintenanceModeToggle').checked = settings.maintenance_mode || false;
        
        // Show current announcement if exists
        if (settings.announcement) {
            document.getElementById('announcementText').value = settings.announcement;
            document.getElementById('announcementStatus').textContent = 
                `📢 Active - Published ${new Date(settings.announcement_updated_at).toLocaleDateString()}`;
            document.getElementById('announcementStatus').style.color = '#10B981';
            document.getElementById('clearAnnouncementBtn').style.display = 'inline-flex';
        } else {
            document.getElementById('announcementStatus').textContent = 'No active announcement';
            document.getElementById('announcementStatus').style.color = '#6B7280';
            document.getElementById('clearAnnouncementBtn').style.display = 'none';
        }
    }
}
    
    async uploadEmblem(file) {
    if (!file) return;
    
    const formData = new FormData();
    formData.append('emblem', file);
    
    // Get the session token
    const { data: { session } } = await supabase.auth.getSession();
    
    if (!session) {
        notificationSystem.error('Not authenticated');
        return;
    }
    
    try {
        const response = await fetch(`${ENVYConfig.API_BASE_URL}/upload/emblem`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${session.access_token}`
            },
            body: formData
        });
        
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
        }
        
        const data = await response.json();
        
        if (data.url) {
            // Update database with emblem URL
            await supabase
                .from('website_settings')
                .upsert({
                    id: 1,
                    site_emblem_url: data.url,
                    updated_by: this.user.id
                });
                
            document.getElementById('siteEmblem').src = data.url;
            document.getElementById('siteEmblemPreview').src = data.url;
            
            await this.logAction('settings_change', null, 'Updated site emblem');
            notificationSystem.success('Emblem uploaded successfully');
        }
    } catch (error) {
        console.error('Error uploading emblem:', error);
        notificationSystem.error('Failed to upload emblem');
    }
}
    
    async resetEmblem() {
        const defaultEmblem = 'assets/icons/envy-emblem.svg';
        
        await supabase
            .from('website_settings')
            .upsert({
                id: 1,
                site_emblem_url: defaultEmblem,
                updated_by: this.user.id
            });
            
        document.getElementById('siteEmblem').src = defaultEmblem;
        document.getElementById('siteEmblemPreview').src = defaultEmblem;
        
        await this.logAction('settings_change', null, 'Reset site emblem to default');
        notificationSystem.success('Emblem reset to default');
    }
    
    async toggleMaintenanceMode(enabled) {
    const { error } = await supabase
        .from('website_settings')
        .upsert({
            id: 1,
            maintenance_mode: enabled,
            updated_by: this.user.id,
            updated_at: new Date().toISOString()
        });
        
    if (error) {
        console.error('Error toggling maintenance mode:', error);
        notificationSystem.error('Failed to update maintenance mode');
        return;
    }
    
    await this.logAction('settings_change', null, `Maintenance mode ${enabled ? 'enabled' : 'disabled'}`);
    
    if (enabled) {
        notificationSystem.warning('⚠️ Maintenance mode ENABLED - Only admins can access the site');
    } else {
        notificationSystem.success('Maintenance mode disabled - Site is now accessible to all users');
    }
}
    
async publishAnnouncement() {
    const text = document.getElementById('announcementText').value.trim();
    
    if (!text) {
        notificationSystem.warning('Please enter an announcement message');
        return;
    }
    
    const { error } = await supabase
        .from('website_settings')
        .upsert({
            id: 1,
            announcement: text,
            announcement_updated_at: new Date().toISOString(),
            updated_by: this.user.id
        });
        
    if (error) {
        console.error('Error publishing announcement:', error);
        notificationSystem.error('Failed to publish announcement');
        return;
    }
    
    await this.logAction('settings_change', null, `Published announcement: "${text.substring(0, 50)}..."`);
    
    // Update UI
    document.getElementById('announcementStatus').textContent = 
        `📢 Active - Published just now`;
    document.getElementById('announcementStatus').style.color = '#10B981';
    document.getElementById('clearAnnouncementBtn').style.display = 'inline-flex';
    
    notificationSystem.success('📢 Announcement published! All users will see it.');
}

async clearAnnouncement() {
    const { error } = await supabase
        .from('website_settings')
        .update({
            announcement: null,
            announcement_updated_at: null,
            updated_by: this.user.id,
            updated_at: new Date().toISOString()
        })
        .eq('id', 1);
        
    if (error) {
        console.error('Error clearing announcement:', error);
        notificationSystem.error('Failed to clear announcement');
        return;
    }
    
    await this.logAction('settings_change', null, 'Cleared announcement');
    
    document.getElementById('announcementText').value = '';
    notificationSystem.success('Announcement cleared successfully');
}
    
    async initializeCharts() {
    // Fetch real data for charts
    const { data: users } = await supabase
        .from('profiles')
        .select('created_at')
        .order('created_at', { ascending: true });
    
    const { data: trades } = await supabase
        .from('trades')
        .select('created_at');
    
    // === USER GROWTH CHART ===
    const userCtx = document.getElementById('userGrowthChart')?.getContext('2d');
    if (userCtx && users) {
        // Group users by month
        const monthlyUsers = {};
        users.forEach(u => {
            const month = new Date(u.created_at).toLocaleString('en-US', { month: 'short', year: 'numeric' });
            monthlyUsers[month] = (monthlyUsers[month] || 0) + 1;
        });
        
        // Get last 6 months
        const months = [];
        const userCounts = [];
        const now = new Date();
        for (let i = 5; i >= 0; i--) {
            const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
            const key = d.toLocaleString('en-US', { month: 'short', year: 'numeric' });
            months.push(d.toLocaleString('en-US', { month: 'short' }));
            userCounts.push(monthlyUsers[key] || 0);
        }
        
        this.charts.userGrowth = new Chart(userCtx, {
            type: 'line',
            data: {
                labels: months,
                datasets: [{
                    label: 'Total Users',
                    data: userCounts,
                    borderColor: '#9CA3AF',
                    backgroundColor: 'rgba(156, 163, 175, 0.1)',
                    borderWidth: 2,
                    fill: true,
                    tension: 0.4
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: { legend: { display: false } }
            }
        });
    }
    
    // === TRADE ACTIVITY CHART ===
    const tradeCtx = document.getElementById('tradeActivityChart')?.getContext('2d');
    if (tradeCtx && trades) {
        // Count trades by day of week
        const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
        const dayCounts = [0, 0, 0, 0, 0, 0, 0];
        
        trades.forEach(t => {
            const day = new Date(t.created_at).getDay();
            dayCounts[day]++;
        });
        
        this.charts.tradeActivity = new Chart(tradeCtx, {
            type: 'bar',
            data: {
                labels: dayNames,
                datasets: [{
                    label: 'Trades',
                    data: dayCounts,
                    backgroundColor: '#9CA3AF',
                    borderRadius: 8
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: { legend: { display: false } }
            }
        });
    }
}
    
    updateCharts() {
        // Update chart data with real values
        // This would fetch actual historical data from the database
    }
    
    async exportUsers() {
        const { data: users } = await supabase
            .from('profiles')
            .select('*');
            
        const csv = this.convertToCSV(users);
        this.downloadFile(csv, `envy-users-${new Date().toISOString().split('T')[0]}.csv`);
        notificationSystem.success('Users exported successfully');
    }
    
    async exportLogs() {
        const csv = this.convertToCSV(this.logs);
        this.downloadFile(csv, `envy-logs-${new Date().toISOString().split('T')[0]}.csv`);
        notificationSystem.success('Logs exported successfully');
    }
    
    convertToCSV(data) {
        if (!data || data.length === 0) return '';
        
        const headers = Object.keys(data[0]);
        const rows = data.map(row => headers.map(h => JSON.stringify(row[h] || '')).join(','));
        
        return [headers.join(','), ...rows].join('\n');
    }
    
    downloadFile(content, filename) {
        const blob = new Blob([content], { type: 'text/csv' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        a.click();
        URL.revokeObjectURL(url);
    }
    
    changeUserPage(delta) {
        const newPage = this.currentPage + delta;
        if (newPage >= 1 && newPage <= this.totalPages) {
            this.currentPage = newPage;
            this.loadUsers();
        }
    }
    
    changeTradePage(delta) {
        const newPage = this.currentPage + delta;
        if (newPage >= 1 && newPage <= this.totalPages) {
            this.currentPage = newPage;
            this.loadTrades();
        }
    }

    changeLogPage(delta) {           // ← ADD THIS ENTIRE METHOD
        if (!this.logCurrentPage) this.logCurrentPage = 1;
        const newPage = this.logCurrentPage + delta;
        if (newPage >= 1 && newPage <= (this.logTotalPages || 1)) {
            this.logCurrentPage = newPage;
            this.loadLogs();
        }
    }
    
    updateUserPagination() {
        document.getElementById('userPageInfo').textContent = `Page ${this.currentPage} of ${this.totalPages}`;
        document.getElementById('prevUserPageBtn').disabled = this.currentPage <= 1;
        document.getElementById('nextUserPageBtn').disabled = this.currentPage >= this.totalPages;
    }
    
    updateTradePagination() {
        document.getElementById('tradePageInfo').textContent = `Page ${this.currentPage} of ${this.totalPages}`;
        document.getElementById('prevTradePageBtn').disabled = this.currentPage <= 1;
        document.getElementById('nextTradePageBtn').disabled = this.currentPage >= this.totalPages;
    }
    
    updateLogPagination() {
    const page = this.logCurrentPage || 1;
    const total = this.logTotalPages || 1;
    
    document.getElementById('logPageInfo').textContent = `Page ${page} of ${total}`;
    document.getElementById('prevLogPageBtn').disabled = page <= 1;
    document.getElementById('nextLogPageBtn').disabled = page >= total;
}
    
    confirmAction(title, message, callback) {
        document.getElementById('confirmModalTitle').textContent = title;
        document.getElementById('confirmModalMessage').textContent = message;
        this.confirmCallback = callback;
        document.getElementById('confirmModal').classList.add('active');
    }
    
    formatNumber(num, decimals = 2) {
        if (num === null || num === undefined || isNaN(num)) return '0.00';
        return new Intl.NumberFormat('en-US', {
            minimumFractionDigits: decimals,
            maximumFractionDigits: decimals
        }).format(num);
    }
    
    formatDate(timestamp) {
        return new Date(timestamp).toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
            year: 'numeric'
        });
    }
    
    formatDateTime(timestamp) {
        return new Date(timestamp).toLocaleString('en-US', {
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    }
    
    formatTimeAgo(timestamp) {
    if (!timestamp) return 'Never';
    
    const now = new Date();
    const then = new Date(timestamp);
    const diff = now - then;
    
    const seconds = Math.floor(diff / 1000);
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);
    
    if (seconds < 60) return 'Just now';
    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    if (days === 1) return 'Yesterday';
    if (days < 7) return `${days}d ago`;
    if (days < 30) return `${Math.floor(days/7)}w ago`;
    if (days < 365) return `${Math.floor(days/30)}mo ago`;
    return `${Math.floor(days/365)}y ago`;
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
        
        if (this.userProfile) {
            userNameElement.textContent = this.userProfile.full_name || this.user.email.split('@')[0];
            
            if (this.userProfile.avatar_url) {
                userAvatar.src = this.userProfile.avatar_url;
            }
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

// Initialize admin when DOM is ready
let adminManager;
document.addEventListener('DOMContentLoaded', () => {
    adminManager = new AdminManager();
    window.adminManager = adminManager;
});