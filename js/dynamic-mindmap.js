(function() {
    const savedOutlines = new Map();
    let nextIdeaId = 0;
    const t = (en, vi) => (typeof window !== 'undefined' && typeof window.studentText === 'function' ? window.studentText(en, vi) : en);

    function getDefaultBranches() {
        return [
            { id: 'main', label: t('Main idea', 'Ý chính'), prompt: t('What is your central point?', 'Ý chính của bạn là gì?') },
            { id: 'support', label: t('Support', 'Giải thích'), prompt: t('Why or how does it happen?', 'Tại sao hoặc điều đó xảy ra như thế nào?') },
            { id: 'example', label: t('Example', 'Ví dụ'), prompt: t('What example makes it clear?', 'Ví dụ nào làm rõ ý này?') },
            { id: 'result', label: t('Result', 'Kết luận'), prompt: t('What is the outcome or takeaway?', 'Kết quả hoặc thông điệp rút ra là gì?') }
        ];
    }
    function getOutlineBranches(part) {
        const task = String(part?.writingTask || '').toLowerCase();
        const title = plainText(part?.title || '').toLowerCase();
        if (task === 'task1') {
            return [
                { id: 'main', label: t('Main Details (Overview)', 'Xu hướng chính (Overview)'), prompt: t('What are the key overall trends or main features for the overview?', 'Những xu hướng tổng quan hoặc đặc điểm nổi bật nhất là gì?') },
                { id: 'support', label: t('Minor Details (Body)', 'Số liệu chi tiết (Body)'), prompt: t('Which specific figures, comparisons, or stages go into the body paragraphs?', 'Những số liệu, phép so sánh hoặc giai đoạn cụ thể nào sẽ đưa vào thân bài?') }
            ];
        }
        if (task === 'task2') {
            return [
                { id: 'main', label: t('Position (Thesis Statement)', 'Quan điểm (Thesis Statement)'), prompt: t('What is your clear stance or thesis statement?', 'Lập trường hoặc câu luận điểm chính của bạn là gì?') },
                { id: 'support', label: t('Main Point', 'Luận điểm chính'), prompt: t('What is the core topic sentence for each body paragraph?', 'Câu chủ đề cốt lõi cho mỗi đoạn thân bài là gì?') },
                { id: 'example', label: t('Explanation', 'Giải thích & Triển khai'), prompt: t('Why is this true, and what reasoning or example supports it?', 'Vì sao điều này đúng, và lập luận hoặc ví dụ nào chứng minh cho nó?') }
            ];
        }
        if (/\bpart\s*1\b/i.test(title)) {
            return [
                { id: 'main', label: t('Direct Answer', 'Trả lời trực tiếp'), prompt: t('What is your immediate, natural answer to the question?', 'Câu trả lời trực tiếp và tự nhiên ngay lập tức của bạn là gì?') },
                { id: 'support', label: t('Further Details', 'Chi tiết mở rộng'), prompt: t('What specific reason, habit, or brief detail expands your answer?', 'Lý do, thói quen hoặc chi tiết ngắn nào giúp mở rộng câu trả lời?') }
            ];
        }
        if (/\bpart\s*2\b/i.test(title)) {
            return [
                { id: 'main', label: t('Topic Sentence', 'Câu mở đầu'), prompt: t('How will you introduce the person, place, object, or experience?', 'Bạn sẽ giới thiệu người, địa điểm, đồ vật hoặc trải nghiệm này như thế nào?') },
                { id: 'support', label: t('Background Info', 'Bối cảnh'), prompt: t('When, where, or how did this happen (context & setup)?', 'Sự việc diễn ra khi nào, ở đâu hoặc trong bối cảnh nào?') },
                { id: 'example', label: t('Main Point', 'Nội dung chính'), prompt: t('What are the key details, events, or qualities to describe?', 'Những chi tiết, sự kiện hoặc đặc điểm chính cần mô tả là gì?') },
                { id: 'result', label: t('Feelings & Future Plans', 'Cảm xúc & Dự định'), prompt: t('How did you feel about it and what are your future plans or takeaways?', 'Cảm xúc của bạn ra sao và bạn có dự định hay bài học gì?') }
            ];
        }
        if (/\bpart\s*3\b/i.test(title)) {
            return [
                { id: 'main', label: t('Point', 'Luận điểm'), prompt: t('What is your direct analytical point in response to the question?', 'Luận điểm phân tích trực tiếp cho câu hỏi là gì?') },
                { id: 'support', label: t('Explanation', 'Giải thích'), prompt: t('Why does this happen or what mechanism/cause explains it?', 'Tại sao điều này xảy ra hoặc cơ chế/nguyên nhân nào giải thích nó?') },
                { id: 'example', label: t('Example & Link Back', 'Ví dụ & Liên kết lại'), prompt: t('What concrete example illustrates this, and how does it tie back to the question?', 'Ví dụ cụ thể nào minh họa cho ý này và liên kết lại với câu hỏi ra sao?') }
            ];
        }
        return getDefaultBranches();
    }
    function getMarkerGroups() {
        return [
            { id: 'sequence', label: t('Add a point', 'Thêm ý'), phrases: ['To begin with', 'Another point is that', 'In addition', 'Furthermore'] },
            { id: 'explain', label: t('Explain or exemplify', 'Giải thích, nêu ví dụ'), phrases: ['This is because', 'For example', 'For instance', 'In other words'] },
            { id: 'contrast', label: t('Contrast', 'Tương phản'), phrases: ['However', 'On the other hand', 'Whereas', 'Although'] },
            { id: 'result', label: t('Result or conclude', 'Kết quả, kết luận'), phrases: ['As a result', 'Therefore', 'Consequently', 'Overall'] }
        ];
    }

    function escapeHtml(value) {
        return String(value ?? '').replace(/[&<>"']/g, character => ({
            '&': '&amp;',
            '<': '&lt;',
            '>': '&gt;',
            '"': '&quot;',
            "'": '&#39;'
        })[character]);
    }

    function plainText(value) {
        return String(value ?? '')
            .replace(/<[^>]*>/g, ' ')
            .replace(/&nbsp;/gi, ' ')
            .replace(/&amp;/gi, '&')
            .replace(/&lt;/gi, '<')
            .replace(/&gt;/gi, '>')
            .replace(/&quot;/gi, '"')
            .replace(/&#39;|&apos;/gi, "'")
            .replace(/\s+/g, ' ')
            .trim();
    }

    window.filterDynamicMindMapVocabulary = function(vocabulary, part, partIndex, partCount) {
        const title = plainText(part?.title || `Part ${partIndex + 1}`).toLowerCase();
        return (Array.isArray(vocabulary) ? vocabulary : []).filter(item => {
            const assignedPart = plainText(item?.part).toLowerCase();
            if (assignedPart) return assignedPart === title;
            return partCount === 1 || partIndex === 0;
        });
    };

    window.hasDynamicMindMapContent = function(part, vocabulary) {
        const mindMap = part?.mindMap && typeof part.mindMap === 'object' ? part.mindMap : {};
        const hasPhrase = Array.isArray(mindMap.phrases) &&
            mindMap.phrases.some(item => plainText(item?.term));
        const hasIdea = Array.isArray(mindMap.topics) &&
            mindMap.topics.some(topic =>
                plainText(topic?.label) &&
                Array.isArray(topic.ideas) &&
                topic.ideas.some(idea => plainText(idea))
            );
        const hasVocabulary = Array.isArray(vocabulary) &&
            vocabulary.some(item => plainText(item?.term));
        return hasPhrase || hasIdea || hasVocabulary;
    };

    window.shouldRenderDynamicMindMap = function(module, part, vocabulary) {
        return !['writing', 'speaking'].includes(module) ||
            window.hasDynamicMindMapContent(part, vocabulary);
    };

    function topicId(label) {
        return `topic-${label.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'general'}`;
    }

    function getOutlineState(key, topicLabels, mindMapTopics) {
        const state = savedOutlines.get(key) || { activeBranch: 'main', phrases: {}, network: null };
        if (!state.network) {
            state.network = { topics: [], ideas: [], links: [] };
        }
        const allTopics = [
            ...topicLabels.map(label => ({ label, ideas: [] })),
            ...(Array.isArray(mindMapTopics) ? mindMapTopics : [])
        ];
        allTopics.forEach(item => {
            const label = plainText(item?.label);
            if (!label) return;
            const id = topicId(label);
            if (!state.network.topics.some(topic => topic.id === id)) {
                state.network.topics.push({ id, label });
            }
            (Array.isArray(item.ideas) ? item.ideas : []).forEach((rawIdea, ideaIndex) => {
                const text = plainText(rawIdea);
                const ideaId = `teacher-idea-${ideaIndex}-${id}`;
                if (!text || state.network.ideas.some(idea => idea.id === ideaId)) return;
                state.network.ideas.push({ id: ideaId, text, topicId: id });
            });
        });
        savedOutlines.set(key, state);
        return state;
    }

    function renderIdeaNetwork(state) {
        const network = state.network;
        const ideasByTopic = new Map(network.topics.map(topic => [topic.id, []]));
        network.ideas.forEach(idea => {
            if (!ideasByTopic.has(idea.topicId)) return;
            ideasByTopic.get(idea.topicId).push(idea);
        });
        const topicsHtml = network.topics.map(topic => `
            <section class="dynamic-mindmap__network-topic" data-network-topic="${escapeHtml(topic.id)}">
                <header><h4>${escapeHtml(topic.label)}</h4><span>${ideasByTopic.get(topic.id).length} ${t('ideas', 'ý tưởng')}</span></header>
                <form class="dynamic-mindmap__network-add" data-network-add-idea="${escapeHtml(topic.id)}">
                    <label class="sr-only" for="network-idea-input-${escapeHtml(topic.id)}">${t('Add an idea to', 'Thêm ý tưởng vào')} ${escapeHtml(topic.label)}</label>
                    <input id="network-idea-input-${escapeHtml(topic.id)}" data-network-idea-input maxlength="160" placeholder="${t('Add an idea…', 'Thêm ý tưởng…')}" required>
                    <button type="submit" aria-label="${t('Add idea to', 'Thêm ý tưởng vào')} ${escapeHtml(topic.label)}">${t('Add', 'Thêm')}</button>
                </form>
                <div class="dynamic-mindmap__network-ideas">
                    ${ideasByTopic.get(topic.id).map(idea => `
                        <article class="dynamic-mindmap__network-idea" data-network-idea="${escapeHtml(idea.id)}" draggable="true">
                            <button type="button" class="dynamic-mindmap__network-idea-select" data-network-select-idea="${escapeHtml(idea.id)}">${escapeHtml(idea.text)}</button>
                            <label class="sr-only" for="network-move-${escapeHtml(idea.id)}">${t('Move idea to another topic', 'Chuyển ý tưởng sang chủ đề khác')}</label>
                            <select id="network-move-${escapeHtml(idea.id)}" data-network-move-idea="${escapeHtml(idea.id)}" aria-label="${t('Move idea to another topic', 'Chuyển ý tưởng sang chủ đề khác')}">
                                ${network.topics.map(option => `<option value="${escapeHtml(option.id)}"${idea.topicId === option.id ? ' selected' : ''}>${escapeHtml(option.label)}</option>`).join('')}
                            </select>
                            <button type="button" data-network-remove-idea="${escapeHtml(idea.id)}" aria-label="${t('Remove idea:', 'Xóa ý tưởng:')} ${escapeHtml(idea.text)}">×</button>
                        </article>
                    `).join('')}
                </div>
            </section>
        `).join('');
        const linksHtml = network.links.map(link => {
            const first = network.ideas.find(idea => idea.id === link.from);
            const second = network.ideas.find(idea => idea.id === link.to);
            if (!first || !second) return '';
            return `<li><span>${escapeHtml(first.text)}</span><b aria-hidden="true">↔</b><span>${escapeHtml(second.text)}</span>
                <button type="button" data-network-remove-link="${escapeHtml(link.id)}" aria-label="${t('Remove connection', 'Xóa liên kết')}">${t('Remove', 'Xóa')}</button></li>`;
        }).join('');
        return `<section class="dynamic-mindmap__network" data-idea-network aria-labelledby="idea-network-title">
            <header class="dynamic-mindmap__network-header">
                <div><h3 id="idea-network-title">${t('Cross-topic Idea Network', 'Mạng lưới ý tưởng')}</h3>
                    <p>${t('Add ideas, move them between topics by dragging or using the menu, and connect related ideas. Notes stay in this practice session and are not submitted.', 'Thêm ý tưởng, kéo thả hoặc dùng menu để chuyển giữa các chủ đề và nối các ý liên quan. Ghi chú chỉ lưu trong phiên luyện tập này và không bị nộp bài.')}</p></div>
                <button type="button" data-network-link-mode aria-pressed="false">${t('Connect ideas', 'Nối ý')}</button>
            </header>
            <form class="dynamic-mindmap__network-add-topic" data-network-add-topic>
                <label for="network-new-topic">${t('Add a topic', 'Thêm chủ đề')}</label>
                <input id="network-new-topic" data-network-topic-input maxlength="80" placeholder="${t('e.g. Education', 'VD: Education')}" required>
                <button type="submit">${t('Add topic', 'Thêm chủ đề')}</button>
            </form>
            <div class="dynamic-mindmap__network-topics">${topicsHtml}</div>
            <p class="dynamic-mindmap__network-status" data-network-status aria-live="polite">${t('Drag an idea to another topic, or select Connect ideas and choose two ideas.', 'Kéo ý tưởng sang chủ đề khác, hoặc bấm Nối ý rồi chọn hai ý tưởng.')}</p>
            <section class="dynamic-mindmap__network-links" aria-label="${t('Connected ideas', 'Các ý đã nối')}">
                <h4>${t('Connections', 'Các mối liên hệ')}</h4>
                <ul data-network-links>${linksHtml || `<li class="dynamic-mindmap__network-empty">${t('No connections yet. Select Connect ideas to link related ideas.', 'Chưa có liên kết nào. Bấm Nối ý để nối các ý liên quan.')}</li>`}</ul>
            </section>
        </section>`;
    }

    function renderPhraseButton(id, label, detail, kind, isSelected, defaultBranch = '') {
        const safeLabel = escapeHtml(label);
        const safeDetail = plainText(detail);
        const title = safeDetail ? ` title="${escapeHtml(safeDetail)}"` : '';
        const branchAttribute = defaultBranch ? ` data-mindmap-default-branch="${escapeHtml(defaultBranch)}"` : '';
        return `<button type="button" class="dynamic-mindmap__phrase" data-mindmap-phrase="${escapeHtml(id)}" data-mindmap-kind="${kind}" data-mindmap-draggable="true" draggable="true" aria-pressed="${isSelected}"${branchAttribute}${title}>
            <span>${safeLabel}</span><span class="dynamic-mindmap__phrase-state" aria-hidden="true">${isSelected ? '✓' : '＋'}</span>
        </button>`;
    }

    window.renderDynamicMindMap = function(part, vocabulary, outlineKey, topics) {
        const source = Array.isArray(vocabulary) ? vocabulary : [];
        const key = String(outlineKey || plainText(part?.title) || 'current-task');
        const topic = plainText(part?.speakingQuestions) || plainText(part?.title) || t('Your response', 'Câu trả lời của bạn');
        const topicLabels = Array.isArray(topics)
            ? [...new Set(topics.map(plainText).filter(Boolean))]
            : [];
        if (!topicLabels.length) topicLabels.push(topic);
        const branches = getOutlineBranches(part);
        const markerGroups = getMarkerGroups();
        const mindMap = part?.mindMap && typeof part.mindMap === 'object' ? part.mindMap : {};
        const state = getOutlineState(key, topicLabels, mindMap.topics);
        const vocabTerms = source
            .map((item, index) => ({ item, id: `vocab-${index}`, term: plainText(item?.term) }))
            .filter(entry => entry.term);
        const customTerms = (Array.isArray(mindMap.phrases) ? mindMap.phrases : [])
            .map((item, index) => ({
                item,
                id: `custom-${index}`,
                term: plainText(item?.term),
                branch: branches.some(branch => branch.id === item?.branch) ? item.branch : ''
            }))
            .filter(entry => entry.term);
        const phraseLabels = new Map();
        vocabTerms.forEach(({ id, term }) => {
            phraseLabels.set(id, term);
        });
        customTerms.forEach(({ id, term }) => {
            phraseLabels.set(id, term);
        });
        markerGroups.forEach(group => group.phrases.forEach((phrase, index) => {
            phraseLabels.set(`marker-${group.id}-${index}`, phrase);
        }));
        const vocabularyHtml = vocabTerms.length || customTerms.length
            ? [
                ...customTerms.map(({ item, id, term, branch }) =>
                    renderPhraseButton(id, term, item.detail, 'collocation', Boolean(state.phrases[id]), branch)
                ),
                ...vocabTerms.map(({ item, id, term }) =>
                    renderPhraseButton(id, term, item.eng || item.vi || item.example, 'collocation', Boolean(state.phrases[id]))
                )
            ].join('')
            : `<p class="dynamic-mindmap__empty">${t('No task vocabulary has been added yet. Choose a discourse marker below to start your outline.', 'Chưa có từ vựng theo đề. Hãy chọn từ nối bên dưới để bắt đầu lập dàn ý.')}</p>`;
        const markersHtml = markerGroups.map(group => `
            <section class="dynamic-mindmap__marker-group">
                <h5>${escapeHtml(group.label)}</h5>
                <div class="dynamic-mindmap__phrases">
                    ${group.phrases.map((phrase, index) =>
                    renderPhraseButton(`marker-${group.id}-${index}`, phrase, '', 'marker', Boolean(state.phrases[`marker-${group.id}-${index}`]))
                    ).join('')}
                </div>
            </section>
        `).join('');

        const branchesHtml = branches.map((branch, index) => {
            const active = state.activeBranch === branch.id;
            const itemsHtml = Object.entries(state.phrases)
                .filter(([, branchId]) => branchId === branch.id)
                .map(([phraseId]) => {
                    const phrase = phraseLabels.get(phraseId);
                    return phrase ? `<button type="button" class="dynamic-mindmap__outline-item" data-mindmap-remove="${escapeHtml(phraseId)}" aria-label="Remove ${escapeHtml(phrase)} from ${escapeHtml(branch.label)}">
                        <span>${escapeHtml(phrase)}</span><span aria-hidden="true">×</span>
                    </button>` : '';
                }).join('');
            return `<section class="dynamic-mindmap__branch${active ? ' is-active' : ''}" data-mindmap-branch="${branch.id}" data-mindmap-drop-branch="${branch.id}">
                <button type="button" class="dynamic-mindmap__branch-select" data-mindmap-select-branch="${branch.id}" aria-pressed="${active}">
                    <span class="dynamic-mindmap__branch-number">${index + 1}</span>
                    <span><strong>${escapeHtml(branch.label)}</strong><small>${escapeHtml(branch.prompt)}</small></span>
                </button>
                <div class="dynamic-mindmap__branch-items" data-mindmap-items="${branch.id}">${itemsHtml}</div>
            </section>`;
        }).join('');

        return `<section class="dynamic-mindmap" data-mindmap-root data-mindmap-key="${escapeHtml(key)}" aria-labelledby="dynamic-mindmap-title">
            <header class="dynamic-mindmap__header">
                <span class="dynamic-mindmap__eyebrow">${t('Build your response', 'Tự xây dựng câu trả lời')}</span>
                <h2 id="dynamic-mindmap-title">${t('Dynamic Mind Map', 'Sơ đồ tư duy')}</h2>
                <p>${t('Choose a branch, then click or drag phrases into your outline. Make your own ideas; this is a scaffold, not a model answer.', 'Chọn một nhánh, sau đó bấm hoặc kéo cụm từ vào dàn ý. Hãy tự phát triển ý tưởng của riêng bạn; đây là khung gợi ý, không phải bài mẫu.')}</p>
            </header>
            <div class="dynamic-mindmap__topic"><span>${t('YOUR TASK', 'ĐỀ BÀI')}</span><strong>${escapeHtml(topic)}</strong></div>
            <div class="dynamic-mindmap__layout">
                <div class="dynamic-mindmap__branches" role="group" aria-label="${t('Choose an outline branch', 'Chọn một nhánh dàn ý')}">
                    ${branchesHtml}
                </div>
                <aside class="dynamic-mindmap__bank" aria-label="${t('Phrase bank', 'Ngân hàng cụm từ')}">
                    <section>
                        <h4>${t('Task collocations', 'Cụm từ theo đề')}</h4>
                        <p>${t('Teacher-provided phrases and the Test Vocabulary Bank', 'Cụm từ giáo viên cung cấp và Ngân hàng Từ vựng của đề')}</p>
                        <div class="dynamic-mindmap__phrases">${vocabularyHtml}</div>
                    </section>
                    <section>
                        <h4>${t('Discourse markers', 'Từ nối')}</h4>
                        ${markersHtml}
                    </section>
                </aside>
            </div>
            <p class="dynamic-mindmap__status" data-mindmap-status aria-live="polite">${escapeHtml(branches.find(branch => branch.id === state.activeBranch)?.label || branches[0].label)} ${t('selected. Choose phrases to add them to your outline.', 'đang được chọn. Bấm chọn cụm từ để thêm vào dàn ý.')}</p>
            ${renderIdeaNetwork(state)}
        </section>`;
    };

    window.initDynamicMindMap = function(root) {
        const map = root?.querySelector('[data-mindmap-root]');
        if (!map || map.dataset.initialized === 'true') return;
        map.dataset.initialized = 'true';
        const state = savedOutlines.get(map.dataset.mindmapKey) || { activeBranch: 'main', phrases: {}, network: { topics: [], ideas: [], links: [] } };
        if (!state.network) state.network = { topics: [], ideas: [], links: [] };
        savedOutlines.set(map.dataset.mindmapKey, state);
        map.dataset.activeBranch = state.activeBranch;
        const status = map.querySelector('[data-mindmap-status]');
        const branchLabels = new Map(
            Array.from(map.querySelectorAll('[data-mindmap-branch]')).map(section => [
                section.dataset.mindmapBranch,
                section.querySelector('.dynamic-mindmap__branch-select strong')?.textContent?.trim() || section.dataset.mindmapBranch
            ])
        );
        const removePhraseFromOutline = phraseId => {
            map.querySelector(`[data-mindmap-remove="${phraseId}"]`)?.remove();
            delete state.phrases[phraseId];
            const button = map.querySelector(`[data-mindmap-phrase="${phraseId}"]`);
            button?.setAttribute('aria-pressed', 'false');
            const phraseState = button?.querySelector('.dynamic-mindmap__phrase-state');
            if (phraseState) phraseState.textContent = '＋';
        };
        const placePhraseInBranch = (phraseId, branchId) => {
            const button = map.querySelector(`[data-mindmap-phrase="${phraseId}"]`);
            const destination = map.querySelector(`[data-mindmap-items="${branchId}"]`);
            if (!button || !destination || !branchLabels.has(branchId)) return false;
            if (state.phrases[phraseId] === branchId) return false;
            removePhraseFromOutline(phraseId);

            const phrase = button.querySelector('span')?.textContent || '';
            const item = document.createElement('button');
            item.type = 'button';
            item.className = 'dynamic-mindmap__outline-item';
            item.dataset.mindmapRemove = phraseId;
            item.setAttribute('aria-label', `Remove ${phrase} from ${branchLabels.get(branchId)}`);
            item.innerHTML = `<span>${escapeHtml(phrase)}</span><span aria-hidden="true">×</span>`;
            item.addEventListener('click', () => {
                removePhraseFromOutline(phraseId);
                if (status) status.textContent = t('Phrase removed from your outline.', 'Đã xóa cụm từ khỏi dàn ý.');
            });
            destination.appendChild(item);
            state.phrases[phraseId] = branchId;
            button.setAttribute('aria-pressed', 'true');
            const phraseState = button.querySelector('.dynamic-mindmap__phrase-state');
            if (phraseState) phraseState.textContent = '✓';
            return true;
        };

        map.querySelectorAll('[data-mindmap-select-branch]').forEach(button => {
            button.addEventListener('click', () => {
                const branchId = button.dataset.mindmapSelectBranch;
                map.dataset.activeBranch = branchId;
                state.activeBranch = branchId;
                map.querySelectorAll('[data-mindmap-select-branch]').forEach(item => {
                    const active = item === button;
                    item.setAttribute('aria-pressed', String(active));
                    item.closest('[data-mindmap-branch]')?.classList.toggle('is-active', active);
                });
                if (status) status.textContent = `${branchLabels.get(branchId)} ${t('selected. Choose phrases to add them to your outline.', 'đang được chọn. Bấm chọn cụm từ để thêm vào dàn ý.')}`;
            });
        });

        map.querySelectorAll('[data-mindmap-phrase]').forEach(button => {
            button.addEventListener('click', () => {
                const phraseId = button.dataset.mindmapPhrase;
                const previousBranch = state.phrases[phraseId];
                if (previousBranch) {
                    removePhraseFromOutline(phraseId);
                    if (status) status.textContent = t('Phrase removed from your outline.', 'Đã xóa cụm từ khỏi dàn ý.');
                    return;
                }

                const branchId = button.dataset.mindmapDefaultBranch || map.dataset.activeBranch || 'main';
                const phrase = button.querySelector('span')?.textContent || '';
                if (placePhraseInBranch(phraseId, branchId) && status) {
                    status.textContent = t(`${phrase} added to ${branchLabels.get(branchId)}.`, `Đã thêm "${phrase}" vào ${branchLabels.get(branchId)}.`);
                }
            });
            button.addEventListener('dragstart', event => {
                event.dataTransfer?.setData('text/plain', button.dataset.mindmapPhrase);
                if (event.dataTransfer) event.dataTransfer.effectAllowed = 'copy';
            });
        });

        map.querySelectorAll('[data-mindmap-drop-branch]').forEach(branch => {
            branch.addEventListener('dragover', event => {
                event.preventDefault();
                branch.classList.add('is-drop-target');
            });
            branch.addEventListener('dragleave', event => {
                if (!branch.contains(event.relatedTarget)) branch.classList.remove('is-drop-target');
            });
            branch.addEventListener('drop', event => {
                event.preventDefault();
                branch.classList.remove('is-drop-target');
                const phraseId = event.dataTransfer?.getData('text/plain');
                const branchId = branch.dataset.mindmapDropBranch;
                if (placePhraseInBranch(phraseId, branchId) && status) {
                    status.textContent = t(`Phrase added to ${branchLabels.get(branchId)}.`, `Đã thêm cụm từ vào ${branchLabels.get(branchId)}.`);
                }
            });
        });

        map.querySelectorAll('[data-mindmap-remove]').forEach(item => {
            item.addEventListener('click', () => {
                const phraseId = item.dataset.mindmapRemove;
                removePhraseFromOutline(phraseId);
                if (status) status.textContent = t('Phrase removed from your outline.', 'Đã xóa cụm từ khỏi dàn ý.');
            });
        });

        let networkRoot = map.querySelector('[data-idea-network]');
        const refreshNetwork = message => {
            if (!networkRoot) return;
            networkRoot.outerHTML = renderIdeaNetwork(state);
            networkRoot = map.querySelector('[data-idea-network]');
            bindIdeaNetwork(networkRoot, state);
            const refreshedStatus = networkRoot.querySelector('[data-network-status]');
            if (refreshedStatus && message) refreshedStatus.textContent = message;
        };
        bindIdeaNetwork(networkRoot, state);

        function bindIdeaNetwork(network, outlineState) {
            if (!network) return;
            const currentStatus = network.querySelector('[data-network-status]');
            const say = message => {
                if (currentStatus) currentStatus.textContent = message;
            };
            const addTopicForm = network.querySelector('[data-network-add-topic]');
            addTopicForm?.addEventListener('submit', event => {
                event.preventDefault();
                const input = addTopicForm.querySelector('[data-network-topic-input]');
                const label = plainText(input?.value);
                if (!label) return;
                const id = topicId(label);
                if (outlineState.network.topics.some(topic => topic.id === id)) {
                    say(t('That topic is already on your network.', 'Chủ đề đó đã có trong mạng lưới ý tưởng.'));
                    return;
                }
                outlineState.network.topics.push({ id, label });
                refreshNetwork(t(`${label} added to your idea network.`, `Đã thêm chủ đề "${label}" vào mạng lưới ý tưởng.`));
            });
            network.querySelectorAll('[data-network-add-idea]').forEach(form => {
                form.addEventListener('submit', event => {
                    event.preventDefault();
                    const input = form.querySelector('[data-network-idea-input]');
                    const text = plainText(input?.value);
                    if (!text) return;
                    outlineState.network.ideas.push({
                        id: `network-idea-${++nextIdeaId}`,
                        text,
                        topicId: form.dataset.networkAddIdea
                    });
                    refreshNetwork(t('Idea added to your network.', 'Đã thêm ý tưởng vào mạng lưới.'));
                });
            });
            const linkMode = network.querySelector('[data-network-link-mode]');
            linkMode?.addEventListener('click', () => {
                const active = linkMode.getAttribute('aria-pressed') !== 'true';
                linkMode.setAttribute('aria-pressed', String(active));
                outlineState.network.selectedIdea = null;
                network.querySelectorAll('[data-network-select-idea]').forEach(button => {
                    button.classList.remove('is-selected');
                });
                say(active ? t('Choose the first idea, then choose a related idea to connect them.', 'Chọn ý tưởng thứ nhất, sau đó chọn ý liên quan để nối lại.') : t('Idea connection mode is off.', 'Đã tắt chế độ nối ý tưởng.'));
            });
            network.querySelectorAll('[data-network-select-idea]').forEach(button => {
                button.addEventListener('click', () => {
                    if (linkMode?.getAttribute('aria-pressed') !== 'true') return;
                    const ideaId = button.dataset.networkSelectIdea;
                    if (!outlineState.network.selectedIdea) {
                        outlineState.network.selectedIdea = ideaId;
                        button.classList.add('is-selected');
                        say(t('First idea selected. Choose another idea to create a connection.', 'Đã chọn ý đầu tiên. Chọn một ý khác để tạo liên kết.'));
                        return;
                    }
                    const firstId = outlineState.network.selectedIdea;
                    if (firstId === ideaId) {
                        outlineState.network.selectedIdea = null;
                        button.classList.remove('is-selected');
                        say(t('Selection cleared. Choose two different ideas.', 'Đã bỏ chọn. Hãy chọn hai ý tưởng khác nhau.'));
                        return;
                    }
                    const exists = outlineState.network.links.some(link =>
                        (link.from === firstId && link.to === ideaId) ||
                        (link.from === ideaId && link.to === firstId)
                    );
                    if (!exists) {
                        outlineState.network.links.push({
                            id: `network-link-${firstId}-${ideaId}`,
                            from: firstId,
                            to: ideaId
                        });
                    }
                    outlineState.network.selectedIdea = null;
                    refreshNetwork(exists ? t('Those ideas are already connected.', 'Hai ý tưởng này đã được nối sẵn.') : t('Related ideas connected.', 'Đã nối các ý tưởng liên quan.'));
                });
            });
            network.querySelectorAll('[data-network-move-idea]').forEach(select => {
                select.addEventListener('change', () => {
                    const idea = outlineState.network.ideas.find(item => item.id === select.dataset.networkMoveIdea);
                    const destination = outlineState.network.topics.find(topic => topic.id === select.value);
                    if (!idea || !destination) return;
                    idea.topicId = destination.id;
                    refreshNetwork(t(`Idea moved to ${destination.label}.`, `Đã chuyển ý tưởng sang ${destination.label}.`));
                });
            });
            network.querySelectorAll('[data-network-remove-idea]').forEach(button => {
                button.addEventListener('click', () => {
                    const ideaId = button.dataset.networkRemoveIdea;
                    outlineState.network.ideas = outlineState.network.ideas.filter(idea => idea.id !== ideaId);
                    outlineState.network.links = outlineState.network.links.filter(link =>
                        link.from !== ideaId && link.to !== ideaId
                    );
                    refreshNetwork(t('Idea and its connections removed.', 'Đã xóa ý tưởng và các liên kết của nó.'));
                });
            });
            network.querySelectorAll('[data-network-remove-link]').forEach(button => {
                button.addEventListener('click', () => {
                    outlineState.network.links = outlineState.network.links.filter(link => link.id !== button.dataset.networkRemoveLink);
                    refreshNetwork(t('Connection removed.', 'Đã xóa liên kết.'));
                });
            });
            network.querySelectorAll('[data-network-topic]').forEach(topic => {
                topic.addEventListener('dragover', event => {
                    event.preventDefault();
                    topic.classList.add('is-drop-target');
                });
                topic.addEventListener('dragleave', event => {
                    if (!topic.contains(event.relatedTarget)) topic.classList.remove('is-drop-target');
                });
                topic.addEventListener('drop', event => {
                    event.preventDefault();
                    topic.classList.remove('is-drop-target');
                    const ideaId = event.dataTransfer?.getData('text/plain');
                    const idea = outlineState.network.ideas.find(item => item.id === ideaId);
                    if (!idea) return;
                    idea.topicId = topic.dataset.networkTopic;
                    refreshNetwork(t('Idea moved to another topic.', 'Đã chuyển ý tưởng sang chủ đề khác.'));
                });
            });
            network.querySelectorAll('[data-network-idea]').forEach(idea => {
                idea.addEventListener('dragstart', event => {
                    event.dataTransfer?.setData('text/plain', idea.dataset.networkIdea);
                    if (event.dataTransfer) event.dataTransfer.effectAllowed = 'move';
                });
            });
        }
    };
})();
