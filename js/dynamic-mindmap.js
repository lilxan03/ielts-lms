(function() {
    const savedOutlines = new Map();
    let nextIdeaId = 0;
    const branches = [
        { id: 'main', label: 'Main idea / Ý chính', prompt: 'What is your central point?' },
        { id: 'support', label: 'Support / Giải thích', prompt: 'Why or how does it happen?' },
        { id: 'example', label: 'Example / Ví dụ', prompt: 'What example makes it clear?' },
        { id: 'result', label: 'Result / Kết luận', prompt: 'What is the outcome or takeaway?' }
    ];
    const markerGroups = [
        { id: 'sequence', label: 'Add a point / Thêm ý', phrases: ['To begin with', 'Another point is that', 'In addition', 'Furthermore'] },
        { id: 'explain', label: 'Explain or exemplify / Giải thích, nêu ví dụ', phrases: ['This is because', 'For example', 'For instance', 'In other words'] },
        { id: 'contrast', label: 'Contrast / Tương phản', phrases: ['However', 'On the other hand', 'Whereas', 'Although'] },
        { id: 'result', label: 'Result or conclude / Kết quả, kết luận', phrases: ['As a result', 'Therefore', 'Consequently', 'Overall'] }
    ];

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

    function topicId(label) {
        return `topic-${label.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'general'}`;
    }

    function getOutlineState(key, topicLabels) {
        const state = savedOutlines.get(key) || { activeBranch: 'main', phrases: {}, network: null };
        if (!state.network) {
            state.network = { topics: [], ideas: [], links: [] };
        }
        topicLabels.forEach(label => {
            const id = topicId(label);
            if (!state.network.topics.some(topic => topic.id === id)) {
                state.network.topics.push({ id, label });
            }
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
                <header><h4>${escapeHtml(topic.label)}</h4><span>${ideasByTopic.get(topic.id).length} ideas</span></header>
                <form class="dynamic-mindmap__network-add" data-network-add-idea="${escapeHtml(topic.id)}">
                    <label class="sr-only" for="network-idea-input-${escapeHtml(topic.id)}">Add an idea to ${escapeHtml(topic.label)}</label>
                    <input id="network-idea-input-${escapeHtml(topic.id)}" data-network-idea-input maxlength="160" placeholder="Add an idea…" required>
                    <button type="submit" aria-label="Add idea to ${escapeHtml(topic.label)}">Add</button>
                </form>
                <div class="dynamic-mindmap__network-ideas">
                    ${ideasByTopic.get(topic.id).map(idea => `
                        <article class="dynamic-mindmap__network-idea" data-network-idea="${escapeHtml(idea.id)}" draggable="true">
                            <button type="button" class="dynamic-mindmap__network-idea-select" data-network-select-idea="${escapeHtml(idea.id)}">${escapeHtml(idea.text)}</button>
                            <label class="sr-only" for="network-move-${escapeHtml(idea.id)}">Move idea to another topic</label>
                            <select id="network-move-${escapeHtml(idea.id)}" data-network-move-idea="${escapeHtml(idea.id)}" aria-label="Move idea to another topic">
                                ${network.topics.map(option => `<option value="${escapeHtml(option.id)}"${idea.topicId === option.id ? ' selected' : ''}>${escapeHtml(option.label)}</option>`).join('')}
                            </select>
                            <button type="button" data-network-remove-idea="${escapeHtml(idea.id)}" aria-label="Remove idea: ${escapeHtml(idea.text)}">×</button>
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
                <button type="button" data-network-remove-link="${escapeHtml(link.id)}" aria-label="Remove connection">Remove</button></li>`;
        }).join('');
        return `<section class="dynamic-mindmap__network" data-idea-network aria-labelledby="idea-network-title">
            <header class="dynamic-mindmap__network-header">
                <div><h3 id="idea-network-title">Cross-topic Idea Network / Mạng lưới ý tưởng</h3>
                    <p>Add ideas, move them between topics by dragging or using the menu, and connect related ideas. Notes stay in this practice session and are not submitted.</p></div>
                <button type="button" data-network-link-mode aria-pressed="false">Connect ideas / Nối ý</button>
            </header>
            <form class="dynamic-mindmap__network-add-topic" data-network-add-topic>
                <label for="network-new-topic">Add a topic / Thêm chủ đề</label>
                <input id="network-new-topic" data-network-topic-input maxlength="80" placeholder="e.g. Education" required>
                <button type="submit">Add topic</button>
            </form>
            <div class="dynamic-mindmap__network-topics">${topicsHtml}</div>
            <p class="dynamic-mindmap__network-status" data-network-status aria-live="polite">Drag an idea to another topic, or select Connect ideas and choose two ideas.</p>
            <section class="dynamic-mindmap__network-links" aria-label="Connected ideas">
                <h4>Connections / Các mối liên hệ</h4>
                <ul data-network-links>${linksHtml || '<li class="dynamic-mindmap__network-empty">No connections yet. Select Connect ideas to link related ideas.</li>'}</ul>
            </section>
        </section>`;
    }

    function renderPhraseButton(id, label, detail, kind, isSelected) {
        const safeLabel = escapeHtml(label);
        const safeDetail = plainText(detail);
        const title = safeDetail ? ` title="${escapeHtml(safeDetail)}"` : '';
        return `<button type="button" class="dynamic-mindmap__phrase" data-mindmap-phrase="${escapeHtml(id)}" data-mindmap-kind="${kind}" aria-pressed="${isSelected}"${title}>
            <span>${safeLabel}</span><span class="dynamic-mindmap__phrase-state" aria-hidden="true">${isSelected ? '✓' : '＋'}</span>
        </button>`;
    }

    window.renderDynamicMindMap = function(part, vocabulary, outlineKey, topics) {
        const source = Array.isArray(vocabulary) ? vocabulary : [];
        const key = String(outlineKey || plainText(part?.title) || 'current-task');
        const topic = plainText(part?.speakingQuestions) || plainText(part?.title) || 'Your response / Câu trả lời của bạn';
        const topicLabels = Array.isArray(topics)
            ? [...new Set(topics.map(plainText).filter(Boolean))]
            : [];
        if (!topicLabels.length) topicLabels.push(topic);
        const state = getOutlineState(key, topicLabels);
        const vocabTerms = source
            .map((item, index) => ({ item, index, term: plainText(item?.term) }))
            .filter(entry => entry.term);
        const phraseLabels = new Map();
        vocabTerms.forEach(({ item, index, term }) => {
            phraseLabels.set(`vocab-${index}`, term);
        });
        markerGroups.forEach(group => group.phrases.forEach((phrase, index) => {
            phraseLabels.set(`marker-${group.id}-${index}`, phrase);
        }));
        const vocabularyHtml = vocabTerms.length
            ? vocabTerms.map(({ item, index, term }) =>
                renderPhraseButton(`vocab-${index}`, term, item.eng || item.vi || item.example, 'collocation', Boolean(state.phrases[`vocab-${index}`]))
            ).join('')
            : '<p class="dynamic-mindmap__empty">No task vocabulary has been added yet. Choose a discourse marker below to start your outline.</p>';
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
            return `<section class="dynamic-mindmap__branch${active ? ' is-active' : ''}" data-mindmap-branch="${branch.id}">
                <button type="button" class="dynamic-mindmap__branch-select" data-mindmap-select-branch="${branch.id}" aria-pressed="${active}">
                    <span class="dynamic-mindmap__branch-number">${index + 1}</span>
                    <span><strong>${escapeHtml(branch.label)}</strong><small>${escapeHtml(branch.prompt)}</small></span>
                </button>
                <div class="dynamic-mindmap__branch-items" data-mindmap-items="${branch.id}">${itemsHtml}</div>
            </section>`;
        }).join('');

        return `<section class="dynamic-mindmap" data-mindmap-root data-mindmap-key="${escapeHtml(key)}" aria-labelledby="dynamic-mindmap-title">
            <header class="dynamic-mindmap__header">
                <span class="dynamic-mindmap__eyebrow">Build your response / Tự xây dựng câu trả lời</span>
                <h2 id="dynamic-mindmap-title">Dynamic Mind Map / Sơ đồ tư duy</h2>
                <p>Choose an outline branch, then add useful phrases. Make your own ideas; this is a scaffold, not a model answer.</p>
            </header>
            <div class="dynamic-mindmap__topic"><span>YOUR TASK / ĐỀ BÀI</span><strong>${escapeHtml(topic)}</strong></div>
            <div class="dynamic-mindmap__layout">
                <div class="dynamic-mindmap__branches" role="group" aria-label="Choose an outline branch">
                    ${branchesHtml}
                </div>
                <aside class="dynamic-mindmap__bank" aria-label="Phrase bank">
                    <section>
                        <h4>Task collocations / Cụm từ theo đề</h4>
                        <p>From the teacher's Test Vocabulary Bank</p>
                        <div class="dynamic-mindmap__phrases">${vocabularyHtml}</div>
                    </section>
                    <section>
                        <h4>Discourse markers / Từ nối</h4>
                        ${markersHtml}
                    </section>
                </aside>
            </div>
            <p class="dynamic-mindmap__status" data-mindmap-status aria-live="polite">${escapeHtml(branches.find(branch => branch.id === state.activeBranch)?.label || branches[0].label)} selected. Choose phrases to add them to your outline.</p>
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
        const branchLabels = new Map(branches.map(branch => [branch.id, branch.label]));

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
                if (status) status.textContent = `${branchLabels.get(branchId)} selected. Choose phrases to add them to your outline.`;
            });
        });

        map.querySelectorAll('[data-mindmap-phrase]').forEach(button => {
            button.addEventListener('click', () => {
                const phraseId = button.dataset.mindmapPhrase;
                const previousBranch = state.phrases[phraseId];
                if (previousBranch) {
                    map.querySelector(`[data-mindmap-remove="${phraseId}"]`)?.remove();
                    delete state.phrases[phraseId];
                    button.setAttribute('aria-pressed', 'false');
                    button.querySelector('.dynamic-mindmap__phrase-state').textContent = '＋';
                    if (status) status.textContent = 'Phrase removed from your outline.';
                    return;
                }

                const branchId = map.dataset.activeBranch || 'main';
                const phrase = button.querySelector('span')?.textContent || '';
                const item = document.createElement('button');
                item.type = 'button';
                item.className = 'dynamic-mindmap__outline-item';
                item.dataset.mindmapRemove = phraseId;
                item.setAttribute('aria-label', `Remove ${phrase} from ${branchLabels.get(branchId)}`);
                item.innerHTML = `<span>${escapeHtml(phrase)}</span><span aria-hidden="true">×</span>`;
                item.addEventListener('click', () => {
                    delete state.phrases[phraseId];
                    button.setAttribute('aria-pressed', 'false');
                    button.querySelector('.dynamic-mindmap__phrase-state').textContent = '＋';
                    item.remove();
                    if (status) status.textContent = 'Phrase removed from your outline.';
                });
                map.querySelector(`[data-mindmap-items="${branchId}"]`)?.appendChild(item);
                state.phrases[phraseId] = branchId;
                button.setAttribute('aria-pressed', 'true');
                button.querySelector('.dynamic-mindmap__phrase-state').textContent = '✓';
                if (status) status.textContent = `${phrase} added to ${branchLabels.get(branchId)}.`;
            });
        });

        map.querySelectorAll('[data-mindmap-remove]').forEach(item => {
            item.addEventListener('click', () => {
                const phraseId = item.dataset.mindmapRemove;
                delete state.phrases[phraseId];
                const phraseButton = map.querySelector(`[data-mindmap-phrase="${phraseId}"]`);
                phraseButton?.setAttribute('aria-pressed', 'false');
                const phraseState = phraseButton?.querySelector('.dynamic-mindmap__phrase-state');
                if (phraseState) phraseState.textContent = '＋';
                item.remove();
                if (status) status.textContent = 'Phrase removed from your outline.';
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
                    say('That topic is already on your network.');
                    return;
                }
                outlineState.network.topics.push({ id, label });
                refreshNetwork(`${label} added to your idea network.`);
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
                    refreshNetwork('Idea added to your network.');
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
                say(active ? 'Choose the first idea, then choose a related idea to connect them.' : 'Idea connection mode is off.');
            });
            network.querySelectorAll('[data-network-select-idea]').forEach(button => {
                button.addEventListener('click', () => {
                    if (linkMode?.getAttribute('aria-pressed') !== 'true') return;
                    const ideaId = button.dataset.networkSelectIdea;
                    if (!outlineState.network.selectedIdea) {
                        outlineState.network.selectedIdea = ideaId;
                        button.classList.add('is-selected');
                        say('First idea selected. Choose another idea to create a connection.');
                        return;
                    }
                    const firstId = outlineState.network.selectedIdea;
                    if (firstId === ideaId) {
                        outlineState.network.selectedIdea = null;
                        button.classList.remove('is-selected');
                        say('Selection cleared. Choose two different ideas.');
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
                    refreshNetwork(exists ? 'Those ideas are already connected.' : 'Related ideas connected.');
                });
            });
            network.querySelectorAll('[data-network-move-idea]').forEach(select => {
                select.addEventListener('change', () => {
                    const idea = outlineState.network.ideas.find(item => item.id === select.dataset.networkMoveIdea);
                    const destination = outlineState.network.topics.find(topic => topic.id === select.value);
                    if (!idea || !destination) return;
                    idea.topicId = destination.id;
                    refreshNetwork(`Idea moved to ${destination.label}.`);
                });
            });
            network.querySelectorAll('[data-network-remove-idea]').forEach(button => {
                button.addEventListener('click', () => {
                    const ideaId = button.dataset.networkRemoveIdea;
                    outlineState.network.ideas = outlineState.network.ideas.filter(idea => idea.id !== ideaId);
                    outlineState.network.links = outlineState.network.links.filter(link =>
                        link.from !== ideaId && link.to !== ideaId
                    );
                    refreshNetwork('Idea and its connections removed.');
                });
            });
            network.querySelectorAll('[data-network-remove-link]').forEach(button => {
                button.addEventListener('click', () => {
                    outlineState.network.links = outlineState.network.links.filter(link => link.id !== button.dataset.networkRemoveLink);
                    refreshNetwork('Connection removed.');
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
                    refreshNetwork('Idea moved to another topic.');
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
