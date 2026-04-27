/* ============================================================
   BanglaSentiment Pro — Settings
   Real account/profile actions backed by FastAPI.
   ============================================================ */

document.addEventListener('DOMContentLoaded', () => {
    const tabs = document.querySelectorAll('.settings-tab');
    const sections = document.querySelectorAll('.settings-section');

    const profileName = document.getElementById('profileName');
    const profileEmail = document.getElementById('profileEmail');
    const avatar = document.getElementById('avatar');
    const firstName = document.getElementById('firstName');
    const lastName = document.getElementById('lastName');
    const emailField = document.getElementById('emailField');
    const company = document.getElementById('company');
    const bio = document.getElementById('bio');
    const toggle2fa = document.getElementById('toggle2fa');
    const notifyAnalysisComplete = document.getElementById('notifyAnalysisComplete');
    const notifyWeeklySummary = document.getElementById('notifyWeeklySummary');
    const notifyProductUpdates = document.getElementById('notifyProductUpdates');
    const notifyMarketingEmails = document.getElementById('notifyMarketingEmails');
    const langSelect = document.getElementById('langSelect');
    const compactToggle = document.getElementById('compactToggle');

    let loadedUser = null;

    if (!window.apiClient || !window.apiClient.getToken()) {
        window.location.href = 'login.html';
        return;
    }

    tabs.forEach(tab => {
        tab.addEventListener('click', () => {
            const target = tab.dataset.section;
            tabs.forEach(t => t.classList.remove('active'));
            tab.classList.add('active');

            sections.forEach(section => {
                section.classList.toggle('active', section.dataset.section === target);
            });
        });
    });

    function splitName(name) {
        const parts = (name || '').trim().split(/\s+/).filter(Boolean);
        return {
            first: parts[0] || '',
            last: parts.slice(1).join(' ')
        };
    }

    function renderUser(user) {
        loadedUser = user;
        window.apiClient.setUser(user);

        const nameParts = splitName(user.name);
        profileName.textContent = user.name || user.email;
        profileEmail.textContent = user.email;
        avatar.textContent = (user.name || user.email || 'U').charAt(0).toUpperCase();
        firstName.value = nameParts.first;
        lastName.value = nameParts.last;
        emailField.value = user.email || '';
        company.value = user.company || '';
        bio.value = user.bio || '';

        if (toggle2fa) toggle2fa.checked = Boolean(user.two_factor_enabled);
        if (notifyAnalysisComplete) notifyAnalysisComplete.checked = user.notify_analysis_complete !== false;
        if (notifyWeeklySummary) notifyWeeklySummary.checked = user.notify_weekly_summary !== false;
        if (notifyProductUpdates) notifyProductUpdates.checked = Boolean(user.notify_product_updates);
        if (notifyMarketingEmails) notifyMarketingEmails.checked = Boolean(user.notify_marketing_emails);
        if (langSelect) langSelect.value = user.language || 'en';
        if (compactToggle) compactToggle.checked = Boolean(user.compact_mode);

        document.querySelectorAll('.theme-btn').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.theme === (user.theme || 'light'));
        });
    }

    function getProfilePayload(overrides) {
        const fullName = `${firstName.value.trim()} ${lastName.value.trim()}`.trim();
        return Object.assign({
            name: fullName || (loadedUser && loadedUser.name) || '',
            email: emailField.value.trim() || (loadedUser && loadedUser.email) || '',
            company: company.value.trim(),
            bio: bio.value.trim(),
            two_factor_enabled: toggle2fa ? toggle2fa.checked : false,
            notify_analysis_complete: notifyAnalysisComplete ? notifyAnalysisComplete.checked : true,
            notify_weekly_summary: notifyWeeklySummary ? notifyWeeklySummary.checked : true,
            notify_product_updates: notifyProductUpdates ? notifyProductUpdates.checked : false,
            notify_marketing_emails: notifyMarketingEmails ? notifyMarketingEmails.checked : false,
            theme: document.querySelector('.theme-btn.active')?.dataset.theme || (loadedUser && loadedUser.theme) || 'light',
            language: langSelect ? langSelect.value : ((loadedUser && loadedUser.language) || 'en'),
            compact_mode: compactToggle ? compactToggle.checked : false
        }, overrides || {});
    }

    async function saveUserSettings(overrides, successMessage) {
        const payload = getProfilePayload(overrides);
        if (!payload.name || !payload.email) {
            showToast('Name and email are required before saving settings', 'danger');
            return null;
        }

        const user = await window.apiClient.updateMe(payload);
        renderUser(user);
        if (successMessage) showToast(successMessage, 'success');
        return user;
    }

    async function loadAccount() {
        try {
            const user = await window.apiClient.getMe();
            renderUser(user);

            const stats = await window.apiClient.getStats();
            const statNums = document.querySelectorAll('.p-stat-num');
            if (statNums[0]) statNums[0].textContent = Number(stats.total_analyses || 0).toLocaleString();
            if (statNums[1]) statNums[1].textContent = Number(stats.total_reviews || 0).toLocaleString();
            if (statNums[2]) {
                const date = user.created_at ? new Date(user.created_at) : new Date();
                statNums[2].textContent = date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
            }
        } catch (err) {
            window.apiClient.clearAuth();
            window.location.href = 'login.html';
        }
    }

    const saveProfileBtn = document.getElementById('saveProfileBtn');
    if (saveProfileBtn) {
        saveProfileBtn.addEventListener('click', async () => {
            const fullName = `${firstName.value.trim()} ${lastName.value.trim()}`.trim();
            if (!fullName || !emailField.value.trim()) {
                showToast('Name and email are required', 'danger');
                return;
            }

            try {
                await saveUserSettings({
                    name: fullName,
                    email: emailField.value.trim()
                });
                showToast('Profile updated in database', 'success');
            } catch (err) {
                showToast(err.message || 'Failed to update profile', 'danger');
            }
        });
    }

    const cancelProfileBtn = document.getElementById('cancelProfileBtn');
    if (cancelProfileBtn) {
        cancelProfileBtn.addEventListener('click', () => {
            if (loadedUser) renderUser(loadedUser);
            showToast('Changes discarded', 'info');
        });
    }

    const avatarEditBtn = document.getElementById('avatarEditBtn');
    if (avatarEditBtn) {
        avatarEditBtn.addEventListener('click', () => {
            showToast('Avatar upload is not part of this backend', 'info');
        });
    }

    const updatePassBtn = document.getElementById('updatePassBtn');
    if (updatePassBtn) {
        updatePassBtn.addEventListener('click', async () => {
            const currentPassword = document.getElementById('currentPass').value;
            const newPassword = document.getElementById('newPass').value;
            const confirmPassword = document.getElementById('confirmPass').value;

            if (!currentPassword || !newPassword || !confirmPassword) {
                showToast('Please fill all password fields', 'danger');
                return;
            }
            if (newPassword !== confirmPassword) {
                showToast('Passwords do not match', 'danger');
                return;
            }
            if (newPassword.length < 8) {
                showToast('Password must be at least 8 characters', 'danger');
                return;
            }

            try {
                await window.apiClient.changePassword({
                    current_password: currentPassword,
                    new_password: newPassword
                });
                document.getElementById('currentPass').value = '';
                document.getElementById('newPass').value = '';
                document.getElementById('confirmPass').value = '';
                showToast('Password hash updated in database', 'success');
            } catch (err) {
                showToast(err.message || 'Failed to update password', 'danger');
            }
        });
    }

    const exportDataBtn = document.getElementById('exportDataBtn');
    if (exportDataBtn) {
        exportDataBtn.addEventListener('click', async () => {
            try {
                const data = await window.apiClient.exportAccountData();
                const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
                const url = URL.createObjectURL(blob);
                const link = document.createElement('a');
                link.href = url;
                link.download = 'sentimentpro-export.json';
                link.click();
                URL.revokeObjectURL(url);
                showToast('Data exported from database', 'success');
            } catch (err) {
                showToast(err.message || 'Failed to export data', 'danger');
            }
        });
    }

    const deleteAccountBtn = document.getElementById('deleteAccountBtn');
    if (deleteAccountBtn) {
        deleteAccountBtn.addEventListener('click', async () => {
            if (!confirm('Delete your account and all saved analyses? This cannot be undone.')) return;

            try {
                await window.apiClient.deleteAccount();
                window.apiClient.clearAuth();
                localStorage.removeItem('bsp_latest_result');
                window.location.href = 'login.html';
            } catch (err) {
                showToast(err.message || 'Failed to delete account', 'danger');
            }
        });
    }

    // ── API Key Management ──────────────────────────────

    const apiKeyListEl = document.getElementById('apiKeyList');
    const generateKeyBtn = document.getElementById('generateKeyBtn');
    const apiKeyLabelInput = document.getElementById('apiKeyLabel');
    const newKeyAlert = document.getElementById('newKeyAlert');
    const newKeyValue = document.getElementById('newKeyValue');
    const copyNewKeyBtn = document.getElementById('copyNewKeyBtn');
    const copyUsageBtn = document.getElementById('copyUsageBtn');

    let apiKeysData = [];

    function renderApiKeys() {
        if (!apiKeyListEl) return;

        if (apiKeysData.length === 0) {
            apiKeyListEl.innerHTML = '<p style="color:#a1a1aa;font-size:0.85rem;padding:8px 0">No API keys generated yet. Create one to get started.</p>';
        } else {
            apiKeyListEl.innerHTML = apiKeysData.map(key => {
                const isActive = key.is_active;
                const statusClass = isActive ? 'active' : 'revoked-status';
                const statusLabel = isActive ? 'Active' : 'Revoked';
                const itemClass = isActive ? '' : ' revoked';
                const lastUsed = key.last_used_at
                    ? new Date(key.last_used_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
                    : 'Never';
                const created = key.created_at
                    ? new Date(key.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
                    : '';

                return `
                    <div class="api-key-item${itemClass}">
                        <div class="api-key-info">
                            <strong>${escHtml(key.label || 'API Key')} <span class="api-key-status ${statusClass}">${statusLabel}</span></strong>
                            <code class="api-key-value">${escHtml(key.prefix)}••••••••••••</code>
                            <div class="api-key-meta">Created: ${created} &middot; Last used: ${lastUsed}</div>
                        </div>
                        <div class="api-key-actions">
                            ${isActive ? `<button class="btn-sm btn-sm-danger revoke-key-btn" data-id="${key.id}">Revoke</button>` : ''}
                        </div>
                    </div>
                `;
            }).join('');

            // Bind revoke buttons
            apiKeyListEl.querySelectorAll('.revoke-key-btn').forEach(btn => {
                btn.addEventListener('click', async () => {
                    if (!confirm('Revoke this API key? It will stop working immediately.')) return;
                    try {
                        await window.apiClient.revokeApiKey(btn.dataset.id);
                        showToast('API key revoked', 'success');
                        await loadApiKeys();
                    } catch (err) {
                        showToast(err.message || 'Failed to revoke key', 'danger');
                    }
                });
            });
        }

        // Update usage stats
        const activeCount = apiKeysData.filter(k => k.is_active).length;
        const usageActiveKeys = document.getElementById('usageActiveKeys');
        const usageKeysFill = document.getElementById('usageKeysFill');
        if (usageActiveKeys) usageActiveKeys.textContent = `${activeCount} / 5`;
        if (usageKeysFill) usageKeysFill.style.width = `${(activeCount / 5) * 100}%`;
    }

    async function loadApiKeys() {
        if (!window.apiClient || !window.apiClient.listApiKeys) return;
        try {
            const response = await window.apiClient.listApiKeys();
            apiKeysData = response.keys || [];
            renderApiKeys();
        } catch (err) {
            if (apiKeyListEl) {
                apiKeyListEl.innerHTML = '<p style="color:#EF4444;font-size:0.85rem">Failed to load API keys</p>';
            }
        }
    }

    if (generateKeyBtn) {
        generateKeyBtn.addEventListener('click', async () => {
            const label = (apiKeyLabelInput && apiKeyLabelInput.value.trim()) || 'default';
            generateKeyBtn.disabled = true;
            generateKeyBtn.textContent = 'Generating...';

            try {
                const result = await window.apiClient.createApiKey({ label: label });

                // Show the raw key (only shown once)
                if (newKeyAlert && newKeyValue) {
                    newKeyValue.textContent = result.key;
                    newKeyAlert.style.display = '';
                }

                if (apiKeyLabelInput) apiKeyLabelInput.value = '';
                showToast('API key generated successfully', 'success');
                await loadApiKeys();

                // Update usage stats with total analyses
                try {
                    const stats = await window.apiClient.getStats();
                    const usageApiCalls = document.getElementById('usageApiCalls');
                    const usageApiFill = document.getElementById('usageApiFill');
                    if (usageApiCalls) usageApiCalls.textContent = `${Number(stats.total_analyses || 0).toLocaleString()}`;
                    if (usageApiFill) usageApiFill.style.width = `${Math.min(100, Number(stats.total_analyses || 0))}%`;
                } catch (e) { /* ignore */ }
            } catch (err) {
                showToast(err.message || 'Failed to generate API key', 'danger');
            } finally {
                generateKeyBtn.disabled = false;
                generateKeyBtn.innerHTML = `<svg viewBox="0 0 20 20" fill="currentColor" width="16" height="16"><path d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z"/></svg> Generate New Key`;
            }
        });
    }

    if (copyNewKeyBtn && newKeyValue) {
        copyNewKeyBtn.addEventListener('click', () => {
            navigator.clipboard.writeText(newKeyValue.textContent).then(() => {
                copyNewKeyBtn.textContent = 'Copied!';
                copyNewKeyBtn.style.color = '#22C55E';
                setTimeout(() => {
                    copyNewKeyBtn.textContent = 'Copy';
                    copyNewKeyBtn.style.color = '';
                }, 2000);
            });
        });
    }

    if (copyUsageBtn) {
        copyUsageBtn.addEventListener('click', () => {
            const code = document.getElementById('apiUsageCode');
            if (code) {
                navigator.clipboard.writeText(code.textContent).then(() => {
                    copyUsageBtn.textContent = 'Copied!';
                    setTimeout(() => { copyUsageBtn.textContent = 'Copy'; }, 2000);
                });
            }
        });
    }

    // ── Notifications ───────────────────────────────────

    const saveNotifBtn = document.getElementById('saveNotifBtn');
    if (saveNotifBtn) {
        saveNotifBtn.addEventListener('click', async () => {
            try {
                await saveUserSettings({}, 'Notification preferences saved in database');
            } catch (err) {
                showToast(err.message || 'Failed to save notification preferences', 'danger');
            }
        });
    }

    if (toggle2fa) {
        toggle2fa.addEventListener('change', async () => {
            try {
                await saveUserSettings({}, toggle2fa.checked ? '2FA preference saved in database' : '2FA preference disabled in database');
            } catch (err) {
                toggle2fa.checked = !toggle2fa.checked;
                showToast(err.message || 'Failed to save 2FA preference', 'danger');
            }
        });
    }

    // ── Appearance ──────────────────────────────────────

    document.querySelectorAll('.theme-btn').forEach(btn => {
        btn.addEventListener('click', async () => {
            const previous = document.querySelector('.theme-btn.active');
            document.querySelectorAll('.theme-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            // Apply theme visually immediately
            if (window.applyTheme) window.applyTheme(btn.dataset.theme);
            try {
                await saveUserSettings({ theme: btn.dataset.theme }, `Theme set to ${btn.dataset.theme}`);
            } catch (err) {
                btn.classList.remove('active');
                if (previous) previous.classList.add('active');
                if (window.applyTheme && previous) window.applyTheme(previous.dataset.theme);
                showToast(err.message || 'Failed to save theme', 'danger');
            }
        });
    });

    if (compactToggle) {
        compactToggle.addEventListener('change', async () => {
            // Apply compact mode visually immediately
            if (window.applyCompact) window.applyCompact(compactToggle.checked);
            try {
                await saveUserSettings({}, compactToggle.checked ? 'Compact mode enabled' : 'Compact mode disabled');
            } catch (err) {
                compactToggle.checked = !compactToggle.checked;
                if (window.applyCompact) window.applyCompact(compactToggle.checked);
                showToast(err.message || 'Failed to save compact mode', 'danger');
            }
        });
    }

    if (langSelect) {
        langSelect.addEventListener('change', async () => {
            try {
                await saveUserSettings({ language: langSelect.value }, 'Language preference saved in database');
            } catch (err) {
                langSelect.value = (loadedUser && loadedUser.language) || 'en';
                showToast(err.message || 'Failed to save language', 'danger');
            }
        });
    }

    // ── Toast ───────────────────────────────────────────

    function showToast(message, type = 'success', duration = 2500) {
        const existing = document.querySelector('.toast');
        if (existing) existing.remove();

        const toast = document.createElement('div');
        toast.className = `toast ${type}`;
        const icons = {
            success: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><path d="M20 6 9 17l-5-5"/></svg>',
            danger: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>',
            info: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>'
        };
        toast.innerHTML = `${icons[type] || icons.info}${message}`;
        document.body.appendChild(toast);

        requestAnimationFrame(() => {
            requestAnimationFrame(() => toast.classList.add('show'));
        });

        setTimeout(() => {
            toast.classList.remove('show');
            setTimeout(() => toast.remove(), 400);
        }, duration);
    }

    function escHtml(str) {
        const div = document.createElement('div');
        div.textContent = str || '';
        return div.innerHTML;
    }

    // ── Init ────────────────────────────────────────────

    loadAccount();
    loadApiKeys().then(() => {
        // Load usage stats after keys
        if (window.apiClient && window.apiClient.getStats) {
            window.apiClient.getStats().then(stats => {
                const usageApiCalls = document.getElementById('usageApiCalls');
                const usageApiFill = document.getElementById('usageApiFill');
                if (usageApiCalls) usageApiCalls.textContent = `${Number(stats.total_analyses || 0).toLocaleString()}`;
                if (usageApiFill) usageApiFill.style.width = `${Math.min(100, Number(stats.total_analyses || 0))}%`;
            }).catch(() => {});
        }
    });
});
