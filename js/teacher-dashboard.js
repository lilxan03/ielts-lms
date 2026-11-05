    window.showToast = function(title, msg, type = 'success') {
        let container = document.getElementById('toast-container');
        if (!container) {
            container = document.createElement('div');
            container.id = 'toast-container';
            container.className = 'fixed bottom-5 sm:bottom-10 right-5 sm:right-10 z-[1000] flex flex-col gap-3 pointer-events-none';
            document.body.appendChild(container);
        }

        const toast = document.createElement('div');
        const isSuccess = type === 'success' || title.toLowerCase().includes('success') || title.toLowerCase().includes('saved');
        const icon = isSuccess ? '✅' : 'ℹ️';
        const bgClass = isSuccess ? 'bg-emerald-50 border-emerald-200' : 'bg-blue-50 border-blue-200';
        const textClass = isSuccess ? 'text-emerald-800' : 'text-blue-800';

        toast.className = `flex items-start gap-3 p-4 rounded-2xl shadow-xl border ${bgClass} transform translate-y-10 opacity-0 transition-all duration-400 w-80 max-w-[90vw] pointer-events-auto backdrop-blur-sm`;
        
        toast.innerHTML = `
            <div class="text-xl shrink-0 drop-shadow-sm mt-0.5">${icon}</div>
            <div class="flex-1 min-w-0">
                <h4 class="font-black text-sm ${textClass} mb-0.5 tracking-tight">${title}</h4>
                <p class="text-xs ${textClass} opacity-80 leading-snug font-medium">${msg}</p>
            </div>
        `;

        container.appendChild(toast);

        // Slide in
        requestAnimationFrame(() => {
            setTimeout(() => {
                toast.classList.remove('translate-y-10', 'opacity-0');
                toast.classList.add('translate-y-0', 'opacity-100');
            }, 10);
        });

        // Slide out and destroy after 3.5 seconds
        setTimeout(() => {
            toast.classList.remove('translate-y-0', 'opacity-100');
            toast.classList.add('translate-y-10', 'opacity-0');
            setTimeout(() => toast.remove(), 400);
        }, 3500);
    };

    function showModalMsg(title, msg, onConfirm=null) {
      // ✨ SMART ROUTING: Determine if this should be a Toast or a Blocking Modal
      const isError = title.toLowerCase().includes('error') || title.toLowerCase().includes('cannot') || title.toLowerCase().includes('notice') || title.toLowerCase().includes('required');
      
      // If it's NOT an error, and the system isn't waiting for the user to click "OK" (onConfirm), show a Toast!
      if (!isError && !onConfirm) {
          window.showToast(title, msg, 'success');
          return;
      }

      // Otherwise, fallback to the standard blocking modal for critical alerts
      document.getElementById('modal-title').textContent = title;
      document.getElementById('modal-message').innerHTML = msg; // Upgraded to support HTML like your Jitsi link
      document.getElementById('modal-input').classList.add('hidden');
      document.getElementById('modal-cancel').classList.add('hidden');
      document.getElementById('custom-modal').classList.remove('hidden');
      document.getElementById('modal-confirm').onclick = () => { document.getElementById('custom-modal').classList.add('hidden'); if(onConfirm) onConfirm(); };
    }

    function showConfirm(title, msg, onConfirm) {
      document.getElementById('modal-title').textContent = title;
      document.getElementById('modal-message').innerHTML = msg; // ✨ Upgraded to support HTML warnings!
      document.getElementById('modal-input').classList.add('hidden');
      document.getElementById('modal-cancel').classList.remove('hidden');
      document.getElementById('custom-modal').classList.remove('hidden');
      document.getElementById('modal-cancel').onclick = () => document.getElementById('custom-modal').classList.add('hidden');
      document.getElementById('modal-confirm').onclick = () => { document.getElementById('custom-modal').classList.add('hidden'); onConfirm(); };
    }
    function showInputPrompt(title, msg, onConfirm) {
      document.getElementById('modal-title').textContent = title;
      document.getElementById('modal-message').textContent = msg;
      const inp = document.getElementById('modal-input'); inp.value = ''; inp.classList.remove('hidden');
      document.getElementById('modal-cancel').classList.remove('hidden');
      document.getElementById('custom-modal').classList.remove('hidden');
      inp.focus();
      document.getElementById('modal-cancel').onclick = () => document.getElementById('custom-modal').classList.add('hidden');
      document.getElementById('modal-confirm').onclick = () => { if(inp.value.trim()) { document.getElementById('custom-modal').classList.add('hidden'); onConfirm(inp.value.trim()); } };
    }
    function showTestMetaModal(titleText, defaultTitle, defaultTopics, defaultDiff, defaultStatus, onConfirm) {
      document.getElementById('meta-modal-heading').textContent = titleText;
      document.getElementById('meta-title-input').value = defaultTitle;
      document.getElementById('meta-topics-input').value = defaultTopics;
      document.getElementById('meta-difficulty-input').value = defaultDiff || '';
      document.getElementById('meta-status-input').value = defaultStatus || 'not_started';
      document.getElementById('test-meta-modal').classList.remove('hidden');
      document.getElementById('meta-cancel').onclick = () => document.getElementById('test-meta-modal').classList.add('hidden');
      document.getElementById('meta-confirm').onclick = () => {
        document.getElementById('test-meta-modal').classList.add('hidden');
        onConfirm(
            document.getElementById('meta-title-input').value.trim() || 'Untitled', 
            document.getElementById('meta-topics-input').value.split(',').map(s=>s.trim()).filter(Boolean),
            document.getElementById('meta-difficulty-input').value,
            document.getElementById('meta-status-input').value
        );
      };
    }
    
    window.applyTheme = function(t) { 
        document.body.className = `font-sans overflow-hidden h-screen transition-colors duration-300 ${t!=='standard'?'theme-'+t:''} text-slate-800 bg-slate-100`; 
        localStorage.setItem('ielts_theme', t);
        
        // Update all toggle buttons dynamically!
        const isDark = t === 'dark';
        document.querySelectorAll('.theme-toggle-btn').forEach(btn => {
            btn.innerHTML = isDark ? '☀️' : '🌙';
            btn.title = isDark ? 'Switch to Light Mode' : 'Switch to Dark Mode';
        });
    };

    window.toggleTheme = function() {
        const currentTheme = localStorage.getItem('ielts_theme') || 'standard';
        window.applyTheme(currentTheme === 'dark' ? 'standard' : 'dark');
    };
    
    function applyFontSize(s) { 
        document.body.classList.remove('size-large', 'size-xl'); 
        if(s!=='standard') document.body.classList.add(`size-${s}`); 
        localStorage.setItem('ielts_fontsize', s);
    }
    
        window.updateTeacherBadges = function() {
        if (!currentUser || currentUser.role !== 'teacher') return;

        const pendingStudents = USERS.filter(u => u.role === 'student' && u.paymentStatus === 'pending').length;
        const pendingSubs = SUBMISSIONS.filter(s => s.score === 'Pending Grade').length;
        
        // ✨ NEW: Calculate new Bookings and Student Replies
        const newBookings = SCHEDULES.filter(s => s.isNewBooking).length;
        const newReplies = SUBMISSIONS.filter(s => s.studentReply && !s.teacherReadReply).length;
        const testsPendingReview = TEST_BANK.filter(t => t.status === 'review_ready').length;

        const totalNots = pendingStudents + pendingSubs + newBookings + newReplies + testsPendingReview;

        const el = document.getElementById('badge-global-notifications');
        if (el) {
            if (parseInt(el.textContent) !== totalNots && totalNots > 0) {
                el.classList.remove('animate-badge-pop');
                void el.offsetWidth;
                el.classList.add('animate-badge-pop');
            }
            el.textContent = totalNots;
            if (totalNots > 0) { el.classList.remove('hidden'); el.classList.add('flex'); }
            else { el.classList.add('hidden'); el.classList.remove('flex'); }
        }

        const list = document.getElementById('teacher-notifications-list');
        if (list) {
            let html = '';
            if (newBookings > 0) {
                html += `<button onclick="window.clearBookingNotifications()" class="text-left px-4 py-3 hover:bg-indigo-50 border-b border-slate-100 transition flex flex-col gap-1 w-full">
                    <span class="text-[10px] font-black text-indigo-600 uppercase tracking-widest">📅 New Bookings</span>
                    <span class="text-sm font-medium text-slate-700">You have <b>${newBookings}</b> new student appointment(s).</span>
                </button>`;
            }
            if (newReplies > 0) {
                html += `<button onclick="toggleEditorTab('classes'); window.toggleTeacherNotifications();" class="text-left px-4 py-3 hover:bg-emerald-50 border-b border-slate-100 transition flex flex-col gap-1 w-full">
                    <span class="text-[10px] font-black text-emerald-600 uppercase tracking-widest">💬 Student Replies</span>
                    <span class="text-sm font-medium text-slate-700">You have <b>${newReplies}</b> new reply/question(s) on graded tests.</span>
                </button>`;
            }
            if (pendingSubs > 0) {
                html += `<button onclick="toggleEditorTab('bank'); toggleDashboardView('classes'); window.toggleTeacherNotifications();" class="text-left px-4 py-3 hover:bg-blue-50 border-b border-slate-100 transition flex flex-col gap-1 w-full">
                    <span class="text-[10px] font-black text-blue-600 uppercase tracking-widest">📝 Submissions</span>
                    <span class="text-sm font-medium text-slate-700">You have <b>${pendingSubs}</b> ungraded test(s) waiting for review.</span>
                </button>`;
            }
            if (pendingStudents > 0) {
                html += `<button onclick="toggleEditorTab('students'); window.toggleTeacherNotifications();" class="text-left px-4 py-3 hover:bg-rose-50 border-b border-slate-100 transition flex flex-col gap-1 w-full">
                    <span class="text-[10px] font-black text-rose-600 uppercase tracking-widest">💸 Payments</span>
                    <span class="text-sm font-medium text-slate-700">You have <b>${pendingStudents}</b> student action(s) to verify.</span>
                </button>`;
            }
            if (testsPendingReview > 0) {
                html += `<button onclick="toggleEditorTab('bank'); document.getElementById('bank-filter-status').value = 'review_ready'; renderTestBank(true); window.toggleTeacherNotifications();" class="text-left px-4 py-3 hover:bg-purple-50 border-b border-slate-100 transition flex flex-col gap-1 w-full">
                    <span class="text-[10px] font-black text-purple-600 uppercase tracking-widest">🟣 Tests to Review</span>
                    <span class="text-sm font-medium text-slate-700">Collaborators marked <b>${testsPendingReview}</b> test(s) ready for review.</span>
                </button>`;
            }
            if (html === '') html = `<div class="p-4 text-center text-sm text-slate-500 italic">You're all caught up!</div>`;
            list.innerHTML = html;
        }
        window.renderTeacherOverview();
    };

    window.renderTeacherOverview = function() {
        const stats = document.getElementById('teacher-overview-stats');
        const attention = document.getElementById('teacher-overview-attention');
        const upcoming = document.getElementById('teacher-overview-upcoming');
        const logins = document.getElementById('teacher-overview-logins');
        if (!stats || !attention || !upcoming || !logins) return;

        const escapeText = value => String(value ?? '').replace(/[&<>"']/g, char => ({
            '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
        })[char]);
        const studentUsers = USERS.filter(user => user.role === 'student' && user.disabled !== true);
        const activeStudents = studentUsers.filter(user => hasActiveStudentAccess(user)).length;
        const pendingSubs = SUBMISSIONS.filter(submission => submission.score === 'Pending Grade');
        const pendingStudents = studentUsers.filter(user => user.paymentStatus === 'pending');
        const pendingTests = TEST_BANK.filter(test => test.status === 'review_ready');
        const today = new Date();
        const todayKey = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
        const todayClasses = SCHEDULES.filter(schedule => schedule.date === todayKey).length;
        const upcomingClasses = SCHEDULES
            .filter(schedule => schedule.date && schedule.date >= todayKey)
            .sort((a, b) => `${a.date} ${a.time || ''}`.localeCompare(`${b.date} ${b.time || ''}`))
            .slice(0, 5);
        const now = Date.now();
        const recentSignIns = studentUsers
            .filter(user => user.lastLoginAt)
            .map(user => {
                const date = typeof user.lastLoginAt?.toDate === 'function'
                    ? user.lastLoginAt.toDate()
                    : new Date(user.lastLoginAt);
                return { user, date };
            })
            .filter(item => Number.isFinite(item.date.getTime()))
            .sort((a, b) => b.date - a.date);
        const signInsThisWeek = recentSignIns.filter(item => {
            const age = now - item.date.getTime();
            return age >= 0 && age <= 7 * 24 * 60 * 60 * 1000;
        }).length;

        document.getElementById('teacher-overview-date').textContent = today.toLocaleDateString(undefined, {
            weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
        });

        const statCards = [
            { label: 'Students with access', value: `${activeStudents} / ${studentUsers.length}`, note: 'Active access / total students', icon: '🎓', iconBg: 'bg-emerald-50', route: 'teacher/students' },
            { label: 'Tests in bank', value: TEST_BANK.length, note: `${pendingTests.length} ready for review`, icon: '📚', iconBg: 'bg-blue-50', route: 'teacher/bank/tests' },
            { label: 'Ungraded submissions', value: pendingSubs.length, note: 'Waiting for teacher review', icon: '📝', iconBg: 'bg-amber-50', route: 'teacher/bank/classes' },
            { label: 'Classes today', value: todayClasses, note: `${upcomingClasses.length} next scheduled shown below`, icon: '📅', iconBg: 'bg-indigo-50', route: 'teacher/timetable' }
        ];
        stats.innerHTML = statCards.map(card => `
            <button type="button" onclick="window.navigateAppRoute('${card.route}')" class="rounded-2xl border border-slate-200 bg-white p-5 text-left shadow-sm transition hover:-translate-y-0.5 hover:shadow-md">
                <div class="flex items-start justify-between gap-3">
                    <span class="text-[10px] font-black uppercase tracking-widest text-slate-500">${card.label}</span>
                    <span class="flex h-10 w-10 items-center justify-center rounded-xl ${card.iconBg} text-xl">${card.icon}</span>
                </div>
                <div class="mt-4 text-3xl font-black tracking-tight text-slate-900">${card.value}</div>
                <div class="mt-1 text-xs font-medium text-slate-500">${card.note}</div>
            </button>`).join('');

        const attentionItems = [
            { count: pendingSubs.length, label: 'Submissions need grading', detail: 'Review learner work and send feedback.', icon: '📝', route: 'teacher/bank/classes', iconBg: 'bg-amber-50' },
            { count: pendingStudents.length, label: 'Payment requests to review', detail: 'Confirm payment and update student access.', icon: '💳', route: 'teacher/payments', iconBg: 'bg-rose-50' },
            { count: pendingTests.length, label: 'Tests ready for review', detail: 'Check tests submitted by collaborators.', icon: '📚', route: 'teacher/bank/tests', iconBg: 'bg-purple-50' },
            { count: SCHEDULES.filter(schedule => schedule.isNewBooking).length, label: 'New class bookings', detail: 'Check new student booking requests.', icon: '🗓️', route: 'teacher/timetable', iconBg: 'bg-indigo-50' },
            { count: SUBMISSIONS.filter(submission => submission.studentReply && !submission.teacherReadReply).length, label: 'Student replies to read', detail: 'Follow up on learner questions.', icon: '💬', route: 'teacher/bank/classes', iconBg: 'bg-emerald-50' }
        ].filter(item => item.count > 0);
        document.getElementById('teacher-overview-attention-count').textContent = attentionItems.reduce((sum, item) => sum + item.count, 0);
        attention.innerHTML = attentionItems.length
            ? attentionItems.map(item => `<button type="button" onclick="window.navigateAppRoute('${item.route}')" class="flex w-full items-center gap-4 p-4 text-left transition hover:bg-slate-50">
                <span class="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${item.iconBg} text-xl">${item.icon}</span>
                <span class="min-w-0 flex-1"><span class="block text-sm font-bold text-slate-800">${item.label}</span><span class="mt-0.5 block text-xs text-slate-500">${item.detail}</span></span>
                <span class="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-black text-slate-700">${item.count}</span><span class="text-slate-300" aria-hidden="true">›</span>
              </button>`).join('')
            : '<div class="p-6 text-sm font-medium text-slate-500">All caught up. There are no urgent items right now.</div>';

        upcoming.innerHTML = upcomingClasses.length
            ? upcomingClasses.map(schedule => {
                const attending = Array.isArray(schedule.attendingStudents) ? schedule.attendingStudents.length : 0;
                return `<button type="button" onclick="window.navigateAppRoute('teacher/timetable')" class="flex w-full items-center justify-between gap-3 p-4 text-left transition hover:bg-slate-50">
                    <span class="min-w-0"><span class="block truncate text-sm font-bold text-slate-800">${escapeText(schedule.className || schedule.topic || 'Scheduled lesson')}</span><span class="mt-1 block text-xs text-slate-500">${escapeText(schedule.date)}${schedule.time ? ` · ${escapeText(schedule.time)}` : ''}</span></span>
                    <span class="shrink-0 rounded-lg bg-blue-50 px-2.5 py-1.5 text-xs font-bold text-blue-700">${attending} learner${attending === 1 ? '' : 's'}</span>
                  </button>`;
              }).join('')
            : '<div class="p-6 text-sm font-medium text-slate-500">No upcoming classes are scheduled.</div>';

        document.getElementById('teacher-overview-login-summary').textContent =
            `${signInsThisWeek} student${signInsThisWeek === 1 ? '' : 's'} signed in during the last 7 days`;
        logins.innerHTML = recentSignIns.length
            ? recentSignIns.slice(0, 8).map(({ user, date }) => `<tr>
                <td class="px-5 py-3"><span class="block font-bold text-slate-800">${escapeText(user.email && !user.email.toLowerCase().endsWith('@khanhlms.com') ? user.email : user.user)}</span><span class="mt-0.5 block text-xs text-slate-500">${escapeText(user.realName || 'No name set')}</span></td>
                <td class="px-5 py-3"><span class="rounded-full ${hasActiveStudentAccess(user) ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-600'} px-2.5 py-1 text-[10px] font-black uppercase">${hasActiveStudentAccess(user) ? 'Active' : 'Locked'}</span></td>
                <td class="px-5 py-3 text-right text-xs font-medium text-slate-500">${escapeText(date.toLocaleString())}</td>
              </tr>`).join('')
            : '<tr><td colspan="3" class="px-5 py-6 text-center text-sm text-slate-500">Sign-in activity will appear here after students next sign in.</td></tr>';
    };
    
    // ✨ NEW: Helper to clear booking notifications when clicked
    window.clearBookingNotifications = async function() {
        const unread = SCHEDULES.filter(s => s.isNewBooking);
        for (let s of unread) {
            s.isNewBooking = false;
            try { await window.fsSetDoc(window.fsDoc(window.db, window.fPath('schedules'), s.id), s); } catch(e){}
        }
        toggleEditorTab('timetable');
        window.toggleTeacherNotifications();
    };


    window.toggleDashboardView = function(view) {
      sessionStorage.setItem('lms_dash_view', view);
      setSidebarRoute('teacher', `teacher/bank/${view}`);
      const testsView = document.getElementById('dash-view-tests');
      const classesView = document.getElementById('dash-view-classes');
      const btnTests = document.getElementById('dash-btn-tests');
      const btnClasses = document.getElementById('dash-btn-classes');

      if (view === 'tests') {
          if(testsView) { testsView.classList.remove('hidden'); testsView.classList.add('flex'); }
          if(classesView) { classesView.classList.add('hidden'); classesView.classList.remove('flex'); }
          if(btnTests) btnTests.className = "px-8 py-2.5 bg-blue-50 text-blue-700 font-bold rounded-xl shadow-sm transition duration-200 flex items-center gap-2";
          if(btnClasses) btnClasses.className = "px-8 py-2.5 text-slate-500 font-bold rounded-xl hover:bg-slate-50 hover:text-slate-700 transition duration-200 flex items-center gap-2";
      } else {
          if(classesView) { classesView.classList.remove('hidden'); classesView.classList.add('flex'); }
          if(testsView) { testsView.classList.add('hidden'); testsView.classList.remove('flex'); }
          if(btnClasses) btnClasses.className = "px-8 py-2.5 bg-blue-50 text-blue-700 font-bold rounded-xl shadow-sm transition duration-200 flex items-center gap-2";
          if(btnTests) btnTests.className = "px-8 py-2.5 text-slate-500 font-bold rounded-xl hover:bg-slate-50 hover:text-slate-700 transition duration-200 flex items-center gap-2";
      }
      if (routerReady && !appRouterApplying && currentUser && ['teacher', 'collaborator'].includes(currentUser.role)) {
          window.navigateAppRoute(`teacher/bank/${view}`);
          return;
      }
    };

    function openEditor() {
      document.getElementById('editor-ui').classList.remove('hidden');

      // ✨ ROLE RESTRICTIONS FOR COLLABORATORS
      if (currentUser.role === 'collaborator') {
        document.getElementById('tab-btn-overview')?.classList.add('hidden');
        document.getElementById('tab-btn-students')?.classList.add('hidden');
          document.getElementById('tab-btn-timetable')?.classList.add('hidden');
          document.getElementById('tab-btn-landing')?.classList.add('hidden');
          
          // NOTE: We allow dash-btn-classes to remain visible so they can manage the classes they are collaborating on!
          
          document.getElementById('editor-inbox-btn')?.classList.add('hidden');
          document.getElementById('editor-notifications-menu')?.classList.add('hidden');
          document.getElementById('btn-assign-builder')?.classList.add('hidden');
          
          const editorBrand = document.querySelector('#editor-default-header > button:first-child');
          if (editorBrand) editorBrand.innerHTML = `
              <div class="w-10 h-10 bg-white/10 rounded-xl flex items-center justify-center backdrop-blur-sm border border-white/20 shadow-sm">🤝</div>
              LMS <span class="font-light text-blue-200 text-lg">| Collab</span>
          `;
          
          const pIcon = document.getElementById('profile-drop-icon');
          if (pIcon) pIcon.textContent = 'C';
          const pRole = document.getElementById('profile-drop-role');
          if (pRole) pRole.textContent = 'Collaborator';
      }
      
      // ✨ SMART RESTORE: Read memory to see where the teacher was before refreshing
      const savedSub = sessionStorage.getItem('lms_grading_sub');
      const savedTest = sessionStorage.getItem('lms_editing_test');
      let savedTab = sessionStorage.getItem('lms_teacher_tab') || 'overview';

      // Secure route override for collaborators
      if (currentUser.role === 'collaborator') {
          if (['students', 'timetable', 'landing'].includes(savedTab)) savedTab = 'bank';
          sessionStorage.setItem('lms_dash_view', 'tests');
      }

      if (savedSub && currentUser.role === 'teacher') {
          const subId = Number(savedSub);
          if (SUBMISSIONS.find(s => s.id === subId)) {
              openGradingView(subId);
              if (typeof window.updateTeacherBadges === 'function') window.updateTeacherBadges();
              return;
          } else {
              sessionStorage.removeItem('lms_grading_sub');
          }
      } 
      
      if (savedTest && savedTab === 'builder') {
          if (TEST_BANK.find(t => t.id === savedTest)) {
              editTest(savedTest);
              if (typeof window.updateTeacherBadges === 'function') window.updateTeacherBadges();
              return;
          } else {
              sessionStorage.removeItem('lms_editing_test');
          }
      }

      toggleEditorTab(savedTab);
      if (typeof window.updateTeacherBadges === 'function') window.updateTeacherBadges();
    }

    function toggleEditorTab(tab) {
      sessionStorage.setItem('lms_teacher_tab', tab);
      const editorRoot = document.getElementById('editor-ui');
      if (editorRoot) editorRoot.classList.toggle('sidebar-focus', tab === 'builder');
      if (routerReady && !appRouterApplying && currentUser && ['teacher', 'collaborator'].includes(currentUser.role)) {
          const view = tab === 'bank' ? (sessionStorage.getItem('lms_dash_view') || 'tests') : '';
          window.navigateAppRoute(`teacher/${tab}${view ? `/${view}` : ''}`);
          return;
      }
      ['overview', 'bank', 'classes', 'builder', 'students', 'payments', 'timetable', 'landing'].forEach(t => {
          const el = document.getElementById(`editor-view-${t}`);
          if (el) el.classList.add('hidden');
      });
      ['overview', 'bank', 'classes', 'students', 'payments', 'timetable', 'landing'].forEach(t => {
        const b = document.getElementById(`tab-btn-${t}`);
        if (t === 'overview' && currentUser?.role === 'collaborator') {
          b?.classList.add('hidden');
          return;
        }
        if(b) b.className = `app-sidebar-link${t === tab ? ' is-active' : ''}`;
      });

      if (tab === 'builder') {
        document.getElementById('editor-view-builder').classList.remove('hidden');
        document.getElementById('editor-view-builder').classList.add('flex');
        
        // Hide dashboard elements
        document.getElementById('editor-default-header').classList.add('hidden');
        document.getElementById('editor-default-header').classList.remove('flex');
        
        // Hide New Profile Menu
        const profileMenu = document.getElementById('editor-profile-menu');
        if(profileMenu) profileMenu.classList.add('hidden');
        
        if (document.getElementById('editor-inbox-btn')) document.getElementById('editor-inbox-btn').classList.add('hidden');
        if (document.getElementById('editor-notifications-menu')) document.getElementById('editor-notifications-menu').classList.add('hidden');
        
        // Show builder elements
        document.getElementById('editor-builder-controls').classList.remove('hidden');
        document.getElementById('editor-builder-controls').classList.add('flex');
        document.getElementById('editor-preview-test').classList.remove('hidden');
        document.getElementById('editor-preview-test').classList.add('flex');
        document.getElementById('editor-print-test').classList.remove('hidden');
        document.getElementById('editor-print-test').classList.add('flex');
        document.getElementById('editor-save-test').classList.remove('hidden');
        document.getElementById('editor-save-test').classList.add('flex');
      } else {
        // Show dashboard elements
        document.getElementById('editor-default-header').classList.remove('hidden');
        document.getElementById('editor-default-header').classList.add('flex');
        
        // Show New Profile Menu
        const profileMenu = document.getElementById('editor-profile-menu');
        if(profileMenu) profileMenu.classList.remove('hidden');
        
        if (document.getElementById('editor-inbox-btn')) document.getElementById('editor-inbox-btn').classList.remove('hidden');
        if (document.getElementById('editor-notifications-menu')) document.getElementById('editor-notifications-menu').classList.remove('hidden');
        
        // Hide builder elements
        document.getElementById('editor-builder-controls').classList.add('hidden');
        document.getElementById('editor-builder-controls').classList.remove('flex');
        document.getElementById('editor-preview-test').classList.add('hidden');
        document.getElementById('editor-preview-test').classList.remove('flex');
        document.getElementById('editor-print-test').classList.add('hidden');
        document.getElementById('editor-print-test').classList.remove('flex');
        document.getElementById('editor-save-test').classList.add('hidden');
        document.getElementById('editor-save-test').classList.remove('flex');
      }

      if (tab === 'bank') { 
          const bankView = document.getElementById('editor-view-bank');
          if(bankView) bankView.classList.remove('hidden'); 
          renderTestBank(); 
          renderClasses();
          
          // ✨ SMART RESTORE: Remember if we were on Tests or Classes sub-tab
          const savedDashView = sessionStorage.getItem('lms_dash_view') || 'tests';
          const wasApplying = appRouterApplying;
          appRouterApplying = true;
          try { window.toggleDashboardView(savedDashView); }
          finally { appRouterApplying = wasApplying; }
      }
      if (tab === 'overview') {
          document.getElementById('editor-view-overview')?.classList.remove('hidden');
          window.renderTeacherOverview();
      }
      if (tab === 'classes') { 
          const classView = document.getElementById('editor-view-classes');
          if(classView) classView.classList.remove('hidden'); 
          renderClasses(); 
      }
      if (tab === 'students') { document.getElementById('editor-view-students').classList.remove('hidden'); renderStudentsList(); }
      if (tab === 'payments') { document.getElementById('editor-view-payments').classList.remove('hidden'); window.renderPaymentsView(); }
      if (tab === 'timetable') { document.getElementById('editor-view-timetable').classList.remove('hidden'); enableTeacherTimetableResizing(); renderTimetable(); }
      if (tab === 'landing') { 
          document.getElementById('editor-view-landing').classList.remove('hidden'); 
          window.populateLandingPageEditor(); 
      }
    }

    let currentTestBankPage = 1;
    const TESTS_PER_PAGE = 16;

    window.changeTestBankPage = function(page) {
        const bankView = document.getElementById('editor-view-bank');
        const scrollTop = bankView?.scrollTop || 0;
        currentTestBankPage = Math.max(1, Number(page) || 1);
        renderTestBank(false);
        if (bankView) bankView.scrollTop = scrollTop;
    };

    function matchesTestSearch(test, query, additionalTitle = '') {
      const normalizedQuery = String(query || '').trim().toLocaleLowerCase();
      if (!normalizedQuery) return true;

      const searchableTitles = [
        additionalTitle,
        test?.title,
        ...(Array.isArray(test?.parts) ? test.parts.map(part => part?.title) : []),
        ...(Array.isArray(test?.topics) ? test.topics : [])
      ];
      return searchableTitles
        .filter(value => typeof value === 'string')
        .join(' ')
        .toLocaleLowerCase()
        .includes(normalizedQuery);
    }

    function renderTestBank(resetPage = false) {
      if (resetPage) currentTestBankPage = 1;
      const grid = document.getElementById('test-bank-grid');
      const query = (document.getElementById('bank-search')?.value || '').toLowerCase();
      const mod = document.getElementById('bank-filter-mod')?.value || 'all';
      const statusFilter = document.getElementById('bank-filter-status')?.value || 'all';
      const assigneeFilter = document.getElementById('bank-filter-assignee')?.value || 'all';
      const sort = document.getElementById('bank-sort')?.value || 'newest';
      
      const tagSelect = document.getElementById('bank-filter-tag');
      const selectedTag = tagSelect ? tagSelect.value : 'all';

      // Dynamically populate the tags dropdown based on all tests in the bank
      if (tagSelect && TEST_BANK.length > 0) {
          let allTags = new Set();
          TEST_BANK.forEach(t => {
              if (t.topics) t.topics.forEach(tag => allTags.add(tag));
          });
          tagSelect.innerHTML = `<option value="all">All Tags</option>` + 
              Array.from(allTags).sort().map(tag => `<option value="${tag}" ${selectedTag === tag ? 'selected' : ''}>${tag}</option>`).join('');
      }

      let filtered = TEST_BANK.filter(t => {
          const matchQuery = matchesTestSearch(t, query);
          const matchMod = mod === 'all' || t.module === mod;
          const matchTag = selectedTag === 'all' || (t.topics && t.topics.includes(selectedTag));
          
          const tStatus = t.status || 'not_started';
          const matchStatus = statusFilter === 'all' || tStatus === statusFilter;
          const matchAssignee = assigneeFilter === 'all' || (assigneeFilter === 'me' && t.assignee === currentUser.user);
          
          return matchQuery && matchMod && matchTag && matchStatus && matchAssignee;
      });

      if (sort === 'az') filtered.sort((a, b) => a.title.localeCompare(b.title));
      else if (sort === 'za') filtered.sort((a, b) => b.title.localeCompare(a.title));

      // ✨ NEW: Pagination Math
      const totalPages = Math.ceil(filtered.length / TESTS_PER_PAGE) || 1;
      if (currentTestBankPage > totalPages) currentTestBankPage = totalPages;

      const startIndex = (currentTestBankPage - 1) * TESTS_PER_PAGE;
      const paginatedTests = filtered.slice(startIndex, startIndex + TESTS_PER_PAGE);

      grid.innerHTML = paginatedTests.length ? paginatedTests.map(t => {
        const modColors = { reading:'blue', listening:'cyan', writing:'emerald', speaking:'amber', activity:'fuchsia' };
        const c = modColors[t.module] || 'slate';
        
        const assignedClasses = CLASSES.filter(cls => cls.assignedTests && cls.assignedTests.includes(t.id)).map(cls => cls.name);
        const assignedBadge = assignedClasses.length > 0 
            ? `<div class="mt-1 mb-2 text-[10px] font-bold text-indigo-600 bg-indigo-50 border border-indigo-100 px-2 py-1 rounded truncate" title="Assigned to: ${assignedClasses.join(', ')}">📖 ${assignedClasses.join(', ')}</div>`
            : `<div class="mt-1 mb-2 text-[10px] font-bold text-slate-400 bg-slate-100 border border-slate-200 px-2 py-1 rounded">Unassigned</div>`;

        const testDiff = t.difficulty ? `<span class="text-[10px] font-bold px-2 py-1 rounded bg-slate-100 text-slate-600 border border-slate-200 shadow-sm">Band ${parseFloat(t.difficulty).toFixed(1)}</span>` : '';
        
        let bountyBadge = '';
        if (t.assignee) bountyBadge += `<span class="text-[10px] font-bold px-2 py-1 rounded bg-purple-50 text-purple-700 border border-purple-200 shadow-sm flex items-center gap-1"><span class="text-xs">🧑‍💻</span> ${t.assignee}</span>`;
        if (t.incentive > 0) bountyBadge += `<span class="text-[10px] font-black px-2 py-1 rounded bg-emerald-50 text-emerald-700 border border-emerald-200 shadow-sm flex items-center gap-1"><span class="text-xs">💰</span> ${(t.incentive/1000)}k</span>`;

        const statusMap = {
            'not_started': { label: 'Not Started', color: 'rose' },
            'in_progress': { label: 'In Progress', color: 'amber' },
            'review_ready': { label: 'Review Ready', color: 'purple' },
            'approved': { label: 'Approved', color: 'emerald' },
            'done': { label: 'Approved', color: 'emerald' } // Fallback for old data
        };
        const st = statusMap[t.status || 'not_started'];
        const statBadge = `<span class="text-[9px] font-black px-2 py-1 rounded bg-${st.color}-50 text-${st.color}-700 border border-${st.color}-200 uppercase tracking-widest flex items-center gap-1 shadow-sm"><span class="w-1.5 h-1.5 rounded-full bg-${st.color}-500"></span>${st.label}</span>`;

        return `
        <div class="bg-white border border-slate-200 rounded-lg shadow-sm hover:shadow-md transition p-5 flex flex-col h-full min-h-[160px]">
          <div class="flex justify-between items-start mb-3 shrink-0">
             <div class="flex gap-2 flex-wrap">
                 <span class="text-[10px] font-bold px-2 py-1 rounded bg-${c}-100 text-${c}-800 uppercase tracking-wide shadow-sm">${t.module}</span>
                 ${testDiff}
                 ${bountyBadge}
             </div>
             ${statBadge}
          </div>
          <div class="flex justify-between items-start gap-2 mb-3 flex-1">
             <h3 class="font-bold text-slate-900 leading-snug break-words">${t.title}</h3>
             <span class="text-xs text-slate-400 font-bold shrink-0 mt-0.5">${t.parts.length} Part(s)</span>
          </div>
          <div class="shrink-0">${assignedBadge}</div>
          <div class="flex gap-2 mt-auto pt-3 border-t border-slate-100 shrink-0">
            <button onclick="editTest('${t.id}')" class="flex-1 bg-slate-100 hover:bg-slate-200 rounded py-1.5 text-base transition flex items-center justify-center shadow-sm" title="Edit Test">✏️</button>
            ${currentUser.role === 'teacher' ? `<button onclick="window.promptAssignTest('${t.id}')" class="flex-1 bg-indigo-50 hover:bg-indigo-100 rounded py-1.5 text-base transition flex items-center justify-center shadow-sm" title="Assign to Class">👥</button>` : ''}
            <button onclick="window.promptMergeTest('${t.id}')" class="flex-1 bg-purple-50 hover:bg-purple-100 text-purple-700 rounded py-1.5 text-base transition flex items-center justify-center shadow-sm" title="Merge Test">🔀</button>
            <button onclick="deleteTest('${t.id}')" class="flex-1 bg-rose-50 hover:bg-rose-100 rounded py-1.5 text-base transition flex items-center justify-center shadow-sm" title="Delete Test">🗑️</button>
          </div>
        </div>`;
      }).join('') : '<div class="col-span-full text-center p-10 text-slate-500 italic bg-white rounded-2xl border border-slate-200 shadow-sm">No tests found matching your criteria.</div>';

      // ✨ NEW: Pagination UI Generation (Dynamic Sliding Window)
      const pagCont = document.getElementById('test-bank-pagination');
      if (pagCont) {
          if (totalPages <= 1) {
              pagCont.innerHTML = '';
          } else {
              let html = `<button onclick="changeTestBankPage(${currentTestBankPage - 1})" class="px-4 py-2 rounded-xl border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 font-bold transition shadow-sm disabled:opacity-50 disabled:cursor-not-allowed" ${currentTestBankPage === 1 ? 'disabled' : ''}>&larr; Prev</button>`;
              
              let start = Math.max(1, currentTestBankPage - 2);
              let end = Math.min(totalPages, currentTestBankPage + 2);
              
              // Always show page 1 and ellipsis if we are far into the list
              if (start > 1) html += `<button onclick="changeTestBankPage(1)" class="w-10 h-10 rounded-xl border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 font-bold transition shadow-sm flex items-center justify-center">1</button>${start > 2 ? '<span class="text-slate-400 font-bold px-1">...</span>' : ''}`;
              
              for (let i = start; i <= end; i++) {
                  html += `<button onclick="changeTestBankPage(${i})" class="w-10 h-10 rounded-xl border font-bold transition shadow-sm flex items-center justify-center ${i === currentTestBankPage ? 'border-blue-600 bg-blue-50 text-blue-700 shadow-blue-100' : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'}">${i}</button>`;
              }
              
              // Always show last page and ellipsis if we are far from the end
              if (end < totalPages) html += `${end < totalPages - 1 ? '<span class="text-slate-400 font-bold px-1">...</span>' : ''}<button onclick="changeTestBankPage(${totalPages})" class="w-10 h-10 rounded-xl border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 font-bold transition shadow-sm flex items-center justify-center">${totalPages}</button>`;
              
              html += `<button onclick="changeTestBankPage(${currentTestBankPage + 1})" class="px-4 py-2 rounded-xl border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 font-bold transition shadow-sm disabled:opacity-50 disabled:cursor-not-allowed" ${currentTestBankPage === totalPages ? 'disabled' : ''}>Next &rarr;</button>`;
              
              pagCont.innerHTML = html;
          }
      }
    }

    window.currentAssignTestId = null;

    window.updateUnassignTestButton = function() {
        const button = document.getElementById('btn-unassign-test');
        const tid = window.currentAssignTestId;
        const cid = document.getElementById('assign-class-select').value;
        const cls = CLASSES.find(c => c.id === cid);
        button.classList.toggle('hidden', !cls || !tid || !Array.isArray(cls.assignedTests) || !cls.assignedTests.includes(tid));
    };

    window.promptAssignTest = function(tid) {
        if (!tid) return;
        window.currentAssignTestId = tid;
        
        if (CLASSES.length === 0) {
            showModalMsg("Notice", "Please create at least one class first before assigning tests.");
            return;
        }

        const t = TEST_BANK.find(x => x.id === tid);
        if (!t) return;

        // Inform the teacher which test they are assigning
        const subLabel = document.getElementById('assign-modal-subtitle');
        if (subLabel) subLabel.textContent = `Assigning: ${t.title}`;

        // Populate the class dropdown dynamically based on available classes
        const classSelect = document.getElementById('assign-class-select');
        classSelect.innerHTML = CLASSES.map(c => `<option value="${c.id}">${getClassParent(c) ? `Small class · ${c.name}` : c.name}</option>`).join('');
        window.updateUnassignTestButton();

        // Reset the form back to sensible defaults upon opening
        document.getElementById('assign-attempts').value = 'unlimited';
        document.getElementById('assign-keep-correct').checked = true;
        document.getElementById('assign-after-sub').value = 'allow_edits';
        document.getElementById('assign-return-score').value = 'instantly';
        document.getElementById('assign-return-ans').value = 'after_submit';
        
        // Reset New Security Defaults
        document.getElementById('assign-req-pass').checked = false;
        const passInput = document.getElementById('assign-password-input');
        passInput.value = '';
        passInput.classList.add('hidden');
        document.getElementById('assign-secure-mode').checked = false;
        document.getElementById('assign-tts').checked = false;
        document.getElementById('assign-due-date').value = '';
        document.getElementById('assign-due-time').value = '';

        document.getElementById('assign-settings-modal').classList.remove('hidden');
    };

    window.unassignTestFromClass = function() {
        const tid = window.currentAssignTestId;
        const cid = document.getElementById('assign-class-select').value;
        const cls = CLASSES.find(c => c.id === cid);
        if (!tid || !cls || !Array.isArray(cls.assignedTests) || !cls.assignedTests.includes(tid)) return;

        showConfirm("Unassign Test", "Remove this test and its class-specific settings from the selected class?", async () => {
            const button = document.getElementById('btn-unassign-test');
            button.disabled = true;
            button.textContent = "Unassigning...";

            try {
                const updatedClass = {
                    ...cls,
                    assignedTests: cls.assignedTests.filter(assignedId => assignedId !== tid),
                    testSettings: { ...(cls.testSettings || {}) }
                };
                delete updatedClass.testSettings[tid];
                await window.fsSetDoc(window.fsDoc(window.db, window.fPath('classes'), cls.id), updatedClass);
                Object.assign(cls, updatedClass);

                document.getElementById('assign-settings-modal').classList.add('hidden');
                if (typeof window.showToast === 'function') {
                    window.showToast("Unassigned Successfully", "The test has been removed from the selected class.");
                } else {
                    showModalMsg("Unassigned", "The test has been removed from the selected class.");
                }
                if (typeof renderTestBank === 'function') renderTestBank(false);
                if (typeof renderClasses === 'function') renderClasses();
            } catch (e) {
                console.error(e);
                showModalMsg("Error", "Could not unassign test from class due to a cloud error.");
            } finally {
                button.disabled = false;
                button.textContent = "Unassign";
            }
        });
    };

    window.confirmAssignTest = async function() {
        if (!window.currentAssignTestId) return;
        const tid = window.currentAssignTestId;
        const cid = document.getElementById('assign-class-select').value;
        const cls = CLASSES.find(c => c.id === cid);
        
        if (!cls) return;

        const btn = document.getElementById('btn-confirm-assign');
        btn.textContent = "Assigning..."; btn.disabled = true;

        const parent = getClassParent(cls);
        if (parent && !getClassAssignedTests(cls).includes(tid)) {
            showModalMsg("Material Not Inherited", `Assign this test to the parent class "${parent.name}" first, then set this small class's deadline.`);
            btn.textContent = "Assign"; btn.disabled = false;
            return;
        }

        if (!parent) {
            if (!cls.assignedTests) cls.assignedTests = [];
            if (!cls.assignedTests.includes(tid)) cls.assignedTests.push(tid);
        }

        // Store the configuration settings inside the class object
        if (!cls.testSettings) cls.testSettings = {};
        cls.testSettings[tid] = {
            attempts: document.getElementById('assign-attempts').value,
            keepCorrect: document.getElementById('assign-keep-correct').checked,
            afterSub: document.getElementById('assign-after-sub').value,
            returnScore: document.getElementById('assign-return-score').value,
            returnAns: document.getElementById('assign-return-ans').value,
            requirePassword: document.getElementById('assign-req-pass').checked,
            password: document.getElementById('assign-password-input').value.trim(),
            secureMode: document.getElementById('assign-secure-mode').checked,
            tts: document.getElementById('assign-tts').checked,
            dueDate: document.getElementById('assign-due-date').value,
            dueTime: document.getElementById('assign-due-time').value,
            assignedAt: Date.now()
        };

        try {
            await window.fsSetDoc(window.fsDoc(window.db, window.fPath('classes'), cls.id), cls);
            document.getElementById('assign-settings-modal').classList.add('hidden');
            
            if (typeof window.showToast === 'function') {
                window.showToast("Assigned Successfully", "The test and its custom rules have been applied to the class.");
            } else {
                showModalMsg("Assigned", "Test has been applied to the class.");
            }
            
            if (typeof renderTestBank === 'function') renderTestBank(false);
            if (typeof renderClasses === 'function') renderClasses();
        } catch (e) {
            console.error(e);
            showModalMsg("Error", "Could not assign test to class due to a cloud error.");
        }

        btn.textContent = "Assign"; btn.disabled = false;
    };

    window.promptMergeTest = function(sourceId) {
    const sourceTest = TEST_BANK.find(t => t.id === sourceId);
    if (!sourceTest) return;

    let optionsHtml = '<option value="">-- Select Target Test --</option>';
    TEST_BANK.forEach(t => {
        if (t.id !== sourceId) {
            optionsHtml += `<option value="${t.id}">${t.title}</option>`;
        }
    });

    const html = `
        <p class="text-sm text-slate-500 mb-4">Select the target test. All parts, questions, and vocabulary from this test will be appended to the target test.</p>
        <label class="block text-xs font-bold text-slate-800 mb-1">Merge into Target Test:</label>
        <select id="merge-target-select" class="w-full border border-slate-300 p-2.5 rounded-lg mb-4 outline-none focus:border-blue-500 font-bold text-blue-900 bg-white shadow-sm cursor-pointer">
            ${optionsHtml}
        </select>
        <div class="flex items-center gap-2 border border-slate-200 p-3 rounded-lg bg-white shadow-sm">
            <input type="checkbox" id="merge-delete-check" class="w-4 h-4 accent-rose-600 cursor-pointer">
            <label for="merge-delete-check" class="text-sm font-bold text-rose-700 cursor-pointer select-none">Delete this original test after merging</label>
        </div>
    `;

    // Gọi Modal Confirm của bạn
    window.showConfirm("Merge: " + sourceTest.title, html, async () => {
        const targetId = document.getElementById('merge-target-select').value;
        const deleteOriginal = document.getElementById('merge-delete-check').checked;

        if (!targetId) {
            if (typeof window.showToast === 'function') window.showToast("Lỗi", "Vui lòng chọn bài test đích.", "error");
            return;
        }

        try {
            const targetTest = TEST_BANK.find(t => t.id === targetId);
            if (!targetTest) throw new Error("Không tìm thấy Target Test.");

            // 🔴 FIX LỖI FIREBASE NẰM Ở ĐÂY: 
            // Sử dụng JSON.parse(JSON.stringify()) để lọc sạch hoàn toàn các dữ liệu rác/undefined
            // Nếu không có bước này, lệnh đẩy lên Cloud (fsSetDoc) sẽ bị Firebase từ chối.
            let mergedTest = JSON.parse(JSON.stringify(targetTest));
            let srcTest = JSON.parse(JSON.stringify(sourceTest));

            // Khởi tạo mảng dự phòng nếu test chưa có dữ liệu
            if (!mergedTest.parts) mergedTest.parts = [];
            if (!mergedTest.vocab) mergedTest.vocab = [];
            if (!mergedTest.grammar) mergedTest.grammar = [];

            // Tiến hành gộp dữ liệu
            if (srcTest.parts && Array.isArray(srcTest.parts)) mergedTest.parts.push(...srcTest.parts);
            if (srcTest.vocab && Array.isArray(srcTest.vocab)) mergedTest.vocab.push(...srcTest.vocab);
            if (srcTest.grammar && Array.isArray(srcTest.grammar)) mergedTest.grammar.push(...srcTest.grammar);

            // Lưu lên Cloud
            await window.fsSetDoc(window.fsDoc(window.db, window.fPath('tests'), mergedTest.id), mergedTest);

            // Xóa bản gốc nếu người dùng chọn
            if (deleteOriginal) {
                await window.fsDeleteDoc(window.fsDoc(window.db, window.fPath('tests'), sourceTest.id));
            }

            // Tắt Modal và cập nhật giao diện
            document.getElementById('custom-modal').classList.add('hidden');
            if (typeof window.showToast === 'function') window.showToast("Thành công", "Đã gộp bài test an toàn!");
            if (typeof renderTestBank === 'function') renderTestBank(true);

        } catch (err) {
            console.error("Lỗi Merge Test:", err);
            // Nâng cấp: Hiển thị nguyên nhân gốc của lỗi ngay trên modal để bạn dễ nhận biết
            document.getElementById('modal-message').innerHTML = `Could not complete the merge operation.<br><br><span class="text-xs text-rose-500 font-mono">${err.message}</span>`;
        }
    });
};
    
    // ✨ NEW: Smart IELTS Template Generator
    function getSmartIeltsStructure(mod) {
        if (mod === 'reading') {
            return [
                { title: "Reading Passage 1", text: "", questions: [] },
                { title: "Reading Passage 2", text: "", questions: [] },
                { title: "Reading Passage 3", text: "", questions: [] }
            ];
        } else if (mod === 'listening') {
            return [
                { title: "Part 1", text: "", audioUrl: "", questions: [] },
                { title: "Part 2", text: "", audioUrl: "", questions: [] },
                { title: "Part 3", text: "", audioUrl: "", questions: [] },
                { title: "Part 4", text: "", audioUrl: "", questions: [] }
            ];
        } else if (mod === 'writing') {
            return [
                { title: "Task 1", writingTask: 'task1', text: "You should spend about 20 minutes on this task.\n\n[Insert chart/graph description here]\n\nWrite at least 150 words.", questions: [{ blockId: 'w1_'+Date.now(), type: 'essay', ids: [1], instruction: 'Write your essay below.', points: 1 }] },
                { title: "Task 2", writingTask: 'task2', text: "You should spend about 40 minutes on this task.\n\n[Insert essay prompt here]\n\nWrite at least 250 words.", questions: [{ blockId: 'w2_'+Date.now(), type: 'essay', ids: [2], instruction: 'Write your essay below.', points: 1 }] }
            ];
        } else if (mod === 'speaking') {
            return [
                { title: "Part 1: Introduction", speakingQuestions: "Let's talk about [Topic].<ul><li>Question 1</li><li>Question 2</li><li>Question 3</li></ul>", text: "", questions: [{ blockId: 's1_'+Date.now(), type: 'audio_record', ids: [1], instruction: 'Record your answer for Part 1' }] },
                { title: "Part 2: Cue Card", speakingQuestions: "Describe [Topic].<p>You should say:</p><ul><li>point 1</li><li>point 2</li><li>point 3</li></ul><p>You will have to talk about the topic for one to two minutes. You have one minute to think about what you are going to say.</p>", text: "", questions: [{ blockId: 's2_'+Date.now(), type: 'audio_record', ids: [2], instruction: 'Record your answer for Part 2' }] },
                { title: "Part 3: Discussion", speakingQuestions: "Let's consider first of all [Topic].<ul><li>Question 1</li><li>Question 2</li></ul>", text: "", questions: [{ blockId: 's3_'+Date.now(), type: 'audio_record', ids: [3], instruction: 'Record your answer for Part 3' }] }
            ];
        } else if (mod === 'activity') {
            return [
                { title: "Warm-up Game", text: "", questions: [{ blockId: 'a1_'+Date.now(), type: 'vocab_game', ids: [1], instruction: '' }] },
                { title: "Main Activity", text: "", questions: [{ blockId: 'a2_'+Date.now(), type: 'pair_roleplay', ids: [2], instruction: 'Find a partner. Decide who is Student A and Student B.', text: 'You are a tourist asking for directions.', hint: 'You are a local giving directions.' }] }
            ];
        }
        return [{ title: "Part 1", text: "", questions: [] }];
    }

    async function createNewTest(mod) {
      showTestMetaModal(`New ${mod.charAt(0).toUpperCase()+mod.slice(1)} Test`, "", "", "", async (title, topics, diff) => {
        const smartParts = getSmartIeltsStructure(mod);
        const newTest = { id: 't_'+Date.now(), title, module: mod, topics, difficulty: diff, parts: smartParts, vocab: [], grammar: [] };
        TEST_BANK.unshift(newTest); 
        await window.fsSetDoc(window.fsDoc(window.db, window.fPath('tests'), newTest.id), newTest);
        editTest(newTest.id);
      });
    }
    
    async function deleteTest(id) {
      showConfirm("Delete Test", "Remove completely from cloud database?", async () => {
        TEST_BANK = TEST_BANK.filter(t => t.id !== id); 
        CLASSES.forEach(c => c.assignedTests = c.assignedTests.filter(tid => tid !== id)); 
        
        await window.fsDeleteDoc(window.fsDoc(window.db, window.fPath('tests'), id));
        for(let c of CLASSES) await window.fsSetDoc(window.fsDoc(window.db, window.fPath('classes'), c.id), c);
        
        const noteIdsToDelete = Object.keys(ALL_NOTES).filter(k => k.endsWith(`_${id}`));
        for (let nid of noteIdsToDelete) {
           delete ALL_NOTES[nid];
           await window.fsDeleteDoc(window.fsDoc(window.db, window.fPath('notes'), nid));
        }
        
        renderTestBank();
      });
    }

    window.openBulkTestImport = function() {
        document.getElementById('bulk-test-input').value = '';
        document.getElementById('bulk-test-import-modal').classList.remove('hidden');
    };

    window.processBulkTestImport = async function() {
        const text = document.getElementById('bulk-test-input').value.trim();
        if (!text) {
            showModalMsg("Empty", "Please paste some data from Excel first.");
            return;
        }

        const lines = text.split('\n');
        let count = 0;
        
        // Show loading state
        const btn = document.querySelector('button[onclick="window.processBulkTestImport()"]');
        if (btn) { btn.textContent = "Importing..."; btn.disabled = true; }
        
        for (let line of lines) {
            const parts = line.split('\t');
            if (parts[0] && parts[0].trim()) {
                const title = parts[0].trim();
                let mod = (parts[1] || '').trim().toLowerCase();
                if (!['reading', 'listening', 'writing', 'speaking'].includes(mod)) {
                    mod = 'reading'; // default fallback
                }
                const topics = (parts[2] || '').split(',').map(s => s.trim()).filter(Boolean);
                const diff = (parts[3] || '').trim();

                const newTest = { 
                    id: 't_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5), 
                    title, 
                    module: mod, 
                    topics, 
                    difficulty: diff, 
                    parts: getSmartIeltsStructure(mod), 
                    vocab: [] 
                };
                
                TEST_BANK.unshift(newTest);
                await window.fsSetDoc(window.fsDoc(window.db, window.fPath('tests'), newTest.id), newTest);
                count++;
            }
        }
        
        document.getElementById('bulk-test-import-modal').classList.add('hidden');
        renderTestBank();
        
        if (btn) { btn.textContent = "Import Tests"; btn.disabled = false; }
        showModalMsg("Success", `Imported ${count} new tests!`);
    };

    let questionBlockStartTimes = {};
    let questionBlockAccumulated = {};
    let currentActiveQuestionBlockKey = null;

    function stripHtmlTags(value = '') {
      return String(value || '')
        .replace(/<[^>]*>/g, ' ')
        .replace(/&nbsp;/g, ' ')
        .replace(/&amp;/g, '&')
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'")
        .replace(/\s+/g, ' ')
        .trim();
    }

    function activateQuestionBlock(partIdx, blockIdx) {
      const newKey = `${partIdx}:${blockIdx}`;
      if (currentActiveQuestionBlockKey && currentActiveQuestionBlockKey !== newKey) {
        const startedAt = questionBlockStartTimes[currentActiveQuestionBlockKey];
        if (startedAt) {
          questionBlockAccumulated[currentActiveQuestionBlockKey] = (questionBlockAccumulated[currentActiveQuestionBlockKey] || 0) + (Date.now() - startedAt);
          delete questionBlockStartTimes[currentActiveQuestionBlockKey];
        }
      }
      if (!questionBlockStartTimes[newKey]) {
        questionBlockStartTimes[newKey] = Date.now();
      }
      currentActiveQuestionBlockKey = newKey;
    }

    function finalizeCurrentQuestionTiming() {
      if (!currentActiveQuestionBlockKey) return;
      const startedAt = questionBlockStartTimes[currentActiveQuestionBlockKey];
      if (startedAt) {
        questionBlockAccumulated[currentActiveQuestionBlockKey] = (questionBlockAccumulated[currentActiveQuestionBlockKey] || 0) + (Date.now() - startedAt);
        delete questionBlockStartTimes[currentActiveQuestionBlockKey];
      }
      currentActiveQuestionBlockKey = null;
    }

    function evaluateQuestionBlock(question, answerMap = answers) {
      if (!question) return null;
      const ids = question.ids || [];
      if (!ids.length) return null;
      if (question.type === 'essay' || question.type === 'audio_record') return null;

      if (question.multi) {
        const given = ids.map(id => (answerMap[id] || '').toString().toLowerCase()).filter(Boolean);
        let correct = 0;
        ids.forEach(id => {
          const ex = (question.correctAnswers?.[id] || '').toString().toLowerCase();
          if (ex) {
            const matchIdx = given.indexOf(ex);
            if (matchIdx !== -1) {
              correct++;
              given.splice(matchIdx, 1);
            }
          }
        });
        return correct === ids.length && ids.length > 0;
      }

      let correct = 0;
      ids.forEach(id => {
        const exStr = (question.correctAnswers?.[id] || '').toString().toLowerCase();
        const gv = (answerMap[id] || '').toString().toLowerCase().trim();
        const exList = exStr.split(/[/|]/).map(x => x.trim());
        if (exStr && exList.includes(gv) && gv !== '') correct++;
      });

      return correct === ids.length && ids.length > 0;
    }

    function getQuestionAnalyticsForSubmission(testData, answerMap = answers) {
      if (!testData || !testData.parts) return [];
      let analytics = [];
      testData.parts.forEach((part, partIdx) => {
        (part.questions || []).forEach((question, blockIdx) => {
          const ids = question.ids || [];
          const blockKey = `${partIdx}:${blockIdx}`;
          const elapsedSec = Math.max(0, Math.round(((questionBlockAccumulated[blockKey] || 0) + (questionBlockStartTimes[blockKey] ? Date.now() - questionBlockStartTimes[blockKey] : 0)) / 1000));
          const answered = ids.some(id => {
            const val = answerMap[id];
            return val !== undefined && val !== null && String(val).trim() !== '';
          });
          const correctness = evaluateQuestionBlock(question, answerMap);
          let correctCount = 0;
          if (question.multi) {
            const given = ids.map(id => (answerMap[id] || '').toString().toLowerCase()).filter(Boolean);
            ids.forEach(id => {
              const expected = (question.correctAnswers?.[id] || '').toString().toLowerCase();
              if (!expected) return;
              const matchIdx = given.indexOf(expected);
              if (matchIdx !== -1) {
                correctCount++;
                given.splice(matchIdx, 1);
              }
            });
          } else {
            ids.forEach(id => {
              const expected = (question.correctAnswers?.[id] || '').toString().toLowerCase();
              const given = (answerMap[id] || '').toString().toLowerCase().trim();
              if (expected && expected.split(/[/|]/).map(value => value.trim()).includes(given) && given) correctCount++;
            });
          }
          analytics.push({
            partIndex: partIdx,
            blockIndex: blockIdx,
            questionNumber: analytics.length + 1,
            questionType: question.type || 'unknown',
            blockId: question.blockId || '',
            title: stripHtmlTags(question.instruction || question.text || '').slice(0, 90),
            timeSpentSec: elapsedSec,
            answered,
            correct: correctness,
            correctCount,
            totalCount: ids.length,
            scoreable: ['reading', 'listening'].includes(testData.module)
          });
        });
      });
      return analytics;
    }

    function getClassAnalyticsSnapshot(cls) {
      const classSubs = SUBMISSIONS.filter(s => s.className === cls.name && Array.isArray(s.questionAnalytics) && s.questionAnalytics.length > 0);
      if (!classSubs.length) return [];

      const summaries = [];
      const firstSub = classSubs[0];
      const baseQuestions = firstSub.questionAnalytics || [];

      baseQuestions.forEach((baseQa, idx) => {
        const stats = classSubs.reduce((acc, sub) => {
          const qa = sub.questionAnalytics?.[idx];
          if (!qa) return acc;
          acc.count++;
          if (qa.scoreable !== false) {
            if (qa.correct === true) acc.correct++;
            if (qa.correct === false) acc.incorrect++;
          }
          acc.totalTime += qa.timeSpentSec || 0;
          return acc;
        }, { count: 0, correct: 0, incorrect: 0, totalTime: 0 });

        const incorrectRate = stats.count ? stats.incorrect / stats.count : 0;
        const avgTimeSec = stats.count ? Math.round(stats.totalTime / stats.count) : 0;
        const avgTimeMin = Math.max(1, Math.round(avgTimeSec / 60));
        const tone = incorrectRate > 0.6 ? 'bg-rose-500' : incorrectRate > 0.3 ? 'bg-amber-400' : 'bg-emerald-500';

        summaries.push({
          ...baseQa,
          submissionsCount: stats.count,
          incorrectRate,
          avgTimeSec,
          avgTimeMin,
          tone,
          label: baseQa.title ? `Q${baseQa.questionNumber} · ${baseQa.title}` : `Question ${baseQa.questionNumber}`
        });
      });

      return summaries.slice(0, 6);
    }

    window.toggleClassDetails = function(cid) {
        const details = document.getElementById(`class-details-${cid}`);
        const chevron = document.getElementById(`chevron-${cid}`);
        if(details && chevron) {
            details.classList.toggle('hidden');
            details.classList.toggle('flex');
            chevron.classList.toggle('rotate-180');
        }
    };

    function getStudentDisplayName(student) {
        const profile = typeof student === 'object'
            ? student
            : USERS.find(user => user.user === student || user.username === student || user.uid === student);
        if (!profile) return 'Học viên không rõ tên';

        const username = String(profile.username || profile.user || '').trim();
        const isUidUsername = Boolean(username && (
            (profile.uid && username === String(profile.uid)) ||
            /^[A-Za-z0-9_-]{20,}$/.test(username)
        ));
        const email = String(profile.email || '').trim();
        const readableEmail = email && !email.toLowerCase().endsWith('@khanhlms.com') ? email : '';
        return (isUidUsername ? '' : username) ||
            readableEmail || String(profile.realName || '').trim() || 'Học viên không rõ tên';
    }

    function renderClasses() {
      const query = (document.getElementById('classes-search')?.value || '').toLowerCase();
      const sortVal = document.getElementById('classes-sort')?.value || 'default';
      
      let viewableClasses = CLASSES;
      if (currentUser && currentUser.role === 'collaborator') {
          viewableClasses = CLASSES.filter(c => (c.collaborators || []).includes(currentUser.user));
      }

      let filteredClasses = viewableClasses.filter(c => c.name.toLowerCase().includes(query));
      if (query) {
          const matchingParents = filteredClasses
              .filter(cls => cls.parentClassId)
              .map(cls => CLASSES.find(candidate => candidate.id === cls.parentClassId))
              .filter(parent => parent && viewableClasses.some(candidate => candidate.id === parent.id));
          const matchingParentIds = new Set(filteredClasses.filter(cls => !cls.parentClassId).map(cls => cls.id));
          const matchingParentChildren = viewableClasses.filter(cls => matchingParentIds.has(cls.parentClassId));
          filteredClasses = [...new Map([...matchingParents, ...filteredClasses, ...matchingParentChildren].map(cls => [cls.id, cls])).values()];
      }
      
      // Apply Sorting Logic
      const compareClasses = (a, b) => {
          if (sortVal === 'az') return a.name.localeCompare(b.name);
          if (sortVal === 'za') return b.name.localeCompare(a.name);
          if (sortVal === 'students_high') return (b.enrolledStudents || []).length - (a.enrolledStudents || []).length;
          if (sortVal === 'subs_high') {
              const subsA = SUBMISSIONS.filter(s => s.className === a.name).length;
              const subsB = SUBMISSIONS.filter(s => s.className === b.name).length;
              return subsB - subsA;
          }
          return 0;
      };
      const rootClasses = filteredClasses
          .filter(cls => !cls.parentClassId || !filteredClasses.some(parent => parent.id === cls.parentClassId))
          .sort(compareClasses);
      const orderedClasses = [];
      const orderedClassIds = new Set();
      rootClasses.forEach(parent => {
          orderedClasses.push(parent);
          orderedClassIds.add(parent.id);
          const children = filteredClasses
              .filter(cls => cls.parentClassId === parent.id)
              .sort(compareClasses);
          children.forEach(child => {
              orderedClasses.push(child);
              orderedClassIds.add(child.id);
          });
      });
      const misplacedClasses = filteredClasses
          .filter(cls => !orderedClassIds.has(cls.id))
          .sort(compareClasses);
      filteredClasses = [...orderedClasses, ...misplacedClasses];
      
      document.getElementById('classes-list').innerHTML = filteredClasses.map(cls => {
        const enrolled = cls.enrolledStudents || [];
        const assigned = getClassAssignedTests(cls);
        const classSubs = SUBMISSIONS.filter(s => s.className === cls.name);
        const isPathEnabled = (getClassParent(cls) || cls).learningPathEnabled !== false;
        
        const isOwner = currentUser.role === 'teacher';
                // --- NEW: MINI-CLASS TEACHER DASHBOARD LOGIC (GROUPED) ---
        let progressBoardHtml = '';
        if (enrolled.length > 0) {
            const requiredTestIds = getClassAssignedTests(cls);
            const miniClassesMap = cls.miniClasses || {};
            
            let studentStats = enrolled.map(student => {
                const mySubs = SUBMISSIONS.filter(s => s.student === student && s.className === cls.name);
                const completedIds = [...new Set(mySubs.map(s => s.testId))];
                let completedRequired = 0, pendingDeadlines = 0, totalScoreVal = 0, scoredCount = 0;

                requiredTestIds.forEach(tid => {
                    const isCompleted = completedIds.includes(tid);
                    if (isCompleted) completedRequired++;
                    
                    const settings = cls.testSettings && cls.testSettings[tid];
                    if (settings && settings.dueDate && !isCompleted) {
                        const dueStr = settings.dueDate + (settings.dueTime ? 'T' + settings.dueTime : 'T23:59');
                        if (new Date(dueStr) > new Date()) pendingDeadlines++;
                    }

                    if (isCompleted) {
                        const sub = mySubs.find(s => s.testId === tid);
                        if (sub && sub.score) {
                            const scoreMatch = sub.score.match(/Band\s*([\d.]+)/) || sub.score.match(/([\d.]+)\s*\//);
                            if (scoreMatch) { totalScoreVal += parseFloat(scoreMatch[1]); scoredCount++; }
                        }
                    }
                });

                return {
                    student, completedRequired, totalRequired: requiredTestIds.length,
                    progressPct: requiredTestIds.length ? Math.round((completedRequired / requiredTestIds.length) * 100) : 0,
                    avgScore: scoredCount > 0 ? (totalScoreVal / scoredCount).toFixed(1) : '-',
                    pendingDeadlines,
                    miniClass: miniClassesMap[student] || 'Chưa phân lớp'
                };
            });

            // Group data by Mini-Class
            const groupedStats = {};
            studentStats.forEach(stat => {
                if(!groupedStats[stat.miniClass]) groupedStats[stat.miniClass] = [];
                groupedStats[stat.miniClass].push(stat);
            });

            progressBoardHtml = `<div class="col-span-full border-t border-slate-200 bg-slate-50 p-6 space-y-8">`;
            
            for (const [mName, mStats] of Object.entries(groupedStats)) {
                // Sort each group
                mStats.sort((a, b) => b.progressPct !== a.progressPct ? b.progressPct - a.progressPct : (parseFloat(b.avgScore)||0) - (parseFloat(a.avgScore)||0));
                
                progressBoardHtml += `
                <div>
                    <h4 class="font-black text-indigo-900 text-lg flex items-center gap-2 mb-3"><span>🏆</span> Lớp: ${mName === 'Chưa phân lớp' ? cls.name + ' (Tổng)' : mName}</h4>
                    <div class="overflow-x-auto bg-white rounded-xl border border-slate-200 shadow-sm">
                        <table class="w-full text-left border-collapse text-sm whitespace-nowrap">
                            <thead class="bg-slate-100 border-b border-slate-200">
                                <tr>
                                    <th class="p-3 font-bold text-slate-600 text-center w-16">Hạng</th>
                                    <th class="p-3 font-bold text-slate-600">Học viên</th>
                                    <th class="p-3 font-bold text-slate-600 min-w-[200px]">Tiến độ làm bài</th>
                                    <th class="p-3 font-bold text-slate-600 text-center">Điểm TB</th>
                                    <th class="p-3 font-bold text-slate-600 text-center">Deadline chờ nộp</th>
                                </tr>
                            </thead>
                            <tbody class="divide-y divide-slate-100">
                                ${mStats.map((stat, idx) => `
                                    <tr class="hover:bg-blue-50/50 transition-colors">
                                        <td class="p-3 text-center border-r border-slate-100">${idx === 0 ? '🥇' : idx === 1 ? '🥈' : idx === 2 ? '🥉' : `<span class="font-black text-slate-500">${idx + 1}</span>`}</td>
                                        <td class="p-3 font-bold text-slate-800 flex items-center gap-2"><img src="https://ui-avatars.com/api/?name=${encodeURIComponent(getStudentDisplayName(stat.student))}&background=random" class="w-6 h-6 rounded-full shadow-sm"> ${escapeHtmlAttributeValue(getStudentDisplayName(stat.student))}</td>
                                        <td class="p-3">
                                            <div class="flex items-center justify-between text-[11px] font-bold text-slate-500 mb-1">
                                                <span>Đã làm: ${stat.completedRequired}/${stat.totalRequired} bài</span><span class="text-blue-600">${stat.progressPct}%</span>
                                            </div>
                                            <div class="w-full bg-slate-100 rounded-full h-2 shadow-inner overflow-hidden"><div class="bg-blue-500 h-full rounded-full" style="width: ${stat.progressPct}%"></div></div>
                                        </td>
                                        <td class="p-3 text-center font-black text-emerald-600">${stat.avgScore}</td>
                                        <td class="p-3 text-center">${stat.pendingDeadlines > 0 ? `<span class="bg-rose-100 text-rose-700 font-bold px-2 py-1 rounded text-xs shadow-sm">⏰ ${stat.pendingDeadlines} bài</span>` : `<span class="text-slate-400 text-xs font-medium">Hoàn tất</span>`}</td>
                                    </tr>
                                `).join('')}
                            </tbody>
                        </table>
                    </div>
                </div>`;
            }
            progressBoardHtml += `</div>`;
        }
        // -----------------------------------------------------

        const parentClass = getClassParent(cls);
        const childClasses = CLASSES.filter(candidate => candidate.parentClassId === cls.id);
        const isSmallClass = Boolean(parentClass);
        const hasInvalidHierarchyDepth = Boolean(parentClass?.parentClassId);
        const isMainClass = !isSmallClass;
        const topActionsHtml = isOwner ? `
                <div class="flex flex-wrap items-center justify-end w-full gap-3">
                    <button onclick="window.openClassHierarchyEditor('${cls.id}')" class="text-xs font-black uppercase tracking-widest rounded-xl px-3 py-2.5 bg-white text-slate-700 border border-slate-200 hover:bg-slate-50 transition shadow-sm">Edit / Assign Parent</button>
                    ${!cls.parentClassId ? `<button onclick="window.promptCreateChildClass('${cls.id}')" class="text-xs font-black uppercase tracking-widest rounded-xl px-3 py-2.5 bg-indigo-50 text-indigo-700 border border-indigo-200 hover:bg-indigo-100 transition shadow-sm">+ Create Small Class</button>` : ''}
                    ${parentClass ? `<span class="text-[10px] font-black uppercase tracking-widest rounded-xl px-3 py-2.5 bg-indigo-50 text-indigo-700 border border-indigo-100">Small class · ${parentClass.name}</span>` : isMainClass ? `<span class="text-[10px] font-black uppercase tracking-widest rounded-xl px-3 py-2.5 bg-blue-50 text-blue-700 border border-blue-100">Main class · shared materials · ${childClasses.length} small class${childClasses.length === 1 ? '' : 'es'}</span>` : ''}
                    <div class="flex items-center gap-2 bg-white px-3 py-2 rounded-xl border border-slate-200 shadow-sm flex-1 md:flex-none">
                        <label class="text-[10px] font-black text-rose-500 uppercase tracking-widest whitespace-nowrap">Meet Link:</label>
                        <input type="text" onchange="window.updateClassMeetLink('${cls.id}', this.value)" value="${cls.meetLink || ''}" placeholder="https://meet.google.com/..." class="w-full md:w-36 text-sm text-slate-600 font-bold outline-none bg-transparent border-none p-0 focus:ring-0">
                    </div>
                    ${parentClass ? `<span class="text-xs font-bold text-emerald-700 bg-emerald-50 px-3 py-2 rounded-xl border border-emerald-100">Base fee inherited · ${formatVND(getClassBaseFee(cls))}/lesson</span>` : `<div class="flex items-center gap-2 bg-white px-3 py-2 rounded-xl border border-slate-200 shadow-sm flex-1 md:flex-none">
                        <label class="text-[10px] font-black text-blue-500 uppercase tracking-widest whitespace-nowrap">Fee/Lesson:</label>
                        <input type="number" onchange="window.updateClassFee('${cls.id}', this.value)" value="${cls.feePerLesson || BILLING_SETTINGS.feePerLesson || 100000}" class="w-full md:w-24 text-sm text-emerald-600 font-black outline-none text-right bg-transparent border-none p-0 focus:ring-0">
                    </div>`}
                    ${parentClass ? '' : `<button onclick="window.toggleClassLearningPath('${cls.id}')" class="flex-1 md:flex-none text-xs font-black uppercase tracking-widest rounded-xl px-3 py-2.5 transition ${isPathEnabled ? 'bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100 shadow-sm' : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50 shadow-sm'}" title="Enable sequential material locking">${isPathEnabled ? 'Learning Path: On' : 'Learning Path: Off'}</button>`}                    ${window.isTemplateClass(cls) ? '' : `<button onclick="window.toggleClassBooking('${cls.id}')" class="flex-1 md:flex-none text-xs font-black uppercase tracking-widest rounded-xl px-3 py-2.5 transition ${cls.allowBooking ? 'bg-indigo-50 text-indigo-700 border border-indigo-200 hover:bg-indigo-100 shadow-sm' : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50 shadow-sm'}" title="Allow students to manually book lessons from your availability schedule">${cls.allowBooking ? 'Booking: Allowed' : 'Booking: Off'}</button>`}
                    <button onclick="deleteClass('${cls.id}')" class="flex-1 md:flex-none text-rose-500 hover:text-white bg-white hover:bg-rose-500 border border-slate-200 hover:border-rose-500 rounded-xl font-bold text-xs px-4 py-2.5 transition shadow-sm shrink-0 uppercase tracking-widest">Delete</button>
                </div>
        ` : '';

        return `
        <div class="bg-white border ${isSmallClass ? 'border-indigo-200 ml-4 sm:ml-8 border-l-4 border-l-indigo-300' : 'border-slate-200'} rounded-2xl shadow-sm overflow-hidden mb-4 transition-all duration-300">
            
            <!-- CLICKABLE HEADER -->
            <div onclick="window.toggleClassDetails('${cls.id}')" class="cursor-pointer bg-white hover:bg-blue-50/40 px-6 py-5 flex flex-col md:flex-row justify-between items-start md:items-center gap-4 transition-colors">
                <div class="flex items-center gap-5">
                    <div class="w-12 h-12 bg-gradient-to-br from-blue-50 to-indigo-100 border border-blue-200 text-blue-600 rounded-xl flex items-center justify-center text-2xl font-black shadow-sm shrink-0">🏫</div>
                    <div class="min-w-0">
                        <h3 class="font-black text-xl text-slate-800">${cls.name}</h3>
                        <div class="text-[10px] font-black uppercase tracking-widest mt-1 ${hasInvalidHierarchyDepth ? 'text-rose-600' : isSmallClass ? 'text-indigo-600' : isMainClass ? 'text-blue-700' : 'text-slate-400'}">
                            ${hasInvalidHierarchyDepth ? `Hierarchy needs review · parent ${parentClass.name} is also a small class` : isSmallClass ? `↳ Small class · ${parentClass.name} · roster & progress` : isMainClass ? 'Main class · shared materials for its small classes' : 'Class'}
                        </div>
                        <div class="flex flex-wrap gap-3 sm:gap-4 text-[11px] font-bold text-slate-500 mt-1.5">
                            <span class="flex items-center gap-1.5"><span class="w-1.5 h-1.5 rounded-full bg-emerald-400"></span> ${enrolled.length} Student${enrolled.length !== 1 ? 's' : ''}</span>
                            <span class="flex items-center gap-1.5"><span class="w-1.5 h-1.5 rounded-full bg-purple-400"></span> ${(cls.learningPaths || []).length || 1} Path${((cls.learningPaths || []).length || 1) !== 1 ? 's' : ''}</span>
                            <span class="flex items-center gap-1.5"><span class="w-1.5 h-1.5 rounded-full bg-amber-400"></span> ${classSubs.length} Submission${classSubs.length !== 1 ? 's' : ''}</span>
                        </div>
                    </div>
                </div>
                <div class="flex items-center gap-4 w-full md:w-auto justify-end">
                    ${!isOwner ? `<div class="text-[10px] font-bold text-blue-600 bg-blue-50 px-2.5 py-1 rounded-md border border-blue-200 shadow-sm uppercase tracking-widest">Collaborator</div>` : ''}
                    <div id="chevron-${cls.id}" class="w-8 h-8 rounded-full bg-slate-50 border border-slate-200 flex items-center justify-center text-slate-400 transition-transform duration-300 shadow-sm">
                        <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"></polyline></svg>
                    </div>
                </div>
            </div>

            <!-- EXPANDABLE CONTENT -->
            <div id="class-details-${cls.id}" class="hidden border-t border-slate-200 flex-col">
                ${isOwner ? `
                <div class="bg-slate-50/50 px-6 py-4 border-b border-slate-100 flex flex-col md:flex-row justify-between items-start md:items-center gap-3">
                    <span class="text-[10px] font-black text-slate-400 uppercase tracking-widest hidden lg:block">Class Configuration</span>
                    ${topActionsHtml}
                </div>
                ` : ''}
                <div class="grid grid-cols-1 xl:grid-cols-3 divide-y xl:divide-y-0 xl:divide-x divide-slate-100">
                
                <div class="p-6 bg-white">
                    <h4 class="font-bold text-slate-700 mb-4 flex justify-between items-center border-b border-slate-100 pb-3">
                        ${isSmallClass ? 'Small-Class Students' : 'Enrolled Students'} (${enrolled.length})
                        ${isOwner ? `<button onclick="window.promptEnrollStudent('${cls.id}')" class="text-xs bg-blue-50 text-blue-700 font-bold px-3 py-1.5 rounded-lg hover:bg-blue-100 transition border border-blue-200">+ Assign Student</button>` : ''}
                    </h4>
                                        <div class="space-y-2 max-h-60 overflow-y-auto pr-1 ${isOwner ? 'mb-6' : ''}">
                        ${enrolled.length ? enrolled.map(student => {
                            const miniClassesMap = cls.miniClasses || {};
                            const uniqueMinis = [...new Set(Object.values(miniClassesMap))];
                            const myMini = miniClassesMap[student] || '';
                            
                            return `
                            <div class="flex justify-between items-center text-sm p-3 bg-slate-50 rounded-xl border border-slate-100 hover:border-slate-200 transition">
                                <div class="flex items-center gap-2">
                                    <span class="w-6 h-6 rounded-full bg-slate-200 flex items-center justify-center text-xs font-bold text-slate-500">👤</span>
                                    <span class="font-bold text-slate-800">${escapeHtmlAttributeValue(getStudentDisplayName(student))}</span>
                                </div>
                                ${isOwner ? `
                                <div class="flex items-center gap-2">
                                    <select onchange="window.assignMiniClass('${cls.id}', '${student}', this.value)" class="text-xs font-bold text-indigo-700 bg-white border border-slate-200 rounded px-2 py-1.5 outline-none focus:border-indigo-500 shadow-sm cursor-pointer">
                                        <option value="">-- Chưa phân lớp --</option>
                                        ${uniqueMinis.map(m => `<option value="${m}" ${myMini === m ? 'selected' : ''}>Lớp: ${m}</option>`).join('')}
                                        <option value="NEW">+ Tạo Mini-class mới...</option>
                                    </select>
                                    <button onclick="window.unenrollStudent('${cls.id}', '${student}')" class="text-rose-400 text-xs font-bold hover:text-white hover:bg-rose-500 px-2 py-1.5 border border-transparent rounded transition">Xóa</button>
                                </div>
                                ` : `<span class="text-xs font-bold bg-indigo-50 text-indigo-600 px-2 py-1 rounded">${myMini || 'Chưa phân lớp'}</span>`}
                            </div>`;
                        }).join('') : '<div class="flex flex-col items-center justify-center p-6 bg-slate-50 rounded-xl border-2 border-dashed border-slate-200 text-center"><p class="text-xs font-bold text-slate-500">No students enrolled</p></div>'}
                    </div>


                    ${isOwner ? `
                    <!-- NEW COLLABORATORS SECTION -->
                    <div class="border-t border-slate-100 pt-6">
                        <h4 class="font-bold text-slate-800 text-lg flex justify-between items-center mb-4">
                            Collaborators 
                            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="text-slate-400 cursor-pointer hover:text-slate-700 transition transform rotate-180"><polyline points="18 15 12 9 6 15"></polyline></svg>
                        </h4>
                        <div class="space-y-4">
                            <div>
                                <div class="text-[11px] font-bold text-slate-500 mb-2">Owner</div>
                                <div class="flex items-center gap-3">
                                    <div class="relative">
                                        <img src="https://ui-avatars.com/api/?name=${cls.owner || 'Teacher'}&background=0f766e&color=fff&bold=true" class="w-8 h-8 rounded-full shadow-sm">
                                        <div class="absolute -bottom-1 -right-1 w-3.5 h-3.5 bg-[#22c55e] border-2 border-white rounded-full"></div>
                                    </div>
                                    <span class="text-sm text-slate-800">${cls.owner || 'Teacher'}</span>
                                </div>
                            </div>
                            
                            ${(cls.collaborators && cls.collaborators.length > 0) ? `
                            <div>
                                <div class="text-[11px] font-bold text-slate-400 uppercase tracking-widest mb-2">Shared With</div>
                                <div class="flex items-center gap-[-8px]">
                                    ${cls.collaborators.slice(0,3).map(collab => `<img src="https://ui-avatars.com/api/?name=${collab}&background=0ea5e9&color=fff&bold=true" class="w-8 h-8 rounded-full border-2 border-white shadow-sm -ml-2 first:ml-0" title="${collab}">`).join('')}
                                    ${cls.collaborators.length > 3 ? `<div class="w-8 h-8 rounded-full border-2 border-white shadow-sm -ml-2 bg-slate-100 flex items-center justify-center text-[10px] font-bold text-slate-500">+${cls.collaborators.length - 3}</div>` : ''}
                                </div>
                            </div>` : ''}

                            <button onclick="window.openClassCollaborators('${cls.id}')" class="mt-2 text-[#2563eb] border border-[#2563eb] hover:bg-blue-50 px-4 py-2 rounded-lg text-sm font-bold transition bg-white w-max">Add Collaborators</button>
                        </div>
                    </div>` : ''}
                </div>
                
                <div class="p-6 bg-white">
                    <h4 class="font-bold text-slate-700 mb-4 border-b border-slate-100 pb-3">${isSmallClass ? 'Shared Learning Materials' : 'Learning Paths'} (${getClassLearningPaths(cls).length || 1})</h4>
                    <div class="space-y-2 max-h-60 overflow-y-auto pr-1">
                        ${(() => {
                            const paths = getClassLearningPaths(cls);
                            if (!paths.length) return '<div class="flex flex-col items-center justify-center p-6 bg-slate-50 rounded-xl border-2 border-dashed border-slate-200 text-center"><svg class="w-8 h-8 text-slate-300 mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path></svg><p class="text-xs font-bold text-slate-500">No materials assigned</p></div>';
                            return paths.map(path => {
                                const items = (path.items || []).slice(0, 3);
                                return `
                                <div class="rounded-xl border border-slate-200 bg-slate-50 p-3">
                                    <div class="flex justify-between items-center gap-2 mb-2">
                                        <span class="font-black text-slate-800 text-sm">${path.title}</span>
                                        <span class="text-[10px] font-bold text-blue-700 bg-blue-100 px-2 py-1 rounded-full">${path.items.length} item(s)</span>
                                    </div>
                                    <div class="space-y-1">
                                        ${items.map(item => {
                                            const t = item.testId ? TEST_BANK.find(x => x.id === item.testId) : null;
                                            return `<div class="text-xs text-slate-600 flex items-center gap-2"><span class="w-2 h-2 rounded-full bg-blue-400"></span>${t ? t.title : (item.title || 'Material')}</div>`;
                                        }).join('')}
                                        ${path.items.length > 3 ? '<div class="text-[10px] text-slate-400 font-semibold mt-1">+ more materials</div>' : ''}
                                    </div>
                                </div>`;
                            }).join('');
                        })()}
                    </div>
                    <div class="mt-4 text-[11px] text-slate-500 italic bg-blue-50 p-3 rounded-xl border border-blue-100 text-center shadow-inner">Each week can now contain a locked sequence of tests with prerequisite checks.</div>
                </div>

                <div class="p-6 bg-slate-50">
                    <h4 class="font-bold text-slate-700 mb-4 border-b border-slate-200 pb-3">Question Heatmap</h4>
                    <div class="space-y-3 max-h-72 overflow-y-auto pr-1">
                        ${(() => {
                            const analytics = getClassAnalyticsSnapshot(cls);
                            if (!analytics.length) {
                                return '<div class="text-xs text-slate-500 bg-white border border-slate-200 rounded-xl p-3 text-center">No scored question analytics yet. Students need to complete at least one reading/listening test.</div>';
                            }
                            return analytics.map(item => {
                                const pctWrong = Math.round(item.incorrectRate * 100);
                                return `<div class="rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
                                    <div class="flex justify-between items-start gap-2 mb-2">
                                        <div>
                                            <div class="font-black text-slate-800 text-sm">${item.label}</div>
                                            <div class="text-[10px] text-slate-500 uppercase tracking-widest mt-1">${item.submissionsCount} submission${item.submissionsCount > 1 ? 's' : ''}</div>
                                        </div>
                                        <div class="text-right">
                                            <div class="text-[11px] font-black text-slate-600">${pctWrong}% wrong</div>
                                            <div class="text-[10px] text-slate-400">~${item.avgTimeMin} min avg</div>
                                        </div>
                                    </div>
                                    <div class="h-2 rounded-full bg-slate-100 overflow-hidden">
                                        <div class="h-2 rounded-full ${item.tone}" style="width:${Math.max(8, Math.min(100, pctWrong + 8))}%"></div>
                                    </div>
                                    <div class="text-[11px] text-slate-500 mt-2">${pctWrong}% of this class missed it, and they spent about ${item.avgTimeMin} minute${item.avgTimeMin > 1 ? 's' : ''} on average.</div>
                                </div>`;
                            }).join('');
                        })()}
                    </div>
                    <h4 class="font-bold text-slate-700 mt-5 mb-4 border-b border-slate-200 pb-3">Recent Submissions (${classSubs.length})</h4>
                    <div class="space-y-3 max-h-60 overflow-y-auto pr-1">
                        ${classSubs.length ? classSubs.map(s => `
                            <div class="text-sm p-3 bg-white rounded-xl shadow-sm border border-slate-200 relative overflow-hidden group">
                                <div class="absolute left-0 top-0 bottom-0 w-1 ${s.score.includes('Band') || s.score.includes('/') ? 'bg-emerald-400' : 'bg-amber-400'}"></div>
                                <div class="flex justify-between font-bold mb-1 pl-2">
                                    <span class="text-slate-800">${s.student}</span>
                                    <span class="${s.score.includes('Band') || s.score.includes('/') ? 'text-emerald-600' : 'text-amber-500'}">${s.score}</span>
                                </div>
                                <div class="flex justify-between items-center pl-2 mt-2 pt-2 border-t border-slate-50">
                                    <span class="text-[11px] text-slate-500 truncate max-w-[120px] font-medium" title="${s.testName}">${s.testName}</span>
                                    <div class="flex gap-1 shrink-0 items-center">
                                        ${s.secureInfractions > 0 ? `<span class="bg-rose-100 text-rose-700 border border-rose-300 text-[9px] font-bold px-1.5 py-0.5 rounded mr-1" title="${s.secureInfractions} Tab Switches Detected">⚠️ ${s.secureInfractions}</span>` : ''}
                                        ${s.studentReply && !s.teacherReadReply ? `<span class="bg-rose-500 text-white text-[9px] font-bold px-1.5 py-0.5 rounded animate-pulse mr-1">New Reply</span>` : ''}
                                        <button onclick="openGradingView(${s.id})" class="text-[10px] bg-slate-50 border border-slate-200 text-slate-700 hover:bg-blue-600 hover:text-white font-bold px-3 py-1.5 rounded-lg transition shadow-sm">Review</button>
                                        <button onclick="window.deleteSubmission(${s.id})" class="text-[10px] bg-rose-50 border border-rose-200 text-rose-600 hover:bg-rose-500 hover:text-white font-bold px-2 py-1.5 rounded-lg transition shadow-sm" title="Delete Submission">Del</button>
                                    </div>
                                </div>
                            </div>
                        `).join('') : '<div class="flex flex-col items-center justify-center p-6 bg-white rounded-xl border-2 border-dashed border-slate-200 text-center shadow-sm"><svg class="w-8 h-8 text-slate-300 mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M5 13l4 4L19 7"></path></svg><p class="text-xs font-bold text-slate-500">No recent activity</p></div>'}
                    </div>
                </div>
                ${progressBoardHtml}
            </div>
        </div>
        </div>`;
      }).join('');
    }


    window.deleteSubmission = function(id) {
        showConfirm("Delete Submission", "Are you sure you want to permanently delete this student's submission?", async () => {
            SUBMISSIONS = SUBMISSIONS.filter(s => s.id !== id);
            await window.fsDeleteDoc(window.fsDoc(window.db, window.fPath('submissions'), String(id)));
            renderClasses(); 
        });
    };

    window.updateClassFee = async function(cid, fee) {
        const cls = CLASSES.find(c => c.id === cid);
        if (getClassParent(cls)) return;
        if(cls) {
            cls.feePerLesson = Number(fee);
            await window.fsSetDoc(window.fsDoc(window.db, window.fPath('classes'), cls.id), cls);
        }
    };

    window.openClassHierarchyEditor = function(cid) {
      const cls = CLASSES.find(candidate => candidate.id === cid);
      if (!cls) return;

      const childClasses = CLASSES.filter(candidate => candidate.parentClassId === cls.id);
      const canBecomeSmallClass = childClasses.length === 0 &&
        (Boolean(cls.parentClassId) || !(cls.enrolledStudents || []).length);
      const eligibleParents = CLASSES.filter(candidate =>
        candidate.id !== cls.id &&
        !candidate.parentClassId &&
        !childClasses.some(child => child.id === candidate.id)
      );
      const currentParentId = cls.parentClassId || '';
      const currentParentIsEligible = eligibleParents.some(parent => parent.id === currentParentId);
      const parentOptions = [
        ...(currentParentId && !currentParentIsEligible
          ? [`<option value="__choose__" selected disabled>Choose a valid parent to repair this hierarchy</option>`]
          : []),
        `<option value="" ${currentParentId ? '' : 'selected'}>Main class (no parent)</option>`,
        ...eligibleParents.map(parent => `<option value="${parent.id}" ${currentParentId === parent.id ? 'selected' : ''}>Small class under: ${parent.name}</option>`)
      ].join('');
      const hierarchyNote = canBecomeSmallClass
        ? 'Choose a main class to make this a small class sharing its materials, or leave it at the top level as a main class.'
        : childClasses.length
          ? 'This class currently contains small classes. Move those small classes first; a class cannot be nested under another class while it has children.'
          : 'This main class has enrolled students. Assign them to a small class first so they keep access to their class materials.';

      document.getElementById('modal-title').textContent = `Edit Hierarchy: ${cls.name}`;
      document.getElementById('modal-message').innerHTML = `
        <p class="mb-3 text-sm text-slate-600">${hierarchyNote}</p>
        <label for="class-parent-select" class="block text-xs font-black uppercase tracking-widest text-slate-500 mb-1">Assign parent class</label>
        <select id="class-parent-select" ${canBecomeSmallClass ? '' : 'disabled'} class="w-full border-2 border-slate-200 p-3 rounded-xl outline-none focus:border-blue-500 font-bold text-blue-900 bg-white disabled:bg-slate-100">
          ${parentOptions}
        </select>
        <p class="mt-3 text-xs text-amber-700 bg-amber-50 border border-amber-100 rounded-lg p-3">Changing the parent changes which learning materials this class inherits. Students and class schedules will stay assigned to this class.</p>`;
      document.getElementById('modal-input').classList.add('hidden');
      document.getElementById('modal-cancel').classList.remove('hidden');
      document.getElementById('modal-confirm').textContent = 'Save Hierarchy';
      document.getElementById('custom-modal').classList.remove('hidden');
      document.getElementById('modal-cancel').onclick = () => {
        document.getElementById('custom-modal').classList.add('hidden');
        document.getElementById('modal-confirm').textContent = 'OK';
      };
      document.getElementById('modal-confirm').onclick = () => window.saveClassHierarchy(cid);
    };

    window.saveClassHierarchy = async function(cid) {
      const cls = CLASSES.find(candidate => candidate.id === cid);
      const select = document.getElementById('class-parent-select');
      if (!cls || !select || select.disabled) return;

      const newParentId = select.value;
      const newParent = newParentId ? CLASSES.find(candidate => candidate.id === newParentId) : null;
      const hasChildren = CLASSES.some(candidate => candidate.parentClassId === cls.id);
      const hasEnrolledStudents = (cls.enrolledStudents || []).length > 0;
      if (newParentId === '__choose__' || (newParentId && (!newParent || newParent.parentClassId)) || (newParentId === cls.id) ||
          (newParentId && hasChildren) || (newParentId && hasEnrolledStudents && !cls.parentClassId)) {
        document.getElementById('modal-confirm').textContent = 'OK';
        showModalMsg("Invalid Hierarchy", "Small classes must belong directly to a main class. Move child classes first and choose a main class as the parent.");
        return;
      }

      if ((cls.parentClassId || '') === newParentId) {
        document.getElementById('custom-modal').classList.add('hidden');
        document.getElementById('modal-confirm').textContent = 'OK';
        return;
      }

      const updatedClass = { ...cls };
      if (newParentId) updatedClass.parentClassId = newParentId;
      else delete updatedClass.parentClassId;

      const button = document.getElementById('modal-confirm');
      button.disabled = true;
      button.textContent = 'Saving...';
      try {
        await window.fsSetDoc(window.fsDoc(window.db, window.fPath('classes'), updatedClass.id), updatedClass);
        const classIndex = CLASSES.findIndex(candidate => candidate.id === updatedClass.id);
        if (classIndex >= 0) CLASSES[classIndex] = updatedClass;
        document.getElementById('custom-modal').classList.add('hidden');
        renderClasses();
        if (typeof window.renderTimetable === 'function') window.renderTimetable();
        if (typeof window.showToast === 'function') {
          window.showToast("Hierarchy Updated", newParent
            ? `${updatedClass.name} now belongs to ${newParent.name}.`
            : `${updatedClass.name} is now a main class.`);
        }
      } catch (error) {
        console.error(`Unable to update hierarchy for class ${cid}:`, error);
        showModalMsg("Error", "Could not save this hierarchy change. Please check your connection and try again.");
      } finally {
        button.disabled = false;
        button.textContent = 'OK';
      }
    };

    window.toggleClassLearningPath = async function(cid) {
      const cls = CLASSES.find(c => c.id === cid);
      if (!cls) return;
      cls.learningPathEnabled = cls.learningPathEnabled !== false ? false : true;
      await window.fsSetDoc(window.fsDoc(window.db, window.fPath('classes'), cls.id), cls);
      renderClasses();
    };

    window.toggleClassBooking = async function(cid) {
      const cls = CLASSES.find(c => c.id === cid);
      if (!cls) return;
      if (window.isTemplateClass(cls)) {
        showModalMsg("Small Class Required", "Manual booking must be enabled on a small class.");
        return;
      }
      cls.allowBooking = cls.allowBooking ? false : true;
      await window.fsSetDoc(window.fsDoc(window.db, window.fPath('classes'), cls.id), cls);
      renderClasses();
    };

    function promptCreateClass() { 
      showInputPrompt("New Class", "Name:", async (name) => { 
        const newCls = {
          id:'c_'+Date.now(),
          name,
          assignedTests:[],
          enrolledStudents:[],
          feePerLesson: BILLING_SETTINGS.feePerLesson || 100000,
          meetLink: '',
          learningPathEnabled: false,
          allowBooking: false,
          owner: currentUser.user,
          collaborators: []
        };
        CLASSES.push(newCls); 
        await window.fsSetDoc(window.fsDoc(window.db, window.fPath('classes'), newCls.id), newCls);
        renderClasses(); 
      }); 
    }

    window.promptCreateChildClass = function(parentId) {
      const parent = CLASSES.find(cls => cls.id === parentId);
      if (!parent) return;

      showInputPrompt("Create Small Class", `Name for the small class using "${parent.name}" materials:`, async name => {
        const childName = String(name || '').trim();
        if (!childName) return;
        if (CLASSES.some(cls => cls.name.toLowerCase() === childName.toLowerCase())) {
          showModalMsg("Duplicate Class", "A class with this name already exists.");
          return;
        }

        const isFirstChild = !CLASSES.some(cls => cls.parentClassId === parent.id);
        const studentsToMove = isFirstChild ? [...(parent.enrolledStudents || [])] : [];
        const originalParent = JSON.parse(JSON.stringify(parent));
        const child = {
          id: 'c_' + Date.now(),
          name: childName,
          parentClassId: parent.id,
          assignedTests: [],
          learningPaths: [],
          testSettings: isFirstChild ? JSON.parse(JSON.stringify(parent.testSettings || {})) : {},
          enrolledStudents: studentsToMove,
          feePerLesson: parent.feePerLesson || BILLING_SETTINGS.feePerLesson || 100000,
          meetLink: parent.meetLink || '',
          learningPathEnabled: parent.learningPathEnabled !== false,
          allowBooking: false,
          owner: parent.owner || currentUser.user,
          collaborators: [...(parent.collaborators || [])]
        };

        const schedulesToMove = isFirstChild ? SCHEDULES.filter(schedule => window.scheduleBelongsToClass(schedule, parent)) : [];
        let childCreated = false;
        try {
          await window.fsSetDoc(window.fsDoc(window.db, window.fPath('classes'), child.id), child);
          childCreated = true;
          CLASSES.push(child);

          if (childCreated && isFirstChild) {
            for (const schedule of schedulesToMove) {
              const movedSchedule = { ...schedule, classId: child.id, className: child.name };
              await window.fsSetDoc(window.fsDoc(window.db, window.fPath('schedules'), movedSchedule.id), movedSchedule);
              SCHEDULES = SCHEDULES.map(item => item.id === movedSchedule.id ? movedSchedule : item);
            }
            parent.isTemplate = true;
            parent.enrolledStudents = [];
            await window.fsSetDoc(window.fsDoc(window.db, window.fPath('classes'), parent.id), parent);
          }

          renderClasses();
          if (typeof window.renderTimetable === 'function') window.renderTimetable();
          if (typeof window.showToast === 'function') {
            window.showToast("Small Class Created", isFirstChild && studentsToMove.length
              ? `${studentsToMove.length} existing student(s) and ${schedulesToMove.length} schedule(s) were moved into the new small class.`
              : `The small class now inherits materials from ${parent.name}.`);
          }
        } catch (error) {
          console.error('Unable to create small class:', error);
          let rollbackFailed = false;
          if (isFirstChild) {
            Object.assign(parent, originalParent);
            try {
              await window.fsSetDoc(window.fsDoc(window.db, window.fPath('classes'), parent.id), originalParent);
            } catch (rollbackError) {
              rollbackFailed = true;
              console.error('Unable to restore the original class after child creation failed:', rollbackError);
            }
            for (const schedule of schedulesToMove) {
              try {
                await window.fsSetDoc(window.fsDoc(window.db, window.fPath('schedules'), schedule.id), schedule);
              } catch (rollbackError) {
                rollbackFailed = true;
                console.error(`Unable to restore schedule "${schedule.id}" after child creation failed:`, rollbackError);
              }
            }
          }
          if (childCreated) {
            try {
              await window.fsDeleteDoc(window.fsDoc(window.db, window.fPath('classes'), child.id));
            } catch (rollbackError) {
              rollbackFailed = true;
              console.error('Unable to remove the incomplete small class:', rollbackError);
            }
          }
          CLASSES = CLASSES.filter(cls => cls.id !== child.id);
          if (childCreated && isFirstChild) {
            SCHEDULES = SCHEDULES.map(item => schedulesToMove.find(schedule => schedule.id === item.id) || item);
          }
          renderClasses();
          if (rollbackFailed) {
            showModalMsg("Error", "Small class creation failed, and some changes could not be rolled back. Please check the class roster and schedules before retrying.");
          } else {
            showModalMsg("Error", "Could not create the small class. Existing class and schedule data were restored.");
          }
        }
      });
    };

    // ✨ COLLABORATORS MODAL LOGIC
    window.currentCollabClassId = null;

    window.openClassCollaborators = function(cid) {
        window.currentCollabClassId = cid;
        const cls = CLASSES.find(c => c.id === cid);
        if (!cls) return;

        document.getElementById('collab-modal-subtitle').textContent = `Manage who can access and edit "${cls.name}".`;
        
        // Auto-populate the select dropdown with valid users
        const selectEl = document.getElementById('collab-input');
        const availableCollabs = USERS.filter(u => 
            (u.role === 'collaborator' || u.role === 'teacher') && 
            u.user !== cls.owner && 
            !(cls.collaborators || []).includes(u.user)
        );
        
        if (availableCollabs.length > 0) {
            selectEl.innerHTML = '<option value="">-- Select a collaborator --</option>' + availableCollabs.map(u => `<option value="${u.user}">${u.user} (${u.role})</option>`).join('');
            document.getElementById('btn-add-collab').disabled = false;
            document.getElementById('btn-add-collab').classList.remove('opacity-50', 'cursor-not-allowed');
        } else {
            selectEl.innerHTML = '<option value="">No available collaborators</option>';
            document.getElementById('btn-add-collab').disabled = true;
            document.getElementById('btn-add-collab').classList.add('opacity-50', 'cursor-not-allowed');
        }
        
        window.renderCollabModalList();
        document.getElementById('class-collaborators-modal').classList.remove('hidden');
    };

    window.renderCollabModalList = function() {
        const cls = CLASSES.find(c => c.id === window.currentCollabClassId);
        if (!cls) return;

        const listEl = document.getElementById('collab-list');
        const getSafeEmail = (u) => `${encodeURIComponent(u).replace(/%/g, '').toLowerCase()}@khanhlms.com`;
        
        let html = (cls.collaborators || []).map(collab => `
            <div class="flex justify-between items-center py-3 border-b border-slate-100 last:border-0">
                <div class="flex items-center gap-3">
                    <img src="https://ui-avatars.com/api/?name=${collab}&background=0ea5e9&color=fff&bold=true" class="w-10 h-10 rounded-full border border-slate-200">
                    <div class="flex flex-col">
                        <span class="font-bold text-sm text-slate-800">${collab}</span>
                        <span class="text-[11px] text-slate-500">${getSafeEmail(collab)}</span>
                    </div>
                </div>
                <div class="flex items-center gap-3">
                    <span class="text-sm font-bold text-slate-600">Editor</span>
                    <button onclick="window.removeClassCollaborator('${collab}')" class="text-slate-400 hover:text-rose-500 transition font-bold text-xl">&times;</button>
                </div>
            </div>
        `).join('');

        // Render Owner at the bottom
        html += `
            <div class="flex justify-between items-center py-3 border-b border-slate-100 last:border-0 ${cls.collaborators?.length ? 'mt-2' : ''}">
                <div class="flex items-center gap-3">
                    <img src="https://ui-avatars.com/api/?name=${cls.owner || 'Teacher'}&background=0f766e&color=fff&bold=true" class="w-10 h-10 rounded-full border border-slate-200">
                    <div class="flex flex-col">
                        <span class="font-bold text-sm text-slate-800">${cls.owner || 'Teacher'}</span>
                        <span class="text-[11px] text-slate-500">${getSafeEmail(cls.owner || 'Teacher')}</span>
                    </div>
                </div>
                <span class="text-sm font-bold text-slate-500 px-3 py-1">Owner</span>
            </div>
        `;
        
        listEl.innerHTML = `<div class="mt-4 border-t border-slate-100 pt-2">${html}</div>`;
    };

    window.addClassCollaborator = async function() {
        const input = document.getElementById('collab-input').value.trim();
        if (!input) return;

        const cls = CLASSES.find(c => c.id === window.currentCollabClassId);
        if (!cls) return;

        if (!cls.collaborators) cls.collaborators = [];
        if (cls.collaborators.includes(input)) return;

        const btn = document.getElementById('btn-add-collab');
        btn.textContent = 'Adding...'; btn.disabled = true;

        cls.collaborators.push(input);
        try {
            await window.fsSetDoc(window.fsDoc(window.db, window.fPath('classes'), cls.id), cls);
            window.openClassCollaborators(cls.id); // Refresh dropdown and list instantly
            renderClasses(); 
        } catch(e) {
            console.error(e);
            showModalMsg("Error", "Could not save collaborator to cloud.");
            cls.collaborators.pop();
        }
        btn.textContent = 'Add collaborator'; btn.disabled = false;
    };

    window.removeClassCollaborator = async function(username) {
        const cls = CLASSES.find(c => c.id === window.currentCollabClassId);
        if (!cls) return;

        const updatedClass = { ...cls, collaborators: (cls.collaborators || []).filter(c => c !== username) };
        try {
            await window.fsSetDoc(window.fsDoc(window.db, window.fPath('classes'), cls.id), updatedClass);
            const classIndex = CLASSES.findIndex(item => item.id === cls.id);
            if (classIndex >= 0) CLASSES[classIndex] = updatedClass;
            window.openClassCollaborators(cls.id); // Refresh dropdown and list instantly
            renderClasses();
        } catch(e) {
            console.error(e);
            showModalMsg("Error", "Could not remove collaborator.");
        }
    };
    
    async function deleteClass(id) {
      const childClasses = CLASSES.filter(cls => cls.parentClassId === id);
      if (childClasses.length) {
        showModalMsg("Delete Small Classes First", "This class is a material template. Delete or move its small classes before removing the template.");
        return;
      }
      const clsToDelete = CLASSES.find(cls => cls.id === id);
      const parent = getClassParent(clsToDelete);
      CLASSES = CLASSES.filter(c => c.id !== id); 
      await window.fsDeleteDoc(window.fsDoc(window.db, window.fPath('classes'), id));
      if (parent && !CLASSES.some(cls => cls.parentClassId === parent.id)) {
        parent.isTemplate = false;
        await window.fsSetDoc(window.fsDoc(window.db, window.fPath('classes'), parent.id), parent);
      }
      renderClasses(); 
    }

    window.promptEnrollStudent = function(cid) {
        const cls = CLASSES.find(c => c.id === cid);
        if (!cls) return;
        if (window.isTemplateClass(cls)) {
            showModalMsg("Small Class Required", "Enroll students into a small class, not its material template.");
            return;
        }
        const availableStudents = USERS.filter(u => u.role === 'student' && !(cls.enrolledStudents || []).includes(u.user));
        
        if(availableStudents.length === 0) {
            showModalMsg("No Students", "All available students are already enrolled in this class.");
            return;
        }
        
        const opts = availableStudents.map(u =>
            `<option value="${escapeHtmlAttributeValue(u.user)}">${escapeHtmlAttributeValue(getStudentDisplayName(u))}</option>`
        ).join('');
        document.getElementById('modal-title').textContent = `Assign User to: ${cls.name}`;
        document.getElementById('modal-message').innerHTML = `<p class="mb-2 text-sm text-slate-500">Select a student from the system to grant them access to this class.</p><select id="enroll-student-select" class="w-full border-2 p-2 rounded outline-none focus:border-blue-500 font-bold text-blue-800 bg-slate-50">${opts}</select>`;
        
        document.getElementById('modal-input').classList.add('hidden');
        document.getElementById('modal-cancel').classList.remove('hidden');
        document.getElementById('custom-modal').classList.remove('hidden');
        
        document.getElementById('modal-cancel').onclick = () => document.getElementById('custom-modal').classList.add('hidden');
        
        document.getElementById('modal-confirm').onclick = async () => {
            const sName = document.getElementById('enroll-student-select').value;
            if(!cls.enrolledStudents) cls.enrolledStudents = [];
            cls.enrolledStudents.push(sName);
            await window.fsSetDoc(window.fsDoc(window.db, window.fPath('classes'), cls.id), cls);
            document.getElementById('custom-modal').classList.add('hidden');
            renderClasses();
        };
    }

        window.assignMiniClass = async function(cid, student, val) {
        const cls = CLASSES.find(c => c.id === cid);
        if (!cls) return;
        if (!cls.miniClasses) cls.miniClasses = {};
        
        if (val === 'NEW') {
            const newName = prompt("Nhập tên Lớp Nhỏ mới (VD: B2.1):");
            if (newName && newName.trim()) {
                cls.miniClasses[student] = newName.trim();
            } else {
                return renderClasses(); // Hủy bỏ
            }
        } else if (val === '') {
            delete cls.miniClasses[student];
        } else {
            cls.miniClasses[student] = val;
        }
        
        try {
            await window.fsSetDoc(window.fsDoc(window.db, window.fPath('classes'), cls.id), cls);
            if(typeof window.showToast === 'function') window.showToast("Đã phân lớp", `Học viên ${getStudentDisplayName(student)} đã được chuyển lớp.`);
            renderClasses();
        } catch(e) {
            console.error(e);
            alert("Lỗi khi lưu dữ liệu lên Cloud.");
        }
    };


    window.unenrollStudent = async function(cid, student) {
        const cls = CLASSES.find(c => c.id === cid);
        if(!cls) return;
        const studentName = getStudentDisplayName(student);
        showConfirm("Remove Student", `Remove ${studentName} from ${cls.name}?`, async () => {
            const updatedClass = { ...cls };
            updatedClass.enrolledStudents = (cls.enrolledStudents || []).filter(name => name !== student);
            if (updatedClass.miniClasses) {
                updatedClass.miniClasses = { ...updatedClass.miniClasses };
                delete updatedClass.miniClasses[student];
            }
            try {
                await window.fsSetDoc(window.fsDoc(window.db, window.fPath('classes'), cls.id), updatedClass);
                const classIndex = CLASSES.findIndex(item => item.id === cls.id);
                if (classIndex >= 0) CLASSES[classIndex] = updatedClass;
                renderClasses();
                window.showToast?.("Student Removed", `${studentName} has been removed from ${cls.name}.`);
            } catch (error) {
                console.error(`Could not remove ${student} from class ${cls.id}:`, error);
                showModalMsg("Error", `Could not remove ${student} from this class. Check Firestore permissions and try again.`);
            }
        });
    }

      window.openTeacherVocabModal = function() {
      if(!APP_DATA.vocab) APP_DATA.vocab = [];
      
      const partSel = document.getElementById('tv-part-select');
      if (partSel && APP_DATA.parts) {
          partSel.innerHTML = APP_DATA.parts.map((p, i) => `<option value="${p.title || 'Part '+(i+1)}">${p.title || 'Part '+(i+1)}</option>`).join('');
          if (APP_DATA.parts[currentEditorPartIdx]) {
              partSel.value = APP_DATA.parts[currentEditorPartIdx].title || `Part ${currentEditorPartIdx+1}`;
          }
      }

      document.getElementById('teacher-vocab-modal').classList.remove('hidden');
      renderTeacherVocab();
    }

    function closeTeacherVocabModal() { document.getElementById('teacher-vocab-modal').classList.add('hidden'); }
    
    function renderTeacherVocab() {
      const list = document.getElementById('tv-list');
      list.innerHTML = APP_DATA.vocab.length ? APP_DATA.vocab.map((v, i) => `
        <div class="bg-white p-3 rounded border border-slate-200 flex justify-between items-start">
          <div class="flex-1 pr-2">
              <div class="flex items-center gap-2 mb-1">
                  <strong class="text-blue-700">${v.term}</strong> 
                  ${v.lvl ? `<span class="bg-indigo-100 text-indigo-700 text-[9px] px-1.5 py-0.5 rounded font-bold">${v.lvl}</span>` : ''}
                  <span class="text-xs text-slate-500 font-mono">${v.pron||''}</span>
                  <span class="bg-amber-100 text-amber-800 text-[9px] px-1.5 py-0.5 rounded font-bold">${v.part || 'Global'}</span>
              </div>
              <div class="text-xs text-slate-600 mb-1 font-medium">${v.eng||''}${v.eng&&v.vi?' | ':''}${v.vi||''}</div>
              <div class="text-[10px] text-slate-400 font-medium space-x-2">
                  ${v.syn ? `<span title="Synonyms">🔄 ${v.syn}</span>` : ''}
                  ${v.ant ? `<span title="Antonyms">↔️ ${v.ant}</span>` : ''}
                  ${v.pref ? `<span title="Prefix">⏮️ ${v.pref}</span>` : ''}
                  ${v.suf ? `<span title="Suffix">⏭️ ${v.suf}</span>` : ''}
              </div>
          </div>
          <button onclick="APP_DATA.vocab.splice(${i},1); renderTeacherVocab(); triggerEditorAutosave();" class="text-rose-500 text-xs font-bold px-2 py-1 hover:bg-rose-50 rounded shrink-0">Delete</button>
        </div>`).join('') : '<div class="text-xs text-slate-400 italic">No words added yet.</div>';
    }
    function addTeacherVocab() {
      const term = document.getElementById('tv-term').value.trim();
      if(!term) return;
      APP_DATA.vocab.push({ 
          term, 
          part: document.getElementById('tv-part-select').value, // <-- ADD THIS
          pron: document.getElementById('tv-pron').value.trim(), 
          eng: document.getElementById('tv-eng').value.trim(), 
          vi: document.getElementById('tv-vi').value.trim(),
          syn: document.getElementById('tv-syn').value.trim(),
          ant: document.getElementById('tv-ant').value.trim(),
          pref: document.getElementById('tv-pref').value.trim(),
          suf: document.getElementById('tv-suf').value.trim(),
          lvl: document.getElementById('tv-lvl').value.trim()
      });
      ['tv-term','tv-pron','tv-eng','tv-vi','tv-syn','tv-ant','tv-pref','tv-suf','tv-lvl'].forEach(id => document.getElementById(id).value = '');
      renderTeacherVocab();
      triggerEditorAutosave();
    }

    window.openTeacherGrammarModal = function() {
      if(!APP_DATA.grammar) APP_DATA.grammar = [];
      document.getElementById('teacher-grammar-modal').classList.remove('hidden');
      renderTeacherGrammar();
    }

    window.closeTeacherGrammarModal = function() { 
      document.getElementById('teacher-grammar-modal').classList.add('hidden'); 
    }

    function renderTeacherGrammar() {
      const list = document.getElementById('tg-list');
      list.innerHTML = APP_DATA.grammar.length ? APP_DATA.grammar.map((g, i) => `
        <div class="bg-white p-3 rounded border border-slate-200 flex justify-between items-start">
          <div class="flex-1 pr-2">
              <div class="flex items-center gap-2 mb-1 flex-wrap">
                  <strong class="text-emerald-700">${g.term}</strong> 
                  <span class="bg-emerald-100 text-emerald-800 text-[9px] px-1.5 py-0.5 rounded font-bold">${g.type || 'Grammar'}</span>
              </div>
              <div class="text-xs text-slate-600 font-medium leading-snug whitespace-pre-wrap">${g.expl||''}</div>
          </div>
          <button onclick="APP_DATA.grammar.splice(${i},1); renderTeacherGrammar(); triggerEditorAutosave();" class="text-rose-500 text-xs font-bold px-2 py-1 hover:bg-rose-50 rounded shrink-0">Delete</button>
        </div>`).join('') : '<div class="text-xs text-slate-400 italic">No grammar points added yet.</div>';
    }

    window.addTeacherGrammar = function() {
      const term = document.getElementById('tg-term').value.trim();
      if(!term) return;
      APP_DATA.grammar.push({ 
          term, 
          type: document.getElementById('tg-type').value.trim(), 
          expl: document.getElementById('tg-expl').value.trim()
      });
      ['tg-term','tg-type','tg-expl'].forEach(id => document.getElementById(id).value = '');
      renderTeacherGrammar();
      triggerEditorAutosave();
    }
