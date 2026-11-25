(function(root) {
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
            if (idx === -1) return { id, before: '', after: '', hint: 'Xác định từ loại (Danh / Động / Tính từ / Số) dựa vào từ đứng trước và sau ô trống.' };
            const beforeWords = plain.slice(0, idx).trim().split(/\s+/).slice(-4).join(' ');
            const afterWords = plain.slice(idx + token.length).trim().split(/\s+/).slice(0, 4).join(' ');
            const lastBefore = beforeWords.split(/\s+/).pop()?.toLowerCase() || '';
            let posHint = 'Phân tích ngữ pháp trước & sau ô để đoán từ loại (N / V / Adj / Số).';
            if (/^(a|an|the|my|his|her|their|our|its|some|many|several|no|this|that|these|those)$/.test(lastBefore)) {
                posHint = `Sau "${lastBefore}" → Danh từ (Noun) hoặc Cụm danh từ. Chú ý ${/^(a|an)$/.test(lastBefore) ? 'số ít' : 'số ít/nhiều'}.`;
            } else if (/^(is|are|was|were|be|become|seem|appear|feel)$/.test(lastBefore)) {
                posHint = `Sau "${lastBefore}" → thường cần Tính từ (Adj) hoặc Danh từ.`;
            } else if (/^(to|can|will|must|should|may|might|could|would)$/.test(lastBefore)) {
                posHint = `Sau "${lastBefore}" → Động từ nguyên mẫu (V-inf) hoặc Danh từ (nếu "to" là giới từ).`;
            } else if (/^(in|on|at|by|for|from|with|about|of|into|during|between)$/.test(lastBefore)) {
                posHint = `Sau giới từ "${lastBefore}" → Danh từ / V-ing / Số liệu / Địa điểm.`;
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
            parts.push(`<div class="mt-2 flex flex-wrap items-center gap-1.5"><span class="text-[11px] font-bold text-slate-600">Hard Keywords (Scan nhanh):</span>${hard.map(k => `<span class="px-2 py-0.5 rounded bg-yellow-100 text-yellow-900 border border-yellow-300 text-xs font-bold">${escapeHtml(k)}</span>`).join('')}</div>`);
        }
        if (soft && soft.length) {
            parts.push(`<div class="mt-1.5 flex flex-wrap items-center gap-1.5"><span class="text-[11px] font-bold text-slate-600">Keywords nội dung (săn Paraphrase):</span>${soft.map(k => `<span class="px-2 py-0.5 rounded bg-sky-100 text-sky-900 border border-sky-300 text-xs font-bold">${escapeHtml(k)}</span>`).join('')}</div>`);
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
                    title: 'Bước 1: Đọc biểu đồ/quy trình & Lập Mind Map (Main vs Minor)',
                    action: 'Đọc kỹ đề bài & biểu đồ ở cột trái. Dùng <strong>Dynamic Mind Map</strong> ở cột trái để tách 2 nhóm: <strong>Main Details (Overview)</strong> — xu hướng chung, điểm cao/thấp nhất (không đưa số liệu) và <strong>Minor Details (Body)</strong> — số liệu, so sánh chi tiết.',
                    extra: kwExtra
                },
                {
                    title: 'Bước 2: Viết Introduction & Overview trong Viết theo khối',
                    action: 'Điền 2 khối đầu của <strong>Scaffolded Writing / Viết theo khối</strong> bên dưới: (1) <strong>Introduction</strong> — paraphrase lại đề bài; (2) <strong>Overview</strong> — tóm tắt 2–3 xu hướng nổi bật nhất (<em>Overall, It is clear that...</em>).',
                    extra: ''
                },
                {
                    title: 'Bước 3: Triển khai Body 1 & Body 2 với số liệu chính xác',
                    action: 'Nhóm đối tượng hợp lý vào <strong>Body 1 &amp; Body 2</strong>. Đưa số liệu từ nhánh <em>Minor Details</em> kèm từ nối &amp; cấu trúc so sánh/xu hướng (<em>peaked at, declined steadily, whereas, compared to</em>).',
                    extra: ''
                },
                {
                    title: 'Bước 4: Kiểm tra Writing Analyzer & Đối chiếu Sample Answer',
                    action: `Kiểm tra bộ đếm <strong>Words (tối thiểu 150 từ)</strong> và bảng <strong>Writing Text Analyzer</strong> bên dưới (lỗi lặp từ, từ nối, cấu trúc câu).${hasSample ? ' Sau khi viết xong, bấm <strong>👁️ Show Sample Answer</strong> ở cột trái để đối chiếu theo 4 tiêu chí <em>TA, CC, LR, GRA</em>.' : ''}`,
                    extra: ''
                }
            ];
        }

        return [
            {
                title: 'Bước 1: Xác định dạng bài & Lập Mind Map (Position → Point → Explanation)',
                action: 'Xác định rõ dạng đề (<em>Opinion, Discussion, Advantages/Disadvantages, Problem/Solution</em>). Dùng <strong>Dynamic Mind Map</strong> ở cột trái để chốt: <strong>Position (Thesis Statement)</strong> → <strong>Main Point</strong> → <strong>Explanation</strong>, đồng thời chọn từ vựng &amp; Discourse Markers gợi ý.',
                extra: kwExtra
            },
            {
                title: 'Bước 2: Viết Introduction & Chốt Thesis Statement',
                action: 'Ở khối <strong>Introduction</strong> trong <strong>Scaffolded Writing</strong> bên dưới: paraphrase bối cảnh đề bài (1–2 câu) và viết <strong>Thesis Statement</strong> trả lời trực tiếp yêu cầu đề bài.',
                extra: ''
            },
            {
                title: 'Bước 3: Phát triển Body 1 & Body 2 theo mạch P-E-E',
                action: 'Mỗi đoạn thân bài triển khai đủ: <strong>Point</strong> (câu chủ đề rõ ràng) → <strong>Explanation</strong> (giải thích nguyên nhân/cơ chế bằng <em>This is because, Consequently</em>) → <strong>Example</strong> (ví dụ cụ thể).',
                extra: ''
            },
            {
                title: 'Bước 4: Viết Conclusion, Kiểm tra Analyzer & Đối chiếu Sample Answer',
                action: `Viết <strong>Conclusion</strong> khẳng định lại quan điểm (không thêm ý mới). Đảm bảo bộ đếm <strong>Words ≥ 250 từ</strong>, rà soát bảng <strong>Writing Text Analyzer</strong> bên dưới.${hasSample ? ' Sau đó mở <strong>👁️ Show Sample Answer</strong> ở cột trái để đối chiếu theo 4 tiêu chí <em>TR, CC, LR, GRA</em>.' : ''}`,
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
            ? ' Sau đó bấm <strong>🔊 Listen to Sample Answer</strong> và <strong>👁️ Show Sample Answer</strong> ở cột trái để so sánh cách dùng từ &amp; ngữ điệu theo 4 tiêu chí <em>FC, LR, GRA, PR</em>.'
            : '';

        if (isPart2) {
            return [
                {
                    title: 'Bước 1: Lập dàn ý 4 nhánh trên Mind Map (1 phút chuẩn bị)',
                    action: 'Dùng <strong>Dynamic Mind Map</strong> ở cột trái để ghi nhanh từ khóa cho 4 chặng: <strong>Topic Sentence</strong> (mở bài) → <strong>Background Info</strong> (bối cảnh) → <strong>Main Point</strong> (chi tiết Cue Card) → <strong>Feelings &amp; Future Plans</strong>.',
                    extra: kwExtra
                },
                {
                    title: 'Bước 2: Thực hành nói liên tục 1.5–2 phút vào Micro',
                    action: 'Bấm <strong>🎙️ Micro</strong> bên dưới (hoặc theo đồng hồ mô phỏng <strong>1 phút chuẩn bị → 2 phút nói</strong>). Bám theo 4 nhánh Mind Map và dùng từ nối (<em>To begin with, What impressed me most was, Looking back...</em>) để giữ mạch nói trôi chảy.',
                    extra: ''
                },
                {
                    title: 'Bước 3: Nghe lại Playback & Đối chiếu Sample Answer',
                    action: `Nghe lại bản ghi âm của bạn để kiểm tra thời lượng (~2 phút), chia thì và phát âm âm cuối.${sampleHint}`,
                    extra: ''
                }
            ];
        }

        if (isPart3) {
            return [
                {
                    title: 'Bước 1: Dựng khung Point – Explanation – Example trên Mind Map',
                    action: 'Câu hỏi Part 3 mang tính khái quát xã hội. Dùng <strong>Dynamic Mind Map</strong> ở cột trái để phác thảo: <strong>Point</strong> (luận điểm trực tiếp) → <strong>Explanation</strong> (nguyên nhân/tác động) → <strong>Example &amp; Link Back</strong> (ví dụ &amp; chốt ý).',
                    extra: kwExtra
                },
                {
                    title: 'Bước 2: Ghi âm câu trả lời phân tích (30–45 giây)',
                    action: 'Bấm <strong>🎙️ Micro</strong> bên dưới để ghi âm. Tránh nói lan man về bản thân; ưu tiên góc nhìn xã hội và từ nối học thuật (<em>From a broader perspective, This is largely due to, A clear example is...</em>).',
                    extra: ''
                },
                {
                    title: 'Bước 3: Nghe lại Playback & Đối chiếu Sample Answer',
                    action: `Nghe lại bản ghi âm để kiểm tra tính logic và độ đa dạng cấu trúc câu.${sampleHint}`,
                    extra: ''
                }
            ];
        }

        return [
            {
                title: 'Bước 1: Phác thảo Direct Answer + Further Details trên Mind Map',
                action: 'Đọc câu hỏi ở cột trái và dùng <strong>Dynamic Mind Map</strong> để chuẩn bị nhanh 2 phần: <strong>Direct Answer</strong> (trả lời thẳng vào câu hỏi) + <strong>Further Details</strong> (1 lý do, thói quen hoặc chi tiết ngắn), kèm 2–3 từ vựng gợi ý.',
                extra: kwExtra
            },
            {
                title: 'Bước 2: Bấm Micro ghi âm tự nhiên (15–25 giây/câu)',
                action: 'Bấm <strong>🎙️ Micro</strong> bên dưới để nói tự nhiên theo cấu trúc 2–3 câu (<em>Yes, definitely... / To be honest... because...</em>), không cần học thuộc lòng.',
                extra: ''
            },
            {
                title: 'Bước 3: Nghe lại Playback & Đối chiếu Sample Answer',
                action: `Nghe lại bản ghi âm để tự kiểm tra độ trôi chảy, nhấn trọng âm và phát âm.${sampleHint}`,
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
                    title: 'Bước 1: Phân loại Khung từ vựng (Box Categorization)',
                    action: 'Đừng vội đọc bài ngay. Dành 30 giây gán nhãn từ loại (<strong>N / V / Adj</strong>) cho các từ trong hộp và tìm cặp từ trái nghĩa/gần nghĩa (thường 1 trong 2 là đáp án hoặc bẫy):',
                    extra: boxHtml
                },
                {
                    title: 'Bước 2: Phân tích chỗ trống (Grammar & Semantic Filter)',
                    action: 'Lọc ngữ pháp (cần N số ít/nhiều, V chủ động/bị động, hay Adj) và sắc thái nghĩa tích cực (+) / tiêu cực (-) cho từng ô:',
                    extra: gapHtml
                },
                {
                    title: 'Bước 3: Định vị đoạn văn & Nhặt "Từ gốc" (Tầng Paraphrase 1)',
                    action: 'Dạng Summary thường nằm gọn trong <strong>1–2 đoạn liên tiếp</strong>. Dùng Hard Keywords để tìm đúng đoạn văn và nhặt <strong>từ gốc trong bài đọc</strong> trước khi nhìn lại hộp từ.',
                    extra: renderHardKeywords(hard, soft)
                },
                {
                    title: 'Bước 4: So chiếu 2 tầng Paraphrase & Kiểm tra ngữ pháp',
                    action: 'Ghép cặp <em>Từ gốc trong bài ↔ Từ đồng nghĩa trong hộp</em> (cơ chế Double Paraphrasing). Kéo từ vào ô, đọc lại toàn câu xem mượt nghĩa và đúng ngữ pháp trước khi bấm Check Answer.',
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
                    title: 'Bước 1: Khóa Giới hạn từ & Quét Khung xương Bài giảng',
                    action: `${wordLimit ? `Highlight ngay giới hạn từ <strong class="px-1.5 py-0.5 rounded bg-yellow-200 text-slate-900">${escapeHtml(wordLimit)}</strong>.` : 'Kiểm tra Word Limit (thường là ONE WORD ONLY).'} Đọc lướt Tiêu đề chính và các Đề mục in đậm (Subheadings) để nắm mạch bài giảng từ đầu tới cuối.`,
                    extra: ''
                },
                {
                    title: 'Bước 2: Phân tích Chỗ trống & Khóa Số ít / Số nhiều',
                    action: '75–80% đáp án Part 4 là <strong>Danh từ</strong>. Kiểm tra kỹ mạo từ <code>a/an</code> (số ít) hay động từ <code>are/were</code>, không có <code>a/an</code> (dễ là số nhiều <code>-s/-es</code> hoặc không đếm được):',
                    extra: gapHtml
                },
                {
                    title: 'Bước 3: Xác định "Mỏ neo" & Dự đoán Paraphrase Học thuật',
                    action: 'Khoanh tròn Hard Keywords (năm, tên nhà khoa học, địa danh) làm mỏ neo. Đổi cụm danh từ trên đề sang văn nói (VD: <em>lack of → shortage of / absence of</em>; <em>causes of decline → why it started falling</em>).',
                    extra: renderHardKeywords(hard, soft)
                },
                {
                    title: 'Bước 4: Nghe theo "Đèn tín hiệu" & Tránh bẫy đảo trật tự',
                    action: 'Chú ý cụm chuyển mục (<em>Let\'s turn now to..., Moving on to...</em>) để nhảy mắt kịp. <strong>Cảnh giác bẫy đảo trật tự từ:</strong> đáp án có thể xuất hiện <em>trước</em> khi nghe thấy từ khóa trên đề!',
                    extra: `<div class="mt-2 rounded-lg bg-slate-50 border border-slate-200 p-2.5 text-[11px] text-slate-700 space-y-1"><div><strong>Tín hiệu chuyển ý hay gặp:</strong></div><div>• <em>Chuyển mục:</em> Let's turn now to... / Moving on to...</div><div>• <em>Nguyên nhân/Kết quả:</em> This stemmed from... / Consequently...</div><div>• <em>Nhấn mạnh (90% chứa đáp án):</em> Crucially... / What is particularly striking is...</div></div>`
                },
                {
                    title: 'Bước 5: Rà soát Chính tả học thuật, Ngữ pháp & Word Limit',
                    action: 'Kiểm tra chính tả các từ dễ sai (<em>environment, government, temperature, maintenance</em>), kiểm tra đuôi <code>-s/-es</code> và đếm lại số từ trước khi nộp.',
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
                    title: 'Bước 1: Đọc kỹ & Highlight Giới hạn từ (Word Limit)',
                    action: wordLimit
                        ? `Bôi vàng cụm giới hạn từ <strong class="px-1.5 py-0.5 rounded bg-yellow-200 text-slate-900">${escapeHtml(wordLimit)}</strong> trên đề bài để tuyệt đối không điền thừa từ hoặc thừa mạo từ.`
                        : 'Đọc kỹ yêu cầu giới hạn từ ở đầu block (VD: ONE WORD ONLY, NO MORE THAN TWO WORDS) và highlight lại.',
                    extra: ''
                },
                {
                    title: 'Bước 2: Phân tích chỗ trống & Dự đoán Từ loại + Ngữ nghĩa',
                    action: isListening
                        ? 'Dự đoán loại thông tin cần nghe: <strong>Tên riêng (chờ đánh vần), SĐT (nghe double/triple), Giá tiền, Ngày tháng</strong>, hoặc Từ loại (N/V/Adj) cho từng ô:'
                        : 'Xác định 2 yếu tố trước khi nhìn bài đọc: (1) <strong>Từ loại</strong> (N/V/Adj/Số), (2) <strong>Đếm được hay không, Số ít hay nhiều</strong>, chỉ người/vật/nơi chốn:',
                    extra: gapHtml
                },
                {
                    title: isListening ? 'Bước 3: Highlight từ khóa & Cảnh giác bẫy tự sửa (Distractors)' : 'Bước 3: Chia 2 nhóm từ khóa (Hard vs. Soft Keywords)',
                    action: isListening
                        ? 'Bôi vàng từ khóa xung quanh ô trống. Trong băng, người nói rất hay đưa thông tin sai rồi tự sửa lại (<em>"Oh wait, sorry, it\'s actually..."</em>) — chỉ chốt thông tin cuối cùng!'
                        : '<strong>Hard Keywords</strong> (tên riêng, năm tháng, số liệu) dùng để Scan nhanh tới đúng đoạn văn. <strong>Soft Keywords</strong> (động/tính từ) chuẩn bị săn Paraphrase hoặc đổi Active ↔ Passive.',
                    extra: renderHardKeywords(hard, soft)
                },
                {
                    title: 'Bước 4: Lấy từ nguyên bản & Kiểm tra Checklist 4 bẫy',
                    action: 'Nhặt chính xác từ trong bài/audio (không tự đổi dạng từ). Kiểm tra lại: (1) Số ít/nhiều, (2) Không chép thừa <code>a/an/the</code> nếu đề đã có sẵn, (3) Bẫy tương phản (<em>however, although, instead of</em>), (4) Đủ giới hạn từ.',
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
                ? `<div class="mt-2 flex flex-wrap items-center gap-1.5"><span class="text-[11px] font-bold text-rose-700">⚠️ Từ khóa hạn định / bẫy phát hiện được:</span>${traps.map(t => `<span class="px-2 py-0.5 rounded bg-rose-100 text-rose-900 border border-rose-300 text-xs font-bold">${escapeHtml(t)}</span>`).join('')}</div>`
                : '';
            return [
                {
                    title: `Bước 1: Hiểu đúng bản chất ${tLbl} / ${fLbl} / NOT GIVEN`,
                    action: `<strong>${tLbl}:</strong> Khớp 100% ý nghĩa (thường được paraphrase). · <strong>${fLbl}:</strong> Trực tiếp mâu thuẫn / trái ngược với bài. · <strong>NOT GIVEN:</strong> Không nhắc tới hoặc thiếu dữ kiện kết luận. <em>Quy tắc vàng: No assumption (cấm tự suy diễn)!</em>`,
                    extra: ''
                },
                {
                    title: 'Bước 2: Khoanh vùng 3 nhóm từ khóa bẫy (Qualifiers & Quantifiers)',
                    action: '80% đáp án nằm ở các từ hạn định: (1) <strong>Tuyệt đối vs Tương đối</strong> (<em>always, never, all, only</em> vs <em>often, some, may</em>), (2) <strong>Mức độ chắc chắn</strong> (<em>definitely, will</em> vs <em>likely, suggest</em>), (3) <strong>Nhân quả & So sánh</strong> (<em>caused by, more than</em>).',
                    extra: `${trapHtml}${renderHardKeywords(hard, soft)}`
                },
                {
                    title: 'Bước 3: Scanning & Đọc trọn ngữ cảnh (câu trước/sau)',
                    action: 'Dùng tên riêng/năm tháng để tìm nhanh đoạn văn. Đọc kỹ câu chứa thông tin và 1–2 câu xung quanh, cảnh giác liên từ đối lập (<em>however, although, despite, yet</em>) và phủ định ngầm (<em>fail to, rarely, avoid, little</em>).',
                    extra: ''
                },
                {
                    title: 'Bước 4: So chiếu logic theo "Checklist 3 nhánh"',
                    action: `Tách câu hỏi thành 3 mảnh rồi đối chiếu từng mảnh: <strong>[1. Chủ ngữ]</strong> có trong bài? → <strong>[2. Hành động / Tính chất]</strong> khớp không? → <strong>[3. Mức độ / Điều kiện]</strong> khớp không? Khớp hết = ${tLbl}; Trái 1 điểm = ${fLbl}; Thiếu dữ kiện = NOT GIVEN.`,
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
                    title: `Bước 1: Khóa chặt trục câu hỏi (${nIds}/${nOpts})`,
                    action: `Chọn đúng <strong>${nIds} chữ cái trong ${nOpts} lựa chọn</strong>. Xác định rõ <strong>Trục nội dung (Question Focus)</strong>: đề hỏi Lợi ích (benefits), Khó khăn (problems), Nguyên nhân (reasons) hay Đề xuất (solutions)? Ý đúng nhưng lệch trục → Loại ngay!`,
                    extra: ''
                },
                {
                    title: 'Bước 2: Gom nhóm phương án (Categorization) & Soi Qualifiers',
                    action: 'Gom 5–6 phương án thành <strong>2–3 nhóm chủ đề</strong> (VD: Nhóm Tài chính, Nhóm Con người, Nhóm Kỹ thuật) hoặc <strong>Cặp đối lập</strong>. Khoanh tròn các từ cực đoan (<em>all, only, completely, excessive</em> — xác suất False rất cao).',
                    extra: ''
                },
                {
                    title: 'Bước 3: Quét bài đọc theo từng Nhóm chủ đề (Cluster Scanning)',
                    action: 'Thay vì nhớ rời từng câu A–E, hãy đọc đoạn văn theo từng cụm chủ đề vừa gom (VD: khi bài nói về chi phí → đối chiếu ngay toàn bộ Nhóm Tài chính).',
                    extra: renderHardKeywords(hard, soft)
                },
                {
                    title: 'Bước 4: Gán nhãn loại trừ (FALSE / NOT GIVEN / WRONG FOCUS / TRUE)',
                    action: 'Gán nhãn cho từng phương án trong nhóm: Trái ngược → <strong>FALSE</strong>; Không có căn cứ → <strong>NOT GIVEN</strong>; Sai trọng tâm câu hỏi → <strong>WRONG FOCUS</strong>; Khớp nghĩa paraphrase → <strong>TRUE</strong>.',
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
                        title: `Bước 1: Đọc câu dẫn & Phân biệt ${nIds}/${nOpts} lựa chọn`,
                        action: `Đánh dấu số đáp án cần chọn (<strong>${nIds}/${nOpts}</strong>) và gạch chân từ khóa khác biệt giữa 3 lựa chọn A, B, C trước khi băng chạy.`,
                        extra: renderHardKeywords(hard, soft)
                    },
                    {
                        title: isPart3 ? 'Bước 2: Bắt đúng người nói & Tín hiệu Đồng thuận / Bác bỏ' : 'Bước 2: Nghe trọn ý & Cảnh giác bẫy "Nhắc hết cả 3 phương án"',
                        action: isPart3
                            ? 'Part 3 là hội thoại 2–3 người: xác định câu hỏi hỏi ý kiến của ai. Chú ý câu đồng tình (<em>Exactly, You\'re right</em>) vs phản bác/chỉnh sửa (<em>That\'s a fair point, though..., I\'m not convinced...</em>).'
                            : 'Người nói thường nhắc tới cả A, B, C nhưng 2 lựa chọn là bẫy sai thời điểm (<em>used to, last year</em>) hoặc bị phủ định bằng <em>however, actually, instead</em>.',
                        extra: ''
                    },
                    {
                        title: 'Bước 3: Loại trừ đáp án nhiễu & Chốt lựa chọn',
                        action: 'Loại phương án bị bác bỏ hoặc không đúng câu hỏi (dùng nút 🪄 50/50 nếu cần luyện loại trừ).',
                        extra: ''
                    }
                ];
            }
            return [
                {
                    title: 'Bước 1: Đọc kỹ Câu dẫn (Stem) & Định vị đoạn văn',
                    action: 'Gạch chân từ khóa ở câu dẫn trước (chưa cần đọc vội 4 lựa chọn A–D) rồi Scan tìm đoạn văn chứa thông tin câu hỏi.',
                    extra: renderHardKeywords(hard, soft)
                },
                {
                    title: 'Bước 2: Đọc hiểu câu gốc trong bài trước khi nhìn A/B/C/D',
                    action: 'Đọc kỹ 2–3 câu trong bài để tự trả lời câu hỏi bằng tiếng Việt/Anh trước, tránh bị các lựa chọn bẫy dẫn dắt.',
                    extra: ''
                },
                {
                    title: 'Bước 3: So chiếu & Loại trừ 3 loại bẫy kinh điển',
                    action: 'Gạch bỏ ngay: (1) <strong>Opposite</strong> (trái ý bài), (2) <strong>Not Given</strong> (tự thêm ý ngoài bài), (3) <strong>Word-spotting trap</strong> (lặp từ y hệt bài nhưng sai quan hệ nghĩa).',
                    extra: ''
                }
            ];
        }

        // 7. READING: MATCHING HEADINGS
        if (type === 'matching_headings') {
            return [
                {
                    title: 'Bước 1: Phân tích danh sách Headings & Cặp "song sinh"',
                    action: 'Gạch chân từ khóa phân biệt trong bảng La Mã (i, ii, iii...), khoanh từ chỉ thái độ/chức năng (<em>Benefits vs Drawbacks, Causes vs Solutions, A shift</em>). Đánh dấu các cặp heading na ná nhau.',
                    extra: ''
                },
                {
                    title: 'Bước 2: Chọn thứ tự làm "Dễ trước – Khó sau"',
                    action: 'Gạch bỏ heading đã dùng làm ví dụ (Example). Làm các <strong>đoạn ngắn, 1 luận điểm</strong> trước; để các đoạn dài/nhiều quan điểm tranh luận làm cuối cùng để thu hẹp bảng La Mã.',
                    extra: ''
                },
                {
                    title: 'Bước 3: Đọc đoạn theo 2 kỹ thuật (Top-down & Bottom-up)',
                    action: '<strong>Top-down:</strong> Tìm Topic Sentence (đầu đoạn, giữa đoạn sau <em>However/Instead</em>, hoặc câu chốt cuối đoạn). <strong>Bottom-up:</strong> Nếu đoạn liệt kê, tự tóm tắt thành 3–5 từ tiếng Việt trước khi nhìn lại bảng Headings.',
                    extra: ''
                },
                {
                    title: 'Bước 4: Kiểm tra nguyên tắc "Cái Ô" (Loại trừ 4 bẫy)',
                    action: 'Heading đúng phải bao trùm <strong>70–80% nội dung đoạn</strong>. Loại bỏ: (1) <em>Too Specific</em> (chỉ nói 1 câu ví dụ), (2) <em>Too Broad</em>, (3) <em>Word-Match Trap</em> (trùng từ vựng bề mặt), (4) <em>Opposite</em>.',
                    extra: ''
                }
            ];
        }

        // 8. READING: MATCHING INFORMATION
        if (type === 'matching_info') {
            return [
                {
                    title: 'Bước 1: Kiểm tra quy tắc NB & Xếp thứ tự ưu tiên',
                    action: 'Kiểm tra xem có dòng <em>"NB: You may use any letter more than once"</em> không (có = chắc chắn có đoạn dùng 2 lần). Mẹo: <strong>Làm dạng này cuối cùng</strong> sau khi đã hiểu bố cục bài đọc; ưu tiên câu có tên riêng/số liệu làm trước.',
                    extra: ''
                },
                {
                    title: 'Bước 2: Giải mã "Từ khóa chức năng" của Supporting Sentence',
                    action: 'Matching Info tìm <strong>chi tiết/dẫn chứng (Supporting Sentence)</strong> chứ không phải ý chính. Bắt đúng tín hiệu: <em>a reason</em> → because/due to; <em>a comparison</em> → whereas/more...than; <em>an example</em> → such as/for instance; <em>a prediction</em> → will/forecast.',
                    extra: renderHardKeywords(hard, soft)
                },
                {
                    title: 'Bước 3: Đọc theo khối đoạn văn (Block-by-Block Mapping)',
                    action: 'Đọc lướt từng đoạn A, B, C... (nắm Topic Sentence + quét các câu số liệu/dẫn chứng nổi bật). Đọc xong Đoạn A đối chiếu ngay với bảng câu hỏi; câu nào phân vân quá 1 phút → bỏ qua sang Đoạn B.',
                    extra: ''
                },
                {
                    title: 'Bước 4: So chiếu Paraphrase & Kiểm tra đúng chức năng',
                    action: 'Đảm bảo câu trong bài khớp đúng chức năng câu hỏi (VD: hỏi <em>a reason for failure</em> thì phải có lý do thất bại, không chỉ nhắc tới việc thất bại).',
                    extra: ''
                }
            ];
        }

        // 9. READING: MATCHING STATEMENTS (Features)
        if (!isListening && subtype === 'matching_statements') {
            return [
                {
                    title: 'Bước 1: Quét & Đếm tần suất nhân vật (Xếp thứ tự ưu tiên)',
                    action: 'Scan toàn bài khoanh tròn tên nhân vật/đối tượng (A, B, C...). <strong>Nhân vật xuất hiện 1 lần làm ĐẦU TIÊN</strong> (thông tin nằm gọn 1 chỗ); 2–3 lần làm tiếp theo; rải rác cả bài làm CUỐI CÙNG bằng loại trừ.',
                    extra: ''
                },
                {
                    title: 'Bước 2: Chỉ đọc 2 dạng câu chứa phát biểu của nhân vật',
                    action: 'Bỏ qua tiểu sử, chỉ đọc: (1) <strong>Direct Speech</strong> (trong ngoặc kép <code>"..."</code>), và (2) <strong>Reported Speech</strong> (sau <em>argued that, claimed that, doubted that, According to X...</em>).',
                    extra: ''
                },
                {
                    title: 'Bước 3: Rút gọn Statements & Nhận diện thái độ',
                    action: 'Rút gọn từng câu hỏi thành <code>Chủ ngữ + Hành động + Thái độ (ủng hộ / phản đối / trung lập)</code> để khớp nhanh với động từ tường thuật.',
                    extra: renderHardKeywords(hard, soft)
                },
                {
                    title: 'Bước 4: So chiếu Paraphrase & Gạch bỏ dần',
                    action: 'Khớp về mặt logic (câu hỏi trùng từ gốc thường là bẫy). Khi ghép xong câu nào, loại trừ dần để thu hẹp phạm vi.',
                    extra: ''
                }
            ];
        }

        // 10. READING: MATCHING SENTENCE ENDINGS
        if (!isListening && subtype === 'matching_endings') {
            return [
                {
                    title: 'Bước 1: Đọc & Highlight từ khóa ở Vế đầu (Stems)',
                    action: 'Gạch chân chủ ngữ và động từ chính ở từng vế đầu (1, 2, 3...) để biết câu đang nói về ai/vấn đề gì và dự đoán nghĩa vế kết.',
                    extra: renderHardKeywords(hard, soft)
                },
                {
                    title: 'Bước 2: Scan bài đọc theo trình tự câu hỏi',
                    action: 'Các câu Matching Endings thường đi theo đúng thứ tự từ trên xuống dưới trong bài đọc. Tìm câu gốc giải thích phần tiếp theo của vế đầu.',
                    extra: ''
                },
                {
                    title: 'Bước 3: Khớp nghĩa Paraphrase với danh sách Vế kết (A–G)',
                    action: 'So chiếu ý nghĩa trong bài đọc với các vế kết cho sẵn (chú ý từ đồng nghĩa và bẫy mượn từ nhưng sai nghĩa).',
                    extra: ''
                },
                {
                    title: 'Bước 4: Kiểm tra hòa hợp Ngữ pháp (Grammar Check)',
                    action: 'Ghép vế đầu + vế kết vừa chọn thành 1 câu hoàn chỉnh để kiểm tra sự hòa hợp Chủ–Vị, thì và liên từ.',
                    extra: ''
                }
            ];
        }

        // 11. LISTENING: MAP LABELLING
        if (type === 'map_labelling_grid' || type === 'map_labelling_hotspots' || subtype === 'map_dnd') {
            return [
                {
                    title: 'Bước 1: Xác định Điểm xuất phát & La bàn (N/S/E/W)',
                    action: 'Tìm ngay vị trí bắt đầu (<em>Entrance / Gate / You are here</em>) và kiểm tra xem bản đồ có la bàn Đông–Tây–Nam–Bắc không.',
                    extra: ''
                },
                {
                    title: 'Bước 2: Ghi nhớ các Mốc cố định (Landmarks) quanh ô trống',
                    action: 'Đọc nhanh tên các khu vực đã có sẵn trên bản đồ để làm mốc định hướng khi người nói di chuyển.',
                    extra: ''
                },
                {
                    title: 'Bước 3: Bắt cụm giới từ chỉ vị trí & Hướng rẽ',
                    action: 'Tập trung nghe: <em>opposite, next to, just past, in the top-right corner, on the far side of, turn left/right, go straight ahead</em>.',
                    extra: ''
                }
            ];
        }

        // 12. LISTENING: MATCHING PART 2 / PART 3
        const isListP3 = subtype === 'matching_p3' || (q?.ids || []).some(id => id >= 21);
        return [
            {
                title: 'Bước 1: Đọc kỹ Hộp lựa chọn (A–H) & Highlight từ khóa',
                action: isListP3
                    ? 'Đọc trước các lựa chọn (A–H) để nắm từ khóa sẽ bị paraphrase. Chú ý xem bảng lựa chọn nói về thái độ, nhận xét hay hành động.'
                    : 'Đọc trước danh sách lựa chọn (A–H) và từ khóa của từng mục câu hỏi (câu hỏi 1, 2, 3... luôn đi đúng thứ tự trong audio).',
                extra: renderHardKeywords(hard, soft)
            },
            {
                title: isListP3 ? 'Bước 2: Nghe tương tác 2 người & Bẫy thay đổi ý kiến' : 'Bước 2: Bắt Paraphrase & Cảnh giác thông tin nhiễu',
                action: isListP3
                    ? 'Ở Part 3, hai người nói thường trao đổi qua lại trước khi chốt ý. Luôn nghe hết lượt trao đổi xem họ có đồng ý với nhau hay bác bỏ bằng <em>"Actually, I think..."</em>.'
                    : 'Gạch bỏ hoặc bỏ qua các phương án bị người nói phủ định (<em>used to be, not anymore, instead</em>), chọn ý được chốt sau cùng.',
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
            ? 'Mẹo: Kết hợp Mind Map bên trái với Viết theo khối & Bộ phân tích bên dưới.'
            : (moduleName === 'speaking'
                ? 'Mẹo: Ghi chú từ khóa trên Mind Map bên trái, nói tự nhiên vào Micro rồi nghe lại.'
                : 'Mẹo: Bôi đen chữ trên đề bài/đoạn văn để highlight ghi nhớ.');

        const tabsHtml = steps.map((s, idx) => {
            const active = idx === activeStep;
            const done = completed.has(idx);
            const cls = active
                ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm'
                : (done ? 'bg-emerald-50 text-emerald-800 border-emerald-300' : 'bg-white text-slate-600 border-slate-200 hover:border-indigo-300');
            return `<button type="button" onclick="window.selectScaffoldStep(${blockIdx}, ${idx})" class="px-2.5 py-1 rounded-lg border text-xs font-bold transition flex items-center gap-1 ${cls}"><span>${done ? '✓' : `${idx + 1}.`}</span><span>Bước ${idx + 1}</span></button>`;
        }).join('');

        return `
            <div class="mb-4 rounded-xl border border-indigo-200 bg-indigo-50/60 p-3 shadow-sm" data-scaffold-coach="${blockIdx}">
                <div class="flex flex-wrap items-center justify-between gap-2">
                    <div class="flex items-center gap-2">
                        <span class="text-xs font-black uppercase tracking-wider text-indigo-800">🎯 Hướng dẫn từng bước</span>
                        <span class="text-[11px] font-semibold text-indigo-700 bg-white px-2 py-0.5 rounded-full border border-indigo-200">${completed.size}/${steps.length} bước</span>
                    </div>
                    <button type="button" onclick="window.toggleQuestionScaffoldCoach(${blockIdx})" class="text-xs font-bold text-indigo-700 hover:text-indigo-900 bg-white border border-indigo-200 px-2.5 py-1 rounded-lg transition">
                        ${isOpen ? 'Thu gọn ▲' : 'Mở hướng dẫn ▼'}
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
                                ${isDone ? '✓ Đã xong bước này' : (activeStep < steps.length - 1 ? 'Hoàn thành & Sang bước tiếp →' : 'Hoàn thành ✓')}
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
