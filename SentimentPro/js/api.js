/* ============================================================
   BanglaSentiment Pro — API Client
   Centralized fetch helpers for FastAPI backend integration.
   ============================================================ */

(function () {
    const DEFAULT_API_BASE_URL = 'http://localhost:8000';

    const configApiBase = window.__SENTIMENTPRO_CONFIG__ && window.__SENTIMENTPRO_CONFIG__.apiBaseUrl;
    const API_BASE_URL = (configApiBase || DEFAULT_API_BASE_URL).replace(/\/$/, '');

    const TOKEN_KEY = 'bsp_access_token';
    const USER_KEY = 'bsp_user';

    function getToken() {
        return localStorage.getItem(TOKEN_KEY);
    }

    function setToken(token) {
        if (!token) {
            localStorage.removeItem(TOKEN_KEY);
            return;
        }
        localStorage.setItem(TOKEN_KEY, token);
    }

    function getUser() {
        const raw = localStorage.getItem(USER_KEY);
        if (!raw) return null;
        try {
            return JSON.parse(raw);
        } catch (err) {
            return null;
        }
    }

    function setUser(user) {
        if (!user) {
            localStorage.removeItem(USER_KEY);
            return;
        }
        localStorage.setItem(USER_KEY, JSON.stringify(user));
    }

    async function request(path, options) {
        const token = getToken();
        const headers = Object.assign(
            {
                'Content-Type': 'application/json'
            },
            (options && options.headers) || {}
        );

        if (token) {
            headers.Authorization = `Bearer ${token}`;
        }

        const response = await fetch(`${API_BASE_URL}${path}`, Object.assign({}, options || {}, { headers }));
        const contentType = response.headers.get('content-type') || '';
        const isJson = contentType.includes('application/json');
        const body = isJson ? await response.json() : await response.text();

        if (!response.ok) {
            if (response.status === 401) {
                apiClient.clearAuth();
                // Redirect to login page on auth failure to avoid broken state
                const onLoginPage = window.location.pathname.includes('login');
                if (!onLoginPage) {
                    window.location.href = '/html/login.html';
                    return;
                }
            }
            const message = (body && body.detail) || (body && body.message) || `Request failed: ${response.status}`;
            throw new Error(message);
        }

        return body;
    }

    const apiClient = {
        apiBaseUrl: API_BASE_URL,
        getToken,
        setToken,
        getUser,
        setUser,
        clearAuth: function () {
            localStorage.removeItem(TOKEN_KEY);
            localStorage.removeItem(USER_KEY);
        },
        health: function () {
            return request('/health', { method: 'GET' });
        },
        register: function (payload) {
            return request('/auth/register', { method: 'POST', body: JSON.stringify(payload) });
        },
        login: function (payload) {
            return request('/auth/login', { method: 'POST', body: JSON.stringify(payload) });
        },
        getMe: function () {
            return request('/auth/me', { method: 'GET' });
        },
        updateMe: function (payload) {
            return request('/auth/me', { method: 'PATCH', body: JSON.stringify(payload) });
        },
        changePassword: function (payload) {
            return request('/auth/change-password', { method: 'POST', body: JSON.stringify(payload) });
        },
        exportAccountData: function () {
            return request('/auth/export', { method: 'GET' });
        },
        deleteAccount: function () {
            return request('/auth/me', { method: 'DELETE' });
        },
        predict: function (payload) {
            return request('/predict', { method: 'POST', body: JSON.stringify(payload) });
        },
        predictBatch: function (payload) {
            return request('/predict/batch', { method: 'POST', body: JSON.stringify(payload) });
        },
        getHistory: function (params) {
            const limit = params && params.limit ? params.limit : 50;
            return request(`/history?limit=${encodeURIComponent(limit)}`, { method: 'GET' });
        },
        deleteHistoryItem: function (predictionId) {
            return request(`/history/${predictionId}`, { method: 'DELETE' });
        },
        clearHistory: function () {
            return request('/history', { method: 'DELETE' });
        },
        getStats: function () {
            return request('/stats', { method: 'GET' });
        },
        sendFeedback: function (predictionId, payload) {
            return request(`/feedback/${predictionId}`, { method: 'POST', body: JSON.stringify(payload) });
        },
        // API Key management
        createApiKey: function (payload) {
            return request('/api-keys', { method: 'POST', body: JSON.stringify(payload || { label: 'default' }) });
        },
        listApiKeys: function () {
            return request('/api-keys', { method: 'GET' });
        },
        revokeApiKey: function (keyId) {
            return request(`/api-keys/${keyId}`, { method: 'DELETE' });
        }
    };

    window.apiClient = apiClient;

    document.addEventListener('DOMContentLoaded', function () {
        const page = window.location.pathname.split('/').pop();
        const publicPages = ['login.html', 'index.html', ''];
        if (!publicPages.includes(page) && !apiClient.getToken()) {
            window.location.href = 'login.html';
            return;
        }

        document.querySelectorAll('#navLogout').forEach(function (link) {
            link.addEventListener('click', function (event) {
                event.preventDefault();
                apiClient.clearAuth();
                localStorage.removeItem('bsp_latest_result');
                window.location.href = 'login.html';
            });
        });
    });
})();
