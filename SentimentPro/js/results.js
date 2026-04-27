/* ============================================================
   BanglaSentiment Pro — Results
   Renders only real prediction data returned by FastAPI.
   ============================================================ */

document.addEventListener('DOMContentLoaded', () => {
    let POSITIVE = 0;
    let NEUTRAL = 0;
    let NEGATIVE = 0;
    const CIRCUMFERENCE = 2 * Math.PI * 60;

    const sentimentClass = {
        positive: 'positive',
        negative: 'negative',
        neutral: 'neutral'
    };

    const emotionClass = {
        happy: 'emotion-badge-happy',
        love: 'emotion-badge-love',
        anger: 'emotion-badge-anger',
        fear: 'emotion-badge-fear',
        sadness: 'emotion-badge-sadness',
        other: 'emotion-badge-happy'
    };

    const emotionIcon = {
        happy: 'Happy',
        love: 'Love',
        anger: 'Anger',
        fear: 'Fear',
        sadness: 'Sadness',
        other: 'Other'
    };

    function titleCase(value) {
        if (!value) return 'Unknown';
        const s = value.toString();
        return s.charAt(0).toUpperCase() + s.slice(1).toLowerCase();
    }

    function pct(value) {
        const n = Number(value || 0);
        return Math.round((n > 1 ? n : n * 100));
    }

    function getPayload() {
        const raw = localStorage.getItem('bsp_latest_result');
        if (!raw) return null;
        try {
            return JSON.parse(raw);
        } catch (err) {
            return null;
        }
    }

    function normalizeResults(payload) {
        if (!payload) return [];
        if (Array.isArray(payload.results)) return payload.results;
        return [payload];
    }

    function showEmptyResult() {
        const title = document.querySelector('.result-title');
        const date = document.querySelector('.result-date');
        const summaryValue = document.querySelector('.summary-value');
        const summaryConfidence = document.querySelector('.summary-confidence');
        const tableBody = document.querySelector('#reviewTable tbody');

        if (title) title.textContent = 'No Analysis Result';
        if (date) date.textContent = 'Run a new analysis to see model output here.';
        if (summaryValue) {
            summaryValue.textContent = 'No data';
            summaryValue.classList.remove('positive', 'negative', 'neutral');
        }
        if (summaryConfidence) summaryConfidence.textContent = 'Confidence: 0%';
        if (tableBody) {
            tableBody.innerHTML = `
                <tr>
                    <td colspan="5" class="cell-text">No saved result found. Go to New Analysis and submit Bangla text.</td>
                </tr>
            `;
        }

        updateSentimentUi();
        updateEmotionUi({});
    }

    function updateSentimentUi() {
        const summaryBlocks = document.querySelectorAll('.summary-block .summary-pct');
        if (summaryBlocks[0]) summaryBlocks[0].textContent = `${POSITIVE}%`;
        if (summaryBlocks[1]) summaryBlocks[1].textContent = `${NEUTRAL}%`;
        if (summaryBlocks[2]) summaryBlocks[2].textContent = `${NEGATIVE}%`;

        const legendPct = document.querySelectorAll('.legend-pct');
        if (legendPct[0]) legendPct[0].textContent = `${POSITIVE}%`;
        if (legendPct[1]) legendPct[1].textContent = `${NEUTRAL}%`;
        if (legendPct[2]) legendPct[2].textContent = `${NEGATIVE}%`;

        const barPcts = document.querySelectorAll('.bars-area .bar-pct');
        if (barPcts[0]) barPcts[0].textContent = `${POSITIVE}%`;
        if (barPcts[1]) barPcts[1].textContent = `${NEUTRAL}%`;
        if (barPcts[2]) barPcts[2].textContent = `${NEGATIVE}%`;

        const progressFills = document.querySelectorAll('.bars-area .progress-fill');
        if (progressFills[0]) progressFills[0].dataset.width = String(POSITIVE);
        if (progressFills[1]) progressFills[1].dataset.width = String(NEUTRAL);
        if (progressFills[2]) progressFills[2].dataset.width = String(NEGATIVE);
    }

    function updateEmotionUi(emotionScores) {
        const rows = document.querySelectorAll('.emotion-bar-item');
        const labels = ['happy', 'love', 'anger', 'fear', 'sadness'];
        rows.forEach((row, idx) => {
            const label = labels[idx];
            const value = pct(emotionScores[label] || 0);
            const percent = row.querySelector('.bar-pct');
            const fill = row.querySelector('.progress-fill');
            if (percent) percent.textContent = `${value}%`;
            if (fill) fill.dataset.width = String(value);
        });
    }

    function renderTable(results) {
        const tableBody = document.querySelector('#reviewTable tbody');
        if (!tableBody) return;

        tableBody.innerHTML = results.map(item => {
            const sentiment = (item.sentiment || 'neutral').toLowerCase();
            const emotion = (item.emotion || 'other').toLowerCase();
            const confidence = pct(item.confidence);
            const sentClass = sentimentClass[sentiment] || 'neutral-badge';
            const emoClass = emotionClass[emotion] || emotionClass.other;

            return `
                <tr>
                    <td class="cell-text"><span class="bengali">${escapeHtml(item.text || '')}</span></td>
                    <td><span class="sentiment-badge ${sentClass}">${titleCase(sentiment)}</span></td>
                    <td><span class="emotion-badge ${emoClass}">${emotionIcon[emotion] || titleCase(emotion)}</span></td>
                    <td>
                        <div class="conf-bar-wrap">
                            <div class="conf-bar ${sentClass === 'negative' ? 'negative' : sentClass === 'neutral' ? 'neutral-bar' : 'positive'}" style="width:${confidence}%"></div>
                            <span class="conf-val">${confidence}%</span>
                        </div>
                    </td>
                    <td><button class="dots-btn" aria-label="More actions">...</button></td>
                </tr>
            `;
        }).join('');
    }

    function escapeHtml(value) {
        const div = document.createElement('div');
        div.textContent = value || '';
        return div.innerHTML;
    }

    function hydrateFromLatestResult() {
        const payload = getPayload();
        const results = normalizeResults(payload);
        if (!results.length) {
            showEmptyResult();
            return;
        }

        const firstResult = results[0];
        const sentiment = (firstResult.sentiment || 'neutral').toLowerCase();
        const emotion = (firstResult.emotion || 'other').toLowerCase();
        const confidencePct = pct(firstResult.confidence);

        const scoreObj = firstResult.scores || {};
        POSITIVE = pct(scoreObj.positive);
        NEUTRAL = pct(scoreObj.neutral);
        NEGATIVE = pct(scoreObj.negative);

        const total = POSITIVE + NEUTRAL + NEGATIVE;
        if (total !== 100 && total > 0) {
            POSITIVE = Math.round((POSITIVE / total) * 100);
            NEUTRAL = Math.round((NEUTRAL / total) * 100);
            NEGATIVE = Math.max(0, 100 - POSITIVE - NEUTRAL);
        }

        const overallSentiment = document.querySelector('.summary-value');
        const overallConfidence = document.querySelector('.summary-confidence');
        if (overallSentiment) {
            overallSentiment.textContent = titleCase(sentiment);
            overallSentiment.classList.remove('positive', 'negative', 'neutral');
            overallSentiment.classList.add(sentimentClass[sentiment] || 'neutral');
        }
        if (overallConfidence) overallConfidence.textContent = `Confidence: ${confidencePct}%`;

        const dateNode = document.querySelector('.result-date');
        if (dateNode) {
            const createdAt = firstResult.created_at ? new Date(firstResult.created_at) : new Date();
            dateNode.textContent = `Completed on ${createdAt.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })} - ${createdAt.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}`;
        }

        updateSentimentUi();
        updateEmotionUi(firstResult.emotion_scores || {});
        renderTable(results);
    }

    hydrateFromLatestResult();

    const segPositive = document.querySelector('.seg-positive');
    const segNeutral = document.querySelector('.seg-neutral');
    const segNegative = document.querySelector('.seg-negative');

    function animateDonut() {
        if (!segPositive || !segNeutral || !segNegative) return;
        const posLen = (POSITIVE / 100) * CIRCUMFERENCE;
        const neuLen = (NEUTRAL / 100) * CIRCUMFERENCE;
        const negLen = (NEGATIVE / 100) * CIRCUMFERENCE;
        const gap = POSITIVE || NEUTRAL || NEGATIVE ? 6 : 0;

        segPositive.style.strokeDasharray = `${Math.max(0, posLen - gap)} ${CIRCUMFERENCE - posLen + gap}`;
        segPositive.style.strokeDashoffset = '0';
        segNeutral.style.strokeDasharray = `${Math.max(0, neuLen - gap)} ${CIRCUMFERENCE - neuLen + gap}`;
        segNeutral.style.strokeDashoffset = `${-(posLen)}`;
        segNegative.style.strokeDasharray = `${Math.max(0, negLen - gap)} ${CIRCUMFERENCE - negLen + gap}`;
        segNegative.style.strokeDashoffset = `${-(posLen + neuLen)}`;
    }

    setTimeout(animateDonut, 300);

    const progressFills = document.querySelectorAll('.progress-fill');
    const barObserver = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.style.width = entry.target.dataset.width + '%';
                barObserver.unobserve(entry.target);
            }
        });
    }, { threshold: 0.3 });
    progressFills.forEach(fill => barObserver.observe(fill));

    const exportBtn = document.getElementById('exportBtn');
    if (exportBtn) {
        exportBtn.addEventListener('click', () => {
            const payload = getPayload();
            if (!payload) {
                showToast('No result to export', 'info');
                return;
            }
            const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.download = 'sentimentpro-result.json';
            link.click();
            URL.revokeObjectURL(url);
            showToast('Result exported as JSON', 'success');
        });
    }

    const shareBtn = document.getElementById('shareBtn');
    if (shareBtn) {
        shareBtn.addEventListener('click', () => {
            navigator.clipboard.writeText(window.location.href);
            showToast('Link copied to clipboard', 'success');
        });
    }

    document.addEventListener('click', (event) => {
        if (event.target.closest('.dots-btn')) {
            showToast('No extra actions are available for this result', 'info');
        }
    });

    function showToast(message, type = 'success', duration = 2500) {
        const existing = document.querySelector('.toast');
        if (existing) existing.remove();

        const toast = document.createElement('div');
        toast.className = `toast ${type}`;
        toast.innerHTML = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><path d="M20 6 9 17l-5-5"/></svg>${message}`;
        document.body.appendChild(toast);

        requestAnimationFrame(() => {
            requestAnimationFrame(() => toast.classList.add('show'));
        });

        setTimeout(() => {
            toast.classList.remove('show');
            setTimeout(() => toast.remove(), 400);
        }, duration);
    }
});
