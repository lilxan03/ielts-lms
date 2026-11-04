    window.exportTestPDF = function() {
        if (!APP_DATA || !APP_DATA.title) {
            alert("No test loaded to print.");
            return;
        }

        const printWindow = window.open('', '_blank');
        let html = `
        <!DOCTYPE html>
        <html>
        <head>
            <title>${APP_DATA.title} - Print PDF</title>
            <style>
                body { font-family: 'Times New Roman', serif; color: #000; line-height: 1.6; max-width: 800px; margin: 0 auto; padding: 40px; font-size: 16px; }
                h1 { text-align: center; font-size: 26px; text-transform: uppercase; margin-bottom: 5px; }
                .meta { text-align: center; font-size: 14px; color: #555; margin-bottom: 40px; font-style: italic; }
                h2 { font-size: 20px; margin-top: 40px; border-bottom: 2px solid #000; padding-bottom: 5px; }
                .passage { margin-bottom: 30px; text-align: justify; }
                .passage img { max-width: 100%; height: auto; display: block; margin: 15px auto; border: 1px solid #ccc; }
                .q-block { margin-bottom: 25px; padding: 15px; border: 1px solid #e2e8f0; border-left: 4px solid #94a3b8; background: #f8fafc; border-radius: 4px; break-inside: avoid; }
                .q-inst { font-weight: bold; margin-bottom: 12px; font-size: 15px; }
                .q-text { margin-bottom: 12px; }
                .q-opts { margin-left: 10px; margin-bottom: 10px; font-size: 15px; }
                .q-opts ul { list-style-type: square; margin-top: 5px; padding-left: 20px; }
                .blank { display: inline-block; border-bottom: 1px solid #000; min-width: 50px; text-align: center; font-weight: bold; margin: 0 5px; color: #000; }
                table { width: 100%; border-collapse: collapse; margin-bottom: 15px; }
                table, th, td { border: 1px solid #000; padding: 8px; }
            </style>
        </head>
        <body>
            <h1>${APP_DATA.title}</h1>
            <div class="meta">Module: ${APP_DATA.module.toUpperCase()} &bull; Total Parts: ${APP_DATA.parts.length}</div>
        `;

        APP_DATA.parts.forEach((p, pIdx) => {
            html += `<h2>${p.title || 'Part ' + (pIdx + 1)}</h2>`;
            if (p.image && APP_DATA.module !== 'writing') {
                html += `<div class="passage"><img src="${p.image}"></div>`;
            }
            if (p.text) {
                // Swap the web dropzone tokens for a physical underline!
                let pText = p.text.replace(/\{drop:(\d+)\}/g, '<span class="blank">$1</span>');
                html += `<div class="passage">${pText}</div>`;
            }

            if (p.questions && p.questions.length > 0) {
                p.questions.forEach((q) => {
                    html += `<div class="q-block">`;
                    if (q.instruction) html += `<div class="q-inst">${q.instruction}</div>`;
                    
                    let qText = q.text || '';
                    qText = qText.replace(/\{blank:(\d+)\}/g, '<span class="blank">$1</span>');
                    qText = qText.replace(/\{drop:(\d+)\}/g, '<span class="blank">$1</span>');
                    
                    if (APP_DATA.module === 'listening' && q.image && q.type !== 'map_labelling_grid' && q.type !== 'map_labelling_hotspots') {
                        html += `<div><img src="${escapeHtmlAttributeValue(q.image)}" alt="Question image" style="max-width:100%; max-height:420px; display:block; margin:10px auto;"></div>`;
                    }
                    if (q.type === 'map_labelling_grid' && q.image) {
                        html += `<div><img src="${q.image}" style="max-width:400px; display:block; margin: 10px auto;"></div>`;
                    }
                    if (q.type === 'map_labelling_hotspots' && q.image) {
                        html += `<div><img src="${q.image}" style="max-width:400px; display:block; margin: 10px auto;"></div>`;
                    }
                    
                    if (qText) html += `<div class="q-text">${qText}</div>`;
                    
                    if (q.options && q.options.length > 0) {
                        html += `<div class="q-opts"><ul>${q.options.map(o => `<li>${o}</li>`).join('')}</ul></div>`;
                    }

                    if (q.type === 'essay') {
                        html += `<div style="height: 400px; border: 1px dashed #94a3b8; margin-top: 20px; position: relative;">
                            <span style="position:absolute; top:10px; left:10px; color:#94a3b8; font-style:italic;">Write your answer here...</span>
                        </div>`;
                    } else if (q.type === 'audio_record') {
                        html += `<div style="padding: 20px; border: 1px dashed #94a3b8; margin-top: 10px; text-align:center; color:#64748b; font-style:italic;">
                            [Audio Recording Required]
                        </div>`;
                    } else if (q.type !== 'fill_blanks' && q.type !== 'dnd_list') {
                        // Give some space for writing an answer if it's multiple choice or short answer
                        html += `<div style="margin-top: 15px;"><strong>Answer(s):</strong> ______________________</div>`;
                    }
                    html += `</div>`;
                });
            }
        });

        // Append Answer Key to the very last page!
        html += `<div style="page-break-before: always;"></div>`;
        html += `<h2>Answer Key</h2>`;
        html += `<table style="width: 100%; border-collapse: collapse; font-size: 14px; text-align: left;">`;
        html += `<thead><tr style="background:#f1f5f9;"><th style="border: 1px solid #ccc; padding: 8px; width:60px;">Q ID</th><th style="border: 1px solid #ccc; padding: 8px;">Correct Answer</th><th style="border: 1px solid #ccc; padding: 8px;">Explanation</th></tr></thead><tbody>`;
        
        APP_DATA.parts.forEach(p => {
            if (p.questions) {
                p.questions.forEach(q => {
                    (q.ids || []).forEach(id => {
                        let ans = q.correctAnswers?.[id] || '';
                        let expl = q.explanation || '';
                        if (ans || expl) {
                            html += `<tr><td style="border: 1px solid #ccc; padding: 8px;"><b>${id}</b></td><td style="border: 1px solid #ccc; padding: 8px; color: #10b981; font-weight: bold;">${ans}</td><td style="border: 1px solid #ccc; padding: 8px; color: #64748b;">${expl}</td></tr>`;
                        }
                    });
                });
            }
        });
        html += `</tbody></table>`;

        html += `
            <script>
                window.onload = function() { window.print(); }
            <\/script>
        </body>
        </html>`;

        printWindow.document.write(html);
        printWindow.document.close();
    };

    
    window.exportAttendancePDF = function(studentName) {
        // Collect Data
        const studentObj = USERS.find(u => u.user === studentName);
        const studentAttendance = ATTENDANCE.filter(a => a.student === studentName);
        const studentTests = SUBMISSIONS.filter(s => s.student === studentName);

        // Calculate actual attendance metrics
        const presentCount = studentAttendance.filter(a => a.status === 'on_time' || a.status === 'late' || !a.status).length;
        const absentCount = studentAttendance.length - presentCount;
        
        const totalPaid = studentObj?.totalLessonsPaid || 0;
        const remaining = totalPaid > 0 ? Math.max(0, totalPaid - studentAttendance.length) : 'N/A';

        // Status Dictionary for beautiful print formatting
        const statusMap = {
            'on_time': '<span style="color: #10b981; font-weight: bold;">✅ On Time</span>',
            'late': '<span style="color: #f59e0b; font-weight: bold;">⚠️ Late</span>',
            'absent_adv': '<span style="color: #ef4444; font-weight: bold;">❌ Absent (Advance Permission)</span>',
            'absent_late': '<span style="color: #ef4444; font-weight: bold;">❌ Absent (Late Permission)</span>',
            'absent_none': '<span style="color: #dc2626; font-weight: bold;">❗ Absent (No Permission)</span>'
        };

        // Generate HTML Report
        const printWindow = window.open('', '_blank');
        const html = `
        <!DOCTYPE html>
        <html>
        <head>
            <title>Student Report - ${studentName}</title>
            <style>
                body { font-family: Arial, sans-serif; color: #333; padding: 40px; line-height: 1.5; }
                h1 { color: #1e3a8a; border-bottom: 2px solid #e5e7eb; padding-bottom: 10px; margin-bottom: 10px; }
                h2 { color: #374151; margin-top: 30px; font-size: 18px; border-bottom: 1px solid #e5e7eb; padding-bottom: 5px; }
                table { width: 100%; border-collapse: collapse; margin-top: 15px; font-size: 14px; }
                th, td { border: 1px solid #d1d5db; padding: 12px; text-align: left; }
                th { background-color: #f3f4f6; color: #1f2937; font-weight: bold; }
                .summary { background: #eff6ff; padding: 20px; border-radius: 8px; margin-top: 25px; border: 1px solid #bfdbfe; font-size: 15px; }
            </style>
        </head>
        <body>
            <h1>IELTS LMS - Student Report</h1>
            <p style="margin: 5px 0;"><strong>Candidate:</strong> ${studentName}</p>
            <p style="margin: 5px 0;"><strong>Date Generated:</strong> ${new Date().toLocaleDateString()}</p>
            
            <div class="summary">
                <strong>Overall Summary:</strong><br><br>
                &bull; Total Lessons Tracked: <strong>${studentAttendance.length}</strong><br>
                &bull; Enrolled / Paid Lessons: <strong>${totalPaid || 'Not Specified'}</strong><br>
                &bull; Lessons Remaining: <strong style="color: #2563eb;">${remaining}</strong><br>
                &bull; Present (Including Late): <strong style="color: #10b981;">${presentCount}</strong> | Absent: <strong style="color: #ef4444;">${absentCount}</strong><br>
                &bull; Total Tests Submitted: <strong>${studentTests.length}</strong>
            </div>

            <h2>📚 Class Attendance Schedule</h2>
            <table>
                <tr><th>Date</th><th>Class</th><th>Topic / Focus</th><th>Attendance Status</th></tr>
                ${studentAttendance.length ? studentAttendance.map(a => `<tr><td>${a.date}</td><td>${a.className}</td><td>${a.topic}</td><td>${statusMap[a.status] || '<span style="color: #10b981; font-weight: bold;">✅ Present</span>'}</td></tr>`).join('') : '<tr><td colspan="4">No records found.</td></tr>'}
            </table>

            <h2>📝 Test & Material Completion</h2>
            <table>
                <tr><th>Date</th><th>Test Name</th><th>Score / Status</th></tr>
                ${studentTests.length ? studentTests.map(t => `<tr><td>${t.date}</td><td>${t.testName}</td><td><strong>${t.score}</strong></td></tr>`).join('') : '<tr><td colspan="3">No tests submitted yet.</td></tr>'}
            </table>
            
            <scr` + `ipt>
                window.onload = function() { window.print(); }
            </scr` + `ipt>
        </body>
        </html>`;
        
        printWindow.document.write(html);
        printWindow.document.close();
    }

    // ✨ NEW: Radar Chart Editor Logic for Teachers
    window.openRadarEditor = function(username) {
        const student = USERS.find(u => u.user === username);
        if (!student) return;
        
        const data = student.radarChartData || [0, 0, 0, 0];
        
        document.getElementById('modal-title').textContent = `Edit Radar: ${username}`;
        document.getElementById('modal-message').innerHTML = `
            <div class="grid grid-cols-2 gap-4 mt-4">
                <div><label class="block text-xs font-bold text-slate-500 mb-1">Reading</label><input type="number" step="0.5" id="rad-0" value="${data[0]}" class="w-full border-2 border-slate-200 p-2 rounded outline-none focus:border-blue-500 font-bold text-blue-700 bg-slate-50"></div>
                <div><label class="block text-xs font-bold text-slate-500 mb-1">Listening</label><input type="number" step="0.5" id="rad-1" value="${data[1]}" class="w-full border-2 border-slate-200 p-2 rounded outline-none focus:border-blue-500 font-bold text-blue-700 bg-slate-50"></div>
                <div><label class="block text-xs font-bold text-slate-500 mb-1">Writing</label><input type="number" step="0.5" id="rad-2" value="${data[2]}" class="w-full border-2 border-slate-200 p-2 rounded outline-none focus:border-blue-500 font-bold text-blue-700 bg-slate-50"></div>
                <div><label class="block text-xs font-bold text-slate-500 mb-1">Speaking</label><input type="number" step="0.5" id="rad-3" value="${data[3]}" class="w-full border-2 border-slate-200 p-2 rounded outline-none focus:border-blue-500 font-bold text-blue-700 bg-slate-50"></div>
            </div>
            <p class="text-[10px] text-slate-400 mt-4 italic text-center">Set all values to 0 to revert to Auto-Calculated scores based on their test history.</p>
        `;
        document.getElementById('modal-input').classList.add('hidden');
        document.getElementById('modal-cancel').classList.remove('hidden');
        document.getElementById('custom-modal').classList.remove('hidden');

        document.getElementById('modal-cancel').onclick = () => document.getElementById('custom-modal').classList.add('hidden');
        document.getElementById('modal-confirm').onclick = async () => {
            document.getElementById('modal-confirm').textContent = "Saving...";
            const newData = [
                Number(document.getElementById('rad-0').value),
                Number(document.getElementById('rad-1').value),
                Number(document.getElementById('rad-2').value),
                Number(document.getElementById('rad-3').value)
            ];
            
            // If all are zero, delete the manual override to go back to auto-calc
            student.radarChartData = newData.every(n => n === 0) ? null : newData;
            
            try {
                await window.fsSetDoc(window.fsDoc(window.db, window.fPath('users'), username), student);
                document.getElementById('custom-modal').classList.add('hidden');
                showModalMsg("Saved", "Radar chart updated for " + username);
            } catch (err) {
                console.error(err);
                showModalMsg("Error", "Could not save radar data to cloud.");
            }
            document.getElementById('modal-confirm').textContent = "OK";
        };
    };

    // --- BOOKING SYSTEM LOGIC ---
    const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

    window.buildAvailRowHtml = function(dayIdx, start, end, isFirst) {
        return `
        <div class="flex items-center gap-3 group avail-row animate-fade-in-up mb-2 last:mb-0">
            <input type="time" class="avail-start border border-slate-300 focus:border-blue-500 p-1.5 rounded-md font-mono text-sm text-slate-700 outline-none transition w-28 text-center bg-white shadow-sm" value="${start}">
            <span class="text-slate-400 font-medium">-</span>
            <input type="time" class="avail-end border border-slate-300 focus:border-blue-500 p-1.5 rounded-md font-mono text-sm text-slate-700 outline-none transition w-28 text-center bg-white shadow-sm" value="${end}">
            
            <div class="flex items-center gap-1 opacity-60 hover:opacity-100 transition-opacity ml-2">
                <button onclick="window.removeAvailBlock(this, ${dayIdx})" class="p-1.5 text-slate-500 hover:text-rose-600 transition rounded hover:bg-rose-50" title="Remove">
                    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="4.93" y1="4.93" x2="19.07" y2="19.07"></line></svg>
                </button>
                ${isFirst ? `
                <button onclick="window.addAvailBlock(${dayIdx})" class="p-1.5 text-slate-500 hover:text-blue-600 transition rounded hover:bg-blue-50" title="Add time block">
                    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="16"></line><line x1="8" y1="12" x2="16" y2="12"></line></svg>
                </button>
                <button onclick="window.copyAvailBlock(${dayIdx})" class="p-1.5 text-slate-500 hover:text-indigo-600 transition rounded hover:bg-indigo-50" title="Copy time to all days">
                    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>
                </button>
                ` : ''}
            </div>
        </div>`;
    };

    window.buildAvailEmptyHtml = function(dayIdx) {
        return `
        <div class="flex items-center gap-3 avail-empty-state h-[38px]">
            <span class="text-sm text-slate-400 italic w-[240px]">Unavailable</span>
            <div class="flex items-center gap-1 opacity-60 hover:opacity-100 transition-opacity ml-2">
                <button onclick="window.addAvailBlock(${dayIdx})" class="p-1.5 text-slate-500 hover:text-blue-600 transition rounded hover:bg-blue-50" title="Add time block">
                    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="16"></line><line x1="8" y1="12" x2="16" y2="12"></line></svg>
                </button>
            </div>
        </div>`;
    };

    window.openAvailabilitySettings = function() {
        document.getElementById('avail-duration').value = AVAILABILITY.duration || 60;
        document.getElementById('avail-reminder').value = AVAILABILITY.reminderMinutes || 15;
        
        let html = '';
        for(let i=0; i<7; i++) {
            const dayBlocks = (AVAILABILITY.schedule && AVAILABILITY.schedule[i]) ? AVAILABILITY.schedule[i] : [];
            
            html += `
            <div class="flex items-start gap-4 py-4 border-b border-slate-100 last:border-0" id="avail-day-container-${i}">
                <div class="w-12 font-bold text-slate-700 pt-1.5 text-sm uppercase">${DAYS[i]}</div>
                <div class="flex-1 flex flex-col" id="avail-day-${i}">
                    ${dayBlocks.length > 0 ? dayBlocks.map((b, bIdx) => window.buildAvailRowHtml(i, b.start, b.end, bIdx === 0)).join('') : window.buildAvailEmptyHtml(i)}
                </div>
            </div>`;
        }
        document.getElementById('avail-weekly-grid').innerHTML = html;
        document.getElementById('availability-modal').classList.remove('hidden');
    };

    window.addAvailBlock = function(dayIdx) {
        const container = document.getElementById(`avail-day-${dayIdx}`);
        const emptyLbl = container.querySelector('.avail-empty-state');
        if(emptyLbl) emptyLbl.remove();
        
        const isFirst = container.querySelectorAll('.avail-row').length === 0;
        
        const div = document.createElement('div');
        div.innerHTML = window.buildAvailRowHtml(dayIdx, "09:00", "17:00", isFirst);
        container.appendChild(div.firstElementChild); 
    };

    window.removeAvailBlock = function(btn, dayIdx) {
        const container = document.getElementById(`avail-day-${dayIdx}`);
        const row = btn.closest('.avail-row');
        row.remove();
        
        const remainingRows = container.querySelectorAll('.avail-row');
        if(remainingRows.length === 0) {
            container.innerHTML = window.buildAvailEmptyHtml(dayIdx);
        } else {
            // Re-render remaining to ensure the top one has the tools
            const times = Array.from(remainingRows).map(r => ({
                start: r.querySelector('.avail-start').value,
                end: r.querySelector('.avail-end').value
            }));
            container.innerHTML = times.map((t, idx) => window.buildAvailRowHtml(dayIdx, t.start, t.end, idx === 0)).join('');
        }
    };

    window.copyAvailBlock = function(sourceDayIdx) {
        const sourceContainer = document.getElementById(`avail-day-${sourceDayIdx}`);
        const rows = sourceContainer.querySelectorAll('.avail-row');
        const times = Array.from(rows).map(r => ({
            start: r.querySelector('.avail-start').value,
            end: r.querySelector('.avail-end').value
        }));

        for(let i=0; i<7; i++) {
            if (i !== sourceDayIdx) {
                const targetContainer = document.getElementById(`avail-day-${i}`);
                if (times.length > 0) {
                    targetContainer.innerHTML = times.map((t, idx) => window.buildAvailRowHtml(i, t.start, t.end, idx === 0)).join('');
                } else {
                    targetContainer.innerHTML = window.buildAvailEmptyHtml(i);
                }
            }
        }
        showModalMsg("Copied", `Schedule copied from ${DAYS[sourceDayIdx]} to all other days.`);
    };

    window.saveAvailability = async function() {
        const btn = document.getElementById('btn-save-avail');
        btn.textContent = "Saving..."; btn.disabled = true;
        
        const newAvail = {
            duration: Number(document.getElementById('avail-duration').value) || 60,
            reminderMinutes: Number(document.getElementById('avail-reminder').value) || 15,
            schedule: {}
        };
        
        for(let i=0; i<7; i++) {
            newAvail.schedule[i] = [];
            const container = document.getElementById(`avail-day-${i}`);
            const blocks = container.querySelectorAll('.avail-row');
            blocks.forEach(b => {
                const start = b.querySelector('.avail-start').value;
                const end = b.querySelector('.avail-end').value;
                if(start && end) newAvail.schedule[i].push({start, end});
            });
        }
        
        try {
            await window.fsSetDoc(window.fsDoc(window.db, window.fPath('settings'), 'availability'), newAvail);
            AVAILABILITY = newAvail;
            document.getElementById('availability-modal').classList.add('hidden');
            showModalMsg("Saved", "Your weekly booking availability has been updated.");
        } catch(e) {
            console.error(e);
            showModalMsg("Error", "Could not save availability.");
        }
        btn.textContent = "Save Availability"; btn.disabled = false;
    };

    let selectedBookingSlot = null;

    window.openStudentBooking = function() {
        const cid = document.getElementById('student-class-select').value;
        if (!cid) {
            showModalMsg("Notice", "Please select a class from the top left dropdown first before booking an appointment.");
            return;
        }

        const cls = CLASSES.find(c => c.id === cid);
        if (cls && !cls.allowBooking) {
            showModalMsg("Notice", "This class does not support manual slot booking. Please wait for your teacher to schedule lessons.");
            return;
        }

        document.getElementById('book-date').value = '';
        document.getElementById('book-date-preview').innerHTML = "Select a date above to see available slots.";
        document.getElementById('book-slots-container').innerHTML = '';
        document.getElementById('btn-confirm-booking').disabled = true;
        selectedBookingSlot = null;
        document.getElementById('student-booking-modal').classList.remove('hidden');
    };

    function parseTimeToMins(timeStr) {
        const [h, m] = timeStr.split(':').map(Number);
        return h * 60 + m;
    }
    
    function formatMinsToTime(mins) {
        const h = Math.floor(mins / 60);
        const m = mins % 60;
        return `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}`;
    }

    function formatTime12(timeStr) {
        const [h, m] = timeStr.split(':').map(Number);
        const ampm = h >= 12 ? 'PM' : 'AM';
        const h12 = h % 12 || 12;
        return `${h12}:${String(m).padStart(2,'0')} ${ampm}`;
    }

    window.generateBookingSlots = function() {
        const dateStr = document.getElementById('book-date').value;
        const container = document.getElementById('book-slots-container');
        document.getElementById('btn-confirm-booking').disabled = true;
        selectedBookingSlot = null;
        
        if(!dateStr) {
            container.innerHTML = '';
            document.getElementById('book-date-preview').innerHTML = "Select a date above to see available slots.";
            return;
        }
        
        const dateObj = new Date(dateStr);
        const today = new Date();
        today.setHours(0,0,0,0);
        if (dateObj < today) {
            container.innerHTML = '<div class="p-4 bg-rose-50 text-rose-600 border border-rose-200 rounded-lg text-sm font-bold shadow-sm">❌ Cannot book an appointment in the past.</div>';
            document.getElementById('book-date-preview').innerHTML = "<span class='text-rose-500 font-bold'>Invalid date selected.</span>";
            return;
        }

        const dayOfWeek = dateObj.getDay(); // 0-6
        const dayBlocks = (AVAILABILITY.schedule && AVAILABILITY.schedule[dayOfWeek]) ? AVAILABILITY.schedule[dayOfWeek] : [];
        
        document.getElementById('book-date-preview').innerHTML = `<span class='text-indigo-600 font-bold'>Showing slots for ${dateObj.toLocaleDateString(undefined, {weekday: 'long', month: 'long', day: 'numeric'})}</span>`;
        
        if (dayBlocks.length === 0) {
            container.innerHTML = '<div class="p-4 bg-slate-50 text-slate-500 border border-slate-200 rounded-lg text-sm italic shadow-sm">Your teacher is completely unavailable on this day. Please select a different date.</div>';
            return;
        }

        const dayScheds = SCHEDULES.filter(s => s.date === dateStr);
        const bookedIntervals = dayScheds.map(s => {
            const match = s.time.match(/(\d+):(\d+)\s*(AM|PM)/i);
            if(match) {
                let h = parseInt(match[1]);
                let m = parseInt(match[2]);
                const ampm = match[3].toUpperCase();
                if(ampm === 'PM' && h < 12) h += 12;
                if(ampm === 'AM' && h === 12) h = 0;
                const startMins = h * 60 + m;
                // Treat existing scheduled items as blocking a full duration slot
                return { start: startMins, end: startMins + (AVAILABILITY.duration || 60) };
            }
            return null;
        }).filter(Boolean);

        let slotsHtml = '';
        const dur = AVAILABILITY.duration || 60;
        let hasSlots = false;

        dayBlocks.forEach(b => {
            let startMins = parseTimeToMins(b.start);
            const endMins = parseTimeToMins(b.end);
            
            while (startMins + dur <= endMins) {
                const slotStartMins = startMins;
                const slotEndMins = startMins + dur;
                
                // Logic: A slot is blocked if (StartA < EndB) and (EndA > StartB)
                const isOverlapping = bookedIntervals.some(booked => {
                    return (slotStartMins < booked.end) && (slotEndMins > booked.start);
                });

                if (!isOverlapping) {
                    const startStr24 = formatMinsToTime(slotStartMins);
                    const endStr24 = formatMinsToTime(slotEndMins);
                    const start12 = formatTime12(startStr24);
                    const end12 = formatTime12(endStr24);
                    
                    slotsHtml += `
                    <div onclick="window.selectBookingSlot('${startStr24}')" id="slot-card-${startStr24.replace(':','')}" class="p-4 border-2 border-slate-200 bg-white rounded-xl cursor-pointer hover:border-indigo-400 hover:bg-indigo-50 transition flex justify-between items-center group shadow-sm hover:shadow-md">
                        <div>
                            <div class="font-black text-indigo-900 text-lg">${start12} - ${end12}</div>
                            <div class="text-xs text-slate-500 font-bold uppercase tracking-widest mt-1">${dur} minutes</div>
                        </div>
                        <div class="w-6 h-6 rounded-full border-2 border-slate-300 group-hover:border-indigo-400 flex items-center justify-center bg-white transition-colors" id="slot-radio-${startStr24.replace(':','')}"></div>
                    </div>`;
                    hasSlots = true;
                }
                
                startMins += dur;
            }
        });
        
        if(!hasSlots) {
            container.innerHTML = '<div class="p-4 bg-slate-50 text-slate-500 border border-slate-200 rounded-lg text-sm italic shadow-sm">All available slots are already booked for this day. Try another date.</div>';
        } else {
            container.innerHTML = slotsHtml;
        }
    };

    window.selectBookingSlot = function(slotVal) {
        document.querySelectorAll('[id^="slot-card-"]').forEach(el => {
            el.className = "p-4 border-2 border-slate-200 bg-white rounded-xl cursor-pointer hover:border-indigo-400 hover:bg-indigo-50 transition flex justify-between items-center group shadow-sm hover:shadow-md";
        });
        document.querySelectorAll('[id^="slot-radio-"]').forEach(el => {
            el.className = "w-6 h-6 rounded-full border-2 border-slate-300 group-hover:border-indigo-400 flex items-center justify-center bg-white transition-colors";
            el.innerHTML = '';
        });
        
        const cardId = `slot-card-${slotVal.replace(':','')}`;
        const radioId = `slot-radio-${slotVal.replace(':','')}`;
        
        const card = document.getElementById(cardId);
        const radio = document.getElementById(radioId);
        if(card && radio) {
            card.className = "p-4 border-2 border-indigo-600 bg-indigo-50 rounded-xl cursor-pointer transition flex justify-between items-center shadow-md transform scale-[1.02]";
            radio.className = "w-6 h-6 rounded-full border-2 border-indigo-600 flex items-center justify-center bg-white transition-colors";
            radio.innerHTML = '<div class="w-3 h-3 bg-indigo-600 rounded-full"></div>';
        }
        
        selectedBookingSlot = slotVal;
        document.getElementById('btn-confirm-booking').disabled = false;
    };

    window.confirmBooking = async function() {
        if (!selectedBookingSlot) return;
        
        const dateStr = document.getElementById('book-date').value;
        const cid = document.getElementById('student-class-select').value;
        const cls = CLASSES.find(c => c.id === cid);
        
        if (!window.isSchedulableClass(cls)) {
            showModalMsg("Mini Class Required", "Class bookings can only be created for an active mini class, not its parent class.");
            return;
        }

        const btn = document.getElementById('btn-confirm-booking');
        btn.textContent = "Booking..."; btn.disabled = true;

        const time12 = formatTime12(selectedBookingSlot);

        const newSched = { 
            id: 'sch_'+Date.now(), 
            classId: cls.id,
            className: cls.name, 
            date: dateStr, 
            time: time12, 
            topic: `Booking: ${currentUser.user}`, 
            assignedTests: [], 
            attendingStudents: [currentUser.user], 
            dateAdded: new Date().toLocaleDateString(),
            isNewBooking: true // ✨ NEW: Trigger Teacher Notification
        };
        
        SCHEDULES.push(newSched);
        try {
            await window.fsSetDoc(window.fsDoc(window.db, window.fPath('schedules'), newSched.id), newSched);
            document.getElementById('student-booking-modal').classList.add('hidden');
            window.renderCalendar('student');
            
            showModalMsg("Booking Confirmed! 🎉", `Your class is scheduled for ${new Date(dateStr).toLocaleDateString()} at ${time12}. Check your timetable.`);
        } catch(e) {
            console.error(e);
            showModalMsg("Error", "Could not save booking.");
        }
        
        btn.textContent = "Confirm Booking"; btn.disabled = false;
    };

    // --- STUDENT PROFILE & TARGETS LOGIC ---
    let tempAvatarBase64 = null;

    window.openStudentProfile = async function() {
        try {
            if (currentUser.isDemo) {
                currentUser.referralCode = currentUser.referralCode || 'DEMO-ONLY';
            } else {
                currentUser = await ensureStudentReferralIdentity(currentUser);
            }
            sessionStorage.setItem('ielts_session', JSON.stringify(currentUser));
        } catch (error) {
            console.error('Unable to prepare student referral code:', error);
            showModalMsg("Referral Code Error", "Could not load your referral code. Please try again later.");
            return;
        }
        tempAvatarBase64 = currentUser.avatar || null;
        document.getElementById('profile-name-display').textContent = currentUser.user;
        document.getElementById('profile-avatar-preview').src = tempAvatarBase64 || `https://ui-avatars.com/api/?name=${currentUser.user}&background=random`;
        document.getElementById('profile-target-score').value = currentUser.targetScore || '';
        document.getElementById('profile-test-date').value = currentUser.testDate || '';
        document.getElementById('profile-referral-code').value = currentUser.referralCode;
        const referralCredits = Math.max(0, Number(currentUser.referralDiscountCredits) || 0);
        document.getElementById('profile-referral-credits').textContent = `${referralCredits} referral discount${referralCredits === 1 ? '' : 's'} available for future payments.`;
        document.getElementById('profile-renewal-button').classList.toggle('hidden', (!currentUser.isPaid && getBillingExpiryMillis(currentUser) === null) || currentUser.paymentStatus === 'pending');
        document.getElementById('student-profile-modal').classList.remove('hidden');
    };

    window.copyReferralCode = async function() {
        const input = document.getElementById('profile-referral-code');
        if (!input?.value) return;
        try {
            await navigator.clipboard.writeText(input.value);
            if (typeof window.showToast === 'function') window.showToast("Copied", "Referral code copied to clipboard.");
        } catch (error) {
            console.error('Unable to copy referral code:', error);
            input.select();
            document.execCommand('copy');
            if (typeof window.showToast === 'function') window.showToast("Referral Code", "Select and copy the highlighted code.");
        }
    };

    window.handleAvatarUpload = function(e) {
        const file = e.target.files[0];
        if (!file) return;
        
        const preview = document.getElementById('profile-avatar-preview');
        preview.style.opacity = '0.5';
        
        const reader = new FileReader();
        reader.onload = (ev) => {
            const img = new Image();
            img.onload = () => {
                const canvas = document.createElement('canvas');
                let size = 200; // Force tiny square
                canvas.width = size; canvas.height = size;
                const ctx = canvas.getContext('2d');
                // Crop to center
                const min = Math.min(img.width, img.height);
                const sx = (img.width - min) / 2;
                const sy = (img.height - min) / 2;
                ctx.drawImage(img, sx, sy, min, min, 0, 0, size, size);
                
                canvas.toBlob(async (blob) => {
                    const path = 'avatars/' + currentUser.user + '_' + Date.now() + '.jpg';
                    try {
                        const url = await window.uploadMediaToStorage(blob, path);
                        tempAvatarBase64 = url;
                        preview.src = tempAvatarBase64;
                    } catch (err) {
                        console.error("Avatar Upload Error:", err);
                        alert("Failed to upload avatar.");
                    }
                    preview.style.opacity = '1';
                }, 'image/jpeg', 0.8);
            };
            img.src = ev.target.result;
        };
        reader.readAsDataURL(file);
    };

    window.saveStudentProfile = async function() {
        const btn = document.getElementById('btn-save-profile-data');
        btn.textContent = "Saving..."; btn.disabled = true;

        currentUser.targetScore = document.getElementById('profile-target-score').value;
        currentUser.testDate = document.getElementById('profile-test-date').value;
        if(tempAvatarBase64) currentUser.avatar = tempAvatarBase64;

        try {
            const cloudUserIdx = USERS.findIndex(u => u.user === currentUser.user);
            if(cloudUserIdx > -1) USERS[cloudUserIdx] = currentUser;
            if (!currentUser.isDemo) {
                await window.fsSetDoc(window.fsDoc(window.db, window.fPath('users'), currentUser.user), currentUser);
            }
            sessionStorage.setItem('ielts_session', JSON.stringify(currentUser));
            
            document.getElementById('student-profile-modal').classList.add('hidden');
            window.updateDashboardHeader();
            showModalMsg("Profile Updated", "Your goals and avatar have been saved successfully!");
        } catch(e) {
            console.error(e);
            showModalMsg("Error", "Could not save profile.");
        }
        btn.textContent = "Save Profile"; btn.disabled = false;
    };

    window.updateDashboardHeader = function() {
        if(!currentUser || currentUser.role !== 'student') return;
        
        document.getElementById('student-name-display').textContent = window.getStudentDisplayName
            ? window.getStudentDisplayName(currentUser)
            : window.LMSAuthHelpers.getStudentDisplayName(currentUser, window.auth?.currentUser);
        
        const avt = document.getElementById('header-student-avatar');
        if(avt && avt.tagName === 'IMG') {
            avt.src = currentUser.avatar || `https://ui-avatars.com/api/?name=${currentUser.user}&background=random`;
        }
        
        const display = document.getElementById('student-gem-display');
        if (display) {
            display.textContent = (currentUser.gems || 0).toLocaleString();
        }

        const isPaid = hasActiveStudentAccess(currentUser);

        // Gem Widget Visibility
        const gemW = document.getElementById('gem-balance-widget');
        if (gemW) {
            if (isPaid) {
                gemW.classList.remove('hidden');
                gemW.classList.add('flex');
            } else {
                gemW.classList.add('hidden');
                gemW.classList.remove('flex');
            }
        }

        // Streak Widget Visibility
        const streakW = document.getElementById('streak-widget');
        if (streakW) {
            if (isPaid) {
                streakW.classList.remove('hidden');
                streakW.classList.add('flex');
                document.getElementById('student-streak-display').textContent = (currentUser.currentStreak || 0);
            } else {
                streakW.classList.add('hidden');
                streakW.classList.remove('flex');
            }
        }
        
        const w = document.getElementById('student-target-widget');
        if(isPaid && (currentUser.targetScore || currentUser.testDate)) {
            w.classList.remove('hidden'); w.classList.add('flex');
            document.getElementById('target-score-display').textContent = currentUser.targetScore ? `Band ${currentUser.targetScore}` : '--';
            
            if(currentUser.testDate) {
                const d = new Date(currentUser.testDate);
                document.getElementById('target-date-display').textContent = d.toLocaleDateString(undefined, {month:'short', day:'numeric', year:'numeric'});
                
                const diffTime = d.getTime() - new Date().getTime();
                const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
                const cd = document.getElementById('target-countdown');
                
                if(diffDays > 0) {
                    cd.textContent = `🔥 ${diffDays} Days Left! Keep Pushing!`;
                    cd.className = "text-xs sm:text-sm font-bold px-3 py-1.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 shadow-sm w-max mx-auto sm:mx-0";
                } else if(diffDays === 0) {
                    cd.textContent = "⚠️ THE TEST IS TODAY! Good luck!";
                    cd.className = "text-xs sm:text-sm font-black px-3 py-1.5 rounded-full bg-amber-100 text-amber-800 border border-amber-300 shadow-sm animate-pulse w-max mx-auto sm:mx-0";
                } else {
                    cd.textContent = "Test Date Passed.";
                    cd.className = "text-xs sm:text-sm font-bold px-3 py-1.5 rounded-full bg-slate-100 text-slate-500 border border-slate-200 shadow-sm w-max mx-auto sm:mx-0";
                }
            }
        } else {
            w.classList.add('hidden'); w.classList.remove('flex');
        }

        // Apply Custom Mascot & Background Theme ONLY if paid
        if(typeof window.applyStudentCustomizations === 'function') {
            if (isPaid) {
                window.applyStudentCustomizations();
            } else {
                // Revert to defaults to hide customization on checkout page
                const dashboardBanner = document.getElementById('student-banner-bg');
                if (dashboardBanner) {
                    dashboardBanner.className = "bg-blue-900 pt-8 pb-32 px-6 lg:px-8 shadow-inner relative overflow-hidden transition-all duration-1000";
                }
                const avatarDisplay = document.getElementById('header-student-avatar');
                if (avatarDisplay && avatarDisplay.tagName !== 'IMG') {
                     avatarDisplay.outerHTML = `<img id="header-student-avatar" src="${currentUser.avatar || `https://ui-avatars.com/api/?name=${currentUser.user}&background=random`}" class="w-8 h-8 sm:w-9 sm:h-9 rounded-lg object-cover bg-white shadow-sm border border-white/30 cursor-pointer" onclick="window.openStudentProfile()">`;
                }
            }
        }
    };

    // ✨ NEW: Daily Streak Logic Handler
    window.checkDailyStreak = async function() {
        // Halt streak logic if user hasn't unlocked the course yet
        if (!currentUser || currentUser.role !== 'student' || !hasActiveStudentAccess(currentUser)) return;

        const today = new Date();
        const todayStr = `${today.getFullYear()}-${String(today.getMonth()+1).padStart(2,'0')}-${String(today.getDate()).padStart(2,'0')}`;
        
        let needsSave = false;
        let streakIncreased = false;

        if (!currentUser.lastLoginDate) {
            // First time ever logging in
            currentUser.lastLoginDate = todayStr;
            currentUser.currentStreak = 1;
            needsSave = true;
            streakIncreased = true;
        } else if (currentUser.lastLoginDate !== todayStr) {
            const lastDate = new Date(currentUser.lastLoginDate);
            lastDate.setHours(0,0,0,0);
            const todayMidnight = new Date(todayStr);
            todayMidnight.setHours(0,0,0,0);
            
            const diffTime = Math.abs(todayMidnight - lastDate);
            const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24)); 

            if (diffDays === 1) {
                // Streak continues! (+1 day)
                currentUser.currentStreak = (currentUser.currentStreak || 0) + 1;
                streakIncreased = true;
            } else if (diffDays > 1) {
                // Streak broken. Reset to 1.
                currentUser.currentStreak = 1;
                streakIncreased = true; 
            }
            currentUser.lastLoginDate = todayStr;
            needsSave = true;
        }

        if (needsSave) {
            if(streakIncreased) {
                currentUser.gems = (currentUser.gems || 0) + 10; // Daily +10 Gems Bonus
            }
            
            try {
                if (!currentUser.isDemo) {
                    await window.fsSetDoc(window.fsDoc(window.db, window.fPath('users'), currentUser.user), currentUser);
                }
                sessionStorage.setItem('ielts_session', JSON.stringify(currentUser));
                window.updateDashboardHeader();
                
                if (streakIncreased) {
                    setTimeout(() => {
                        window.playStreakAnimation();
                        showModalMsg("🔥 Daily Login Bonus!", `You are on a ${currentUser.currentStreak}-day streak! You earned +10 💎 Gems for visiting today. Come back tomorrow to keep the flame alive!`);
                    }, 500);
                }
            } catch(e) { console.error("Streak save error", e); }
        }
    };

    window.playStreakAnimation = function() {
        const widget = document.getElementById('streak-widget');
        if(!widget) return;
        widget.classList.add('scale-125', 'ring-4', 'ring-rose-400');
        setTimeout(() => {
            widget.classList.remove('scale-125', 'ring-4', 'ring-rose-400');
        }, 500);
    };

    const originalInitDashboard = initStudentDashboard;
    initStudentDashboard = function(preserveCid = null) {
        originalInitDashboard(preserveCid);
        window.updateDashboardHeader();
        // Check Streak every time they load the dashboard!
        window.checkDailyStreak();
    };

    // --- COURSE FORUM LOGIC ---
    let currentForumThreadId = null;
    let currentForumEditId = null;
    let FORUM_POSTS = [];

    const escapeForumHtml = (value = '') => String(value)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');

    const seedForumDemoData = () => {
        if (FORUM_POSTS.length) return;
        FORUM_POSTS = [
            {
                id: 'forum_demo_1',
                kind: 'forum',
                parentId: null,
                threadId: 'forum_demo_1',
                title: 'Can someone explain why Q5 is False and not Not Given?',
                text: 'I am unsure how to distinguish this one from the passage. Could someone walk me through the evidence?',
                author: 'Alicia',
                avatar: 'https://ui-avatars.com/api/?name=Alicia&background=0f766e&color=fff',
                role: 'student',
                timestamp: Date.now() - 1000 * 60 * 45
            },
            {
                id: 'forum_demo_reply_1',
                kind: 'forum',
                parentId: 'forum_demo_1',
                threadId: 'forum_demo_1',
                text: 'The clue is the phrase “the writer clearly states...” which makes it a definite False statement, whereas Not Given would mean the passage never mentions the idea.',
                author: 'Teacher Maya',
                avatar: 'https://ui-avatars.com/api/?name=Teacher+Maya&background=7c3aed&color=fff',
                role: 'teacher',
                timestamp: Date.now() - 1000 * 60 * 20
            }
        ];
        CHAT_MESSAGES = [...FORUM_POSTS];
    };
