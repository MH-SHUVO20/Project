/* ============================================================
   BanglaSentiment Pro — History Page (JS)
   Renders API-backed history table and handles delete/clear.
   ============================================================ */

document.addEventListener('DOMContentLoaded', () => {
    let serverHistory = [];

    const historyBody  = document.getElementById('historyBody');
    const historyCard  = document.getElementById('historyCard');
    const historyEmpty = document.getElementById('historyEmpty');
    const statTotal    = document.getElementById('statTotal');
    const statPositive = document.getElementById('statPositive');
    const statNeutral  = document.getElementById('statNeutral');
    const statNegative = document.getElementById('statNegative');
    const clearBtn     = document.getElementById('clearHistoryBtn');

    function normalizeHistoryItem(item) {
        const sentimentRaw = (item.sentiment || '').toString().toLowerCase();
        const emotionRaw = (item.emotion || item.emotion_label || '').toString().toLowerCase();
        const confidenceRaw = Number(item.confidence || item.sentiment_confidence || 0);

        const sentiment = sentimentRaw ? sentimentRaw.charAt(0).toUpperCase() + sentimentRaw.slice(1) : 'Neutral';
        const emotion = emotionRaw ? emotionRaw.charAt(0).toUpperCase() + emotionRaw.slice(1) : 'Other';

        const createdAt = item.created_at ? new Date(item.created_at) : new Date();
        const date = createdAt.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
            + ' - ' + createdAt.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });

        return {
            id: String(item.id || item.prediction_id || Date.now()),
            text: item.text || item.input_text || '',
            method: item.method || 'Single Comment',
            sentiment: sentiment,
            emotion: emotion,
            confidence: Math.round(confidenceRaw > 1 ? confidenceRaw : confidenceRaw * 100),
            scores: item.scores || {},
            emotion_scores: item.emotion_scores || {},
            created_at: item.created_at || null,
            date: date
        };
    }

    /* ---------- Render ---------- */
    function render() {
        const data = serverHistory;

        // Stats
        const total = data.length;
        const pos   = data.filter(d => d.sentiment === 'Positive').length;
        const neu   = data.filter(d => d.sentiment === 'Neutral').length;
        const neg   = data.filter(d => d.sentiment === 'Negative').length;

        animateCount(statTotal, total);
        animateCount(statPositive, pos);
        animateCount(statNeutral, neu);
        animateCount(statNegative, neg);

        // Toggle empty / table
        if (total === 0) {
            historyCard.style.display  = 'none';
            historyEmpty.style.display = '';
            return;
        }
        historyCard.style.display  = '';
        historyEmpty.style.display = 'none';

        // Build rows. API already returns newest first.
        historyBody.innerHTML = '';
        data.forEach((item, i) => {
            const row = document.createElement('tr');
            row.style.animationDelay = `${i * 0.04}s`;

            const sentClass = item.sentiment === 'Positive' ? 'positive'
                            : item.sentiment === 'Negative' ? 'negative'
                            : 'neutral-badge';

            const emotionMap = {
                'Happy':   { cls: 'emotion-badge-happy', label: 'Happy' },
                'Love':    { cls: 'emotion-badge-love', label: 'Love' },
                'Anger':   { cls: 'emotion-badge-anger', label: 'Anger' },
                'Fear':    { cls: 'emotion-badge-fear', label: 'Fear' },
                'Sadness': { cls: 'emotion-badge-sadness', label: 'Sadness' },
                'Other':   { cls: 'emotion-badge-happy', label: 'Other' },
            };
            const emo = emotionMap[item.emotion] || emotionMap['Other'];

            const confClass = item.sentiment === 'Positive' ? 'positive'
                            : item.sentiment === 'Negative' ? 'negative'
                            : 'neutral';

            row.innerHTML = `
                <td><span class="row-num">${data.length - i}</span></td>
                <td><span class="cell-input" title="${escHtml(item.text)}">${escHtml(item.text)}</span></td>
                <td><span class="method-badge">${escHtml(item.method)}</span></td>
                <td><span class="sentiment-badge ${sentClass}">${item.sentiment}</span></td>
                <td><span class="emotion-badge ${emo.cls}">${emo.label}</span></td>
                <td>
                    <div class="conf-bar-wrap">
                        <div class="conf-bar"><div class="conf-bar-fill ${confClass}" style="width:${item.confidence}%"></div></div>
                        <span class="conf-val">${item.confidence}%</span>
                    </div>
                </td>
                <td><span class="cell-date">${item.date}</span></td>
                <td>
                    <div class="action-btns">
                        <button class="action-btn view-btn" title="View result" aria-label="View result" data-id="${item.id}">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                        </button>
                        <button class="action-btn delete delete-btn" title="Delete" aria-label="Delete entry" data-id="${item.id}">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
                        </button>
                    </div>
                </td>
            `;

            historyBody.appendChild(row);
        });

        // Bind row buttons
        document.querySelectorAll('.delete-btn').forEach(btn => {
            btn.addEventListener('click', async () => {
                try {
                    await window.apiClient.deleteHistoryItem(btn.dataset.id);
                    serverHistory = serverHistory.filter(item => item.id !== btn.dataset.id);
                    render();
                    showToast('History item deleted', 'success');
                } catch (err) {
                    showToast(err.message || 'Failed to delete history item', 'danger');
                }
            });
        });

        document.querySelectorAll('.view-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const item = serverHistory.find(row => row.id === btn.dataset.id);
                if (item) {
                    localStorage.setItem('bsp_latest_result', JSON.stringify({
                        id: item.id,
                        text: item.text,
                        sentiment: item.sentiment.toLowerCase(),
                        emotion: item.emotion.toLowerCase(),
                        confidence: item.confidence / 100,
                        scores: item.scores,
                        emotion_scores: item.emotion_scores,
                        created_at: item.created_at
                    }));
                }
                window.location.href = 'results.html';
            });
        });
    }

    /* ---------- Clear All ---------- */
    if (clearBtn) {
        clearBtn.addEventListener('click', async () => {
            const data = serverHistory;
            if (data.length === 0) {
                showToast('History is already empty', 'info');
                return;
            }
            try {
                await window.apiClient.clearHistory();
                serverHistory = [];
                render();
                showToast('History cleared', 'success');
            } catch (err) {
                showToast(err.message || 'Failed to clear history', 'danger');
            }
        });
    }

    async function loadHistoryFromApi() {
        if (!window.apiClient) {
            showToast('API client is not loaded', 'danger');
            return;
        }

        try {
            const response = await window.apiClient.getHistory({ limit: 200 });
            const rows = Array.isArray(response) ? response : (response.items || response.history || []);
            serverHistory = rows.map(normalizeHistoryItem);
        } catch (err) {
            showToast(err.message || 'Failed to load history', 'danger');
            serverHistory = [];
        }
    }

    /* ---------- Animate Counter ---------- */
    function animateCount(el, target) {
        if (!el) return;
        const duration = 600;
        const start = performance.now();
        const from = parseInt(el.textContent) || 0;

        function step(now) {
            const progress = Math.min((now - start) / duration, 1);
            const eased = 1 - Math.pow(1 - progress, 3);
            el.textContent = Math.round(from + (target - from) * eased);
            if (progress < 1) requestAnimationFrame(step);
        }
        requestAnimationFrame(step);
    }

    /* ---------- Toast ---------- */
    function showToast(message, type = 'success', duration = 2500) {
        const existing = document.querySelector('.toast');
        if (existing) existing.remove();

        const toast = document.createElement('div');
        toast.className = `toast ${type}`;
        const icon = type === 'danger'
            ? '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>'
            : '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><path d="M20 6 9 17l-5-5"/></svg>';
        toast.innerHTML = `${icon}${message}`;
        document.body.appendChild(toast);

        requestAnimationFrame(() => {
            requestAnimationFrame(() => toast.classList.add('show'));
        });

        setTimeout(() => {
            toast.classList.remove('show');
            setTimeout(() => toast.remove(), 400);
        }, duration);
    }

    /* ---------- Escape HTML ---------- */
    function escHtml(str) {
        const div = document.createElement('div');
        div.textContent = str || '';
        return div.innerHTML;
    }

    /* ---------- Init ---------- */
    loadHistoryFromApi().then(render);
});
