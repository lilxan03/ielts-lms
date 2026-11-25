(function() {
    const TUTORIAL_TOPICS = [
        {
            id: 'dashboard',
            label: '🏠 Tổng quan',
            title: 'Hướng dẫn Học tập trên Student Portal',
            steps: [
                {
                    title: '1. Chọn Chương trình & Đề luyện tập',
                    badge: 'Bắt đầu',
                    selector: '#student-dashboard-content',
                    description: 'Tại màn hình chính, bạn có thể chọn kỹ năng <strong>Reading, Listening, Writing, Speaking</strong> hoặc mở các đề được giáo viên giao theo lớp và lịch học.',
                    tip: 'Mỗi đề có thể làm theo từng Part nhỏ hoặc làm Full Test tùy mục tiêu ôn luyện.'
                },
                {
                    title: '2. Chọn chế độ Time-Free hay Exam Mode',
                    badge: '2 chế độ học',
                    selector: '#student-dashboard-content',
                    description: '<strong>• Time-Free (Khuyên dùng khi mới luyện):</strong> Không giới hạn thời gian, có sẵn <em>Hướng dẫn từng bước, Mind Map, Viết theo khối, Locate, Explanation</em> và <em>Check Answer</em>.<br><strong>• Exam Mode:</strong> Bấm giờ chuẩn phòng thi IELTS để kiểm tra năng lực thật.',
                    tip: 'Hãy luyện thuần thục ở chế độ Time-Free trước, sau đó chuyển sang Exam Mode để canh tốc độ.'
                },
                {
                    title: '3. Công cụ học tập & Ôn tập cá nhân',
                    badge: 'Study Tools',
                    selector: '#student-banner-bg',
                    description: 'Thanh điều hướng nhanh giúp bạn mở <strong>Study Cards (Flashcards)</strong>, <strong>Lịch sử làm bài (History)</strong>, <strong>Lịch học (Schedule)</strong> và <strong>Templates chiến thuật</strong> mọi lúc.',
                    tip: 'Bạn có thể bấm vào mục History để xem lại toàn bộ lời giải chi tiết của các bài đã nộp.'
                },
                {
                    title: '4. Theo dõi Streak & Tích lũy Gems',
                    badge: 'Gamification',
                    selector: '#streak-widget',
                    description: 'Duy trì đăng nhập và hoàn thành bài tập mỗi ngày để tăng chuỗi <strong>🔥 Streak</strong> và tích <strong>💎 Gems</strong> mở khóa phần thưởng.',
                    tip: 'Bấm vào biểu tượng Hồ sơ (Profile) ở góc phải để đặt mục tiêu Band điểm và theo dõi tiến độ.'
                }
            ]
        },
        {
            id: 'reading',
            label: '📖 Reading',
            title: 'Hướng dẫn học Reading hiệu quả',
            steps: [
                {
                    title: '1. Đọc bài & Bôi đen Highlight trực tiếp',
                    badge: 'Cột trái',
                    selector: '#passage-container',
                    description: 'Bài đọc nằm ở cột trái. Bạn có thể <strong>bôi đen bất kỳ đoạn chữ nào</strong> trên bài đọc hoặc đề bài để tô màu ghi nhớ từ khóa (giống thi IELTS trên máy tính).',
                    tip: 'Có thể kéo thanh chia ở giữa màn hình để mở rộng cột bài đọc hoặc cột câu hỏi.'
                },
                {
                    title: '2. Luyện đọc lướt với Thanh Skimming (WPM)',
                    badge: 'Tốc độ đọc',
                    selector: '#skimming-toolbar',
                    description: 'Thanh <strong>Skimming</strong> được ghim cố định ở đầu bài đọc. Chỉnh tốc độ <strong>WPM</strong>, bấm <strong>▶ PLAY</strong> để chữ chạy theo nhịp đọc lướt, hoặc bấm <strong>↺ RESTART</strong> / <strong>PREV / NEXT</strong> bất kỳ lúc nào.',
                    tip: 'Đọc lướt 1 lượt để nắm bố cục từng đoạn A, B, C trước khi đi tìm đáp án chi tiết.'
                },
                {
                    title: '3. Phân tích câu (S/V/O) & Highlight Từ vựng',
                    badge: 'Đọc hiểu sâu',
                    selector: '#passage-container',
                    description: 'Bật <strong>Syntax Chunking</strong> để tách cụm <em>Chủ ngữ (S) – Động từ (V) – Tân ngữ (O)</em> ở những câu dài khó hiểu, hoặc bật/tắt <strong>Vocab &amp; Grammar Highlights</strong> để học từ mới ngay trong ngữ cảnh.',
                    tip: 'Nhấp vào các từ vựng được gạch chân để xem nghĩa và lưu vào Study Cards.'
                },
                {
                    title: '4. Hướng dẫn từng bước, Locate & Explanation',
                    badge: 'Time-Free',
                    selector: '[data-scaffold-coach="0"]',
                    description: 'Ở cột phải trong chế độ <strong>Time-Free</strong>: mở <strong>🎯 Hướng dẫn từng bước</strong> để đi đúng quy trình làm từng dạng bài (TFNG, Matching, Điền từ...), dùng <strong>🔎 Locate</strong> để nhảy tới đoạn chứa đáp án, bấm <strong>Check Answer</strong> và xem <strong>📖 Explanation</strong>.',
                    tip: 'Với câu trắc nghiệm 1 đáp án, bạn còn có nút 🪄 50/50 để loại bớt phương án nhiễu.'
                }
            ]
        },
        {
            id: 'listening',
            label: '🎧 Listening',
            title: 'Hướng dẫn học Listening hiệu quả',
            steps: [
                {
                    title: '1. Thanh Audio & Nút Transcript ghim cố định',
                    badge: 'Điều khiển nghe',
                    selector: '#exam-ui',
                    description: 'Thanh phát <strong>Audio</strong> và nút <strong>Transcript</strong> luôn được ghim cố định khi bạn cuộn câu hỏi, giúp bạn dễ dàng tua lại, tạm dừng hoặc đối chiếu lời thoại bất cứ lúc nào (trong Time-Free).',
                    tip: 'Nếu câu có nhiều đoạn, hãy nghe hết lượt đầu như thi thật rồi mới mở Transcript kiểm tra lại chỗ bị lỡ.'
                },
                {
                    title: '2. Làm theo Hướng dẫn từng bước (Scaffold Coach)',
                    badge: 'Chiến thuật',
                    selector: '[data-scaffold-coach="0"]',
                    description: 'Mở <strong>🎯 Hướng dẫn từng bước</strong> ở đầu mỗi nhóm câu hỏi để xem giới hạn từ (<em>Word Limit</em>), dự đoán từ loại cần điền (N/V/Adj, số ít/nhiều) và nhận diện bẫy đổi ý của người nói.',
                    tip: 'Ở Part 1–4, luôn đọc trước 2–3 câu kế tiếp để không bị mất dấu khi audio chuyển ý.'
                },
                {
                    title: '3. Luyện nghe chép (Micro-Dictation) & Bắt bẫy',
                    badge: 'Kỹ năng sâu',
                    selector: '#exam-ui',
                    description: 'Khi xem lại bài hoặc luyện tập, hệ thống hỗ trợ <strong>Micro-Dictation</strong> (tập trung vào số, tên riêng, từ khóa dài) và <strong>Phân tích bẫy nhiễu (Distractor Analysis)</strong> để bạn biết vì sao đáp án kia là bẫy.',
                    tip: 'Chú ý lỗi chính tả và đuôi số nhiều -s/-es vì hệ thống sẽ phân loại riêng lỗi Typo và Plural.'
                },
                {
                    title: '4. Locate, Check Answer & Explanation',
                    badge: 'Time-Free',
                    selector: '#questions-container',
                    description: 'Trong chế độ <strong>Time-Free</strong>, dùng <strong>🔎 Locate</strong> để tìm đoạn Transcript liên quan, bấm <strong>Check Answer</strong> để chấm nhanh từng block và mở <strong>📖 Explanation</strong> để hiểu rõ lý do đúng/sai.',
                    tip: 'Đừng quên bấm 🗂️ hoặc 🪄 trên thanh tiêu đề (nếu có) để ôn từ vựng và ngữ pháp của bài nghe.'
                }
            ]
        },
        {
            id: 'writing',
            label: '✍️ Writing',
            title: 'Hướng dẫn học Writing hiệu quả',
            steps: [
                {
                    title: '1. Lập dàn ý với Dynamic Mind Map (Cột trái)',
                    badge: 'Lên ý tưởng',
                    selector: '#passage-container',
                    description: 'Dùng <strong>Dynamic Mind Map</strong> ở cột trái để sắp xếp ý tưởng trước khi viết:<br>• <strong>Task 1:</strong> Tách <em>Main Details (Overview)</em> và <em>Minor Details (Body)</em>.<br>• <strong>Task 2:</strong> Chốt <em>Position (Thesis) → Main Point → Explanation</em>.',
                    tip: 'Bấm trực tiếp vào các chip Từ vựng chủ đề và Discourse Markers trong Mind Map để nhặt ý nhanh.'
                },
                {
                    title: '2. Bám sát Hướng dẫn từng bước (Scaffold Coach)',
                    badge: 'Quy trình viết',
                    selector: '[data-scaffold-coach="0"]',
                    description: 'Khung <strong>🎯 Hướng dẫn từng bước</strong> ở cột phải nhắc bạn lần lượt từng chặng từ phân tích đề, viết mở bài/overview đến kiểm tra cuối bài.',
                    tip: 'Hoàn thành từng bước rồi đánh dấu ✓ để không bỏ sót yêu cầu của đề.'
                },
                {
                    title: '3. Viết theo khối (Scaffolded Writing)',
                    badge: 'Cột phải',
                    selector: '[data-writing-scaffold-question]',
                    description: 'Trong chế độ <strong>Time-Free</strong>, bài viết được chia sẵn thành các khối (<em>Introduction, Overview/Thesis, Body 1, Body 2, Conclusion</em>). Bạn chỉ cần viết từng đoạn, hệ thống tự động ghép thành bài hoàn chỉnh khi nộp.',
                    tip: 'Cách viết theo khối giúp bạn giữ bố cục rõ ràng và không bị sót đoạn Overview hay Conclusion.'
                },
                {
                    title: '4. Bộ đếm từ, Text Analyzer & Sample Answer',
                    badge: 'Kiểm tra & Nâng band',
                    selector: '[data-writing-analysis]',
                    description: 'Theo dõi số từ (<strong>≥ 150</strong> cho Task 1, <strong>≥ 250</strong> cho Task 2) và bảng <strong>Writing Text Analyzer</strong> cảnh báo lặp từ, từ nối, cấu trúc câu. Sau khi viết, bấm <strong>👁️ Show Sample Answer</strong> ở cột trái để đối chiếu theo 4 tiêu chí.',
                    tip: 'Mỗi bài mẫu đều có highlight theo 4 tiêu chí TA/TR, CC, LR, GRA để bạn học cách ăn điểm.'
                }
            ]
        },
        {
            id: 'speaking',
            label: '🎙️ Speaking',
            title: 'Hướng dẫn luyện Speaking hiệu quả',
            steps: [
                {
                    title: '1. Lên khung trả lời trên Dynamic Mind Map',
                    badge: 'Cột trái',
                    selector: '#passage-container',
                    description: 'Dùng <strong>Dynamic Mind Map</strong> ở cột trái để ghi từ khóa theo đúng công thức từng Part:<br>• <strong>Part 1:</strong> Direct Answer + Further Details.<br>• <strong>Part 2:</strong> Topic Sentence → Background → Main Point → Feelings/Future Plans.<br>• <strong>Part 3:</strong> Point → Explanation → Example/Link Back.',
                    tip: 'Chỉ ghi từ khóa ngắn gọn trên Mind Map, tránh viết nguyên câu để nói tự nhiên hơn.'
                },
                {
                    title: '2. Mở Hướng dẫn từng bước (Scaffold Coach)',
                    badge: 'Chiến thuật',
                    selector: '[data-scaffold-coach="0"]',
                    description: 'Khung <strong>🎯 Hướng dẫn từng bước</strong> giúp bạn nắm rõ thời lượng chuẩn (15–25s cho Part 1, 2 phút cho Part 2, 30–45s cho Part 3) và các cụm từ nối ăn điểm.',
                    tip: 'Kết hợp từ vựng chủ đề và Discourse Markers ngay trong lúc nhìn Mind Map để nói trôi chảy.'
                },
                {
                    title: '3. Ghi âm Micro & Mô phỏng Part 2 chuẩn thi thật',
                    badge: 'Thực hành nói',
                    selector: '#questions-container',
                    description: 'Bấm nút <strong>🎙️ Micro</strong> để ghi âm câu trả lời và nghe lại ngay bằng thanh Playback. Với <strong>Speaking Part 2 Simulation</strong>, đồng hồ tự đếm ngược <strong>60 giây chuẩn bị</strong> rồi tự động ghi âm <strong>2 phút</strong>.',
                    tip: 'Luôn nghe lại bản ghi âm của chính mình để phát hiện lỗi phát âm âm cuối, chia thì hoặc ngập ngừng.'
                },
                {
                    title: '4. Nghe & Xem Sample Answer (Có tiêu chí chấm)',
                    badge: 'Đối chiếu',
                    selector: '#sample-answer-speech-button',
                    description: 'Bấm <strong>🔊 Listen to Sample Answer</strong> để nghe ngữ điệu mẫu và bấm <strong>👁️ Show Sample Answer</strong> để xem bài mẫu kèm highlight theo 4 tiêu chí <em>FC, LR, GRA, PR</em>.',
                    tip: 'Bạn có thể nghe trước câu mẫu rồi thu âm lại lần 2 (shadowing) để cải thiện phản xạ.'
                }
            ]
        },
        {
            id: 'review',
            label: '📊 Review',
            title: 'Hướng dẫn xem lại bài (Detailed Review)',
            steps: [
                {
                    title: '1. So sánh Đáp án & Chẩn đoán lỗi sai',
                    badge: 'Phân tích',
                    selector: '#review-right-pane',
                    description: 'Mỗi câu hỏi hiển thị rõ đáp án bạn đã chọn so với đáp án đúng, kèm nhãn chẩn đoán (<em>Typo, Số ít/Số nhiều, Bẫy nhiễu</em>) giúp bạn biết chính xác mình mất điểm ở đâu.',
                    tip: 'Tập trung sửa các lỗi Typo và Plural trước vì đây là những điểm dễ kéo lên nhất.'
                },
                {
                    title: '2. Đọc Giải thích chi tiết & Locate dẫn chứng',
                    badge: 'Hiểu sâu',
                    selector: '#review-left-pane',
                    description: 'Xem khung <strong>📖 Giải thích đáp án (Explanation)</strong> dưới mỗi câu hỏi và đối chiếu trực tiếp với bài đọc/transcript ở cột trái.',
                    tip: 'Chú ý các cặp từ Paraphrase giữa câu hỏi và bài gốc để ghi vào sổ tay từ vựng.'
                },
                {
                    title: '3. Lưu Flashcards & Làm lại bài (Retake)',
                    badge: 'Ôn tập',
                    selector: '#review-retake-btn',
                    description: 'Bấm <strong>🗂️ Cards</strong> để lưu cụm từ hay vào bộ thẻ ôn tập, hoặc bấm <strong>↻ Retake</strong> trên thanh tiêu đề để làm lại bài này nhằm củng cố kiến thức.',
                    tip: 'Làm lại bài sai sau 2–3 ngày là cách nhớ từ vựng và tránh bẫy hiệu quả nhất.'
                }
            ]
        },
        {
            id: 'flashcards',
            label: '🗂️ Study Cards',
            title: 'Hướng dẫn học với Study Cards',
            steps: [
                {
                    title: '1. Chọn bộ thẻ Từ vựng hoặc Ngữ pháp',
                    badge: 'Chọn bộ thẻ',
                    selector: '#panel-fc-list-select',
                    description: 'Dùng danh sách chọn phía trên để chuyển qua lại giữa các bộ thẻ từ vựng/ngữ pháp theo từng bài test hoặc bộ thẻ cá nhân của bạn.',
                    tip: 'Mỗi thẻ có giải thích tiếng Anh, nghĩa tiếng Việt và ngữ cảnh sử dụng.'
                },
                {
                    title: '2. Lật thẻ & Tự thêm cụm từ mới',
                    badge: 'Chủ động ghi nhớ',
                    selector: '#panel-fc-container',
                    description: 'Bấm vào thẻ để lật xem nghĩa/ví dụ. Nếu gặp từ hay trong lúc làm bài, bấm <strong>＋ Add phrase</strong> ở góc trên bên phải để tự tạo thẻ riêng.',
                    tip: 'Ôn 10–15 phút mỗi ngày trước khi vào làm đề mới để tăng vốn từ chủ động.'
                }
            ]
        },
        {
            id: 'teacher',
            label: '🛠 Teacher',
            title: 'Hướng dẫn dành cho Giáo viên',
            steps: [
                {
                    title: '1. Ngân hàng đề (Test Bank) & Dạng bài chi tiết',
                    badge: 'Quản lý đề',
                    selector: '#teacher-top-nav',
                    description: 'Trong <strong>Test Bank</strong>, giáo viên có thể tạo, nhập LaTeX, chỉnh sửa từng Part và phân loại chi tiết các dạng câu hỏi (MCQ 1/3, 2/5, Matching Endings, Summary Box...) để hệ thống tự gắn hướng dẫn phù hợp.',
                    tip: 'Dùng nút Preview để trải nghiệm giao diện làm bài y hệt học viên.'
                },
                {
                    title: '2. Lớp học, Lịch học & Giao bài (Classes & Timetable)',
                    badge: 'Vận hành lớp',
                    selector: '#teacher-top-nav',
                    description: 'Quản lý danh sách học viên ở <strong>Classes &amp; Subs</strong>, sắp xếp lịch học trên <strong>Timetable</strong> và giao đề cho từng lớp hoặc từng học viên.',
                    tip: 'Học viên chỉ thấy các đề và lịch học thuộc lớp mình đã ghi danh.'
                },
                {
                    title: '3. Chấm bài, Phản hồi & Xem hồ sơ học viên',
                    badge: 'Đánh giá',
                    selector: '#teacher-top-nav',
                    description: 'Nhận thông báo bài nộp mới tại biểu tượng <strong>🔔 Chuông</strong> ở góc phải, chấm điểm Writing/Speaking theo 4 tiêu chí (có hỗ trợ AI Draft) và dùng <strong>Student Preview</strong> để kiểm tra màn hình của học viên.',
                    tip: 'Mọi nhận xét và điểm tiêu chí sẽ hiển thị ngay trong mục History của học viên.'
                }
            ]
        }
    ];

    let activeTopicId = 'dashboard';
    let activeStepIdx = 0;
    let highlightedEl = null;

    function clearSpotlight() {
        if (highlightedEl) {
            highlightedEl.classList.remove('ring-4', 'ring-amber-400', 'ring-offset-2', 'shadow-2xl', 'relative', 'z-[850]');
            highlightedEl = null;
        }
    }

    function applySpotlight(selector) {
        clearSpotlight();
        if (!selector || typeof document === 'undefined') return;
        try {
            const el = document.querySelector(selector);
            if (!el || el.offsetParent === null) return;
            highlightedEl = el;
            el.classList.add('ring-4', 'ring-amber-400', 'ring-offset-2', 'shadow-2xl');
            if (typeof el.scrollIntoView === 'function') {
                el.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'nearest' });
            }
        } catch (e) {}
    }

    function isVisible(id) {
        if (typeof document === 'undefined') return false;
        const el = document.getElementById(id);
        return Boolean(el && !el.classList.contains('hidden'));
    }

    function detectCurrentTutorialTopic() {
        if (isVisible('student-fc-panel')) return 'flashcards';
        if (isVisible('review-ui')) return 'review';
        if (isVisible('exam-ui')) {
            const mod = typeof APP_DATA !== 'undefined' ? String(APP_DATA?.module || '').toLowerCase() : '';
            if (['reading', 'listening', 'writing', 'speaking'].includes(mod)) return mod;
            return 'reading';
        }
        if (isVisible('editor-ui')) return 'teacher';
        return 'dashboard';
    }

    function ensureModalElement() {
        if (typeof document === 'undefined') return null;
        let modal = document.getElementById('app-tutorial-modal');
        if (modal) return modal;

        modal = document.createElement('div');
        modal.id = 'app-tutorial-modal';
        modal.className = 'hidden fixed inset-0 z-[950] bg-slate-900/75 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in';
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
        const steps = topic.steps || [];
        const safeStepIdx = Math.max(0, Math.min(activeStepIdx, steps.length - 1));
        activeStepIdx = safeStepIdx;
        const step = steps[safeStepIdx];
        const progressPct = steps.length ? Math.round(((safeStepIdx + 1) / steps.length) * 100) : 100;

        const topicTabsHtml = TUTORIAL_TOPICS.map(t => {
            const isCurrent = t.id === topic.id;
            return `<button type="button" onclick="window.selectAppTutorialTopic('${t.id}')" class="px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition border ${isCurrent ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm' : 'bg-slate-100 text-slate-600 border-slate-200 hover:bg-slate-200'}">${t.label}</button>`;
        }).join('');

        const stepDotsHtml = steps.map((s, idx) => {
            const isCurrent = idx === safeStepIdx;
            const isDone = idx < safeStepIdx;
            return `<button type="button" onclick="window.selectAppTutorialStep(${idx})" class="px-2.5 py-1 rounded-lg text-xs font-bold border transition ${isCurrent ? 'bg-amber-500 text-white border-amber-500 shadow-sm' : (isDone ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-white text-slate-500 border-slate-200 hover:border-indigo-300')}">${isDone ? '✓' : idx + 1}. Bước ${idx + 1}</button>`;
        }).join('');

        modal.innerHTML = `
            <div class="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-2xl overflow-hidden animate-scale-up flex flex-col max-h-[90vh]">
                <div class="bg-gradient-to-r from-indigo-700 via-blue-700 to-sky-600 px-5 py-4 text-white flex items-center justify-between gap-3">
                    <div class="flex items-center gap-3 min-w-0">
                        <span class="w-10 h-10 rounded-xl bg-white/15 border border-white/25 flex items-center justify-center text-xl shrink-0">🎮</span>
                        <div class="min-w-0">
                            <div class="text-[10px] font-black uppercase tracking-widest text-sky-200">Interactive Tutorial</div>
                            <h2 id="app-tutorial-title" class="text-base sm:text-lg font-black truncate">${topic.title}</h2>
                        </div>
                    </div>
                    <button type="button" onclick="window.closeAppTutorial()" class="w-9 h-9 rounded-xl bg-white/15 hover:bg-white/25 text-white font-black text-xl flex items-center justify-center transition shrink-0" aria-label="Đóng hướng dẫn">&times;</button>
                </div>

                <div class="px-5 pt-3 pb-2 bg-slate-50 border-b border-slate-200 flex items-center gap-1.5 overflow-x-auto hide-scrollbar">
                    ${topicTabsHtml}
                </div>

                <div class="h-1.5 bg-slate-200 w-full">
                    <div class="h-full bg-gradient-to-r from-indigo-500 to-amber-500 transition-all duration-300" style="width:${progressPct}%"></div>
                </div>

                <div class="p-5 sm:p-6 overflow-y-auto space-y-4">
                    <div class="flex flex-wrap items-center justify-between gap-2">
                        <div class="flex flex-wrap gap-1.5">${stepDotsHtml}</div>
                        <span class="text-xs font-black text-indigo-700 bg-indigo-50 border border-indigo-200 px-2.5 py-1 rounded-full">${safeStepIdx + 1} / ${steps.length}</span>
                    </div>

                    <div class="rounded-2xl border border-indigo-100 bg-indigo-50/40 p-5 space-y-3">
                        <div class="flex flex-wrap items-center gap-2">
                            <span class="text-[11px] font-black uppercase tracking-wider px-2.5 py-0.5 rounded-full bg-amber-100 text-amber-800 border border-amber-200">${step.badge}</span>
                            <h3 class="text-lg font-black text-slate-900">${step.title}</h3>
                        </div>
                        <p class="text-sm sm:text-[15px] text-slate-700 leading-relaxed">${step.description}</p>
                        ${step.tip ? `<div class="rounded-xl bg-white border border-emerald-200 px-4 py-3 text-xs sm:text-sm text-emerald-900 flex items-start gap-2.5 shadow-sm"><span class="text-base leading-none mt-0.5">💡</span><div><strong>Mẹo học nhanh:</strong> ${step.tip}</div></div>` : ''}
                    </div>
                </div>

                <div class="px-5 py-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between gap-3">
                    <button type="button" onclick="window.prevAppTutorialStep()" ${safeStepIdx === 0 ? 'disabled' : ''} class="px-4 py-2 rounded-xl text-xs sm:text-sm font-bold border border-slate-300 bg-white text-slate-700 hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed transition">&larr; Bước trước</button>
                    <div class="text-xs text-slate-400 hidden sm:block">Nhấn ← / → để chuyển bước • ESC để đóng</div>
                    ${safeStepIdx < steps.length - 1
                        ? `<button type="button" onclick="window.nextAppTutorialStep()" class="px-5 py-2 rounded-xl text-xs sm:text-sm font-black bg-indigo-600 hover:bg-indigo-700 text-white shadow-sm transition">Tiếp theo &rarr;</button>`
                        : `<button type="button" onclick="window.closeAppTutorial()" class="px-5 py-2 rounded-xl text-xs sm:text-sm font-black bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm transition">Bắt đầu học ngay ✓</button>`}
                </div>
            </div>
        `;

        modal.classList.remove('hidden');
        applySpotlight(step.selector);
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

    root.openAppTutorial = function(topicKey) {
        activeTopicId = topicKey || detectCurrentTutorialTopic();
        activeStepIdx = 0;
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
        renderTutorialModal();
    };

    root.selectAppTutorialStep = function(idx) {
        activeStepIdx = idx;
        renderTutorialModal();
    };

    root.nextAppTutorialStep = function() {
        const topic = TUTORIAL_TOPICS.find(t => t.id === activeTopicId) || TUTORIAL_TOPICS[0];
        if (activeStepIdx < topic.steps.length - 1) {
            activeStepIdx += 1;
            renderTutorialModal();
        }
    };

    root.prevAppTutorialStep = function() {
        if (activeStepIdx > 0) {
            activeStepIdx -= 1;
            renderTutorialModal();
        }
    };

    if (typeof document !== 'undefined') {
        document.addEventListener('keydown', handleTutorialKeydown);
    }

    if (typeof module !== 'undefined' && module.exports) {
        module.exports = {
            TUTORIAL_TOPICS,
            openAppTutorial: root.openAppTutorial,
            closeAppTutorial: root.closeAppTutorial
        };
    }
})();
