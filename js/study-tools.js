    // --- SMART TEACHER TEMPLATES ---
    window.insertStrategyTemplate = function(editorId, type) {
        const editor = document.getElementById(editorId);
        if (!editor || !type) return;
        editor.focus();
        
        let html = '';
        if (type === 'mcq') {
            html = `<div class="bg-blue-50 border-l-4 border-blue-500 p-3 mb-2 text-sm text-blue-900 shadow-sm"><strong class="text-blue-700 uppercase tracking-widest text-[10px]">Kỹ thuật làm bài</strong><br><b>Multiple Choice Strategy:</b><ul class="list-decimal pl-5 mt-1.5 space-y-1"><li>Gạch chân từ khóa (keywords) trong câu hỏi.</li><li>Dùng từ khóa để scan vị trí đoạn văn tương ứng.</li><li>Đọc cẩn thận xung quanh vị trí chứa từ khóa.</li><li>Loại trừ (Eliminate) các đáp án sai rõ ràng (chứa từ tuyệt đối như <i>always, all, completely...</i>).</li></ul></div><p><br></p>`;
        } else if (type === 'tfng') {
            html = `<div class="bg-blue-50 border-l-4 border-blue-500 p-3 mb-2 text-sm text-blue-900 shadow-sm"><strong class="text-blue-700 uppercase tracking-widest text-[10px]">Kỹ thuật làm bài</strong><br><b>TFNG / YNNG Strategy:</b><ul class="list-decimal pl-5 mt-1.5 space-y-1"><li>Xác định "Chủ thể" và "Thông tin cần kiểm chứng" trong câu hỏi.</li><li>Tìm câu trong bài đọc nhắc đến chủ thể đó.</li><li>So sánh: Khớp hoàn toàn = <b>TRUE/YES</b>. Ngược nghĩa = <b>FALSE/NO</b>. Không nhắc đến thông tin cần kiểm chứng = <b>NOT GIVEN</b>.</li></ul></div><p><br></p>`;
        } else if (type === 'matching_heading') {
            html = `<div class="bg-blue-50 border-l-4 border-blue-500 p-3 mb-2 text-sm text-blue-900 shadow-sm"><strong class="text-blue-700 uppercase tracking-widest text-[10px]">Kỹ thuật làm bài</strong><br><b>Matching Headings Strategy:</b><ul class="list-decimal pl-5 mt-1.5 space-y-1"><li>Đọc lướt danh sách Heading để nắm ý chính, gạch chân điểm khác biệt giữa chúng.</li><li>Đọc câu đầu và câu cuối của mỗi đoạn văn (Topic Sentences).</li><li>Tìm Heading tóm tắt được toàn bộ ý của đoạn, tránh các Heading chỉ nhắc đến chi tiết nhỏ.</li></ul></div><p><br></p>`;
        } else if (type === 'matching_info') {
            html = `<div class="bg-blue-50 border-l-4 border-blue-500 p-3 mb-2 text-sm text-blue-900 shadow-sm"><strong class="text-blue-700 uppercase tracking-widest text-[10px]">Kỹ thuật làm bài</strong><br><b>Matching Information Strategy:</b><ul class="list-decimal pl-5 mt-1.5 space-y-1"><li>Nên làm dạng bài này <b>CUỐI CÙNG</b> vì nó yêu cầu đọc kỹ toàn bài.</li><li>Tìm kiếm các từ đồng nghĩa (synonyms) của câu hỏi trong đoạn văn thay vì tìm từ chính xác.</li></ul></div><p><br></p>`;
        } else if (type === 'gapfill') {
            html = `<div class="bg-blue-50 border-l-4 border-blue-500 p-3 mb-2 text-sm text-blue-900 shadow-sm"><strong class="text-blue-700 uppercase tracking-widest text-[10px]">Kỹ thuật làm bài</strong><br><b>Gap Fill Strategy:</b><ul class="list-decimal pl-5 mt-1.5 space-y-1"><li>Kiểm tra giới hạn từ (VD: NO MORE THAN TWO WORDS).</li><li>Xác định loại từ cần điền (Danh từ, Động từ, Tính từ...).</li><li>Dựa vào từ khóa xung quanh chỗ trống để định vị thông tin trong bài.</li></ul></div><p><br></p>`;
        }
        
        document.execCommand('insertHTML', false, html);
        if(window.triggerEditorAutosave) window.triggerEditorAutosave();
    };

    window.insertExplTemplate = function(editorId, type) {
        const editor = document.getElementById(editorId);
        if (!editor || !type) return;
        editor.focus();
        
        let html = '';
        if (type === 'paraphrase') {
            html = `<table class="w-full border-collapse border border-slate-300 mb-3 text-sm text-left bg-white shadow-sm"><thead><tr class="bg-emerald-50 text-emerald-900"><th class="border border-slate-300 p-2 font-bold w-1/3">Từ khóa (Question)</th><th class="border border-slate-300 p-2 font-bold w-1/3">Từ đồng nghĩa (Passage)</th><th class="border border-slate-300 p-2 font-bold w-1/3">Nghĩa tiếng Việt</th></tr></thead><tbody><tr><td class="border border-slate-300 p-2">...</td><td class="border border-slate-300 p-2 text-emerald-700 font-medium">...</td><td class="border border-slate-300 p-2">...</td></tr></tbody></table><p><br></p>`;
        } else if (type === 'grammar') {
            html = `<div class="bg-slate-50 border border-slate-200 p-4 rounded-lg mb-3 text-sm text-slate-800 shadow-sm"><strong class="text-indigo-600 uppercase tracking-widest text-[10px] block mb-1">🔍 Phân tích Ngữ pháp</strong>Cấu trúc: <span class="bg-white px-2 py-0.5 border border-slate-300 rounded font-mono text-indigo-600 font-bold">[Cấu trúc ngữ pháp]</span><br><br><b>Cách dùng trong bài:</b> [Giải thích cách tác giả sử dụng cấu trúc này để truyền đạt ý nghĩa...]</div><p><br></p>`;
        } else if (type === 'attitude') {
            html = `<div class="bg-slate-50 border border-slate-200 p-4 rounded-lg mb-3 text-sm text-slate-800 shadow-sm"><strong class="text-amber-600 uppercase tracking-widest text-[10px] block mb-1">🎭 Phân tích Thái độ tác giả</strong>Từ vựng thể hiện cảm xúc/thái độ: <b class="text-amber-700">[Nhập từ vựng]</b><br><br>=> Tác giả đang thể hiện thái độ <b>[Tích cực / Tiêu cực / Nghi ngờ / Khách quan]</b> về vấn đề này.</div><p><br></p>`;
        } else if (type === 'tfng') {
            html = `<div class="bg-slate-50 border border-slate-200 p-4 rounded-lg mb-3 text-sm text-slate-800 shadow-sm"><strong class="text-rose-600 uppercase tracking-widest text-[10px] block mb-2">⚖️ Logic Breakdown</strong><div class="grid grid-cols-[auto_1fr] gap-x-3 gap-y-2"><div class="font-bold text-slate-500">Câu hỏi:</div><div class="font-medium text-rose-700">[Ý nghĩa câu hỏi]</div><div class="font-bold text-slate-500">Bài đọc:</div><div class="font-medium text-emerald-700">[Trích dẫn/Ý nghĩa trong bài]</div></div><div class="mt-3 pt-2 border-t border-slate-200">=> <b>Kết luận:</b> Chọn <span class="bg-white px-2 py-0.5 border border-slate-300 rounded font-bold">[T/F/NG]</span> vì [Lý do].</div></div><p><br></p>`;
        }
        
        document.execCommand('insertHTML', false, html);
        if(window.triggerEditorAutosave) window.triggerEditorAutosave();
    };

    // --- 1. GRAMMAR FLASHCARDS ENGINE ---
    window.startTestGrammarStudy = function() {
        if (!window.APP_DATA || !window.APP_DATA.grammar || window.APP_DATA.grammar.length === 0) {
            if (typeof window.showToast === 'function') window.showToast("Notice", "No grammar highlights provided by the teacher for this test.", "info");
            return;
        }
        
        // Map grammar array to our temporary flashcard deck
        const tempDeck = window.APP_DATA.grammar.map((g, i) => ({
            id: 'temp_grammar_' + i,
            term: g.term || 'Phrase',
            def: (g.type ? `[${g.type}] ` : '') + (g.expl || 'Explanation'),
            repetition: 0, interval: 1, efactor: 2.5, nextReviewDate: 0
        }));
        
        FLASHCARDS['temp_test_deck'] = tempDeck;
        window.activeListId = 'temp_test_deck';
        window.currentListId = 'temp_test_deck';
        window.currentStudyDeckId = 'temp_test_deck';
        
        const selectEl = document.getElementById('panel-fc-list-select');
        if (selectEl) {
            let opt = selectEl.querySelector('option[value="temp_test_deck"]');
            if (!opt) {
                opt = document.createElement('option');
                opt.value = 'temp_test_deck';
                opt.style.display = 'none'; 
                selectEl.appendChild(opt);
            }
            opt.textContent = 'Test Grammar Highlight';
            selectEl.value = 'temp_test_deck';
            selectEl.dispatchEvent(new Event('change'));
        }
        
        const deckNameEl = document.getElementById('study-mode-deck-name');
        if (deckNameEl) deckNameEl.textContent = (APP_DATA.title || 'Test') + " (Grammar Bank)";
        
        document.getElementById('study-mode-modal').classList.remove('hidden');
        if (typeof window.switchStudyMode === 'function') window.switchStudyMode('flashcards');
    };

    // --- 2. GLOBAL TEST LEADERBOARD ENGINE ---
    window.showLeaderboardModal = function() {
        document.getElementById('test-leaderboard-modal').classList.remove('hidden');
        
        const selectEl = document.getElementById('leaderboard-test-select');
        if (!selectEl) return;
        
        // Extract unique tests from submissions
        const uniqueTests = {};
        SUBMISSIONS.forEach(s => {
            if (s.testId && s.testName) uniqueTests[s.testId] = s.testName;
        });

        let opts = '<option value="">-- Select a Test --</option>';
        for (let [id, name] of Object.entries(uniqueTests)) {
            opts += `<option value="${id}">${name}</option>`;
        }
        selectEl.innerHTML = opts;
        
        // Auto-select if currently viewing a test
        if (APP_DATA && APP_DATA.id && uniqueTests[APP_DATA.id]) {
            selectEl.value = APP_DATA.id;
            window.renderLeaderboardTable();
        } else {
            document.getElementById('leaderboard-table-body').innerHTML = `<tr><td colspan="5" class="text-center py-10 text-slate-400 font-medium">Please select a test above.</td></tr>`;
        }
    };

    window.renderLeaderboardTable = function() {
        const testId = document.getElementById('leaderboard-test-select').value;
        const tbody = document.getElementById('leaderboard-table-body');
        if (!testId) return;

        let subs = SUBMISSIONS.filter(s => s.testId === testId);
        
        // Sort by Accuracy (Score), then Speed (TimeTaken)
        subs.sort((a, b) => {
            const scoreA = parseFloat(String(a.score).split('/')[0]) || 0;
            const scoreB = parseFloat(String(b.score).split('/')[0]) || 0;
            if (scoreA !== scoreB) return scoreB - scoreA; // Highest score first
            
            const timeA = a.timeSpent || 999999;
            const timeB = b.timeSpent || 999999;
            return timeA - timeB; // Lowest time first
        });

        if (subs.length === 0) {
            tbody.innerHTML = `<tr><td colspan="5" class="text-center py-10 text-slate-400 font-medium">No attempts recorded yet.</td></tr>`;
            return;
        }

        tbody.innerHTML = subs.map((s, index) => {
            let rankBadge = `<span class="font-black text-slate-500">${index + 1}</span>`;
            if (index === 0) rankBadge = `<span class="text-2xl drop-shadow-sm">🥇</span>`;
            if (index === 1) rankBadge = `<span class="text-2xl drop-shadow-sm">🥈</span>`;
            if (index === 2) rankBadge = `<span class="text-2xl drop-shadow-sm">🥉</span>`;

            // Formatting Time Spent safely
            let formattedTime = "--:--";
            if (s.timeSpent) {
                const min = Math.floor(s.timeSpent / 60);
                const sec = s.timeSpent % 60;
                formattedTime = `${String(min).padStart(2,'0')}:${String(sec).padStart(2,'0')}`;
            }

            const modeBadge = (s.isTimeFree || !s.timeSpent) 
                ? `<span class="bg-emerald-50 text-emerald-600 border border-emerald-200 px-2 py-0.5 rounded text-[10px] font-black uppercase">Time-Free</span>`
                : `<span class="bg-rose-50 text-rose-600 border border-rose-200 px-2 py-0.5 rounded text-[10px] font-black uppercase">Restricted</span>`;

            return `
            <tr class="hover:bg-amber-50/30 transition-colors">
                <td class="p-4 text-center border-r border-slate-100">${rankBadge}</td>
                <td class="p-4 font-black text-slate-800 flex items-center gap-2">
                    <img src="https://ui-avatars.com/api/?name=${encodeURIComponent(s.student || '')}&background=random" alt="" class="w-6 h-6 rounded-full shadow-sm">
                    ${lmsEscapeHtml(s.student)}
                </td>
                <td class="p-4 text-center">${modeBadge}</td>
                <td class="p-4 text-center font-black text-blue-700 text-lg">${lmsEscapeHtml(s.score)}</td>
                <td class="p-4 text-right pr-8 font-mono text-slate-500 text-sm font-bold">${formattedTime}</td>
            </tr>`;
        }).join('');
    };

    // --- 3. GAMIFIED QUIZLET MATCH ENGINE ---
    let matchGameState = { activeCard: null, matches: 0, totalPairs: 0, timer: null, seconds: 0, listId: null };

    window.switchStudyMode = function(mode) {
        // Hide all tabs visually
        document.querySelectorAll('.study-tab-btn').forEach(b => {
            b.classList.remove('border-indigo-500', 'text-indigo-700', 'bg-indigo-50');
            b.classList.add('border-transparent', 'text-slate-500');
        });
        const activeTab = document.getElementById('study-tab-' + mode);
        if (activeTab) {
            activeTab.classList.remove('border-transparent', 'text-slate-500');
            activeTab.classList.add('border-indigo-500', 'text-indigo-700', 'bg-indigo-50');
        }

        const container = document.getElementById('study-mode-content');
        const listId = window.currentListId || window.currentStudyListId || 'temp_test_deck';
        const deck = FLASHCARDS[listId] || [];

        if (mode === 'matching') {
            window.launchMatchGame(deck, listId, container);
        } else {
            // Placeholder fallback for other modes until you build them out
            container.innerHTML = `
                <div class="text-center p-10 animate-fade-in-up">
                    <div class="text-6xl mb-4">🚧</div>
                    <h2 class="text-2xl font-black text-slate-800 mb-2">Mode in Development</h2>
                    <p class="text-slate-500 font-medium">Please switch to 'Matching' or 'Flashcards' to practice.</p>
                </div>
            `;
        }
    };

    window.launchMatchGame = function(deck, listId, container) {
        if (!deck || deck.length < 2) {
            container.innerHTML = `<div class="text-center p-10 text-slate-500 font-bold">You need at least 2 cards to play Match.</div>`;
            return;
        }

        // Shuffle & limit to 6 pairs (12 cards) for a manageable game board
        let pairs = [...deck].sort(() => 0.5 - Math.random()).slice(0, 6);
        matchGameState.totalPairs = pairs.length;
        matchGameState.matches = 0;
        matchGameState.seconds = 0;
        matchGameState.activeCard = null;
        matchGameState.listId = listId;

        clearInterval(matchGameState.timer);

        // Split into terms and definitions
        let cards = [];
        pairs.forEach((card, index) => {
            cards.push({ id: index, type: 'term', text: card.term });
            cards.push({ id: index, type: 'def', text: card.def });
        });
        
        // Shuffle all cards
        cards.sort(() => 0.5 - Math.random());

        // Render UI
        container.innerHTML = `
            <div class="w-full max-w-4xl mx-auto flex flex-col h-full animate-fade-in">
                <div class="flex justify-between items-center mb-6">
                    <h3 class="text-xl font-black text-slate-800">Match the pairs!</h3>
                    <div class="bg-white border-2 border-slate-200 px-4 py-2 rounded-xl shadow-sm flex items-center gap-3">
                        <span class="text-2xl animate-pulse">⏱️</span>
                        <span id="match-timer" class="font-mono text-2xl font-black text-indigo-700">0.0</span>
                    </div>
                </div>
                
                <div class="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4" id="match-game-board">
                    ${cards.map((c, i) => `
                        <button onclick="window.handleMatchClick(this, ${c.id}, '${c.type}')" 
                                class="match-card bg-white hover:bg-indigo-50 border-2 border-slate-200 hover:border-indigo-300 p-6 rounded-2xl shadow-sm transition-all duration-200 flex items-center justify-center text-center font-bold text-slate-700 select-none active:scale-95" 
                                style="min-height: 120px;" 
                                data-id="${c.id}" 
                                data-type="${c.type}">
                            ${c.text}
                        </button>
                    `).join('')}
                </div>
            </div>
        `;

        // Start High-Resolution Timer
        const startTime = Date.now();
        matchGameState.timer = setInterval(() => {
            matchGameState.seconds = ((Date.now() - startTime) / 1000).toFixed(1);
            document.getElementById('match-timer').textContent = matchGameState.seconds;
        }, 100);
    };

    window.handleMatchClick = function(btn, id, type) {
        if (btn.classList.contains('opacity-0')) return; // Already matched
        if (btn === matchGameState.activeCard) return; // Prevent double clicking same card

        // Select first card
        if (!matchGameState.activeCard) {
            matchGameState.activeCard = btn;
            btn.classList.add('border-indigo-500', 'bg-indigo-100', 'text-indigo-900', 'shadow-md');
            btn.classList.remove('border-slate-200', 'bg-white');
            return;
        }

        const firstCard = matchGameState.activeCard;
        const firstId = firstCard.dataset.id;
        const firstType = firstCard.dataset.type;

        // Check for match
        if (id == firstId && type !== firstType) {
            // MATCH!
            btn.classList.add('border-emerald-500', 'bg-emerald-100', 'text-emerald-900');
            firstCard.classList.remove('border-indigo-500', 'bg-indigo-100', 'text-indigo-900');
            firstCard.classList.add('border-emerald-500', 'bg-emerald-100', 'text-emerald-900');
            
            setTimeout(() => {
                btn.classList.add('opacity-0', 'pointer-events-none', 'scale-90');
                firstCard.classList.add('opacity-0', 'pointer-events-none', 'scale-90');
            }, 300);

            matchGameState.matches++;
            matchGameState.activeCard = null;

            // Check Win Condition
            if (matchGameState.matches === matchGameState.totalPairs) {
                clearInterval(matchGameState.timer);
                window.finishMatchGame();
            }
        } else {
            // MISMATCH!
            btn.classList.add('border-rose-500', 'bg-rose-100', 'text-rose-900', 'shake');
            firstCard.classList.remove('border-indigo-500', 'bg-indigo-100', 'text-indigo-900');
            firstCard.classList.add('border-rose-500', 'bg-rose-100', 'text-rose-900', 'shake');

            matchGameState.activeCard = null;

            setTimeout(() => {
                btn.classList.remove('border-rose-500', 'bg-rose-100', 'text-rose-900', 'shake');
                firstCard.classList.remove('border-rose-500', 'bg-rose-100', 'text-rose-900', 'shake');
                
                btn.classList.add('border-slate-200', 'bg-white');
                firstCard.classList.add('border-slate-200', 'bg-white');
            }, 600);
        }
    };

    window.finishMatchGame = async function() {
        const finalTime = matchGameState.seconds;
        const container = document.getElementById('study-mode-content');
        
        container.innerHTML = `
            <div class="text-center p-10 animate-scale-up">
                <div class="text-8xl mb-6">🎉</div>
                <h2 class="text-4xl font-black text-slate-800 mb-4 tracking-tight">You finished in <span class="text-indigo-600">${finalTime}</span> seconds!</h2>
                <button onclick="window.switchStudyMode('matching')" class="px-8 py-4 bg-indigo-600 hover:bg-indigo-700 text-white rounded-2xl font-black text-xl shadow-lg transition-all hover:-translate-y-1 mt-6">Play Again</button>
            </div>
        `;

        if (window.currentUser && matchGameState.listId !== 'temp_test_deck') {
            const record = {
                id: 'game_' + Date.now(),
                student: window.currentUser.user,
                listId: matchGameState.listId,
                time: parseFloat(finalTime),
                date: Date.now()
            };
            try {
                await window.fsSetDoc(window.fsDoc(window.db, window.fPath('game_leaderboards'), record.id), record);
                if (typeof window.showToast === 'function') window.showToast("Score Saved", "Your time has been added to the leaderboard!");
            } catch (e) { console.error("Could not save game score", e); }
        }
    };

    // --- SPACED REPETITION SYSTEM (SM-2) ---

    window.calculateSM2 = function(card, quality) {
        if (quality >= 3) {
            if (card.repetition === 0) {
                card.interval = 1;
            } else if (card.repetition === 1) {
                card.interval = 6;
            } else {
                card.interval = Math.round(card.interval * card.efactor);
            }
            card.repetition += 1;
        } else {
            card.repetition = 0;
            card.interval = 1;
        }

        card.efactor = card.efactor + (0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02));
        if (card.efactor < 1.3) card.efactor = 1.3;

        const ONE_DAY_MS = 24 * 60 * 60 * 1000;
        card.nextReviewDate = Date.now() + (card.interval * ONE_DAY_MS);
        
        return card;
    };

    window.startTestVocabStudy = function() {
        if (!APP_DATA || !APP_DATA.vocab || APP_DATA.vocab.length === 0) {
            if (typeof window.showToast === 'function') window.showToast("Notice", "No vocabulary provided by the teacher for this test.", "info");
            return;
        }
        
        // Map APP_DATA.vocab to a temporary flashcard deck
        const tempDeck = APP_DATA.vocab.map((v, i) => ({
            id: 'temp_test_' + i,
            term: v.term || 'Word',
            def: (v.eng ? v.eng + (v.vi ? ' / ' + v.vi : '') : v.vi) || 'Definition',
            repetition: 0,
            interval: 1,
            efactor: 2.5,
            nextReviewDate: 0
        }));
        
        // Save directly to the script-scoped FLASHCARDS variable
        FLASHCARDS['temp_test_deck'] = tempDeck;
        
        // Broadcast the active list ID to all likely global state variables
        window.activeListId = 'temp_test_deck';
        window.currentListId = 'temp_test_deck';
        window.currentStudyDeckId = 'temp_test_deck';
        window.activeStudyListId = 'temp_test_deck';
        try { activeListId = 'temp_test_deck'; } catch(e){}
        
        // ✨ THE CRITICAL FIX: Trigger the change event so the hidden JS engine registers the new active list
        const selectEl = document.getElementById('panel-fc-list-select');
        if (selectEl) {
            let opt = selectEl.querySelector('option[value="temp_test_deck"]');
            if (!opt) {
                opt = document.createElement('option');
                opt.value = 'temp_test_deck';
                opt.textContent = 'Test Vocabulary';
                opt.style.display = 'none'; 
                selectEl.appendChild(opt);
            }
            selectEl.value = 'temp_test_deck';
            
            // Dispatch the change event to force the Active Recall engine to update its internal state!
            selectEl.dispatchEvent(new Event('change'));
        }
        
        const deckNameEl = document.getElementById('study-mode-deck-name');
        if (deckNameEl) deckNameEl.textContent = (APP_DATA.title || 'Test') + " (Vocab Bank)";
        
        // If there's an explicit openStudyMode function natively tied to the engine, use it
        if (typeof window.openStudyMode === 'function') {
            window.openStudyMode('temp_test_deck');
            return;
        }
        
        document.getElementById('study-mode-modal').classList.remove('hidden');
        
        if (typeof window.switchStudyMode === 'function') {
            window.switchStudyMode('flashcards');
        }
    };

    window.submitFlashcardReview = async function(listId, cardId, quality) {
        const deck = FLASHCARDS[listId];
        if (!deck) return;
        
        const cardIndex = deck.findIndex(c => c.id === cardId);
        if (cardIndex === -1) return;
        
        deck[cardIndex] = window.calculateSM2(deck[cardIndex], quality);
        const reviewedAt = Date.now();
        const reviewHistory = Array.isArray(deck[cardIndex].reviewHistory) ? deck[cardIndex].reviewHistory : [];
        reviewHistory.push({ at: reviewedAt, quality });
        deck[cardIndex].reviewHistory = reviewHistory.filter(review => Number(review.at) >= reviewedAt - 30 * 24 * 60 * 60 * 1000);
        deck[cardIndex].lastReviewAt = reviewedAt;
        
        // ✨ FIX: Prevent cloud sync for temporary test decks! (Allows studying without polluting personal lists)
        if (listId === 'temp_test_deck') {
            if (document.getElementById('study-mode-modal') && !document.getElementById('study-mode-modal').classList.contains('hidden')) {
                if (typeof window.renderStudyFlashcard === 'function') window.renderStudyFlashcard();
            }
            return; 
        }

        if (currentUser?.isDemo) {
            sessionStorage.setItem('demo_flashcards', JSON.stringify(FLASHCARDS));
            if (typeof window.showToast === 'function') window.showToast("Progress Saved", "Demo progress is saved for this browser session.");
            if (document.getElementById('student-fc-panel') && !document.getElementById('student-fc-panel').classList.contains('hidden')) {
                window.renderFlashcardPanel();
            } else if (document.getElementById('study-mode-modal') && !document.getElementById('study-mode-modal').classList.contains('hidden')) {
                window.renderStudyFlashcard();
            }
            return;
        }
        
        try {
            const docId = `${currentUser.user}_${listId}`;
            await window.fsSetDoc(window.fsDoc(window.db, window.fPath('flashcards'), docId), { data: deck });
            window.showToast("Progress Saved", `Next review in ${deck[cardIndex].interval} day(s).`);
            
            // This triggers your UI to move to the next card
            if (document.getElementById('student-fc-panel') && !document.getElementById('student-fc-panel').classList.contains('hidden') && !document.getElementById('student-fc-panel').classList.contains('translate-x-full')) {
                if(typeof window.renderFlashcardPanel === 'function') window.renderFlashcardPanel();
            } 
            else if (document.getElementById('study-mode-modal') && !document.getElementById('study-mode-modal').classList.contains('hidden')) {
                if(typeof window.renderStudyFlashcard === 'function') window.renderStudyFlashcard();
            } 
        } catch (err) {
            console.error("SRS Sync Error:", err);
            window.showModalMsg("Error", "Could not sync progress to cloud.");
        }
    };

    // ✨ NEW: Robust Handlers for Custom Student Flashcard Creation
    window.openStudentFlashcardCreator = function(event) {
        if (event) { event.preventDefault(); event.stopPropagation(); }
        
        const tooltip = document.getElementById('exam-selection-tooltip');
        if (tooltip) tooltip.classList.add('hidden');
        
        const selection = window.getSelection();
        let term = '';
        if (selection && selection.rangeCount > 0) term = selection.toString().trim();
        window.openFlashcardForm(term);
    };

    window.openFlashcardForm = function(term = '', def = '', context = '') {
        const termInput = document.getElementById('fc-term-input');
        const defInput = document.getElementById('fc-def-input');
        const contextInput = document.getElementById('fc-context-input');
        const listSelect = document.getElementById('fc-list-select');
        if (!termInput || !defInput || !contextInput || !listSelect) return;

        termInput.value = term;
        defInput.value = def;
        contextInput.value = context;
        const listIds = Object.keys(FLASHCARDS || {}).filter(id => id !== 'temp_test_deck');
        listSelect.innerHTML = listIds.map(id => `<option value="${id}">${id.replace(/_/g, ' ')}</option>`).join('');
        if (!listIds.length) listSelect.innerHTML = '<option value="">Create a deck first</option>';
        if (window.activeFlashcardList && listIds.includes(window.activeFlashcardList)) {
            listSelect.value = window.activeFlashcardList;
        }
        document.getElementById('student-fc-modal').classList.remove('hidden');
    };

    window.createFlashcardDeck = function() {
        showInputPrompt("New Phrase Deck", "Enter a name for your phrase deck:", name => {
            const label = String(name || '').trim();
            const deckId = label.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
            if (!deckId) {
                if (typeof window.showToast === 'function') window.showToast("Invalid deck name", "Enter a name containing letters or numbers.", "error");
                return;
            }
            if (!FLASHCARDS[deckId]) FLASHCARDS[deckId] = [];
            const select = document.getElementById('fc-list-select');
            if (select) {
                select.innerHTML = Object.keys(FLASHCARDS).filter(id => id !== 'temp_test_deck')
                    .map(id => `<option value="${id}">${id.replace(/_/g, ' ')}</option>`).join('');
                select.value = deckId;
            }
            window.activeFlashcardList = deckId;
            if (currentUser?.isDemo) {
                sessionStorage.setItem('demo_flashcards', JSON.stringify(FLASHCARDS));
                return;
            }
            window.fsSetDoc(window.fsDoc(window.db, window.fPath('flashcards'), `${currentUser.user}_${deckId}`), { data: FLASHCARDS[deckId] })
                .catch(error => {
                    console.error('Unable to save flashcard deck:', error);
                    if (typeof window.showModalMsg === 'function') window.showModalMsg("Error", "Could not create the flashcard deck.");
                });
        });
    };

    window.closeStudentFlashcardCreator = function() {
        document.getElementById('student-fc-modal').classList.add('hidden');
    };

    window.promptCreateFcList = function() {
        showInputPrompt("New Flashcard List", "Enter a name for your new set:", (name) => {
            const listId = name.toLowerCase().replace(/[^a-z0-9]/g, '_');
            if (!listId) return;
            
            if (!FLASHCARDS[listId]) {
                FLASHCARDS[listId] = [];
                const selectEl = document.getElementById('fc-list-select');
                if (selectEl.options.length === 1 && selectEl.options[0].value === "") selectEl.innerHTML = '';
                
                const opt = document.createElement('option');
                opt.value = listId;
                opt.textContent = name;
                opt.selected = true;
                selectEl.appendChild(opt);
                
                if (typeof window.showToast === 'function') window.showToast("List Created", `Set '${name}' is ready.`);
            }
        });
    };

    window.saveStudentFlashcard = async function() {
        const term = document.getElementById('fc-term-input').value.trim();
        const def = document.getElementById('fc-def-input').value.trim();
        const context = document.getElementById('fc-context-input').value.trim();
        const listId = document.getElementById('fc-list-select').value;
        
        if (!term || !def) {
            if (typeof window.showToast === 'function') window.showToast("Error", "Term and Definition are required.", "error");
            return;
        }
        if (!listId) {
            if (typeof window.showToast === 'function') window.showToast("Error", "Please create or select a list first.", "error");
            return;
        }
        
        if (!FLASHCARDS[listId]) FLASHCARDS[listId] = [];
        FLASHCARDS[listId].push({
            id: 'card_' + Date.now(),
            term: term,
            def: def,
            repetition: 0,
            interval: 1,
            efactor: 2.5,
            nextReviewDate: 0
        });
        
        try {
            const docId = `${currentUser.user}_${listId}`;
            await window.fsSetDoc(window.fsDoc(window.db, window.fPath('flashcards'), docId), { data: FLASHCARDS[listId] });
            if (typeof window.showToast === 'function') window.showToast("Saved", `Added '${term}' to your set.`);
            window.closeStudentFlashcardCreator();
        } catch(e) {
            console.error(e);
            showModalMsg("Error", "Could not save card to cloud.");
        }
    };

    window.getCardsDueForReview = function(listId) {
        const deck = FLASHCARDS[listId] || [];
        const now = Date.now();
        let dueCards = deck.filter(card => !card.nextReviewDate || card.nextReviewDate <= now);
        dueCards.sort((a, b) => (a.nextReviewDate || 0) - (b.nextReviewDate || 0));
        return dueCards;
    };
    
