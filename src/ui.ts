window.onload = () => {
    let allErrors: GroupedLinterError[] = [];
    interface LinterErrorDetail { type: string; category: string; suggestion: string; }
    interface GroupedLinterError { nodeId: string; content: string; finalSuggestedText: string; errors: LinterErrorDetail[]; }

    const initialScreen = document.getElementById('initial-screen') as HTMLDivElement;
    const resultsScreen = document.getElementById('results-screen') as HTMLDivElement;
    const startBtn = document.getElementById('start-btn') as HTMLButtonElement | null;

    const resultsHeader = document.getElementById('results-header') as HTMLDivElement;
    const resultsTitle = document.getElementById('results-title') as HTMLHeadingElement;
    const resultsContent = document.getElementById('results-content') as HTMLDivElement;
    const applyAllBtn = document.getElementById('apply-all-btn') as HTMLButtonElement;
    const recheckBtn = document.getElementById('recheck-btn') as HTMLButtonElement;

    function showScreen(screenName: 'initial' | 'results') {
        initialScreen.classList.remove('active');
        resultsScreen.classList.remove('active');
        const screenToShow = document.getElementById(`${screenName}-screen`);
        if (screenToShow) {
            screenToShow.classList.add('active');
        }
        const height = 540;
        parent.postMessage({ pluginMessage: { type: 'resize', width: 340, height } }, '*');
    }

    function escapeHtml(str: string): string {
        return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#039;");
    }

    function highlightDiff(original: string, suggested: string, isOriginal: boolean): string {
        const originalWords = original.split(/(\s+)/);
        const suggestedWords = suggested.split(/(\s+)/);
        if (isOriginal) {
            return originalWords.map(word =>
                !suggestedWords.includes(word) ? `<span>${escapeHtml(word)}</span>` : escapeHtml(word)
            ).join('');
        } else {
            return suggestedWords.map(word =>
                !originalWords.includes(word) ? `<span class="highlight">${escapeHtml(word)}</span>` : escapeHtml(word)
            ).join('');
        }
    }

    const startCheck = () => {
        showScreen('results');
        resultsHeader.style.display = 'none';
        resultsContent.innerHTML = `<p style="padding: 200px 0; text-align: center; color: #868E96;">라이팅을 검사하고 있습니다...</p>`;
        parent.postMessage({ pluginMessage: { type: 'start-check' } }, '*');
    };

    const updateTitle = () => {
        resultsTitle.textContent = `${allErrors.length}개의 수정사항`;
        applyAllBtn.disabled = allErrors.length === 0;
    };

    const renderResults = (errors: GroupedLinterError[]) => {
        allErrors = errors;
        updateTitle();

        if (allErrors.length === 0) {
            resultsHeader.style.display = 'none';
            resultsContent.innerHTML = `<div style="display: flex; flex-direction: column; align-items: center; justify-content: center; text-align: center; height: 100%;"><div style="margin-bottom: 12px;"><svg width="48" height="48" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg"><rect width="48" height="48" rx="24" fill="#52C41A"/><path d="M32.6668 18.6667L21.3335 30.0001L16.6668 25.3334" stroke="#ffffff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg></div><h2 style="font-size: 18px; font-weight: 700; color: #212529; margin: 0 0 4px 0;">완벽해요!</h2><p style="font-size: 14px; color: #868E96; margin: 0 0 24px 0;">모든 라이팅 규칙을 지키고 있어요.</p><button class="header-button" id="recheck-btn-bottom"><span>재검사</span><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12a9 9 0 0 0-9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/><path d="M3 12a9 9 0 0 0 9 9 9.75 9.75 0 0 0 6.74-2.74L21 16"/><path d="M16 16h5v5"/></svg></button></div>`;
            return;
        }

        resultsHeader.style.display = 'flex';

        const groupedByCategory = allErrors.reduce((acc, error) => {
            const category = error.errors[0]?.category || '기타';
            if (!acc[category]) acc[category] = [];
            acc[category].push(error);
            return acc;
        }, {} as Record<string, GroupedLinterError[]>);

        resultsContent.innerHTML = Object.entries(groupedByCategory).map(([category, errors]) => `
            <div class="group">
                <h3 class="group-title">${category} (${errors.length})</h3>
                <div class="card-container">
                    ${errors.map((group) => `
                        <div class="card" data-node-id="${group.nodeId}" data-error-index="${allErrors.indexOf(group)}">
                            <div class="text-box">
                                <div class="text-box-label">기존 텍스트</div>
                                <div class="text-content">${highlightDiff(group.content, group.finalSuggestedText, true)}</div>
                            </div>
                            <div class="text-box text-content-final">
                                <div class="text-box-label">수정 텍스트</div>
                                <div class="text-content">${highlightDiff(group.content, group.finalSuggestedText, false)}</div>
                            </div>
                            <div class="button-group">
                                <button class="button button-secondary ignore-btn">무시하기</button>
                                <button class="button button-primary apply-btn" data-node-id="${group.nodeId}" data-suggested-text="${escapeHtml(group.finalSuggestedText)}">수정 적용하기</button>
                            </div>
                        </div>
                    `).join('')}
                </div>
            </div>
        `).join('');
    };

    if (startBtn) {
        startBtn.onclick = startCheck;
    }
    recheckBtn.onclick = startCheck;

    window.onmessage = (event) => {
        const msg = event.data.pluginMessage;
        if (msg.type === 'check-complete') {
            renderResults(msg.errors as GroupedLinterError[]);
        }
    };

    document.addEventListener('click', (event) => {
        const target = event.target as HTMLElement;
        const card = target.closest<HTMLElement>('.card');

        if (target.closest('#recheck-btn-bottom')) {
            startCheck();
        }
        else if (target.id === 'apply-all-btn' && !applyAllBtn.disabled) {
            const fixes = allErrors.map(error => ({ nodeId: error.nodeId, newText: error.finalSuggestedText }));
            parent.postMessage({ pluginMessage: { type: 'apply-all-fixes', fixes } }, '*');

            document.querySelectorAll('.apply-btn').forEach(btn => {
                const button = btn as HTMLButtonElement;
                button.textContent = '적용 완료';
                button.disabled = true;
                const ignoreBtn = button.closest('.button-group')?.querySelector('.ignore-btn') as HTMLButtonElement | null;
                if (ignoreBtn) ignoreBtn.disabled = true;
            });
            applyAllBtn.disabled = true;
        }
        else if (target.matches('.apply-btn')) {
            const button = target as HTMLButtonElement;
            parent.postMessage({ pluginMessage: { type: 'apply-fix', nodeId: button.dataset.nodeId, newText: button.dataset.suggestedText } }, '*');

            button.textContent = '적용 완료';
            button.disabled = true;
            const ignoreBtn = target.closest('.button-group')?.querySelector('.ignore-btn') as HTMLButtonElement | null;
            if (ignoreBtn) ignoreBtn.disabled = true;
        }
        else if (target.matches('.ignore-btn')) {
            if (card) {
                const errorIndex = parseInt(card.dataset.errorIndex!, 10);

                allErrors = allErrors.filter((_, index) => index !== errorIndex);

                card.remove();
                updateTitle();

                if (allErrors.length === 0) {
                    showScreen('initial');
                }
            }
        }
        else if (card) {
            parent.postMessage({ pluginMessage: { type: 'select-node', nodeId: card.dataset.nodeId } }, '*');
        }
    });
};
