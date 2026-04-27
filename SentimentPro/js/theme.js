/* ============================================================
   BanglaSentiment Pro — Theme Loader
   Runs on every page BEFORE content renders.
   Reads saved theme/compact from localStorage and applies it.
   ============================================================ */
(function () {
    'use strict';

    // Read saved preferences
    var savedTheme = localStorage.getItem('bsp_theme') || 'light';
    var savedCompact = localStorage.getItem('bsp_compact') || 'false';

    // System theme detection
    if (savedTheme === 'system') {
        var prefersDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
        document.documentElement.setAttribute('data-theme', prefersDark ? 'dark' : 'light');

        // Listen for OS theme changes
        window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', function (e) {
            if (localStorage.getItem('bsp_theme') === 'system') {
                document.documentElement.setAttribute('data-theme', e.matches ? 'dark' : 'light');
            }
        });
    } else {
        document.documentElement.setAttribute('data-theme', savedTheme);
    }

    // Compact mode
    document.documentElement.setAttribute('data-compact', savedCompact);

    // Expose helper for settings.js to call when user changes theme
    window.applyTheme = function (theme) {
        localStorage.setItem('bsp_theme', theme);
        if (theme === 'system') {
            var prefersDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
            document.documentElement.setAttribute('data-theme', prefersDark ? 'dark' : 'light');
        } else {
            document.documentElement.setAttribute('data-theme', theme);
        }
    };

    window.applyCompact = function (enabled) {
        localStorage.setItem('bsp_compact', String(enabled));
        document.documentElement.setAttribute('data-compact', String(enabled));
    };
})();
