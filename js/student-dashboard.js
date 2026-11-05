    function getSubmissionModule(sub) {
      const fromTest = TEST_BANK.find(x => x.id === sub?.testId) || sub?.syntheticData || null;
      if (fromTest?.module) return fromTest.module;
      const testName = (sub?.testName || '').toLowerCase();
      if (testName.includes('writing')) return 'writing';
      if (testName.includes('speaking')) return 'speaking';
      return null;
    }

    const questionTypeLabels = {
      multiple_choice: 'Multiple Choice',
      tfng: 'True / False / Not Given',
      ynng: 'Yes / No / Not Given',
      fill_blanks: 'Completion',
      dnd_list: 'Drag & Drop',
      matching_headings: 'Matching Headings',
      matching_info: 'Matching Information',
      matching_endings: 'Matching Endings',
      matching_statements: 'Matching Statements',
      map_labelling_hotspots: 'Map Labelling',
      map_labelling_grid: 'Map Labelling'
    };

    function renderQuestionTypeAnalytics(submissions, heading) {
      const statsByType = new Map();
      (Array.isArray(submissions) ? submissions : []).forEach(submission => {
        const test = submission?.syntheticData || TEST_BANK.find(item => item.id === submission?.testId);
        const module = test?.module || getSubmissionModule(submission);
        if (!['reading', 'listening'].includes(module)) return;
        (submission?.questionAnalytics || []).forEach(analytics => {
          if (analytics.scoreable === false) return;
          const question = test?.parts?.[analytics.partIndex]?.questions?.[analytics.blockIndex];
          const type = analytics.questionType || question?.type;
          if (typeof type !== 'string' || !type || type === 'unknown') return;

          const total = analytics.totalCount !== null && analytics.totalCount !== undefined &&
            Number.isFinite(Number(analytics.totalCount)) && Number(analytics.totalCount) > 0
            ? Number(analytics.totalCount)
            : 1;
          const correct = analytics.correctCount !== null && analytics.correctCount !== undefined &&
            Number.isFinite(Number(analytics.correctCount))
            ? Math.max(0, Math.min(total, Number(analytics.correctCount)))
            : analytics.correct === true ? 1 : 0;
          const stats = statsByType.get(type) || { correct: 0, total: 0 };
          stats.correct += correct;
          stats.total += total;
          statsByType.set(type, stats);
        });
      });

      const rows = [...statsByType.entries()]
        .map(([type, stats]) => ({ type, ...stats, accuracy: stats.total ? stats.correct / stats.total : 0 }))
        .sort((a, b) => a.accuracy - b.accuracy || a.type.localeCompare(b.type));
      if (!rows.length) return '';

      const weakest = rows[0];
      const title = heading || window.studentText('Question-type blind spots', 'Điểm mù theo dạng câu hỏi');
      const weakestLabel = questionTypeLabels[weakest.type] || weakest.type.replace(/[_-]+/g, ' ');
      const weaknessMessage = weakest.accuracy < 1
        ? window.studentText(
            `Focus your next practice on ${escapeForumHtml(weakestLabel)} (${Math.round(weakest.accuracy * 100)}%).`,
            `Hãy ưu tiên luyện dạng ${escapeForumHtml(weakestLabel)} (${Math.round(weakest.accuracy * 100)}%).`
          )
        : window.studentText('Great work — all tracked question types are currently at 100%.', 'Rất tốt — hiện các dạng câu hỏi được theo dõi đều đạt 100%.');

      return `
        <section class="question-type-analytics" aria-label="${window.studentText('Question-type performance chart', 'Biểu đồ kết quả theo dạng câu hỏi')}">
          <div class="question-type-analytics__heading">
            <div>
              <h3>${title}</h3>
              <p>${window.studentText('Accuracy by question type', 'Tỷ lệ đúng theo dạng câu hỏi')}</p>
            </div>
            <span aria-hidden="true">📊</span>
          </div>
          <div class="question-type-analytics__rows">
            ${rows.map(row => {
              const label = questionTypeLabels[row.type] || row.type.replace(/[_-]+/g, ' ');
              const percentage = Math.round(row.accuracy * 100);
              return `<div class="question-type-analytics__row">
                <div class="question-type-analytics__label"><span>${escapeForumHtml(label)}</span><strong>${percentage}% <small>(${row.correct}/${row.total})</small></strong></div>
                <div class="question-type-analytics__track" role="img" aria-label="${escapeForumHtml(label)}: ${percentage}% correct"><span class="${row.type === weakest.type && percentage < 100 ? 'is-weakest' : ''}" style="width:${percentage}%"></span></div>
              </div>`;
            }).join('')}
          </div>
          <p class="question-type-analytics__insight"><strong>${window.studentText('Blind spot:', 'Điểm cần cải thiện:')}</strong> ${weaknessMessage}</p>
        </section>`;
    }

    window.renderQuestionTypeAnalytics = renderQuestionTypeAnalytics;

    function getPeerReviewCandidatesForCurrentStudent() {
      if (!currentUser || currentUser.role !== 'student') return [];
      const cid = document.getElementById('student-class-select')?.value;
      const cls = CLASSES.find(c => c.id === cid);
      if (!cls) return [];

      return (SUBMISSIONS || []).filter(sub => {
        if (!sub || sub.student === currentUser.user) return false;
        if (sub.className !== cls.name) return false;
        const module = getSubmissionModule(sub);
        if (!['writing', 'speaking'].includes(module)) return false;

        const teacherHasFeedback = Boolean(sub.teacherFeedback && Object.keys(sub.teacherFeedback).length > 0);
        if (teacherHasFeedback) return false;

        const alreadyReviewed = Array.isArray(sub.peerReviews) && sub.peerReviews.some(pr => pr.reviewer === currentUser.user);
        if (alreadyReviewed) return false;

        return true;
      }).sort((a, b) => (b.id || 0) - (a.id || 0));
    }

    function renderPeerReviewSummary(peerReviews = []) {
      if (!Array.isArray(peerReviews) || !peerReviews.length) return '';
      const criteria = ['tr', 'cc', 'lr', 'gra'];
      const averages = criteria.map(crit => {
        const total = peerReviews.reduce((sum, review) => sum + (Number(review[crit]) || 0), 0);
        const avg = peerReviews.length ? (total / peerReviews.length).toFixed(1) : '—';
        return `<div class="bg-white p-3 rounded-xl border border-slate-200 text-center shadow-sm"><div class="text-[10px] text-slate-400 font-bold uppercase tracking-widest mb-1">${crit.toUpperCase()}</div><div class="font-black text-slate-700 text-xl leading-none">${avg}</div></div>`;
      }).join('');
      const comments = peerReviews.filter(review => review.comment && review.comment.trim()).slice(0, 3).map(review => `
        <div class="bg-white p-3 rounded-xl border border-slate-200 shadow-sm">
          <div class="text-[11px] font-black text-slate-400 uppercase tracking-widest">Anonymous Peer</div>
          <div class="text-sm text-slate-700 mt-1 whitespace-pre-wrap">${String(review.comment || '').replace(/</g, '&lt;')}</div>
        </div>`).join('');
      return `
        <div class="mt-4 rounded-2xl border border-slate-200 bg-slate-50 p-4 shadow-sm">
          <div class="font-black text-slate-700 text-sm uppercase tracking-widest mb-3">Anonymous Peer Review Summary</div>
          <div class="grid grid-cols-2 md:grid-cols-4 gap-2 mb-3">${averages}</div>
          ${comments ? `<div class="space-y-2">${comments}</div>` : ''}
        </div>`;
    }

    window.showLeaderboardModal = function() {
        if (routerReady && !appRouterApplying && currentUser?.role === 'student') {
            window.navigateAppRoute('student/leaderboard');
            return;
        }
        const topStudents = USERS.filter(u => u.role === 'student' && hasActiveStudentAccess(u)).sort((a,b) => (b.gems || 0) - (a.gems || 0)).slice(0, 10);
        let html = `<div class="space-y-2 mt-4">`;
        topStudents.forEach((u, i) => {
            let rankStyles = "text-slate-400 bg-slate-50 border-slate-200";
            if (i === 0) rankStyles = "text-amber-600 bg-amber-50 border-amber-200 shadow-inner";
            else if (i === 1) rankStyles = "text-slate-500 bg-slate-100 border-slate-300";
            else if (i === 2) rankStyles = "text-amber-800 bg-orange-50 border-orange-200";
            const isMe = u.user === currentUser.user;
            html += `
            <div class="flex items-center justify-between p-2.5 rounded-xl border ${isMe ? 'bg-blue-50/50 border-blue-200 shadow-sm' : 'border-slate-100 bg-slate-50'} transition">
                <div class="flex items-center gap-3 min-w-0 flex-1">
                    <div class="w-7 h-7 flex items-center justify-center font-black text-xs rounded-lg border ${rankStyles} shrink-0">${i+1}</div>
                    <img src="${u.avatar || ('https://ui-avatars.com/api/?name=' + encodeURIComponent(u.user) + '&background=random')}" class="w-8 h-8 rounded-full border border-slate-200 shrink-0 object-cover shadow-sm">
                    <span class="font-bold text-sm truncate ${isMe ? 'text-blue-800' : 'text-slate-700'}">${u.user} ${isMe ? '<span class="text-[9px] uppercase tracking-widest opacity-50 ml-1">(You)</span>' : ''}</span>
                </div>
                <div class="font-black text-amber-500 text-xs bg-white border border-slate-100 shadow-sm px-2.5 py-1.5 rounded-lg shrink-0 ml-3 flex items-center gap-1">${(u.gems||0).toLocaleString()} <span class="text-[10px]">💎</span></div>
            </div>`;
        });
        html += `</div>`;
        document.getElementById('modal-title').innerHTML = window.studentText('🏆 Global Leaderboard', '🏆 Bảng xếp hạng tổng');
        document.getElementById('modal-message').innerHTML = html;
        document.getElementById('modal-input').classList.add('hidden');
        document.getElementById('modal-cancel').classList.add('hidden');
        document.getElementById('custom-modal').classList.remove('hidden');
        document.getElementById('modal-confirm').onclick = () => {
            document.getElementById('custom-modal').classList.add('hidden');
            if (normalizeAppRoute().section === 'leaderboard') window.navigateAppRoute('student/class', true);
        };
    };

    window.showPeerReviewList = function() {
        if (routerReady && !appRouterApplying && currentUser?.role === 'student') {
            window.navigateAppRoute('student/peer-review');
            return;
        }
        const candidates = getPeerReviewCandidatesForCurrentStudent();
        if (candidates.length === 0) {
            if (typeof window.showToast === 'function') window.showToast(window.studentText("Peer Review", "Chấm chéo"), window.studentText("All caught up! No submissions are pending your review right now.", "Bạn đã xem hết! Hiện không có bài nào đang chờ bạn nhận xét."), "info");
            if (normalizeAppRoute().section === 'peer-review') {
                window.history.replaceState({ lmsRoute: 'student' }, '', '#/student/test-bank');
            }
            return;
        }
        let html = `<div class="space-y-3 mt-4 max-h-[60vh] overflow-y-auto pr-2">`;
        candidates.forEach(sub => {
            html += `
            <div class="rounded-xl border border-indigo-200 bg-indigo-50 p-3 shadow-sm flex justify-between items-center gap-3">
                <div class="min-w-0">
                    <div class="font-black text-indigo-900 text-sm truncate">${escapeForumHtml(getSubmissionModule(sub) === 'speaking' ? window.studentText('Speaking sample', 'Bài nói') : window.studentText('Writing sample', 'Bài viết'))}</div>
                    <div class="text-[10px] font-bold text-indigo-500 mt-1 truncate">${escapeForumHtml(sub.testName || window.studentText('Peer submission', 'Bài làm của bạn học'))}</div>
                </div>
                <button onclick="document.getElementById('custom-modal').classList.add('hidden'); window.openPeerReviewModal(${sub.id})" class="text-[11px] bg-indigo-600 hover:bg-indigo-700 text-white font-bold px-4 py-2 rounded-lg shadow-sm transition shrink-0">${window.studentText('Review', 'Nhận xét')}</button>
            </div>`;
        });
        html += `</div>`;
        document.getElementById('modal-title').innerHTML = window.studentText('🤝 Pending Peer Reviews', '🤝 Bài đang chờ nhận xét');
        document.getElementById('modal-message').innerHTML = html;
        document.getElementById('modal-input').classList.add('hidden');
        document.getElementById('modal-cancel').classList.add('hidden');
        document.getElementById('custom-modal').classList.remove('hidden');
        document.getElementById('modal-confirm').onclick = () => {
            document.getElementById('custom-modal').classList.add('hidden');
            if (normalizeAppRoute().section === 'peer-review') window.navigateAppRoute('student/test-bank', true);
        };
    };

    window.openPeerReviewModal = function(subId) {
      const sub = (SUBMISSIONS || []).find(x => String(x.id) === String(subId));
      if (!sub) return;
      if (routerReady && !appRouterApplying && currentUser?.role === 'student') {
        if (!getPeerReviewCandidatesForCurrentStudent().some(candidate => String(candidate.id) === String(subId))) return;
        window.navigateAppRoute(`student/peer-review/${encodeURIComponent(subId)}`);
        return;
      }

      const modal = document.getElementById('custom-modal');
      const title = document.getElementById('modal-title');
      const message = document.getElementById('modal-message');
      const confirm = document.getElementById('modal-confirm');
      const cancel = document.getElementById('modal-cancel');
      const input = document.getElementById('modal-input');

      const test = sub.syntheticData || TEST_BANK.find(t => t.id === sub.testId);
      const module = test?.module || getSubmissionModule(sub);
      const answerText = (sub.answers && Object.values(sub.answers).find(v => typeof v === 'string' && v.trim())) || '';
      const answerPreview = typeof answerText === 'string' && answerText.length > 200 ? `${answerText.slice(0, 220)}…` : (answerText || 'No response text was captured.');
      const bandOpts = [9, 8.5, 8, 7.5, 7, 6.5, 6, 5.5, 5, 4.5, 4].map(b => `<option value="${b}">${b}</option>`).join('');

      title.textContent = 'Anonymous Peer Review';
      message.innerHTML = `
        <div class="space-y-4 text-left">
          <div class="rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm text-slate-600">
            <div class="font-black text-slate-700 uppercase tracking-widest text-[10px] mb-1">Reviewing</div>
            <div class="font-semibold text-slate-800">${module === 'speaking' ? 'Speaking response' : 'Writing response'}</div>
            <div class="text-xs text-slate-500 mt-1">Your feedback will be shared anonymously with the student and the teacher.</div>
          </div>
          <div class="rounded-xl border border-slate-200 bg-white p-3 max-h-[220px] overflow-y-auto">
            <div class="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2">Submission Preview</div>
            <div class="text-sm text-slate-700 whitespace-pre-wrap">${String(answerPreview).replace(/</g, '&lt;')}</div>
          </div>
          <div class="grid grid-cols-2 gap-3">
            <div>
              <label class="block text-[10px] font-black uppercase tracking-widest text-slate-500 mb-1">Task Response</label>
              <select id="peer-tr" class="w-full border border-slate-300 rounded-lg p-2 text-sm">${bandOpts}</select>
            </div>
            <div>
              <label class="block text-[10px] font-black uppercase tracking-widest text-slate-500 mb-1">Coherence</label>
              <select id="peer-cc" class="w-full border border-slate-300 rounded-lg p-2 text-sm">${bandOpts}</select>
            </div>
            <div>
              <label class="block text-[10px] font-black uppercase tracking-widest text-slate-500 mb-1">Lexical Resource</label>
              <select id="peer-lr" class="w-full border border-slate-300 rounded-lg p-2 text-sm">${bandOpts}</select>
            </div>
            <div>
              <label class="block text-[10px] font-black uppercase tracking-widest text-slate-500 mb-1">Grammar</label>
              <select id="peer-gra" class="w-full border border-slate-300 rounded-lg p-2 text-sm">${bandOpts}</select>
            </div>
          </div>
          <div>
            <label class="block text-[10px] font-black uppercase tracking-widest text-slate-500 mb-1">Feedback</label>
            <textarea id="peer-comment" class="w-full border border-slate-300 rounded-xl p-3 text-sm min-h-[100px] outline-none focus:border-blue-500" placeholder="Explain why you chose those bands and point out strengths or weak points."></textarea>
          </div>
        </div>`;

      input.classList.add('hidden');
      cancel.classList.remove('hidden');
      cancel.onclick = () => {
        if (normalizeAppRoute().section === 'peer-review') window.navigateAppRoute('student/peer-review', true);
        else modal.classList.add('hidden');
      };
      confirm.onclick = async () => {
        confirm.textContent = 'Saving...';
        confirm.disabled = true;
        await window.submitPeerReview(subId);
        confirm.textContent = 'Save Review';
        confirm.disabled = false;
      };
      modal.classList.remove('hidden');
    };

    window.submitPeerReview = async function(subId) {
      const sub = (SUBMISSIONS || []).find(x => x.id === subId);
      if (!sub) return;

      const tr = document.getElementById('peer-tr')?.value || '';
      const cc = document.getElementById('peer-cc')?.value || '';
      const lr = document.getElementById('peer-lr')?.value || '';
      const gra = document.getElementById('peer-gra')?.value || '';
      const comment = document.getElementById('peer-comment')?.value?.trim() || '';

      if (!tr && !cc && !lr && !gra && !comment) {
        window.showModalMsg ? window.showModalMsg('Notice', 'Please choose at least one band score or leave a short comment.') : alert('Please choose at least one band score or leave a short comment.');
        return;
      }

      const review = {
        id: `peer_${Date.now()}`,
        reviewer: currentUser?.user || 'anonymous',
        reviewerLabel: 'Anonymous Peer',
        anonymous: true,
        tr, cc, lr, gra, comment,
        submittedAt: Date.now()
      };

      sub.peerReviews = Array.isArray(sub.peerReviews) ? sub.peerReviews : [];
      const existingIndex = sub.peerReviews.findIndex(item => item.reviewer === currentUser?.user);
      if (existingIndex >= 0) {
        sub.peerReviews[existingIndex] = review;
      } else {
        sub.peerReviews.push(review);
      }

      try {
        await window.fsSetDoc(window.fsDoc(window.db, window.fPath('submissions'), String(subId)), sub);
        document.getElementById('custom-modal')?.classList.add('hidden');
        window.renderStudentDashboard();
        if (normalizeAppRoute().section === 'peer-review') window.navigateAppRoute('student/test-bank', true);
        if (typeof window.showToast === 'function') window.showToast('Peer Review Saved', 'Thanks for helping your classmate learn the rubric.');
      } catch (e) {
        console.error('Peer review save error:', e);
        if (typeof window.showModalMsg === 'function') window.showModalMsg('Error', 'Could not save your peer review.');
      }
    };

    function getStudentStudyCardDecks() {
      const classId = document.getElementById('student-class-select')?.value;
      const cls = CLASSES.find(item => item.id === classId);
      if (!cls) return {};
      const decks = {};
      getClassAssignedTests(cls).forEach(testId => {
        const test = TEST_BANK.find(item => item.id === testId);
        if (!test) return;
        const price = Number(test.price) || 0;
        if (price > 0 && !(currentUser.unlockedTests || []).includes(test.id)) return;
        const vocabCards = (Array.isArray(test.vocab) ? test.vocab : [])
          .filter(card => card?.term)
          .map((card, index) => ({
            id: `vocab_${index}`,
            term: String(card.term),
            def: [card.eng ? `EN: ${card.eng}` : '', card.vi ? `VI: ${card.vi}` : '', card.def || ''].filter(Boolean).join('\n'),
            context: card.example || card.context || ''
          }));
        const grammarCards = (Array.isArray(test.grammar) ? test.grammar : [])
          .filter(card => card?.term)
          .map((card, index) => ({
            id: `grammar_${index}`,
            term: String(card.term),
            def: [card.type, card.expl].filter(Boolean).join('\n'),
            context: card.example || card.context || ''
          }));
        if (vocabCards.length) {
          const id = `teacher_vocab_${encodeURIComponent(test.id)}`;
          decks[id] = { label: `Vocabulary · ${test.title || test.id}`, kind: 'vocab', cards: vocabCards };
        }
        if (grammarCards.length) {
          const id = `teacher_grammar_${encodeURIComponent(test.id)}`;
          decks[id] = { label: `Grammar · ${test.title || test.id}`, kind: 'grammar', cards: grammarCards };
        }
      });
      return decks;
    }

    function appendSafeTemplateContent(container, html) {
      const allowedTags = new Set(['div', 'p', 'span', 'strong', 'b', 'em', 'i', 'u', 'ul', 'ol', 'li', 'br', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'blockquote', 'table', 'thead', 'tbody', 'tr', 'th', 'td', 'hr']);
      const parsed = new DOMParser().parseFromString(String(html || ''), 'text/html');
      const copyNode = node => {
        if (node.nodeType === Node.TEXT_NODE) return document.createTextNode(node.nodeValue || '');
        if (node.nodeType !== Node.ELEMENT_NODE || !allowedTags.has(node.tagName.toLowerCase())) return null;
        const copy = document.createElement(node.tagName.toLowerCase());
        Array.from(node.attributes).forEach(attribute => {
          const name = attribute.name.toLowerCase();
          if (name === 'class' && /^[a-zA-Z0-9_\-\s:/\[\].%#]+$/.test(attribute.value)) {
            copy.setAttribute('class', attribute.value);
          } else if (['colspan', 'rowspan', 'scope', 'title'].includes(name)) {
            copy.setAttribute(name, attribute.value);
          }
        });
        Array.from(node.childNodes).forEach(child => {
          const safeChild = copyNode(child);
          if (safeChild) copy.appendChild(safeChild);
        });
        return copy;
      };
      Array.from(parsed.body.childNodes).forEach(node => {
        const safeNode = copyNode(node);
        if (safeNode) container.appendChild(safeNode);
      });
    }

    window.studentStrategyFilter = window.studentStrategyFilter || 'all';

    window.filterStudentStrategies = function(skill) {
      const allowedSkills = ['all', 'reading', 'listening', 'writing', 'speaking', 'grammar', 'vocabulary'];
      window.studentStrategyFilter = allowedSkills.includes(skill) ? skill : 'all';
      renderStudentStudyTools();
    };

    function getStudentTemplateSkills(template) {
      const skills = new Set();
      Object.entries(TEACHER_TEMPLATE_ASSIGNMENTS || {}).forEach(([assignmentKey, templateId]) => {
        if (templateId !== template.id) return;
        const skill = assignmentKey.split(':')[0].toLowerCase();
        if (['reading', 'listening', 'writing', 'speaking', 'grammar', 'vocabulary', 'vocab'].includes(skill)) {
          skills.add(skill === 'vocab' ? 'vocabulary' : skill);
        }
      });
      const searchText = `${template.name || ''} ${new DOMParser().parseFromString(String(template.html || ''), 'text/html').body.textContent || ''}`.toLowerCase();
      [
        ['reading', /\breading\b|\bielts reading\b|đọc hiểu|kỹ năng đọc/],
        ['listening', /\blistening\b|nghe hiểu|kỹ năng nghe/],
        ['writing', /\bwriting\b|bài viết|kỹ năng viết/],
        ['speaking', /\bspeaking\b|bài nói|kỹ năng nói/],
        ['grammar', /\bgrammar\b|ngữ pháp/],
        ['vocabulary', /\bvocabulary\b|\bvocab\b|từ vựng|collocation|word bank/]
      ].forEach(([skill, pattern]) => {
        if (pattern.test(searchText)) skills.add(skill);
      });
      return skills;
    }

    function renderStudentStudyTools() {
      const container = document.getElementById('student-strategy-templates');
      if (!container) return;
      const filters = document.getElementById('student-strategy-filters');
      filters?.querySelectorAll('[data-strategy-filter]').forEach(button => {
        const isActive = button.dataset.strategyFilter === window.studentStrategyFilter;
        button.setAttribute('aria-pressed', String(isActive));
        button.className = isActive
          ? 'rounded-full bg-blue-600 px-3 py-1.5 text-xs font-black text-white shadow-sm'
          : 'rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-bold text-slate-600 hover:border-blue-300 hover:text-blue-700';
      });
      const templates = Array.isArray(TEACHER_TEMPLATES)
        ? TEACHER_TEMPLATES.filter(template => template && typeof template === 'object')
        : [];
      const visibleTemplates = window.studentStrategyFilter === 'all'
        ? templates
        : templates.filter(template => getStudentTemplateSkills(template).has(window.studentStrategyFilter));
      container.replaceChildren();
      if (!visibleTemplates.length) {
        const emptyState = document.createElement('p');
        emptyState.className = 'col-span-full rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-500';
        emptyState.textContent = templates.length
          ? window.studentText('No techniques found for this skill.', 'Không tìm thấy kỹ thuật cho kỹ năng này.')
          : window.studentText('No teacher strategies are available yet.', 'Chưa có chiến lược nào từ giáo viên.');
        container.appendChild(emptyState);
        return;
      }
      visibleTemplates.forEach(template => {
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'group rounded-xl border border-slate-200 bg-white p-4 text-left shadow-sm transition hover:border-blue-300 hover:bg-blue-50/40 hover:shadow-md focus:outline-none focus:ring-2 focus:ring-blue-500';
        const title = document.createElement('h4');
        title.className = 'font-black text-slate-800 group-hover:text-blue-800';
        title.textContent = template.name || 'Study strategy';
        const preview = document.createElement('div');
        preview.className = 'mt-2 line-clamp-2 text-sm text-slate-500';
        const safePreview = document.createElement('div');
        appendSafeTemplateContent(safePreview, template.html);
        preview.textContent = safePreview.textContent.trim() || window.studentText('Open this technique to view the details.', 'Mở kỹ thuật này để xem chi tiết.');
        const openHint = document.createElement('span');
        openHint.className = 'mt-3 inline-flex items-center gap-1 text-xs font-black text-blue-700';
        openHint.textContent = window.studentText('View technique →', 'Xem kỹ thuật →');
        button.append(title, preview, openHint);
        button.addEventListener('click', () => window.openStudentStrategy(template));
        container.appendChild(button);
      });
    }

    window.openStudentStrategy = function(template) {
      if (!template || typeof template !== 'object') return;
      const modal = document.getElementById('student-strategy-modal');
      const title = document.getElementById('student-strategy-modal-title');
      const content = document.getElementById('student-strategy-modal-content');
      if (!modal || !title || !content) return;
      title.textContent = template.name || window.studentText('Study strategy', 'Chiến lược học tập');
      content.replaceChildren();
      appendSafeTemplateContent(content, template.html);
      modal.classList.remove('hidden');
      modal.classList.add('flex');
      document.body.classList.add('overflow-hidden');
    };

    window.closeStudentStrategy = function() {
      const modal = document.getElementById('student-strategy-modal');
      if (!modal) return;
      modal.classList.add('hidden');
      modal.classList.remove('flex');
      document.body.classList.remove('overflow-hidden');
    };

    window.renderStudentDashboard = function renderStudentDashboard() {
      if (!hasActiveStudentAccess(currentUser)) {
          window.initStudentDashboard();
          return;
      }
      const st = window.studentText;
      const cid = document.getElementById('student-class-select').value;
      const list = document.getElementById('student-tests-list');
      const prog = document.getElementById('student-progress-section');
      const schedSec = document.getElementById('student-schedule-section');
      const bottomSec = document.getElementById('bottom-student-sections');
      const quickActions = document.getElementById('student-quick-actions');
      const mainContent = document.getElementById('student-main-content');
      const overviewContent = document.getElementById('student-overview-content');
      const overviewSection = document.getElementById('student-overview-section');
      const classOverviewSection = document.getElementById('student-class-overview-section');
      const classOverviewContent = document.getElementById('student-class-overview-content');
      const classInfoSection = document.getElementById('student-class-info-section');
      const testBankSection = document.getElementById('student-test-bank-section');
      const testBankPracticeActions = document.getElementById('student-test-bank-practice-actions');
      const dashboardSidebarContent = document.getElementById('student-dashboard-sidebar-content');
      const routeSection = normalizeAppRoute().section;
      const isClassRoute = routeSection === 'class' || routeSection === 'timetable';
      const isTestBankRoute = routeSection === 'test-bank';
      const isStudyToolsRoute = routeSection === 'study-tools' || routeSection === 'flashcards';
      const studyToolsSection = document.getElementById('student-study-tools-section');
      overviewSection?.classList.toggle('hidden', isClassRoute || isTestBankRoute || isStudyToolsRoute);
      classOverviewSection?.classList.toggle('hidden', !isClassRoute);
      testBankSection?.classList.toggle('hidden', !isTestBankRoute);
      studyToolsSection?.classList.toggle('hidden', !isStudyToolsRoute);
      classInfoSection?.classList.toggle('hidden', !isClassRoute);
      dashboardSidebarContent?.classList.toggle('hidden', isTestBankRoute || isStudyToolsRoute);
      bottomSec?.classList.toggle('lg:col-span-8', !isTestBankRoute && !isClassRoute && !isStudyToolsRoute);
      bottomSec?.classList.toggle('xl:col-span-8', !isTestBankRoute && !isClassRoute && !isStudyToolsRoute);
      bottomSec?.classList.toggle('col-span-full', isTestBankRoute || isClassRoute || isStudyToolsRoute);
      dashboardSidebarContent?.classList.toggle('lg:col-span-12', isClassRoute);
      dashboardSidebarContent?.classList.toggle('xl:col-span-12', isClassRoute);
      dashboardSidebarContent?.classList.toggle('lg:col-span-4', !isClassRoute);
      dashboardSidebarContent?.classList.toggle('xl:col-span-4', !isClassRoute);
      const scheduleEmptyState = document.getElementById('student-schedule-empty-state');
      renderStudentStudyTools();
      
      if(mainContent) mainContent.classList.remove('hidden');
      
      if(!cid) { 
          if (overviewContent) overviewContent.innerHTML = `<article class="lg:col-span-2 flex items-start gap-4 rounded-2xl border border-amber-200 bg-gradient-to-r from-amber-50 to-white p-6 shadow-sm"><span class="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-amber-100 text-2xl">🏫</span><div><div class="font-black text-amber-950 text-lg">${st('No active class enrollment', 'Chưa có lớp đang theo học')}</div><p class="text-sm text-amber-800 mt-1">${st('Choose an active enrollment in the Class section to see your next lesson, preparation, meeting link, and homework deadlines.', 'Chọn lớp đang theo học trong mục Lớp học để xem buổi học tiếp theo, nội dung chuẩn bị, liên kết họp và hạn bài tập.')}</p><button type="button" data-student-class class="mt-3 inline-flex items-center gap-1 rounded-lg bg-amber-600 px-3 py-2 text-xs font-black text-white transition hover:bg-amber-700">${st('Open Class →', 'Mở Lớp học →')}</button></div></article>`;
          overviewContent?.querySelector('[data-student-class]')?.addEventListener('click', () => window.navigateAppRoute('student/class'));
          if (classOverviewContent) classOverviewContent.innerHTML = `<div class="md:col-span-2 xl:col-span-3 rounded-xl border border-blue-100 bg-blue-50 p-5 text-sm font-medium text-blue-800">${st('Select an active enrollment above to view your classmates, timetable, and class updates.', 'Chọn lớp đang theo học ở trên để xem bạn cùng lớp, thời khóa biểu và thông tin lớp.')}</div>`;
          if (classInfoSection) classInfoSection.innerHTML = '';
          if(list) list.innerHTML = `<div class="p-6 text-slate-500 col-span-full">${st('Please select a class to view tests.', 'Vui lòng chọn lớp để xem bài thi.')}</div>`;
          testBankPracticeActions?.classList.add('hidden');
          if(bottomSec) { bottomSec.classList.toggle('hidden', !isClassRoute && !isTestBankRoute && !isStudyToolsRoute); bottomSec.classList.toggle('flex', isClassRoute || isTestBankRoute || isStudyToolsRoute); }
          if(schedSec) { schedSec.classList.toggle('hidden', !isClassRoute); schedSec.classList.toggle('flex', isClassRoute); }
          if(scheduleEmptyState) {
              scheduleEmptyState.textContent = st('No class is enrolled yet. Please contact your teacher to be added to a class timetable.', 'Bạn chưa tham gia lớp nào. Vui lòng liên hệ giáo viên để được thêm vào thời khóa biểu lớp.');
              scheduleEmptyState.classList.toggle('hidden', !isClassRoute);
          }
          if(isClassRoute) window.renderCalendar('student');
          if(quickActions) { quickActions.classList.add('hidden'); quickActions.classList.remove('flex'); }
          if(prog) { prog.classList.add('hidden'); prog.classList.remove('flex'); }
          return; 
      }
      
      const cls = CLASSES.find(c => c.id === cid);
      if(!cls || window.isTemplateClass(cls) || !(cls.enrolledStudents || []).includes(currentUser.user)) {
          window.initStudentDashboard();
          return;
      }
      
      if(bottomSec) { bottomSec.classList.remove('hidden'); bottomSec.classList.add('flex'); }
      testBankPracticeActions?.classList.remove('hidden');
      if(quickActions) { quickActions.classList.add('hidden'); quickActions.classList.remove('flex'); }
      if(prog) { prog.classList.remove('hidden'); prog.classList.add('flex'); }

      const mySubs = SUBMISSIONS.filter(s => s.student === currentUser.user && s.className === cls.name);
      const assignedTestItems = getClassAssignedTests(cls)
          .filter(testId => TEST_BANK.some(test => test.id === testId))
          .map(testId => ({ testId }));
      const totalTests = assignedTestItems.length;
      const completedTestIds = [...new Set(mySubs.map(s => s.testId).filter(Boolean))]; 
      const completedCount = assignedTestItems.filter(item => completedTestIds.includes(item.testId)).length;
      const progressPct = totalTests === 0 ? 0 : Math.min(100, Math.round((completedCount / totalTests) * 100));
      const renderTestBankCard = test => {
        const price = Number(test.price) || 0;
        const isLocked = price > 0 && !(currentUser.unlockedTests || []).includes(test.id);
        const isCompleted = completedTestIds.includes(test.id);
        const moduleColors = { reading: 'blue', listening: 'cyan', writing: 'emerald', speaking: 'amber', activity: 'fuchsia' };
        const moduleNames = { reading: st('Reading', 'Đọc'), listening: st('Listening', 'Nghe'), writing: st('Writing', 'Viết'), speaking: st('Speaking', 'Nói'), activity: st('Activities', 'Hoạt động') };
        const color = moduleColors[test.module] || 'slate';
        const settings = getClassTestSettings(cls, test.id);
        const dueDate = settings?.dueDate && !isCompleted
          ? `<span class="text-[10px] font-bold text-rose-600">Due ${settings.dueDate}${settings.dueTime ? ` ${settings.dueTime}` : ''}</span>`
          : '';
        const status = isCompleted
          ? `<span class="text-[10px] font-black uppercase tracking-widest text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-full px-2.5 py-1">${st('Completed', 'Đã hoàn thành')}</span>`
          : `<span class="text-[10px] font-black uppercase tracking-widest text-blue-700 bg-blue-50 border border-blue-200 rounded-full px-2.5 py-1">${st('Ready', 'Sẵn sàng')}</span>`;

        return `
          <article class="bg-white border border-slate-200 rounded-xl shadow-sm hover:shadow-md transition p-4 flex flex-col gap-3">
            <div class="flex items-start justify-between gap-2">
              <span class="text-[10px] font-bold px-2 py-1 rounded bg-${color}-100 text-${color}-800 uppercase tracking-wide">${moduleNames[test.module] || test.module || st('Test', 'Bài thi')}</span>
              ${status}
            </div>
            <div class="flex-1">
              <h3 class="font-bold text-slate-900 leading-snug">${escapeForumHtml(test.title)}</h3>
              <p class="text-xs text-slate-500 mt-2">${test.parts?.length || 0} part(s)${test.difficulty ? ` · Band ${parseFloat(test.difficulty).toFixed(1)}` : ''}</p>
              ${dueDate ? `<div class="mt-2">${dueDate}</div>` : ''}
            </div>
            <button ${isLocked ? 'disabled' : `data-student-bank-test="${escapeForumHtml(test.id)}"`} class="w-full ${isLocked ? 'bg-slate-100 text-slate-500 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-700 text-white'} rounded-lg py-2.5 text-sm font-black transition">
              ${isLocked ? `🔒 ${st('Unlock', 'Mở khóa')} ${price} 💎` : isCompleted ? st('Take Again →', 'Làm lại →') : st('Take Test →', 'Làm bài →')}
            </button>
          </article>`;
      };

      const classSchedules = SCHEDULES.filter(s => window.scheduleBelongsToClass(s, cls) && (!s.attendingStudents || s.attendingStudents.includes(currentUser.user)));
      if (schedSec) {
          if (isClassRoute && (classSchedules.length || cls.allowBooking || isClassRoute)) {
              schedSec.classList.remove('hidden');
              schedSec.classList.add('flex');
              window.renderCalendar('student');
          } else {
              schedSec.classList.add('hidden');
              schedSec.classList.remove('flex');
          }
      }
      if (scheduleEmptyState) {
          const hasSchedule = classSchedules.length > 0;
          scheduleEmptyState.textContent = hasSchedule
              ? ''
              : cls.allowBooking
                  ? 'No lessons are scheduled yet. You can use “Book Slot” to request an available lesson.'
                  : 'No lessons have been scheduled for this class yet. Check back later or contact your teacher.';
          scheduleEmptyState.classList.toggle('hidden', !isClassRoute || hasSchedule);
      }
      
      const bookBtn = document.getElementById('btn-student-book-slot');
      if (bookBtn) {
          if (cls.allowBooking) bookBtn.classList.remove('hidden');
          else bookBtn.classList.add('hidden');
      }
      
      const query = (document.getElementById('student-test-search')?.value || '').toLowerCase();
      const mod = document.getElementById('student-test-filter-mod')?.value || 'all';
      const sort = document.getElementById('student-test-sort')?.value || 'default';
      const tagSelect = document.getElementById('student-test-filter-tag');
      const selectedTag = tagSelect ? tagSelect.value : 'all';
      const assignedTests = assignedTestItems
          .map(item => TEST_BANK.find(test => test.id === item.testId))
          .filter(Boolean);
      const allTags = new Set(assignedTests.flatMap(test => test.topics || []));

      if (tagSelect) {
          tagSelect.innerHTML = `<option value="all">${st('All Tags', 'Tất cả chủ đề')}</option>` +
              Array.from(allTags).sort().map(tag => `<option value="${tag}" ${selectedTag === tag ? 'selected' : ''}>${tag}</option>`).join('');
      }

      const filteredTests = assignedTests.filter(test =>
          matchesTestSearch(test, query) &&
          (mod === 'all' || test.module === mod) &&
          (selectedTag === 'all' || (test.topics || []).includes(selectedTag))
      );
      if (sort === 'az') filteredTests.sort((a, b) => a.title.localeCompare(b.title));
      else if (sort === 'za') filteredTests.sort((a, b) => b.title.localeCompare(a.title));
      list.innerHTML = filteredTests.length
          ? `<div class="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">${filteredTests.map(renderTestBankCard).join('')}</div>`
          : `<div class="text-sm text-slate-500 italic py-8 text-center">${assignedTests.length ? st('No tests match your search or filters.', 'Không có bài thi phù hợp với nội dung tìm kiếm hoặc bộ lọc.') : st('No tests have been assigned to this class yet.', 'Lớp chưa được giao bài thi nào.')}</div>`;
      list.querySelectorAll('[data-student-bank-test]').forEach(button => {
          button.addEventListener('click', () => openModeSelection(button.dataset.studentBankTest));
      });

      // Update Peer Review App Badge
      const peerBadge = document.getElementById('test-bank-peer-review-badge');
      const peerCount = getPeerReviewCandidatesForCurrentStudent().length;
      if (peerBadge) {
          if (peerCount > 0) {
              peerBadge.textContent = peerCount;
              peerBadge.classList.remove('hidden');
              peerBadge.classList.add('flex');
          } else {
              peerBadge.classList.add('hidden');
              peerBadge.classList.remove('flex');
          }
      }

      const peers = [...new Set((cls.enrolledStudents || []).filter(student => student && student !== currentUser.user))];
      const displayClassName = cls.name;
      const classPresence = window.classPresenceByClass?.[cls.id] || {};
      const classmates = peers.map(student => {
          const presence = classPresence[student];
          const lastActiveAt = Number(presence?.lastActiveAt) || null;
          const online = Boolean(presence?.isOnline && lastActiveAt && Date.now() - lastActiveAt < 120000);
          let activityLabel = st('No recent activity', 'Chưa ghi nhận hoạt động');
          if (lastActiveAt) {
              const elapsedMinutes = Math.max(0, Math.floor((Date.now() - lastActiveAt) / 60000));
              activityLabel = online ? st('Online', 'Đang online') : elapsedMinutes < 1 ? st('Active just now', 'Hoạt động vừa xong') : elapsedMinutes < 60
                  ? st(`${elapsedMinutes} minute(s) ago`, `${elapsedMinutes} phút trước`)
                  : elapsedMinutes < 1440
                      ? st(`${Math.floor(elapsedMinutes / 60)} hour(s) ago`, `${Math.floor(elapsedMinutes / 60)} giờ trước`)
                      : st(`${Math.floor(elapsedMinutes / 1440)} day(s) ago`, `${Math.floor(elapsedMinutes / 1440)} ngày trước`);
          }
          return { student, online, activityLabel };
      }).sort((a, b) => Number(b.online) - Number(a.online) || a.student.localeCompare(b.student));

      const homeworkTestIds = [...new Set([
          ...assignedTestItems.map(item => item.testId).filter(Boolean),
          ...classSchedules.flatMap(schedule => [
              ...(schedule.homeworkTests || []),
              ...(schedule.assignedTests || []),
              ...(schedule.materialIds || [])
          ]),
          ...Object.keys(cls.testSettings || {})
      ])];
      const pendingDeadlines = homeworkTestIds
          .filter(testId => !completedTestIds.includes(testId))
          .map(testId => {
              const settings = getClassTestSettings(cls, testId);
              const dueAt = settings?.dueDate ? window.parseClassDateTime(settings.dueDate, settings.dueTime || '23:59') : null;
              return { testId, dueAt };
          })
          .filter(item => item.dueAt)
          .sort((a, b) => a.dueAt - b.dueAt);

      const now = new Date();
      const nextLesson = classSchedules
          .map(schedule => ({ schedule, startsAt: window.parseClassDateTime(schedule.date, schedule.time) }))
          .filter(item => item.startsAt && item.startsAt >= now)
          .sort((a, b) => a.startsAt - b.startsAt)[0] || null;
      const nextSchedule = nextLesson?.schedule;
      const nextLessonMaterials = nextSchedule
          ? [...new Set([...(nextSchedule.assignedTests || []), ...(nextSchedule.materialIds || []), ...(nextSchedule.homeworkTests || [])])]
              .map(testId => TEST_BANK.find(test => test.id === testId))
              .filter(Boolean)
          : [];
      const dateLocale = studentLanguage === 'vi' ? 'vi-VN' : 'en-US';
      const nextLessonHtml = nextLesson ? `
          <article class="rounded-2xl border border-indigo-200 bg-gradient-to-br from-indigo-50 to-white p-5 shadow-sm transition hover:shadow-md">
            <div class="mb-3 flex items-center gap-3"><span class="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-indigo-600 text-lg text-white shadow-sm">📅</span><div class="text-[10px] font-black uppercase tracking-widest text-indigo-600">${st('Next lesson', 'Buổi học tiếp theo')}</div></div>
            <h3 class="font-black text-indigo-950 text-lg">${escapeForumHtml(nextSchedule.topic || st('Class lesson', 'Buổi học'))}</h3>
            <p class="text-sm font-bold text-indigo-800 mt-1">${nextLesson.startsAt.toLocaleString(dateLocale, { dateStyle: 'medium', timeStyle: 'short' })}</p>
            <p class="text-xs text-slate-600 mt-1">${escapeForumHtml(window.getScheduleClassLabel(nextSchedule) || cls.name)}</p>
            ${nextSchedule.prepText ? `<div class="mt-3 rounded-lg bg-white/80 border border-indigo-100 p-3"><div class="text-[10px] font-black uppercase tracking-widest text-sky-700 mb-1">${st('Prepare before class', 'Chuẩn bị trước buổi học')}</div><p class="text-sm text-slate-700 whitespace-pre-wrap">${escapeForumHtml(nextSchedule.prepText)}</p></div>` : `<p class="text-xs text-slate-500 mt-3">${st('No additional preparation notes from your teacher.', 'Giáo viên chưa thêm hướng dẫn chuẩn bị.')}</p>`}
            ${nextLessonMaterials.length ? `<div class="mt-3"><div class="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-2">${st('Lesson materials', 'Tài liệu buổi học')}</div><div class="space-y-2">${nextLessonMaterials.map(test => `
                <div class="flex items-center justify-between gap-2 rounded-lg bg-white border border-slate-200 px-3 py-2">
                  <span class="text-xs font-bold text-slate-700 truncate">${escapeForumHtml(test.title)}</span>
                  ${getCurrentStudentAssignedTest(test.id) ? `<button type="button" data-student-overview-test="${escapeForumHtml(test.id)}" class="shrink-0 text-xs font-black text-blue-700 hover:text-blue-900">${st('Take test →', 'Làm bài →')}</button>` : `<span class="text-[10px] text-slate-400">${st('Unavailable', 'Chưa khả dụng')}</span>`}
                </div>`).join('')}</div></div>` : ''}
            ${nextSchedule.link || cls.meetLink ? `<button type="button" data-student-next-lesson="${escapeForumHtml(nextSchedule.id)}" class="mt-3 w-full rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white py-2.5 text-sm font-black transition">🎥 ${st('Join Google Meet', 'Tham gia Google Meet')}</button>` : `<p class="mt-3 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg p-2">${st('The teacher has not added a meeting link yet.', 'Giáo viên chưa thêm liên kết họp.')}</p>`}
          </article>` : `
          <article class="rounded-2xl border border-slate-200 bg-gradient-to-br from-slate-50 to-white p-5 shadow-sm">
            <div class="mb-3 flex items-center gap-3"><span class="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-slate-200 text-lg">📅</span><div class="text-[10px] font-black uppercase tracking-widest text-slate-500">${st('Next lesson', 'Buổi học tiếp theo')}</div></div>
            <p class="font-black text-slate-800">${st('No upcoming lessons are scheduled.', 'Chưa có buổi học sắp tới.')}</p>
            <p class="mt-1 text-xs text-slate-500">${st('Check your timetable or contact your teacher for the next class time.', 'Kiểm tra thời khóa biểu hoặc liên hệ giáo viên để biết lịch học tiếp theo.')}</p>
          </article>`;
      const deadlineOverviewHtml = pendingDeadlines.length ? `
          <article class="rounded-2xl border ${pendingDeadlines[0].dueAt < now ? 'border-rose-200 bg-gradient-to-br from-rose-50 to-white' : 'border-amber-200 bg-gradient-to-br from-amber-50 to-white'} p-5 shadow-sm transition hover:shadow-md">
            <div class="mb-4 flex items-center justify-between gap-3">
              <div class="flex items-center gap-3"><span class="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${pendingDeadlines[0].dueAt < now ? 'bg-rose-600' : 'bg-amber-500'} text-lg text-white shadow-sm">⏰</span><div class="text-[10px] font-black uppercase tracking-widest text-rose-700">${st('Homework deadlines', 'Hạn nộp bài tập')}</div></div>
              <span class="text-[10px] font-black bg-white/80 rounded-full px-2 py-1 text-slate-600">${pendingDeadlines.length} ${st('pending', 'đang chờ')}</span>
            </div>
            <div class="space-y-2.5">${pendingDeadlines.slice(0, 4).map(({ testId, settings, dueAt }) => {
                const test = TEST_BANK.find(item => item.id === testId);
                const overdue = dueAt < now;
                return `<div class="rounded-xl bg-white border ${overdue ? 'border-rose-200' : 'border-amber-100'} p-3.5 shadow-sm">
                    <div class="font-black text-sm text-slate-800">${escapeForumHtml(test?.title || 'Homework / Test')}</div>
                    <div class="text-[11px] font-black ${overdue ? 'text-rose-700' : 'text-amber-700'} mt-1">${overdue ? `${st('OVERDUE', 'QUÁ HẠN')} · ` : `${st('Due', 'Hạn nộp')} · `}${dueAt.toLocaleString(dateLocale, { dateStyle: 'medium', timeStyle: 'short' })}</div>
                    ${test && getCurrentStudentAssignedTest(testId) ? `<button type="button" data-student-overview-test="${escapeForumHtml(testId)}" class="mt-2 text-xs font-black text-blue-700 hover:text-blue-900">${st('Open test →', 'Mở bài thi →')}</button>` : ''}
                </div>`;
            }).join('')}</div>
            ${pendingDeadlines.length > 4 ? `<p class="text-[11px] font-bold text-slate-500 mt-2">+ ${pendingDeadlines.length - 4} more pending</p>` : ''}
          </article>` : `
          <article class="rounded-2xl border border-emerald-200 bg-gradient-to-br from-emerald-50 to-white p-5 shadow-sm">
            <div class="mb-3 flex items-center gap-3"><span class="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-600 text-lg text-white shadow-sm">✓</span><div class="text-[10px] font-black uppercase tracking-widest text-emerald-700">${st('Homework deadlines', 'Hạn nộp bài tập')}</div></div>
            <p class="font-black text-emerald-900">${st('No pending homework deadlines.', 'Không có bài tập nào sắp đến hạn.')}</p>
            <p class="text-xs text-emerald-800 mt-1">${st('You’re all caught up.', 'Bạn đã hoàn thành đầy đủ.')}</p>
          </article>`;
      if (overviewContent) {
          overviewContent.innerHTML = `
            ${deadlineOverviewHtml}
            ${nextLessonHtml}
            <article class="rounded-2xl border border-blue-200 bg-gradient-to-br from-blue-50 to-white p-5 shadow-sm transition hover:shadow-md">
              <div class="mb-4 flex items-center gap-3"><span class="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-600 text-lg text-white shadow-sm">📚</span><div class="text-[10px] font-black uppercase tracking-widest text-blue-700">${st('Test Bank', 'Ngân hàng đề')}</div></div>
              <p class="font-black text-blue-950 text-xl">${st(`${totalTests} assigned test${totalTests === 1 ? '' : 's'}`, `${totalTests} bài được giao`)}</p>
              <p class="text-sm text-blue-800 mt-1">${completedCount} ${st('completed', 'đã hoàn thành')} · ${Math.max(0, totalTests - completedCount)} ${st('remaining', 'còn lại')}</p>
              <div class="mt-4 h-2 overflow-hidden rounded-full bg-blue-100" role="progressbar" aria-label="Test completion" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${progressPct}"><div class="h-full rounded-full bg-gradient-to-r from-blue-600 to-indigo-500 transition-all" style="width:${progressPct}%"></div></div>
              <button type="button" data-student-test-bank class="mt-4 inline-flex items-center gap-1 text-xs font-black text-blue-700 hover:text-blue-900">${st('Open Test Bank →', 'Mở Ngân hàng đề →')}</button>
            </article>
            <article class="rounded-2xl border border-indigo-200 bg-gradient-to-br from-indigo-50 to-white p-5 shadow-sm transition hover:shadow-md">
              <div class="mb-4 flex items-center gap-3"><span class="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-600 text-lg text-white shadow-sm">🏫</span><div class="text-[10px] font-black uppercase tracking-widest text-indigo-700">${st('Class', 'Lớp học')}</div></div>
              <p class="font-black text-indigo-950 text-xl">${escapeForumHtml(displayClassName)}</p>
              <p class="text-sm text-indigo-800 mt-1">${nextLesson ? `${st('Next lesson:', 'Buổi học tiếp theo:')} ${nextLesson.startsAt.toLocaleString(dateLocale, { dateStyle: 'medium', timeStyle: 'short' })}` : st('View your classmates, timetable, preparation, and homework.', 'Xem bạn cùng lớp, thời khóa biểu, nội dung chuẩn bị và bài tập.')}</p>
              <button type="button" data-student-class class="mt-4 inline-flex items-center gap-1 text-xs font-black text-indigo-700 hover:text-indigo-900">${st('Open Class →', 'Mở Lớp học →')}</button>
            </article>`;
          overviewContent.querySelector('[data-student-test-bank]')?.addEventListener('click', () => window.navigateAppRoute('student/test-bank'));
          overviewContent.querySelector('[data-student-class]')?.addEventListener('click', () => window.navigateAppRoute('student/class'));
      }
      if (classOverviewContent) {
          classOverviewContent.innerHTML = `${deadlineOverviewHtml}${nextLessonHtml}`;
          classOverviewContent.querySelectorAll('[data-student-overview-test]').forEach(button => {
              button.addEventListener('click', () => openModeSelection(button.dataset.studentOverviewTest));
          });
          const joinButton = classOverviewContent.querySelector('[data-student-next-lesson]');
          if (joinButton) joinButton.addEventListener('click', () => window.joinLiveClass(nextSchedule.id, nextSchedule.topic || 'General Practice'));
      }
      if (classInfoSection) {
          classInfoSection.innerHTML = `
            <div class="flex items-center gap-3 mb-5 border-b border-slate-100 pb-4">
              <div class="w-10 h-10 rounded-xl bg-indigo-100 text-indigo-600 flex items-center justify-center text-xl shadow-inner shrink-0">🏫</div>
              <div class="min-w-0">
                <h3 class="font-black text-slate-800 text-base leading-tight truncate">${st('Mini class', 'Lớp nhỏ')}: ${escapeForumHtml(displayClassName)}</h3>
                <p class="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">${st('Shared materials', 'Tài liệu chung')}: ${escapeForumHtml(getClassParent(cls)?.name || cls.name)}</p>
              </div>
            </div>
            <h4 class="text-[10px] font-black uppercase text-emerald-600 mb-3 tracking-widest flex items-center gap-1.5"><span>👥</span> ${st('Classmates', 'Bạn cùng lớp')} (${classmates.length})</h4>
            <div class="space-y-2">
              ${classmates.map(({ student, online, activityLabel }) => `
                <div class="flex items-center gap-3 p-3 rounded-xl ${student === currentUser.user ? 'bg-indigo-50 border border-indigo-200 shadow-sm' : 'bg-slate-50 border border-slate-100'}">
                  <img src="https://ui-avatars.com/api/?name=${encodeURIComponent(student)}&background=random" class="w-8 h-8 rounded-full shadow-sm border border-white">
                  <div class="min-w-0">
                    <span class="text-xs font-bold ${student === currentUser.user ? 'text-indigo-800' : 'text-slate-700'}">${escapeForumHtml(student)}${student === currentUser.user ? `<span class="text-[9px] opacity-60 uppercase tracking-widest ml-1">(${st('You', 'Bạn')})</span>` : ''}</span>
                    <span class="flex items-center gap-1.5 mt-1 text-[10px] font-bold ${online ? 'text-emerald-600' : 'text-slate-400'}"><span class="w-2 h-2 rounded-full ${online ? 'bg-emerald-500' : 'bg-slate-300'}"></span>${escapeForumHtml(activityLabel)}</span>
                  </div>
                </div>
              `).join('') || `<p class="text-xs text-slate-400 italic">${st('No other students in this class yet.', 'Chưa có học viên nào khác trong lớp.')}</p>`}
            </div>`;
      }
      prog.innerHTML = `
        <div class="bg-gradient-to-r from-blue-600 to-indigo-600 rounded-3xl p-5 text-white shadow-sm border border-blue-500/40">
            <div class="flex items-center justify-between gap-3 mb-4">
                <div>
                    <h3 class="text-[10px] font-black uppercase tracking-[0.2em] text-blue-100">${st('Your Test Bank', 'Ngân hàng đề của bạn')}</h3>
                    <div class="font-black text-xl mt-1">${st(`${totalTests} assigned test${totalTests === 1 ? '' : 's'}`, `${totalTests} bài được giao`)}</div>
                </div>
                <span class="text-2xl">📚</span>
            </div>
            <div class="bg-white/10 border border-white/20 rounded-2xl p-4 backdrop-blur-sm mb-4">
                <div class="text-[10px] uppercase tracking-[0.16em] text-blue-200 mb-1">${st('Test progress', 'Tiến độ làm bài')}</div>
                <div class="font-black text-lg leading-snug">${completedCount} / ${totalTests} ${st('completed', 'đã hoàn thành')}</div>
            </div>
            <div class="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <button onclick="window.openStudentHistory()" class="bg-white text-blue-700 hover:bg-blue-50 font-black py-3 px-4 rounded-xl transition shadow-sm flex items-center justify-center gap-2">${st('📜 Review Test History', '📜 Xem lịch sử thi')}</button>
                <button onclick="window.showPeerReviewList()" class="relative bg-indigo-50 text-indigo-700 hover:bg-indigo-100 border border-indigo-200 font-black py-3 px-4 rounded-xl transition shadow-sm flex items-center justify-center gap-2">
                  <span id="test-bank-peer-review-badge" class="hidden absolute -top-2 -right-2 bg-rose-500 text-white text-[10px] font-black min-w-5 h-5 px-1 items-center justify-center rounded-full shadow-md"></span>
                  ${st('🤝 Writing & Speaking Peer Review', '🤝 Chấm chéo Writing & Speaking')}
                </button>
            </div>
        </div>

        <div class="bg-white rounded-3xl p-6 shadow-sm border border-slate-200 mt-1">
            <div class="flex justify-between items-end mb-3">
                <div>
                    <h3 class="font-black text-xs text-slate-400 uppercase tracking-widest">${st('Test Bank Progress', 'Tiến độ Ngân hàng đề')}</h3>
                    <div class="font-bold text-slate-600 text-sm mt-1">${completedCount} / ${totalTests} ${st('tests completed', 'bài đã hoàn thành')}</div>
                </div>
                <span class="font-black text-4xl text-blue-600 tracking-tighter leading-none">${progressPct}%</span>
            </div>
            <div class="w-full bg-slate-100 rounded-full h-3.5 overflow-hidden shadow-inner border border-slate-200/60 mt-4">
                <div class="bg-gradient-to-r from-blue-400 to-blue-600 h-full rounded-full transition-all duration-1000 shadow-sm" style="width: ${progressPct}%"></div>
            </div>
        </div>
      `;
      prog.insertAdjacentHTML('beforeend', renderQuestionTypeAnalytics(mySubs));
      window.translateStudentStatic();
    };

    let pendingTestId = null;
    let pendingSpeakingPartTwoIndex = -1;

    function findSpeakingPartTwoIndex(test) {
      if (test?.module !== 'speaking' || !Array.isArray(test.parts)) return -1;
      const hasSingleRecordingQuestion = part => {
        const recordingQuestions = (part.questions || []).filter(question => question.type === 'audio_record');
        return recordingQuestions.length === 1 && recordingQuestions[0].ids?.length === 1;
      };
      return test.parts.findIndex((part, index) => {
        const label = `${part.title || ''} ${part.speakingQuestions || ''} ${(part.questions || []).map(question => `${question.instruction || ''} ${question.text || ''}`).join(' ')}`;
        return hasSingleRecordingQuestion(part) && (
          /\bpart\s*2\b|\bcue[\s-]*card\b/i.test(label) || index === 1
        );
      });
    }

    window.updateSpeakingSimulationAvailability = function() {
      const option = document.getElementById('speaking-simulation-option');
      const checkbox = document.getElementById('speaking-simulation-checkbox');
      const selectedPartTwo = document.querySelector(`.part-select-cb[value="${pendingSpeakingPartTwoIndex}"]`)?.checked;
      const available = pendingSpeakingPartTwoIndex >= 0 && selectedPartTwo;
      if (option) option.classList.toggle('hidden', !available);
      if (!available && checkbox) checkbox.checked = false;
      if (checkbox?.checked && document.querySelectorAll('.part-select-cb:checked').length !== 1) {
          checkbox.checked = false;
      }
    };

    window.handleSpeakingSimulationToggle = function(enabled) {
      if (!enabled) return;
      document.querySelectorAll('.part-select-cb').forEach(partCheckbox => {
          partCheckbox.checked = Number(partCheckbox.value) === pendingSpeakingPartTwoIndex;
      });
      window.selectTestMode('restricted');
    };

    function getCurrentStudentAssignedTest(testId) {
      if (!testId || !currentUser || currentUser.role !== 'student') return null;
      const cid = document.getElementById('student-class-select')?.value;
      const cls = CLASSES.find(c => c.id === cid);
      if (!cls) return null;
      const assigned = getClassAssignedTests(cls).includes(testId);
      const scheduled = SCHEDULES.some(schedule =>
        window.scheduleBelongsToClass(schedule, cls) &&
        (!schedule.attendingStudents || schedule.attendingStudents.includes(currentUser.user)) &&
        [...(schedule.assignedTests || []), ...(schedule.materialIds || []), ...(schedule.homeworkTests || [])].includes(testId)
      );
      return assigned || scheduled ? { testId } : null;
    }

    function openModeSelection(tid) {
      if (currentUser?.role === 'student' && !getCurrentStudentAssignedTest(tid)) {
          showModalMsg('Unavailable', 'This test is not assigned to your current class.');
          return;
      }

      pendingTestId = tid;
      
      const t = TEST_BANK.find(x => x.id === tid);
      pendingSpeakingPartTwoIndex = findSpeakingPartTwoIndex(t);
      const speakingSimulationCheckbox = document.getElementById('speaking-simulation-checkbox');
      if (speakingSimulationCheckbox) speakingSimulationCheckbox.checked = false;
      const partContainer = document.getElementById('part-selection-container');
      const partCheckboxes = document.getElementById('part-checkboxes');
      
      // Auto-generate checkboxes for however many parts the test has
      if (t && t.parts && t.parts.length > 0) {
          partContainer.classList.remove('hidden');
          partCheckboxes.innerHTML = t.parts.map((p, idx) => `
              <label class="flex items-center space-x-2 cursor-pointer bg-slate-50 border border-slate-200 px-3 py-1.5 rounded-lg hover:bg-slate-100 transition shadow-sm">
                  <input type="checkbox" class="part-select-cb w-4 h-4 text-blue-600 rounded focus:ring-blue-500" value="${idx}" checked onchange="window.updateSpeakingSimulationAvailability()">
                  <span class="font-bold text-slate-700 text-sm">${p.title || 'Part ' + (idx + 1)}</span>
              </label>
          `).join('');
      } else {
          partContainer.classList.add('hidden');
      }
      
      window.updateSpeakingSimulationAvailability();
      document.getElementById('test-mode-modal').classList.remove('hidden');
      window.focusTestModeDialog(document.activeElement);
    }

    function confirmStartTest() {
      // Gather which checkboxes are checked
      const checkboxes = document.querySelectorAll('.part-select-cb:checked');
      const selectedParts = Array.from(checkboxes).map(cb => parseInt(cb.value));
      
      if (selectedParts.length === 0) {
          showModalMsg("Selection Required", "Please select at least one part to start the test.");
          return;
      }

      const speakingSimulationEnabled = document.getElementById('speaking-simulation-checkbox')?.checked === true;
      if (speakingSimulationEnabled &&
          (selectedParts.length !== 1 || selectedParts[0] !== pendingSpeakingPartTwoIndex)) {
          showModalMsg("Part 2 Required", "The virtual Speaking mode runs Part 2 only. Select the Part 2 cue card by itself.");
          return;
      }
      
      document.getElementById('test-mode-modal').classList.add('hidden');
      window.clearTestModeDialogFocus();
      window.isSpeakingPartTwoSimulation = speakingSimulationEnabled;
      window.speakingSimulationSourcePartIndex = speakingSimulationEnabled ? pendingSpeakingPartTwoIndex : -1;
      window.speakingSimulationPartKey = '';
      if (pendingTestId) {
          startTest(pendingTestId, selectedParts); // Pass the chosen parts!
      }
    }
    window.confirmStartTest = confirmStartTest;

    let activeTestRoute = false;
    let directTestRoutePending = null;
    let handlingTestRoute = false;
    let routerReady = false;
    let appRouterApplying = false;
    let lastAppliedAppRoute = null;

    function parseTestHashRoute() {
      const match = window.location.hash.match(/^#\/test\/([^?]+)(?:\?(.*))?$/);
      if (!match) return null;
      const params = new URLSearchParams(match[2] || '');
      let id;
      try {
        id = decodeURIComponent(match[1]);
      } catch (error) {
        return null;
      }
      return {
        id,
        parts: params.has('parts') ? params.get('parts').split(',').map(Number) : null,
        mode: params.get('mode'),
        minutes: params.get('mins')
      };
    }

    function buildTestHashRoute(testId, selectedParts) {
      const params = new URLSearchParams();
      params.set('parts', selectedParts.join(','));
      params.set('mode', testMode === 'free' ? 'free' : 'restricted');
      const minutes = parseInt(document.getElementById('custom-time-input')?.value, 10);
      if (testMode !== 'free' && minutes > 0) params.set('mins', String(minutes));
      return `#/test/${encodeURIComponent(testId)}?${params.toString()}`;
    }

    function replaceWithDashboardRoute() {
      activeTestRoute = false;
      directTestRoutePending = null;
      window.activeTestRouteHash = null;
      const dashboardHash = currentUser && ['teacher', 'collaborator'].includes(currentUser.role)
        ? '#/teacher/bank/tests'
        : '#/student/dashboard';
      if (window.location.hash !== dashboardHash) {
        window.history.replaceState({ lmsRoute: 'dashboard' }, '', dashboardHash);
      } else if (window.history.state?.lmsRoute !== 'dashboard') {
        window.history.replaceState({ lmsRoute: 'dashboard' }, '', dashboardHash);
      }
    }

    function normalizeAppRoute(hash = window.location.hash) {
      const raw = (hash || '').replace(/^#\/?/, '');
      if (!raw || raw === 'dashboard') return { section: 'dashboard', role: 'student' };
      if (raw.startsWith('test/')) return { section: 'test' };
      let parts;
      try {
        parts = raw.split('/').map(part => decodeURIComponent(part));
      } catch (error) {
        return { section: 'dashboard', role: 'student' };
      }
      if (parts[0] === 'student') return { role: 'student', section: parts[1] || 'dashboard', detail: parts[2] || '' };
      if (parts[0] === 'teacher') return { role: 'teacher', section: parts[1] || 'bank', detail: parts[2] || '' };
      if (parts[0] === 'login') return { section: 'login' };
      if (parts[0] === 'landing') return { section: 'landing' };
      if (parts[0] === 'hall-of-fame') return { section: 'hall-of-fame' };
      return { section: 'dashboard', role: 'student' };
    }

    window.toggleAppSidebar = function(role) {
      const root = document.getElementById(role === 'teacher' ? 'editor-ui' : 'start-screen');
      const sidebar = document.getElementById(role === 'teacher' ? 'editor-sidebar' : 'student-sidebar');
      const backdrop = document.getElementById(role === 'teacher' ? 'editor-sidebar-backdrop' : 'student-sidebar-backdrop');
      const toggle = root?.querySelector('.app-sidebar-toggle');
      if (!root || !sidebar || !backdrop) return;

      if (window.matchMedia('(max-width: 1024px)').matches) {
        const open = !sidebar.classList.contains('is-open');
        sidebar.classList.toggle('is-open', open);
        backdrop.classList.toggle('is-open', open);
        if (toggle) toggle.setAttribute('aria-expanded', String(open));
      } else {
        const collapsed = root.classList.toggle('sidebar-collapsed');
        const collapseButton = root.querySelector('.app-sidebar-collapse');
        if (collapseButton) {
          collapseButton.title = collapsed ? 'Expand sidebar' : 'Collapse sidebar';
          collapseButton.setAttribute('aria-label', collapseButton.title);
        }
      }
    };

    window.closeAppSidebar = function(role) {
      const root = document.getElementById(role === 'teacher' ? 'editor-ui' : 'start-screen');
      const sidebar = document.getElementById(role === 'teacher' ? 'editor-sidebar' : 'student-sidebar');
      const backdrop = document.getElementById(role === 'teacher' ? 'editor-sidebar-backdrop' : 'student-sidebar-backdrop');
      sidebar?.classList.remove('is-open');
      backdrop?.classList.remove('is-open');
      root?.querySelector('.app-sidebar-toggle')?.setAttribute('aria-expanded', 'false');
    };

    function setSidebarRoute(role, path) {
      const routeParts = path.replace(/^#?\/?/, '').split('/');
      let item;
      if (role === 'teacher') {
        item = routeParts[1] === 'bank'
          ? (routeParts[2] === 'classes' ? 'teacher-classes' : 'teacher-bank')
          : `teacher-${routeParts[1]}`;
      } else {
        const section = ['history', 'peer-review', 'review'].includes(routeParts[1])
          ? 'test-bank'
          : ['leaderboard', 'timetable'].includes(routeParts[1])
            ? 'class'
            : routeParts[1] === 'flashcards'
              ? 'study-tools'
            : (routeParts[1] || 'dashboard');
        item = `student-${section}`;
      }
      document.querySelectorAll(`#${role === 'teacher' ? 'editor-sidebar' : 'student-sidebar'} [data-sidebar-item]`).forEach(button => {
        button.classList.toggle('is-active', button.dataset.sidebarItem === item);
      });
    }

    window.navigateFromSidebar = function(role, path) {
      window.navigateAppRoute(path);
      setSidebarRoute(role, path);
      window.closeAppSidebar(role);
    };

    window.goToAppHome = function(role) {
      if (!currentUser) {
        window.navigateAppRoute('landing');
        return;
      }
      const isTeacher = role === 'teacher' || ['teacher', 'collaborator'].includes(currentUser?.role);
      const targetRole = isTeacher ? 'teacher' : 'student';
      const path = isTeacher ? 'teacher/bank/tests' : 'student/dashboard';
      window.navigateAppRoute(path);
      setSidebarRoute(targetRole, path);
      window.closeAppSidebar(targetRole);
      const view = document.getElementById(isTeacher ? 'editor-view-bank' : 'start-screen');
      if (view) view.scrollTop = 0;
    };

    function applyAppRoute(route = normalizeAppRoute()) {
      if (currentUser?.role === 'student' && !window.canAccessLMS(currentUser, window.auth?.currentUser) &&
          (route?.role === 'student' || route?.section === 'test' || parseTestHashRoute())) {
        route = { role: 'student', section: 'dashboard' };
        window.history.replaceState({ lmsRoute: 'student' }, '', '#/student/dashboard');
        window.renderAccountGate();
        return;
      }
      if (route.section === 'test' || !route) return;
      if (route.role && ['student', 'teacher'].includes(route.role)) {
        setSidebarRoute(route.role, window.location.hash);
        window.closeAppSidebar(route.role);
      }
      appRouterApplying = true;
      try {
        const publicLanding = document.getElementById('public-landing-ui');
        const authUi = document.getElementById('auth-ui');
        const studentUi = document.getElementById('start-screen');
        const editorUi = document.getElementById('editor-ui');
        const examUi = document.getElementById('exam-ui');
        const reviewUi = document.getElementById('review-ui');

        if (route.section !== 'history') document.getElementById('student-history-modal')?.classList.add('hidden');
        if (route.section !== 'flashcards') document.getElementById('student-fc-panel')?.classList.add('hidden');
        if (route.section !== 'leaderboard') document.getElementById('test-leaderboard-modal')?.classList.add('hidden');
        document.getElementById('chat-panel')?.classList.add('hidden');
        if (route.section !== 'peer-review' && route.section !== 'leaderboard') document.getElementById('custom-modal')?.classList.add('hidden');
        if (route.section === 'hall-of-fame') {
          document.getElementById('hof-full-screen')?.classList.remove('hidden');
          window.renderHOFGrid();
          lastAppliedAppRoute = route;
          routerReady = true;
          return;
        }
        document.getElementById('hof-full-screen')?.classList.add('hidden');
        document.getElementById('chat-panel')?.classList.add('hidden');
        if (!currentUser) {
          publicLanding?.classList.toggle('hidden', route.section !== 'landing' && route.section !== 'dashboard');
          authUi?.classList.toggle('hidden', route.section !== 'login');
          studentUi?.classList.add('hidden');
          editorUi?.classList.add('hidden');
          if (route.section !== 'login' && route.section !== 'landing' && route.section !== 'dashboard') {
            window.history.replaceState({ lmsRoute: 'landing' }, '', '#/landing');
          }
          lastAppliedAppRoute = route;
          routerReady = true;
          return;
        }

        publicLanding?.classList.add('hidden');
        authUi?.classList.add('hidden');
        if (['teacher', 'collaborator'].includes(currentUser.role) && route.role !== 'teacher') {
          route = { role: 'teacher', section: 'bank', detail: 'tests' };
          window.history.replaceState({ lmsRoute: 'teacher' }, '', '#/teacher/bank/tests');
        } else if (currentUser.role === 'student' && route.role !== 'student') {
          route = { role: 'student', section: 'dashboard' };
          window.history.replaceState({ lmsRoute: 'dashboard' }, '', '#/student/dashboard');
        } else if (route.role === 'student' && route.section === 'dashboard' && window.location.hash === '#/dashboard') {
          window.history.replaceState({ lmsRoute: 'dashboard' }, '', '#/student/dashboard');
        }
        if (route.section === 'forum') {
          route = ['teacher', 'collaborator'].includes(currentUser.role)
            ? { role: 'teacher', section: 'bank', detail: 'tests' }
            : { role: 'student', section: 'dashboard' };
          const forumRedirect = route.role === 'teacher' ? '#/teacher/bank/tests' : '#/student/dashboard';
          window.history.replaceState({ lmsRoute: route.role }, '', forumRedirect);
          setSidebarRoute(route.role, forumRedirect);
        }
        if (route.role === 'teacher') {
          if (!['teacher', 'collaborator'].includes(currentUser.role)) {
            window.history.replaceState({ lmsRoute: 'dashboard' }, '', '#/student/dashboard');
            route = { role: 'student', section: 'dashboard' };
          } else {
            studentUi?.classList.add('hidden');
            editorUi?.classList.remove('hidden');
            if (route.section === 'review') {
              const submissionId = Number(route.detail);
              if (currentUser.role === 'teacher' && Number.isFinite(submissionId) && SUBMISSIONS.some(sub => Number(sub.id) === submissionId)) openGradingView(submissionId);
              else {
                route = { role: 'teacher', section: 'bank', detail: 'tests' };
                window.history.replaceState({ lmsRoute: 'teacher' }, '', '#/teacher/bank/tests');
                toggleEditorTab('bank');
                window.toggleDashboardView('tests');
              }
            } else if (route.section === 'builder') {
              const test = TEST_BANK.find(item => item.id === route.detail);
              if (test) editTest(test.id);
              else {
                route = { role: 'teacher', section: 'bank', detail: 'tests' };
                window.history.replaceState({ lmsRoute: 'teacher' }, '', '#/teacher/bank/tests');
                toggleEditorTab('bank');
              }
            } else {
              const validTabs = ['overview', 'bank', 'classes', 'students', 'payments', 'timetable', 'landing'];
              const tab = validTabs.includes(route.section) && !(route.section === 'overview' && currentUser.role !== 'teacher')
                ? route.section
                : 'bank';
              if (tab === 'bank' && ['tests', 'classes'].includes(route.detail)) {
                sessionStorage.setItem('lms_dash_view', route.detail);
              }
              toggleEditorTab(tab);
              if (tab === 'bank') window.toggleDashboardView(['tests', 'classes'].includes(route.detail) ? route.detail : 'tests');
            }
            lastAppliedAppRoute = route;
            routerReady = true;
            return;
          }
        }

        if (route.role !== 'student' || currentUser.role !== 'student') {
          route = { role: 'student', section: 'dashboard' };
        }
        if (!hasActiveStudentAccess(currentUser)) {
          if (examUi && !examUi.classList.contains('hidden')) examUi.classList.add('hidden');
          activeTestRoute = false;
          if (route.section !== 'dashboard') {
            route = { role: 'student', section: 'dashboard' };
            window.history.replaceState({ lmsRoute: 'student' }, '', '#/student/dashboard');
          }
          window.initStudentDashboard();
        }
        if (examUi && !examUi.classList.contains('hidden')) {
          lastAppliedAppRoute = route;
          routerReady = true;
          return;
        }

        editorUi?.classList.add('hidden');
        studentUi?.classList.remove('hidden');
        reviewUi?.classList.add('hidden');
        if (route.section === 'timetable' || route.section === 'class') {
          if (typeof window.renderStudentDashboard === 'function') window.renderStudentDashboard();
          requestAnimationFrame(() => document.getElementById('student-schedule-section')?.scrollIntoView({ behavior: 'smooth', block: 'start' }));
        } else if (route.section === 'dashboard' || !['class', 'test-bank', 'study-tools', 'history', 'flashcards', 'peer-review', 'leaderboard', 'review', 'timetable'].includes(route.section)) {
          route = { role: 'student', section: 'dashboard' };
          if (typeof window.renderStudentDashboard === 'function') window.renderStudentDashboard();
        } else if (route.section === 'study-tools') {
          if (typeof window.renderStudentDashboard === 'function') window.renderStudentDashboard();
        } else if (route.section === 'test-bank') {
          if (typeof window.renderStudentDashboard === 'function') window.renderStudentDashboard();
        } else if (route.section === 'history') {
          window.openStudentHistory();
        } else if (route.section === 'flashcards') {
          if (typeof window.renderStudentDashboard === 'function') window.renderStudentDashboard();
          window.toggleStudentFlashcardPanel(true);
        } else if (route.section === 'peer-review') {
          if (route.detail && getPeerReviewCandidatesForCurrentStudent().some(sub => String(sub.id) === route.detail)) {
            window.openPeerReviewModal(Number(route.detail));
          } else {
            if (route.detail) {
              route = { role: 'student', section: 'peer-review', detail: '' };
              window.history.replaceState({ lmsRoute: 'student' }, '', '#/student/peer-review');
            }
            window.showPeerReviewList();
          }
        } else if (route.section === 'leaderboard') {
          window.showLeaderboardModal();
        } else if (route.section === 'review') {
          const submissionId = Number(route.detail);
          if (Number.isFinite(submissionId) && SUBMISSIONS.some(sub => Number(sub.id) === submissionId)) reviewPastSubmission(submissionId);
          else {
            route = { role: 'student', section: 'history' };
            window.history.replaceState({ lmsRoute: 'student' }, '', '#/student/history');
            window.openStudentHistory();
          }
        }
        lastAppliedAppRoute = route;
        routerReady = true;
      } finally {
        appRouterApplying = false;
      }
    }

    window.navigateAppRoute = function(path, replace = false) {
      if (currentUser?.role === 'student' && !window.canAccessLMS(currentUser, window.auth?.currentUser) &&
          !path.replace(/^#?\/?/, '').startsWith('student/dashboard')) {
        path = 'student/dashboard';
        replace = true;
      }
      const hash = `#/${path.replace(/^#?\/?/, '')}`;
      if (window.location.hash === hash) {
        applyAppRoute(normalizeAppRoute(hash));
        return;
      }
      const state = { lmsRoute: path.split('/')[0] || 'dashboard' };
      if (replace) window.history.replaceState(state, '', hash);
      else window.history.pushState(state, '', hash);
      if (!parseTestHashRoute()) applyAppRoute(normalizeAppRoute(hash));
    };

    window.closeAppRouteView = function() {
      const route = normalizeAppRoute();
      if (route.section === 'flashcards') {
        document.getElementById('student-fc-panel')?.classList.add('hidden');
      } else if (route.section === 'history') {
        document.getElementById('student-history-modal')?.classList.add('hidden');
      } else if (route.section === 'leaderboard') {
        document.getElementById('custom-modal')?.classList.add('hidden');
        document.getElementById('test-leaderboard-modal')?.classList.add('hidden');
      }
      const dashboardRoute = currentUser && ['teacher', 'collaborator'].includes(currentUser.role)
        ? 'teacher/bank/tests'
        : route.section === 'leaderboard'
          ? 'student/class'
          : route.section === 'flashcards'
            ? (window.studentFlashcardReturnRoute || 'student/dashboard')
          : ['history', 'peer-review', 'review'].includes(route.section)
            ? 'student/test-bank'
            : 'student/dashboard';
      window.navigateAppRoute(dashboardRoute, true);
    };

    function studentCanOpenTestRoute(testId) {
      if (!hasActiveStudentAccess(currentUser)) return false;
      const cid = document.getElementById('student-class-select')?.value;
      const cls = CLASSES.find(item => item.id === cid);
      if (!cls) return false;

      const assigned = getClassAssignedTests(cls).includes(testId);
      const scheduled = SCHEDULES.some(schedule =>
        window.scheduleBelongsToClass(schedule, cls) &&
        (!schedule.attendingStudents || schedule.attendingStudents.includes(currentUser.user)) &&
        [...(schedule.assignedTests || []), ...(schedule.materialIds || []), ...(schedule.homeworkTests || [])].includes(testId)
      );
      const test = TEST_BANK.find(item => item.id === testId);
      const price = Number(test?.price) || 0;
      const unlocked = !test || price <= 0 || (currentUser.unlockedTests || []).includes(testId);
      return Boolean((assigned || scheduled) && unlocked);
    }

    function openTestHashRoute(route, fromInitialLoad = false) {
      if (!route || !currentUser || handlingTestRoute || activeTestRoute) return;
      handlingTestRoute = true;
      try {
        if (currentUser.role !== 'student') {
          replaceWithDashboardRoute();
          if (typeof window.showToast === 'function') window.showToast('Notice', 'Test links are available to students only.', 'info');
          return;
        }

        const test = TEST_BANK.find(item => item.id === route.id);
        if (!test || !studentCanOpenTestRoute(route.id)) {
          replaceWithDashboardRoute();
          if (typeof window.showToast === 'function') window.showToast('Unavailable', 'This test is not available to your current class.', 'error');
          return;
        }

        if (!getCurrentStudentAssignedTest(route.id)) {
          replaceWithDashboardRoute();
          if (typeof window.showToast === 'function') window.showToast('Unavailable', 'This test is not assigned to your current class.', 'error');
          return;
        }

        if (fromInitialLoad && !window.history.state?.lmsRoute) {
          const requestedHash = window.location.hash;
          window.history.replaceState({ lmsRoute: 'dashboard' }, '', '#/student/dashboard');
          window.history.pushState({ lmsRoute: 'test' }, '', requestedHash);
        }

        directTestRoutePending = route;
        openModeSelection(route.id);
        const modeModal = document.getElementById('test-mode-modal');
        if (!modeModal || modeModal.classList.contains('hidden')) {
          replaceWithDashboardRoute();
          return;
        }

        selectTestMode(route.mode === 'free' ? 'free' : 'restricted');
        if (route.minutes && Number(route.minutes) > 0) {
          document.getElementById('custom-time-input').value = String(Math.min(180, Math.max(1, Number(route.minutes))));
        }
        if (Array.isArray(route.parts) && route.parts.length) {
          const requestedParts = new Set(route.parts.filter(index => Number.isInteger(index) && index >= 0 && index < test.parts.length));
          if (requestedParts.size) {
            document.querySelectorAll('.part-select-cb').forEach(checkbox => {
              checkbox.checked = requestedParts.has(Number(checkbox.value));
            });
          }
        }
        window.updateSpeakingSimulationAvailability();
      } finally {
        handlingTestRoute = false;
      }
    }

    window.cancelTestRouteStart = function() {
      document.getElementById('test-mode-modal').classList.add('hidden');
      window.restoreTestModeDialogFocus();
      if (directTestRoutePending) replaceWithDashboardRoute();
    };

    function handleTestRouteNavigation(fromInitialLoad = false) {
      const route = parseTestHashRoute();
      if (route) {
        if (activeTestRoute) {
          if (window.activeTestRouteHash && window.location.hash !== window.activeTestRouteHash) {
            window.history.replaceState({ lmsRoute: 'test' }, '', window.activeTestRouteHash);
          }
        } else if (!directTestRoutePending || directTestRoutePending.id !== route.id) {
          openTestHashRoute(route, fromInitialLoad);
        }
      } else if (directTestRoutePending) {
        document.getElementById('test-mode-modal').classList.add('hidden');
        window.restoreTestModeDialogFocus();
        directTestRoutePending = null;
      } else if (activeTestRoute) {
        const examVisible = !document.getElementById('exam-ui').classList.contains('hidden');
        if (examVisible && (window.isSecureModeActive || !isTimeFree)) {
          const currentRoute = window.activeTestRouteHash;
          if (currentRoute) window.history.replaceState({ lmsRoute: 'test' }, '', currentRoute);
          if (typeof window.showToast === 'function') window.showToast('Test in progress', 'Exit the test using the on-screen controls.', 'info');
          return;
        }

        if (examVisible) {
          const currentRoute = window.activeTestRouteHash;
          if (currentRoute) window.history.replaceState({ lmsRoute: 'test' }, '', currentRoute);
          window.exitTestWithoutSaving();
        } else {
          document.getElementById('results-modal')?.classList.add('hidden');
          document.getElementById('review-ui')?.classList.add('hidden');
          replaceWithDashboardRoute();
          document.getElementById('start-screen').classList.remove('hidden');
          window.renderStudentDashboard();
        }
      }
    }

    function handleAppRouteNavigation(fromInitialLoad = false) {
      const incomingTestRoute = parseTestHashRoute();
      if (!currentUser && incomingTestRoute) {
        sessionStorage.setItem('lms_pending_test_route', window.location.hash);
        window.history.replaceState({ lmsRoute: 'login' }, '', '#/login');
        applyAppRoute({ section: 'login' });
        return;
      }
      const pendingTestRoute = currentUser && sessionStorage.getItem('lms_pending_test_route');
      if (pendingTestRoute && (!window.location.hash || ['login', 'landing'].includes(normalizeAppRoute().section))) {
        sessionStorage.removeItem('lms_pending_test_route');
        const homeHash = ['teacher', 'collaborator'].includes(currentUser.role) ? '#/teacher/bank/tests' : '#/student/dashboard';
        window.history.replaceState({ lmsRoute: 'dashboard' }, '', homeHash);
        window.history.pushState({ lmsRoute: 'test' }, '', pendingTestRoute);
      }
      const examUi = document.getElementById('exam-ui');
      if (!parseTestHashRoute() && examUi && !examUi.classList.contains('hidden') &&
          window.isSecureModeActive && !activeTestRoute) {
        const returnHash = window.activeSyntheticExamReturnHash || '#/student/dashboard';
        window.history.replaceState({ lmsRoute: 'exam' }, '', returnHash);
        if (typeof window.showToast === 'function') window.showToast('Exam in progress', 'Finish the secure exam using the on-screen controls.', 'info');
        return;
      }
      const testRoute = parseTestHashRoute();
      if (testRoute) {
        handleTestRouteNavigation(fromInitialLoad);
        routerReady = true;
        return;
      }

      if (activeTestRoute) {
        handleTestRouteNavigation();
        if (activeTestRoute) return;
      }

      if (fromInitialLoad && !window.location.hash) {
        if (currentUser && ['teacher', 'collaborator'].includes(currentUser.role)) {
          const savedTest = sessionStorage.getItem('lms_editing_test');
          const savedSub = sessionStorage.getItem('lms_grading_sub');
          const savedMode = sessionStorage.getItem('lms_grading_mode');
          const savedTab = sessionStorage.getItem('lms_teacher_tab') || 'bank';
          const savedView = sessionStorage.getItem('lms_dash_view') || 'tests';
          const initialPath = savedSub && savedMode === 'teacher'
            ? `#/teacher/review/${encodeURIComponent(savedSub)}`
            : savedTest && savedTab === 'builder'
            ? `#/teacher/builder/${encodeURIComponent(savedTest)}`
            : savedTab === 'bank' ? `#/teacher/bank/${savedView}` : `#/teacher/${savedTab}`;
          window.history.replaceState({ lmsRoute: 'teacher' }, '', initialPath);
        } else if (currentUser) {
          window.history.replaceState({ lmsRoute: 'dashboard' }, '', '#/student/dashboard');
        } else {
          window.history.replaceState({ lmsRoute: 'landing' }, '', '#/landing');
        }
      }
      applyAppRoute();
    }

    window.addEventListener('popstate', () => handleAppRouteNavigation());
    window.addEventListener('hashchange', () => handleAppRouteNavigation());

    // ✨ NEW: Random Practice Spinner
    window.spunTestId = null;
    window.availableSpinTests = [];

    window.openRandomSpinner = function() {
        const cid = document.getElementById('student-class-select')?.value;
        const cls = CLASSES.find(c => c.id === cid);
        if (!cls) {
            showModalMsg("Notice", "Please select an active class first.");
            return;
        }

        // Gather all tests assigned to this student's class
        const mySubs = SUBMISSIONS.filter(s => s.student === currentUser.user && s.className === cls.name);
        const assignedTests = getClassAssignedTests(cls);
        
        // Keep random practice aligned with the student's assigned Test Bank.
        window.availableSpinTests = assignedTests.map(testId => {
            const isCompleted = mySubs.some(s => s.testId === testId);
            const t = TEST_BANK.find(x => x.id === testId);
            const isPremiumLocked = Boolean(t && Number(t.price) > 0 && !(currentUser.unlockedTests || []).includes(t.id));
            return !isCompleted && !isPremiumLocked && t
                ? { testId, title: t.title, module: t.module }
                : null;
        }).filter(Boolean);

        if (window.availableSpinTests.length === 0) {
            window.showToast("All Caught Up!", "You have completed all available tests. Ask your teacher for more!");
            return;
        }

        // Reset UI State
        document.getElementById('spin-result-text').textContent = "Ready to roll?";
        document.getElementById('spin-result-text').className = "text-xl font-black text-slate-400 leading-snug w-full text-center";
        document.getElementById('btn-start-spin').classList.remove('hidden');
        document.getElementById('btn-start-spin').disabled = false;
        document.getElementById('btn-start-spin').classList.remove('opacity-50');
        document.getElementById('btn-go-spin').classList.add('hidden');
        
        const icon = document.getElementById('spin-icon');
        icon.classList.remove('animate-spin');
        icon.textContent = '🎲';
        
        document.getElementById('random-spin-modal').classList.remove('hidden');
    };

    window.startRandomSpin = function() {
        if (window.availableSpinTests.length === 0) return;
        
        const btnSpin = document.getElementById('btn-start-spin');
        const resultText = document.getElementById('spin-result-text');
        const icon = document.getElementById('spin-icon');
        
        btnSpin.disabled = true;
        btnSpin.classList.add('opacity-50');
        icon.classList.add('animate-spin'); // Uses native Tailwind spin
        
        let counter = 0;
        const maxSpins = 20; // Will cycle through 20 random titles rapidly
        const intervalTime = 80; // Super fast tick speed
        
        const spinInterval = setInterval(() => {
            const randomItem = window.availableSpinTests[Math.floor(Math.random() * window.availableSpinTests.length)];
            const t = TEST_BANK.find(x => x.id === randomItem.testId);
            
            resultText.textContent = t ? t.title : randomItem.title;
            // Blur effect during the spin for visual motion
            resultText.className = "text-xl font-bold text-slate-400 leading-snug blur-[2px] w-full text-center truncate";
            
            counter++;
            if (counter >= maxSpins) {
                clearInterval(spinInterval);
                
                // Final Selected Test
                const finalItem = window.availableSpinTests[Math.floor(Math.random() * window.availableSpinTests.length)];
                window.spunTestId = finalItem.testId;
                const finalT = TEST_BANK.find(x => x.id === finalItem.testId);
                
                // Pop the final result into view safely centered!
                resultText.innerHTML = `<span class="text-[10px] bg-pink-100 text-pink-700 px-3 py-1 rounded-full uppercase tracking-widest font-black inline-block mb-3 border border-pink-200 shadow-sm">${finalT.module}</span><br>${finalT.title}`;
                resultText.className = "text-xl sm:text-2xl font-black text-pink-600 leading-snug animate-scale-up w-full text-center";
                
                icon.classList.remove('animate-spin');
                icon.textContent = '🎉';
                
                btnSpin.classList.add('hidden');
                document.getElementById('btn-go-spin').classList.remove('hidden');
                
                // Fire existing UI celebration hook
                if (typeof window.playGemAnimation === 'function') window.playGemAnimation(); 
            }
        }, intervalTime);
    };

    window.goToSpunTest = function() {
        document.getElementById('random-spin-modal').classList.add('hidden');
        if (window.spunTestId) {
            openModeSelection(window.spunTestId);
        }
    };

    // ✨ NEW: Interactive Game Generation Engine
    window.openTestActivities = function() {
        if (!pendingTestId) return;
        const t = TEST_BANK.find(x => x.id === pendingTestId);
        if (!t) return;
        
        APP_DATA = JSON.parse(JSON.stringify(t));
        
        document.getElementById('test-mode-modal').classList.add('hidden');
        window.clearTestModeDialogFocus();
        document.getElementById('activity-mode-test-name').textContent = APP_DATA.title;
        document.getElementById('test-activities-modal').classList.remove('hidden');
        
        window.switchActivityMode('vocab');
    };

    window.switchActivityMode = function(mode) {
        document.querySelectorAll('.activity-tab-btn').forEach(btn => {
            btn.classList.remove('text-fuchsia-700', 'border-fuchsia-600', 'bg-fuchsia-50');
            btn.classList.add('text-slate-400', 'border-transparent');
        });
        const activeTab = document.getElementById(`activity-tab-${mode}`);
        if(activeTab) {
            activeTab.classList.add('text-fuchsia-700', 'border-fuchsia-600', 'bg-fuchsia-50');
            activeTab.classList.remove('text-slate-400', 'border-transparent');
        }

        const content = document.getElementById('activity-mode-content');
        // Extract intelligent topics for the prompts
        const topics = (APP_DATA.topics && APP_DATA.topics.length > 0) ? APP_DATA.topics.join(', ') : APP_DATA.module.charAt(0).toUpperCase() + APP_DATA.module.slice(1);

        if (window.activityTimer) clearInterval(window.activityTimer);

        if (mode === 'vocab') {
            const gameWords = APP_DATA.vocab || [];
            if (gameWords.length < 2) {
                content.innerHTML = `<div class="p-10 text-center bg-white border border-slate-200 rounded-3xl shadow-sm max-w-xl mx-auto mt-10"><span class="text-6xl mb-4 grayscale opacity-50 block">🎲</span><h3 class="text-xl font-black text-slate-800 mb-2">Not Enough Words</h3><p class="text-slate-500 font-medium">Your teacher needs to add at least 2 words to the <b class="text-blue-600">Test Vocabulary Bank</b> (via the Teacher Dashboard) to automatically generate the interactive board game for this specific test.</p></div>`;
            } else {
                content.innerHTML = `
                <div class="w-full max-w-6xl mx-auto py-2 animate-scale-up">
                    <div class="text-center mb-8">
                        <span class="text-5xl drop-shadow-md mb-3 block">🎲</span>
                        <h3 class="text-3xl md:text-4xl font-black text-fuchsia-950 tracking-tight">Vocabulary Challenge</h3>
                        <p class="text-sm font-black text-fuchsia-600 mt-2 uppercase tracking-widest bg-fuchsia-100 border border-fuchsia-200 px-4 py-1.5 rounded-full inline-block shadow-sm">Team A vs Team B</p>
                    </div>
                    <div class="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4 lg:gap-6">
                        ${gameWords.map((v, idx) => `
                            <div class="flip-card h-32 lg:h-40 cursor-pointer perspective-1000 group" onclick="this.classList.toggle('flipped')">
                                <div class="flip-card-inner w-full h-full relative transition-transform duration-500 rounded-2xl shadow-sm" style="transform-style: preserve-3d;">
                                    <div class="flip-card-front absolute w-full h-full bg-white border-2 border-fuchsia-200 rounded-2xl flex items-center justify-center p-4 backface-hidden shadow-sm group-hover:border-fuchsia-400 group-hover:bg-fuchsia-50 transition-colors" style="-webkit-backface-visibility: hidden; backface-visibility: hidden;">
                                        <span class="text-5xl font-black text-fuchsia-200 group-hover:text-fuchsia-400 transition-colors drop-shadow-sm">${idx + 1}</span>
                                    </div>
                                    <div class="flip-card-back absolute w-full h-full bg-gradient-to-br from-fuchsia-600 to-purple-700 border-2 border-fuchsia-800 rounded-2xl flex flex-col items-center justify-center p-5 backface-hidden shadow-lg text-center" style="transform: rotateY(180deg); -webkit-backface-visibility: hidden; backface-visibility: hidden;">
                                        <span class="font-black text-white text-xl lg:text-2xl leading-tight drop-shadow-md mb-1">${v.term}</span>
                                        <span class="text-xs text-fuchsia-200 font-bold leading-snug line-clamp-3">${v.eng || v.vi || ''}</span>
                                    </div>
                                </div>
                            </div>
                        `).join('')}
                    </div>
                </div>`;
            }
        } else if (mode === 'jigsaw') {
            const gameWords = [...(APP_DATA.vocab || [])].sort(() => Math.random() - 0.5);
            if (gameWords.length < 4) {
                content.innerHTML = `<div class="p-10 text-center bg-white border border-slate-200 rounded-3xl shadow-sm max-w-xl mx-auto mt-10"><span class="text-6xl mb-4 grayscale opacity-50 block">🧩</span><h3 class="text-xl font-black text-slate-800 mb-2">Not Enough Words</h3><p class="text-slate-500 font-medium">Your teacher needs to add at least 4 words to the <b class="text-blue-600">Test Vocabulary Bank</b> to generate a Jigsaw Gap activity.</p></div>`;
                return;
            }

            const listA = gameWords.map((v, i) => i % 2 === 0 ? `<div class="p-3 bg-white border-2 border-indigo-200 rounded-xl text-indigo-900 font-black text-lg shadow-sm text-center">${v.term}</div>` : `<div class="p-3 bg-slate-100 border-2 border-dashed border-slate-300 rounded-xl text-slate-400 font-bold text-base shadow-inner flex items-center justify-center italic">Missing Word</div>`).join('');
            const listB = gameWords.map((v, i) => i % 2 !== 0 ? `<div class="p-3 bg-white border-2 border-amber-200 rounded-xl text-amber-900 font-black text-lg shadow-sm text-center">${v.term}</div>` : `<div class="p-3 bg-slate-100 border-2 border-dashed border-slate-300 rounded-xl text-slate-400 font-bold text-base shadow-inner flex items-center justify-center italic">Missing Word</div>`).join('');

            content.innerHTML = `
            <div class="w-full max-w-5xl mx-auto py-2 animate-scale-up">
                <div class="text-center mb-8">
                    <span class="text-6xl drop-shadow-md mb-4 block">🧩</span>
                    <h3 class="text-3xl md:text-4xl font-black text-fuchsia-950 tracking-tight mb-4">Jigsaw Information Gap</h3>
                    <div class="bg-indigo-50 border border-indigo-200 text-indigo-900 p-5 rounded-2xl max-w-3xl mx-auto text-sm font-medium shadow-sm text-left">
                        <span class="font-black text-indigo-700 uppercase tracking-widest text-[10px] block mb-2">🧠 Interaction Hypothesis (Michael Long)</span>
                        Sit back-to-back with your partner. You each have half of the vocabulary list. You must describe your words in English without saying the exact word, so your partner can guess it and fill in their blanks! This forces heavy negotiation of meaning.
                    </div>
                </div>
                
                <div class="grid grid-cols-1 md:grid-cols-2 gap-8">
                    <div class="bg-indigo-50/50 rounded-3xl p-6 md:p-8 border-2 border-indigo-200 shadow-sm relative overflow-hidden">
                        <h4 class="font-black text-indigo-800 uppercase tracking-widest text-xl mb-6 text-center border-b-2 border-indigo-100 pb-4">Partner A's Screen</h4>
                        <div class="flex flex-col gap-3">${listA}</div>
                    </div>
                    <div class="bg-amber-50/50 rounded-3xl p-6 md:p-8 border-2 border-amber-200 shadow-sm relative overflow-hidden">
                        <h4 class="font-black text-amber-800 uppercase tracking-widest text-xl mb-6 text-center border-b-2 border-amber-100 pb-4">Partner B's Screen</h4>
                        <div class="flex flex-col gap-3">${listB}</div>
                    </div>
                </div>
            </div>`;
        } else if (mode === 'roleplay') {
            
            let pAText = "You are an expert on this topic. Summarize the main ideas from the text and explain them clearly to Student B.";
            let pBText = "You are a journalist. Ask your partner 3 challenging, follow-up questions based on what they tell you.";
            
            if (APP_DATA.module === 'activity') {
                APP_DATA.parts.forEach(p => {
                    p.questions.forEach(q => {
                        if (q.type === 'pair_roleplay') {
                            if (q.text) pAText = q.text;
                            if (q.hint) pBText = q.hint;
                        }
                    });
                });
            }

            content.innerHTML = `
            <div class="w-full max-w-5xl mx-auto py-2 animate-scale-up">
                <div class="text-center mb-8">
                    <span class="text-6xl drop-shadow-md mb-4 block">🎭</span>
                    <h3 class="text-3xl md:text-4xl font-black text-fuchsia-950 tracking-tight mb-4">Pair Roleplay</h3>
                    <p class="text-lg font-medium text-slate-500 mb-6">Find a partner. Decide who is Student A and Student B, then tap to reveal your secret roles.</p>
                    <div class="bg-blue-100/50 border border-blue-200 text-blue-800 p-5 rounded-2xl max-w-3xl mx-auto text-sm font-medium shadow-sm text-left">
                        <span class="font-black text-blue-900 uppercase tracking-widest text-[10px] block mb-2 flex items-center gap-1">🧠 Pedagogical Goal</span>
                        Roleplays force students to shift from passive comprehension to active, spontaneous production, heavily utilizing <b>Merrill Swain's Output Hypothesis</b>.
                    </div>
                </div>
                <div class="grid grid-cols-1 md:grid-cols-2 gap-6 md:gap-8 w-full">
                    <!-- Student A -->
                    <div class="relative rounded-[2rem] border-4 border-blue-200 bg-blue-50 overflow-hidden shadow-lg min-h-[360px] flex flex-col group cursor-pointer" onclick="this.querySelector('.cover-layer').classList.add('opacity-0', 'pointer-events-none', 'scale-105')">
                        <div class="cover-layer absolute inset-0 bg-blue-900/95 backdrop-blur-md flex flex-col items-center justify-center text-white z-10 transition-all duration-500 hover:bg-blue-800">
                            <span class="text-7xl mb-4 drop-shadow-md">🕵️‍♂️</span>
                            <span class="font-black text-2xl md:text-3xl tracking-widest uppercase">Student A</span>
                            <span class="text-sm font-bold text-blue-200 mt-4 border border-blue-400/50 bg-blue-800/50 px-6 py-2.5 rounded-full shadow-inner">Tap to reveal</span>
                        </div>
                        <div class="p-6 md:p-10 flex-1 flex flex-col justify-start text-center bg-[url('data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSI4IiBoZWlnaHQ9IjgiPgo8cmVjdCB3aWR0aD0iOCIgaGVpZ2h0PSI4IiBmaWxsPSIjZmZmIiAvPgo8Y2lyY2xlIGN4PSIxIiBjeT0iMSIgcj0iMSIgZmlsbD0iI2VvZTdmNSIvPgo8L3N2Zz4=')]">
                            <h4 class="font-black text-blue-900 uppercase tracking-widest text-sm mb-6 border-b-2 border-blue-200 pb-3 bg-white/80 rounded px-2 inline-block mx-auto shrink-0">Your Secret Role</h4>
                            <div class="text-lg font-bold text-slate-800 leading-relaxed bg-white/95 p-5 rounded-xl shadow-sm text-left whitespace-pre-wrap">${pAText}</div>
                        </div>
                    </div>
                    <!-- Student B -->
                    <div class="relative rounded-[2rem] border-4 border-emerald-200 bg-emerald-50 overflow-hidden shadow-lg min-h-[360px] flex flex-col group cursor-pointer" onclick="this.querySelector('.cover-layer').classList.add('opacity-0', 'pointer-events-none', 'scale-105')">
                        <div class="cover-layer absolute inset-0 bg-emerald-900/95 backdrop-blur-md flex flex-col items-center justify-center text-white z-10 transition-all duration-500 hover:bg-emerald-800">
                            <span class="text-7xl mb-4 drop-shadow-md">🕵️‍♀️</span>
                            <span class="font-black text-2xl md:text-3xl tracking-widest uppercase">Student B</span>
                            <span class="text-sm font-bold text-emerald-200 mt-4 border border-emerald-400/50 bg-emerald-800/50 px-6 py-2.5 rounded-full shadow-inner">Tap to reveal</span>
                        </div>
                        <div class="p-6 md:p-10 flex-1 flex flex-col justify-start text-center bg-[url('data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSI4IiBoZWlnaHQ9IjgiPgo8cmVjdCB3aWR0aD0iOCIgaGVpZ2h0PSI4IiBmaWxsPSIjZmZmIiAvPgo8Y2lyY2xlIGN4PSIxIiBjeT0iMSIgcj0iMSIgZmlsbD0iI2QxZmFlNSIvPgo8L3N2Zz4=')]">
                            <h4 class="font-black text-emerald-900 uppercase tracking-widest text-sm mb-6 border-b-2 border-emerald-200 pb-3 bg-white/80 rounded px-2 inline-block mx-auto shrink-0">Your Secret Role</h4>
                            <div class="text-lg font-bold text-slate-800 leading-relaxed bg-white/95 p-5 rounded-xl shadow-sm text-left whitespace-pre-wrap">${pBText}</div>
                        </div>
                    </div>
                </div>
            </div>`;
        } else if (mode === 'debate') {
            let dMotion = `This house believes that the issues discussed in "${APP_DATA.title}" represent the most significant challenges in modern society.`;
            let dFor = "Argue IN FAVOR of the core concepts presented in the text. Use specific examples from the reading to build your case.";
            let dAgainst = "Argue AGAINST or find flaws in the concepts presented. Prepare logical rebuttals for the Affirmative team's likely arguments.";

            if (APP_DATA.module === 'activity') {
                APP_DATA.parts.forEach(p => {
                    p.questions.forEach(q => {
                        if (q.type === 'group_debate') {
                            if (q.instruction) dMotion = q.instruction;
                            if (q.text) dFor = q.text;
                            if (q.hint) dAgainst = q.hint;
                        }
                    });
                });
            }

            content.innerHTML = `
            <div class="w-full max-w-6xl mx-auto py-2 animate-fade-in-up">
                <div class="flex flex-col items-center mb-8">
                    <div class="bg-slate-100/50 border border-slate-200 text-slate-700 p-5 rounded-2xl max-w-3xl w-full mx-auto text-sm font-medium mb-8 shadow-sm text-left">
                        <span class="font-black text-slate-800 uppercase tracking-widest text-[10px] block mb-2 flex items-center gap-1">🧠 Sociocultural Theory (Vygotsky)</span>
                        Group debates create a Zone of Proximal Development (ZPD) where peer-to-peer scaffolding helps learners construct more complex arguments than they could alone.
                    </div>
                    <div class="bg-slate-800 text-white px-6 py-8 md:px-10 md:py-10 rounded-[2.5rem] shadow-2xl border-4 border-slate-700 text-center max-w-4xl w-full relative overflow-hidden">
                        <div class="absolute -top-6 -right-6 text-[10rem] opacity-5 leading-none select-none pointer-events-none">🗣️</div>
                        <span class="text-xs font-black uppercase tracking-[0.3em] text-fuchsia-400 block mb-4 relative z-10">Debate Motion</span>
                        <h3 class="text-xl md:text-3xl lg:text-4xl font-black leading-snug tracking-tight relative z-10">${dMotion}</h3>
                    </div>
                </div>
                <div class="grid grid-cols-1 md:grid-cols-2 gap-6 md:gap-8 w-full">
                    <div class="bg-emerald-50 rounded-3xl p-6 md:p-10 border-2 border-emerald-200 shadow-sm flex flex-col items-center text-center relative overflow-hidden h-full min-h-[250px]">
                        <span class="text-5xl md:text-6xl mb-4 drop-shadow-md">👍</span>
                        <h4 class="font-black text-emerald-800 uppercase tracking-widest text-lg md:text-xl mb-4">Affirmative Team</h4>
                        <div class="text-base md:text-lg font-bold text-slate-700 leading-relaxed whitespace-pre-wrap text-left w-full bg-white/60 p-5 rounded-xl shadow-inner border border-emerald-100">${dFor}</div>
                    </div>
                    <div class="bg-rose-50 rounded-3xl p-6 md:p-10 border-2 border-rose-200 shadow-sm flex flex-col items-center text-center relative overflow-hidden h-full min-h-[250px]">
                        <span class="text-5xl md:text-6xl mb-4 drop-shadow-md">👎</span>
                        <h4 class="font-black text-rose-800 uppercase tracking-widest text-lg md:text-xl mb-4">Negative Team</h4>
                        <div class="text-base md:text-lg font-bold text-slate-700 leading-relaxed whitespace-pre-wrap text-left w-full bg-white/60 p-5 rounded-xl shadow-inner border border-rose-100">${dAgainst}</div>
                    </div>
                </div>
            </div>`;
        } else if (mode === 'fluency') {
            content.innerHTML = `
            <div class="w-full max-w-4xl mx-auto py-10 animate-fade-in-up flex flex-col items-center text-center">
                <span class="text-6xl md:text-7xl drop-shadow-md mb-4 block">⏱️</span>
                <h3 class="text-3xl md:text-5xl font-black text-slate-800 tracking-tight mb-8">Fluency Speed Drill</h3>
                
                <div class="bg-sky-50 border border-sky-200 text-sky-900 p-6 rounded-2xl max-w-3xl mx-auto text-sm font-medium shadow-sm text-left mb-10">
                    <span class="font-black text-sky-700 uppercase tracking-widest text-[10px] block mb-2">🧠 Skill Acquisition Theory & The 4/3/2 Technique</span>
                    Stand up and find a partner. Explain the main concepts of <b class="text-sky-700">"${APP_DATA.title}"</b> to them before the timer runs out. When time is up, find a NEW partner, and explain the exact same thing, but faster. Repetition under increasing time pressure converts slow declarative knowledge into fast, automatic fluency!
                </div>

                <div class="bg-white border-4 border-slate-100 w-48 h-48 md:w-64 md:h-64 rounded-full flex flex-col items-center justify-center shadow-2xl mb-10 relative overflow-hidden group">
                    <div id="fluency-pulse" class="absolute inset-0 bg-blue-100 opacity-0 transition-opacity duration-500"></div>
                    <span id="fluency-display" class="font-mono text-5xl md:text-7xl font-black text-slate-800 relative z-10 tracking-tighter">00:00</span>
                </div>

                <div class="flex flex-wrap justify-center gap-3 w-full">
                    <button onclick="window.startFluencyTimer(4, this)" class="fluency-btn bg-emerald-100 hover:bg-emerald-500 hover:text-white text-emerald-800 border-2 border-emerald-300 font-black text-base md:text-lg px-6 py-3 rounded-2xl transition shadow-sm">Round 1: 4 Mins</button>
                    <button onclick="window.startFluencyTimer(3, this)" class="fluency-btn bg-amber-100 hover:bg-amber-500 hover:text-white text-amber-800 border-2 border-amber-300 font-black text-base md:text-lg px-6 py-3 rounded-2xl transition shadow-sm">Round 2: 3 Mins</button>
                    <button onclick="window.startFluencyTimer(2, this)" class="fluency-btn bg-rose-100 hover:bg-rose-500 hover:text-white text-rose-800 border-2 border-rose-300 font-black text-base md:text-lg px-6 py-3 rounded-2xl transition shadow-sm">Round 3: 2 Mins</button>
                    <button onclick="if(window.activityTimer) clearInterval(window.activityTimer); document.getElementById('fluency-display').textContent = '00:00'; document.getElementById('fluency-pulse').classList.remove('animate-ping', 'opacity-100'); document.querySelectorAll('.fluency-btn').forEach(b => b.classList.remove('opacity-50'));" class="bg-slate-100 hover:bg-slate-300 text-slate-600 font-bold text-base md:text-lg px-6 py-3 rounded-2xl transition shadow-sm">Reset</button>
                </div>
            </div>`;
        }
    };

    window.startFluencyTimer = function(minutes, btnElement) {
        if (window.activityTimer) clearInterval(window.activityTimer);
        
        document.querySelectorAll('.fluency-btn').forEach(b => b.classList.remove('opacity-50', 'ring-4'));
        if (btnElement) btnElement.classList.add('opacity-50', 'ring-4', 'ring-slate-300');

        let secs = minutes * 60;
        const display = document.getElementById('fluency-display');
        const pulse = document.getElementById('fluency-pulse');
        
        pulse.classList.remove('animate-ping', 'bg-rose-100', 'opacity-100');
        pulse.classList.add('bg-blue-100');
        display.classList.remove('text-rose-600');
        display.classList.add('text-blue-600');

        // Immediate first render
        display.textContent = `${Math.floor(secs/60)}:${(secs%60).toString().padStart(2, '0')}`;

        window.activityTimer = setInterval(() => {
            secs--;
            
            if (secs <= 10 && secs > 0) {
                pulse.classList.add('opacity-100', 'bg-rose-100');
                display.classList.add('text-rose-600');
            }

            if (secs < 0) {
                clearInterval(window.activityTimer);
                display.textContent = `0:00`;
                pulse.classList.add('animate-ping');
                if (typeof window.showToast === 'function') window.showToast("Time's Up! ⏰", "Rotate partners and get ready for the next round!", "info");
                return;
            }
            
            display.textContent = `${Math.floor(secs/60)}:${(secs%60).toString().padStart(2, '0')}`;
        }, 1000);
    };

    function selectTestMode(m) {
      const speakingSimulationCheckbox = document.getElementById('speaking-simulation-checkbox');
      if (m === 'free' && speakingSimulationCheckbox?.checked) {
          speakingSimulationCheckbox.checked = false;
      }
      testMode = m; isTimeFree = (m === 'free');
      const freeModeButton = document.getElementById('mode-btn-free');
      const restrictedModeButton = document.getElementById('mode-btn-restricted');
      freeModeButton.classList.toggle('border-blue-500', isTimeFree);
      freeModeButton.classList.toggle('bg-blue-50', isTimeFree);
      restrictedModeButton.classList.toggle('border-blue-500', !isTimeFree);
      restrictedModeButton.classList.toggle('bg-blue-50', !isTimeFree);
      freeModeButton.setAttribute('aria-pressed', String(isTimeFree));
      restrictedModeButton.setAttribute('aria-pressed', String(!isTimeFree));
      
      const timeContainer = document.getElementById('custom-time-container');
      if (timeContainer) {
          timeContainer.classList.toggle('hidden', isTimeFree);
      }
      window.updateSpeakingSimulationAvailability?.();
    }
    window.selectTestMode = selectTestMode;

    // ✨ SECURE BROWSER MODE ENGINE
    window.isSecureModeActive = false;
    window.secureInfractions = 0;

    window.enterSecureMode = async function() {
        window.isSecureModeActive = true;
        window.secureInfractions = 0;
        try {
            if (document.documentElement.requestFullscreen) {
                await document.documentElement.requestFullscreen();
            }
        } catch (err) {
            console.warn("Fullscreen API blocked or unsupported:", err);
        }
    };

    window.returnToSecureMode = function() {
        document.getElementById('secure-mode-warning').classList.add('hidden');
        document.getElementById('secure-mode-warning').classList.remove('flex');
        window.enterSecureMode();
    };

    window.exitSecureMode = function() {
        window.isSecureModeActive = false;
        try {
            if (document.fullscreenElement && document.exitFullscreen) {
                document.exitFullscreen();
            }
        } catch (e) {}
    };

    document.addEventListener('visibilitychange', () => {
        if (window.isSecureModeActive && document.hidden) {
            window.secureInfractions++;
            
            // Build the overlay dynamically if it doesn't exist
            let warnEl = document.getElementById('secure-mode-warning');
            if (!warnEl) {
                const overlayHtml = `
                <div id="secure-mode-warning" class="hidden fixed inset-0 bg-rose-950/95 z-[9999] flex-col items-center justify-center p-8 text-center text-white backdrop-blur-md">
                    <span class="text-7xl mb-6 drop-shadow-lg">⚠️</span>
                    <h1 class="text-4xl md:text-5xl font-black mb-4 tracking-tight text-rose-500">Security Violation Detected</h1>
                    <p class="text-lg md:text-xl max-w-2xl font-medium mb-8 text-rose-100">You have left the secure exam environment (switched tabs or minimized the browser). This incident has been recorded.</p>
                    <button onclick="window.returnToSecureMode()" class="px-8 py-4 bg-rose-600 hover:bg-rose-500 text-white rounded-xl font-black text-xl transition shadow-xl border border-rose-400">Return to Exam</button>
                </div>`;
                document.body.insertAdjacentHTML('beforeend', overlayHtml);
                warnEl = document.getElementById('secure-mode-warning');
            }
            
            warnEl.classList.remove('hidden');
            warnEl.classList.add('flex');
        }
    });
