/* ============================================================
   BanglaSentiment Pro - Dashboard
   Fetches account and statistics from FastAPI.
   ============================================================ */

document.addEventListener('DOMContentLoaded', () => {
    let user = window.apiClient && window.apiClient.getUser ? window.apiClient.getUser() : null;

    const greetingEl = document.querySelector('.greeting-text');
    const counters = document.querySelectorAll('.metric-value');
    const duration = 1200;

    function updateGreeting() {
        if (!greetingEl) return;
        const hour = new Date().getHours();
        let greeting = 'Good morning';
        if (hour >= 12 && hour < 17) greeting = 'Good afternoon';
        else if (hour >= 17) greeting = 'Good evening';
        const name = (user && (user.name || user.email)) ? (user.name || user.email) : 'Admin';
        greetingEl.textContent = `${greeting}, ${name}`;
    }

    function animateCounter(el) {
        const target = parseInt(el.dataset.target, 10);
        const suffix = el.dataset.suffix || '';
        const startTime = performance.now();

        function update(now) {
            const elapsed = now - startTime;
            const progress = Math.min(elapsed / duration, 1);
            const eased = 1 - Math.pow(1 - progress, 3);
            el.textContent = Math.round(target * eased).toLocaleString() + suffix;

            if (progress < 1) {
                requestAnimationFrame(update);
            }
        }

        requestAnimationFrame(update);
    }

    const counterObserver = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                animateCounter(entry.target);
                counterObserver.unobserve(entry.target);
            }
        });
    }, { threshold: 0.5 });

    counters.forEach(c => counterObserver.observe(c));

    async function loadStats() {
        if (!window.apiClient) return;

        try {
            user = await window.apiClient.getMe();
            updateGreeting();

            const stats = await window.apiClient.getStats();
            const totalAnalyses = Number(stats.total_analyses || stats.total_predictions || 0);
            const totalReviews = Number(stats.total_reviews || totalAnalyses || 0);
            const positivePct = Number(stats.positive_percentage || stats.positive_pct || 0);
            const negativePct = Number(stats.negative_percentage || stats.negative_pct || 0);

            [
                { idx: 0, val: totalAnalyses, suffix: '' },
                { idx: 1, val: totalReviews, suffix: '' },
                { idx: 2, val: Math.round(positivePct), suffix: '%' },
                { idx: 3, val: Math.round(negativePct), suffix: '%' }
            ].forEach(item => {
                const el = counters[item.idx];
                if (!el) return;
                el.dataset.target = String(item.val);
                el.dataset.suffix = item.suffix;
                el.textContent = '0' + item.suffix;
                counterObserver.observe(el);
            });

            // Fetch and render recent analyses
            if (totalAnalyses > 0 && window.apiClient.getHistory) {
                const history = await window.apiClient.getHistory({ limit: 5 });
                const recentList = history.predictions || [];
                
                const emptyState = document.getElementById('emptyState');
                const recentAnalyses = document.getElementById('recentAnalyses');
                const tbody = document.getElementById('recentAnalysesBody');
                
                if (recentList.length > 0) {
                    if (emptyState) emptyState.style.display = 'none';
                    if (recentAnalyses) recentAnalyses.style.display = 'block';
                    
                    if (tbody) {
                        tbody.innerHTML = '';
                        recentList.forEach(item => {
                            const tr = document.createElement('tr');
                            tr.style.borderBottom = '1px solid var(--border-color)';
                            
                            // Sentiment styling
                            let badgeClass = 'badge-neutral';
                            if (item.sentiment === 'positive') badgeClass = 'badge-positive';
                            if (item.sentiment === 'negative') badgeClass = 'badge-negative';
                            
                            const dateStr = new Date(item.created_at).toLocaleDateString('en-US', {
                                month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
                            });
                            
                            const textSnippet = item.input_text.length > 50 
                                ? item.input_text.substring(0, 50) + '...' 
                                : item.input_text;
                            
                            tr.innerHTML = `
                                <td style="padding: 12px 16px; color: var(--text-primary); max-width: 300px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${textSnippet}</td>
                                <td style="padding: 12px 16px;"><span class="${badgeClass}">${item.sentiment}</span></td>
                                <td style="padding: 12px 16px; color: var(--text-secondary);">${Math.round(item.confidence * 100)}%</td>
                                <td style="padding: 12px 16px; color: var(--text-secondary); font-size: 0.85rem;">${dateStr}</td>
                            `;
                            tbody.appendChild(tr);
                        });
                    }
                }
            }
        } catch (err) {
            console.error(err);
        }
    }

    updateGreeting();
    loadStats();

    document.querySelectorAll('.nav-link').forEach(link => {
        link.addEventListener('click', () => {
            document.querySelectorAll('.nav-link').forEach(l => l.classList.remove('active'));
            link.classList.add('active');
        });
    });

    [document.getElementById('createAnalysisBtn'), document.getElementById('newAnalysisBtn')].forEach(btn => {
        if (!btn) return;
        btn.addEventListener('click', () => {
            btn.style.transform = 'scale(0.95)';
            setTimeout(() => {
                btn.style.transform = '';
                window.location.href = 'analysis.html';
            }, 150);
        });
    });
});
