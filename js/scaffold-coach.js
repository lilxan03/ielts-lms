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
            let posHint = 'Phân tích ngữ pháp trước & sau ô để đoán từ loại.';
            if (/^(a|an|the|my|his|her|their|our|its|some|many|several|no|this|that|these|those)$/.test(lastBefore)) {
                posHint = `Sau "${lastBefore}" → thường cần Danh từ (Noun) hoặc Cụm danh từ.`;
            } else if (/^(is|are|was|were|be|become|seem|appear|feel)$/.test(lastBefore)) {
                posHint = `Sau "${lastBefore}" → thường cần Tính từ (Adj) hoặc Danh từ.`;
            } else if (/^(to|can|will|must|should|may|might|could|would)$/.test(lastBefore)) {
                posHint = `Sau "${lastBefore}" → thường cần Động từ nguyên mẫu (V-inf) hoặc Danh từ (sau giới từ "to").`;
            } else if (/^(in|on|at|by|for|from|with|about|of|into|during|between)$/.test(lastBefore)) {
                posHint = `Sau giới từ "${lastBefore}" → thường cần Danh từ / V-ing / Số liệu.`;
            }
            return { id, before: beforeWords, after: afterWords, hint: posHint };
        });
    }

    function extractKeywordsHint(text) {
        const plain = stripHtml(text).replace(/__GAP_\d+__/g, ' ');
        const hard = Array.from(new Set(
            (plain.match(/\b(?:[A-Z][a-z]{2,}(?:\s+[A-Z][a-z]{2,})*|\d{3,4}s?|\d+(?:\.\d+)?%?)\b/g) || [])
                .filter(w => !/^(The|This|That|These|Those|When|Where|What|Which|Who|Why|How|Complete|Choose|Write|Questions?|True|False|Not|Given|Yes|No)$/i.test(w))
        )).slice(0, 6);
        const traps = Array.from(new Set(
            plain.toLowerCase().match(/\b(only|always|never|all|every|most|mainly|primarily|first|last|more than|less than|fewer|at least|impossible|completely|entirely)\b/g) || []
        )).slice(0, 6);
        return { hard, traps };
    }

    function getStepsForQuestion(q, moduleName) {
        const type = String(q?.type || '');
        const subtype = String(q?.subtype || (q?.questionFormat === 'matching_sentence_endings' ? 'matching_endings' : '') || type);
        const isListening = moduleName === 'listening';
        const wordLimit = extractWordLimit(q?.instruction);
        const { hard, traps } = extractKeywordsHint(q?.text);

        if (type === 'fill_blanks' || subtype === 'summary_box') {
            const gaps = extractGapContexts(q);
            const gapHtml = gaps.length
                ? `<div class="mt-2 space-y-1.5">${gaps.map(g => `<div class="rounded-lg border border-sky-200 bg-white px-3 py-2 text-xs"><span class="inline-block font-black text-sky-800 mr-1.5">Q${g.id}:</span><span class="text-slate-600">${escapeHtml(g.before)}</span> <span class="px-1.5 py-0.5 rounded bg-amber-100 text-amber-900 font-bold">[ ___ ]</span> <span class="text-slate-600">${escapeHtml(g.after)}</span><div class="mt-1 text-[11px] font-semibold text-emerald-700">💡 ${escapeHtml(g.hint)}</div></div>`).join('')}</div>`
                : '';
            const kwHtml = hard.length
                ? `<div class="mt-2 flex flex-wrap items-center gap-1.5"><span class="text-[11px] font-bold text-slate-600">Từ khóa neo (Hard Keywords):</span>${hard.map(k => `<span class="px-2 py-0.5 rounded bg-yellow-100 text-yellow-900 border border-yellow-300 text-xs font-bold">${escapeHtml(k)}</span>`).join('')}</div>`
                : '';

            return [
                {
                    title: 'Bước 1: Đọc & Highlight giới hạn từ',
                    action: wordLimit
                        ? `Hãy highlight cụm giới hạn từ <strong class="px-1.5 py-0.5 rounded bg-yellow-200 text-slate-900">${escapeHtml(wordLimit)}</strong> trên đề bài để không điền thừa từ.`
                        : (subtype === 'summary_box' ? 'Đây là dạng chọn từ từ bảng cho sẵn (Gap-fill WITH A BOX). Kiểm tra xem các từ trong bảng có được dùng lại không.' : 'Kiểm tra kỹ yêu cầu giới hạn từ ở phần hướng dẫn đề bài và bôi vàng lại.'),
                    extra: ''
                },
                {
                    title: 'Bước 2: Phân tích chỗ trống & Dự đoán từ loại',
                    action: 'Trước khi đọc bài/nghe băng, nhìn vào cụm từ ngay trước và sau mỗi chỗ trống để đoán từ loại (Noun / Verb / Adj / Number) và dạng số ít/nhiều:',
                    extra: gapHtml
                },
                {
                    title: isListening ? 'Bước 3: Highlight từ khóa & Nghe tín hiệu chuyển ý' : 'Bước 3: Highlight từ khóa & Định vị vùng thông tin',
                    action: isListening
                        ? 'Bôi vàng các từ khóa xung quanh chỗ trống (tên riêng, số, danh từ chính). Khi nghe, chú ý từ đồng nghĩa (paraphrase) và bẫy tự sửa lại đáp án.'
                        : 'Bôi vàng các từ khóa xung quanh ô trống (tên riêng, năm tháng, động/tính từ chính) rồi quét nhanh đoạn văn để định vị câu chứa thông tin.',
                    extra: kwHtml
                },
                {
                    title: 'Bước 4: Điền đáp án & Kiểm tra lại',
                    action: subtype === 'summary_box'
                        ? 'Chọn đáp án khớp cả về nghĩa lẫn ngữ pháp với câu tóm tắt, sau đó bấm Check Answer.'
                        : 'Giữ nguyên chính tả từ gốc trong bài/audio, kiểm tra lại số ít/nhiều, thì và đảm bảo không vượt quá giới hạn từ.',
                    extra: ''
                }
            ];
        }

        if (type === 'tfng' || type === 'ynng') {
            const label = type === 'ynng' ? 'YES / NO / NOT GIVEN' : 'TRUE / FALSE / NOT GIVEN';
            const trapHtml = traps.length
                ? `<div class="mt-2 flex flex-wrap items-center gap-1.5"><span class="text-[11px] font-bold text-rose-700">⚠️ Từ khóa cực đoan dễ bẫy:</span>${traps.map(t => `<span class="px-2 py-0.5 rounded bg-rose-100 text-rose-900 border border-rose-300 text-xs font-bold">${escapeHtml(t)}</span>`).join('')}</div>`
                : '';
            const kwHtml = hard.length
                ? `<div class="mt-1.5 flex flex-wrap items-center gap-1.5"><span class="text-[11px] font-bold text-slate-600">Từ khóa định vị:</span>${hard.map(k => `<span class="px-2 py-0.5 rounded bg-yellow-100 text-yellow-900 border border-yellow-300 text-xs font-bold">${escapeHtml(k)}</span>`).join('')}</div>`
                : '';
            return [
                {
                    title: `Bước 1: Nắm chắc quy tắc ${label}`,
                    action: `<strong>${type === 'ynng' ? 'YES' : 'TRUE'}</strong> = Khớp hoàn toàn với bài · <strong>${type === 'ynng' ? 'NO' : 'FALSE'}</strong> = Trái ngược trực tiếp · <strong>NOT GIVEN</strong> = Không có thông tin để kết luận (cấm suy diễn!).`,
                    extra: ''
                },
                {
                    title: 'Bước 2: Highlight từ khóa & Từ dễ bẫy',
                    action: 'Hãy highlight 2 nhóm từ trong câu hỏi: (1) Từ khóa định vị để tìm đoạn văn, và (2) Từ chỉ mức độ/tần suất/so sánh (only, always, most, first...).',
                    extra: `${trapHtml}${kwHtml}`
                },
                {
                    title: 'Bước 3: Đối chiếu từng vế & Chốt đáp án',
                    action: 'Tách câu hỏi thành Chủ ngữ + Động từ + Tân ngữ/Mức độ rồi đối chiếu trực tiếp với câu trong bài (bấm 🔎 Locate nếu cần kiểm tra vùng thông tin).',
                    extra: ''
                }
            ];
        }

        if (type === 'multiple_choice') {
            const nIds = (q?.ids || []).length || 1;
            const nOpts = (q?.options || []).length || 4;
            return [
                {
                    title: `Bước 1: Highlight yêu cầu (${nIds}/${nOpts}) & Từ khóa câu dẫn`,
                    action: `Đánh dấu rõ số đáp án cần chọn (<strong>${nIds} đáp án trong ${nOpts} lựa chọn</strong>) và bôi vàng từ khóa chính ở câu hỏi (stem) trước khi đọc các lựa chọn.`,
                    extra: hard.length ? `<div class="mt-2 flex flex-wrap items-center gap-1.5"><span class="text-[11px] font-bold text-slate-600">Từ khóa gợi ý:</span>${hard.map(k => `<span class="px-2 py-0.5 rounded bg-yellow-100 text-yellow-900 border border-yellow-300 text-xs font-bold">${escapeHtml(k)}</span>`).join('')}</div>` : ''
                },
                {
                    title: isListening ? 'Bước 2: Nghe bắt ý chính & Cảnh giác Distractors' : 'Bước 2: Định vị đoạn văn & Hiểu ý gốc',
                    action: isListening
                        ? 'Trong Listening, người nói thường nhắc tới cả 3 lựa chọn nhưng sẽ bác bỏ hoặc sửa lại bằng từ nối tương phản (however, actually, instead...).'
                        : 'Tìm đúng đoạn văn chứa từ khóa câu dẫn, đọc hiểu câu gốc trong bài trước rồi mới so với các lựa chọn A/B/C/D.',
                    extra: ''
                },
                {
                    title: 'Bước 3: Loại trừ 3 loại bẫy (Elimination)',
                    action: 'Gạch bỏ các đáp án: (1) Trái ngược thông tin bài, (2) Không được nhắc đến (Not Given), (3) Lặp từ giống hệt bài nhưng sai quan hệ nghĩa.',
                    extra: ''
                }
            ];
        }

        if (type === 'matching_headings') {
            return [
                {
                    title: 'Bước 1: Đọc & Highlight từ khóa từng Heading',
                    action: 'Đọc toàn bộ danh sách Headings và gạch chân từ khóa phân biệt giữa các heading có chủ đề gần giống nhau.',
                    extra: ''
                },
                {
                    title: 'Bước 2: Đọc đoạn văn lấy Main Idea',
                    action: 'Đọc 1–2 câu đầu, 1–2 câu cuối và chú ý từ chuyển hướng (However, Yet, In contrast) để nắm ý bao trùm cả đoạn — tránh chọn theo 1 chi tiết nhỏ lẻ.',
                    extra: ''
                },
                {
                    title: 'Bước 3: Khớp Heading & Gạch bỏ phương án đã dùng',
                    action: 'Chọn Heading diễn đạt đúng nhất ý chính toàn đoạn rồi loại dần các Heading đã chọn.',
                    extra: ''
                }
            ];
        }

        if (subtype === 'matching_endings') {
            return [
                {
                    title: 'Bước 1: Đọc & Highlight từ khóa ở vế đầu (Stems)',
                    action: 'Gạch chân chủ ngữ và động từ chính ở các vế câu chưa hoàn chỉnh để định vị đoạn văn tương ứng.',
                    extra: ''
                },
                {
                    title: 'Bước 2: Dự đoán nghĩa & Kiểm tra ngữ pháp vế sau',
                    action: 'Tìm thông tin gốc trong bài rồi đối chiếu với danh sách vế kết (A–G), kiểm tra xem cấu trúc ngữ pháp khi ghép lại có trôi chảy không.',
                    extra: ''
                }
            ];
        }

        if (type === 'map_labelling_grid' || type === 'map_labelling_hotspots' || subtype === 'map_dnd') {
            return [
                {
                    title: 'Bước 1: Xác định điểm xuất phát & Phương hướng',
                    action: 'Tìm ngay vị trí bắt đầu (Entrance / You are here) và la bàn (North/South/East/West) trên bản đồ.',
                    extra: ''
                },
                {
                    title: 'Bước 2: Đọc trước các mốc đã có tên (Landmarks)',
                    action: 'Ghi nhớ các địa điểm đã ghi sẵn xung quanh các ô trống (ví dụ: Main Hall, Reception, Bridge) để bám theo đường đi trong audio.',
                    extra: ''
                },
                {
                    title: 'Bước 3: Nghe chỉ dẫn vị trí & Kéo/chọn đáp án',
                    action: 'Tập trung bắt các cụm giới từ chỉ vị trí: opposite, next to, just past, in the top-right corner, on the far side of...',
                    extra: ''
                }
            ];
        }

        return [
            {
                title: 'Bước 1: Highlight từ khóa ở câu hỏi & Danh sách lựa chọn',
                action: isListening
                    ? 'Đọc trước danh sách lựa chọn (A, B, C...) để nắm nhóm thông tin cần nghe và gạch chân từ khóa của từng câu hỏi.'
                    : 'Đánh dấu tên riêng/đối tượng (A, B, C...) trong bài đọc trước, sau đó highlight từ khóa ở từng câu hỏi để dễ đối chiếu paraphrase.',
                extra: hard.length ? `<div class="mt-2 flex flex-wrap items-center gap-1.5"><span class="text-[11px] font-bold text-slate-600">Từ khóa gợi ý:</span>${hard.map(k => `<span class="px-2 py-0.5 rounded bg-yellow-100 text-yellow-900 border border-yellow-300 text-xs font-bold">${escapeHtml(k)}</span>`).join('')}</div>` : ''
            },
            {
                title: 'Bước 2: Khoanh vùng & So chiếu Paraphrase',
                action: isListening
                    ? 'Lắng nghe tín hiệu chuyển sang từng mục câu hỏi và bắt cặp nghĩa tương đương với các lựa chọn trong hộp.'
                    : 'Đọc kỹ các câu xung quanh đối tượng đã khoanh vùng, so chiếu nghĩa tương đương (tránh bẫy trùng từ bề mặt).',
                extra: ''
            }
        ];
    }

    const activeStepByBlock = new Map();
    const completedByBlock = new Map();
    const openByBlock = new Map();

    root.renderQuestionScaffoldCoach = function(q, blockIdx, moduleName) {
        if (!['reading', 'listening'].includes(moduleName)) return '';
        const steps = getStepsForQuestion(q, moduleName);
        if (!steps.length) return '';

        const activeStep = activeStepByBlock.get(blockIdx) || 0;
        const completed = completedByBlock.get(blockIdx) || new Set();
        const isOpen = openByBlock.get(blockIdx) || false;
        const step = steps[Math.min(activeStep, steps.length - 1)];
        const isDone = completed.has(activeStep);

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
                            <span class="text-[11px] text-slate-500 italic">Mẹo: Bôi đen chữ trên đề bài/đoạn văn để highlight ghi nhớ.</span>
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
