    window.toggleStudentFlashcardPanel = function(forceOpen = false) {
      if (routerReady && !appRouterApplying && currentUser?.role === 'student' &&
          document.getElementById('exam-ui')?.classList.contains('hidden') &&
          document.getElementById('review-ui')?.classList.contains('hidden')) {
        const panel = document.getElementById('student-fc-panel');
        window.navigateAppRoute(panel?.classList.contains('hidden')
          ? 'student/flashcards'
          : (window.studentFlashcardReturnRoute || 'student/dashboard'));
        return;
      }
      const p = document.getElementById('student-fc-panel');
      
      // Toggle logic targeting the new full-screen modal's 'hidden' state
      if (forceOpen || p.classList.contains('hidden')) {
        p.classList.remove('hidden');
        const sel = document.getElementById('panel-fc-list-select');
        const teacherDecks = getStudentStudyCardDecks();
        const kind = window.studentFlashcardKind || 'all';
        const escapeHtml = value => String(value).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
        const teacherOptions = Object.entries(teacherDecks)
          .filter(([, deck]) => kind === 'all' || deck.kind === kind)
          .map(([id, deck]) => `<option value="${escapeHtml(id)}">${escapeHtml(deck.label)}</option>`)
          .join('');
        let examVocabOptions = '';
        const isExamActive = document.getElementById('exam-ui') && !document.getElementById('exam-ui').classList.contains('hidden');
        if (isExamActive && APP_DATA && APP_DATA.vocab && APP_DATA.vocab.length > 0) {
            const partsWithVocab = [...new Set(APP_DATA.vocab.map(v => v.part || 'Global'))];
            examVocabOptions = partsWithVocab.map(part => `<option value="tv_${escapeHtml(part)}">📌 Test Vocab: ${escapeHtml(part)}</option>`).join('');
        }
        const personalOptions = (kind === 'all' || kind === 'personal')
          ? Object.keys(FLASHCARDS).filter(id => id !== 'temp_test_deck').map(id => `<option value="${escapeHtml(id)}">📁 My Deck: ${escapeHtml(id)}</option>`).join('')
          : '';
        sel.innerHTML = examVocabOptions + teacherOptions + personalOptions;
        
        if (sel.options.length === 0) {
            sel.innerHTML = `<option value="">${kind === 'grammar' ? 'No grammar cards available' : kind === 'vocab' ? 'No vocabulary cards available' : 'No decks available'}</option>`;
        }
        
        window.renderFlashcardPanel();
      } else {
        p.classList.add('hidden');
      }
    };

    window.openStudentFlashcards = function(kind = 'all') {
      window.studentFlashcardKind = ['vocab', 'grammar', 'personal'].includes(kind) ? kind : 'all';
      window.studentFlashcardReturnRoute = 'student/study-tools';
      window.toggleStudentFlashcardPanel(true);
    };
    
    function promptCreateFcList() {
      showInputPrompt("New List", "Name your flashcard deck:", async (name) => {
        if(!FLASHCARDS[name]) FLASHCARDS[name] = [];
        const docId = `${currentUser.user}_${name}`;
        await window.fsSetDoc(window.fsDoc(window.db, window.fPath('flashcards'), docId), {data: FLASHCARDS[name]});
        document.getElementById('fc-list-select').innerHTML = Object.keys(FLASHCARDS).map(k => `<option value="${k}">📁 My Deck: ${k}</option>`).join('');
        document.getElementById('fc-list-select').value = name;
      });
    }

    function openStudentFlashcardCreator(e) {
      e.preventDefault(); e.stopPropagation(); document.getElementById('exam-selection-tooltip').classList.add('hidden');
      const sel = window.getSelection().toString().trim();
      if(!sel) return;
      const testTitle = (APP_DATA && APP_DATA.title) ? APP_DATA.title : 'My List';
      
      if(!FLASHCARDS[testTitle]) { 
          FLASHCARDS[testTitle] = []; 
          if (currentUser?.isDemo) {
              sessionStorage.setItem('demo_flashcards', JSON.stringify(FLASHCARDS));
          } else {
              const docId = `${currentUser.user}_${testTitle}`;
              window.fsSetDoc(window.fsDoc(window.db, window.fPath('flashcards'), docId), {data: []}).catch(error => {
                  console.error('Unable to create flashcard deck:', error);
                  window.showModalMsg("Error", "Could not create the flashcard deck.");
              });
          }
      }
      window.activeFlashcardList = testTitle;
      window.openFlashcardForm(sel);
    }
    
    window.saveStudentFlashcard = async function() {
        const term = document.getElementById('fc-term-input').value.trim();
        const def = document.getElementById('fc-def-input').value.trim();
        const context = document.getElementById('fc-context-input').value.trim();
        const listId = document.getElementById('fc-list-select').value;
        
        if (!term || !def || !listId) {
            window.showModalMsg("Error", "Please fill in all fields.");
            return;
        }

        if (!FLASHCARDS[listId]) FLASHCARDS[listId] = [];

        const now = Date.now();
        const newCard = {
            id: 'fc_' + Date.now(),
            term: term,
            def: def,
            context,
            list: listId,
            
            // --- ✨ SM-2 Spaced Repetition Fields ---
            repetition: 0,
            interval: 1,
            efactor: 2.5,
            nextReviewDate: now,
            reviewHistory: []
        };

        FLASHCARDS[listId].push(newCard);

        try {
            if (currentUser?.isDemo) {
                sessionStorage.setItem('demo_flashcards', JSON.stringify(FLASHCARDS));
            } else {
                const docId = `${currentUser.user}_${listId}`;
                await window.fsSetDoc(window.fsDoc(window.db, window.fPath('flashcards'), docId), { data: FLASHCARDS[listId] });
            }
            window.showToast("Saved", "Flashcard added successfully!");
            
            document.getElementById('student-fc-modal').classList.add('hidden');
            document.getElementById('fc-term-input').value = '';
            document.getElementById('fc-def-input').value = '';
            document.getElementById('fc-context-input').value = '';
            
            if (!document.getElementById('student-fc-panel').classList.contains('translate-x-full')) {
                window.renderFlashcardPanel();
            }
        } catch (err) {
            FLASHCARDS[listId] = FLASHCARDS[listId].filter(card => card.id !== newCard.id);
            console.error(err);
            window.showModalMsg("Error", "Failed to save flashcard.");
        }
    };

    // Overwrite or update your renderFlashcardPanel function to use Spaced Repetition:
    window.renderFlashcardPanel = function() {
        const select = document.getElementById('panel-fc-list-select');
        const container = document.getElementById('panel-fc-container');
        if (!select || !container) return;

        const lists = Object.keys(FLASHCARDS);
        if (lists.length === 0 && (!select.options || select.options.length === 0)) {
            select.innerHTML = '<option value="">No Flashcard Decks Found</option>';
            container.innerHTML = '<div class="flex flex-col items-center justify-center h-full"><span class="text-6xl mb-4 block grayscale opacity-50">🗂️</span><h3 class="text-2xl font-black text-slate-800 mb-2 tracking-tight">No Decks Found</h3><p class="text-slate-500 font-medium">Create a flashcard deck or review a test to start studying.</p></div>';
            return;
        }

        const activeList = select.value || lists[0];
        const dueCards = window.getCardsDueForReview(activeList);
        const isTeacherDeck = activeList.startsWith('tv_') || activeList.startsWith('teacher_');

        if (dueCards.length === 0) {
            container.innerHTML = `<div class="flex flex-col items-center justify-center h-full text-center animate-scale-up"><span class="text-7xl mb-4 block drop-shadow-md">🎉</span><h3 class="text-3xl font-black text-slate-800 mb-2 tracking-tight">All Caught Up!</h3><p class="text-slate-500 font-medium text-lg">You have reviewed all flashcards in this deck for today.</p></div>`;
            return;
        }

        const card = dueCards[0];
        const safeList = activeList.replace(/'/g, "\\'");
        const safeId = card.id || '';
        const safeTerm = (card.term || '').replace(/'/g, "\\'").replace(/"/g, '&quot;');

        container.innerHTML = `
            <div class="flex flex-col w-full max-w-4xl mx-auto h-full animate-fade-in">
                <div class="text-sm font-black text-slate-400 uppercase tracking-widest text-center mb-4 mt-2 shrink-0">
                    \${isTeacherDeck ? \`Reviewing Teacher \${activeList.startsWith('teacher_grammar_') ? 'Grammar' : 'Vocabulary'}\` : \`Due Reviews Left: <span class="text-blue-600">\${dueCards.length}</span>\`}
                </div>
                
                <div class="flip-card perspective-1000 flex-1 flex items-stretch justify-center my-2 cursor-pointer group relative w-full shrink-0 min-h-[350px]" onclick="this.classList.toggle('flipped')">
                    \${isTeacherDeck ? \`<button onclick="event.stopPropagation(); window.importCardToMine('\${safeTerm}', '\${safeList}', '\${safeId}')" class="absolute -top-4 -right-4 w-12 h-12 bg-blue-600 text-white rounded-full font-black shadow-lg opacity-0 group-hover:opacity-100 transition z-20 text-3xl leading-none flex items-center justify-center hover:scale-110 hover:bg-blue-700" aria-label="Save to my flashcards">+</button>\` : ''}
                    
                    <div class="flip-card-inner relative w-full h-full text-center transition-transform duration-500 rounded-[2.5rem] shadow-xl" style="transform-style: preserve-3d;">
                        
                        <div class="flip-card-front absolute inset-0 bg-gradient-to-br from-blue-700 to-blue-900 border-4 border-blue-800 rounded-[2.5rem] p-6 md:p-10 flex flex-col items-center justify-center text-white shadow-inner" style="-webkit-backface-visibility: hidden; backface-visibility: hidden;">
                            <span class="text-xs font-black text-blue-200 uppercase tracking-widest absolute top-6 bg-blue-950/50 px-4 py-1.5 rounded-full border border-blue-400/20">Tap to Flip 🔄</span>
                            <h3 class="text-4xl md:text-5xl lg:text-6xl font-black tracking-tight drop-shadow-lg px-4 leading-snug">\${card.term}</h3>
                        </div>

                        <div class="flip-card-back absolute inset-0 bg-white border-4 border-slate-200 rounded-[2.5rem] p-6 md:p-10 flex flex-col items-center justify-center" style="-webkit-backface-visibility: hidden; backface-visibility: hidden; transform: rotateY(180deg) translateZ(1px);">
                            <span class="text-xs font-black text-slate-400 uppercase tracking-widest absolute top-6 bg-slate-100 px-4 py-1.5 rounded-full border border-slate-200">Definition</span>
                            <div class="w-full h-full flex flex-col justify-center items-center overflow-y-auto mt-8 custom-scrollbar">
                                <p class="text-xl md:text-2xl lg:text-3xl font-bold text-slate-700 leading-relaxed px-2 md:px-6 w-full">\${card.def}</p>
                            </div>
                        </div>
                    </div>
                </div>

                <div class="bg-white p-5 md:p-8 rounded-[2rem] border border-slate-200 shadow-sm mt-6 w-full shrink-0">
                    <p class="text-[10px] md:text-xs font-black text-slate-500 text-center mb-3 md:mb-4 uppercase tracking-widest">How well did you recall this?</p>
                    <div class="grid grid-cols-2 lg:grid-cols-4 gap-3">
                        <button onclick="window.submitFlashcardReview('\${safeList}', '\${safeId}', 0, '\${safeTerm}')" class="py-3 md:py-4 bg-rose-50 hover:bg-rose-100 text-rose-700 font-black rounded-xl text-sm transition border-2 border-rose-200 shadow-sm flex items-center justify-center gap-2 hover:-translate-y-0.5">0: Blank <span>❌</span></button>
                        <button onclick="window.submitFlashcardReview('\${safeList}', '\${safeId}', 2, '\${safeTerm}')" class="py-3 md:py-4 bg-orange-50 hover:bg-orange-100 text-orange-700 font-black rounded-xl text-sm transition border-2 border-orange-200 shadow-sm flex items-center justify-center gap-2 hover:-translate-y-0.5">2: Hard <span>⚠️</span></button>
                        <button onclick="window.submitFlashcardReview('\${safeList}', '\${safeId}', 4, '\${safeTerm}')" class="py-3 md:py-4 bg-blue-50 hover:bg-blue-100 text-blue-700 font-black rounded-xl text-sm transition border-2 border-blue-200 shadow-sm flex items-center justify-center gap-2 hover:-translate-y-0.5">4: Good <span>👍</span></button>
                        <button onclick="window.submitFlashcardReview('\${safeList}', '\${safeId}', 5, '\${safeTerm}')" class="py-3 md:py-4 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 font-black rounded-xl text-sm transition border-2 border-emerald-200 shadow-sm flex items-center justify-center gap-2 hover:-translate-y-0.5">5: Easy <span>🌟</span></button>
                    </div>
                </div>
            </div>
        `;
    };

    window.importCardToMine = async function(term, sourceListId, sourceCardId) {
      const sourceDeck = sourceListId ? getStudentStudyCardDecks()[sourceListId] : null;
      const v = sourceDeck?.cards.find(card => card.id === sourceCardId)
        || (APP_DATA?.vocab || []).find(card => card.term === term);
      if (!v) {
          window.showToast('Card unavailable', 'This study card could not be found. Refresh the page and try again.');
          return;
      }
      let textLines = [];
      if(v.lvl) textLines.push(`Level: ${v.lvl}`);
      if(v.pron) textLines.push(`[${v.pron}]`);
      if(v.eng) textLines.push(`EN: ${v.eng}`);
      if(v.vi) textLines.push(`VI: ${v.vi}`);
      if(v.syn) textLines.push(`Syn: ${v.syn}`);
      if(v.ant) textLines.push(`Ant: ${v.ant}`);
      if (v.def && !v.eng && !v.vi) textLines.push(v.def);
      const listIds = Object.keys(FLASHCARDS).filter(id => id !== 'temp_test_deck');
      let defaultList = listIds[0];
      if (!defaultList) {
          defaultList = 'my_phrases';
          FLASHCARDS[defaultList] = [];
          if (currentUser?.isDemo) {
              sessionStorage.setItem('demo_flashcards', JSON.stringify(FLASHCARDS));
          } else {
              try {
                  await window.fsSetDoc(window.fsDoc(window.db, window.fPath('flashcards'), `${currentUser.user}_${defaultList}`), { data: [] });
              } catch (error) {
                  delete FLASHCARDS[defaultList];
                  console.error('Unable to create phrase deck:', error);
                  window.showModalMsg("Error", "Could not create a phrase deck for this card.");
                  return;
              }
          }
      }
      window.activeFlashcardList = defaultList;
      window.openFlashcardForm(v.term, textLines.join('\n'), v.example || v.context || '');
    }

    // ==========================================
    // 🧠 SRS & FLASHCARD PANEL OVERRIDES
    // ==========================================
    
    window.getCardsDueForReview = function(listId) {
        if (!listId) return [];
        if (listId.startsWith('teacher_')) {
            return getStudentStudyCardDecks()[listId]?.cards || [];
        }
        if (listId.startsWith('tv_')) {
            const partName = listId.replace('tv_', '');
            return (APP_DATA.vocab || []).filter(v => (v.part || 'Global') === partName).map((c, idx) => ({
                id: 'temp_' + idx, term: c.term, def: c.eng || c.vi || c.def || ''
            }));
        }
        
        const deck = FLASHCARDS[listId] || [];
        const now = Date.now();
        
        // Auto-patch older legacy cards that don't have SM-2 data or IDs
        let needsSave = false;
        deck.forEach((c, i) => {
            if (!c.id) { c.id = 'fc_leg_' + i + '_' + Date.now(); needsSave = true; }
            if (c.repetition === undefined) {
                c.repetition = 0; c.interval = 0; c.efactor = 2.5; c.nextReviewDate = 0; needsSave = true;
            }
            if (!Array.isArray(c.reviewHistory)) c.reviewHistory = [];
        });
        
        if (needsSave && currentUser && !currentUser.isDemo) {
             window.fsSetDoc(window.fsDoc(window.db, window.fPath('flashcards'), `${currentUser.user}_${listId}`), { data: deck }).catch(error => {
                 console.error('Unable to migrate flashcard review data:', error);
                 if (!window.flashcardMigrationWarningShown) {
                     window.flashcardMigrationWarningShown = true;
                     window.showModalMsg("Flashcard Sync Error", "Could not prepare your old flashcards for spaced repetition. Check your connection and try again.");
                 }
             });
        }
        
        let dueCards = deck.filter(card => !card.nextReviewDate || card.nextReviewDate <= now);
        dueCards.sort((a, b) => (a.nextReviewDate || 0) - (b.nextReviewDate || 0));
        return dueCards;
    };

    window.submitFlashcardReview = async function(listId, cardId, quality, cardTerm) {
        if (listId.startsWith('tv_') || listId.startsWith('teacher_')) {
            window.showModalMsg("Teacher Deck", "To use Spaced Repetition tracking, please click the '+' button on the flashcard to save it to your personal list first.");
            return;
        }

        const deck = FLASHCARDS[listId];
        if (!deck) return;
        
        let cardIndex = deck.findIndex(c => c.id === cardId);
        if (cardIndex === -1) cardIndex = deck.findIndex(c => c.term === cardTerm);
        if (cardIndex === -1) {
            window.showToast("Error", "Could not find card to update.");
            return;
        }

        const previousCard = JSON.parse(JSON.stringify(deck[cardIndex]));
        const reviewedAt = Date.now();
        const reviewedCard = window.calculateSM2(deck[cardIndex], quality);
        const reviewHistory = Array.isArray(previousCard.reviewHistory) ? previousCard.reviewHistory : [];
        reviewHistory.push({ at: reviewedAt, quality });
        reviewedCard.reviewHistory = reviewHistory.filter(review => Number(review.at) >= reviewedAt - 30 * 24 * 60 * 60 * 1000).slice(-100);
        reviewedCard.lastReviewAt = reviewedAt;
        deck[cardIndex] = reviewedCard;

        try {
            if (currentUser?.isDemo) {
                sessionStorage.setItem('demo_flashcards', JSON.stringify(FLASHCARDS));
            } else {
                const docId = `${currentUser.user}_${listId}`;
                await window.fsSetDoc(window.fsDoc(window.db, window.fPath('flashcards'), docId), { data: deck });
            }
            window.showToast("Progress Saved", `Next review in ${deck[cardIndex].interval} day(s).`);
            if (document.getElementById('student-fc-panel') && !document.getElementById('student-fc-panel').classList.contains('hidden')) {
                window.renderFlashcardPanel();
            }
            if (document.getElementById('study-mode-modal') && !document.getElementById('study-mode-modal').classList.contains('hidden')) {
                window.renderStudyFlashcard();
            }
        } catch (error) {
            deck[cardIndex] = previousCard;
            console.error("SRS Sync Error:", error);
            if (document.getElementById('student-fc-panel') && !document.getElementById('student-fc-panel').classList.contains('hidden')) {
                window.renderFlashcardPanel();
            }
            window.showModalMsg("Sync Error", "Could not save your flashcard review. Your progress was not recorded; please try again.");
        }
    };

    window.renderFlashcardPanel = function() {
        const select = document.getElementById('panel-fc-list-select');
        if (!select) return;
        const container = document.getElementById('panel-fc-container');
        if (!container) return;

        const escapeHtml = value => String(value ?? '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
        const teacherOptions = Array.from(select.options)
            .filter(option => option.value.startsWith('tv_') || option.value.startsWith('teacher_'))
            .map(option => ({ value: option.value, label: option.textContent }));
        const kind = window.studentFlashcardKind || 'all';
        const listIds = kind === 'all' || kind === 'personal'
            ? Object.keys(FLASHCARDS || {}).filter(id => id !== 'temp_test_deck')
            : [];
        const previousSelection = select.value;
        select.innerHTML = [
            ...teacherOptions.map(option => `<option value="${escapeHtml(option.value)}">${escapeHtml(option.label)}</option>`),
            ...listIds.map(id => `<option value="${escapeHtml(id)}">📁 My Deck: ${escapeHtml(id.replace(/_/g, ' '))}</option>`)
        ].join('');

        if (!select.options.length) {
            const emptyLabel = kind === 'grammar'
                ? window.studentText('No grammar cards available', 'Không có thẻ ngữ pháp')
                : kind === 'vocab'
                    ? window.studentText('No vocabulary cards available', 'Không có thẻ từ vựng')
                    : window.studentText('No decks available', 'Không có bộ thẻ');
            select.innerHTML = `<option value="">${escapeHtml(emptyLabel)}</option>`;
        }
        if (select.options.length === 1 && !select.options[0].value) {
            const emptyMessage = kind === 'grammar'
                ? window.studentText('No grammar flashcards are available for your class yet.', 'Lớp của bạn chưa có thẻ ngữ pháp.')
                : kind === 'vocab'
                    ? window.studentText('No vocabulary flashcards are available for your class yet.', 'Lớp của bạn chưa có thẻ từ vựng.')
                    : window.studentText('No flashcard decks are available yet.', 'Chưa có bộ thẻ ghi nhớ nào.');
            container.innerHTML = `<div class="p-8 text-center text-slate-600"><p class="font-bold text-lg mb-2">${escapeHtml(emptyMessage)}</p></div>`;
            return;
        }
        if ([...select.options].some(option => option.value === previousSelection)) select.value = previousSelection;

        const activeList = select.value;
        window.activeFlashcardList = activeList;
        const dueCards = window.getCardsDueForReview(activeList);
        const isTeacherDeck = activeList.startsWith('tv_') || activeList.startsWith('teacher_');
        const deck = FLASHCARDS[activeList] || [];
        const escapeRegExp = value => String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const firstDueCard = dueCards[0];
        const recallPrompt = firstDueCard && typeof firstDueCard.context === 'string' && firstDueCard.context.trim()
            ? firstDueCard.context.replace(new RegExp(escapeRegExp(firstDueCard.term), 'ig'), '_____')
            : firstDueCard?.def || firstDueCard?.eng || firstDueCard?.vi || 'Recall the phrase from its meaning.';
        const weekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
        const recentReviews = deck.flatMap(card => Array.isArray(card.reviewHistory) ? card.reviewHistory : [])
            .filter(review => Number(review.at) >= weekAgo);
        const recalledReviews = recentReviews.filter(review => Number(review.quality) >= 3).length;
        const recallRate = recentReviews.length ? Math.round(recalledReviews / recentReviews.length * 100) : null;
        const statsHtml = `
            <div class="grid grid-cols-2 md:grid-cols-3 gap-3 mb-5">
                <div class="bg-white border border-slate-200 rounded-xl p-3 text-center shadow-sm">
                    <div class="text-[10px] font-black uppercase tracking-wider text-slate-400">Recall rate · 7 days</div>
                    <div class="text-xl font-black text-indigo-700 mt-1">${recallRate === null ? '—' : `${recallRate}%`}</div>
                    <div class="text-[10px] text-slate-500">${recentReviews.length ? `${recalledReviews}/${recentReviews.length} recalls rated` : 'Rate reviews to start tracking'}</div>
                </div>
                <div class="bg-white border border-slate-200 rounded-xl p-3 text-center shadow-sm">
                    <div class="text-[10px] font-black uppercase tracking-wider text-slate-400">Due now</div>
                    <div class="text-xl font-black text-amber-600 mt-1">${dueCards.length}</div>
                    <div class="text-[10px] text-slate-500">cards to review</div>
                </div>
                <div class="bg-white border border-slate-200 rounded-xl p-3 text-center shadow-sm col-span-2 md:col-span-1">
                    <div class="text-[10px] font-black uppercase tracking-wider text-slate-400">In this deck</div>
                    <div class="text-xl font-black text-slate-700 mt-1">${deck.length || (isTeacherDeck ? dueCards.length : 0)}</div>
                    <div class="text-[10px] text-slate-500">phrase cards</div>
                </div>
            </div>`;

        container.innerHTML = `
            <div class="w-full max-w-4xl mx-auto animate-fade-in">
                ${statsHtml}
                ${dueCards.length ? `
                    <div class="text-xs font-black text-slate-400 uppercase tracking-widest text-center mb-3">${isTeacherDeck ? `Teacher ${activeList.startsWith('teacher_grammar_') ? 'grammar' : 'vocabulary'} · save a card to track recall` : `Due reviews · ${dueCards.length} remaining`}</div>
                    <div class="flip-card perspective-1000 w-full min-h-[300px] md:min-h-[360px] cursor-pointer group relative mb-5" onclick="this.classList.toggle('flipped')">
                        ${isTeacherDeck ? '<button id="flashcard-import-current" type="button" class="absolute top-3 right-3 z-20 w-11 h-11 bg-blue-600 text-white rounded-full font-black shadow-lg text-2xl">+</button>' : ''}
                        <div class="flip-card-inner relative w-full h-full min-h-[300px] md:min-h-[360px] text-center transition-transform duration-500" style="transform-style:preserve-3d">
                            <div class="flip-card-front absolute inset-0 bg-gradient-to-br from-blue-700 to-blue-900 border-4 border-blue-800 rounded-[2rem] p-6 md:p-10 flex flex-col items-center justify-center text-white" style="backface-visibility:hidden">
                                <span class="text-xs font-black text-blue-200 uppercase tracking-widest mb-6">Recall the whole phrase · tap to reveal</span>
                                <p class="text-xl md:text-3xl font-bold leading-relaxed whitespace-pre-wrap">${escapeHtml(recallPrompt)}</p>
                            </div>
                            <div class="flip-card-back absolute inset-0 bg-white border-4 border-slate-200 rounded-[2rem] p-6 md:p-10 flex flex-col items-center justify-center overflow-y-auto" style="backface-visibility:hidden;transform:rotateY(180deg)">
                                <span class="text-xs font-black text-slate-400 uppercase tracking-widest mb-3">Phrase / chunk</span>
                                <h3 class="text-2xl md:text-4xl font-black text-indigo-800 leading-snug mb-4">${escapeHtml(dueCards[0].term)}</h3>
                                <span class="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Meaning / translation</span>
                                <p class="text-base md:text-xl font-bold text-slate-700 leading-relaxed whitespace-pre-wrap">${escapeHtml(dueCards[0].def || dueCards[0].eng || dueCards[0].vi || 'No definition provided.')}</p>
                                ${dueCards[0].context ? `<div class="mt-4 pt-3 border-t border-slate-200 w-full text-left"><div class="text-[10px] font-black uppercase tracking-wider text-indigo-500 mb-1">Example in context</div><p class="text-sm md:text-base text-slate-600 italic whitespace-pre-wrap">${escapeHtml(dueCards[0].context)}</p></div>` : ''}
                            </div>
                        </div>
                    </div>
                    ${isTeacherDeck ? '<p class="text-center text-xs text-slate-500 mb-4">Save this phrase to your deck to start spaced-repetition tracking.</p>' : `
                    <div class="bg-white p-4 md:p-6 rounded-2xl border border-slate-200 shadow-sm">
                        <p class="text-[10px] md:text-xs font-black text-slate-500 text-center mb-3 uppercase tracking-widest">How well did you recall the entire phrase?</p>
                        <div class="grid grid-cols-2 lg:grid-cols-4 gap-3">
                            <button type="button" data-review-quality="0" disabled class="py-3 bg-rose-50 hover:bg-rose-100 text-rose-700 font-black rounded-xl text-sm border-2 border-rose-200 disabled:opacity-40">Blank · ❌</button>
                            <button type="button" data-review-quality="2" disabled class="py-3 bg-orange-50 hover:bg-orange-100 text-orange-700 font-black rounded-xl text-sm border-2 border-orange-200 disabled:opacity-40">Hard · ⚠️</button>
                            <button type="button" data-review-quality="4" disabled class="py-3 bg-blue-50 hover:bg-blue-100 text-blue-700 font-black rounded-xl text-sm border-2 border-blue-200 disabled:opacity-40">Good · 👍</button>
                            <button type="button" data-review-quality="5" disabled class="py-3 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 font-black rounded-xl text-sm border-2 border-emerald-200 disabled:opacity-40">Easy · 🌟</button>
                        </div>
                    </div>`}
                ` : `<div class="p-8 text-center bg-white rounded-2xl border border-slate-200"><span class="text-5xl block mb-3">🎉</span><h3 class="text-2xl font-black text-slate-800 mb-2">All caught up</h3><p class="text-sm text-slate-500">No cards are due right now. Add a phrase or come back when the next review is due.</p></div>`}
            </div>`;

        const importButton = document.getElementById('flashcard-import-current');
        if (importButton) {
            importButton.addEventListener('click', event => {
                event.stopPropagation();
                window.importCardToMine(dueCards[0].term, activeList, dueCards[0].id);
            });
        }
        const recallCard = container.querySelector('.flip-card');
        if (recallCard && !isTeacherDeck) {
            recallCard.addEventListener('click', () => {
                const hasRevealedAnswer = recallCard.classList.contains('flipped');
                container.querySelectorAll('[data-review-quality]').forEach(button => { button.disabled = !hasRevealedAnswer; });
            });
        }
        container.querySelectorAll('[data-review-quality]').forEach(button => {
            button.addEventListener('click', () => {
                window.submitFlashcardReview(activeList, dueCards[0].id, Number(button.dataset.reviewQuality));
            });
        });
    };


    // ==========================================
    // ✨ ACTIVE RECALL STUDY SYSTEM
    // ==========================================
    
    window.studyDeckName = '';
    window.studyDeck = [];
    window.studyMode = 'flashcards';
    window.studyIdx = 0;
    
    // Quiz & Write specific state
    window.studyScore = 0;
    window.studyHasAnswered = false;

    // Matching specific state
    window.matchTiles = [];
    window.matchSelectedElement = null;
    window.matchSelectedData = null;
    window.matchPairsFound = 0;

    window.openStudyMode = function(deckName) {
        window.studyDeckName = deckName;
        
        // Grab the deck data (either from teacher's test vocab or student's private lists)
        let rawCards = [];
        if (deckName === 'teacher_vocab') rawCards = APP_DATA.vocab || [];
        else rawCards = FLASHCARDS[deckName] || [];

        // Normalize data format so modes can easily read terms and definitions
        window.studyDeck = rawCards.map(c => ({
            term: c.term,
            def: c.def || c.eng || c.vi || 'No definition provided.'
        }));

        if (window.studyDeck.length < 2) {
            showModalMsg("Not Enough Cards", "You need at least 2 cards in this deck to use Study Mode.");
            return;
        }

        document.getElementById('study-mode-deck-name').textContent = deckName === 'teacher_vocab' ? '📌 Test Vocab' : `📁 ${deckName}`;
        document.getElementById('study-mode-modal').classList.remove('hidden');
        window.switchStudyMode('flashcards');
    };

    window.closeStudyMode = function() {
        document.getElementById('study-mode-modal').classList.add('hidden');
    };

    window.switchStudyMode = function(mode) {
        window.studyMode = mode;
        window.studyIdx = 0;
        window.studyScore = 0;
        
        // Update Tab UI
        document.querySelectorAll('.study-tab-btn').forEach(btn => {
            btn.classList.remove('text-indigo-700', 'border-indigo-600', 'bg-indigo-50');
            btn.classList.add('text-slate-500', 'border-transparent');
        });
        const activeTab = document.getElementById(`study-tab-${mode}`);
        if(activeTab) {
            activeTab.classList.add('text-indigo-700', 'border-indigo-600', 'bg-indigo-50');
            activeTab.classList.remove('text-slate-500', 'border-transparent');
        }

        const content = document.getElementById('study-mode-content');
        content.innerHTML = ''; // Clear out

        // Shuffle deck for everything except Flashcards
        if (mode !== 'flashcards') {
            window.studyDeck.sort(() => Math.random() - 0.5);
        }

        if (mode === 'flashcards') window.renderStudyFlashcard();
        else if (mode === 'quiz') window.renderStudyQuiz();
        else if (mode === 'write') window.renderStudyWrite();
        else if (mode === 'matching') window.initStudyMatching();
    };

    // --- MODE 1: FLASHCARDS ---
    window.renderStudyFlashcard = function() {
        const content = document.getElementById('study-mode-content');
        if (window.studyIdx >= window.studyDeck.length) window.studyIdx = 0;
        if (window.studyIdx < 0) window.studyIdx = window.studyDeck.length - 1;
        
        const card = window.studyDeck[window.studyIdx];
        
        content.innerHTML = `
            <div class="w-full max-w-2xl flex flex-col h-full justify-center">
                <div class="text-center font-bold text-slate-400 uppercase tracking-widest mb-4">Card ${window.studyIdx + 1} of ${window.studyDeck.length}</div>
                <div class="flip-card w-full h-[400px] cursor-pointer perspective-1000 group" onclick="this.classList.toggle('flipped')">
                    <div class="flip-card-inner w-full h-full relative shadow-xl rounded-3xl transition-transform duration-500">
                        <!-- Front -->
                        <div class="flip-card-front absolute w-full h-full bg-white border-2 border-slate-200 rounded-3xl flex flex-col items-center justify-center p-10">
                            <span class="text-xs text-slate-400 font-bold uppercase tracking-widest absolute top-6">Term</span>
                            <h3 class="font-black text-4xl lg:text-5xl text-blue-900 text-center">${card.term}</h3>
                            <p class="text-sm text-slate-400 mt-6 bg-slate-100 px-3 py-1 rounded-full"><span class="hidden lg:inline">Click or tap to</span> flip card ⤵</p>
                        </div>
                        <!-- Back -->
                        <div class="flip-card-back absolute w-full h-full bg-indigo-50 border-2 border-indigo-200 rounded-3xl flex flex-col items-center justify-center p-10 overflow-y-auto">
                            <span class="text-xs text-indigo-400 font-bold uppercase tracking-widest absolute top-6">Definition</span>
                            <p class="font-bold text-2xl lg:text-3xl text-indigo-900 text-center leading-relaxed">${card.def}</p>
                        </div>
                    </div>
                </div>
                <div class="flex justify-between items-center mt-8 gap-4">
                    <button onclick="window.studyIdx--; window.renderStudyFlashcard()" class="flex-1 bg-white hover:bg-slate-100 text-slate-700 font-bold py-4 rounded-xl border border-slate-200 shadow-sm transition">&larr; Previous</button>
                    <button onclick="window.studyIdx++; window.renderStudyFlashcard()" class="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-bold py-4 rounded-xl shadow-md transition">Next &rarr;</button>
                </div>
            </div>
        `;
    };

    // --- MODE 2: MULTIPLE CHOICE QUIZ ---
    window.renderStudyQuiz = function() {
        const content = document.getElementById('study-mode-content');
        window.studyHasAnswered = false;

        if (window.studyIdx >= window.studyDeck.length) {
            content.innerHTML = window.getStudyCompletionHtml('Quiz');
            return;
        }

        const card = window.studyDeck[window.studyIdx];
        
        // Generate Options (1 correct, 3 random wrong)
        let wrongOpts = window.studyDeck.filter(c => c.term !== card.term).sort(() => Math.random() - 0.5).slice(0, 3);
        let options = [card, ...wrongOpts].sort(() => Math.random() - 0.5);

        content.innerHTML = `
            <div class="w-full max-w-3xl flex flex-col">
                <div class="flex justify-between items-center mb-6">
                    <div class="font-bold text-slate-400 uppercase tracking-widest">Question ${window.studyIdx + 1} / ${window.studyDeck.length}</div>
                    <div class="font-black text-indigo-600 bg-indigo-50 px-3 py-1 rounded-lg border border-indigo-200">Score: ${window.studyScore}</div>
                </div>
                
                <div class="bg-white border-2 border-slate-200 p-8 lg:p-12 rounded-3xl shadow-sm mb-6 text-center min-h-[200px] flex flex-col justify-center items-center">
                    <span class="text-xs text-slate-400 font-bold uppercase tracking-widest mb-4">Select the correct term for:</span>
                    <p class="font-bold text-2xl lg:text-3xl text-slate-800 leading-relaxed max-w-2xl">${card.def}</p>
                </div>
                
                <div class="grid grid-cols-1 md:grid-cols-2 gap-4" id="quiz-options-container">
                    ${options.map((opt, i) => `
                        <button id="quiz-btn-${i}" onclick="window.checkStudyQuiz(${i}, '${opt.term.replace(/'/g, "\\'")}', '${card.term.replace(/'/g, "\\'")}')" class="bg-white border-2 border-slate-200 hover:border-indigo-400 hover:bg-indigo-50 text-slate-700 font-bold text-lg p-5 rounded-2xl shadow-sm transition text-left h-full">
                            ${opt.term}
                        </button>
                    `).join('')}
                </div>
                
                <button id="quiz-next-btn" onclick="window.studyIdx++; window.renderStudyQuiz()" class="hidden w-full mt-6 bg-blue-600 hover:bg-blue-700 text-white font-black py-4 rounded-xl shadow-md transition text-lg">Next Question &rarr;</button>
            </div>
        `;
    };

    window.checkStudyQuiz = function(btnIdx, selectedTerm, correctTerm) {
        if (window.studyHasAnswered) return;
        window.studyHasAnswered = true;
        
        const isCorrect = selectedTerm === correctTerm;
        if (isCorrect) window.studyScore++;

        // Reveal answers
        const container = document.getElementById('quiz-options-container');
        Array.from(container.children).forEach((btn) => {
            const btnTerm = btn.innerText.trim();
            btn.className = "bg-white border-2 p-5 rounded-2xl shadow-sm transition text-left h-full text-lg font-bold opacity-50 cursor-default"; // lock all
            
            if (btnTerm === correctTerm) {
                // Correct answer turns green
                btn.classList.remove('border-slate-200', 'opacity-50', 'text-slate-700');
                btn.classList.add('bg-emerald-50', 'border-emerald-500', 'text-emerald-800', 'opacity-100');
            } else if (btnTerm === selectedTerm && !isCorrect) {
                // Selected wrong answer turns red and shakes
                btn.classList.remove('border-slate-200', 'text-slate-700');
                btn.classList.add('bg-rose-50', 'border-rose-500', 'text-rose-800', 'opacity-100', 'shake');
            }
        });

        document.getElementById('quiz-next-btn').classList.remove('hidden');
    };

    // --- MODE 3: WRITE ---
    window.renderStudyWrite = function() {
        const content = document.getElementById('study-mode-content');
        window.studyHasAnswered = false;

        if (window.studyIdx >= window.studyDeck.length) {
            content.innerHTML = window.getStudyCompletionHtml('Write');
            return;
        }

        const card = window.studyDeck[window.studyIdx];
        
        content.innerHTML = `
            <div class="w-full max-w-3xl flex flex-col">
                <div class="flex justify-between items-center mb-6">
                    <div class="font-bold text-slate-400 uppercase tracking-widest">Question ${window.studyIdx + 1} / ${window.studyDeck.length}</div>
                    <div class="font-black text-indigo-600 bg-indigo-50 px-3 py-1 rounded-lg border border-indigo-200">Score: ${window.studyScore}</div>
                </div>
                
                <div class="bg-white border-2 border-slate-200 p-8 lg:p-12 rounded-3xl shadow-sm mb-6 text-center min-h-[200px] flex flex-col justify-center items-center relative overflow-hidden">
                    <span class="text-xs text-slate-400 font-bold uppercase tracking-widest mb-4">Type the exact term for:</span>
                    <p class="font-bold text-2xl lg:text-3xl text-slate-800 leading-relaxed max-w-2xl z-10">${card.def}</p>
                    
                    <!-- Result Overlay (hidden by default) -->
                    <div id="write-result-overlay" class="hidden absolute inset-0 flex-col items-center justify-center p-8 z-20"></div>
                </div>
                
                <div class="flex gap-3">
                    <input type="text" id="write-input" autocomplete="off" autocorrect="off" spellcheck="false" class="flex-1 border-2 border-slate-300 p-5 rounded-2xl text-xl font-black text-blue-900 outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-500/20 transition shadow-sm text-center" placeholder="Type your answer..." onkeydown="if(event.key==='Enter') window.checkStudyWrite('${card.term.replace(/'/g, "\\'")}')">
                    <button id="write-check-btn" onclick="window.checkStudyWrite('${card.term.replace(/'/g, "\\'")}')" class="w-32 bg-blue-600 hover:bg-blue-700 text-white font-black rounded-2xl shadow-md transition text-lg">Check</button>
                </div>
                
                <button id="write-next-btn" onclick="window.studyIdx++; window.renderStudyWrite()" class="hidden w-full mt-6 bg-slate-800 hover:bg-black text-white font-black py-4 rounded-xl shadow-md transition text-lg">Next Word &rarr;</button>
            </div>
        `;
        
        // Auto-focus input on render
        setTimeout(() => {
            const input = document.getElementById('write-input');
            if (input) input.focus();
        }, 100);
    };

    window.checkStudyWrite = function(correctTerm) {
        if (window.studyHasAnswered) return;
        
        const inputEl = document.getElementById('write-input');
        const typedTerm = inputEl.value.trim();
        if (!typedTerm) return;

        window.studyHasAnswered = true;
        const btnCheck = document.getElementById('write-check-btn');
        const btnNext = document.getElementById('write-next-btn');
        const overlay = document.getElementById('write-result-overlay');
        
        inputEl.disabled = true;
        btnCheck.disabled = true;
        btnCheck.classList.add('opacity-50');

        const isCorrect = typedTerm.toLowerCase() === correctTerm.toLowerCase();
        
        overlay.classList.remove('hidden');
        overlay.classList.add('flex', 'animate-scale-up');

        if (isCorrect) {
            window.studyScore++;
            inputEl.className = "flex-1 border-4 border-emerald-500 bg-emerald-50 p-5 rounded-2xl text-xl font-black text-emerald-800 text-center";
            overlay.className = "absolute inset-0 flex-col items-center justify-center p-8 z-20 bg-emerald-500/95 text-white flex animate-scale-up";
            overlay.innerHTML = `<span class="text-6xl mb-2">✅</span><h3 class="text-3xl font-black">Correct!</h3>`;
        } else {
            inputEl.className = "flex-1 border-4 border-rose-500 bg-rose-50 p-5 rounded-2xl text-xl font-black text-rose-800 text-center shake";
            overlay.className = "absolute inset-0 flex-col items-center justify-center p-8 z-20 bg-rose-600/95 text-white flex animate-scale-up";
            overlay.innerHTML = `<span class="text-6xl mb-2">❌</span><h3 class="text-2xl font-bold mb-1">Incorrect.</h3><p class="text-lg opacity-90 mb-2">You typed: <s class="font-bold opacity-75">${typedTerm}</s></p><div class="bg-white/20 p-4 rounded-xl w-full border border-white/30"><p class="text-sm uppercase tracking-widest font-bold mb-1 opacity-80">Correct Answer</p><p class="text-3xl font-black tracking-wide">${correctTerm}</p></div>`;
        }

        btnNext.classList.remove('hidden');
        btnNext.focus();
    };

    // --- MODE 4: MATCHING ---
    window.initStudyMatching = function() {
        // Grab up to 6 random cards for a 12-tile grid
        let batch = [...window.studyDeck].sort(() => Math.random() - 0.5).slice(0, 6);
        window.matchPairsFound = 0;
        
        let tiles = [];
        batch.forEach((c, idx) => {
             // We inject hidden zero-width spaces or subtle ID tracking to link pairs
             tiles.push({ trueId: idx, type: 'term', text: c.term });
             tiles.push({ trueId: idx, type: 'def', text: c.def });
        });
        window.matchTiles = tiles.sort(() => Math.random() - 0.5);
        window.renderStudyMatchingGrid();
    };

    window.renderStudyMatchingGrid = function() {
        const content = document.getElementById('study-mode-content');
        
        content.innerHTML = `
            <div class="w-full max-w-5xl flex flex-col h-full">
                <div class="flex justify-between items-center mb-6 shrink-0">
                    <p class="text-slate-500 font-bold">Match all terms with their definitions to clear the board!</p>
                    <div class="font-black text-indigo-600 bg-indigo-50 px-4 py-2 rounded-xl border border-indigo-200">Pairs Found: <span id="match-score">${window.matchPairsFound}</span> / ${window.matchTiles.length/2}</div>
                </div>
                
                <div class="flex-1 grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 stagger-fade-in" id="match-grid">
                    ${window.matchTiles.map((t, i) => `
                        <button id="match-tile-${i}" onclick="window.handleMatchClick(this, ${t.trueId}, '${t.type}')" class="bg-white border-2 border-slate-200 p-4 rounded-2xl shadow-sm text-center flex flex-col items-center justify-center font-bold text-slate-700 hover:border-indigo-400 hover:shadow-md transition-all h-[140px] overflow-hidden select-none active:scale-95 text-sm cursor-pointer">
                            <div class="line-clamp-4 pointer-events-none">${t.text}</div>
                        </button>
                    `).join('')}
                </div>
            </div>
        `;
    };

    window.handleMatchClick = function(el, trueId, type) {
        if (el.classList.contains('opacity-0')) return; // already solved
        if (el === window.matchSelectedElement) return; // clicking same tile twice

        // 1. Highlight clicked tile
        el.classList.remove('border-slate-200', 'text-slate-700');
        el.classList.add('border-indigo-500', 'bg-indigo-50', 'text-indigo-900', 'ring-2', 'ring-indigo-200');

        // 2. If nothing selected yet, store it and wait
        if (!window.matchSelectedElement) {
            window.matchSelectedElement = el;
            window.matchSelectedData = { trueId, type };
            return;
        }

        // 3. Second tile clicked! Check for match.
        const firstEl = window.matchSelectedElement;
        const firstData = window.matchSelectedData;
        
        // Reset state instantly to prevent 3rd rapid clicks
        window.matchSelectedElement = null;
        window.matchSelectedData = null;

        const isMatch = (firstData.trueId === trueId) && (firstData.type !== type);

        if (isMatch) {
            // Correct Match!
            window.matchPairsFound++;
            document.getElementById('match-score').textContent = window.matchPairsFound;
            
            [firstEl, el].forEach(tile => {
                // FIXED: Removed animate-pop, kept overflow-hidden and text-sm
                tile.className = "bg-emerald-500 border-2 border-emerald-600 p-4 rounded-2xl shadow-md text-center flex flex-col items-center justify-center font-black text-white transition-all duration-300 h-[140px] overflow-hidden select-none transform scale-105 z-10 text-sm";
            });

            setTimeout(() => {
                [firstEl, el].forEach(tile => {
                    tile.classList.add('opacity-0', 'pointer-events-none', 'scale-90');
                });
                
                // Check Win State
                if (window.matchPairsFound === window.matchTiles.length / 2) {
                    setTimeout(() => {
                        document.getElementById('study-mode-content').innerHTML = window.getStudyCompletionHtml('Matching');
                    }, 500);
                }
            }, 600);

        } else {
            // Wrong Match!
            [firstEl, el].forEach(tile => {
                // FIXED: Kept overflow-hidden and text-sm
                tile.className = "bg-rose-100 border-2 border-rose-500 p-4 rounded-2xl shadow-md text-center flex flex-col items-center justify-center font-bold text-rose-800 transition-all duration-300 h-[140px] overflow-hidden select-none shake z-10 text-sm";
            });

            setTimeout(() => {
                [firstEl, el].forEach(tile => {
                    // Revert to original neutral state
                    tile.className = "bg-white border-2 border-slate-200 p-4 rounded-2xl shadow-sm text-center flex flex-col items-center justify-center font-bold text-slate-700 hover:border-indigo-400 hover:shadow-md transition-all h-[140px] overflow-hidden select-none active:scale-95 text-sm cursor-pointer";
                });
            }, 600);
        }
    };

    window.getStudyCompletionHtml = function(modeName) {
        let scoreHtml = '';
        if (modeName === 'Quiz' || modeName === 'Write') {
            const pct = Math.round((window.studyScore / window.studyDeck.length) * 100);
            const color = pct >= 80 ? 'text-emerald-500' : (pct >= 50 ? 'text-amber-500' : 'text-rose-500');
            scoreHtml = `<div class="text-6xl font-black ${color} mb-2">${pct}%</div><div class="text-slate-500 font-bold mb-8">${window.studyScore} correct out of ${window.studyDeck.length}</div>`;
        }

        return `
            <div class="flex flex-col items-center justify-center h-full w-full max-w-md mx-auto text-center animate-scale-up">
                <div class="text-8xl mb-6">🎉</div>
                <h2 class="text-3xl font-black text-slate-800 mb-6">${modeName} Complete!</h2>
                ${scoreHtml}
                <div class="flex gap-4 w-full">
                    <button onclick="window.switchStudyMode('${modeName.toLowerCase()}')" class="flex-1 py-4 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-bold rounded-xl border border-indigo-200 shadow-sm transition">↻ Try Again</button>
                    <button onclick="window.closeStudyMode()" class="flex-1 py-4 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl shadow-md transition">Exit</button>
                </div>
            </div>
        `;
    };

   // --- STUDENTS & PAYMENTS LOGIC ---
    let tempCustomQRBase64 = null;
