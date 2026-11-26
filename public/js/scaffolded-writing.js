(function() {
    const t = (en, vi) => (typeof window !== 'undefined' && typeof window.studentText === 'function' ? window.studentText(en, vi) : en);

    function getTaskTwoBlocks() {
        return [
            {
                id: 'paraphrase',
                title: t('1. Paraphrase the task', '1. Diễn đạt lại đề bài (Paraphrase)'),
                hint: t('Restate the question in your own words. Avoid copying the prompt.', 'Viết lại câu hỏi bằng từ ngữ của bạn. Tránh chép nguyên văn đề bài.')
            },
            {
                id: 'thesis',
                title: t('2. Thesis statement', '2. Câu luận điểm (Thesis Statement)'),
                hint: t('State your position or the main direction of your response.', 'Nêu rõ quan điểm hoặc định hướng chính cho bài viết.')
            },
            {
                id: 'body-one',
                title: t('3. Body paragraph 1', '3. Thân bài 1 (Body 1)'),
                hint: t('Start with a topic sentence, then explain your first reason or key point.', 'Bắt đầu bằng câu chủ đề, sau đó giải thích lý do hoặc luận điểm thứ nhất.')
            },
            {
                id: 'body-two',
                title: t('4. Body paragraph 2', '4. Thân bài 2 (Body 2)'),
                hint: t('Develop another point with explanation, evidence, or an example.', 'Phát triển luận điểm thứ hai kèm giải thích, dẫn chứng hoặc ví dụ.')
            },
            {
                id: 'conclusion',
                title: t('5. Conclusion', '5. Kết bài (Conclusion)'),
                hint: t('Summarize your main position without introducing a new argument.', 'Tóm tắt lại quan điểm chính, không đưa thêm luận điểm mới.')
            }
        ];
    }
    function getTaskOneBlocks() {
        return [
            {
                id: 'paraphrase',
                title: t('1. Introduction', '1. Mở bài (Introduction)'),
                hint: t('Paraphrase what the chart, diagram, or process shows.', 'Diễn đạt lại nội dung chính mà biểu đồ, sơ đồ hoặc quy trình thể hiện.')
            },
            {
                id: 'overview',
                title: t('2. Overview', '2. Tổng quan (Overview)'),
                hint: t('Describe the main trend, stages, or biggest differences without listing every figure.', 'Mô tả xu hướng chính, các giai đoạn hoặc điểm khác biệt lớn nhất mà không liệt kê từng số liệu.')
            },
            {
                id: 'details-one',
                title: t('3. Key details 1', '3. Chi tiết chính 1 (Body 1)'),
                hint: t('Group and compare the first important figures or features.', 'Nhóm và so sánh các số liệu hoặc đặc điểm quan trọng đầu tiên.')
            },
            {
                id: 'details-two',
                title: t('4. Key details 2', '4. Chi tiết chính 2 (Body 2)'),
                hint: t('Add the remaining important comparisons, figures, or process details.', 'Bổ sung các phép so sánh, số liệu hoặc bước quy trình quan trọng còn lại.')
            }
        ];
    }
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
            ? getTaskOneBlocks()
            : getTaskTwoBlocks();
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
                message: t('Check subject–verb agreement: this subject usually does not take this verb form.', 'Kiểm tra hòa hợp chủ–vị: chủ ngữ này thường không đi với dạng động từ này.')
            },
            {
                expression: /\b(he|she|it)\s+(are|were|have|do)\b/gi,
                message: t('Check subject–verb agreement: this subject usually takes a singular verb form.', 'Kiểm tra hòa hợp chủ–vị: chủ ngữ này thường đi với động từ số ít.')
            },
            {
                expression: /\b(he|she|it)\s+(achieve|affect|allow|appear|apply|argue|believe|bring|cause|change|choose|come|consider|contain|create|deal|describe|develop|do|earn|encourage|enjoy|explain|feel|find|follow|get|give|go|grow|happen|have|help|improve|include|increase|influence|keep|know|lead|learn|like|live|make|mean|need|offer|provide|receive|reduce|rely|remain|require|say|seem|show|spend|start|suggest|take|think|use|want|work)\b/gi,
                message: t('Check whether this third-person singular verb needs an -s ending.', 'Kiểm tra xem động từ ngôi thứ 3 số ít này có cần thêm đuôi -s/-es không.')
            },
            {
                expression: /\ba\s+(?=[aeiou])/gi,
                message: t('Check the article: “an” is usually used before a vowel sound.', 'Kiểm tra mạo từ: thường dùng “an” trước âm nguyên âm.')
            },
            {
                expression: /\ban\s+(?=[^aeiou\s])/gi,
                message: t('Check the article: “a” is usually used before a consonant sound.', 'Kiểm tra mạo từ: thường dùng “a” trước âm phụ âm.')
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
                    message: t('Repeated word next to itself; check whether this repetition is intentional.', 'Từ bị lặp liên tiếp; hãy kiểm tra xem có phải gõ nhầm không.'),
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
                    message: t('This phrase appears more than once; consider varying your wording.', 'Cụm từ này xuất hiện hơn một lần; hãy cân nhắc diễn đạt đa dạng hơn.'),
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
                message: t(`“${text.slice(word.start, word.end)}” appears several times; consider a precise alternative.`, `“${text.slice(word.start, word.end)}” xuất hiện nhiều lần; hãy cân nhắc từ đồng nghĩa chính xác hơn.`),
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
                    message: t('Discourse marker: check that it clearly connects this idea to the previous one.', 'Từ nối: kiểm tra xem nó có liên kết rõ ràng ý này với ý trước đó không.'),
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
        if (!text.trim()) highlightedText = `<span class="writing-analysis__placeholder">${t('Start writing to see live highlights.', 'Bắt đầu viết để xem gợi ý trực tiếp.')}</span>`;
        const findings = highlights.length
            ? highlights.map(item => `<li class="writing-analysis__finding writing-analysis__finding--${item.kind}"><b>${escapeHtml(item.text)}</b><span>${escapeHtml(item.message)}</span></li>`).join('')
            : `<li class="writing-analysis__all-clear">${t('No rule-based hints yet. Keep developing your ideas.', 'Chưa phát hiện lỗi hoặc gợi ý. Hãy tiếp tục phát triển ý.')}</li>`;
        return `<section class="writing-analysis" aria-label="${t('Real-time writing analysis', 'Phân tích bài viết theo thời gian thực')}">
            <header class="writing-analysis__header">
                <div><h4>${t('Real-time Text Analyzer', 'Phân tích bài viết')}</h4><p>${t('Rule-based study hints, not a full grammar or meaning check.', 'Gợi ý học tập theo quy tắc, không thay thế kiểm tra ngữ pháp và ngữ nghĩa toàn diện.')}</p></div>
                <div class="writing-analysis__counts">
                    <span class="writing-analysis__count writing-analysis__count--grammar">${counts.grammar} ${t('grammar', 'ngữ pháp')}</span>
                    <span class="writing-analysis__count writing-analysis__count--discourse">${counts.discourse} ${t('connectors', 'từ nối')}</span>
                    <span class="writing-analysis__count writing-analysis__count--repetition">${counts.repetition} ${t('repeats', 'lặp từ')}</span>
                </div>
            </header>
            <div class="writing-analysis__preview" aria-label="${t('Highlighted text', 'Văn bản đã đánh dấu')}">${highlightedText}</div>
            <ul class="writing-analysis__findings" aria-live="polite">${findings}</ul>
            <div class="writing-analysis__legend">
                <span><i class="writing-analysis__swatch writing-analysis__swatch--grammar"></i>${t('Possible grammar pattern', 'Lỗi ngữ pháp tiềm ẩn')}</span>
                <span><i class="writing-analysis__swatch writing-analysis__swatch--discourse"></i>${t('Discourse marker', 'Từ nối')}</span>
                <span><i class="writing-analysis__swatch writing-analysis__swatch--repetition"></i>${t('Repeated word or phrase', 'Từ hoặc cụm từ bị lặp')}</span>
            </div>
        </section>`;
    };
})();
