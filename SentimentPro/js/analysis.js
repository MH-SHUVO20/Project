/* ============================================================
   BanglaSentiment Pro — New Analysis (JS)
   Tab switching · Textarea · Samples · Upload · Analyse
   ============================================================ */

document.addEventListener('DOMContentLoaded', () => {

    /* ---------- Method Tab Switching ---------- */
    const tabs   = document.querySelectorAll('.method-tab');
    const panels = document.querySelectorAll('.tab-panel');

    tabs.forEach(tab => {
        tab.addEventListener('click', () => {
            const target = tab.dataset.tab;

            tabs.forEach(t => t.classList.remove('active'));
            tab.classList.add('active');

            panels.forEach(p => {
                p.classList.remove('active');
                if (p.dataset.panel === target) {
                    p.classList.add('active');
                    // Re-trigger animation
                    p.style.animation = 'none';
                    p.offsetHeight;
                    p.style.animation = '';
                }
            });
        });
    });

    /* ---------- Textarea Character Counter ---------- */
    const textarea  = document.getElementById('bengaliInput');
    const charCount = document.getElementById('charCount');
    const maxChars  = 2000;

    if (textarea && charCount) {
        textarea.addEventListener('input', () => {
            const len = textarea.value.length;
            charCount.textContent = `${len.toLocaleString()} / ${maxChars.toLocaleString()}`;
            charCount.style.color = len > maxChars ? '#EF4444' : '#a1a1aa';
        });
    }

    /* ---------- Clear Button ---------- */
    const clearBtn = document.getElementById('clearBtn');
    if (clearBtn && textarea) {
        clearBtn.addEventListener('click', () => {
            textarea.value = '';
            textarea.dispatchEvent(new Event('input'));
            textarea.focus();
        });
    }

    /* ---------- Microphone Button ---------- */
    const micBtn = document.getElementById('micBtn');
    if (micBtn) {
        micBtn.addEventListener('click', () => {
            alert('Voice input is not enabled. Please type or paste Bangla text.');
        });
    }

    /* ---------- Quick Sample Chips ---------- */
    const chips = document.querySelectorAll('.sample-chip');
    chips.forEach(chip => {
        chip.addEventListener('click', () => {
            if (textarea) {
                textarea.value = chip.dataset.text;
                textarea.dispatchEvent(new Event('input'));
                textarea.focus();

                // Visual feedback
                chip.style.borderColor = '#7C3AED';
                chip.style.background  = '#ede9fe';
                setTimeout(() => {
                    chip.style.borderColor = '';
                    chip.style.background  = '';
                }, 400);
            }
        });
    });

    /* ---------- Bulk Paste Review Count ---------- */
    const bulkInput = document.getElementById('bulkInput');
    const metaEl    = document.querySelector('.input-meta strong');
    if (bulkInput && metaEl) {
        bulkInput.addEventListener('input', () => {
            const lines = bulkInput.value.split('\n').filter(l => l.trim().length > 0);
            metaEl.textContent = lines.length;
        });
    }

    /* ---------- File Upload Zone ---------- */
    const uploadZone = document.getElementById('uploadZone');
    const fileInput  = document.getElementById('fileInput');

    if (uploadZone) {
        uploadZone.addEventListener('dragover', (e) => {
            e.preventDefault();
            uploadZone.classList.add('dragover');
        });
        uploadZone.addEventListener('dragleave', () => {
            uploadZone.classList.remove('dragover');
        });
        uploadZone.addEventListener('drop', (e) => {
            e.preventDefault();
            uploadZone.classList.remove('dragover');
            if (e.dataTransfer.files.length) {
                handleFile(e.dataTransfer.files[0]);
            }
        });
    }

    if (fileInput) {
        fileInput.addEventListener('change', () => {
            if (fileInput.files.length) {
                handleFile(fileInput.files[0]);
            }
        });
    }

    function handleFile(file) {
        const uploadTitle = uploadZone.querySelector('.upload-title');
        const uploadHint  = uploadZone.querySelector('.upload-hint');
        if (uploadTitle) uploadTitle.innerHTML = `<strong style="color:#7C3AED">${file.name}</strong> selected`;
        if (uploadHint) uploadHint.textContent = `${(file.size / 1024).toFixed(1)} KB`;
    }

    /* ---------- Copy API Code ---------- */
    const copyBtn = document.getElementById('copyApiBtn');
    if (copyBtn) {
        copyBtn.addEventListener('click', () => {
            const code = document.querySelector('.code-body code');
            if (code) {
                navigator.clipboard.writeText(code.textContent).then(() => {
                    copyBtn.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" width="14" height="14"><path d="M20 6 9 17l-5-5"/></svg> Copied!`;
                    copyBtn.style.color = '#22C55E';
                    copyBtn.style.borderColor = '#22C55E';
                    setTimeout(() => {
                        copyBtn.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="14" height="14"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg> Copy`;
                        copyBtn.style.color = '';
                        copyBtn.style.borderColor = '';
                    }, 2000);
                });
            }
        });
    }

    /* ---------- How It Works Toggle ---------- */
    const hiwToggle  = document.getElementById('hiwToggle');
    const hiwSection = document.getElementById('howItWorks');

    if (hiwToggle && hiwSection) {
        hiwToggle.addEventListener('click', () => {
            hiwSection.classList.toggle('open');
        });
    }

    /* ---------- Analyse Button (FastAPI integration) ---------- */
    const analyseBtn = document.getElementById('analyseBtn');
    if (analyseBtn) {
        analyseBtn.addEventListener('click', async () => {
            analyseBtn.classList.add('loading');

            try {
                if (!window.apiClient) {
                    throw new Error('API client is not loaded.');
                }

                const activePanel = document.querySelector('.tab-panel.active');
                const panelType = activePanel ? activePanel.dataset.panel : 'single';

                let latestResult;

                if (panelType === 'single' && textarea) {
                    const inputText = textarea.value.trim();
                    if (!inputText) throw new Error('Please enter Bengali text first.');

                    latestResult = await window.apiClient.predict({ text: inputText });
                } else if (panelType === 'bulk' && bulkInput) {
                    const texts = bulkInput.value
                        .split('\n')
                        .map(line => line.trim())
                        .filter(Boolean);
                    if (!texts.length) throw new Error('Please paste at least one review.');

                    latestResult = await window.apiClient.predictBatch({ texts: texts });
                } else if (panelType === 'upload' && fileInput && fileInput.files.length) {
                    throw new Error('File upload is not enabled in this backend. Use Bulk Paste for multiple reviews.');
                } else if (panelType === 'api') {
                    throw new Error('API Docs is only documentation. Use Single Comment or Bulk Paste to run analysis.');
                } else {
                    throw new Error('Select a valid input method and provide input text.');
                }

                localStorage.setItem('bsp_latest_result', JSON.stringify(latestResult));
                analyseBtn.classList.remove('loading');
                window.location.href = 'results.html';
            } catch (err) {
                analyseBtn.classList.remove('loading');
                alert(err.message || 'Analysis failed');
            }
        });
    }

    // Shake keyframes now loaded from css/toast.css
});
