// ENVY Authentication JavaScript - Complete

import { supabase, auth } from './supabase-client.js';

class AuthManager {
    constructor() {
        this.currentForm = 'signin';
        this.initialize();
    }
    
    async initialize() {
    // Clear any stale data first
    if (window.clearAllUserData) {
        window.clearAllUserData();
    }
    
    // Check if already authenticated
    const { user } = await auth.getUser();
    if (user) {
        window.location.href = 'dashboard.html';
        return;
    }
    
    this.setupEventListeners();
    this.checkRedirectHash();
}
    
    setupEventListeners() {
        // Tab switching
        document.querySelectorAll('.auth-tab').forEach(tab => {
            tab.addEventListener('click', () => {
                const tabName = tab.dataset.tab;
                this.switchTab(tabName);
            });
        });
        
        // Password visibility toggle
        document.querySelectorAll('.password-toggle').forEach(btn => {
            btn.addEventListener('click', () => {
                const targetId = btn.dataset.target;
                const input = document.getElementById(targetId);
                if (input) {
                    input.type = input.type === 'password' ? 'text' : 'password';
                }
            });
        });
        
        // Sign In form
        document.getElementById('signinForm').addEventListener('submit', (e) => {
            e.preventDefault();
            this.handleSignIn();
        });
        
        // Sign Up form
        document.getElementById('signupForm').addEventListener('submit', (e) => {
            e.preventDefault();
            this.handleSignUp();
        });
        
        // Password strength checker
        const signupPassword = document.getElementById('signupPassword');
        if (signupPassword) {
            signupPassword.addEventListener('input', (e) => {
                this.checkPasswordStrength(e.target.value);
            });
        }
        
        // Forgot password
        document.getElementById('forgotPasswordBtn')?.addEventListener('click', () => {
            this.showForgotPassword();
        });
        
        // Forgot password form
        document.getElementById('forgotPasswordForm')?.addEventListener('submit', (e) => {
            e.preventDefault();
            this.handleForgotPassword();
        });
        
        // Back to sign in
        document.getElementById('backToSigninBtn')?.addEventListener('click', () => {
            this.showSignIn();
        });
        
        // Social auth
        document.getElementById('googleSignInBtn')?.addEventListener('click', () => {
            this.handleSocialAuth('google');
        });
        
        document.getElementById('googleSignUpBtn')?.addEventListener('click', () => {
            this.handleSocialAuth('google');
        });
        
        document.getElementById('githubSignInBtn')?.addEventListener('click', () => {
            this.handleSocialAuth('github');
        });
        
        document.getElementById('githubSignUpBtn')?.addEventListener('click', () => {
            this.handleSocialAuth('github');
        });
    }
    
    switchTab(tab) {
        this.currentForm = tab;
        
        // Update tabs
        document.querySelectorAll('.auth-tab').forEach(t => {
            t.classList.toggle('active', t.dataset.tab === tab);
        });
        
        // Show corresponding form
        document.querySelectorAll('.auth-form').forEach(form => {
            form.classList.remove('active');
        });
        
        if (tab === 'signin') {
            document.getElementById('signinForm').classList.add('active');
        } else if (tab === 'signup') {
            document.getElementById('signupForm').classList.add('active');
        }
        
        // Hide forgot password
        document.getElementById('forgotPasswordForm').classList.remove('active');
    }
    
    showForgotPassword() {
        document.querySelectorAll('.auth-tab').forEach(t => t.classList.remove('active'));
        document.querySelectorAll('.auth-form').forEach(form => form.classList.remove('active'));
        document.getElementById('forgotPasswordForm').classList.add('active');
    }
    
    showSignIn() {
        this.switchTab('signin');
    }
    
    async handleSignIn() {
        const email = document.getElementById('signinEmail').value;
        const password = document.getElementById('signinPassword').value;
        const rememberMe = document.getElementById('rememberMe')?.checked;
        
        if (!email || !password) {
            this.showError('Please fill in all fields');
            return;
        }
        
        const submitBtn = document.querySelector('#signinForm .auth-submit-btn');
        this.setLoading(submitBtn, true);
        
        try {
            const { data, error } = await auth.signIn(email, password);
            
            if (error) throw error;
            
            // Set session persistence
            if (!rememberMe) {
                await supabase.auth.setSession({
                    access_token: data.session.access_token,
                    refresh_token: data.session.refresh_token
                });
            }
            
            this.showSuccess('Sign in successful! Redirecting...');
            
            setTimeout(() => {
    // Clear any stale data from previous user
    if (window.clearAllUserData) {
        window.clearAllUserData();
    }
    window.location.href = 'dashboard.html';
}, 500);
            
        } catch (error) {
            this.showError(error.message);
        } finally {
            this.setLoading(submitBtn, false);
        }
    }
    
    async handleSignUp() {
        const name = document.getElementById('signupName').value;
        const email = document.getElementById('signupEmail').value;
        const password = document.getElementById('signupPassword').value;
        const confirmPassword = document.getElementById('signupConfirmPassword').value;
        const agreeTerms = document.getElementById('agreeTerms')?.checked;
        
        if (!name || !email || !password || !confirmPassword) {
            this.showError('Please fill in all fields');
            return;
        }
        
        if (password !== confirmPassword) {
            this.showError('Passwords do not match');
            return;
        }
        
        if (password.length < 8) {
            this.showError('Password must be at least 8 characters');
            return;
        }
        
        if (!agreeTerms) {
            this.showError('Please agree to the Terms and Privacy Policy');
            return;
        }
        
        const submitBtn = document.querySelector('#signupForm .auth-submit-btn');
        this.setLoading(submitBtn, true);
        
        try {
            const { data, error } = await auth.signUp(email, password, name);
            
            if (error) throw error;
            
            if (data.user) {
                this.showSuccess('Account created successfully! Please check your email to confirm your account.');
                
                // Switch to sign in after 3 seconds
                setTimeout(() => {
                    this.switchTab('signin');
                }, 3000);
            }
            
        } catch (error) {
            this.showError(error.message);
        } finally {
            this.setLoading(submitBtn, false);
        }
    }
    
    async handleForgotPassword() {
        const email = document.getElementById('resetEmail').value;
        
        if (!email) {
            this.showError('Please enter your email');
            return;
        }
        
        const submitBtn = document.querySelector('#forgotPasswordForm .auth-submit-btn');
        this.setLoading(submitBtn, true);
        
        try {
            const { error } = await auth.resetPassword(email);
            
            if (error) throw error;
            
            this.showSuccess('Password reset link sent! Please check your email.');
            
            setTimeout(() => {
                this.showSignIn();
            }, 3000);
            
        } catch (error) {
            this.showError(error.message);
        } finally {
            this.setLoading(submitBtn, false);
        }
    }
    
    async handleSocialAuth(provider) {
        try {
            const { data, error } = await supabase.auth.signInWithOAuth({
                provider: provider,
                options: {
                    redirectTo: window.location.origin + '/dashboard.html'
                }
            });
            
            if (error) throw error;
            
        } catch (error) {
            this.showError(error.message);
        }
    }
    
    checkPasswordStrength(password) {
        const bar = document.querySelector('.strength-bar');
        const text = document.querySelector('.strength-text');
        
        let strength = 0;
        let className = 'weak';
        let message = 'Weak';
        
        if (password.length >= 8) strength++;
        if (password.match(/[a-z]/) && password.match(/[A-Z]/)) strength++;
        if (password.match(/[0-9]/)) strength++;
        if (password.match(/[^a-zA-Z0-9]/)) strength++;
        
        if (strength === 1) {
            className = 'weak';
            message = 'Weak';
        } else if (strength === 2) {
            className = 'medium';
            message = 'Medium';
        } else if (strength === 3) {
            className = 'strong';
            message = 'Strong';
        } else if (strength === 4) {
            className = 'very-strong';
            message = 'Very Strong';
        }
        
        bar.className = 'strength-bar ' + className;
        text.textContent = `Password strength: ${message}`;
    }
    
    checkRedirectHash() {
        const hash = window.location.hash;
        
        if (hash.includes('type=recovery')) {
            // Handle password recovery
            this.showForgotPassword();
        }
    }
    
    showError(message) {
        this.showMessage(message, 'error');
    }
    
    showSuccess(message) {
        this.showMessage(message, 'success');
    }
    
    showMessage(message, type) {
        // Remove existing messages
        const existingMessage = document.querySelector('.auth-message');
        if (existingMessage) {
            existingMessage.remove();
        }
        
        const messageEl = document.createElement('div');
        messageEl.className = `auth-message auth-${type}`;
        messageEl.textContent = message;
        
        const card = document.querySelector('.auth-card');
        card.insertBefore(messageEl, card.firstChild);
        
        // Auto remove after 5 seconds
        setTimeout(() => {
            messageEl.remove();
        }, 5000);
    }
    
    setLoading(button, isLoading) {
        if (isLoading) {
            button.disabled = true;
            const originalText = button.innerHTML;
            button.dataset.originalText = originalText;
            button.innerHTML = '<span class="spinner"></span> Loading...';
        } else {
            button.disabled = false;
            button.innerHTML = button.dataset.originalText || button.innerHTML;
        }
    }
}

// Initialize auth when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    new AuthManager();
});