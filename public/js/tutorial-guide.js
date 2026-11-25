(function() {
    const FEATURE_GUIDES = {
        student_target: {
            topic: 'dashboard',
            badge: 'Mục tiêu',
            title: '🎯 Mục tiêu IELTS (My IELTS Goal)',
            whatFor: 'Giúp bạn đặt mục tiêu Band điểm và ngày thi chính thức để hệ thống đếm ngược và giữ động lực mỗi ngày.',
            howToUse: 'Bấm nút <strong>Update Goals</strong> để nhập Band điểm mong muốn và ngày dự thi. Đồng hồ đếm ngược sẽ tự cập nhật trên màn hình chính.',
            selector: '#student-target-widget'
        },
        student_overview: {
            topic: 'dashboard',
            badge: 'Tổng quan',
            title: '📌 Overview (Tổng quan học tập)',
            whatFor: 'Hiển thị những việc cần ưu tiên nhất ngay khi bạn đăng nhập: bài tập sắp tới hạn, buổi học tiếp theo và lối tắt vào bài nhanh.',
            howToUse: 'Kiểm tra mục này đầu tiên mỗi ngày để không bỏ lỡ bài tập về nhà hoặc giờ học trực tuyến.',
            selector: '#student-overview-section'
        },
        student_class: {
            topic: 'dashboard',
            badge: 'Lớp học',
            title: '🏫 Class & Timetable (Lớp học & Thời khóa biểu)',
            whatFor: 'Quản lý lớp bạn đang theo học, lịch học sắp tới, tài liệu chuẩn bị trước buổi học và danh sách đề được giao.',
            howToUse: 'Nếu bạn học nhiều lớp, dùng ô chọn lớp để chuyển đổi. Bấm vào bài học trong lịch để mở tài liệu chuẩn bị hoặc vào lớp.',
            selector: '#student-class-overview-section'
        },
        streak_gems: {
            topic: 'dashboard',
            badge: 'Động lực',
            title: '🔥 Streak & 💎 Gems',
            whatFor: 'Ghi nhận chuỗi ngày học liên tục (Streak) và điểm thưởng Gems tích lũy khi hoàn thành bài tập.',
            howToUse: 'Đăng nhập và hoàn thành ít nhất 1 hoạt động mỗi ngày để giữ lửa Streak. Bấm vào biểu tượng 💎 Gems để mở cửa hàng đổi thưởng.',
            selector: '#streak-widget'
        },
        test_modes: {
            topic: 'dashboard',
            badge: '2 Chế độ',
            title: '⏱️ Time-Free vs Exam Mode',
            whatFor: 'Cho phép bạn chọn học chậm có công cụ hỗ trợ (<strong>Time-Free</strong>) hoặc thi thử bấm giờ như phòng thi thật (<strong>Exam Mode</strong>).',
            howToUse: 'Khi mới làm quen dạng bài hoặc muốn học sâu, luôn chọn <strong>Time-Free</strong> để dùng Hướng dẫn từng bước, Mind Map, Locate và Explanation. Khi đã vững, chọn <strong>Exam Mode</strong> để luyện áp lực thời gian.',
            selector: '#student-dashboard-content'
        },
        skimming: {
            topic: 'reading',
            badge: 'Reading Tool',
            title: '⚡ Thanh Skimming (Đọc lướt theo WPM)',
            whatFor: 'Dùng để luyện tốc độ đọc lướt (Words Per Minute) giống kỹ năng Skimming trong phòng thi, giúp mắt di chuyển đều và không bị đọc ngược lại.',
            howToUse: 'Điều chỉnh tốc độ <strong>WPM</strong> (khuyên dùng 200–250 WPM), bấm <strong>▶ PLAY</strong> để bắt đầu, <strong>⏸ PAUSE</strong> để dừng lại ghi chú, <strong>↺ RESTART</strong> để chạy lại từ đầu hoặc <strong>PREV / NEXT</strong> để nhảy đoạn.',
            selector: '#btn-skimming-play'
        },
        syntax_chunking: {
            topic: 'reading',
            badge: 'Reading Tool',
            title: '🧩 Syntax Chunking (Phân tích cấu trúc S / V / O)',
            whatFor: 'Giúp bạn tách những câu văn học thuật dài và khó thành từng cụm <strong>Chủ ngữ (S) – Động từ (V) – Tân ngữ (O)</strong> để hiểu đúng nghĩa gốc thay vì dịch từng từ.',
            howToUse: 'Bôi đen một cụm từ trong bài đọc bên trái, sau đó bấm nút màu tương ứng (<strong>Chủ ngữ - S</strong>, <strong>Động từ - V</strong>, <strong>Tân ngữ - O</strong>) để gắn nhãn trực quan.',
            selector: '[data-tutorial-target="syntax-chunking"]'
        },
        vocab_highlights: {
            topic: 'reading',
            badge: 'Reading Tool',
            title: '💡 Show Vocab & Grammar Highlights',
            whatFor: 'Bật hoặc tắt các cụm từ vựng học thuật và cấu trúc ngữ pháp được giáo viên đánh dấu sẵn ngay trong bài đọc.',
            howToUse: 'Tick chọn để vừa đọc bài vừa học từ vựng/ngữ pháp theo ngữ cảnh. Khi muốn mô phỏng đề thi trơn hoàn toàn, hãy bỏ tick.',
            selector: '[data-tutorial-target="vocab-highlights"]'
        },
        scaffold_coach: {
            topic: 'reading',
            badge: 'Chiến thuật',
            title: '🎯 Hướng dẫn từng bước (Scaffold Coach)',
            whatFor: 'Hướng dẫn quy trình làm bài chuẩn cho <strong>từng dạng câu hỏi cụ thể</strong> (như <em>Matching Headings, TFNG, Điền từ, Summary Box, Writing Task 1/2, Speaking Part 1/2/3</em>) kèm từ khóa gợi ý thật từ đề.',
            howToUse: 'Bấm <strong>Mở hướng dẫn ▼</strong>, đọc lần lượt Bước 1 → Bước 2 → ... và bấm <strong>Hoàn thành &amp; Sang bước tiếp</strong> sau khi thực hiện xong từng bước.',
            selector: '[data-scaffold-coach="0"]'
        },
        fifty_fifty: {
            topic: 'reading',
            badge: 'Hỗ trợ MCQ',
            title: '🪄 Nút 50/50',
            whatFor: 'Dùng cho câu hỏi Trắc nghiệm 1 đáp án (Multiple Choice) khi bạn phân vân — hệ thống sẽ gạch bỏ bớt một nửa số phương án sai.',
            howToUse: 'Hãy tự đọc và loại trừ trước, chỉ bấm <strong>🪄 50/50</strong> khi còn lưỡng lự giữa 2–3 lựa chọn để tăng độ chính xác.',
            selector: '[id^="btn-5050-"]'
        },
        check_answer: {
            topic: 'reading',
            badge: 'Kiểm tra nhanh',
            title: '✅ Nút Check Answer',
            whatFor: 'Dùng trong chế độ <strong>Time-Free</strong> để chấm ngay nhóm câu hỏi bạn vừa điền mà chưa cần nộp toàn bộ bài thi.',
            howToUse: 'Hoàn thành xong một nhóm câu hỏi (ví dụ Q1–5), bấm <strong>Check Answer</strong> để xem câu nào đúng/sai. Nếu sai, hãy bấm <strong>🔎 Locate</strong> và <strong>📖 Explanation</strong> để tự sửa trước khi sang nhóm tiếp theo.',
            selector: '[data-tutorial-target="check-answer"]'
        },
        locate: {
            topic: 'reading',
            badge: 'Tìm dẫn chứng',
            title: '🔎 Nút Locate',
            whatFor: 'Tự động cuộn bài đọc (hoặc Transcript bài nghe) tới đúng đoạn chứa đáp án của nhóm câu hỏi hiện tại.',
            howToUse: 'Sau khi làm xong hoặc khi làm sai một câu, bấm <strong>🔎 Locate</strong> để đối chiếu trực tiếp câu chữ gốc trong bài đọc với câu hỏi.',
            selector: '[data-tutorial-target="locate"]'
        },
        explanation: {
            topic: 'reading',
            badge: 'Lời giải chi tiết',
            title: '📖 Nút Explanation',
            whatFor: 'Mở khung giải thích chi tiết lý do vì sao đáp án đúng, chỉ ra cặp từ <em>Paraphrase</em> và bẫy gây nhiễu thường gặp.',
            howToUse: 'Nên tự làm và bấm <strong>Check Answer</strong> trước, sau đó mới mở <strong>📖 Explanation</strong> để hiểu bản chất và ghi nhớ cho lần sau.',
            selector: '[data-tutorial-target="explanation"]'
        },
        listening_audio: {
            topic: 'listening',
            badge: 'Listening Tool',
            title: '🎧 Thanh Audio & Nút Transcript ghim cố định',
            whatFor: 'Giữ bộ điều khiển phát âm thanh và nút mở lời thoại (Transcript) luôn cố định ở đầu màn hình khi bạn cuộn danh sách câu hỏi.',
            howToUse: 'Dùng thanh Audio để nghe, tua lại đoạn vừa lỡ. Trong chế độ Time-Free, bạn có thể bấm nút <strong>Transcript</strong> để vừa nghe vừa dò chữ khi luyện nghe sâu.',
            selector: '[data-tutorial-target="listening-audio"]'
        },
        mindmap: {
            topic: 'writing',
            badge: 'Lên ý tưởng',
            title: '🧠 Dynamic Mind Map (Sơ đồ tư duy)',
            whatFor: 'Giúp bạn lập dàn ý nhanh theo đúng cấu trúc chuẩn của <strong>Writing Task 1/2</strong> hoặc <strong>Speaking Part 1/2/3</strong>, đồng thời gợi ý từ vựng và cụm từ nối (Discourse Markers).',
            howToUse: 'Gõ ngắn gọn từ khóa ý tưởng vào từng nhánh (ví dụ: <em>Main vs Minor Details</em> cho Task 1, hoặc <em>Position → Main Point → Explanation</em> cho Task 2). Bấm vào chip từ vựng để chèn nhanh ý hay.',
            selector: '[data-dynamic-mindmap]'
        },
        scaffolded_writing: {
            topic: 'writing',
            badge: 'Cấu trúc bài viết',
            title: '🧱 Scaffolded Writing (Viết theo khối)',
            whatFor: 'Chia bài luận thành các khối rõ ràng (<em>Introduction, Overview/Thesis, Body 1, Body 2, Conclusion</em>) để bạn tập trung viết từng đoạn mà không bị rối bố cục.',
            howToUse: 'Viết lần lượt từng ô theo gợi ý tiêu đề của mỗi khối. Hệ thống sẽ tự động ghép tất cả các khối thành một bài hoàn chỉnh khi bạn bấm nộp bài.',
            selector: '[data-writing-scaffold-question]'
        },
        writing_analyzer: {
            topic: 'writing',
            badge: 'Phân tích bài viết',
            title: '📊 Bộ đếm từ & Writing Text Analyzer',
            whatFor: 'Kiểm tra số lượng từ theo thời gian thực (tối thiểu <strong>150 từ</strong> Task 1, <strong>250 từ</strong> Task 2) và tự động phát hiện lỗi lặp từ, mật độ từ nối, cấu trúc câu.',
            howToUse: 'Sau khi viết xong mỗi đoạn, nhìn xuống bảng phân tích bên dưới để thay thế các từ bị lặp nhiều lần bằng từ đồng nghĩa trước khi nộp.',
            selector: '[data-writing-analysis]'
        },
        sample_answer: {
            topic: 'writing',
            badge: 'Bài mẫu chuẩn',
            title: '👁️ Show / 🔊 Listen Sample Answer',
            whatFor: 'Cung cấp bài mẫu đạt Band cao kèm chế độ tô màu theo 4 tiêu chí chấm điểm của IELTS (<em>TA/TR, CC, LR, GRA</em> hoặc <em>FC, LR, GRA, PR</em>).',
            howToUse: 'Chỉ nên mở sau khi bạn đã tự hoàn thành dàn ý hoặc bản nháp của mình. Với Speaking, hãy bấm <strong>🔊 Listen to Sample Answer</strong> để nghe ngữ điệu và nhại lại (shadowing).',
            selector: '#sample-answer-toggle-label'
        },
        speaking_mic: {
            topic: 'speaking',
            badge: 'Luyện nói',
            title: '🎙️ Ghi âm Micro & Mô phỏng Part 2',
            whatFor: 'Cho phép bạn thu âm trực tiếp câu trả lời và nghe lại ngay trên trình duyệt để tự đánh giá độ trôi chảy, phát âm và ngữ pháp.',
            howToUse: 'Bấm vào nút <strong>🎙️ Micro</strong> để bắt đầu nói, bấm lại để dừng và nghe lại thanh Playback. Riêng Part 2 ở chế độ mô phỏng sẽ tự đếm ngược <strong>60 giây chuẩn bị</strong> rồi tự động ghi âm <strong>2 phút</strong>.',
            selector: '[id^="mic-btn-"], .speaking-simulation-panel'
        },
        review_panel: {
            topic: 'review',
            badge: 'Xem lại bài',
            title: '📖 Detailed Review (Xem lại & Chẩn đoán lỗi)',
            whatFor: 'Tổng hợp toàn bộ câu trả lời của bạn so với đáp án chuẩn, phân loại lỗi sai (như <em>Typo, sai số ít/số nhiều, dính bẫy nhiễu</em>) và hiển thị giải thích chi tiết.',
            howToUse: 'Đọc kỹ các câu sai ở cột phải, đối chiếu với bài đọc/transcript ở cột trái, lưu từ mới vào <strong>🗂️ Cards</strong> hoặc bấm <strong>↻ Retake</strong> để làm lại bài.',
            selector: '#review-right-pane'
        },
        flashcards: {
            topic: 'flashcards',
            badge: 'Từ vựng & Ngữ pháp',
            title: '🗂️ Study Cards (Flashcards)',
            whatFor: 'Giúp bạn ôn tập từ vựng và cấu trúc ngữ pháp của từng bài học dưới dạng thẻ lật tương tác.',
            howToUse: 'Chọn bộ thẻ ở danh sách phía trên, bấm vào thẻ để lật xem nghĩa tiếng Việt & ví dụ. Bấm <strong>＋ Add phrase</strong> để tự lưu thêm cụm từ bạn muốn nhớ.',
            selector: '#panel-fc-container'
        }
    };

    const TUTORIAL_TOPICS = [
        {
            id: 'dashboard',
            label: '🏠 Tổng quan',
            title: 'Hướng dẫn Student Portal',
            featureKeys: ['student_overview', 'student_class', 'student_target', 'streak_gems', 'test_modes']
        },
        {
            id: 'reading',
            label: '📖 Reading',
            title: 'Hướng dẫn các tính năng Reading',
            featureKeys: ['skimming', 'syntax_chunking', 'vocab_highlights', 'scaffold_coach', 'check_answer', 'locate', 'explanation', 'fifty_fifty']
        },
        {
            id: 'listening',
            label: '🎧 Listening',
            title: 'Hướng dẫn các tính năng Listening',
            featureKeys: ['listening_audio', 'scaffold_coach', 'check_answer', 'locate', 'explanation']
        },
        {
            id: 'writing',
            label: '✍️ Writing',
            title: 'Hướng dẫn các tính năng Writing',
            featureKeys: ['mindmap', 'scaffold_coach', 'scaffolded_writing', 'writing_analyzer', 'sample_answer']
        },
        {
            id: 'speaking',
            label: '🎙️ Speaking',
            title: 'Hướng dẫn các tính năng Speaking',
            featureKeys: ['mindmap', 'scaffold_coach', 'speaking_mic', 'sample_answer']
        },
        {
            id: 'review',
            label: '📊 Review',
            title: 'Hướng dẫn Xem lại bài (Review)',
            featureKeys: ['review_panel']
        },
        {
            id: 'flashcards',
            label: '🗂️ Study Cards',
            title: 'Hướng dẫn học Study Cards',
            featureKeys: ['flashcards']
        }
    ];

    let activeTopicId = 'dashboard';
    let activeStepIdx = 0;
    let highlightedEl = null;
    let customSpotlightEl = null;

    function ensureSpotlightStyles() {
        if (typeof document === 'undefined' || document.getElementById('tutorial-spotlight-styles')) return;
        const style = document.createElement('style');
        style.id = 'tutorial-spotlight-styles';
        style.textContent = `
            @keyframes tutorialSpotlightPulse {
                0%, 100% { box-shadow: 0 0 0 4px #fbbf24, 0 0 24px rgba(251, 191, 36, 0.7); }
                50% { box-shadow: 0 0 0 6px #f59e0b, 0 0 36px rgba(245, 158, 11, 0.95); }
            }
            .tutorial-spotlight-active {
                position: relative !important;
                z-index: 940 !important;
                transform: scale(1.018);
                border-radius: 12px;
                transition: transform 0.25s ease, box-shadow 0.25s ease;
                animation: tutorialSpotlightPulse 1.6s infinite ease-in-out;
                background-color: inherit;
            }
        `;
        document.head.appendChild(style);
    }

    function clearSpotlight() {
        if (highlightedEl) {
            highlightedEl.classList.remove('tutorial-spotlight-active');
            highlightedEl = null;
        }
        customSpotlightEl = null;
    }

    function resolveVisibleTarget(selector) {
        if (!selector || typeof document === 'undefined') return null;
        try {
            const matches = document.querySelectorAll(selector);
            for (const el of matches) {
                if (el && el.offsetParent !== null) return el;
            }
        } catch (e) {}
        return null;
    }

    function applySpotlight(selector, fallbackEl) {
        clearSpotlight();
        ensureSpotlightStyles();
        const el = resolveVisibleTarget(selector) || (fallbackEl && fallbackEl.offsetParent !== null ? fallbackEl : null);
        if (!el) return;
        highlightedEl = el;
        el.classList.add('tutorial-spotlight-active');
        if (typeof el.scrollIntoView === 'function') {
            el.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'nearest' });
        }
    }

    function isVisible(id) {
        if (typeof document === 'undefined') return false;
        const el = document.getElementById(id);
        return Boolean(el && !el.classList.contains('hidden'));
    }

    function isStudentContextActive() {
        if (typeof document === 'undefined') return false;
        if (isVisible('editor-ui')) return false;
        return isVisible('start-screen') || isVisible('exam-ui') || isVisible('review-ui') || isVisible('student-fc-panel');
    }

    function detectCurrentTutorialTopic() {
        if (isVisible('student-fc-panel')) return 'flashcards';
        if (isVisible('review-ui')) return 'review';
        if (isVisible('exam-ui')) {
            const mod = typeof APP_DATA !== 'undefined' ? String(APP_DATA?.module || '').toLowerCase() : '';
            if (['reading', 'listening', 'writing', 'speaking'].includes(mod)) return mod;
            return 'reading';
        }
        return 'dashboard';
    }

    function ensureModalElement() {
        if (typeof document === 'undefined') return null;
        let modal = document.getElementById('app-tutorial-modal');
        if (modal) return modal;

        modal = document.createElement('div');
        modal.id = 'app-tutorial-modal';
        modal.className = 'hidden fixed inset-0 z-[950] bg-slate-900/65 backdrop-blur-[2px] flex items-end sm:items-center justify-center p-3 sm:p-4 animate-fade-in';
        modal.setAttribute('role', 'dialog');
        modal.setAttribute('aria-modal', 'true');
        modal.setAttribute('aria-labelledby', 'app-tutorial-title');
        modal.addEventListener('click', (event) => {
            if (event.target === modal) window.closeAppTutorial();
        });
        document.body.appendChild(modal);
        return modal;
    }

    function renderTutorialModal() {
        const modal = ensureModalElement();
        if (!modal) return;
        const topic = TUTORIAL_TOPICS.find(t => t.id === activeTopicId) || TUTORIAL_TOPICS[0];
        const featureKeys = topic.featureKeys || [];
        const safeStepIdx = Math.max(0, Math.min(activeStepIdx, featureKeys.length - 1));
        activeStepIdx = safeStepIdx;
        const featureKey = featureKeys[safeStepIdx];
        const step = FEATURE_GUIDES[featureKey] || FEATURE_GUIDES.student_overview;
        const progressPct = featureKeys.length ? Math.round(((safeStepIdx + 1) / featureKeys.length) * 100) : 100;

        const topicTabsHtml = TUTORIAL_TOPICS.map(t => {
            const isCurrent = t.id === topic.id;
            return `<button type="button" onclick="window.selectAppTutorialTopic('${t.id}')" class="px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition border ${isCurrent ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm' : 'bg-slate-100 text-slate-600 border-slate-200 hover:bg-slate-200'}">${t.label}</button>`;
        }).join('');

        const stepDotsHtml = featureKeys.map((key, idx) => {
            const isCurrent = idx === safeStepIdx;
            const isDone = idx < safeStepIdx;
            return `<button type="button" onclick="window.selectAppTutorialStep(${idx})" class="px-2.5 py-1 rounded-lg text-xs font-bold border transition ${isCurrent ? 'bg-amber-500 text-white border-amber-500 shadow-sm' : (isDone ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-white text-slate-500 border-slate-200 hover:border-indigo-300')}">${isDone ? '✓' : idx + 1}</button>`;
        }).join('');

        modal.innerHTML = `
            <div class="bg-white rounded-2xl shadow-2xl border-2 border-amber-300/80 w-full max-w-xl overflow-hidden animate-scale-up flex flex-col max-h-[85vh]">
                <div class="bg-gradient-to-r from-indigo-700 via-blue-700 to-sky-600 px-5 py-3.5 text-white flex items-center justify-between gap-3">
                    <div class="flex items-center gap-2.5 min-w-0">
                        <span class="w-8 h-8 rounded-full bg-amber-400 text-slate-900 font-serif font-black text-base flex items-center justify-center shadow shrink-0">i</span>
                        <div class="min-w-0">
                            <div class="text-[10px] font-black uppercase tracking-widest text-amber-200">Student Guide • Hướng dẫn tính năng</div>
                            <h2 id="app-tutorial-title" class="text-sm sm:text-base font-black truncate">${topic.title}</h2>
                        </div>
                    </div>
                    <button type="button" onclick="window.closeAppTutorial()" class="w-8 h-8 rounded-xl bg-white/15 hover:bg-white/25 text-white font-black text-xl flex items-center justify-center transition shrink-0" aria-label="Đóng hướng dẫn">&times;</button>
                </div>

                <div class="px-4 pt-2.5 pb-2 bg-slate-50 border-b border-slate-200 flex items-center gap-1.5 overflow-x-auto hide-scrollbar">
                    ${topicTabsHtml}
                </div>

                <div class="h-1.5 bg-slate-200 w-full">
                    <div class="h-full bg-gradient-to-r from-indigo-500 to-amber-500 transition-all duration-300" style="width:${progressPct}%"></div>
                </div>

                <div class="p-4 sm:p-5 overflow-y-auto space-y-3.5">
                    <div class="flex flex-wrap items-center justify-between gap-2">
                        <div class="flex flex-wrap gap-1">${stepDotsHtml}</div>
                        <span class="text-xs font-black text-indigo-700 bg-indigo-50 border border-indigo-200 px-2.5 py-0.5 rounded-full">${safeStepIdx + 1} / ${featureKeys.length}</span>
                    </div>

                    <div class="rounded-2xl border border-indigo-100 bg-indigo-50/40 p-4 space-y-3">
                        <div class="flex flex-wrap items-center gap-2">
                            <span class="text-[11px] font-black uppercase tracking-wider px-2.5 py-0.5 rounded-full bg-amber-100 text-amber-800 border border-amber-200">${step.badge}</span>
                            <h3 class="text-base sm:text-lg font-black text-slate-900">${step.title}</h3>
                        </div>
                        <div class="rounded-xl bg-white border border-slate-200 p-3 text-xs sm:text-sm text-slate-700 leading-relaxed">
                            <div class="text-[11px] font-black uppercase tracking-wider text-indigo-700 mb-1">🎯 Dùng để làm gì?</div>
                            <div>${step.whatFor}</div>
                        </div>
                        <div class="rounded-xl bg-white border border-emerald-200 p-3 text-xs sm:text-sm text-emerald-950 leading-relaxed">
                            <div class="text-[11px] font-black uppercase tracking-wider text-emerald-700 mb-1">💡 Cách dùng hiệu quả</div>
                            <div>${step.howToUse}</div>
                        </div>
                    </div>
                </div>

                <div class="px-4 py-3 bg-slate-50 border-t border-slate-200 flex items-center justify-between gap-3">
                    <button type="button" onclick="window.prevAppTutorialStep()" ${safeStepIdx === 0 ? 'disabled' : ''} class="px-3.5 py-2 rounded-xl text-xs font-bold border border-slate-300 bg-white text-slate-700 hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed transition">&larr; Trước</button>
                    <div class="text-[11px] text-slate-400 hidden sm:block">← / → chuyển mục • ESC đóng</div>
                    ${safeStepIdx < featureKeys.length - 1
                        ? `<button type="button" onclick="window.nextAppTutorialStep()" class="px-4 py-2 rounded-xl text-xs font-black bg-indigo-600 hover:bg-indigo-700 text-white shadow-sm transition">Tiếp theo &rarr;</button>`
                        : `<button type="button" onclick="window.closeAppTutorial()" class="px-4 py-2 rounded-xl text-xs font-black bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm transition">Đã hiểu ✓</button>`}
                </div>
            </div>
        `;

        modal.classList.remove('hidden');
        applySpotlight(step.selector, customSpotlightEl);
    }

    function makeInfoButton(featureKey, titleText) {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.setAttribute('data-info-badge-key', featureKey);
        btn.className = 'inline-flex items-center justify-center w-5 h-5 rounded-full bg-amber-400 hover:bg-amber-300 text-slate-900 font-serif font-black text-[11px] leading-none shadow-sm border border-amber-500/60 hover:scale-110 transition cursor-pointer shrink-0 ml-1.5 align-middle';
        btn.title = titleText || 'Xem hướng dẫn tính năng này';
        btn.setAttribute('aria-label', titleText || 'Xem hướng dẫn tính năng này');
        btn.textContent = 'i';
        btn.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            const targetBox = btn.closest('[data-scaffold-coach], [data-dynamic-mindmap], [data-writing-scaffold-question], [data-writing-analysis], section, .rounded-xl, .rounded-2xl') || btn.parentElement;
            window.openFeatureTutorial(featureKey, targetBox);
        });
        return btn;
    }

    function injectBadgeOnce(container, featureKey, titleText) {
        if (!container || container.querySelector(`[data-info-badge-key="${featureKey}"]`)) return;
        container.appendChild(makeInfoButton(featureKey, titleText));
    }

    function attachStudentInfoBadges() {
        if (typeof document === 'undefined' || !isStudentContextActive()) return;

        // Student Dashboard sections
        if (isVisible('start-screen')) {
            const overviewHeading = document.querySelector('#student-overview-section h2');
            injectBadgeOnce(overviewHeading, 'student_overview', 'Hướng dẫn mục Tổng quan');

            const classHeading = document.querySelector('#student-class-overview-section h2');
            injectBadgeOnce(classHeading, 'student_class', 'Hướng dẫn mục Lớp học');

            const targetHeading = document.querySelector('#student-target-widget h3');
            injectBadgeOnce(targetHeading, 'student_target', 'Hướng dẫn Mục tiêu IELTS');

            const streakWidget = document.getElementById('streak-widget');
            if (streakWidget && !streakWidget.querySelector('[data-info-badge-key="streak_gems"]')) {
                streakWidget.appendChild(makeInfoButton('streak_gems', 'Hướng dẫn Streak & Gems'));
            }
        }

        // Exam / Practice Player features
        if (isVisible('exam-ui')) {
            const mod = typeof APP_DATA !== 'undefined' ? String(APP_DATA?.module || '').toLowerCase() : '';

            // Reading Skimming Bar
            const skimPlay = document.getElementById('btn-skimming-play');
            if (skimPlay && skimPlay.parentElement) {
                injectBadgeOnce(skimPlay.parentElement, 'skimming', 'Hướng dẫn thanh Skimming WPM');
            }

            // Reading Syntax Chunking & Vocab/Grammar checkboxes
            const passage = document.getElementById('passage-container');
            if (passage) {
                passage.querySelectorAll('strong').forEach(el => {
                    if (/Syntax Chunking/i.test(el.textContent || '')) {
                        const row = el.parentElement;
                        if (row) {
                            row.setAttribute('data-tutorial-target', 'syntax-chunking');
                            injectBadgeOnce(row, 'syntax_chunking', 'Hướng dẫn Syntax Chunking S/V/O');
                        }
                    }
                });
                passage.querySelectorAll('label').forEach(el => {
                    if (/Show Vocab Highlights/i.test(el.textContent || '')) {
                        const bar = el.parentElement;
                        if (bar) {
                            bar.setAttribute('data-tutorial-target', 'vocab-highlights');
                            injectBadgeOnce(bar, 'vocab_highlights', 'Hướng dẫn Highlight Từ vựng & Ngữ pháp');
                        }
                    }
                });
            }

            // Listening Sticky Audio Bar
            if (mod === 'listening') {
                const audioBar = document.querySelector('#questions-container .sticky, #exam-ui audio')?.closest('.sticky, .rounded-xl, .bg-blue-50\\/95');
                if (audioBar) {
                    audioBar.setAttribute('data-tutorial-target', 'listening-audio');
                    injectBadgeOnce(audioBar, 'listening_audio', 'Hướng dẫn thanh Audio & Transcript');
                }
            }

            // Writing & Speaking Tools
            const mindMap = document.querySelector('[data-dynamic-mindmap] h3, [data-dynamic-mindmap] .font-black');
            if (mindMap) injectBadgeOnce(mindMap, 'mindmap', 'Hướng dẫn Dynamic Mind Map');

            const scaffoldWritingHeader = document.querySelector('[data-writing-scaffold-question] .scaffolded-writing__header > div');
            if (scaffoldWritingHeader) injectBadgeOnce(scaffoldWritingHeader, 'scaffolded_writing', 'Hướng dẫn Viết theo khối');

            const analyzerHeader = document.querySelector('[data-writing-analysis]');
            if (analyzerHeader && analyzerHeader.firstElementChild) {
                injectBadgeOnce(analyzerHeader.firstElementChild, 'writing_analyzer', 'Hướng dẫn Bộ phân tích bài viết');
            }

            const sampleLabel = document.getElementById('sample-answer-toggle-label');
            if (sampleLabel && sampleLabel.closest('div')) {
                injectBadgeOnce(sampleLabel.closest('div'), 'sample_answer', 'Hướng dẫn xem Bài mẫu & Tiêu chí');
            }

            // Speaking Mic
            document.querySelectorAll('[id^="mic-status-"]').forEach(el => {
                injectBadgeOnce(el, 'speaking_mic', 'Hướng dẫn ghi âm Micro');
            });

            // Question-level Scaffold Coach & Action Buttons
            document.querySelectorAll('[data-scaffold-coach]').forEach(el => {
                const header = el.querySelector('.flex.items-center.gap-2');
                if (header) injectBadgeOnce(header, 'scaffold_coach', 'Hướng dẫn cách dùng khung Hướng dẫn từng bước');
            });

            // Tag Check Answer, Locate, Explanation buttons
            document.querySelectorAll('#questions-container button').forEach(btn => {
                const txt = (btn.textContent || '').trim();
                const onclickAttr = btn.getAttribute('onclick') || '';
                if (/quickCheckAnswer/.test(onclickAttr) && !btn.hasAttribute('data-tutorial-target')) {
                    btn.setAttribute('data-tutorial-target', 'check-answer');
                } else if (/locateQuestion/.test(onclickAttr) && !btn.hasAttribute('data-tutorial-target')) {
                    btn.setAttribute('data-tutorial-target', 'locate');
                } else if (/toggleInlineExplanation/.test(onclickAttr) && !btn.hasAttribute('data-tutorial-target')) {
                    btn.setAttribute('data-tutorial-target', 'explanation');
                }
            });

            document.querySelectorAll('#questions-container [data-tutorial-target="check-answer"]').forEach(btn => {
                const row = btn.parentElement;
                if (row && !row.querySelector('[data-info-badge-key="check_answer"]')) {
                    row.appendChild(makeInfoButton('check_answer', 'Hướng dẫn Check Answer / Locate / Explanation'));
                }
            });
        }
    }

    let badgeTimer = null;
    function scheduleBadgeAttach() {
        if (badgeTimer) clearTimeout(badgeTimer);
        badgeTimer = setTimeout(attachStudentInfoBadges, 120);
    }

    function handleTutorialKeydown(event) {
        const modal = typeof document !== 'undefined' ? document.getElementById('app-tutorial-modal') : null;
        if (!modal || modal.classList.contains('hidden')) return;
        if (event.key === 'Escape') {
            window.closeAppTutorial();
        } else if (event.key === 'ArrowRight') {
            window.nextAppTutorialStep();
        } else if (event.key === 'ArrowLeft') {
            window.prevAppTutorialStep();
        }
    }

    const root = typeof window !== 'undefined' ? window : globalThis;

    root.renderInfoBadgeHtml = function(featureKey, titleText) {
        const safeKey = String(featureKey || '').replace(/'/g, '');
        const safeTitle = String(titleText || 'Xem hướng dẫn tính năng này').replace(/"/g, '&quot;');
        return `<button type="button" data-info-badge-key="${safeKey}" onclick="event.stopPropagation(); window.openFeatureTutorial('${safeKey}', this)" class="inline-flex items-center justify-center w-5 h-5 rounded-full bg-amber-400 hover:bg-amber-300 text-slate-900 font-serif font-black text-[11px] leading-none shadow-sm border border-amber-500/60 hover:scale-110 transition cursor-pointer shrink-0 ml-1" title="${safeTitle}" aria-label="${safeTitle}">i</button>`;
    };

    root.openFeatureTutorial = function(featureKey, triggerEl) {
        const guide = FEATURE_GUIDES[featureKey];
        if (!guide) {
            root.openAppTutorial();
            return;
        }
        activeTopicId = guide.topic;
        const topic = TUTORIAL_TOPICS.find(t => t.id === activeTopicId) || TUTORIAL_TOPICS[0];
        const idx = topic.featureKeys.indexOf(featureKey);
        activeStepIdx = idx >= 0 ? idx : 0;
        customSpotlightEl = triggerEl || null;
        renderTutorialModal();
    };

    root.openAppTutorial = function(topicKey) {
        activeTopicId = topicKey || detectCurrentTutorialTopic();
        activeStepIdx = 0;
        customSpotlightEl = null;
        renderTutorialModal();
    };

    root.closeAppTutorial = function() {
        clearSpotlight();
        const modal = typeof document !== 'undefined' ? document.getElementById('app-tutorial-modal') : null;
        if (modal) modal.classList.add('hidden');
    };

    root.selectAppTutorialTopic = function(topicKey) {
        activeTopicId = topicKey;
        activeStepIdx = 0;
        customSpotlightEl = null;
        renderTutorialModal();
    };

    root.selectAppTutorialStep = function(idx) {
        activeStepIdx = idx;
        customSpotlightEl = null;
        renderTutorialModal();
    };

    root.nextAppTutorialStep = function() {
        const topic = TUTORIAL_TOPICS.find(t => t.id === activeTopicId) || TUTORIAL_TOPICS[0];
        if (activeStepIdx < topic.featureKeys.length - 1) {
            activeStepIdx += 1;
            customSpotlightEl = null;
            renderTutorialModal();
        }
    };

    root.prevAppTutorialStep = function() {
        if (activeStepIdx > 0) {
            activeStepIdx -= 1;
            customSpotlightEl = null;
            renderTutorialModal();
        }
    };

    if (typeof document !== 'undefined') {
        document.addEventListener('keydown', handleTutorialKeydown);
        document.addEventListener('DOMContentLoaded', () => {
            attachStudentInfoBadges();
            if (typeof MutationObserver !== 'undefined' && document.body) {
                const observer = new MutationObserver(scheduleBadgeAttach);
                observer.observe(document.body, { childList: true, subtree: true });
            }
        });
    }

    if (typeof module !== 'undefined' && module.exports) {
        module.exports = {
            FEATURE_GUIDES,
            TUTORIAL_TOPICS,
            openAppTutorial: root.openAppTutorial,
            openFeatureTutorial: root.openFeatureTutorial,
            closeAppTutorial: root.closeAppTutorial
        };
    }
})();
