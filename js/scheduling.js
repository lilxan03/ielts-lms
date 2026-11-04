    window.promptCreateScheduleLegacy = function(dateStr) {
        let defaultDate = dateStr || window.currentSelectedDate;
        if (!defaultDate) {
            const d = new Date();
            defaultDate = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
        }
        
        let materialOptions = '<option value="">-- No Lesson Attached --</option>';
        TEST_BANK.forEach(t => {
            const icon = t.module === 'reading' ? '📖' : t.module === 'listening' ? '🎧' : t.module === 'writing' ? '✍️' : '🗣️';
            materialOptions += `<option value="${t.id}">${icon} ${t.title}</option>`;
        });

        let classOptions = '';
        CLASSES.forEach(c => {
            classOptions += `<option value="${c.name}">${c.name}</option>`;
        });

        if (!classOptions) {
            if(typeof window.showToast === 'function') window.showToast("Notice", "Please create a Class first.", "info");
            return;
        }

        const html = `
            <div class="space-y-3 text-left">
                <div><label class="block text-xs font-bold text-slate-500 mb-1">Date</label><input type="date" id="sched-date" class="w-full border border-slate-300 p-2.5 rounded-lg outline-none focus:border-blue-500 bg-slate-50" value="${defaultDate}"></div>
                <div><label class="block text-xs font-bold text-slate-500 mb-1">Class Name</label><select id="sched-class" class="w-full border border-slate-300 p-2.5 rounded-lg outline-none focus:border-blue-500 font-bold text-blue-900 bg-white shadow-sm cursor-pointer">${classOptions}</select></div>
                <div><label class="block text-xs font-bold text-slate-500 mb-1">Time</label><input type="time" id="sched-time" class="w-full border border-slate-300 p-2.5 rounded-lg outline-none focus:border-blue-500 bg-white shadow-sm"></div>
                <div><label class="block text-xs font-bold text-slate-500 mb-1">Topic</label><input type="text" id="sched-topic" class="w-full border border-slate-300 p-2.5 rounded-lg outline-none focus:border-blue-500 bg-white shadow-sm" placeholder="e.g. Reading Practice"></div>
                <div><label class="block text-xs font-bold text-slate-500 mb-1">Live Video Link (Optional)</label><input type="text" id="sched-link" class="w-full border border-slate-300 p-2.5 rounded-lg outline-none focus:border-blue-500 text-blue-600 bg-white shadow-sm font-mono text-sm" placeholder="https://zoom.us/..."></div>
                <div class="pt-3 border-t border-slate-100">
                    <label class="block text-xs font-bold text-emerald-600 mb-1 uppercase tracking-widest flex items-center gap-1">📚 Assign Lesson Material</label>
                    <select id="sched-material" class="w-full border border-emerald-200 bg-emerald-50 text-emerald-900 p-2.5 rounded-lg outline-none focus:border-emerald-500 font-bold shadow-sm cursor-pointer">${materialOptions}</select>
                </div>
            </div>
        `;
        showConfirm("Schedule Class", html, async () => {
            const date = document.getElementById('sched-date').value;
            const className = document.getElementById('sched-class').value;
            const time = document.getElementById('sched-time').value;
            const topic = document.getElementById('sched-topic').value.trim();
            const link = document.getElementById('sched-link').value.trim();
            const matId = document.getElementById('sched-material').value;
            
            if (!date || !className || !time) {
                if(typeof window.showToast === 'function') window.showToast("Error", "Date, Class, and Time are required.", "error");
                return;
            }

            const schedule = {
                id: 'sched_' + Date.now(),
                date,
                className,
                time,
                topic,
                link,
                materialIds: matId ? [matId] : [],
                createdAt: Date.now()
            };

            try {
                await window.fsSetDoc(window.fsDoc(window.db, window.fPath('schedules'), schedule.id), schedule);
                window.renderTeacherSelectedDate(date);
                window.renderCalendar('teacher');
                if(typeof window.showToast === 'function') window.showToast("Saved", "Class scheduled successfully.");
            } catch (e) {
                console.error(e);
            }
        });
    };

    // ✨ Overhauled Edit Schedule Modal (Includes Native Lesson Attacher)
    window.editSchedule = function(id) {
        const schedule = SCHEDULES.find(s => s.id === id);
        if (!schedule) return;

        let materialOptions = '<option value="">-- No Lesson Attached --</option>';
        TEST_BANK.forEach(t => {
            const icon = t.module === 'reading' ? '📖' : t.module === 'listening' ? '🎧' : t.module === 'writing' ? '✍️' : '🗣️';
            const selected = (schedule.materialIds && schedule.materialIds.includes(t.id)) ? 'selected' : '';
            materialOptions += `<option value="${t.id}" ${selected}>${icon} ${t.title}</option>`;
        });

        const html = `
            <div class="space-y-3 text-left">
                <div><label class="block text-xs font-bold text-slate-500 mb-1">Class Name</label><input type="text" id="sched-class" class="w-full border border-slate-300 p-2.5 rounded-lg outline-none focus:border-blue-500 font-bold text-blue-900 bg-white shadow-sm" value="${schedule.className || ''}"></div>
                <div><label class="block text-xs font-bold text-slate-500 mb-1">Time</label><input type="time" id="sched-time" class="w-full border border-slate-300 p-2.5 rounded-lg outline-none focus:border-blue-500 bg-white shadow-sm" value="${schedule.time || ''}"></div>
                <div><label class="block text-xs font-bold text-slate-500 mb-1">Topic</label><input type="text" id="sched-topic" class="w-full border border-slate-300 p-2.5 rounded-lg outline-none focus:border-blue-500 bg-white shadow-sm" value="${schedule.topic || ''}"></div>
                <div><label class="block text-xs font-bold text-slate-500 mb-1">Live Video Link</label><input type="text" id="sched-link" class="w-full border border-slate-300 p-2.5 rounded-lg outline-none focus:border-blue-500 text-blue-600 bg-white shadow-sm font-mono text-sm" value="${schedule.link || ''}"></div>
                <div class="pt-3 border-t border-slate-100">
                    <label class="block text-xs font-bold text-emerald-600 mb-1 uppercase tracking-widest flex items-center gap-1">📚 Assign Lesson Material</label>
                    <select id="sched-material" class="w-full border border-emerald-200 bg-emerald-50 text-emerald-900 p-2.5 rounded-lg outline-none focus:border-emerald-500 font-bold shadow-sm cursor-pointer">${materialOptions}</select>
                </div>
            </div>
        `;
        showConfirm("Edit Schedule", html, async () => {
            schedule.className = document.getElementById('sched-class').value.trim();
            schedule.time = document.getElementById('sched-time').value;
            schedule.topic = document.getElementById('sched-topic').value.trim();
            schedule.link = document.getElementById('sched-link').value.trim();
            
            const matId = document.getElementById('sched-material').value;
            schedule.materialIds = matId ? [matId] : []; // Overwrite existing with single selection

            try {
                await window.fsSetDoc(window.fsDoc(window.db, window.fPath('schedules'), schedule.id), schedule);
                window.renderTeacherSelectedDate(schedule.date);
                window.renderCalendar('teacher');
                if(typeof window.showToast === 'function') window.showToast("Saved", "Schedule updated successfully.");
            } catch (e) {
                console.error(e);
            }
        });
    };

    window.promptAttachTestToSchedule = function(scheduleId) {
        // Fallback specifically for the "+ Attach" text button on the card, reusing the edit UI.
        window.editSchedule(scheduleId);
    };

    window.removeMaterialFromSchedule = async function(scheduleId, testId, event) {
        if (event) event.stopPropagation();
        const schedule = SCHEDULES.find(s => s.id === scheduleId);
        if (schedule && schedule.materialIds) {
            schedule.materialIds = schedule.materialIds.filter(id => id !== testId);
            try {
                await window.fsSetDoc(window.fsDoc(window.db, window.fPath('schedules'), schedule.id), schedule);
                if(typeof window.showToast === 'function') window.showToast("Removed", "Material unlinked from schedule.");
            } catch (e) {
                console.error(e);
            }
        }
    };

    window.launchScheduledTest = function(testId) {
        const test = TEST_BANK.find(t => t.id === testId);
        if (!test) {
            if(typeof window.showToast === 'function') window.showToast("Error", "Test not found or deleted.", "error");
            return;
        }

        if (currentUser.role === 'teacher') {
            // Close modal if open, send teacher to builder
            const m = document.getElementById('student-day-modal');
            if (m) m.classList.add('hidden');
            
            window.editTest(testId); 
            window.toggleDashboardView('tests');
        } else {
            if (currentUser.role !== 'student' || !studentCanOpenTestRoute(testId)) {
                if (typeof window.showToast === 'function') window.showToast("Access denied", "This test is not assigned to your class or schedule.", "error");
                return;
            }

            const m = document.getElementById('student-day-modal');
            if (m) m.classList.add('hidden');
            openModeSelection(testId);
        }
    };

    // ✨ OVERRIDE: Teacher Schedule Rendering
    window.renderTeacherSelectedDate = function(dateStr) {
        window.currentSelectedDate = dateStr;
        const list = document.getElementById('timetable-list');
        const label = document.getElementById('teacher-selected-date-label');
        if (!list || !label) return;

        const dParts = dateStr.split('-');
        const dateObj = new Date(dParts[0], dParts[1] - 1, dParts[2]);
        const dayNames = ['Chủ Nhật', 'Thứ Hai', 'Thứ Ba', 'Thứ Tư', 'Thứ Năm', 'Thứ Sáu', 'Thứ Bảy'];
        label.textContent = `${dayNames[dateObj.getDay()]}, ${dateObj.getDate()} tháng ${dateObj.getMonth() + 1}, ${dateObj.getFullYear()}`;

        let html = `<button onclick="window.promptCreateSchedule('${dateStr}')" class="w-full bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 font-bold py-3 rounded-xl mb-4 transition shadow-sm">+ Add Lesson on this Day</button>`;

        const daySchedules = SCHEDULES.filter(s => s.date === dateStr).sort((a, b) => a.time.localeCompare(b.time));

        if (daySchedules.length === 0) {
            html += `<div class="text-center text-slate-400 text-sm italic mt-8">No classes scheduled.</div>`;
        } else {
            daySchedules.forEach(s => {
                
                // ✨ 1. Build the direct Enter buttons (No "Materials Attached" text!)
                let lessonButtons = '';
                const lessonTestIds = [...new Set([...(s.assignedTests || []), ...(s.materialIds || [])])];
                if (lessonTestIds.length > 0) {
                    lessonButtons = lessonTestIds.map(tId => {
                        const test = TEST_BANK.find(t => t.id === tId);
                        if (!test) return '';
                        const icon = test.module === 'reading' ? '📖' : test.module === 'listening' ? '🎧' : test.module === 'writing' ? '✍️' : '🗣️';
                        
                        return `
                        <div class="flex items-center gap-1.5 w-full mb-2">
                            <button onclick="window.launchScheduledTest('${tId}')" class="flex-1 bg-blue-50 hover:bg-blue-100 border border-blue-200 text-blue-800 font-bold py-2.5 px-4 rounded-lg text-sm transition shadow-sm flex items-center justify-between group">
                                <span class="flex items-center gap-2 truncate"><span>${icon}</span> <span class="truncate">${test.title}</span></span>
                                <span class="shrink-0 group-hover:translate-x-1 transition-transform">Enter &rarr;</span>
                            </button>
                            <button onclick="window.removeMaterialFromSchedule('${s.id}', '${tId}', event)" class="w-10 h-10 shrink-0 flex items-center justify-center bg-rose-50 hover:bg-rose-500 text-rose-500 hover:text-white rounded-lg transition border border-rose-100" title="Unlink Lesson">&times;</button>
                        </div>`;
                    }).join('');
                } else {
                    // Empty state button
                    lessonButtons = `<button onclick="window.editSchedule('${s.id}')" class="w-full mb-2 bg-slate-50 hover:bg-white border border-dashed border-slate-300 hover:border-blue-400 text-slate-500 hover:text-blue-600 font-bold py-2.5 rounded-lg text-center text-sm transition shadow-sm">+ Attach Lesson</button>`;
                }

                // ✨ 2. Inject the buttons directly above the Video/Attendance actions
                html += `
                <div class="bg-white border border-slate-200 rounded-xl p-4 shadow-sm mb-3">
                    <div class="flex justify-between items-start mb-2">
                        <h4 class="font-black text-blue-900 text-lg">${s.className}</h4>
                        <div class="flex gap-1">
                            <button onclick="window.editSchedule('${s.id}')" class="bg-slate-50 hover:bg-slate-100 text-slate-600 px-2 py-1 rounded text-xs font-bold transition">Edit</button>
                            <button onclick="window.deleteSchedule('${s.id}')" class="bg-rose-50 hover:bg-rose-100 text-rose-600 px-2 py-1 rounded text-xs font-bold transition">Del</button>
                        </div>
                    </div>
                    <div class="inline-block bg-amber-100 text-amber-800 px-2 py-0.5 rounded text-xs font-bold mb-3">${s.time}</div>
                    ${s.topic ? `<div class="text-sm font-medium text-slate-700 mb-3">Topic: ${s.topic}</div>` : ''}
                    
                    <div class="flex flex-col">
                        ${lessonButtons}
                        ${s.link ? `<a href="${s.link}" target="_blank" class="w-full mb-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-bold py-2.5 rounded-lg text-center text-sm transition border border-indigo-100 flex items-center justify-center gap-2">🎥 Join Live Video Class</a>` : ''}
                        <button onclick="window.openAttendanceModal('${s.id}', '${s.className}', '${s.date}')" class="w-full bg-slate-50 hover:bg-slate-100 text-slate-700 font-bold py-2.5 rounded-lg text-center text-sm transition border border-slate-200">Mark Attendance</button>
                    </div>
                </div>`;
            });
        }
        list.innerHTML = html;
    };

    // ✨ OVERRIDE: Student Schedule Rendering
    window.openStudentDayModal = function(dateStr) {
        const modal = document.getElementById('student-day-modal');
        const content = document.getElementById('day-modal-content');
        const title = document.getElementById('day-modal-title');
        if (!modal || !content || !title) return;

        const dParts = dateStr.split('-');
        const dateObj = new Date(dParts[0], dParts[1] - 1, dParts[2]);
        const dayNames = ['Chủ Nhật', 'Thứ Hai', 'Thứ Ba', 'Thứ Tư', 'Thứ Năm', 'Thứ Sáu', 'Thứ Bảy'];
        title.textContent = `${dayNames[dateObj.getDay()]}, ${dateObj.getDate()} tháng ${dateObj.getMonth() + 1}, ${dateObj.getFullYear()}`;

        const selectedClassId = document.getElementById('student-class-select')?.value;
        const selectedClass = CLASSES.find(c => c.id === selectedClassId);
        const daySchedules = SCHEDULES
            .filter(s => s.date === dateStr && selectedClass && window.scheduleBelongsToClass(s, selectedClass) && (!s.attendingStudents || s.attendingStudents.includes(currentUser.user)))
            .sort((a, b) => a.time.localeCompare(b.time));

        let html = '';
        if (daySchedules.length === 0) {
            html = `<div class="text-center text-slate-400 text-sm italic mt-4">You have no classes scheduled for this day.</div>`;
        } else {
            daySchedules.forEach(s => {
                let materialHtml = '';
                const lessonTestIds = [...new Set([...(s.assignedTests || []), ...(s.materialIds || [])])];
                if (lessonTestIds.length > 0) {
                    const materialButtons = lessonTestIds.map(tId => {
                        const test = TEST_BANK.find(t => t.id === tId);
                        if (!test) return '';
                        const icon = test.module === 'reading' ? '📖' : test.module === 'listening' ? '🎧' : test.module === 'writing' ? '✍️' : '🗣️';
                        return `
                        <button onclick="window.launchScheduledTest('${tId}')" class="w-full mt-1.5 flex justify-between items-center bg-blue-600 hover:bg-blue-700 text-white px-4 py-2.5 rounded-lg text-sm font-bold transition shadow-sm hover:-translate-y-0.5">
                            <span class="flex items-center gap-2"><span>${icon}</span> <span class="truncate">${test.title}</span></span>
                            <span>Enter &rarr;</span>
                        </button>`;
                    }).join('');
                    
                    if (materialButtons) {
                        materialHtml = `
                        <div class="mt-4 pt-3 border-t border-slate-100">
                            <div class="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2">📚 Assigned Lessons</div>
                            ${materialButtons}
                        </div>`;
                    }
                }

                html += `
                <div class="bg-white border border-slate-200 rounded-xl p-4 shadow-sm mb-3">
                    <h4 class="font-black text-indigo-900 text-lg mb-1">${s.className}</h4>
                    <div class="inline-block bg-amber-100 text-amber-800 px-2 py-0.5 rounded text-xs font-bold mb-3">${s.time}</div>
                    ${s.topic ? `<div class="text-sm font-medium text-slate-700 mb-2">Topic: ${s.topic}</div>` : ''}
                    
                    ${materialHtml}

                    <div class="mt-4 flex flex-col gap-2">
                        ${s.link ? `<a href="${s.link}" target="_blank" class="w-full bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-bold py-2.5 rounded-lg text-center text-sm transition border border-indigo-100 flex items-center justify-center gap-2">🎥 Join Live Video Class</a>` : ''}
                        ${s.recordingLink ? `<a href="${s.recordingLink}" target="_blank" class="w-full bg-slate-50 hover:bg-slate-100 text-slate-700 font-bold py-2 rounded-lg text-center text-xs transition border border-slate-200">📼 Watch Recording</a>` : ''}
                    </div>
                </div>`;
            });
        }
        content.innerHTML = html;
        modal.classList.remove('hidden');
    };

    // --- FULLY REAL-TIME CLOUD SYNC SYSTEM ---
    window.triggerUIRefresh = () => {
        if(window.refreshTimeout) clearTimeout(window.refreshTimeout);
        window.refreshTimeout = setTimeout(() => {
            if (!currentUser) return;

            // ✨ NEW: Real-Time Live Sync for Active Exams & Previews!
            const examUI = document.getElementById('exam-ui');
            if (examUI && !examUI.classList.contains('hidden') && APP_DATA && APP_DATA.id && !window.isFullExamMode) {
                const freshTest = TEST_BANK.find(t => t.id === APP_DATA.id);
                // Only hot-reload if the content actually changed
                if (freshTest && JSON.stringify(freshTest.parts) !== JSON.stringify(APP_DATA.parts)) {
                    // Update global state without wiping the student's answers
                    APP_DATA.parts = JSON.parse(JSON.stringify(freshTest.parts));
                    APP_DATA.title = freshTest.title;
                    const titleEl = document.getElementById('exam-module-title');
                    if (titleEl) titleEl.textContent = APP_DATA.title;
                    
                    // Remember where the user was typing so we don't interrupt them
                    const activeEl = document.activeElement;
                    const activeId = activeEl ? activeEl.id : null;
                    let cursorStart = null, cursorEnd = null;
                    if (activeEl && (activeEl.tagName === 'INPUT' || activeEl.tagName === 'TEXTAREA')) {
                        try { cursorStart = activeEl.selectionStart; cursorEnd = activeEl.selectionEnd; } catch(e) {}
                    }

                    // Hot-reload the screen
                    if (typeof renderPart === 'function') {
                        renderPart(Math.min(currentPartIdx, Math.max(0, APP_DATA.parts.length - 1)));
                    }

                    // Restore cursor focus seamlessly
                    if (activeId) {
                        const restoredEl = document.getElementById(activeId);
                        if (restoredEl) {
                            restoredEl.focus();
                            if (cursorStart !== null && cursorEnd !== null && (restoredEl.tagName === 'INPUT' || restoredEl.tagName === 'TEXTAREA')) {
                                try { restoredEl.setSelectionRange(cursorStart, cursorEnd); } catch(e) {}
                            }
                        }
                    }
                }
            }

            if (currentUser.role === 'teacher') {
                // ✨ FIX: Instantly recalculate badges the millisecond cloud data arrives!
                if(typeof window.updateTeacherBadges === 'function') window.updateTeacherBadges();
                
                const editorUI = document.getElementById('editor-ui');
                if (!editorUI.classList.contains('hidden')) {
                    if(typeof renderTestBank === 'function') renderTestBank();
                    if(typeof renderClasses === 'function') renderClasses();
                    if(typeof renderStudentsList === 'function') renderStudentsList();
                    if(typeof renderPaymentsView === 'function') renderPaymentsView();
                    if(!document.getElementById('editor-view-timetable').classList.contains('hidden')) window.renderCalendar('teacher');
                }
                if (!document.getElementById('editor-view-subs').classList.contains('hidden')) {
                    if(typeof renderSubmissions === 'function') renderSubmissions();
                }
            } else if (currentUser.role === 'collaborator') {
                const editorUI = document.getElementById('editor-ui');
                if (!editorUI.classList.contains('hidden')) {
                    if(typeof renderTestBank === 'function') renderTestBank();
                    if(typeof renderClasses === 'function') renderClasses();
                }
            } else {
                const startScreen = document.getElementById('start-screen');
                if (!startScreen.classList.contains('hidden')) {
                     const sel = document.getElementById('student-class-select');
                     if(typeof initStudentDashboard === 'function') initStudentDashboard(sel ? sel.value : null);
                }
            }
        }, 100);
    };
