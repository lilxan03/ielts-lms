(function(root) {
    const t = (en, vi) => (typeof window !== 'undefined' && typeof window.studentText === 'function' ? window.studentText(en, vi) : en);

    function escapeHtml(value) {
        return String(value ?? '').replace(/[&<>"']/g, ch => ({
            '&': '&amp;',
            '<': '&lt;',
            '>': '&gt;',
            '"': '&quot;',
            "'": '&#39;'
        })[ch]);
    }

    function stripHtml(value) {
        return String(value ?? '')
            .replace(/<[^>]+>/g, ' ')
            .replace(/&nbsp;|&#160;/gi, ' ')
            .replace(/&amp;/gi, '&')
            .replace(/&lt;/gi, '<')
            .replace(/&gt;/gi, '>')
            .replace(/&quot;/gi, '"')
            .replace(/&#0?39;|&apos;/gi, "'")
            .replace(/\s+/g, ' ')
            .trim();
    }

    function extractWordLimit(instruction) {
        const plain = stripHtml(instruction);
        const match = plain.match(/\b(?:ONE|TWO|THREE|FOUR|\d+)\s+WORDS?(?:\s+AND\/OR\s+(?:A\s+)?NUMBERS?)?(?:\s+ONLY)?|\bNO\s+MORE\s+THAN\s+(?:ONE|TWO|THREE|FOUR|\d+)\s+WORDS?(?:\s+AND\/OR\s+(?:A\s+)?NUMBERS?)?/i);
        return match ? match[0].toUpperCase() : '';
    }

    function extractGapContexts(q) {
        const plain = stripHtml(String(q?.text || '').replace(/\{(blank|drop):(\d+)\}/gi, ' __GAP_$2__ '));
        const ids = Array.isArray(q?.ids) ? q.ids : [];
        return ids.map(id => {
            const token = `__GAP_${id}__`;
            const idx = plain.indexOf(token);
            if (idx === -1) return { id, before: '', after: '', hint: t('Identify the part of speech (Noun / Verb / Adj / Number) from the surrounding words.', 'Xác định từ loại (Danh / Động / Tính từ / Số) dựa vào từ đứng trước và sau ô trống.') };
            const beforeWords = plain.slice(0, idx).trim().split(/\s+/).slice(-4).join(' ');
            const afterWords = plain.slice(idx + token.length).trim().split(/\s+/).slice(0, 4).join(' ');
            const lastBefore = beforeWords.split(/\s+/).pop()?.toLowerCase() || '';
            let posHint = t('Analyze grammar before & after the gap to predict the part of speech (N / V / Adj / Number).', 'Phân tích ngữ pháp trước & sau ô để đoán từ loại (N / V / Adj / Số).');
            if (/^(a|an|the|my|his|her|their|our|its|some|many|several|no|this|that|these|those)$/.test(lastBefore)) {
                posHint = t(
                    `After "${lastBefore}" → Noun or Noun Phrase. Watch ${/^(a|an)$/.test(lastBefore) ? 'singular' : 'singular/plural'}.`,
                    `Sau "${lastBefore}" → Danh từ (Noun) hoặc Cụm danh từ. Chú ý ${/^(a|an)$/.test(lastBefore) ? 'số ít' : 'số ít/nhiều'}.`
                );
            } else if (/^(is|are|was|were|be|become|seem|appear|feel)$/.test(lastBefore)) {
                posHint = t(`After "${lastBefore}" → usually needs an Adjective (Adj) or Noun.`, `Sau "${lastBefore}" → thường cần Tính từ (Adj) hoặc Danh từ.`);
            } else if (/^(to|can|will|must|should|may|might|could|would)$/.test(lastBefore)) {
                posHint = t(`After "${lastBefore}" → Base Verb (V-inf) or Noun (if "to" is a preposition).`, `Sau "${lastBefore}" → Động từ nguyên mẫu (V-inf) hoặc Danh từ (nếu "to" là giới từ).`);
            } else if (/^(in|on|at|by|for|from|with|about|of|into|during|between)$/.test(lastBefore)) {
                posHint = t(`After preposition "${lastBefore}" → Noun / V-ing / Figure / Place.`, `Sau giới từ "${lastBefore}" → Danh từ / V-ing / Số liệu / Địa điểm.`);
            }
            return { id, before: beforeWords, after: afterWords, hint: posHint };
        });
    }

    const STOP_WORDS = new Set([
        'the', 'and', 'for', 'with', 'from', 'that', 'this', 'these', 'those', 'which', 'what', 'when', 'where', 'who', 'whom', 'whose', 'why', 'how',
        'are', 'was', 'were', 'been', 'being', 'have', 'has', 'had', 'does', 'did', 'doing', 'will', 'would', 'could', 'should', 'can', 'may', 'might', 'must',
        'not', 'but', 'yet', 'nor', 'also', 'very', 'more', 'most', 'some', 'any', 'many', 'much', 'few', 'other', 'another', 'such', 'only', 'just',
        'about', 'into', 'over', 'under', 'above', 'below', 'between', 'among', 'through', 'during', 'before', 'after', 'around', 'while', 'because',
        'they', 'them', 'their', 'theirs', 'there', 'here', 'then', 'than', 'its', 'his', 'her', 'hers', 'our', 'ours', 'your', 'yours', 'you',
        'examples', 'example', 'reasons', 'reason', 'details', 'detail', 'description', 'mention', 'reference', 'comparison', 'following', 'statements',
        'statement', 'paragraph', 'paragraphs', 'information', 'passage', 'section', 'according', 'writer', 'author', 'agree', 'correct', 'letter', 'boxes'
    ]);

    function stripLeadingQuestionNumbers(text) {
        return String(text || '')
            .replace(/<[^>]+>/g, '\n')
            .split(/\r?\n/)
            .map(line => line.replace(/^\s*\d{1,2}\s*[\.\):]?\s+/, '').trim())
            .filter(Boolean)
            .join('\n');
    }

    function extractKeywordsHint(text) {
        const cleanedLines = stripLeadingQuestionNumbers(text)
            .replace(/\{(blank|drop):\d+\}/gi, ' ')
            .replace(/__GAP_\d+__/g, ' ');
        const plain = stripHtml(cleanedLines);

        // Hard keywords: real years (1000-2099), percentages/quantities with units, or proper nouns NOT at sentence/line start
        const yearsAndQuantities = plain.match(/\b(?:1\d{3}|20\d{2})s?\b|\b\d+(?:\.\d+)?\s*(?:%|percent|million|billion|thousand|km|metres|meters|years|months|weeks|days|hours)\b/gi) || [];
        const midSentenceNames = [];
        cleanedLines.split(/\r?\n/).forEach(line => {
            const tokens = line.trim().split(/\s+/);
            tokens.forEach((tok, idx) => {
                const cleanTok = tok.replace(/^[^A-Za-z0-9]+|[^A-Za-z0-9]+$/g, '');
                if (!cleanTok) return;
                if (idx > 0 && /^[A-Z][a-z]{2,}$/.test(cleanTok) && !STOP_WORDS.has(cleanTok.toLowerCase())) {
                    midSentenceNames.push(cleanTok);
                } else if (/^[A-Z]{2,5}$/.test(cleanTok) && !/^(THE|AND|FOR|NOT|YES|NO|TRUE|FALSE|GIVEN|ONE|TWO|ONLY|WORD|WORDS|MAX|WPM|NB)$/.test(cleanTok)) {
                    midSentenceNames.push(cleanTok);
                }
            });
        });
        const hard = Array.from(new Set([...yearsAndQuantities, ...midSentenceNames])).slice(0, 6);

        // Content / soft keywords: meaningful words from the question text
        const words = plain
            .replace(/[^A-Za-z0-9'\-\s]/g, ' ')
            .split(/\s+/)
            .map(w => w.replace(/^['\-]+|['\-]+$/g, ''))
            .filter(w => w.length >= 4 && !/^\d+$/.test(w) && !STOP_WORDS.has(w.toLowerCase()) && !hard.includes(w));
        const soft = Array.from(new Set(words.map(w => w.toLowerCase()))).slice(0, 8);

        const traps = Array.from(new Set(
            plain.toLowerCase().match(/\b(only|always|never|all|every|most|mainly|primarily|first|last|more than|less than|fewer|at least|impossible|completely|entirely|definitely|unique)\b/g) || []
        )).slice(0, 6);
        return { hard, soft, traps };
    }

    function renderHardKeywords(hard, soft = []) {
        const parts = [];
        if (hard && hard.length) {
            parts.push(`<div class="mt-2 flex flex-wrap items-center gap-1.5"><span class="text-[11px] font-bold text-slate-600">${t('Hard Keywords (Quick Scan):', 'Hard Keywords (Scan nhanh):')}</span>${hard.map(k => `<span class="px-2 py-0.5 rounded bg-yellow-100 text-yellow-900 border border-yellow-300 text-xs font-bold">${escapeHtml(k)}</span>`).join('')}</div>`);
        }
        if (soft && soft.length) {
            parts.push(`<div class="mt-1.5 flex flex-wrap items-center gap-1.5"><span class="text-[11px] font-bold text-slate-600">${t('Content Keywords (spot Paraphrases):', 'Keywords nội dung (săn Paraphrase):')}</span>${soft.map(k => `<span class="px-2 py-0.5 rounded bg-sky-100 text-sky-900 border border-sky-300 text-xs font-bold">${escapeHtml(k)}</span>`).join('')}</div>`);
        }
        return parts.join('');
    }

    function getWritingSteps(q, part) {
        const taskFlag = String(part?.writingTask || '').toLowerCase();
        const partTitle = stripHtml(part?.title || '');
        const isTask1 = taskFlag === 'task1' || /\btask\s*1\b/i.test(partTitle);
        const hasSample = Boolean(stripHtml(part?.text || ''));
        const { hard, soft } = extractKeywordsHint(`${partTitle} ${q?.instruction || ''} ${q?.text || ''}`);
        const kwExtra = renderHardKeywords(hard, soft);

        if (isTask1) {
            return [
                {
                    title: t('Step 1: Analyze the Chart/Process & Plan Mind Map (Main vs Minor)', 'Bước 1: Đọc biểu đồ/quy trình & Lập Mind Map (Main vs Minor)'),
                    action: t(
                        'Read the prompt & visual on the left. Use the <strong>Dynamic Mind Map</strong> on the left to separate 2 groups: <strong>Main Details (Overview)</strong> — overall trends, highest/lowest points (no figures) and <strong>Minor Details (Body)</strong> — specific figures and comparisons.',
                        'Đọc kỹ đề bài & biểu đồ ở cột trái. Dùng <strong>Dynamic Mind Map</strong> ở cột trái để tách 2 nhóm: <strong>Main Details (Overview)</strong> — xu hướng chung, điểm cao/thấp nhất (không đưa số liệu) và <strong>Minor Details (Body)</strong> — số liệu, so sánh chi tiết.'
                    ),
                    extra: kwExtra
                },
                {
                    title: t('Step 2: Write Introduction & Overview in Scaffolded Writing', 'Bước 2: Viết Introduction & Overview trong Viết theo khối'),
                    action: t(
                        'Complete the first 2 blocks of <strong>Scaffolded Writing</strong> below: (1) <strong>Introduction</strong> — paraphrase the prompt; (2) <strong>Overview</strong> — summarize 2–3 key trends (<em>Overall, It is clear that...</em>).',
                        'Điền 2 khối đầu của <strong>Viết theo khối</strong> bên dưới: (1) <strong>Introduction</strong> — paraphrase lại đề bài; (2) <strong>Overview</strong> — tóm tắt 2–3 xu hướng nổi bật nhất (<em>Overall, It is clear that...</em>).'
                    ),
                    extra: ''
                },
                {
                    title: t('Step 3: Develop Body 1 & Body 2 with Accurate Figures', 'Bước 3: Triển khai Body 1 & Body 2 với số liệu chính xác'),
                    action: t(
                        'Group features logically into <strong>Body 1 &amp; Body 2</strong>. Add figures from <em>Minor Details</em> with linking words &amp; trend/comparison structures (<em>peaked at, declined steadily, whereas, compared to</em>).',
                        'Nhóm đối tượng hợp lý vào <strong>Body 1 &amp; Body 2</strong>. Đưa số liệu từ nhánh <em>Minor Details</em> kèm từ nối &amp; cấu trúc so sánh/xu hướng (<em>peaked at, declined steadily, whereas, compared to</em>).'
                    ),
                    extra: ''
                },
                {
                    title: t('Step 4: Check Writing Analyzer & Compare Sample Answer', 'Bước 4: Kiểm tra Writing Analyzer & Đối chiếu Sample Answer'),
                    action: t(
                        `Check the <strong>Words counter (minimum 150 words)</strong> and the <strong>Writing Text Analyzer</strong> below (repetition, connectors, grammar).${hasSample ? ' Once finished, click <strong>👁️ Show Sample Answer</strong> on the left to compare against <em>TA, CC, LR, GRA</em>.' : ''}`,
                        `Kiểm tra bộ đếm <strong>Words (tối thiểu 150 từ)</strong> và bảng <strong>Phân tích bài viết</strong> bên dưới (lỗi lặp từ, từ nối, cấu trúc câu).${hasSample ? ' Sau khi viết xong, bấm <strong>👁️ Xem bài mẫu</strong> ở cột trái để đối chiếu theo 4 tiêu chí <em>TA, CC, LR, GRA</em>.' : ''}`
                    ),
                    extra: ''
                }
            ];
        }

        return [
            {
                title: t('Step 1: Identify Essay Type & Plan Mind Map (Position → Point → Explanation)', 'Bước 1: Xác định dạng bài & Lập Mind Map (Position → Point → Explanation)'),
                action: t(
                    'Identify the task type (<em>Opinion, Discussion, Advantages/Disadvantages, Problem/Solution</em>). Use the <strong>Dynamic Mind Map</strong> on the left to plan: <strong>Position (Thesis Statement)</strong> → <strong>Main Point</strong> → <strong>Explanation</strong>, and pick suggested vocabulary &amp; Discourse Markers.',
                    'Xác định rõ dạng đề (<em>Opinion, Discussion, Advantages/Disadvantages, Problem/Solution</em>). Dùng <strong>Sơ đồ tư duy</strong> ở cột trái để chốt: <strong>Position (Thesis Statement)</strong> → <strong>Main Point</strong> → <strong>Explanation</strong>, đồng thời chọn từ vựng &amp; Từ nối gợi ý.'
                ),
                extra: kwExtra
            },
            {
                title: t('Step 2: Write Introduction & Thesis Statement', 'Bước 2: Viết Introduction & Chốt Thesis Statement'),
                action: t(
                    'In the <strong>Introduction</strong> block of <strong>Scaffolded Writing</strong> below: paraphrase the prompt context (1–2 sentences) and write a <strong>Thesis Statement</strong> directly answering the prompt.',
                    'Ở khối <strong>Mở bài / Paraphrase</strong> trong <strong>Viết theo khối</strong> bên dưới: paraphrase bối cảnh đề bài (1–2 câu) và viết <strong>Thesis Statement</strong> trả lời trực tiếp yêu cầu đề bài.'
                ),
                extra: ''
            },
            {
                title: t('Step 3: Develop Body 1 & Body 2 using P-E-E', 'Bước 3: Phát triển Body 1 & Body 2 theo mạch P-E-E'),
                action: t(
                    'Develop each body paragraph clearly: <strong>Point</strong> (clear topic sentence) → <strong>Explanation</strong> (reasons/mechanisms with <em>This is because, Consequently</em>) → <strong>Example</strong> (concrete illustration).',
                    'Mỗi đoạn thân bài triển khai đủ: <strong>Point</strong> (câu chủ đề rõ ràng) → <strong>Explanation</strong> (giải thích nguyên nhân/cơ chế bằng <em>This is because, Consequently</em>) → <strong>Example</strong> (ví dụ cụ thể).'
                ),
                extra: ''
            },
            {
                title: t('Step 4: Write Conclusion, Check Analyzer & Compare Sample Answer', 'Bước 4: Viết Conclusion, Kiểm tra Analyzer & Đối chiếu Sample Answer'),
                action: t(
                    `Write a <strong>Conclusion</strong> restating your stance (no new arguments). Ensure <strong>Words ≥ 250</strong> and review the <strong>Writing Text Analyzer</strong> below.${hasSample ? ' Then open <strong>👁️ Show Sample Answer</strong> on the left to compare against <em>TR, CC, LR, GRA</em>.' : ''}`,
                    `Viết <strong>Conclusion</strong> khẳng định lại quan điểm (không thêm ý mới). Đảm bảo bộ đếm <strong>Words ≥ 250 từ</strong>, rà soát bảng <strong>Phân tích bài viết</strong> bên dưới.${hasSample ? ' Sau đó mở <strong>👁️ Xem bài mẫu</strong> ở cột trái để đối chiếu theo 4 tiêu chí <em>TR, CC, LR, GRA</em>.' : ''}`
                ),
                extra: ''
            }
        ];
    }

    function getSpeakingSteps(q, part) {
        const partTitle = stripHtml(part?.title || '');
        const speakingQ = stripHtml(part?.speakingQuestions || '');
        const hasSample = Boolean(stripHtml(part?.text || ''));
        const { hard, soft } = extractKeywordsHint(`${partTitle} ${speakingQ} ${q?.instruction || ''} ${q?.text || ''}`);
        const kwExtra = renderHardKeywords(hard, soft);
        const isPart2 = /\bpart\s*2\b/i.test(partTitle) || /\bdescribe\b/i.test(partTitle + ' ' + speakingQ);
        const isPart3 = /\bpart\s*3\b/i.test(partTitle);

        const sampleHint = hasSample
            ? t(
                ' Then click <strong>🔊 Listen to Sample Answer</strong> and <strong>👁️ Show Sample Answer</strong> on the left to compare vocabulary &amp; intonation across <em>FC, LR, GRA, PR</em>.',
                ' Sau đó bấm <strong>🔊 Nghe bài mẫu</strong> và <strong>👁️ Xem bài mẫu</strong> ở cột trái để so sánh cách dùng từ &amp; ngữ điệu theo 4 tiêu chí <em>FC, LR, GRA, PR</em>.'
            )
            : '';

        if (isPart2) {
            return [
                {
                    title: t('Step 1: Plan 4-Branch Mind Map (1-min Prep)', 'Bước 1: Lập dàn ý 4 nhánh trên Mind Map (1 phút chuẩn bị)'),
                    action: t(
                        'Use the <strong>Dynamic Mind Map</strong> on the left to jot down keywords for 4 stages: <strong>Topic Sentence</strong> (opening) → <strong>Background Info</strong> (context) → <strong>Main Point</strong> (Cue Card details) → <strong>Feelings &amp; Future Plans</strong>.',
                        'Dùng <strong>Sơ đồ tư duy</strong> ở cột trái để ghi nhanh từ khóa cho 4 chặng: <strong>Topic Sentence</strong> (mở bài) → <strong>Background Info</strong> (bối cảnh) → <strong>Main Point</strong> (chi tiết Cue Card) → <strong>Feelings &amp; Future Plans</strong>.'
                    ),
                    extra: kwExtra
                },
                {
                    title: t('Step 2: Speak Continuously for 1.5–2 Minutes', 'Bước 2: Thực hành nói liên tục 1.5–2 phút vào Micro'),
                    action: t(
                        'Click <strong>🎙️ Mic</strong> below (or follow the <strong>1-min prep → 2-min recording</strong> timer). Follow your 4 Mind Map branches and use linking phrases (<em>To begin with, What impressed me most was, Looking back...</em>) to stay fluent.',
                        'Bấm <strong>🎙️ Micro</strong> bên dưới (hoặc theo đồng hồ mô phỏng <strong>1 phút chuẩn bị → 2 phút nói</strong>). Bám theo 4 nhánh Mind Map và dùng từ nối (<em>To begin with, What impressed me most was, Looking back...</em>) để giữ mạch nói trôi chảy.'
                    ),
                    extra: ''
                },
                {
                    title: t('Step 3: Listen to Playback & Compare Sample Answer', 'Bước 3: Nghe lại Playback & Đối chiếu Sample Answer'),
                    action: t(
                        `Play back your recording to check duration (~2 minutes), verb tenses, and final consonants.${sampleHint}`,
                        `Nghe lại bản ghi âm của bạn để kiểm tra thời lượng (~2 phút), chia thì và phát âm âm cuối.${sampleHint}`
                    ),
                    extra: ''
                }
            ];
        }

        if (isPart3) {
            return [
                {
                    title: t('Step 1: Build Point – Explanation – Example on Mind Map', 'Bước 1: Dựng khung Point – Explanation – Example trên Mind Map'),
                    action: t(
                        'Part 3 questions are abstract and societal. Use the <strong>Dynamic Mind Map</strong> on the left to outline: <strong>Point</strong> (direct argument) → <strong>Explanation</strong> (causes/effects) → <strong>Example &amp; Link Back</strong> (example &amp; wrap-up).',
                        'Câu hỏi Part 3 mang tính khái quát xã hội. Dùng <strong>Sơ đồ tư duy</strong> ở cột trái để phác thảo: <strong>Point</strong> (luận điểm trực tiếp) → <strong>Explanation</strong> (nguyên nhân/tác động) → <strong>Example &amp; Link Back</strong> (ví dụ &amp; chốt ý).'
                    ),
                    extra: kwExtra
                },
                {
                    title: t('Step 2: Record Analytical Answer (30–45s)', 'Bước 2: Ghi âm câu trả lời phân tích (30–45 giây)'),
                    action: t(
                        'Click <strong>🎙️ Mic</strong> below to record. Avoid talking only about yourself; take a broader perspective with academic connectors (<em>From a broader perspective, This is largely due to, A clear example is...</em>).',
                        'Bấm <strong>🎙️ Micro</strong> bên dưới để ghi âm. Tránh nói lan man về bản thân; ưu tiên góc nhìn xã hội và từ nối học thuật (<em>From a broader perspective, This is largely due to, A clear example is...</em>).'
                    ),
                    extra: ''
                },
                {
                    title: t('Step 3: Listen to Playback & Compare Sample Answer', 'Bước 3: Nghe lại Playback & Đối chiếu Sample Answer'),
                    action: t(
                        `Listen to your recording to check logical flow and grammatical range.${sampleHint}`,
                        `Nghe lại bản ghi âm để kiểm tra tính logic và độ đa dạng cấu trúc câu.${sampleHint}`
                    ),
                    extra: ''
                }
            ];
        }

        return [
            {
                title: t('Step 1: Outline Direct Answer + Further Details', 'Bước 1: Phác thảo Direct Answer + Further Details trên Mind Map'),
                action: t(
                    'Read the question on the left and use the <strong>Dynamic Mind Map</strong> to prepare 2 parts: <strong>Direct Answer</strong> + <strong>Further Details</strong> (1 reason, habit, or brief detail), plus 2–3 target words.',
                    'Đọc câu hỏi ở cột trái và dùng <strong>Sơ đồ tư duy</strong> để chuẩn bị nhanh 2 phần: <strong>Direct Answer</strong> (trả lời thẳng vào câu hỏi) + <strong>Further Details</strong> (1 lý do, thói quen hoặc chi tiết ngắn), kèm 2–3 từ vựng gợi ý.'
                ),
                extra: kwExtra
            },
            {
                title: t('Step 2: Record Natural Response (15–25s/question)', 'Bước 2: Bấm Micro ghi âm tự nhiên (15–25 giây/câu)'),
                action: t(
                    'Click <strong>🎙️ Mic</strong> below and speak naturally in 2–3 sentences (<em>Yes, definitely... / To be honest... because...</em>) without memorizing.',
                    'Bấm <strong>🎙️ Micro</strong> bên dưới để nói tự nhiên theo cấu trúc 2–3 câu (<em>Yes, definitely... / To be honest... because...</em>), không cần học thuộc lòng.'
                ),
                extra: ''
            },
            {
                title: t('Step 3: Listen to Playback & Compare Sample Answer', 'Bước 3: Nghe lại Playback & Đối chiếu Sample Answer'),
                action: t(
                    `Listen to your recording to check fluency, word stress, and pronunciation.${sampleHint}`,
                    `Nghe lại bản ghi âm để tự kiểm tra độ trôi chảy, nhấn trọng âm và phát âm.${sampleHint}`
                ),
                extra: ''
            }
        ];
    }

    function getStepsForQuestion(q, moduleName, partObj) {
        if (moduleName === 'writing') return getWritingSteps(q, partObj);
        if (moduleName === 'speaking') return getSpeakingSteps(q, partObj);
        const type = String(q?.type || '');
        const subtype = String(q?.subtype || (q?.questionFormat === 'matching_sentence_endings' ? 'matching_endings' : '') || type);
        const isListening = moduleName === 'listening';
        const wordLimit = extractWordLimit(q?.instruction);
        const { hard, soft, traps } = extractKeywordsHint(q?.text);

        // 1. READING: GAP-FILL WITH A BOX (Summary Completion)
        if (!isListening && subtype === 'summary_box') {
            const gaps = extractGapContexts(q);
            const opts = (q?.options || []).slice(0, 12);
            const boxHtml = opts.length
                ? `<div class="mt-2 flex flex-wrap gap-1.5">${opts.map(o => `<span class="px-2 py-0.5 rounded bg-slate-100 border border-slate-300 text-xs font-semibold text-slate-700">${escapeHtml(stripHtml(o))}</span>`).join('')}</div>`
                : '';
            const gapHtml = gaps.length
                ? `<div class="mt-2 space-y-1.5">${gaps.map(g => `<div class="rounded-lg border border-sky-200 bg-white px-3 py-2 text-xs"><span class="font-black text-sky-800 mr-1.5">Q${g.id}:</span><span class="text-slate-600">${escapeHtml(g.before)}</span> <span class="px-1.5 py-0.5 rounded bg-amber-100 text-amber-900 font-bold">[ ___ ]</span> <span class="text-slate-600">${escapeHtml(g.after)}</span><div class="mt-1 text-[11px] font-semibold text-emerald-700">💡 ${escapeHtml(g.hint)}</div></div>`).join('')}</div>`
                : '';
            return [
                {
                    title: t('Step 1: Categorize the Word Box', 'Bước 1: Phân loại Khung từ vựng (Box Categorization)'),
                    action: t(
                        'Do not rush into the passage. Spend 30 seconds labeling parts of speech (<strong>N / V / Adj</strong>) for the words in the box and spotting antonym/synonym pairs (often one is the answer or a distractor):',
                        'Đừng vội đọc bài ngay. Dành 30 giây gán nhãn từ loại (<strong>N / V / Adj</strong>) cho các từ trong hộp và tìm cặp từ trái nghĩa/gần nghĩa (thường 1 trong 2 là đáp án hoặc bẫy):'
                    ),
                    extra: boxHtml
                },
                {
                    title: t('Step 2: Analyze Gaps (Grammar & Semantic Filter)', 'Bước 2: Phân tích chỗ trống (Grammar & Semantic Filter)'),
                    action: t(
                        'Filter each gap by grammar (singular/plural Noun, active/passive Verb, or Adj) and positive (+) / negative (−) tone:',
                        'Lọc ngữ pháp (cần N số ít/nhiều, V chủ động/bị động, hay Adj) và sắc thái nghĩa tích cực (+) / tiêu cực (-) cho từng ô:'
                    ),
                    extra: gapHtml
                },
                {
                    title: t('Step 3: Locate the Section & Extract the Original Word (Paraphrase Layer 1)', 'Bước 3: Định vị đoạn văn & Nhặt "Từ gốc" (Tầng Paraphrase 1)'),
                    action: t(
                        'Summaries usually come from <strong>1–2 consecutive paragraphs</strong>. Use Hard Keywords to find the right section and extract the <strong>exact idea in the passage</strong> before looking back at the box.',
                        'Dạng Summary thường nằm gọn trong <strong>1–2 đoạn liên tiếp</strong>. Dùng Hard Keywords để tìm đúng đoạn văn và nhặt <strong>từ gốc trong bài đọc</strong> trước khi nhìn lại hộp từ.'
                    ),
                    extra: renderHardKeywords(hard, soft)
                },
                {
                    title: t('Step 4: Match 2-Layer Paraphrases & Check Grammar', 'Bước 4: So chiếu 2 tầng Paraphrase & Kiểm tra ngữ pháp'),
                    action: t(
                        'Pair the <em>passage word ↔ synonym in the box</em> (Double Paraphrasing). Place the word in the gap and re-read the whole sentence for meaning and grammar before clicking Check Answer.',
                        'Ghép cặp <em>Từ gốc trong bài ↔ Từ đồng nghĩa trong hộp</em> (cơ chế Double Paraphrasing). Kéo từ vào ô, đọc lại toàn câu xem mượt nghĩa và đúng ngữ pháp trước khi bấm Check Answer.'
                    ),
                    extra: ''
                }
            ];
        }

        // 2. LISTENING PART 4: NOTE / LECTURE COMPLETION
        if (isListening && (subtype === 'fill_blanks_p4' || (type === 'fill_blanks' && (q?.ids || []).some(id => id >= 31)))) {
            const gaps = extractGapContexts(q);
            const gapHtml = gaps.length
                ? `<div class="mt-2 space-y-1.5">${gaps.map(g => `<div class="rounded-lg border border-sky-200 bg-white px-3 py-2 text-xs"><span class="font-black text-sky-800 mr-1.5">Q${g.id}:</span><span class="text-slate-600">${escapeHtml(g.before)}</span> <span class="px-1.5 py-0.5 rounded bg-amber-100 text-amber-900 font-bold">[ ___ ]</span> <span class="text-slate-600">${escapeHtml(g.after)}</span><div class="mt-1 text-[11px] font-semibold text-emerald-700">💡 ${escapeHtml(g.hint)}</div></div>`).join('')}</div>`
                : '';
            return [
                {
                    title: t('Step 1: Lock Word Limit & Scan Lecture Structure', 'Bước 1: Khóa Giới hạn từ & Quét Khung xương Bài giảng'),
                    action: t(
                        `${wordLimit ? `Highlight the word limit <strong class="px-1.5 py-0.5 rounded bg-yellow-200 text-slate-900">${escapeHtml(wordLimit)}</strong>.` : 'Check the Word Limit (usually ONE WORD ONLY).'} Skim the main title and bold subheadings to follow the lecture flow from start to finish.`,
                        `${wordLimit ? `Highlight ngay giới hạn từ <strong class="px-1.5 py-0.5 rounded bg-yellow-200 text-slate-900">${escapeHtml(wordLimit)}</strong>.` : 'Kiểm tra Word Limit (thường là ONE WORD ONLY).'} Đọc lướt Tiêu đề chính và các Đề mục in đậm (Subheadings) để nắm mạch bài giảng từ đầu tới cuối.`
                    ),
                    extra: ''
                },
                {
                    title: t('Step 2: Analyze Gaps & Singular/Plural Clues', 'Bước 2: Phân tích Chỗ trống & Khóa Số ít / Số nhiều'),
                    action: t(
                        '75–80% of Part 4 answers are <strong>Nouns</strong>. Check articles <code>a/an</code> (singular) vs <code>are/were</code> or no article (likely plural <code>-s/-es</code> or uncountable):',
                        '75–80% đáp án Part 4 là <strong>Danh từ</strong>. Kiểm tra kỹ mạo từ <code>a/an</code> (số ít) hay động từ <code>are/were</code>, không có <code>a/an</code> (dễ là số nhiều <code>-s/-es</code> hoặc không đếm được):'
                    ),
                    extra: gapHtml
                },
                {
                    title: t('Step 3: Identify Anchors & Predict Spoken Paraphrases', 'Bước 3: Xác định "Mỏ neo" & Dự đoán Paraphrase Học thuật'),
                    action: t(
                        'Circle Hard Keywords (years, scientists, places) as anchors. Translate formal noun phrases into spoken English (e.g. <em>lack of → shortage of / absence of</em>; <em>causes of decline → why it started falling</em>).',
                        'Khoanh tròn Hard Keywords (năm, tên nhà khoa học, địa danh) làm mỏ neo. Đổi cụm danh từ trên đề sang văn nói (VD: <em>lack of → shortage of / absence of</em>; <em>causes of decline → why it started falling</em>).'
                    ),
                    extra: renderHardKeywords(hard, soft)
                },
                {
                    title: t('Step 4: Follow Signposts & Watch Word-Order Traps', 'Bước 4: Nghe theo "Đèn tín hiệu" & Tránh bẫy đảo trật tự'),
                    action: t(
                        'Listen for transition phrases (<em>Let\'s turn now to..., Moving on to...</em>) to keep pace. <strong>Watch out for word-order swaps:</strong> the answer may be spoken <em>before</em> the keyword on the page!',
                        'Chú ý cụm chuyển mục (<em>Let\'s turn now to..., Moving on to...</em>) để nhảy mắt kịp. <strong>Cảnh giác bẫy đảo trật tự từ:</strong> đáp án có thể xuất hiện <em>trước</em> khi nghe thấy từ khóa trên đề!'
                    ),
                    extra: `<div class="mt-2 rounded-lg bg-slate-50 border border-slate-200 p-2.5 text-[11px] text-slate-700 space-y-1"><div><strong>${t('Common signposting cues:', 'Tín hiệu chuyển ý hay gặp:')}</strong></div><div>• <em>${t('Topic shift:', 'Chuyển mục:')}</em> Let's turn now to... / Moving on to...</div><div>• <em>${t('Cause/Effect:', 'Nguyên nhân/Kết quả:')}</em> This stemmed from... / Consequently...</div><div>• <em>${t('Emphasis (90% contains answer):', 'Nhấn mạnh (90% chứa đáp án):')}</em> Crucially... / What is particularly striking is...</div></div>`
                },
                {
                    title: t('Step 5: Check Spelling, Grammar & Word Limit', 'Bước 5: Rà soát Chính tả học thuật, Ngữ pháp & Word Limit'),
                    action: t(
                        'Double-check tricky academic spellings (<em>environment, government, temperature, maintenance</em>), plural <code>-s/-es</code> endings, and word count before submitting.',
                        'Kiểm tra chính tả các từ dễ sai (<em>environment, government, temperature, maintenance</em>), kiểm tra đuôi <code>-s/-es</code> và đếm lại số từ trước khi nộp.'
                    ),
                    extra: ''
                }
            ];
        }

        // 3. READING / LISTENING PART 1-3: GAP-FILL
        if (type === 'fill_blanks') {
            const gaps = extractGapContexts(q);
            const gapHtml = gaps.length
                ? `<div class="mt-2 space-y-1.5">${gaps.map(g => `<div class="rounded-lg border border-sky-200 bg-white px-3 py-2 text-xs"><span class="font-black text-sky-800 mr-1.5">Q${g.id}:</span><span class="text-slate-600">${escapeHtml(g.before)}</span> <span class="px-1.5 py-0.5 rounded bg-amber-100 text-amber-900 font-bold">[ ___ ]</span> <span class="text-slate-600">${escapeHtml(g.after)}</span><div class="mt-1 text-[11px] font-semibold text-emerald-700">💡 ${escapeHtml(g.hint)}</div></div>`).join('')}</div>`
                : '';
            return [
                {
                    title: t('Step 1: Read & Highlight the Word Limit', 'Bước 1: Đọc kỹ & Highlight Giới hạn từ (Word Limit)'),
                    action: wordLimit
                        ? t(
                            `Highlight the word limit <strong class="px-1.5 py-0.5 rounded bg-yellow-200 text-slate-900">${escapeHtml(wordLimit)}</strong> so you never write extra words or articles.`,
                            `Bôi vàng cụm giới hạn từ <strong class="px-1.5 py-0.5 rounded bg-yellow-200 text-slate-900">${escapeHtml(wordLimit)}</strong> trên đề bài để tuyệt đối không điền thừa từ hoặc thừa mạo từ.`
                        )
                        : t(
                            'Check the word limit at the top of the block (e.g. ONE WORD ONLY, NO MORE THAN TWO WORDS).',
                            'Đọc kỹ yêu cầu giới hạn từ ở đầu block (VD: ONE WORD ONLY, NO MORE THAN TWO WORDS) và highlight lại.'
                        ),
                    extra: ''
                },
                {
                    title: t('Step 2: Analyze Gaps & Predict Part of Speech + Meaning', 'Bước 2: Phân tích chỗ trống & Dự đoán Từ loại + Ngữ nghĩa'),
                    action: isListening
                        ? t(
                            'Predict the information type: <strong>Proper name (wait for spelling), Phone number (double/triple), Price, Date</strong>, or Part of Speech (N/V/Adj) for each gap:',
                            'Dự đoán loại thông tin cần nghe: <strong>Tên riêng (chờ đánh vần), SĐT (nghe double/triple), Giá tiền, Ngày tháng</strong>, hoặc Từ loại (N/V/Adj) cho từng ô:'
                        )
                        : t(
                            'Identify 2 things before reading the passage: (1) <strong>Part of Speech</strong> (N/V/Adj/Number), (2) <strong>Countable/Uncountable, Singular/Plural</strong>, person/object/place:',
                            'Xác định 2 yếu tố trước khi nhìn bài đọc: (1) <strong>Từ loại</strong> (N/V/Adj/Số), (2) <strong>Đếm được hay không, Số ít hay nhiều</strong>, chỉ người/vật/nơi chốn:'
                        ),
                    extra: gapHtml
                },
                {
                    title: isListening
                        ? t('Step 3: Highlight Keywords & Watch Self-Corrections (Distractors)', 'Bước 3: Highlight từ khóa & Cảnh giác bẫy tự sửa (Distractors)')
                        : t('Step 3: Split Keywords (Hard vs. Soft Keywords)', 'Bước 3: Chia 2 nhóm từ khóa (Hard vs. Soft Keywords)'),
                    action: isListening
                        ? t(
                            'Highlight keywords around each gap. Speakers often give a wrong detail and self-correct (<em>"Oh wait, sorry, it\'s actually..."</em>) — lock in only the final confirmed detail!',
                            'Bôi vàng từ khóa xung quanh ô trống. Trong băng, người nói rất hay đưa thông tin sai rồi tự sửa lại (<em>"Oh wait, sorry, it\'s actually..."</em>) — chỉ chốt thông tin cuối cùng!'
                        )
                        : t(
                            'Use <strong>Hard Keywords</strong> (names, years, numbers) to scan quickly to the right paragraph. Use <strong>Soft Keywords</strong> (verbs/adjectives) to spot paraphrases or Active ↔ Passive shifts.',
                            '<strong>Hard Keywords</strong> (tên riêng, năm tháng, số liệu) dùng để Scan nhanh tới đúng đoạn văn. <strong>Soft Keywords</strong> (động/tính từ) chuẩn bị săn Paraphrase hoặc đổi Active ↔ Passive.'
                        ),
                    extra: renderHardKeywords(hard, soft)
                },
                {
                    title: t('Step 4: Keep Original Words & Check the 4-Trap Checklist', 'Bước 4: Lấy từ nguyên bản & Kiểm tra Checklist 4 bẫy'),
                    action: t(
                        'Copy the exact word from the passage/audio (do not change word form). Verify: (1) Singular/plural, (2) No duplicate <code>a/an/the</code>, (3) Contrast traps (<em>however, although, instead of</em>), (4) Word limit.',
                        'Nhặt chính xác từ trong bài/audio (không tự đổi dạng từ). Kiểm tra lại: (1) Số ít/nhiều, (2) Không chép thừa <code>a/an/the</code> nếu đề đã có sẵn, (3) Bẫy tương phản (<em>however, although, instead of</em>), (4) Đủ giới hạn từ.'
                    ),
                    extra: ''
                }
            ];
        }

        // 4. READING: TRUE / FALSE / NOT GIVEN & YES / NO / NOT GIVEN
        if (type === 'tfng' || type === 'ynng') {
            const isYN = type === 'ynng';
            const tLbl = isYN ? 'YES' : 'TRUE';
            const fLbl = isYN ? 'NO' : 'FALSE';
            const trapHtml = traps.length
                ? `<div class="mt-2 flex flex-wrap items-center gap-1.5"><span class="text-[11px] font-bold text-rose-700">⚠️ ${t('Qualifiers / trap words detected:', 'Từ khóa hạn định / bẫy phát hiện được:')}</span>${traps.map(tr => `<span class="px-2 py-0.5 rounded bg-rose-100 text-rose-900 border border-rose-300 text-xs font-bold">${escapeHtml(tr)}</span>`).join('')}</div>`
                : '';
            return [
                {
                    title: t(`Step 1: Master ${tLbl} / ${fLbl} / NOT GIVEN Logic`, `Bước 1: Hiểu đúng bản chất ${tLbl} / ${fLbl} / NOT GIVEN`),
                    action: t(
                        `<strong>${tLbl}:</strong> Matches 100% of the meaning (usually paraphrased). · <strong>${fLbl}:</strong> Directly contradicts the passage. · <strong>NOT GIVEN:</strong> Not mentioned or insufficient evidence. <em>Golden rule: No assumptions!</em>`,
                        `<strong>${tLbl}:</strong> Khớp 100% ý nghĩa (thường được paraphrase). · <strong>${fLbl}:</strong> Trực tiếp mâu thuẫn / trái ngược với bài. · <strong>NOT GIVEN:</strong> Không nhắc tới hoặc thiếu dữ kiện kết luận. <em>Quy tắc vàng: No assumption (cấm tự suy diễn)!</em>`
                    ),
                    extra: ''
                },
                {
                    title: t('Step 2: Spot Qualifiers & Quantifiers', 'Bước 2: Khoanh vùng 3 nhóm từ khóa bẫy (Qualifiers & Quantifiers)'),
                    action: t(
                        '80% of answers hinge on qualifiers: (1) <strong>Absolute vs Relative</strong> (<em>always, never, all, only</em> vs <em>often, some, may</em>), (2) <strong>Certainty</strong> (<em>definitely, will</em> vs <em>likely, suggest</em>), (3) <strong>Cause & Comparison</strong> (<em>caused by, more than</em>).',
                        '80% đáp án nằm ở các từ hạn định: (1) <strong>Tuyệt đối vs Tương đối</strong> (<em>always, never, all, only</em> vs <em>often, some, may</em>), (2) <strong>Mức độ chắc chắn</strong> (<em>definitely, will</em> vs <em>likely, suggest</em>), (3) <strong>Nhân quả & So sánh</strong> (<em>caused by, more than</em>).'
                    ),
                    extra: `${trapHtml}${renderHardKeywords(hard, soft)}`
                },
                {
                    title: t('Step 3: Scan & Read Full Context (Before/After)', 'Bước 3: Scanning & Đọc trọn ngữ cảnh (câu trước/sau)'),
                    action: t(
                        'Use proper names/years to locate the paragraph. Read the target sentence plus 1–2 surrounding sentences; watch contrast linkers (<em>however, although, despite, yet</em>) and implicit negatives (<em>fail to, rarely, avoid, little</em>).',
                        'Dùng tên riêng/năm tháng để tìm nhanh đoạn văn. Đọc kỹ câu chứa thông tin và 1–2 câu xung quanh, cảnh giác liên từ đối lập (<em>however, although, despite, yet</em>) và phủ định ngầm (<em>fail to, rarely, avoid, little</em>).'
                    ),
                    extra: ''
                },
                {
                    title: t('Step 4: Verify with the 3-Part Logic Checklist', 'Bước 4: So chiếu logic theo "Checklist 3 nhánh"'),
                    action: t(
                        `Split the statement into 3 parts: <strong>[1. Subject]</strong> in passage? → <strong>[2. Action / Trait]</strong> matches? → <strong>[3. Degree / Condition]</strong> matches? All match = ${tLbl}; 1 contradicts = ${fLbl}; Missing = NOT GIVEN.`,
                        `Tách câu hỏi thành 3 mảnh rồi đối chiếu từng mảnh: <strong>[1. Chủ ngữ]</strong> có trong bài? → <strong>[2. Hành động / Tính chất]</strong> khớp không? → <strong>[3. Mức độ / Điều kiện]</strong> khớp không? Khớp hết = ${tLbl}; Trái 1 điểm = ${fLbl}; Thiếu dữ kiện = NOT GIVEN.`
                    ),
                    extra: ''
                }
            ];
        }

        // 5. READING: MULTIPLE CHOICE 2/5 HOẶC 3/6
        if (!isListening && (subtype === 'mcq_2_5' || subtype === 'mcq_3_6')) {
            const nIds = (q?.ids || []).length || 2;
            const nOpts = (q?.options || []).length || 5;
            return [
                {
                    title: t(`Step 1: Lock Question Focus (${nIds}/${nOpts})`, `Bước 1: Khóa chặt trục câu hỏi (${nIds}/${nOpts})`),
                    action: t(
                        `Select exactly <strong>${nIds} letters out of ${nOpts} options</strong>. Identify the <strong>Question Focus</strong>: benefits, problems, reasons, or solutions? A true detail with the wrong focus → eliminate!`,
                        `Chọn đúng <strong>${nIds} chữ cái trong ${nOpts} lựa chọn</strong>. Xác định rõ <strong>Trục nội dung (Question Focus)</strong>: đề hỏi Lợi ích (benefits), Khó khăn (problems), Nguyên nhân (reasons) hay Đề xuất (solutions)? Ý đúng nhưng lệch trục → Loại ngay!`
                    ),
                    extra: ''
                },
                {
                    title: t('Step 2: Group Options & Spot Extreme Qualifiers', 'Bước 2: Gom nhóm phương án (Categorization) & Soi Qualifiers'),
                    action: t(
                        'Group the 5–6 options into <strong>2–3 themes</strong> (e.g., Cost, People, Tech) or <strong>Opposites</strong>. Circle extreme words (<em>all, only, completely, excessive</em> — very likely False).',
                        'Gom 5–6 phương án thành <strong>2–3 nhóm chủ đề</strong> (VD: Nhóm Tài chính, Nhóm Con người, Nhóm Kỹ thuật) hoặc <strong>Cặp đối lập</strong>. Khoanh tròn các từ cực đoan (<em>all, only, completely, excessive</em> — xác suất False rất cao).'
                    ),
                    extra: ''
                },
                {
                    title: t('Step 3: Cluster Scanning by Theme', 'Bước 3: Quét bài đọc theo từng Nhóm chủ đề (Cluster Scanning)'),
                    action: t(
                        'Instead of memorizing A–E separately, scan the passage by your grouped themes (e.g., when the text discusses cost → check all Cost options together).',
                        'Thay vì nhớ rời từng câu A–E, hãy đọc đoạn văn theo từng cụm chủ đề vừa gom (VD: khi bài nói về chi phí → đối chiếu ngay toàn bộ Nhóm Tài chính).'
                    ),
                    extra: renderHardKeywords(hard, soft)
                },
                {
                    title: t('Step 4: Label & Eliminate (FALSE / NOT GIVEN / WRONG FOCUS / TRUE)', 'Bước 4: Gán nhãn loại trừ (FALSE / NOT GIVEN / WRONG FOCUS / TRUE)'),
                    action: t(
                        'Label each option: Contradicts → <strong>FALSE</strong>; No evidence → <strong>NOT GIVEN</strong>; Off-topic → <strong>WRONG FOCUS</strong>; Paraphrase match → <strong>TRUE</strong>.',
                        'Gán nhãn cho từng phương án trong nhóm: Trái ngược → <strong>FALSE</strong>; Không có căn cứ → <strong>NOT GIVEN</strong>; Sai trọng tâm câu hỏi → <strong>WRONG FOCUS</strong>; Khớp nghĩa paraphrase → <strong>TRUE</strong>.'
                    ),
                    extra: ''
                }
            ];
        }

        // 6. MULTIPLE CHOICE (Reading 1/4 & Listening Part 2/3)
        if (type === 'multiple_choice') {
            const nIds = (q?.ids || []).length || 1;
            const nOpts = (q?.options || []).length || (isListening ? 3 : 4);
            if (isListening) {
                const isPart3 = subtype === 'mcq_1_3_p3' || (q?.ids || []).some(id => id >= 21);
                return [
                    {
                        title: t(`Step 1: Read Stems & Compare ${nIds}/${nOpts} Options`, `Bước 1: Đọc câu dẫn & Phân biệt ${nIds}/${nOpts} lựa chọn`),
                        action: t(
                            `Mark the required count (<strong>${nIds}/${nOpts}</strong>) and underline key differences among options A, B, C before the audio starts.`,
                            `Đánh dấu số đáp án cần chọn (<strong>${nIds}/${nOpts}</strong>) và gạch chân từ khóa khác biệt giữa 3 lựa chọn A, B, C trước khi băng chạy.`
                        ),
                        extra: renderHardKeywords(hard, soft)
                    },
                    {
                        title: isPart3
                            ? t('Step 2: Track Speakers & Agreement / Rejection Cues', 'Bước 2: Bắt đúng người nói & Tín hiệu Đồng thuận / Bác bỏ')
                            : t('Step 2: Listen for the Full Idea & "All 3 Mentioned" Traps', 'Bước 2: Nghe trọn ý & Cảnh giác bẫy "Nhắc hết cả 3 phương án"'),
                        action: isPart3
                            ? t(
                                'Part 3 is a 2–3 speaker discussion: check whose opinion is asked. Listen for agreement (<em>Exactly, You\'re right</em>) vs disagreement/revision (<em>That\'s a fair point, though..., I\'m not convinced...</em>).',
                                'Part 3 là hội thoại 2–3 người: xác định câu hỏi hỏi ý kiến của ai. Chú ý câu đồng tình (<em>Exactly, You\'re right</em>) vs phản bác/chỉnh sửa (<em>That\'s a fair point, though..., I\'m not convinced...</em>).'
                            )
                            : t(
                                'Speakers often mention A, B, and C, but two are traps with wrong timing (<em>used to, last year</em>) or negated by <em>however, actually, instead</em>.',
                                'Người nói thường nhắc tới cả A, B, C nhưng 2 lựa chọn là bẫy sai thời điểm (<em>used to, last year</em>) hoặc bị phủ định bằng <em>however, actually, instead</em>.'
                            ),
                        extra: ''
                    },
                    {
                        title: t('Step 3: Eliminate Distractors & Lock Answer', 'Bước 3: Loại trừ đáp án nhiễu & Chốt lựa chọn'),
                        action: t(
                            'Cross out rejected or off-topic options (use the 🪄 50/50 button if practicing elimination).',
                            'Loại phương án bị bác bỏ hoặc không đúng câu hỏi (dùng nút 🪄 50/50 nếu cần luyện loại trừ).'
                        ),
                        extra: ''
                    }
                ];
            }
            return [
                {
                    title: t('Step 1: Read the Stem & Locate the Paragraph', 'Bước 1: Đọc kỹ Câu dẫn (Stem) & Định vị đoạn văn'),
                    action: t(
                        'Underline keywords in the question stem first (before reading A–D) and scan to find the relevant paragraph.',
                        'Gạch chân từ khóa ở câu dẫn trước (chưa cần đọc vội 4 lựa chọn A–D) rồi Scan tìm đoạn văn chứa thông tin câu hỏi.'
                    ),
                    extra: renderHardKeywords(hard, soft)
                },
                {
                    title: t('Step 2: Understand the Passage Sentence Before Looking at A/B/C/D', 'Bước 2: Đọc hiểu câu gốc trong bài trước khi nhìn A/B/C/D'),
                    action: t(
                        'Read 2–3 sentences in the passage to answer the question in your own words first, avoiding distractor bias.',
                        'Đọc kỹ 2–3 câu trong bài để tự trả lời câu hỏi bằng tiếng Việt/Anh trước, tránh bị các lựa chọn bẫy dẫn dắt.'
                    ),
                    extra: ''
                },
                {
                    title: t('Step 3: Eliminate the 3 Classic Traps', 'Bước 3: So chiếu & Loại trừ 3 loại bẫy kinh điển'),
                    action: t(
                        'Eliminate: (1) <strong>Opposite</strong> (contradicts passage), (2) <strong>Not Given</strong> (outside info), (3) <strong>Word-spotting trap</strong> (repeats exact words but distorts meaning).',
                        'Gạch bỏ ngay: (1) <strong>Opposite</strong> (trái ý bài), (2) <strong>Not Given</strong> (tự thêm ý ngoài bài), (3) <strong>Word-spotting trap</strong> (lặp từ y hệt bài nhưng sai quan hệ nghĩa).'
                    ),
                    extra: ''
                }
            ];
        }

        // 7. READING: MATCHING HEADINGS
        if (type === 'matching_headings') {
            return [
                {
                    title: t('Step 1: Analyze Headings & Spot "Twin" Pairs', 'Bước 1: Phân tích danh sách Headings & Cặp "song sinh"'),
                    action: t(
                        'Underline distinguishing keywords in Roman-numeral headings (i, ii, iii...), circling attitude/function words (<em>Benefits vs Drawbacks, Causes vs Solutions, A shift</em>). Mark similar-looking pairs.',
                        'Gạch chân từ khóa phân biệt trong bảng La Mã (i, ii, iii...), khoanh từ chỉ thái độ/chức năng (<em>Benefits vs Drawbacks, Causes vs Solutions, A shift</em>). Đánh dấu các cặp heading na ná nhau.'
                    ),
                    extra: ''
                },
                {
                    title: t('Step 2: Do Easy Paragraphs Before Hard Ones', 'Bước 2: Chọn thứ tự làm "Dễ trước – Khó sau"'),
                    action: t(
                        'Cross out any example heading. Tackle <strong>short, single-idea paragraphs</strong> first; leave long/multi-viewpoint paragraphs for last when fewer headings remain.',
                        'Gạch bỏ heading đã dùng làm ví dụ (Example). Làm các <strong>đoạn ngắn, 1 luận điểm</strong> trước; để các đoạn dài/nhiều quan điểm tranh luận làm cuối cùng để thu hẹp bảng La Mã.'
                    ),
                    extra: ''
                },
                {
                    title: t('Step 3: Read Top-Down & Bottom-Up', 'Bước 3: Đọc đoạn theo 2 kỹ thuật (Top-down & Bottom-up)'),
                    action: t(
                        '<strong>Top-down:</strong> Find the Topic Sentence (opening, mid-paragraph after <em>However/Instead</em>, or closing sentence). <strong>Bottom-up:</strong> Summarize listing paragraphs in 3–5 words before checking headings.',
                        '<strong>Top-down:</strong> Tìm Topic Sentence (đầu đoạn, giữa đoạn sau <em>However/Instead</em>, hoặc câu chốt cuối đoạn). <strong>Bottom-up:</strong> Nếu đoạn liệt kê, tự tóm tắt thành 3–5 từ tiếng Việt trước khi nhìn lại bảng Headings.'
                    ),
                    extra: ''
                },
                {
                    title: t('Step 4: Apply the "Umbrella" Rule (Avoid 4 Traps)', 'Bước 4: Kiểm tra nguyên tắc "Cái Ô" (Loại trừ 4 bẫy)'),
                    action: t(
                        'The right heading must cover <strong>70–80% of the paragraph</strong>. Reject: (1) <em>Too Specific</em> (only 1 example), (2) <em>Too Broad</em>, (3) <em>Word-Match Trap</em>, (4) <em>Opposite</em>.',
                        'Heading đúng phải bao trùm <strong>70–80% nội dung đoạn</strong>. Loại bỏ: (1) <em>Too Specific</em> (chỉ nói 1 câu ví dụ), (2) <em>Too Broad</em>, (3) <em>Word-Match Trap</em> (trùng từ vựng bề mặt), (4) <em>Opposite</em>.'
                    ),
                    extra: ''
                }
            ];
        }

        // 8. READING: MATCHING INFORMATION
        if (type === 'matching_info') {
            return [
                {
                    title: t('Step 1: Check NB Rule & Set Priority Order', 'Bước 1: Kiểm tra quy tắc NB & Xếp thứ tự ưu tiên'),
                    action: t(
                        'Check for <em>"NB: You may use any letter more than once"</em> (if present, at least one paragraph is used twice). Tip: <strong>Do this type last</strong> after mapping the passage; start with items having names/numbers.',
                        'Kiểm tra xem có dòng <em>"NB: You may use any letter more than once"</em> không (có = chắc chắn có đoạn dùng 2 lần). Mẹo: <strong>Làm dạng này cuối cùng</strong> sau khi đã hiểu bố cục bài đọc; ưu tiên câu có tên riêng/số liệu làm trước.'
                    ),
                    extra: ''
                },
                {
                    title: t('Step 2: Decode Function Keywords (Supporting Sentences)', 'Bước 2: Giải mã "Từ khóa chức năng" của Supporting Sentence'),
                    action: t(
                        'Matching Info targets <strong>specific details</strong>, not main ideas. Match signals: <em>a reason</em> → because/due to; <em>a comparison</em> → whereas/more...than; <em>an example</em> → such as/for instance; <em>a prediction</em> → will/forecast.',
                        'Matching Info tìm <strong>chi tiết/dẫn chứng (Supporting Sentence)</strong> chứ không phải ý chính. Bắt đúng tín hiệu: <em>a reason</em> → because/due to; <em>a comparison</em> → whereas/more...than; <em>an example</em> → such as/for instance; <em>a prediction</em> → will/forecast.'
                    ),
                    extra: renderHardKeywords(hard, soft)
                },
                {
                    title: t('Step 3: Block-by-Block Paragraph Mapping', 'Bước 3: Đọc theo khối đoạn văn (Block-by-Block Mapping)'),
                    action: t(
                        'Skim paragraphs A, B, C... in order (Topic Sentence + numbers/evidence). After reading Paragraph A, check all questions right away; skip any item taking >1 minute and return later.',
                        'Đọc lướt từng đoạn A, B, C... (nắm Topic Sentence + quét các câu số liệu/dẫn chứng nổi bật). Đọc xong Đoạn A đối chiếu ngay với bảng câu hỏi; câu nào phân vân quá 1 phút → bỏ qua sang Đoạn B.'
                    ),
                    extra: ''
                },
                {
                    title: t('Step 4: Verify Paraphrase & Exact Function', 'Bước 4: So chiếu Paraphrase & Kiểm tra đúng chức năng'),
                    action: t(
                        'Ensure the sentence matches the exact function asked (e.g., <em>a reason for failure</em> requires the cause of failure, not merely mentioning failure).',
                        'Đảm bảo câu trong bài khớp đúng chức năng câu hỏi (VD: hỏi <em>a reason for failure</em> thì phải có lý do thất bại, không chỉ nhắc tới việc thất bại).'
                    ),
                    extra: ''
                }
            ];
        }

        // 9. READING: MATCHING STATEMENTS (Features)
        if (!isListening && subtype === 'matching_statements') {
            return [
                {
                    title: t('Step 1: Scan & Count Name Frequency', 'Bước 1: Quét & Đếm tần suất nhân vật (Xếp thứ tự ưu tiên)'),
                    action: t(
                        'Scan the passage and circle all names (A, B, C...). <strong>Do names appearing once FIRST</strong> (info is in one place); 2–3 times next; scattered names LAST by elimination.',
                        'Scan toàn bài khoanh tròn tên nhân vật/đối tượng (A, B, C...). <strong>Nhân vật xuất hiện 1 lần làm ĐẦU TIÊN</strong> (thông tin nằm gọn 1 chỗ); 2–3 lần làm tiếp theo; rải rác cả bài làm CUỐI CÙNG bằng loại trừ.'
                    ),
                    extra: ''
                },
                {
                    title: t('Step 2: Read Only Direct & Reported Speech', 'Bước 2: Chỉ đọc 2 dạng câu chứa phát biểu của nhân vật'),
                    action: t(
                        'Skip biography details; focus on: (1) <strong>Direct Speech</strong> (<code>"..."</code>), and (2) <strong>Reported Speech</strong> (after <em>argued that, claimed that, doubted that, According to X...</em>).',
                        'Bỏ qua tiểu sử, chỉ đọc: (1) <strong>Direct Speech</strong> (trong ngoặc kép <code>"..."</code>), và (2) <strong>Reported Speech</strong> (sau <em>argued that, claimed that, doubted that, According to X...</em>).'
                    ),
                    extra: ''
                },
                {
                    title: t('Step 3: Simplify Statements & Attitude', 'Bước 3: Rút gọn Statements & Nhận diện thái độ'),
                    action: t(
                        'Reduce each statement to <code>Subject + Action + Attitude (for / against / neutral)</code> to match reporting verbs quickly.',
                        'Rút gọn từng câu hỏi thành <code>Chủ ngữ + Hành động + Thái độ (ủng hộ / phản đối / trung lập)</code> để khớp nhanh với động từ tường thuật.'
                    ),
                    extra: renderHardKeywords(hard, soft)
                },
                {
                    title: t('Step 4: Match Paraphrases & Narrow Down', 'Bước 4: So chiếu Paraphrase & Gạch bỏ dần'),
                    action: t(
                        'Match logic rather than identical words (exact word matches are often traps). Cross off matched statements as you go.',
                        'Khớp về mặt logic (câu hỏi trùng từ gốc thường là bẫy). Khi ghép xong câu nào, loại trừ dần để thu hẹp phạm vi.'
                    ),
                    extra: ''
                }
            ];
        }

        // 10. READING: MATCHING SENTENCE ENDINGS
        if (!isListening && subtype === 'matching_endings') {
            return [
                {
                    title: t('Step 1: Read & Highlight Keywords in Stems', 'Bước 1: Đọc & Highlight từ khóa ở Vế đầu (Stems)'),
                    action: t(
                        'Underline the subject and main verb of each stem (1, 2, 3...) to know who/what it is about and predict the ending.',
                        'Gạch chân chủ ngữ và động từ chính ở từng vế đầu (1, 2, 3...) để biết câu đang nói về ai/vấn đề gì và dự đoán nghĩa vế kết.'
                    ),
                    extra: renderHardKeywords(hard, soft)
                },
                {
                    title: t('Step 2: Scan the Passage in Question Order', 'Bước 2: Scan bài đọc theo trình tự câu hỏi'),
                    action: t(
                        'Matching Endings usually follow passage order from top to bottom. Locate the sentence explaining the rest of each stem.',
                        'Các câu Matching Endings thường đi theo đúng thứ tự từ trên xuống dưới trong bài đọc. Tìm câu gốc giải thích phần tiếp theo của vế đầu.'
                    ),
                    extra: ''
                },
                {
                    title: t('Step 3: Match Paraphrases with Endings (A–G)', 'Bước 3: Khớp nghĩa Paraphrase với danh sách Vế kết (A–G)'),
                    action: t(
                        'Compare the passage meaning with the given endings (watch for synonyms and word-borrowing traps with wrong meaning).',
                        'So chiếu ý nghĩa trong bài đọc với các vế kết cho sẵn (chú ý từ đồng nghĩa và bẫy mượn từ nhưng sai nghĩa).'
                    ),
                    extra: ''
                },
                {
                    title: t('Step 4: Grammar Check', 'Bước 4: Kiểm tra hòa hợp Ngữ pháp (Grammar Check)'),
                    action: t(
                        'Read the combined stem + ending as one complete sentence to verify subject–verb agreement, tense, and conjunctions.',
                        'Ghép vế đầu + vế kết vừa chọn thành 1 câu hoàn chỉnh để kiểm tra sự hòa hợp Chủ–Vị, thì và liên từ.'
                    ),
                    extra: ''
                }
            ];
        }

        // 11. LISTENING: MAP LABELLING
        if (type === 'map_labelling_grid' || type === 'map_labelling_hotspots' || subtype === 'map_dnd') {
            return [
                {
                    title: t('Step 1: Find Starting Point & Compass (N/S/E/W)', 'Bước 1: Xác định Điểm xuất phát & La bàn (N/S/E/W)'),
                    action: t(
                        'Locate the starting point (<em>Entrance / Gate / You are here</em>) and check whether the map has a compass (North–South–East–West).',
                        'Tìm ngay vị trí bắt đầu (<em>Entrance / Gate / You are here</em>) và kiểm tra xem bản đồ có la bàn Đông–Tây–Nam–Bắc không.'
                    ),
                    extra: ''
                },
                {
                    title: t('Step 2: Note Fixed Landmarks Around Gaps', 'Bước 2: Ghi nhớ các Mốc cố định (Landmarks) quanh ô trống'),
                    action: t(
                        'Read the labeled areas on the map as landmarks to orient yourself as the speaker moves.',
                        'Đọc nhanh tên các khu vực đã có sẵn trên bản đồ để làm mốc định hướng khi người nói di chuyển.'
                    ),
                    extra: ''
                },
                {
                    title: t('Step 3: Listen for Prepositions & Turns', 'Bước 3: Bắt cụm giới từ chỉ vị trí & Hướng rẽ'),
                    action: t(
                        'Focus on location cues: <em>opposite, next to, just past, in the top-right corner, on the far side of, turn left/right, go straight ahead</em>.',
                        'Tập trung nghe: <em>opposite, next to, just past, in the top-right corner, on the far side of, turn left/right, go straight ahead</em>.'
                    ),
                    extra: ''
                }
            ];
        }

        // 12. LISTENING: MATCHING PART 2 / PART 3
        const isListP3 = subtype === 'matching_p3' || (q?.ids || []).some(id => id >= 21);
        return [
            {
                title: t('Step 1: Read Option Box (A–H) & Highlight Keywords', 'Bước 1: Đọc kỹ Hộp lựa chọn (A–H) & Highlight từ khóa'),
                action: isListP3
                    ? t(
                        'Read options (A–H) beforehand to anticipate paraphrases. Check whether the box lists attitudes, comments, or actions.',
                        'Đọc trước các lựa chọn (A–H) để nắm từ khóa sẽ bị paraphrase. Chú ý xem bảng lựa chọn nói về thái độ, nhận xét hay hành động.'
                    )
                    : t(
                        'Read the options (A–H) and keywords for each numbered item (items 1, 2, 3... always follow audio order).',
                        'Đọc trước danh sách lựa chọn (A–H) và từ khóa của từng mục câu hỏi (câu hỏi 1, 2, 3... luôn đi đúng thứ tự trong audio).'
                    ),
                extra: renderHardKeywords(hard, soft)
            },
            {
                title: isListP3
                    ? t('Step 2: Track 2-Speaker Interaction & Opinion Shifts', 'Bước 2: Nghe tương tác 2 người & Bẫy thay đổi ý kiến')
                    : t('Step 2: Catch Paraphrases & Reject Distractors', 'Bước 2: Bắt Paraphrase & Cảnh giác thông tin nhiễu'),
                action: isListP3
                    ? t(
                        'In Part 3, speakers negotiate before agreeing. Always hear the full exchange to see if they agree or override with <em>"Actually, I think..."</em>.',
                        'Ở Part 3, hai người nói thường trao đổi qua lại trước khi chốt ý. Luôn nghe hết lượt trao đổi xem họ có đồng ý với nhau hay bác bỏ bằng <em>"Actually, I think..."</em>.'
                    )
                    : t(
                        'Eliminate options negated by the speaker (<em>used to be, not anymore, instead</em>) and pick the final confirmed idea.',
                        'Gạch bỏ hoặc bỏ qua các phương án bị người nói phủ định (<em>used to be, not anymore, instead</em>), chọn ý được chốt sau cùng.'
                    ),
                extra: ''
            }
        ];
    }

    const activeStepByBlock = new Map();
    const completedByBlock = new Map();
    const openByBlock = new Map();

    root.renderQuestionScaffoldCoach = function(q, blockIdx, moduleName, partObj) {
        if (!['reading', 'listening', 'writing', 'speaking'].includes(moduleName)) return '';
        const activePart = partObj || (typeof APP_DATA !== 'undefined' && typeof currentPartIdx !== 'undefined' ? APP_DATA?.parts?.[currentPartIdx] : null);
        const steps = getStepsForQuestion(q, moduleName, activePart);
        if (!steps.length) return '';

        const activeStep = activeStepByBlock.get(blockIdx) || 0;
        const completed = completedByBlock.get(blockIdx) || new Set();
        const isOpen = openByBlock.get(blockIdx) || false;
        const step = steps[Math.min(activeStep, steps.length - 1)];
        const isDone = completed.has(activeStep);
        const footerTip = moduleName === 'writing'
            ? t('Tip: Combine the Mind Map on the left with Scaffolded Writing & the Analyzer below.', 'Mẹo: Kết hợp Sơ đồ tư duy bên trái với Viết theo khối & Bộ phân tích bên dưới.')
            : (moduleName === 'speaking'
                ? t('Tip: Jot keywords in the Mind Map on the left, speak naturally into the Mic, then play back.', 'Mẹo: Ghi chú từ khóa trên Sơ đồ tư duy bên trái, nói tự nhiên vào Micro rồi nghe lại.')
                : t('Tip: Select text in the prompt or passage to highlight key details.', 'Mẹo: Bôi đen chữ trên đề bài/đoạn văn để highlight ghi nhớ.'));

        const tabsHtml = steps.map((s, idx) => {
            const active = idx === activeStep;
            const done = completed.has(idx);
            const cls = active
                ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm'
                : (done ? 'bg-emerald-50 text-emerald-800 border-emerald-300' : 'bg-white text-slate-600 border-slate-200 hover:border-indigo-300');
            return `<button type="button" onclick="window.selectScaffoldStep(${blockIdx}, ${idx})" class="px-2.5 py-1 rounded-lg border text-xs font-bold transition flex items-center gap-1 ${cls}"><span>${done ? '✓' : `${idx + 1}.`}</span><span>${t(`Step ${idx + 1}`, `Bước ${idx + 1}`)}</span></button>`;
        }).join('');

        return `
            <div class="mb-4 rounded-xl border border-indigo-200 bg-indigo-50/60 p-3 shadow-sm" data-scaffold-coach="${blockIdx}">
                <div class="flex flex-wrap items-center justify-between gap-2">
                    <div class="flex items-center gap-2">
                        <span class="text-xs font-black uppercase tracking-wider text-indigo-800">🎯 ${t('Step-by-Step Guide', 'Hướng dẫn từng bước')}</span>
                        <span class="text-[11px] font-semibold text-indigo-700 bg-white px-2 py-0.5 rounded-full border border-indigo-200">${completed.size}/${steps.length} ${t('steps', 'bước')}</span>
                    </div>
                    <button type="button" onclick="window.toggleQuestionScaffoldCoach(${blockIdx})" class="text-xs font-bold text-indigo-700 hover:text-indigo-900 bg-white border border-indigo-200 px-2.5 py-1 rounded-lg transition">
                        ${isOpen ? t('Collapse ▲', 'Thu gọn ▲') : t('Open guide ▼', 'Mở hướng dẫn ▼')}
                    </button>
                </div>
                <div id="scaffold-coach-body-${blockIdx}" class="${isOpen ? '' : 'hidden'} mt-3 pt-3 border-t border-indigo-200/80">
                    <div class="flex flex-wrap gap-1.5 mb-3">${tabsHtml}</div>
                    <div class="rounded-lg bg-white border border-indigo-100 p-3.5 text-sm text-slate-700 shadow-sm">
                        <div class="font-extrabold text-indigo-900 mb-1">${escapeHtml(step.title)}</div>
                        <p class="text-[13px] leading-relaxed">${step.action}</p>
                        ${step.extra || ''}
                        <div class="mt-3 pt-2 border-t border-slate-100 flex items-center justify-between gap-2">
                            <span class="text-[11px] text-slate-500 italic">${escapeHtml(footerTip)}</span>
                            <button type="button" onclick="window.markScaffoldStepDone(${blockIdx}, ${activeStep}, ${steps.length})" class="px-3 py-1 rounded-lg text-xs font-bold transition ${isDone ? 'bg-emerald-100 text-emerald-800 border border-emerald-300' : 'bg-indigo-600 hover:bg-indigo-700 text-white shadow-sm'}">
                                ${isDone ? t('✓ Step completed', '✓ Đã xong bước này') : (activeStep < steps.length - 1 ? t('Complete & Next step →', 'Hoàn thành & Sang bước tiếp →') : t('Complete ✓', 'Hoàn thành ✓'))}
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        `;
    };

    function refreshCoachBlock(blockIdx) {
        const el = document.querySelector(`[data-scaffold-coach="${blockIdx}"]`);
        if (!el || typeof APP_DATA === 'undefined') return;
        const q = APP_DATA?.parts?.[currentPartIdx]?.questions?.[blockIdx];
        if (!q) return;
        const wrapper = document.createElement('div');
        wrapper.innerHTML = root.renderQuestionScaffoldCoach(q, blockIdx, APP_DATA.module);
        if (wrapper.firstElementChild) el.replaceWith(wrapper.firstElementChild);
    }

    root.toggleQuestionScaffoldCoach = function(blockIdx) {
        openByBlock.set(blockIdx, !(openByBlock.get(blockIdx) || false));
        refreshCoachBlock(blockIdx);
    };

    root.selectScaffoldStep = function(blockIdx, stepIdx) {
        openByBlock.set(blockIdx, true);
        activeStepByBlock.set(blockIdx, stepIdx);
        refreshCoachBlock(blockIdx);
    };

    root.markScaffoldStepDone = function(blockIdx, stepIdx, totalSteps) {
        const set = completedByBlock.get(blockIdx) || new Set();
        set.add(stepIdx);
        completedByBlock.set(blockIdx, set);
        if (stepIdx < totalSteps - 1) {
            activeStepByBlock.set(blockIdx, stepIdx + 1);
        }
        openByBlock.set(blockIdx, true);
        refreshCoachBlock(blockIdx);
    };

    if (typeof module !== 'undefined' && module.exports) {
        module.exports = {
            renderQuestionScaffoldCoach: root.renderQuestionScaffoldCoach,
            extractWordLimit,
            extractGapContexts,
            extractKeywordsHint
        };
    }
})(typeof window !== 'undefined' ? window : globalThis);
