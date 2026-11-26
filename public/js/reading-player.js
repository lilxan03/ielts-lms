// Extracted from js/test-player.js: Reading speed pacing & syntax chunking
    let savedSyntaxChunkSelection = null;

    window.readingSpeed = 220;
    window.readingTimer = null;
    window.readingWordIndex = 0;
    window.readingModeActive = false;

    function getReadingDelayMs() {
        const wpm = Number(window.readingSpeed || 220);
        const safeWpm = Number.isFinite(wpm) && wpm > 0 ? wpm : 220;
        return Math.max(120, 60000 / safeWpm);
    }

    function stopReadingMode() {
        window.readingModeActive = false;
        if (window.readingTimer) {
            clearTimeout(window.readingTimer);
            window.readingTimer = null;
        }
        const root = document.getElementById('passage-text-content');
        if (!root) return;
        root.querySelectorAll('.reading-word, .vocab-word').forEach(word => {
            word.classList.remove('is-current', 'is-read');
            word.style.opacity = '1';
            word.style.transform = 'none';
            word.style.filter = 'none';
            word.style.visibility = 'visible';
            word.style.maxWidth = 'none';
            word.style.marginRight = '';
        });
    }

    function ensureReadingWords(root) {
        if (!root) return [];

        const textWalker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
            acceptNode(node) {
                const parent = node.parentElement;
                if (!parent || parent.closest('.drop-zone') || parent.closest('.reading-mode-controls')) {
                    return NodeFilter.FILTER_REJECT;
                }
                if (parent.classList.contains('vocab-word')) {
                    return NodeFilter.FILTER_REJECT;
                }
                return /\S/.test(node.textContent) ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT;
            }
        });

        const textNodes = [];
        while (textWalker.nextNode()) textNodes.push(textWalker.currentNode);

        textNodes.forEach(node => {
            const fragment = document.createDocumentFragment();
            const parts = node.textContent.split(/(\s+)/);
            parts.forEach(part => {
                if (!part) return;
                if (/^\s+$/.test(part)) {
                    fragment.appendChild(document.createTextNode(part));
                    return;
                }
                const span = document.createElement('span');
                span.className = 'reading-word';
                span.textContent = part;
                fragment.appendChild(span);
            });
            node.replaceWith(fragment);
        });

        root.querySelectorAll('.vocab-word').forEach(word => {
            word.classList.add('reading-word');
        });

        return [...root.querySelectorAll('.reading-word')];
    }

    function startReadingMode() {
        const root = document.getElementById('passage-text-content');
        if (!root) return;

        const words = ensureReadingWords(root);
        if (!words.length) return;

        stopReadingMode();
        window.readingModeActive = true;
        window.readingWordIndex = 0;

        const tick = () => {
            if (!window.readingModeActive) return;

            const word = words[window.readingWordIndex];
            if (!word) {
                stopReadingMode();
                return;
            }

            words.forEach((item, index) => {
                item.classList.toggle('is-current', index === window.readingWordIndex);
                item.classList.toggle('is-read', index < window.readingWordIndex);
                if (index < window.readingWordIndex) {
                    item.style.opacity = '0';
                    item.style.transform = 'translateY(-3px)';
                    item.style.filter = 'blur(2px)';
                    item.style.visibility = 'visible';
                    item.style.maxWidth = 'none';
                    item.style.marginRight = '0';
                } else {
                    item.style.opacity = '1';
                    item.style.transform = 'none';
                    item.style.filter = 'none';
                    item.style.visibility = 'visible';
                    item.style.maxWidth = 'none';
                    item.style.marginRight = '';
                }
            });

            word.classList.add('is-current');
            word.style.opacity = '1';
            word.style.transform = 'none';
            window.readingTimer = setTimeout(() => {
                if (!window.readingModeActive) return;
                word.classList.remove('is-current');
                word.classList.add('is-read');
                word.style.opacity = '0';
                word.style.transform = 'translateY(-3px)';
                word.style.filter = 'blur(2px)';
                word.style.visibility = 'visible';
                word.style.maxWidth = 'none';
                word.style.marginRight = '0';
                window.readingWordIndex += 1;
                if (window.readingWordIndex < words.length) {
                    tick();
                } else {
                    stopReadingMode();
                }
            }, getReadingDelayMs());
        };

        tick();
    }

    window.setReadingSpeed = function(value) {
        const speed = Number(value);
        if (!Number.isFinite(speed) || speed <= 0) return;
        window.readingSpeed = speed;
        const input = document.getElementById('reading-speed-input');
        if (input) input.value = String(Math.round(speed));
        if (window.readingModeActive) {
            startReadingMode();
        }
    };

    window.pauseReadingMode = function() {
        if (window.readingTimer) {
            clearTimeout(window.readingTimer);
            window.readingTimer = null;
        }
        window.readingModeActive = false;
    };

    window.toggleReadingMode = function() {
        if (window.readingModeActive) {
            window.pauseReadingMode();
            return;
        }
        startReadingMode();
    };

    window.captureSyntaxChunkSelection = function() {
        const root = document.getElementById('passage-text-content');
        const selection = window.getSelection();
        if (!root || !selection || selection.rangeCount === 0 || selection.isCollapsed) return;
        const range = selection.getRangeAt(0);
        if (root.contains(range.commonAncestorContainer)) {
            savedSyntaxChunkSelection = range.cloneRange();
        }
    };
    document.addEventListener('selectionchange', window.captureSyntaxChunkSelection);

    window.applySyntaxChunk = function(role) {
        const rt = (en, vi) => (typeof window !== 'undefined' && typeof window.studentText === 'function' ? window.studentText(en, vi) : vi);
        const roleLabels = {
            subject: rt('Subject', 'Chủ ngữ'),
            verb: rt('Verb', 'Động từ'),
            object: rt('Object', 'Tân ngữ')
        };
        const root = document.getElementById('passage-text-content');
        const status = document.getElementById('syntax-chunking-status');
        const selection = window.getSelection();
        if (!roleLabels[role]) return;
        if (!root) {
            if (status) status.textContent = rt('Reading passage not found. Please reload the Reading section.', 'Không tìm thấy đoạn văn để gắn nhãn. Hãy tải lại phần Reading.');
            return;
        }

        const selectedRange = selection && selection.rangeCount > 0 && !selection.isCollapsed
            ? selection.getRangeAt(0)
            : null;
        const range = selectedRange && root.contains(selectedRange.commonAncestorContainer)
            ? selectedRange
            : savedSyntaxChunkSelection;
        if (!range || !root.contains(range.commonAncestorContainer) || range.collapsed) {
            if (status) status.textContent = rt('Select a phrase in the passage before labeling.', 'Chọn một cụm từ trong đoạn văn trước khi gán nhãn.');
            return;
        }

        const overlapsChunk = [...root.querySelectorAll('.syntax-chunk')].some(chunk => range.intersectsNode(chunk));
        if (overlapsChunk) {
            if (status) status.textContent = rt('Clear existing labels before overlapping a phrase.', 'Xoá nhãn hiện tại trước khi gán nhãn chồng lên cụm từ.');
            return;
        }

        const chunk = document.createElement('span');
        chunk.className = `syntax-chunk syntax-chunk--${role}`;
        chunk.dataset.syntaxRole = role;
        chunk.setAttribute('aria-label', roleLabels[role]);
        chunk.appendChild(range.extractContents());
        range.insertNode(chunk);
        selection?.removeAllRanges();
        savedSyntaxChunkSelection = null;
        if (status) status.textContent = rt(`Marked ${roleLabels[role]}.`, `Đã đánh dấu ${roleLabels[role]}.`);
    };

    window.clearSyntaxChunks = function() {
        const rt = (en, vi) => (typeof window !== 'undefined' && typeof window.studentText === 'function' ? window.studentText(en, vi) : vi);
        const root = document.getElementById('passage-text-content');
        if (!root) return;
        root.querySelectorAll('.syntax-chunk').forEach(chunk => {
            chunk.replaceWith(...chunk.childNodes);
        });
        savedSyntaxChunkSelection = null;
        const status = document.getElementById('syntax-chunking-status');
        if (status) status.textContent = rt('Cleared syntax labels.', 'Đã xoá các nhãn cấu trúc câu.');
    };

    function renderReadingControls() {
        return `
          <div class="reading-mode-controls">
            <button type="button" onclick="window.toggleReadingMode()">${window.readingModeActive ? 'Pause' : 'Read'}</button>
            <label for="reading-speed-input">WPM</label>
            <input id="reading-speed-input" type="number" min="40" max="800" step="10" value="${Math.round(window.readingSpeed || 220)}" oninput="window.setReadingSpeed(this.value)" />
          </div>
        `;
    }
