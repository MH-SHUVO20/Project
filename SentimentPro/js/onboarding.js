/* ============================================================
   BanglaSentiment Pro — Onboarding (JS)
   Step navigation · CTA interaction · Entrance animations
   ============================================================ */

document.addEventListener('DOMContentLoaded', () => {
    if (!window.apiClient || !window.apiClient.getToken()) {
        window.location.href = 'login.html';
        return;
    }

    /* ---------- DOM Refs ---------- */
    const steps    = document.querySelectorAll('.step');
    const ctaBtn   = document.getElementById('ctaStart');

    let activeStep = 1;
    const totalSteps = steps.length;

    /* ---------- Step Click Navigation ---------- */
    steps.forEach(step => {
        step.addEventListener('click', () => {
            const stepNum = parseInt(step.dataset.step, 10);
            setActiveStep(stepNum);
        });
    });

    function setActiveStep(num) {
        activeStep = num;
        steps.forEach(step => {
            const sn = parseInt(step.dataset.step, 10);
            step.classList.remove('active', 'completed');

            if (sn < num) {
                step.classList.add('completed');
            } else if (sn === num) {
                step.classList.add('active');
            }
        });
    }

    /* ---------- CTA Button ---------- */
    ctaBtn.addEventListener('click', () => {
        if (activeStep < totalSteps) {
            setActiveStep(activeStep + 1);

            // Ripple effect on button
            ctaBtn.style.transform = 'scale(0.95)';
            setTimeout(() => {
                ctaBtn.style.transform = '';
            }, 150);
        } else {
            // Final step — simulate completion
            ctaBtn.innerHTML = `
                <svg class="check-anim" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" width="22" height="22"><polyline points="20 6 9 17 4 12"/></svg>
                <span>All Set!</span>
            `;
            ctaBtn.style.background = '#22C55E';
            ctaBtn.style.boxShadow  = '0 4px 24px rgba(34, 197, 94, 0.35)';
            ctaBtn.style.pointerEvents = 'none';

            // Mark last step as completed
            steps[totalSteps - 1].classList.remove('active');
            steps[totalSteps - 1].classList.add('completed');

            // Redirect to dashboard
            setTimeout(() => {
                window.location.href = 'dashboard.html';
            }, 1200);
        }
    });

    /* ---------- Bar Chart Intersection Observer ---------- */
    const bars = document.querySelectorAll('.bar');
    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.style.animationPlayState = 'running';
            }
        });
    }, { threshold: 0.5 });

    bars.forEach(bar => {
        bar.style.animationPlayState = 'paused';
        observer.observe(bar);
    });

    /* ---------- Staggered entrance for steps ---------- */
    steps.forEach((step, i) => {
        step.style.opacity = '0';
        step.style.transform = 'translateX(-12px)';
        step.style.transition = `opacity 0.4s ${0.15 + i * 0.1}s ease, transform 0.4s ${0.15 + i * 0.1}s ease`;

        requestAnimationFrame(() => {
            requestAnimationFrame(() => {
                step.style.opacity = '1';
                step.style.transform = 'translateX(0)';
            });
        });
    });

    /* ---------- Staggered entrance for footer features ---------- */
    const features = document.querySelectorAll('.feature-item');
    features.forEach((feat, i) => {
        feat.style.opacity = '0';
        feat.style.transform = 'translateY(16px)';
        feat.style.transition = `opacity 0.45s ${0.5 + i * 0.12}s ease, transform 0.45s ${0.5 + i * 0.12}s ease`;

        requestAnimationFrame(() => {
            requestAnimationFrame(() => {
                feat.style.opacity = '1';
                feat.style.transform = 'translateY(0)';
            });
        });
    });
});
