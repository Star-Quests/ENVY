// ============================================
// ENVY Mobile Menu Fix - Add to global.js
// ============================================
// Find the initializeMobileMenu function and replace it with this:

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
