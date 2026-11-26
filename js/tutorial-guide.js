(function() {
    const t = (en, vi) => (typeof window !== 'undefined' && typeof window.studentText === 'function' ? window.studentText(en, vi) : en);

    function getFeatureGuides() {
        return {
            student_target: {
                topic: 'dashboard',
                badge: t('Goal', 'Mục tiêu'),
                title: t('🎯 My IELTS Goal', '🎯 Mục tiêu IELTS (My IELTS Goal)'),
                whatFor: t('Lets you set your target Band score and official exam date so the dashboard counts down and keeps you motivated daily.', 'Giúp bạn đặt mục tiêu Band điểm và ngày thi chính thức để hệ thống đếm ngược và giữ động lực mỗi ngày.'),
                howToUse: t('Click <strong>Update Goals</strong> to enter your target Band score and exam date. The countdown will update automatically on your home screen.', 'Bấm nút <strong>Update Goals</strong> để nhập Band điểm mong muốn và ngày dự thi. Đồng hồ đếm ngược sẽ tự cập nhật trên màn hình chính.'),
                selector: '#student-target-widget'
            },
            student_overview: {
                topic: 'dashboard',
                badge: t('Overview', 'Tổng quan'),
                title: t('📌 Learning Overview', '📌 Overview (Tổng quan học tập)'),
                whatFor: t('Shows your top priorities as soon as you sign in: upcoming assignments, next class session, and quick-start shortcuts.', 'Hiển thị những việc cần ưu tiên nhất ngay khi bạn đăng nhập: bài tập sắp tới hạn, buổi học tiếp theo và lối tắt vào bài nhanh.'),
                howToUse: t('Check this section first every day so you never miss homework or live class time.', 'Kiểm tra mục này đầu tiên mỗi ngày để không bỏ lỡ bài tập về nhà hoặc giờ học trực tuyến.'),
                selector: '#student-overview-section'
            },
            student_class: {
                topic: 'dashboard',
                badge: t('Classes', 'Lớp học'),
                title: t('🏫 Class & Timetable', '🏫 Class & Timetable (Lớp học & Thời khóa biểu)'),
                whatFor: t('Manages your enrolled class, upcoming schedule, pre-class preparation materials, and assigned tests.', 'Quản lý lớp bạn đang theo học, lịch học sắp tới, tài liệu chuẩn bị trước buổi học và danh sách đề được giao.'),
                howToUse: t('If you are in multiple classes, use the class switcher. Click any session in the timetable to open prep materials or join class.', 'Nếu bạn học nhiều lớp, dùng ô chọn lớp để chuyển đổi. Bấm vào bài học trong lịch để mở tài liệu chuẩn bị hoặc vào lớp.'),
                selector: '#student-class-overview-section'
            },
            streak_gems: {
                topic: 'dashboard',
                badge: t('Motivation', 'Động lực'),
                title: t('🔥 Streak & 💎 Gems', '🔥 Streak & 💎 Gems'),
                whatFor: t('Tracks your daily study streak and Gems earned from completing assignments and practice.', 'Ghi nhận chuỗi ngày học liên tục (Streak) và điểm thưởng Gems tích lũy khi hoàn thành bài tập.'),
                howToUse: t('Sign in and complete at least 1 activity per day to keep your Streak alive. Click 💎 Gems to open the reward shop.', 'Đăng nhập và hoàn thành ít nhất 1 hoạt động mỗi ngày để giữ lửa Streak. Bấm vào biểu tượng 💎 Gems để mở cửa hàng đổi thưởng.'),
                selector: '#streak-widget'
            },
            test_modes: {
                topic: 'dashboard',
                badge: t('2 Modes', '2 Chế độ'),
                title: t('⏱️ Time-Free vs Exam Mode', '⏱️ Time-Free vs Exam Mode'),
                whatFor: t('Lets you practice untimed with full study tools (<strong>Time-Free</strong>) or simulate real exam timing (<strong>Exam Mode</strong>).', 'Cho phép bạn chọn học chậm có công cụ hỗ trợ (<strong>Time-Free</strong>) hoặc thi thử bấm giờ như phòng thi thật (<strong>Exam Mode</strong>).'),
                howToUse: t('When learning a new question type or studying deeply, choose <strong>Time-Free</strong> for Step-by-Step Guide, Mind Map, Locate, and Explanation. When ready, switch to <strong>Exam Mode</strong>.', 'Khi mới làm quen dạng bài hoặc muốn học sâu, luôn chọn <strong>Time-Free</strong> để dùng Hướng dẫn từng bước, Mind Map, Locate và Explanation. Khi đã vững, chọn <strong>Exam Mode</strong> để luyện áp lực thời gian.'),
                selector: '#student-dashboard-content'
            },
            skimming: {
                topic: 'reading',
                badge: t('Reading Tool', 'Reading Tool'),
                title: t('⚡ Skimming Bar (WPM)', '⚡ Thanh Skimming (Đọc lướt theo WPM)'),
                whatFor: t('Trains your skimming speed (Words Per Minute) so your eyes move steadily forward without regressing.', 'Dùng để luyện tốc độ đọc lướt (Words Per Minute) giống kỹ năng Skimming trong phòng thi, giúp mắt di chuyển đều và không bị đọc ngược lại.'),
                howToUse: t('Adjust <strong>WPM</strong> (200–250 WPM recommended), click <strong>▶ PLAY</strong> to start, <strong>⏸ PAUSE</strong> to take notes, <strong>↺ RESTART</strong>, or <strong>PREV / NEXT</strong> to jump paragraphs.', 'Điều chỉnh tốc độ <strong>WPM</strong> (khuyên dùng 200–250 WPM), bấm <strong>▶ PLAY</strong> để bắt đầu, <strong>⏸ PAUSE</strong> để dừng lại ghi chú, <strong>↺ RESTART</strong> để chạy lại từ đầu hoặc <strong>PREV / NEXT</strong> để nhảy đoạn.'),
                selector: '#btn-skimming-play'
            },
            vocab_highlights: {
                topic: 'reading',
                badge: t('Reading Tool', 'Reading Tool'),
                title: t('💡 Show Vocab & Grammar Highlights', '💡 Show Vocab & Grammar Highlights'),
                whatFor: t('Toggles teacher-marked academic vocabulary and grammar structures directly inside the reading passage.', 'Bật hoặc tắt các cụm từ vựng học thuật và cấu trúc ngữ pháp được giáo viên đánh dấu sẵn ngay trong bài đọc.'),
                howToUse: t('Keep checked to learn vocabulary/grammar in context. Uncheck when you want a clean, exam-like passage.', 'Tick chọn để vừa đọc bài vừa học từ vựng/ngữ pháp theo ngữ cảnh. Khi muốn mô phỏng đề thi trơn hoàn toàn, hãy bỏ tick.'),
                selector: '[data-tutorial-target="vocab-highlights"]'
            },
            scaffold_coach: {
                topic: 'reading',
                badge: t('Strategy', 'Chiến thuật'),
                title: t('🎯 Step-by-Step Guide (Scaffold Coach)', '🎯 Hướng dẫn từng bước (Scaffold Coach)'),
                whatFor: t('Provides a structured workflow for <strong>each specific question type</strong> (<em>Matching Headings, TFNG, Gap-fill, Summary Box, Writing Task 1/2, Speaking Part 1/2/3</em>) with real keywords extracted from the prompt.', 'Hướng dẫn quy trình làm bài chuẩn cho <strong>từng dạng câu hỏi cụ thể</strong> (như <em>Matching Headings, TFNG, Điền từ, Summary Box, Writing Task 1/2, Speaking Part 1/2/3</em>) kèm từ khóa gợi ý thật từ đề.'),
                howToUse: t('Click <strong>Open guide ▼</strong>, follow Step 1 → Step 2 → ..., and click <strong>Complete &amp; Next step</strong> as you finish each stage.', 'Bấm <strong>Mở hướng dẫn ▼</strong>, đọc lần lượt Bước 1 → Bước 2 → ... và bấm <strong>Hoàn thành &amp; Sang bước tiếp</strong> sau khi thực hiện xong từng bước.'),
                selector: '[data-scaffold-coach="0"]'
            },
            fifty_fifty: {
                topic: 'reading',
                badge: t('MCQ Helper', 'Hỗ trợ MCQ'),
                title: t('🪄 50/50 Button', '🪄 Nút 50/50'),
                whatFor: t('For single-answer Multiple Choice questions when you are unsure — eliminates half of the incorrect options.', 'Dùng cho câu hỏi Trắc nghiệm 1 đáp án (Multiple Choice) khi bạn phân vân — hệ thống sẽ gạch bỏ bớt một nửa số phương án sai.'),
                howToUse: t('Try eliminating options yourself first, and use <strong>🪄 50/50</strong> only when deciding between 2–3 choices.', 'Hãy tự đọc và loại trừ trước, chỉ bấm <strong>🪄 50/50</strong> khi còn lưỡng lự giữa 2–3 lựa chọn để tăng độ chính xác.'),
                selector: '[id^="btn-5050-"]'
            },
            check_answer: {
                topic: 'reading',
                badge: t('Quick Check', 'Kiểm tra nhanh'),
                title: t('✅ Check Answer Button', '✅ Nút Check Answer'),
                whatFor: t('Available in <strong>Time-Free</strong> mode to check a question group immediately without submitting the whole test.', 'Dùng trong chế độ <strong>Time-Free</strong> để chấm ngay nhóm câu hỏi bạn vừa điền mà chưa cần nộp toàn bộ bài thi.'),
                howToUse: t('Finish a question group (e.g., Q1–5), click <strong>Check Answer</strong>, then use <strong>🔎 Locate</strong> and <strong>📖 Explanation</strong> to review mistakes.', 'Hoàn thành xong một nhóm câu hỏi (ví dụ Q1–5), bấm <strong>Check Answer</strong> để xem câu nào đúng/sai. Nếu sai, hãy bấm <strong>🔎 Locate</strong> và <strong>📖 Explanation</strong> để tự sửa trước khi sang nhóm tiếp theo.'),
                selector: '[data-tutorial-target="check-answer"]'
            },
            locate: {
                topic: 'reading',
                badge: t('Find Evidence', 'Tìm dẫn chứng'),
                title: t('🔎 Locate Button', '🔎 Nút Locate'),
                whatFor: t('Automatically scrolls the reading passage (or listening transcript) to the exact evidence for that question group.', 'Tự động cuộn bài đọc (hoặc Transcript bài nghe) tới đúng đoạn chứa đáp án của nhóm câu hỏi hiện tại.'),
                howToUse: t('After answering or checking, click <strong>🔎 Locate</strong> to compare the exact source sentence with the question.', 'Sau khi làm xong hoặc khi làm sai một câu, bấm <strong>🔎 Locate</strong> để đối chiếu trực tiếp câu chữ gốc trong bài đọc với câu hỏi.'),
                selector: '[data-tutorial-target="locate"]'
            },
            explanation: {
                topic: 'reading',
                badge: t('Detailed Solution', 'Lời giải chi tiết'),
                title: t('📖 Explanation Button', '📖 Nút Explanation'),
                whatFor: t('Opens a detailed explanation showing why the answer is correct, highlighting <em>paraphrases</em> and common traps.', 'Mở khung giải thích chi tiết lý do vì sao đáp án đúng, chỉ ra cặp từ <em>Paraphrase</em> và bẫy gây nhiễu thường gặp.'),
                howToUse: t('Attempt the question and click <strong>Check Answer</strong> first, then open <strong>📖 Explanation</strong> to lock in the takeaway.', 'Nên tự làm và bấm <strong>Check Answer</strong> trước, sau đó mới mở <strong>📖 Explanation</strong> để hiểu bản chất và ghi nhớ cho lần sau.'),
                selector: '[data-tutorial-target="explanation"]'
            },
            listening_audio: {
                topic: 'listening',
                badge: t('Listening Tool', 'Listening Tool'),
                title: t('🎧 Sticky Audio Bar & Transcript', '🎧 Thanh Audio & Nút Transcript ghim cố định'),
                whatFor: t('Keeps audio controls and the Transcript toggle pinned at the top while you scroll through questions.', 'Giữ bộ điều khiển phát âm thanh và nút mở lời thoại (Transcript) luôn cố định ở đầu màn hình khi bạn cuộn danh sách câu hỏi.'),
                howToUse: t('Use the audio bar to play or replay sections. In Time-Free mode, toggle <strong>Transcript</strong> for intensive listening practice.', 'Dùng thanh Audio để nghe, tua lại đoạn vừa lỡ. Trong chế độ Time-Free, bạn có thể bấm nút <strong>Transcript</strong> để vừa nghe vừa dò chữ khi luyện nghe sâu.'),
                selector: '[data-tutorial-target="listening-audio"]'
            },
            mindmap: {
                topic: 'writing',
                badge: t('Brainstorming', 'Lên ý tưởng'),
                title: t('🧠 Dynamic Mind Map', '🧠 Dynamic Mind Map (Sơ đồ tư duy)'),
                whatFor: t('Helps you outline quickly using standard <strong>Writing Task 1/2</strong> or <strong>Speaking Part 1/2/3</strong> structures with suggested vocabulary and discourse markers.', 'Giúp bạn lập dàn ý nhanh theo đúng cấu trúc chuẩn của <strong>Writing Task 1/2</strong> hoặc <strong>Speaking Part 1/2/3</strong>, đồng thời gợi ý từ vựng và cụm từ nối (Discourse Markers).'),
                howToUse: t('Select a branch (e.g., <em>Main vs Minor Details</em> for Task 1, or <em>Position → Main Point → Explanation</em> for Task 2) and click or drag phrases into your outline.', 'Gõ ngắn gọn từ khóa ý tưởng vào từng nhánh (ví dụ: <em>Main vs Minor Details</em> cho Task 1, hoặc <em>Position → Main Point → Explanation</em> cho Task 2). Bấm vào chip từ vựng để chèn nhanh ý hay.'),
                selector: '[data-dynamic-mindmap]'
            },
            scaffolded_writing: {
                topic: 'writing',
                badge: t('Essay Structure', 'Cấu trúc bài viết'),
                title: t('🧱 Scaffolded Writing', '🧱 Scaffolded Writing (Viết theo khối)'),
                whatFor: t('Splits your essay into clear paragraph blocks (<em>Introduction, Overview/Thesis, Body 1, Body 2, Conclusion</em>) so you can focus on one paragraph at a time.', 'Chia bài luận thành các khối rõ ràng (<em>Introduction, Overview/Thesis, Body 1, Body 2, Conclusion</em>) để bạn tập trung viết từng đoạn mà không bị rối bố cục.'),
                howToUse: t('Write each block following its prompt hint. All blocks are automatically combined into one essay when you submit.', 'Viết lần lượt từng ô theo gợi ý tiêu đề của mỗi khối. Hệ thống sẽ tự động ghép tất cả các khối thành một bài hoàn chỉnh khi bạn bấm nộp bài.'),
                selector: '[data-writing-scaffold-question]'
            },
            writing_analyzer: {
                topic: 'writing',
                badge: t('Essay Check', 'Phân tích bài viết'),
                title: t('📊 Word Counter & Text Analyzer', '📊 Bộ đếm từ & Writing Text Analyzer'),
                whatFor: t('Tracks your live word count (minimum <strong>150 words</strong> Task 1, <strong>250 words</strong> Task 2) and highlights repeated words, discourse markers, and grammar patterns.', 'Kiểm tra số lượng từ theo thời gian thực (tối thiểu <strong>150 từ</strong> Task 1, <strong>250 từ</strong> Task 2) và tự động phát hiện lỗi lặp từ, mật độ từ nối, cấu trúc câu.'),
                howToUse: t('After drafting each paragraph, check the analyzer below to replace repeated words with precise synonyms before submitting.', 'Sau khi viết xong mỗi đoạn, nhìn xuống bảng phân tích bên dưới để thay thế các từ bị lặp nhiều lần bằng từ đồng nghĩa trước khi nộp.'),
                selector: '[data-writing-analysis]'
            },
            sample_answer: {
                topic: 'writing',
                badge: t('Model Answer', 'Bài mẫu chuẩn'),
                title: t('👁️ Show / 🔊 Listen Sample Answer', '👁️ Show / 🔊 Listen Sample Answer'),
                whatFor: t('Provides a high-band sample answer with color-coded highlights for IELTS criteria (<em>TA/TR, CC, LR, GRA</em> or <em>FC, LR, GRA, PR</em>).', 'Cung cấp bài mẫu đạt Band cao kèm chế độ tô màu theo 4 tiêu chí chấm điểm của IELTS (<em>TA/TR, CC, LR, GRA</em> hoặc <em>FC, LR, GRA, PR</em>).'),
                howToUse: t('Open it only after completing your own outline or draft. For Speaking, click <strong>🔊 Listen to Sample Answer</strong> to practice shadowing.', 'Chỉ nên mở sau khi bạn đã tự hoàn thành dàn ý hoặc bản nháp của mình. Với Speaking, hãy bấm <strong>🔊 Listen to Sample Answer</strong> để nghe ngữ điệu và nhại lại (shadowing).'),
                selector: '#sample-answer-toggle-label'
            },
            speaking_mic: {
                topic: 'speaking',
                badge: t('Speaking Practice', 'Luyện nói'),
                title: t('🎙️ Mic Recorder & Part 2 Simulation', '🎙️ Ghi âm Micro & Mô phỏng Part 2'),
                whatFor: t('Lets you record your spoken answer directly in the browser and play it back to evaluate fluency, pronunciation, and grammar.', 'Cho phép bạn thu âm trực tiếp câu trả lời và nghe lại ngay trên trình duyệt để tự đánh giá độ trôi chảy, phát âm và ngữ pháp.'),
                howToUse: t('Click <strong>🎙️ Mic</strong> to start speaking, click again to stop and play back. Part 2 simulation automatically runs <strong>60s prep</strong> followed by <strong>2m recording</strong>.', 'Bấm vào nút <strong>🎙️ Micro</strong> để bắt đầu nói, bấm lại để dừng và nghe lại thanh Playback. Riêng Part 2 ở chế độ mô phỏng sẽ tự đếm ngược <strong>60 giây chuẩn bị</strong> rồi tự động ghi âm <strong>2 phút</strong>.'),
                selector: '[id^="mic-btn-"], .speaking-simulation-panel'
            },
            review_panel: {
                topic: 'review',
                badge: t('Test Review', 'Xem lại bài'),
                title: t('📖 Detailed Review & Error Diagnostics', '📖 Detailed Review (Xem lại & Chẩn đoán lỗi)'),
                whatFor: t('Compares all your answers against the answer key, diagnoses mistake types (<em>typos, singular/plural, distractors</em>), and shows explanations.', 'Tổng hợp toàn bộ câu trả lời của bạn so với đáp án chuẩn, phân loại lỗi sai (như <em>Typo, sai số ít/số nhiều, dính bẫy nhiễu</em>) và hiển thị giải thích chi tiết.'),
                howToUse: t('Review incorrect items on the right alongside the passage/transcript on the left, save new words to <strong>🗂️ Cards</strong>, or click <strong>↻ Retake</strong>.', 'Đọc kỹ các câu sai ở cột phải, đối chiếu với bài đọc/transcript ở cột trái, lưu từ mới vào <strong>🗂️ Cards</strong> hoặc bấm <strong>↻ Retake</strong> để làm lại bài.'),
                selector: '#review-right-pane'
            },
            flashcards: {
                topic: 'flashcards',
                badge: t('Vocab & Grammar', 'Từ vựng & Ngữ pháp'),
                title: t('🗂️ Study Cards (Flashcards)', '🗂️ Study Cards (Flashcards)'),
                whatFor: t('Helps you review lesson vocabulary and grammar structures as interactive flip cards.', 'Giúp bạn ôn tập từ vựng và cấu trúc ngữ pháp của từng bài học dưới dạng thẻ lật tương tác.'),
                howToUse: t('Choose a deck at the top, click a card to flip for its meaning & example, or click <strong>＋ Add phrase</strong> to save your own.', 'Chọn bộ thẻ ở danh sách phía trên, bấm vào thẻ để lật xem nghĩa tiếng Việt & ví dụ. Bấm <strong>＋ Add phrase</strong> để tự lưu thêm cụm từ bạn muốn nhớ.'),
                selector: '#panel-fc-container'
            }
        };
    }

    function getTutorialTopics() {
        return [
            {
                id: 'dashboard',
                label: t('🏠 Overview', '🏠 Tổng quan'),
                title: t('Student Portal Guide', 'Hướng dẫn Student Portal'),
                featureKeys: ['student_overview', 'student_class', 'student_target', 'streak_gems', 'test_modes']
            },
            {
                id: 'reading',
                label: '📖 Reading',
                title: t('Reading Features Guide', 'Hướng dẫn các tính năng Reading'),
                featureKeys: ['skimming', 'vocab_highlights', 'scaffold_coach', 'check_answer', 'locate', 'explanation', 'fifty_fifty']
            },
            {
                id: 'listening',
                label: '🎧 Listening',
                title: t('Listening Features Guide', 'Hướng dẫn các tính năng Listening'),
                featureKeys: ['listening_audio', 'scaffold_coach', 'check_answer', 'locate', 'explanation']
            },
            {
                id: 'writing',
                label: '✍️ Writing',
                title: t('Writing Features Guide', 'Hướng dẫn các tính năng Writing'),
                featureKeys: ['mindmap', 'scaffold_coach', 'scaffolded_writing', 'writing_analyzer', 'sample_answer']
            },
            {
                id: 'speaking',
                label: '🎙️ Speaking',
                title: t('Speaking Features Guide', 'Hướng dẫn các tính năng Speaking'),
                featureKeys: ['mindmap', 'scaffold_coach', 'speaking_mic', 'sample_answer']
            },
            {
                id: 'review',
                label: '📊 Review',
                title: t('Detailed Review Guide', 'Hướng dẫn Xem lại bài (Review)'),
                featureKeys: ['review_panel']
            },
            {
                id: 'flashcards',
                label: '🗂️ Study Cards',
                title: t('Study Cards Guide', 'Hướng dẫn học Study Cards'),
                featureKeys: ['flashcards']
            }
        ];
    }

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
        const topics = getTutorialTopics();
        const guides = getFeatureGuides();
        const topic = topics.find(tp => tp.id === activeTopicId) || topics[0];
        const featureKeys = topic.featureKeys || [];
        const safeStepIdx = Math.max(0, Math.min(activeStepIdx, featureKeys.length - 1));
        activeStepIdx = safeStepIdx;
        const featureKey = featureKeys[safeStepIdx];
        const step = guides[featureKey] || guides.student_overview;
        const progressPct = featureKeys.length ? Math.round(((safeStepIdx + 1) / featureKeys.length) * 100) : 100;

        const topicTabsHtml = topics.map(tp => {
            const isCurrent = tp.id === topic.id;
            return `<button type="button" onclick="window.selectAppTutorialTopic('${tp.id}')" class="px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition border ${isCurrent ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm' : 'bg-slate-100 text-slate-600 border-slate-200 hover:bg-slate-200'}">${tp.label}</button>`;
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
                            <div class="text-[10px] font-black uppercase tracking-widest text-amber-200">${t('Student Guide', 'Hướng dẫn tính năng')}</div>
                            <h2 id="app-tutorial-title" class="text-sm sm:text-base font-black truncate">${topic.title}</h2>
                        </div>
                    </div>
                    <button type="button" onclick="window.closeAppTutorial()" class="w-8 h-8 rounded-xl bg-white/15 hover:bg-white/25 text-white font-black text-xl flex items-center justify-center transition shrink-0" aria-label="${t('Close guide', 'Đóng hướng dẫn')}">&times;</button>
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
                            <div class="text-[11px] font-black uppercase tracking-wider text-indigo-700 mb-1">🎯 ${t('What is it for?', 'Dùng để làm gì?')}</div>
                            <div>${step.whatFor}</div>
                        </div>
                        <div class="rounded-xl bg-white border border-emerald-200 p-3 text-xs sm:text-sm text-emerald-950 leading-relaxed">
                            <div class="text-[11px] font-black uppercase tracking-wider text-emerald-700 mb-1">💡 ${t('How to use effectively', 'Cách dùng hiệu quả')}</div>
                            <div>${step.howToUse}</div>
                        </div>
                    </div>
                </div>

                <div class="px-4 py-3 bg-slate-50 border-t border-slate-200 flex items-center justify-between gap-3">
                    <button type="button" onclick="window.prevAppTutorialStep()" ${safeStepIdx === 0 ? 'disabled' : ''} class="px-3.5 py-2 rounded-xl text-xs font-bold border border-slate-300 bg-white text-slate-700 hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed transition">&larr; ${t('Previous', 'Trước')}</button>
                    <div class="text-[11px] text-slate-400 hidden sm:block">${t('← / → switch • ESC close', '← / → chuyển mục • ESC đóng')}</div>
                    ${safeStepIdx < featureKeys.length - 1
                        ? `<button type="button" onclick="window.nextAppTutorialStep()" class="px-4 py-2 rounded-xl text-xs font-black bg-indigo-600 hover:bg-indigo-700 text-white shadow-sm transition">${t('Next', 'Tiếp theo')} &rarr;</button>`
                        : `<button type="button" onclick="window.closeAppTutorial()" class="px-4 py-2 rounded-xl text-xs font-black bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm transition">${t('Got it ✓', 'Đã hiểu ✓')}</button>`}
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
        btn.title = titleText || t('View feature guide', 'Xem hướng dẫn tính năng này');
        btn.setAttribute('aria-label', titleText || t('View feature guide', 'Xem hướng dẫn tính năng này'));
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
            injectBadgeOnce(overviewHeading, 'student_overview', t('Overview guide', 'Hướng dẫn mục Tổng quan'));

            const classHeading = document.querySelector('#student-class-overview-section h2');
            injectBadgeOnce(classHeading, 'student_class', t('Class guide', 'Hướng dẫn mục Lớp học'));

            const targetHeading = document.querySelector('#student-target-widget h3');
            injectBadgeOnce(targetHeading, 'student_target', t('IELTS Goal guide', 'Hướng dẫn Mục tiêu IELTS'));

            const streakWidget = document.getElementById('streak-widget');
            if (streakWidget && !streakWidget.querySelector('[data-info-badge-key="streak_gems"]')) {
                streakWidget.appendChild(makeInfoButton('streak_gems', t('Streak & Gems guide', 'Hướng dẫn Streak & Gems')));
            }
        }

        // Exam / Practice Player features
        if (isVisible('exam-ui')) {
            const mod = typeof APP_DATA !== 'undefined' ? String(APP_DATA?.module || '').toLowerCase() : '';

            // Reading Skimming Bar
            const skimPlay = document.getElementById('btn-skimming-play');
            if (skimPlay && skimPlay.parentElement) {
                injectBadgeOnce(skimPlay.parentElement, 'skimming', t('Skimming WPM guide', 'Hướng dẫn thanh Skimming WPM'));
            }

            // Reading Vocab/Grammar checkboxes
            const passage = document.getElementById('passage-container');
            if (passage) {
                passage.querySelectorAll('label').forEach(el => {
                    if (/Show Vocab Highlights|Hiện từ vựng nổi bật/i.test(el.textContent || '')) {
                        const bar = el.parentElement;
                        if (bar) {
                            bar.setAttribute('data-tutorial-target', 'vocab-highlights');
                            injectBadgeOnce(bar, 'vocab_highlights', t('Vocab & Grammar Highlights guide', 'Hướng dẫn Highlight Từ vựng & Ngữ pháp'));
                        }
                    }
                });
            }

            // Listening Sticky Audio Bar
            if (mod === 'listening') {
                const audioBar = document.querySelector('#questions-container .sticky, #exam-ui audio')?.closest('.sticky, .rounded-xl, .bg-blue-50\\/95');
                if (audioBar) {
                    audioBar.setAttribute('data-tutorial-target', 'listening-audio');
                    injectBadgeOnce(audioBar, 'listening_audio', t('Audio & Transcript guide', 'Hướng dẫn thanh Audio & Transcript'));
                }
            }

            // Writing & Speaking Tools
            const mindMap = document.querySelector('[data-dynamic-mindmap] h3, [data-dynamic-mindmap] .font-black');
            if (mindMap) injectBadgeOnce(mindMap, 'mindmap', t('Dynamic Mind Map guide', 'Hướng dẫn Dynamic Mind Map'));

            const scaffoldWritingHeader = document.querySelector('[data-writing-scaffold-question] .scaffolded-writing__header > div');
            if (scaffoldWritingHeader) injectBadgeOnce(scaffoldWritingHeader, 'scaffolded_writing', t('Scaffolded Writing guide', 'Hướng dẫn Viết theo khối'));

            const analyzerHeader = document.querySelector('[data-writing-analysis]');
            if (analyzerHeader && analyzerHeader.firstElementChild) {
                injectBadgeOnce(analyzerHeader.firstElementChild, 'writing_analyzer', t('Writing Text Analyzer guide', 'Hướng dẫn Bộ phân tích bài viết'));
            }

            const sampleLabel = document.getElementById('sample-answer-toggle-label');
            if (sampleLabel && sampleLabel.closest('div')) {
                injectBadgeOnce(sampleLabel.closest('div'), 'sample_answer', t('Sample Answer & Criteria guide', 'Hướng dẫn xem Bài mẫu & Tiêu chí'));
            }

            // Speaking Mic
            document.querySelectorAll('[id^="mic-status-"]').forEach(el => {
                injectBadgeOnce(el, 'speaking_mic', t('Microphone recording guide', 'Hướng dẫn ghi âm Micro'));
            });

            // Question-level Scaffold Coach & Action Buttons
            document.querySelectorAll('[data-scaffold-coach]').forEach(el => {
                const header = el.querySelector('.flex.items-center.gap-2');
                if (header) injectBadgeOnce(header, 'scaffold_coach', t('Step-by-Step Guide help', 'Hướng dẫn cách dùng khung Hướng dẫn từng bước'));
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
                    row.appendChild(makeInfoButton('check_answer', t('Check Answer / Locate / Explanation guide', 'Hướng dẫn Check Answer / Locate / Explanation')));
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
        const safeTitle = String(titleText || t('View feature guide', 'Xem hướng dẫn tính năng này')).replace(/"/g, '&quot;');
        return `<button type="button" data-info-badge-key="${safeKey}" onclick="event.stopPropagation(); window.openFeatureTutorial('${safeKey}', this)" class="inline-flex items-center justify-center w-5 h-5 rounded-full bg-amber-400 hover:bg-amber-300 text-slate-900 font-serif font-black text-[11px] leading-none shadow-sm border border-amber-500/60 hover:scale-110 transition cursor-pointer shrink-0 ml-1" title="${safeTitle}" aria-label="${safeTitle}">i</button>`;
    };

    root.openFeatureTutorial = function(featureKey, triggerEl) {
        const guide = getFeatureGuides()[featureKey];
        if (!guide) {
            root.openAppTutorial();
            return;
        }
        activeTopicId = guide.topic;
        const topics = getTutorialTopics();
        const topic = topics.find(tp => tp.id === activeTopicId) || topics[0];
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
        const topics = getTutorialTopics();
        const topic = topics.find(tp => tp.id === activeTopicId) || topics[0];
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
            get FEATURE_GUIDES() { return getFeatureGuides(); },
            get TUTORIAL_TOPICS() { return getTutorialTopics(); },
            openAppTutorial: root.openAppTutorial,
            openFeatureTutorial: root.openFeatureTutorial,
            closeAppTutorial: root.closeAppTutorial
        };
    }
})();
