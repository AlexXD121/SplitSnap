/**
 * ThemeManager - Handles theme detection, switching, and persistence
 * Supports light, dark, and auto (system preference) themes
 */
class ThemeManager {
    constructor() {
        this.currentTheme = 'auto';
        this.systemTheme = 'light';
        this.themes = {
            light: 'light',
            dark: 'dark',
            auto: 'auto'
        };

        this.init();
    }

    init() {
        // Detect system theme preference
        this.detectSystemTheme();

        // Load saved theme preference
        this.loadThemePreference();

        // Apply initial theme
        this.applyTheme();

        // Listen for system theme changes
        this.setupSystemThemeListener();

        // Setup theme toggle button
        this.setupThemeToggle();

        // Add keyboard shortcut for theme toggle (Ctrl/Cmd + Shift + T)
        this.setupKeyboardShortcut();

        console.log('ThemeManager initialized');
    }

    /**
     * Setup keyboard shortcut for theme toggle
     */
    setupKeyboardShortcut() {
        document.addEventListener('keydown', (e) => {
            if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'T') {
                e.preventDefault();
                this.toggleTheme();
            }
        });
    }

    /**
     * Detect system theme preference
     */
    detectSystemTheme() {
        if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
            this.systemTheme = 'dark';
        } else {
            this.systemTheme = 'light';
        }

        console.log('System theme detected:', this.systemTheme);
    }

    /**
     * Load theme preference from localStorage
     */
    loadThemePreference() {
        const savedTheme = localStorage.getItem('splitsnap-theme');

        if (savedTheme && Object.values(this.themes).includes(savedTheme)) {
            this.currentTheme = savedTheme;
        } else {
            // Default to auto if no preference saved
            this.currentTheme = 'auto';
        }

        console.log('Theme preference loaded:', this.currentTheme);
    }

    /**
     * Save theme preference to localStorage
     */
    persistTheme() {
        localStorage.setItem('splitsnap-theme', this.currentTheme);
        console.log('Theme preference saved:', this.currentTheme);
    }

    /**
     * Get the effective theme (resolves 'auto' to actual theme)
     */
    getEffectiveTheme() {
        if (this.currentTheme === 'auto') {
            return this.systemTheme;
        }
        return this.currentTheme;
    }

    /**
     * Apply theme to the document with smooth transitions
     */
    applyTheme() {
        const effectiveTheme = this.getEffectiveTheme();
        const root = document.documentElement;

        // Add theme switching class for enhanced transitions
        root.classList.add('theme-switching');

        // Remove existing theme classes
        root.removeAttribute('data-theme');

        // Apply new theme with a slight delay for smooth transition
        setTimeout(() => {
            if (effectiveTheme === 'dark') {
                root.setAttribute('data-theme', 'dark');
            }
            // Light theme is default, no attribute needed

            // Update meta theme-color for mobile browsers
            this.updateMetaThemeColor(effectiveTheme);

            // Update theme toggle button icon
            this.updateThemeToggleIcon();

            // Remove theme switching class after transition
            setTimeout(() => {
                root.classList.remove('theme-switching');
            }, 500);

            // Dispatch theme change event for other components
            this.dispatchThemeChangeEvent(effectiveTheme);

            console.log('Theme applied:', effectiveTheme);
        }, 50);
    }

    /**
     * Update meta theme-color for mobile browsers
     */
    updateMetaThemeColor(theme) {
        const metaThemeColor = document.querySelector('meta[name="theme-color"]');
        if (metaThemeColor) {
            if (theme === 'dark') {
                metaThemeColor.setAttribute('content', '#1A1A1A');
            } else {
                metaThemeColor.setAttribute('content', '#FF6B35');
            }
        }
    }

    /**
     * Dispatch custom theme change event
     */
    dispatchThemeChangeEvent(theme) {
        const event = new CustomEvent('themechange', {
            detail: {
                theme: theme,
                currentTheme: this.currentTheme,
                systemTheme: this.systemTheme
            }
        });
        document.dispatchEvent(event);
    }

    /**
     * Set theme and persist preference
     */
    setTheme(themeName) {
        if (!Object.values(this.themes).includes(themeName)) {
            console.error('Invalid theme name:', themeName);
            return;
        }

        this.currentTheme = themeName;
        this.persistTheme();
        this.applyTheme();

        console.log('Theme set to:', themeName);
    }

    /**
     * Toggle between light and dark themes
     */
    toggleTheme() {
        const effectiveTheme = this.getEffectiveTheme();

        // Add visual feedback for theme toggle
        const themeToggleBtn = document.querySelector('.theme-toggle-btn');
        if (themeToggleBtn) {
            themeToggleBtn.classList.add('theme-switching');
        }

        if (effectiveTheme === 'light') {
            this.setTheme('dark');
        } else {
            this.setTheme('light');
        }
    }

    /**
     * Update theme toggle button icon with smooth animations
     */
    updateThemeToggleIcon() {
        const themeIcon = document.querySelector('.theme-icon');
        const themeToggleBtn = document.querySelector('.theme-toggle-btn');
        if (!themeIcon || !themeToggleBtn) return;

        const effectiveTheme = this.getEffectiveTheme();

        // Remove existing animation classes
        themeIcon.classList.remove('sun', 'moon');
        
        // Add switching animation to button
        themeToggleBtn.classList.add('theme-switching');
        
        // Update icon with animation after a short delay
        setTimeout(() => {
            const tooltip = themeToggleBtn.querySelector('.theme-tooltip');
            
            if (effectiveTheme === 'dark') {
                themeIcon.textContent = '☀️'; // Sun icon for switching to light
                themeIcon.classList.add('sun');
                themeToggleBtn.setAttribute('title', 'Switch to light theme');
                themeToggleBtn.setAttribute('aria-label', 'Switch to light theme');
                if (tooltip) {
                    tooltip.textContent = 'Switch to light theme';
                }
            } else {
                themeIcon.textContent = '🌙'; // Moon icon for switching to dark
                themeIcon.classList.add('moon');
                themeToggleBtn.setAttribute('title', 'Switch to dark theme');
                themeToggleBtn.setAttribute('aria-label', 'Switch to dark theme');
                if (tooltip) {
                    tooltip.textContent = 'Switch to dark theme';
                }
            }
            
            // Remove switching animation class
            setTimeout(() => {
                themeToggleBtn.classList.remove('theme-switching');
            }, 600);
        }, 100);
    }

    /**
     * Setup theme toggle button event listener with enhanced interactions
     */
    setupThemeToggle() {
        const themeToggleBtn = document.getElementById('theme-toggle-btn');
        if (themeToggleBtn) {
            this.attachThemeToggleListeners(themeToggleBtn);
        } else {
            // If button doesn't exist yet, try again after a short delay
            setTimeout(() => {
                const btn = document.getElementById('theme-toggle-btn');
                if (btn) {
                    this.attachThemeToggleListeners(btn);
                }
            }, 500);
        }
    }

    /**
     * Attach all theme toggle event listeners
     */
    attachThemeToggleListeners(button) {
        // Click handler
        button.addEventListener('click', (e) => {
            e.preventDefault();
            this.toggleTheme();
        });

        // Keyboard accessibility
        button.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                this.toggleTheme();
            }
        });

        // Enhanced hover effects
        button.addEventListener('mouseenter', () => {
            button.style.transform = 'scale(1.05)';
        });

        button.addEventListener('mouseleave', () => {
            if (!button.classList.contains('theme-switching')) {
                button.style.transform = '';
            }
        });

        // Focus handling for accessibility
        button.addEventListener('focus', () => {
            button.style.outline = '2px solid var(--primary)';
            button.style.outlineOffset = '2px';
        });

        button.addEventListener('blur', () => {
            button.style.outline = '';
            button.style.outlineOffset = '';
        });

        console.log('Theme toggle listeners attached');
    }

    /**
     * Setup system theme change listener
     */
    setupSystemThemeListener() {
        if (window.matchMedia) {
            const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');

            // Listen for changes
            mediaQuery.addEventListener('change', (e) => {
                this.systemTheme = e.matches ? 'dark' : 'light';
                console.log('System theme changed to:', this.systemTheme);

                // Re-apply theme if using auto mode
                if (this.currentTheme === 'auto') {
                    this.applyTheme();
                }
            });
        }
    }

    /**
     * Get all available themes
     */
    getAvailableThemes() {
        return Object.keys(this.themes);
    }

    /**
     * Check if a theme is valid
     */
    isValidTheme(themeName) {
        return Object.values(this.themes).includes(themeName);
    }

    /**
     * Get current theme info for debugging
     */
    getThemeInfo() {
        return {
            currentTheme: this.currentTheme,
            systemTheme: this.systemTheme,
            effectiveTheme: this.getEffectiveTheme(),
            availableThemes: this.getAvailableThemes(),
            supportsSystemDetection: !!(window.matchMedia)
        };
    }
}

// Initialize theme manager immediately to prevent flash of unstyled content
window.themeManager = new ThemeManager();