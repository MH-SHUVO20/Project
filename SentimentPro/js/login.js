/* ============================================================
   BanglaSentiment Pro — Login / Register  (JS)
   Tab switching · Password toggle · Form validation & submit
   ============================================================ */

document.addEventListener('DOMContentLoaded', () => {
    /* ---------- DOM Refs ---------- */
    const tabSignIn   = document.getElementById('tabSignIn');
    const tabRegister = document.getElementById('tabRegister');
    const indicator   = document.getElementById('tabIndicator');
    const signinForm  = document.getElementById('signinForm');
    const registerForm = document.getElementById('registerForm');

    const eyeToggle      = document.getElementById('eyeToggle');
    const signinPassword = document.getElementById('signinPassword');

    const signinBtn  = document.getElementById('signinBtn');
    const registerBtn = document.getElementById('registerBtn');

    /* ---------- Tab Switching ---------- */
    function switchTab(tab) {
        const isSignIn = tab === 'signin';

        tabSignIn.classList.toggle('active', isSignIn);
        tabRegister.classList.toggle('active', !isSignIn);
        tabSignIn.setAttribute('aria-selected', isSignIn);
        tabRegister.setAttribute('aria-selected', !isSignIn);

        // Slide indicator
        indicator.style.transform = isSignIn ? 'translateX(0)' : 'translateX(100%)';

        // Swap forms
        if (isSignIn) {
            registerForm.classList.add('hidden');
            signinForm.classList.remove('hidden');
            signinForm.style.animation = 'none';
            signinForm.offsetHeight; // reflow
            signinForm.style.animation = '';
        } else {
            signinForm.classList.add('hidden');
            registerForm.classList.remove('hidden');
            registerForm.style.animation = 'none';
            registerForm.offsetHeight;
            registerForm.style.animation = '';
        }
    }

    tabSignIn.addEventListener('click', () => switchTab('signin'));
    tabRegister.addEventListener('click', () => switchTab('register'));

    /* ---------- Password Visibility Toggle ---------- */
    function setupEyeToggle(toggleBtn, inputId) {
        const input = document.getElementById(inputId);
        if (!toggleBtn || !input) return;

        toggleBtn.addEventListener('click', () => {
            const isVisible = toggleBtn.classList.toggle('visible');
            input.type = isVisible ? 'text' : 'password';
        });
    }

    // Main sign-in password toggle
    setupEyeToggle(eyeToggle, 'signinPassword');

    // Register form password toggle(s) — use data-target
    document.querySelectorAll('.eye-toggle[data-target]').forEach(btn => {
        setupEyeToggle(btn, btn.dataset.target);
    });

    /* ---------- Lightweight Validation Helpers ---------- */
    function isValidEmail(email) {
        return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
    }

    function shakeField(inputWrap) {
        inputWrap.style.animation = 'none';
        inputWrap.offsetHeight;
        inputWrap.style.animation = 'shake 0.35s ease';
        inputWrap.addEventListener('animationend', () => {
            inputWrap.style.animation = '';
        }, { once: true });
    }

    // Toast and shake styles are now loaded from css/toast.css

    /* Toast helper */
    function showToast(message, type = 'error', duration = 3000) {
        // Remove any existing toast
        const existing = document.querySelector('.toast');
        if (existing) existing.remove();

        const toast = document.createElement('div');
        toast.className = `toast ${type}`;
        toast.innerHTML = type === 'error'
            ? `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>${message}`
            : `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><path d="M20 6 9 17l-5-5"/></svg>${message}`;
        document.body.appendChild(toast);

        requestAnimationFrame(() => {
            requestAnimationFrame(() => toast.classList.add('show'));
        });

        setTimeout(() => {
            toast.classList.remove('show');
            setTimeout(() => toast.remove(), 400);
        }, duration);
    }

    function markError(input) {
        input.classList.add('error');
        shakeField(input.closest('.input-wrap'));
        input.addEventListener('input', () => input.classList.remove('error'), { once: true });
    }

    /* ---------- Sign In Submit ---------- */
    signinForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        let valid = true;

        const email = document.getElementById('signinEmail');
        const pwd   = document.getElementById('signinPassword');

        if (!isValidEmail(email.value.trim())) { markError(email); valid = false; }
        if (pwd.value.length < 1)              { markError(pwd);   valid = false; }

        if (!valid) return;

        signinBtn.classList.add('loading');

        try {
            if (!window.apiClient) {
                throw new Error('API client is not loaded.');
            }

            const loginRes = await window.apiClient.login({
                email: email.value.trim(),
                password: pwd.value
            });

            // Accept common token field variants used by FastAPI auth responses.
            const token = loginRes.access_token || loginRes.token;
            if (!token) {
                throw new Error('Login succeeded but no token was returned.');
            }

            window.apiClient.setToken(token);
            window.apiClient.setUser(loginRes.user || { email: email.value.trim() });

            signinBtn.classList.remove('loading');
            showToast('Login successful! Redirecting…', 'success', 2000);
            setTimeout(() => {
                window.location.href = 'onboarding.html';
            }, 1000);
        } catch (err) {
            signinBtn.classList.remove('loading');
            showToast(err.message || 'Login failed', 'error', 4000);
            markError(email);
            markError(pwd);
        }
    });

    /* ---------- Register Submit ---------- */
    registerForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        let valid = true;

        const name    = document.getElementById('regName');
        const email   = document.getElementById('regEmail');
        const pwd     = document.getElementById('regPassword');
        const confirm = document.getElementById('regConfirm');
        const agree   = document.getElementById('agreeTerms');

        if (name.value.trim().length < 2)      { markError(name);  valid = false; }
        if (!isValidEmail(email.value.trim()))  { markError(email); valid = false; }
        if (pwd.value.length < 8)               { markError(pwd);   valid = false; }
        if (confirm.value !== pwd.value)         { markError(confirm); valid = false; }
        if (!agree.checked)                      { valid = false; }

        if (!valid) return;

        registerBtn.classList.add('loading');

        try {
            if (!window.apiClient) {
                throw new Error('API client is not loaded.');
            }

            await window.apiClient.register({
                name: name.value.trim(),
                email: email.value.trim(),
                password: pwd.value
            });

            // Auto-login after successful registration.
            const loginRes = await window.apiClient.login({
                email: email.value.trim(),
                password: pwd.value
            });
            const token = loginRes.access_token || loginRes.token;
            if (token) {
                window.apiClient.setToken(token);
            }
            window.apiClient.setUser(loginRes.user || { email: email.value.trim(), name: name.value.trim() });

            registerBtn.classList.remove('loading');
            showToast('Account created! Redirecting…', 'success', 2000);
            setTimeout(() => {
                window.location.href = 'onboarding.html';
            }, 1000);
        } catch (err) {
            registerBtn.classList.remove('loading');
            showToast(err.message || 'Registration failed', 'error', 4000);
        }
    });

    /* ---------- Input Focus Micro-interaction ---------- */
    document.querySelectorAll('.input').forEach(input => {
        input.addEventListener('focus', () => {
            input.closest('.input-wrap').style.transform = 'scale(1.008)';
            input.closest('.input-wrap').style.transition = 'transform 0.2s ease';
        });
        input.addEventListener('blur', () => {
            input.closest('.input-wrap').style.transform = 'scale(1)';
        });
    });
});
