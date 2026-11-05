(function() {
    const taskTwoBlocks = [
        {
            id: 'paraphrase',
            title: '1. Paraphrase the task',
            hint: 'Restate the question in your own words. Avoid copying the prompt.'
        },
        {
            id: 'thesis',
            title: '2. Thesis statement',
            hint: 'State your position or the main direction of your response.'
        },
        {
            id: 'body-one',
            title: '3. Body paragraph 1',
            hint: 'Start with a topic sentence, then explain your first reason or key point.'
        },
        {
            id: 'body-two',
            title: '4. Body paragraph 2',
            hint: 'Develop another point with explanation, evidence, or an example.'
        },
        {
            id: 'conclusion',
            title: '5. Conclusion',
            hint: 'Summarize your main position without introducing a new argument.'
        }
    ];
    const taskOneBlocks = [
        {
            id: 'paraphrase',
            title: '1. Introduction',
            hint: 'Paraphrase what the chart, diagram, or process shows.'
        },
        {
            id: 'overview',
            title: '2. Overview',
            hint: 'Describe the main trend, stages, or biggest differences without listing every figure.'
        },
        {
            id: 'details-one',
            title: '3. Key details 1',
            hint: 'Group and compare the first important figures or features.'
        },
        {
            id: 'details-two',
            title: '4. Key details 2',
            hint: 'Add the remaining important comparisons, figures, or process details.'
        }
    ];
    const discourseMarkers = [
        'to begin with', 'first of all', 'firstly', 'secondly', 'finally',
        'in addition', 'furthermore', 'moreover', 'however', 'on the other hand',
        'in contrast', 'although', 'for example', 'for instance', 'in other words',
        'as a result', 'therefore', 'consequently', 'in conclusion', 'to conclude',
        'overall', 'in summary'
    ];
    const repeatedPhraseStopWords = new Set([
        'a', 'an', 'and', 'are', 'as', 'at', 'be', 'been', 'but', 'by',
        'for', 'from', 'in', 'is', 'it', 'of', 'on', 'or', 'that', 'the',
        'their', 'this', 'to', 'was', 'were', 'with'
    ]);
    function normalizeTask(value) {
        return String(value || '').toLowerCase().replace(/[_-]+/g, ' ');
    }

    window.getScaffoldedWritingBlocks = function(part) {
        const task = normalizeTask(`${part?.writingTask || ''} ${part?.title || ''}`);
        return /\btask\s*1\b|\btask1\b|academic task one/.test(task)
            ? taskOneBlocks
            : taskTwoBlocks;
    };

    window.splitScaffoldedWritingAnswer = function(answer, blockCount) {
        const text = String(answer || '');
        const paragraphs = text.trim() ? text.split(/\n\s*\n/) : [];
        if (paragraphs.length <= blockCount) return paragraphs;
        return [
            ...paragraphs.slice(0, Math.max(0, blockCount - 1)),
            paragraphs.slice(blockCount - 1).join('\n\n')
        ];
    };

    window.combineScaffoldedWritingBlocks = function(values) {
        return (Array.isArray(values) ? values : [])
            .map(value => String(value || '').trim())
            .filter(Boolean)
            .join('\n\n');
    };

    function findGrammarHints(text) {
        const hints = [];
        const rules = [
            {
                expression: /\b(I|you|we|they)\s+(is|has|does)\b|\b(you|we|they)\s+was\b/gi,
                message: 'Check subject–verb agreement: this subject usually does not take this verb form.'
            },
            {
                expression: /\b(he|she|it)\s+(are|were|have|do)\b/gi,
                message: 'Check subject–verb agreement: this subject usually takes a singular verb form.'
            },
            {
                expression: /\b(he|she|it)\s+(achieve|affect|allow|appear|apply|argue|believe|bring|cause|change|choose|come|consider|contain|create|deal|describe|develop|do|earn|encourage|enjoy|explain|feel|find|follow|get|give|go|grow|happen|have|help|improve|include|increase|influence|keep|know|lead|learn|like|live|make|mean|need|offer|provide|receive|reduce|rely|remain|require|say|seem|show|spend|start|suggest|take|think|use|want|work)\b/gi,
                message: 'Check whether this third-person singular verb needs an -s ending.'
            },
            {
                expression: /\ba\s+(?=[aeiou])/gi,
                message: 'Check the article: “an” is usually used before a vowel sound.'
            },
            {
                expression: /\ban\s+(?=[^aeiou\s])/gi,
                message: 'Check the article: “a” is usually used before a consonant sound.'
            }
        ];
        rules.forEach(rule => {
            for (const match of text.matchAll(rule.expression)) {
                hints.push({
                    start: match.index,
                    end: match.index + match[0].length,
                    kind: 'grammar',
                    message: rule.message,
                    text: match[0]
                });
            }
        });
        return hints;
    }

    function findRepeatedHints(text) {
        const hints = [];
        const words = [...text.matchAll(/[\p{L}\p{N}]+(?:['’-][\p{L}\p{N}]+)*/gu)]
            .map(match => ({
                value: match[0].normalize('NFKC').toLocaleLowerCase(),
                start: match.index,
                end: match.index + match[0].length
            }));

        for (let index = 1; index < words.length; index++) {
            if (words[index].value === words[index - 1].value) {
                hints.push({
                    start: words[index - 1].start,
                    end: words[index].end,
                    kind: 'repetition',
                    message: 'Repeated word next to itself; check whether this repetition is intentional.',
                    text: text.slice(words[index - 1].start, words[index].end)
                });
            }
        }

        const phraseOccurrences = new Map();
        for (let length = 2; length <= 3; length++) {
            for (let start = 0; start + length <= words.length; start++) {
                const phraseWords = words.slice(start, start + length);
                if (!phraseWords.some(word => !repeatedPhraseStopWords.has(word.value))) continue;
                const phrase = phraseWords.map(word => word.value).join(' ');
                const occurrence = {
                    start: phraseWords[0].start,
                    end: phraseWords[phraseWords.length - 1].end,
                    kind: 'repetition',
                    message: 'This phrase appears more than once; consider varying your wording.',
                    text: text.slice(phraseWords[0].start, phraseWords[phraseWords.length - 1].end)
                };
                const matches = phraseOccurrences.get(phrase) || [];
                matches.push(occurrence);
                phraseOccurrences.set(phrase, matches);
            }
        }
        phraseOccurrences.forEach(matches => {
            if (matches.length > 1) hints.push(...matches.slice(1));
        });

        const wordOccurrences = new Map();
        words.forEach(word => {
            if (word.value.length < 4 || repeatedPhraseStopWords.has(word.value)) return;
            const matches = wordOccurrences.get(word.value) || [];
            matches.push(word);
            wordOccurrences.set(word.value, matches);
        });
        wordOccurrences.forEach(matches => {
            if (matches.length < 3) return;
            matches.slice(1).forEach(word => hints.push({
                start: word.start,
                end: word.end,
                kind: 'repetition',
                message: `“${text.slice(word.start, word.end)}” appears several times; consider a precise alternative.`,
                text: text.slice(word.start, word.end)
            }));
        });
        return hints;
    }

    function findDiscourseHints(text) {
        const hints = [];
        discourseMarkers.forEach(marker => {
            const escaped = marker.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/\s+/g, '\\s+');
            const expression = new RegExp(`\\b${escaped}\\b`, 'gi');
            for (const match of text.matchAll(expression)) {
                hints.push({
                    start: match.index,
                    end: match.index + match[0].length,
                    kind: 'discourse',
                    message: 'Discourse marker: check that it clearly connects this idea to the previous one.',
                    text: match[0]
                });
            }
        });
        return hints;
    }

    function escapeHtml(value) {
        return String(value || '').replace(/[&<>"']/g, character => ({
            '&': '&amp;',
            '<': '&lt;',
            '>': '&gt;',
            '"': '&quot;',
            "'": '&#39;'
        })[character]);
    }

    window.analyzeWritingText = function(value) {
        const text = String(value || '');
        const priority = { grammar: 3, repetition: 2, discourse: 1 };
        const candidates = [
            ...findGrammarHints(text),
            ...findRepeatedHints(text),
            ...findDiscourseHints(text)
        ].sort((left, right) =>
            priority[right.kind] - priority[left.kind] ||
            (right.end - right.start) - (left.end - left.start) ||
            left.start - right.start
        );
        const accepted = [];
        candidates.forEach(candidate => {
            if (accepted.some(item => candidate.start < item.end && candidate.end > item.start)) return;
            accepted.push(candidate);
        });
        accepted.sort((left, right) => left.start - right.start);
        return { text, highlights: accepted };
    };

    window.renderWritingTextAnalyzer = function(value) {
        const analysis = window.analyzeWritingText(value);
        const { text, highlights } = analysis;
        const counts = { grammar: 0, discourse: 0, repetition: 0 };
        highlights.forEach(item => { counts[item.kind]++; });
        let cursor = 0;
        let highlightedText = '';
        highlights.forEach(item => {
            highlightedText += escapeHtml(text.slice(cursor, item.start));
            highlightedText += `<mark class="writing-analysis__highlight writing-analysis__highlight--${item.kind}" title="${escapeHtml(item.message)}">${escapeHtml(text.slice(item.start, item.end))}</mark>`;
            cursor = item.end;
        });
        highlightedText += escapeHtml(text.slice(cursor));
        if (!text.trim()) highlightedText = '<span class="writing-analysis__placeholder">Start writing to see live highlights. / Bắt đầu viết để xem gợi ý.</span>';
        const findings = highlights.length
            ? highlights.map(item => `<li class="writing-analysis__finding writing-analysis__finding--${item.kind}"><b>${escapeHtml(item.text)}</b><span>${escapeHtml(item.message)}</span></li>`).join('')
            : '<li class="writing-analysis__all-clear">No rule-based hints yet. Keep developing your ideas.</li>';
        return `<section class="writing-analysis" aria-label="Real-time writing analysis">
            <header class="writing-analysis__header">
                <div><h4>Real-time Text Analyzer / Phân tích bài viết</h4><p>Rule-based study hints, not a full grammar or meaning check.</p></div>
                <div class="writing-analysis__counts">
                    <span class="writing-analysis__count writing-analysis__count--grammar">${counts.grammar} grammar</span>
                    <span class="writing-analysis__count writing-analysis__count--discourse">${counts.discourse} connectors</span>
                    <span class="writing-analysis__count writing-analysis__count--repetition">${counts.repetition} repeats</span>
                </div>
            </header>
            <div class="writing-analysis__preview" aria-label="Highlighted text">${highlightedText}</div>
            <ul class="writing-analysis__findings" aria-live="polite">${findings}</ul>
            <div class="writing-analysis__legend">
                <span><i class="writing-analysis__swatch writing-analysis__swatch--grammar"></i>Possible grammar pattern</span>
                <span><i class="writing-analysis__swatch writing-analysis__swatch--discourse"></i>Discourse marker</span>
                <span><i class="writing-analysis__swatch writing-analysis__swatch--repetition"></i>Repeated word or phrase</span>
            </div>
        </section>`;
    };
})();
