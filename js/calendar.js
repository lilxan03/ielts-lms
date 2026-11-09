    window.changeCalendarView = function(view, role) {
        window.currentCalView = view;
        window.renderCalendar(role);
    };

    window.navigateCalendar = function(dir, role) {
        if (window.currentCalView === 'month') {
            currentCalDate.setMonth(currentCalDate.getMonth() + dir);
        } else {
            currentCalDate.setDate(currentCalDate.getDate() + (dir * 7));
        }
        window.renderCalendar(role);
    };

    window.renderCalendar = function(role) {
        const containerId = role === 'teacher' ? 'teacher-cal-container' : 'student-cal-container';
        const monthLabelId = role === 'teacher' ? 'teacher-cal-month' : 'student-cal-month';
        const container = document.getElementById(containerId);
        const monthLabel = document.getElementById(monthLabelId);
        if (!container || !monthLabel) return;

        const year = currentCalDate.getFullYear();
        const month = currentCalDate.getMonth();
        const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
        
        const today = new Date();
        const localTodayStr = `${today.getFullYear()}-${String(today.getMonth()+1).padStart(2,'0')}-${String(today.getDate()).padStart(2,'0')}`;

        if (window.currentCalView === 'month') {
            monthLabel.textContent = `${monthNames[month]} ${year}`;
            
            const firstDay = new Date(year, month, 1).getDay();
            const daysInMonth = new Date(year, month + 1, 0).getDate();
            
            let gridHtml = `
            <div class="grid grid-cols-7 gap-1 md:gap-2 text-center text-[10px] font-black text-slate-400 mb-2 tracking-widest uppercase shrink-0 pt-2">
                <div>Sun</div><div>Mon</div><div>Tue</div><div>Wed</div><div>Thu</div><div>Fri</div><div>Sat</div>
            </div>
            <div class="grid grid-cols-7 gap-2 flex-1 overflow-y-auto pb-4 custom-scrollbar pr-1 content-start">`;
            
            for (let i = 0; i < firstDay; i++) {
                gridHtml += `<div class="p-2 border border-transparent min-h-[60px]"></div>`;
            }
            
            for (let day = 1; day <= daysInMonth; day++) {
                const dateStr = `${year}-${String(month+1).padStart(2,'0')}-${String(day).padStart(2,'0')}`;
                const isToday = localTodayStr === dateStr;
                
                let daySchedules = SCHEDULES.filter(s => s.date === dateStr);
                if (role === 'student') {
                    const cid = document.getElementById('student-class-select')?.value;
                    const cls = CLASSES.find(c => c.id === cid);
                    daySchedules = cls ? daySchedules.filter(s => window.scheduleBelongsToClass(s, cls) && (!s.attendingStudents || s.attendingStudents.includes(currentUser.user))) : [];
                }
                
                const hasClass = daySchedules.length > 0;
                const badgeColor = 'bg-blue-500';
                const badgeHtml = hasClass ? `<div class="mt-auto pt-2"><div class="w-2 h-2 rounded-full ${badgeColor} mx-auto shadow-sm"></div></div>` : '';
                
                let classesStr = "p-2 min-h-[60px] border rounded-lg cursor-pointer transition flex flex-col items-center justify-start hover:shadow-md";
                if (isToday) classesStr += " bg-slate-800 font-bold text-white border-slate-900";
                else classesStr += " bg-white text-slate-700 border-slate-200 hover:border-slate-400";
                if (hasClass && !isToday) classesStr += " ring-2 ring-blue-200 border-blue-300 bg-blue-50";

                gridHtml += `<div onclick="selectDate('${dateStr}', '${role}')" class="${classesStr}">
                    <span class="${isToday ? '' : 'mt-1'}">${day}</span>
                    ${badgeHtml}
                </div>`;
            }
            gridHtml += `</div>`;
            container.innerHTML = gridHtml;

        } else {
            // WEEK VIEW LOGIC
            const startOfWeek = new Date(currentCalDate);
            startOfWeek.setDate(currentCalDate.getDate() - currentCalDate.getDay());
            
            const endOfWeek = new Date(startOfWeek);
            endOfWeek.setDate(startOfWeek.getDate() + 6);
            
            if (startOfWeek.getMonth() === endOfWeek.getMonth()) {
                monthLabel.textContent = `${monthNames[startOfWeek.getMonth()]} ${startOfWeek.getFullYear()}`;
            } else {
                monthLabel.textContent = `${monthNames[startOfWeek.getMonth()]} - ${monthNames[endOfWeek.getMonth()]} ${endOfWeek.getFullYear()}`;
            }

            const weekDays = [];
            for (let i = 0; i < 7; i++) {
                const d = new Date(startOfWeek);
                d.setDate(startOfWeek.getDate() + i);
                weekDays.push(d);
            }

            const dayNames = ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"];
            let headerHtml = `<div class="flex border-b border-slate-200 shrink-0 pr-[8px]">
                <div class="w-12 sm:w-16 shrink-0 border-r border-slate-100"></div>`;
            
            weekDays.forEach((d, i) => {
                const dateStr = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
                const isToday = localTodayStr === dateStr;
                const num = d.getDate();
                
                headerHtml += `
                <div class="flex-1 flex flex-col items-center justify-center py-2 cursor-pointer hover:bg-slate-50 transition border-l border-slate-100 first:border-l-0" onclick="selectDate('${dateStr}', '${role}')">
                    <span class="text-[10px] sm:text-xs font-black uppercase ${isToday ? 'text-blue-600' : 'text-slate-400'}">${dayNames[i]}</span>
                    <div class="mt-1 w-7 h-7 sm:w-8 sm:h-8 flex items-center justify-center rounded-full text-sm sm:text-base font-bold ${isToday ? 'bg-blue-600 text-white shadow-md' : 'text-slate-700'}">${num}</div>
                </div>`;
            });
            headerHtml += `</div>`;

            // 06:00 to 22:00 -> 17 hours
            const START_HOUR = 6;
            const END_HOUR = 22;
            const ROW_HEIGHT = 60; 
            const TOTAL_HEIGHT = (END_HOUR - START_HOUR + 1) * ROW_HEIGHT;
            
            let gridBgHtml = '';
            for (let h = START_HOUR; h <= END_HOUR; h++) {
                gridBgHtml += `
                <div class="flex border-b border-slate-100 box-border w-full" style="height: ${ROW_HEIGHT}px;">
                    <div class="w-12 sm:w-16 shrink-0 flex items-start justify-center pt-2 text-[10px] sm:text-xs font-bold text-slate-400 border-r border-slate-200 bg-slate-50/50">${String(h).padStart(2,'0')}:00</div>
                    <div class="flex-1 flex w-full">
                        ${[0,1,2,3,4,5,6].map(i => `<div class="flex-1 border-l border-slate-100 first:border-l-0"></div>`).join('')}
                    </div>
                </div>`;
            }

            const gridContainerHtml = `
            <div class="flex-1 overflow-y-auto custom-scrollbar bg-white w-full block">
                <div class="relative w-full" style="height: ${TOTAL_HEIGHT}px;">
                    <!-- Background Grid -->
                    <div class="absolute inset-0 flex flex-col z-0 pointer-events-none">
                        ${gridBgHtml}
                    </div>
                    
                    <!-- Events Overlay -->
                    <div class="absolute inset-0 pl-12 sm:pl-16 flex pointer-events-none z-10">
                        ${weekDays.map((d, i) => {
                            const dateStr = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
                            let daySchedules = SCHEDULES.filter(s => s.date === dateStr);
                            if (role === 'student') {
                                const cid = document.getElementById('student-class-select')?.value;
                                const cls = CLASSES.find(c => c.id === cid);
                            daySchedules = cls ? daySchedules.filter(s => window.scheduleBelongsToClass(s, cls) && (!s.attendingStudents || s.attendingStudents.includes(currentUser.user))) : [];
                            }
                            
                            let colsEventsHtml = '';
                            daySchedules.forEach(s => {
                                const parsed = window.parseClassDateTime(s.date, s.time);
                                if (!parsed) return;
                                const eventHour = parsed.getHours();
                                const eventMin = parsed.getMinutes();
                                
                                const topPx = ((eventHour - START_HOUR) + (eventMin / 60)) * ROW_HEIGHT;
                                const durMins = AVAILABILITY.duration || 60;
                                const heightPx = (durMins / 60) * ROW_HEIGHT;
                                const evColor = 'bg-blue-600 hover:bg-blue-700 border-blue-500';
                                
                                colsEventsHtml += `
                                <div onclick="selectDate('${dateStr}', '${role}')" 
                                     class="absolute inset-x-0.5 sm:inset-x-1 z-10 ${evColor} text-white rounded-md p-1 sm:p-1.5 shadow-sm border cursor-pointer pointer-events-auto transition-transform hover:scale-[1.02] hover:z-20 overflow-hidden flex flex-col"
                                     style="top: ${topPx}px; height: ${heightPx}px;"
                                     title="${s.time} - ${window.getScheduleClassLabel(s)}\n${s.topic || ''}">
                                    <div class="text-[9px] sm:text-[11px] font-black leading-tight truncate drop-shadow-sm">${window.getScheduleClassLabel(s)}</div>
                                    <div class="text-[8px] sm:text-[10px] font-medium opacity-90 truncate leading-tight mt-0.5">${s.time}</div>
                                </div>`;
                            });
                            
                            return `<div class="flex-1 relative h-full">${colsEventsHtml}</div>`;
                        }).join('')}
                    </div>
                </div>
            </div>`;

            container.innerHTML = `<div class="flex flex-col h-full w-full bg-white">${headerHtml}${gridContainerHtml}</div>`;
        }

        if (role === 'teacher') {
            document.getElementById('timetable-list').innerHTML = '<p class="text-sm text-slate-500 italic mt-10 text-center">Click an event or day header on the calendar to manage.</p>';
            document.getElementById('teacher-selected-date-label').textContent = 'Select a date';
            
            const students = USERS.filter(u => u.role === 'student');
            const exportList = document.getElementById('attendance-export-list');
            exportList.replaceChildren(...students.map(st => {
                const row = document.createElement('div');
                row.className = 'flex justify-between items-center border-b border-slate-100 pb-2 mb-2 last:border-0 last:pb-0';

                const name = document.createElement('span');
                name.className = 'font-bold text-slate-700';
                name.textContent = window.LMSAuthHelpers.getStudentDisplayName(st);

                const button = document.createElement('button');
                button.className = 'text-[11px] bg-emerald-100 text-emerald-800 hover:bg-emerald-200 px-3 py-1 font-bold rounded shadow-sm transition';
                button.textContent = 'Export PDF';
                button.addEventListener('click', () => window.exportAttendancePDF(st.user));

                row.append(name, button);
                return row;
            }));
            
        }
    }

    // A Wrapper so toggleEditorTab remains unbroken
    window.renderTimetable = function() {
        window.renderCalendar('teacher');
    }

    window.selectDate = function(dateStr, role) {
        const displayDate = new Date(dateStr).toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
        
        if (role === 'teacher') {
            document.getElementById('teacher-selected-date-label').textContent = displayDate;
            const dayScheds = SCHEDULES.filter(s => s.date === dateStr);
            
            let html = `<button onclick="promptCreateSchedule('${dateStr}')" class="w-full bg-blue-50 text-blue-700 font-bold py-2.5 rounded-lg mb-4 border border-blue-200 hover:bg-blue-100 transition shadow-sm">+ Add Lesson on this Day</button>`;
            
            if (dayScheds.length === 0) {
                html += '<p class="text-sm text-slate-500 italic text-center mt-6">No schedules for this date.</p>';
            } else {
                html += dayScheds.map(s => `
                    <div class="bg-white border border-slate-200 p-4 rounded-lg shadow-sm mb-3">
                        <div class="flex justify-between items-start mb-2 border-b border-slate-100 pb-2">
                            <div>
                                <span class="font-black text-blue-900 block text-lg">${window.getScheduleClassLabel(s)}</span>
                                <span class="text-xs font-bold bg-amber-100 text-amber-800 px-2 py-0.5 rounded inline-block mt-1 shadow-sm">${s.time}</span>
                            </div>
                            <div class="flex gap-1 shrink-0">
                                <button onclick="editSchedule('${s.id}')" class="text-[10px] px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded shadow-sm transition">Edit</button>
                                <button onclick="deleteSchedule('${s.id}', '${dateStr}')" class="text-[10px] px-2.5 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-600 font-bold rounded shadow-sm transition">Del</button>
                            </div>
                        </div>
                        <div class="text-sm font-medium text-slate-600 mb-2 mt-1">Topic: <span class="font-bold">${s.topic || 'General Practice'}</span></div>
                        ${s.prepText ? `<div class="text-[11px] text-sky-700 font-medium mb-3 bg-sky-50 p-2 rounded border border-sky-100"><span class="font-bold uppercase tracking-widest text-[9px] block mb-1">Before Lesson</span>${s.prepText.substring(0, 60)}${s.prepText.length > 60 ? '...' : ''}</div>` : ''}
                        ${s.assignedTests && s.assignedTests.length ? `<div class="text-[10px] text-slate-500 uppercase font-bold mb-3 border-t pt-2 border-slate-100">📎 ${s.assignedTests.length} Material(s) Attached</div>` : ''}
                        
                        <button onclick="window.joinLiveClass('${s.id}', '${(s.topic || 'General Practice').replace(/'/g, "\\'")}')" class="w-full bg-indigo-50 hover:bg-indigo-100 hover:text-indigo-700 text-indigo-600 border border-indigo-200 font-bold py-2 rounded-md text-xs transition shadow-sm mb-2 flex justify-center items-center gap-1">🎥 Join Live Video Class</button>
                        <button onclick="promptAttendance('${s.id}')" class="w-full bg-slate-100 hover:bg-blue-50 hover:text-blue-700 text-slate-700 border border-slate-200 hover:border-blue-200 font-bold py-2 rounded-md text-xs transition shadow-sm">Mark Attendance</button>
                    </div>
                `).join('');
            }
            document.getElementById('timetable-list').innerHTML = html;
        } else {
            // Build the Student's pop-up modal
            let dayScheds = SCHEDULES.filter(s => s.date === dateStr);
            const cid = document.getElementById('student-class-select').value;
            const cls = CLASSES.find(c => c.id === cid);
            dayScheds = cls ? dayScheds.filter(s => window.scheduleBelongsToClass(s, cls) && (!s.attendingStudents || s.attendingStudents.includes(currentUser.user))) : [];
            
            document.getElementById('day-modal-title').textContent = displayDate;
            const content = document.getElementById('day-modal-content');
            
            if (dayScheds.length === 0) {
                content.innerHTML = '<p class="text-slate-500 italic mt-4">No scheduled classes or tasks for this day.</p>';
            } else {
                content.innerHTML = dayScheds.map(s => {
                    const lessonTestIds = [...new Set([...(s.assignedTests || []), ...(s.materialIds || [])])];
                    const renderTestItem = (tid) => {
                        const t = TEST_BANK.find(x => x.id === tid); if(!t) return '';
                        const modColors = { reading:'blue', listening:'cyan', writing:'emerald', speaking:'amber' };
                        return `
                        <div class="flex justify-between items-center p-3 border border-slate-200 bg-white shadow-sm mb-2 rounded-md hover:border-indigo-300 transition">
                          <div class="truncate pr-2"><span class="text-[9px] font-bold px-1.5 py-0.5 rounded bg-${modColors[t.module]}-100 text-${modColors[t.module]}-800 uppercase mr-2">${t.module}</span><span class="font-bold text-slate-800 text-sm truncate">${t.title}</span></div>
                          <button onclick="window.launchScheduledTest('${t.id}')" class="shrink-0 bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-1.5 px-4 rounded text-xs shadow transition">Start</button>
                        </div>`;
                    };
                    const lessonTests = lessonTestIds.map(tid => renderTestItem(tid)).join('');
                    const homeworkTests = (s.homeworkTests || []).map(tid => renderTestItem(tid)).join('');
                    const prepHtml = s.prepText ? `<div class="p-3 bg-white rounded border border-slate-200 shadow-sm text-sm text-slate-700 mb-4 whitespace-pre-wrap leading-relaxed">${window.linkifyText(s.prepText)}</div>` : '';
                    
                    return `
                    <div class="p-5 bg-indigo-50 border border-indigo-100 rounded-xl shadow-sm mb-4">
                        <h3 class="font-black text-2xl text-slate-800 mb-1">${s.time}</h3>
                        <p class="text-sm font-bold text-slate-500 flex items-center gap-2 mb-4"><span class="w-2 h-2 rounded-full bg-indigo-400"></span> ${s.topic || 'General Practice'}</p>
                        
                        <button onclick="document.getElementById('student-day-modal').classList.add('hidden'); window.joinLiveClass('${s.id}', '${(s.topic || 'General Practice').replace(/'/g, "\\'")}')" class="w-full bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 text-white font-bold py-3 rounded-lg text-sm transition shadow-md mb-4 flex items-center justify-center gap-2 animate-pulse hover:animate-none">🎥 Join Live Video Class</button>
                            
                            <div class="mb-4">
                                <p class="text-[10px] font-black uppercase tracking-wider text-sky-600 mb-2">Before the lesson: Preparation</p>
                                ${prepHtml || '<p class="text-xs text-slate-500 italic p-3 bg-white rounded border border-slate-200 shadow-sm mb-4">No specific preparation required.</p>'}
                            </div>

                            <div class="mb-4 border-t border-indigo-100 pt-4">
                                <p class="text-[10px] font-black uppercase tracking-wider text-indigo-600 mb-2">For the lesson</p>
                                ${lessonTests || '<p class="text-xs text-slate-500 italic p-3 bg-white rounded border border-slate-200 shadow-sm">No specific tests assigned to this lesson.</p>'}
                            </div>
                            <div class="border-t border-indigo-100 pt-4">
                                <p class="text-[10px] font-black uppercase tracking-wider text-amber-600 mb-2">After the lesson: Homework</p>
                                ${homeworkTests || '<p class="text-xs text-slate-500 italic p-3 bg-white rounded border border-slate-200 shadow-sm">No homework assigned.</p>'}
                            </div>
                            ${s.recordingLink ? `
                            <div class="border-t border-indigo-100 pt-4 mt-4">
                                <p class="text-[10px] font-black uppercase tracking-wider text-emerald-600 mb-2">Class Recording & Feedback</p>
                                <a href="${s.recordingLink}" target="_blank" rel="noopener noreferrer" class="w-full bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 font-bold py-2 rounded-md text-xs transition shadow-sm mb-3 flex justify-center items-center gap-1">▶️ Watch Recording</a>
                                
                                <textarea id="feedback-${s.id}" class="w-full border border-indigo-200 rounded p-2 text-xs outline-none focus:border-indigo-400 mb-2 resize-none" rows="2" placeholder="What did you learn today? Any feedback?">${(s.studentFeedback && s.studentFeedback[currentUser.user]) || ''}</textarea>
                                <button onclick="window.submitClassFeedback('${s.id}')" class="w-full bg-slate-800 hover:bg-black text-white font-bold py-1.5 rounded-md text-xs shadow transition">Submit Feedback</button>
                            </div>
                            ` : ''}
                        </div>
                    </div>`;
                }).join('');
            }
            document.getElementById('student-day-modal').classList.remove('hidden');
        }
    }

    function promptCreateSchedule(dateStr = '') {
        const scheduleClassOptions = getSchedulableClassOptions();
        if(scheduleClassOptions.length === 0) { showModalMsg("Error", "Create or assign a mini class before scheduling."); return; }
        if(!dateStr) dateStr = new Date().toISOString().split('T')[0];

        let classOpts = '<option value="">-- Select a Mini Class --</option>' + scheduleClassOptions.map(option => `<option value="${option.key}">${option.label}</option>`).join('');

        document.getElementById('modal-title').textContent = "Schedule a Lesson";
        document.getElementById('modal-message').innerHTML = `
            <div class="flex gap-3 mb-3">
                <div class="flex-1">
                   <label class="block text-sm font-bold text-slate-700 mb-1 mt-2">Class</label>
                   <select id="sched-class" class="w-full border-2 border-slate-200 p-2 rounded-md font-bold text-blue-800 outline-none focus:border-blue-500" onchange="window.updateSchedClassOptions()">${classOpts}</select>
                </div>
                <div class="flex-1">
                   <label class="block text-sm font-bold text-slate-700 mb-1 mt-2">Topic</label>
                   <input type="text" id="sched-topic" placeholder="e.g. Speaking Practice" class="w-full border-2 border-slate-200 p-2 rounded-md outline-none font-bold text-slate-700 focus:border-blue-500">
                </div>
            </div>
            
            <div class="flex gap-3 mb-4">
                <div class="w-1/2">
                   <label class="block text-sm font-bold text-slate-700 mb-1">Date</label>
                   <input type="date" id="sched-date" value="${dateStr}" class="w-full border-2 border-slate-200 p-2 rounded-md outline-none font-bold text-slate-700 focus:border-blue-500">
                </div>
                <div class="w-1/2">
                   <label class="block text-sm font-bold text-slate-700 mb-1">Time</label>
                   <input type="time" id="sched-time" class="w-full border-2 border-slate-200 p-2 rounded-md outline-none font-bold text-slate-700 focus:border-blue-500">
                </div>
            </div>
            
            <div class="flex gap-3 mb-4">
                <div class="w-1/2">
                    <label class="block text-sm font-bold text-slate-700 mb-1 mt-2">Before the lesson (Preparation)</label>
                    <textarea id="sched-prep" placeholder="Type instructions or paste links..." class="w-full border-2 border-slate-200 p-2 rounded-md outline-none font-medium text-slate-700 focus:border-blue-500 min-h-[60px] resize-y"></textarea>
                </div>
                <div class="w-1/2">
                    <label class="block text-sm font-bold text-slate-700 mb-1 mt-2">Recording Link (Optional)</label>
                    <input type="text" id="sched-recording" placeholder="https://..." class="w-full border-2 border-slate-200 p-2 rounded-md outline-none font-medium text-slate-700 focus:border-blue-500">
                </div>
            </div>

            <div class="grid grid-cols-2 gap-4 mb-4">
                <div>
                    <label class="block text-sm font-bold text-slate-700 mb-1">For the lesson:</label>
                    <div id="sched-tests-container" class="max-h-32 overflow-y-auto border-2 border-slate-200 p-2 rounded-md bg-slate-50 text-sm text-slate-500 italic space-y-1 shadow-inner">Select class...</div>
                </div>
                <div>
                    <label class="block text-sm font-bold text-slate-700 mb-1">After the lesson (Homework):</label>
                    <div id="sched-homework-tests-container" class="max-h-32 overflow-y-auto border-2 border-slate-200 p-2 rounded-md bg-amber-50 text-sm text-slate-500 italic space-y-1 shadow-inner">Select class...</div>
                </div>
            </div>
            <div>
                <label class="block text-sm font-bold text-slate-700 mb-1">Expected Students:</label>
                <div id="sched-students-container" class="max-h-32 overflow-y-auto border-2 border-slate-200 p-2 rounded-md bg-slate-50 text-sm text-slate-500 italic space-y-1 shadow-inner">Select class...</div>
            </div>
        `;
        document.getElementById('modal-input').classList.add('hidden');
        document.getElementById('modal-cancel').classList.remove('hidden');
        document.getElementById('custom-modal').classList.remove('hidden');
        
        // Widen the modal to fit the two columns
        document.querySelector('#custom-modal > div').classList.remove('w-96');
        document.querySelector('#custom-modal > div').classList.add('w-[600px]');

        window.updateSchedClassOptions = () => {
            const selectedOption = getSelectedSchedulableClass(document.getElementById('sched-class').value);
            const cls = selectedOption?.cls;
            const assignedTests = getClassAssignedTests(cls);
            
            // Load Tests
            const testCont = document.getElementById('sched-tests-container');
            const homeworkTestCont = document.getElementById('sched-homework-tests-container');
            if(!cls || assignedTests.length === 0) {
                testCont.innerHTML = "No tests assigned.";
                testCont.classList.add('italic', 'text-slate-500');
                homeworkTestCont.innerHTML = "No tests assigned.";
                homeworkTestCont.classList.add('italic', 'text-slate-500');
            } else {
                testCont.innerHTML = assignedTests.map(tid => {
                    const t = TEST_BANK.find(x => x.id === tid);
                    return t ? `<label class="flex items-center space-x-2 cursor-pointer hover:bg-slate-200 p-1 rounded transition"><input type="checkbox" class="sched-test-cb w-3.5 h-3.5 text-blue-600 rounded" value="${t.id}"> <span class="truncate font-medium text-slate-800 text-xs">${t.title}</span></label>` : '';
                }).join('');
                testCont.classList.remove('italic', 'text-slate-500');
                homeworkTestCont.innerHTML = assignedTests.map(tid => {
                    const t = TEST_BANK.find(x => x.id === tid);
                    return t ? `<label class="flex items-center space-x-2 cursor-pointer hover:bg-amber-100 p-1 rounded transition"><input type="checkbox" class="sched-homework-test-cb w-3.5 h-3.5 text-amber-600 rounded" value="${t.id}"> <span class="truncate font-medium text-slate-800 text-xs">${t.title}</span></label>` : '';
                }).join('');
                homeworkTestCont.classList.remove('italic', 'text-slate-500');
            }

            // Load Students
            const stdCont = document.getElementById('sched-students-container');
            if(!cls || !cls.enrolledStudents || cls.enrolledStudents.length === 0) {
                stdCont.innerHTML = "No students enrolled.";
                stdCont.classList.add('italic', 'text-slate-500');
            } else {
                stdCont.innerHTML = cls.enrolledStudents.map(st => {
                    return `<label class="flex items-center space-x-2 cursor-pointer hover:bg-slate-200 p-1 rounded transition"><input type="checkbox" class="sched-student-cb w-3.5 h-3.5 text-blue-600 rounded" value="${st}" checked> <span class="truncate font-medium text-slate-800 text-xs">${st}</span></label>`;
                }).join('');
                stdCont.classList.remove('italic', 'text-slate-500');
            }
        };

        document.getElementById('modal-cancel').onclick = () => {
            document.getElementById('custom-modal').classList.add('hidden');
            document.querySelector('#custom-modal > div').classList.remove('w-[600px]');
            document.querySelector('#custom-modal > div').classList.add('w-96');
        };
        
        document.getElementById('modal-confirm').onclick = async () => {
            const selectedOption = getSelectedSchedulableClass(document.getElementById('sched-class').value);
            const selectedClass = selectedOption?.cls;
            const date = document.getElementById('sched-date').value;
            const timeRaw = document.getElementById('sched-time').value;
            const topic = document.getElementById('sched-topic').value;
            const prepText = document.getElementById('sched-prep').value.trim();
            const recordingLink = document.getElementById('sched-recording').value.trim();
            const selectedTests = Array.from(document.querySelectorAll('.sched-test-cb:checked')).map(cb => cb.value);
            const selectedHomeworkTests = Array.from(document.querySelectorAll('.sched-homework-test-cb:checked')).map(cb => cb.value);
            const selectedStudents = Array.from(document.querySelectorAll('.sched-student-cb:checked')).map(cb => cb.value);

            if(selectedClass && (selectedOption.isLegacyMiniClass || window.isSchedulableClass(selectedClass)) && date && timeRaw) {
                const time = window.formatClassTime(timeRaw);
                if (!time) {
                    showModalMsg("Error", "Please enter a valid class time.");
                    return;
                }

                const newSched = { 
                    id: 'sch_'+Date.now(), 
                    classId: selectedClass.id,
                    className: selectedClass.name, 
                    ...(selectedOption.isLegacyMiniClass ? {
                        miniClassName: selectedClass.miniClassName,
                        miniClassParentId: selectedClass.id
                    } : {}),
                    date, time, topic, 
                    prepText,
                    assignedTests: selectedTests,
                    homeworkTests: selectedHomeworkTests,
                    attendingStudents: selectedStudents, 
                    recordingLink: recordingLink,
                    studentFeedback: {},
                    dateAdded: new Date().toLocaleDateString() 
                };
                
                try {
                    await window.fsSetDoc(window.fsDoc(window.db, window.fPath('schedules'), newSched.id), newSched);
                    SCHEDULES.push(newSched);
                    
                    document.getElementById('custom-modal').classList.add('hidden');
                    document.querySelector('#custom-modal > div').classList.remove('w-[600px]');
                    document.querySelector('#custom-modal > div').classList.add('w-96');
                    
                    window.renderCalendar('teacher');
                    window.selectDate(date, 'teacher');
                } catch (error) {
                    console.error('Unable to save scheduled class:', error);
                    showModalMsg("Error", "Could not save the scheduled class. Please try again.");
                }
            } else {
                alert("Please select a class, date, and time.");
            }
        };
    }

    window.promptCreateScheduleLegacy = window.promptCreateSchedule;

    window.editSchedule = function(id) {
        const sched = SCHEDULES.find(s => s.id === id);
        if(!sched) return;

        const scheduleClassOptions = getSchedulableClassOptions();
        let classOpts = '<option value="">-- Select a Mini Class --</option>' + scheduleClassOptions.map(option => {
            const isSelected = option.isLegacyMiniClass
                ? sched.miniClassParentId === option.cls.id && sched.miniClassName === option.cls.miniClassName
                : (sched.classId ? option.cls.id === sched.classId : option.cls.name === sched.className);
            return `<option value="${option.key}" ${isSelected ? 'selected' : ''}>${option.label}</option>`;
        }).join('');
        const parsedScheduleTime = window.parseClassDateTime(sched.date, sched.time);
        const scheduleTimeInput = parsedScheduleTime ? `${String(parsedScheduleTime.getHours()).padStart(2, '0')}:${String(parsedScheduleTime.getMinutes()).padStart(2, '0')}` : '';

        document.getElementById('modal-title').textContent = "Edit Schedule";
        document.getElementById('modal-message').innerHTML = `
            <div class="flex gap-3 mb-3">
                <div class="flex-1">
                   <label class="block text-sm font-bold text-slate-700 mb-1 mt-2">Class</label>
                   <select id="sched-class" class="w-full border-2 border-slate-200 p-2 rounded-md font-bold text-blue-800 outline-none focus:border-blue-500" onchange="window.updateSchedClassOptions()">${classOpts}</select>
                </div>
                <div class="flex-1">
                   <label class="block text-sm font-bold text-slate-700 mb-1 mt-2">Topic</label>
                   <input type="text" id="sched-topic" value="${sched.topic || ''}" class="w-full border-2 border-slate-200 p-2 rounded-md outline-none font-bold text-slate-700 focus:border-blue-500">
                </div>
            </div>
            
            <div class="flex gap-3 mb-4">
                <div class="w-1/2">
                   <label class="block text-sm font-bold text-slate-700 mb-1">Date</label>
                   <input type="date" id="sched-date" value="${sched.date}" class="w-full border-2 border-slate-200 p-2 rounded-md outline-none font-bold text-slate-700 focus:border-blue-500">
                </div>
                <div class="w-1/2">
                   <label class="block text-sm font-bold text-slate-700 mb-1">Time Text</label>
                   <input type="time" id="sched-time" value="${scheduleTimeInput}" class="w-full border-2 border-slate-200 p-2 rounded-md outline-none font-bold text-slate-700 focus:border-blue-500">
                </div>
            </div>
            
            <div class="flex gap-3 mb-4">
                <div class="w-1/2">
                    <label class="block text-sm font-bold text-slate-700 mb-1 mt-2">Before the lesson (Preparation)</label>
                    <textarea id="sched-prep" placeholder="Type instructions or paste links..." class="w-full border-2 border-slate-200 p-2 rounded-md outline-none font-medium text-slate-700 focus:border-blue-500 min-h-[60px] resize-y">${sched.prepText || ''}</textarea>
                </div>
                <div class="w-1/2">
                    <label class="block text-sm font-bold text-slate-700 mb-1 mt-2">Recording Link (Optional)</label>
                    <input type="text" id="sched-recording" value="${sched.recordingLink || ''}" placeholder="https://..." class="w-full border-2 border-slate-200 p-2 rounded-md outline-none font-medium text-slate-700 focus:border-blue-500">
                </div>
            </div>

            <div class="grid grid-cols-2 gap-4 mb-4">
                <div>
                    <label class="block text-sm font-bold text-slate-700 mb-1">For the lesson:</label>
                    <div id="sched-tests-container" class="max-h-32 overflow-y-auto border-2 border-slate-200 p-2 rounded-md bg-slate-50 text-sm text-slate-500 italic space-y-1 shadow-inner"></div>
                </div>
                <div>
                    <label class="block text-sm font-bold text-slate-700 mb-1">After the lesson (Homework):</label>
                    <div id="sched-homework-tests-container" class="max-h-32 overflow-y-auto border-2 border-slate-200 p-2 rounded-md bg-amber-50 text-sm text-slate-500 italic space-y-1 shadow-inner"></div>
                </div>
            </div>
            <div>
                <label class="block text-sm font-bold text-slate-700 mb-1">Expected Students:</label>
                <div id="sched-students-container" class="max-h-32 overflow-y-auto border-2 border-slate-200 p-2 rounded-md bg-slate-50 text-sm text-slate-500 italic space-y-1 shadow-inner"></div>
            </div>
        `;
        document.getElementById('modal-input').classList.add('hidden');
        document.getElementById('modal-cancel').classList.remove('hidden');
        document.getElementById('custom-modal').classList.remove('hidden');
        
        document.querySelector('#custom-modal > div').classList.remove('w-96');
        document.querySelector('#custom-modal > div').classList.add('w-[600px]');

        window.updateSchedClassOptions = () => {
            const selectedOption = getSelectedSchedulableClass(document.getElementById('sched-class').value);
            const cls = selectedOption?.cls;
            const assignedTests = getClassAssignedTests(cls);
            
            // Tests
            const testCont = document.getElementById('sched-tests-container');
            const homeworkTestCont = document.getElementById('sched-homework-tests-container');
            if(!cls || assignedTests.length === 0) {
                testCont.innerHTML = "No tests assigned.";
                testCont.classList.add('italic', 'text-slate-500');
                homeworkTestCont.innerHTML = "No tests assigned.";
                homeworkTestCont.classList.add('italic', 'text-slate-500');
            } else {
                testCont.innerHTML = assignedTests.map(tid => {
                    const t = TEST_BANK.find(x => x.id === tid);
                    const isChecked = (sched.assignedTests || []).includes(tid) ? 'checked' : '';
                    return t ? `<label class="flex items-center space-x-2 cursor-pointer hover:bg-slate-200 p-1 rounded transition"><input type="checkbox" class="sched-test-cb w-3.5 h-3.5 text-blue-600 rounded" value="${t.id}" ${isChecked}> <span class="truncate font-medium text-slate-800 text-xs">${t.title}</span></label>` : '';
                }).join('');
                testCont.classList.remove('italic', 'text-slate-500');
                homeworkTestCont.innerHTML = assignedTests.map(tid => {
                    const t = TEST_BANK.find(x => x.id === tid);
                    const isChecked = (sched.homeworkTests || []).includes(tid) ? 'checked' : '';
                    return t ? `<label class="flex items-center space-x-2 cursor-pointer hover:bg-amber-100 p-1 rounded transition"><input type="checkbox" class="sched-homework-test-cb w-3.5 h-3.5 text-amber-600 rounded" value="${t.id}" ${isChecked}> <span class="truncate font-medium text-slate-800 text-xs">${t.title}</span></label>` : '';
                }).join('');
                homeworkTestCont.classList.remove('italic', 'text-slate-500');
            }

            // Students
            const stdCont = document.getElementById('sched-students-container');
            if(!cls || !cls.enrolledStudents || cls.enrolledStudents.length === 0) {
                stdCont.innerHTML = "No students in class.";
                stdCont.classList.add('italic', 'text-slate-500');
            } else {
                // Fallback for old schedules missing the new array
                const targetStudents = sched.attendingStudents || cls.enrolledStudents; 
                stdCont.innerHTML = cls.enrolledStudents.map(st => {
                    const isChecked = targetStudents.includes(st) ? 'checked' : '';
                    return `<label class="flex items-center space-x-2 cursor-pointer hover:bg-slate-200 p-1 rounded transition"><input type="checkbox" class="sched-student-cb w-3.5 h-3.5 text-blue-600 rounded" value="${st}" ${isChecked}> <span class="truncate font-medium text-slate-800 text-xs">${st}</span></label>`;
                }).join('');
                stdCont.classList.remove('italic', 'text-slate-500');
            }
        };
        
        window.updateSchedClassOptions(); 

        document.getElementById('modal-cancel').onclick = () => {
            document.getElementById('custom-modal').classList.add('hidden');
            document.querySelector('#custom-modal > div').classList.remove('w-[600px]');
            document.querySelector('#custom-modal > div').classList.add('w-96');
        };

        document.getElementById('modal-confirm').onclick = async () => {
            const selectedOption = getSelectedSchedulableClass(document.getElementById('sched-class').value);
            const selectedClass = selectedOption?.cls;
            const date = document.getElementById('sched-date').value;
            const time = window.formatClassTime(document.getElementById('sched-time').value);
            const topic = document.getElementById('sched-topic').value;
            const prepText = document.getElementById('sched-prep').value.trim();
            const recordingLink = document.getElementById('sched-recording').value.trim();
            const selectedTests = Array.from(document.querySelectorAll('.sched-test-cb:checked')).map(cb => cb.value);
            const selectedHomeworkTests = Array.from(document.querySelectorAll('.sched-homework-test-cb:checked')).map(cb => cb.value);
            const selectedStudents = Array.from(document.querySelectorAll('.sched-student-cb:checked')).map(cb => cb.value);

            if(selectedClass && (selectedOption.isLegacyMiniClass || window.isSchedulableClass(selectedClass)) && date && time) {
                const updatedSchedule = {
                    ...sched,
                    classId: selectedClass.id,
                    className: selectedClass.name,
                    ...(selectedOption.isLegacyMiniClass ? {
                        miniClassName: selectedClass.miniClassName,
                        miniClassParentId: selectedClass.id
                    } : {
                        miniClassName: '',
                        miniClassParentId: ''
                    }),
                    date,
                    time,
                    topic,
                    prepText,
                    recordingLink,
                    assignedTests: selectedTests,
                    homeworkTests: selectedHomeworkTests,
                    attendingStudents: selectedStudents
                };

                try {
                    await window.fsSetDoc(window.fsDoc(window.db, window.fPath('schedules'), sched.id), updatedSchedule);
                    SCHEDULES = SCHEDULES.map(item => item.id === sched.id ? updatedSchedule : item);
                    
                    document.getElementById('custom-modal').classList.add('hidden');
                    document.querySelector('#custom-modal > div').classList.remove('w-[600px]');
                    document.querySelector('#custom-modal > div').classList.add('w-96');
                    
                    window.renderCalendar('teacher');
                    window.selectDate(date, 'teacher');
                } catch (error) {
                    console.error('Unable to update scheduled class:', error);
                    showModalMsg("Error", "Could not update the scheduled class. Please try again.");
                }
            } else {
                alert("Please fill out the class, date, and time fields.");
            }
        };
    }

    window.deleteSchedule = function(id, dateStr) {
        showConfirm("Delete Schedule", "Are you sure you want to remove this lesson from the calendar? This will also wipe its attendance records.", async () => {
            SCHEDULES = SCHEDULES.filter(s => s.id !== id);
            await window.fsDeleteDoc(window.fsDoc(window.db, window.fPath('schedules'), id));
            
            // Cleanup associated attendance
            const attToDelete = ATTENDANCE.filter(a => a.scheduleId === id);
            ATTENDANCE = ATTENDANCE.filter(a => a.scheduleId !== id);
            for(let a of attToDelete) {
                await window.fsDeleteDoc(window.fsDoc(window.db, window.fPath('attendance'), a.id));
            }
            window.renderCalendar('teacher');
            if (dateStr) window.selectDate(dateStr, 'teacher');
        });
    }

    window.promptAttendance = function(scheduleId) {
        const sched = SCHEDULES.find(s => s.id === scheduleId);
        if(!sched) return;

        const cls = CLASSES.find(c => c.name === sched.className);
        if(!cls) {
            alert("Could not find the associated class.");
            return;
        }

        const students = sched.attendingStudents || cls.enrolledStudents || [];
        if (students.length === 0) {
            alert("No students are assigned to attend this lesson.");
            return;
        }

        let html = `<div class="max-h-[60vh] overflow-y-auto pr-2 space-y-3">`;
        
        students.forEach(st => {
            // Check if there is an existing record to load
            const existing = ATTENDANCE.find(a => a.scheduleId === scheduleId && a.student === st);
            const currentStatus = existing ? existing.status : 'on_time';

            html += `
            <div class="p-3 border border-slate-200 rounded-lg bg-slate-50 flex flex-col md:flex-row md:items-center justify-between gap-2 shadow-sm transition-colors duration-200" id="att-card-${st}">
                <div class="font-bold text-slate-800">${st}</div>
                <select id="att-status-${st}" class="border border-slate-300 rounded px-2 py-1.5 text-sm outline-none focus:border-blue-500 font-bold shadow-sm cursor-pointer">
                    <option value="on_time" ${currentStatus === 'on_time' ? 'selected' : ''}>✅ Present (On Time)</option>
                    <option value="late" ${currentStatus === 'late' ? 'selected' : ''}>⚠️ Present (Late)</option>
                    <option value="absent_adv" ${currentStatus === 'absent_adv' ? 'selected' : ''}>❌ Absent (Advance Permission)</option>
                    <option value="absent_late" ${currentStatus === 'absent_late' ? 'selected' : ''}>❌ Absent (Late Permission)</option>
                    <option value="absent_none" ${currentStatus === 'absent_none' ? 'selected' : ''}>❗ Absent (No Permission)</option>
                </select>
            </div>
            `;
        });
        
        html += `</div>`;

        document.getElementById('modal-title').textContent = `Attendance: ${sched.className}`;
        document.getElementById('modal-message').innerHTML = `<p class="text-sm text-slate-500 font-medium mb-4">Date: ${sched.date} &bull; Time: ${sched.time}</p>` + html;
        document.getElementById('modal-input').classList.add('hidden');
        document.getElementById('modal-cancel').classList.remove('hidden');
        document.getElementById('custom-modal').classList.remove('hidden');

        // Add dynamic color styling to the dropdowns based on status
        students.forEach(st => {
            const sel = document.getElementById(`att-status-${st}`);
            const card = document.getElementById(`att-card-${st}`);
            if(sel && card) {
                sel.addEventListener('change', function() {
                    sel.className = "border rounded px-2 py-1.5 text-sm outline-none font-bold shadow-sm cursor-pointer ";
                    card.className = "p-3 border rounded-lg flex flex-col md:flex-row md:items-center justify-between gap-2 shadow-sm transition-colors duration-200 ";
                    
                    if(this.value.includes('absent')) {
                        sel.className += "border-rose-300 text-rose-700 bg-white focus:border-rose-500";
                        card.className += "bg-rose-50 border-rose-200";
                    } else if(this.value === 'late') {
                        sel.className += "border-amber-300 text-amber-700 bg-white focus:border-amber-500";
                        card.className += "bg-amber-50 border-amber-200";
                    } else {
                        sel.className += "border-emerald-300 text-emerald-700 bg-white focus:border-emerald-500";
                        card.className += "bg-emerald-50 border-emerald-200";
                    }
                });
                // Trigger once immediately to set initial colors
                sel.dispatchEvent(new Event('change'));
            }
        });

        document.getElementById('modal-cancel').onclick = () => document.getElementById('custom-modal').classList.add('hidden');
        
        document.getElementById('modal-confirm').onclick = async () => {
            document.getElementById('modal-confirm').textContent = "Saving...";
            
            // Loop through all students and save their exact selected status to the cloud
            for(let st of students) {
                const status = document.getElementById(`att-status-${st}`).value;
                const existingIdx = ATTENDANCE.findIndex(a => a.scheduleId === scheduleId && a.student === st);
                
                if(existingIdx >= 0) {
                    ATTENDANCE[existingIdx].status = status;
                    await window.fsSetDoc(window.fsDoc(window.db, window.fPath('attendance'), ATTENDANCE[existingIdx].id), ATTENDANCE[existingIdx]);
                } else {
                    const newAtt = {
                        id: 'att_' + Date.now() + '_' + Math.random().toString(36).substr(2,9),
                        scheduleId: scheduleId,
                        date: sched.date,
                        student: st,
                        status: status,
                        className: sched.className
                    };
                    ATTENDANCE.push(newAtt);
                    await window.fsSetDoc(window.fsDoc(window.db, window.fPath('attendance'), newAtt.id), newAtt);
                }
            }
            
            document.getElementById('modal-confirm').textContent = "Confirm";
            document.getElementById('custom-modal').classList.add('hidden');
            
            // Re-render the calendar to show the saved state
            window.renderCalendar('teacher');
            window.selectDate(sched.date, 'teacher');
        };
    }
