    window.parseClassDateTime = function(dateStr, timeStr) {
        if (!dateStr || !timeStr) return null;
        const dateMatch = String(dateStr).match(/^(\d{4})-(\d{2})-(\d{2})$/);
        const timeMatch = String(timeStr).trim().match(/^(?:(\d{1,2}):([0-5]\d)\s*(AM|PM)|([01]?\d|2[0-3]):([0-5]\d))$/i);
        if (!dateMatch || !timeMatch) return null;

        const [, year, month, day] = dateMatch;
        let hour = Number(timeMatch[1] || timeMatch[4]);
        const minute = Number(timeMatch[2] || timeMatch[5]);
        if (timeMatch[3]) {
            if (hour < 1 || hour > 12) return null;
            if (timeMatch[3].toUpperCase() === 'PM' && hour < 12) hour += 12;
            if (timeMatch[3].toUpperCase() === 'AM' && hour === 12) hour = 0;
        }

        const parsed = new Date(Number(year), Number(month) - 1, Number(day), hour, minute, 0, 0);
        if (parsed.getFullYear() !== Number(year) || parsed.getMonth() !== Number(month) - 1 || parsed.getDate() !== Number(day)) return null;
        return parsed;
    };

    window.formatClassTime = function(timeStr) {
        const match = String(timeStr || '').match(/^([01]?\d|2[0-3]):([0-5]\d)$/);
        if (!match) return '';
        const hour = Number(match[1]);
        return `${hour % 12 || 12}:${match[2]} ${hour >= 12 ? 'PM' : 'AM'}`;
    };

    window.scheduleBelongsToClass = function(schedule, cls) {
        if (!schedule || !cls) return false;
        return schedule.classId ? schedule.classId === cls.id : schedule.className === cls.name;
    };

    window.getScheduleClassLabel = function(schedule) {
        if (!schedule) return '';
        return schedule.miniClassParentId && schedule.miniClassName
            ? `${schedule.className} · ${schedule.miniClassName}`
            : schedule.className || '';
    };

    window.checkUpcomingClasses = function() {
        if (!currentUser || !SCHEDULES || SCHEDULES.length === 0) return;
        if (currentUser.role === 'student' && !hasActiveStudentAccess(currentUser)) return;
        
        const reminderMins = AVAILABILITY.reminderMinutes || 15;
        const now = new Date();
        
        SCHEDULES.forEach(s => {
            // Determine if the current user is involved in this class
            let isMe = false;
            if (currentUser.role === 'teacher') {
                isMe = true;
            } else if (currentUser.role === 'student') {
                if (s.attendingStudents) {
                    if (s.attendingStudents.includes(currentUser.user)) isMe = true;
                } else {
                    // Check if they are enrolled in the overarching class (Legacy fallback)
                    const cls = CLASSES.find(c => s.classId ? c.id === s.classId : c.name === s.className);
                    if (cls && cls.enrolledStudents && cls.enrolledStudents.includes(currentUser.user)) {
                        isMe = true;
                    }
                }
            }
            
            if (!isMe) return;
            
            const classTime = window.parseClassDateTime(s.date, s.time);
            if (!classTime) return;
            
            const diffMs = classTime - now;
            const diffMins = Math.floor(diffMs / 60000);
            
            // If class is within the reminder window and hasn't been notified yet today
            if (diffMins > 0 && diffMins <= reminderMins) {
                if (!window.notifiedClasses.has(s.id)) {
                    window.notifiedClasses.add(s.id);
                    
                    if (typeof window.showToast === 'function') {
                        window.showToast(
                            `Upcoming Class: ${s.className}`, 
                            `Starts in ${diffMins} minute(s) at ${s.time}.`, 
                            'info' // Forces the blue styling
                        );
                    }
                }
            }
            
            // Clean up old notifications from memory so they trigger again if edited/rescheduled
            if (diffMins < -120 && window.notifiedClasses.has(s.id)) {
                window.notifiedClasses.delete(s.id);
            }
        });
    };

    window.notifiedDeadlines = new Set();
    window.checkHomeworkDeadlines = function() {
        if (!currentUser || currentUser.role !== 'student' || !CLASSES) return;
        const now = new Date();
        const cid = document.getElementById('student-class-select')?.value;
        if(!cid) return;
        const cls = CLASSES.find(c => c.id === cid);
        if(!cls || window.isTemplateClass(cls) || !(cls.enrolledStudents || []).includes(currentUser.user)) return;

        const mySubs = SUBMISSIONS.filter(s => s.student === currentUser.user && s.className === cls.name);
        const completedTestIds = mySubs.map(s => s.testId);
        const classSchedules = SCHEDULES.filter(schedule => window.scheduleBelongsToClass(schedule, cls) && (!schedule.attendingStudents || schedule.attendingStudents.includes(currentUser.user)));
        const deadlineTestIds = [...new Set([
            ...getClassAssignedTests(cls),
            ...classSchedules.flatMap(schedule => schedule.homeworkTests || []),
            ...Object.keys(cls.testSettings || {})
        ])];

        deadlineTestIds.forEach(tid => {
            if (completedTestIds.includes(tid)) return; // Already done
            const settings = getClassTestSettings(cls, tid);
            if (!settings.dueDate) return;

            const dueStr = settings.dueDate + (settings.dueTime ? 'T' + settings.dueTime : 'T23:59');
            const dueDate = new Date(dueStr);
            if (isNaN(dueDate)) return;

            const diffMs = dueDate - now;
            const diffHours = diffMs / (1000 * 60 * 60);

            // Notify if due within 24 hours and not yet notified
            if (diffHours > 0 && diffHours <= 24) {
                const notifKey = `${tid}_${settings.dueDate}`;
                if (!window.notifiedDeadlines.has(notifKey)) {
                    window.notifiedDeadlines.add(notifKey);
                    const t = TEST_BANK.find(x => x.id === tid);
                    const title = t ? t.title : 'Homework';
                    if (typeof window.showToast === 'function') {
                        window.showToast(
                            `⏰ Homework Due Soon!`, 
                            `${title} is due in ${Math.round(diffHours)} hours.`, 
                            'info'
                        );
                    }
                    if (typeof window.fireLocalOSNotification === 'function') {
                        window.fireLocalOSNotification(`⏰ Homework Due Soon!`, `${title} is due in ${Math.round(diffHours)} hours.`);
                    }
                }
            }
        });
    };

    window.submitClassFeedback = async function(schedId) {
        const text = document.getElementById(`feedback-${schedId}`).value.trim();
        const sched = SCHEDULES.find(s => s.id === schedId);
        if (!sched) return;
        
        if (!sched.studentFeedback) sched.studentFeedback = {};
        sched.studentFeedback[currentUser.user] = text;
        
        try {
            await window.fsSetDoc(window.fsDoc(window.db, window.fPath('schedules'), sched.id), sched);
            if (typeof window.showToast === 'function') window.showToast("Saved", "Thank you for your feedback!");
        } catch(e) {
            console.error(e);
            showModalMsg("Error", "Could not save feedback.");
        }
    };


    // --- LIVE VIDEO CLASS LOGIC (GOOGLE MEET) ---
    window.joinLiveClass = function(scheduleId, topic) {
        const sched = SCHEDULES.find(s => s.id === scheduleId);
        if (!sched) return;

        const cls = CLASSES.find(c => window.scheduleBelongsToClass(sched, c));
        if (!cls) {
            showModalMsg("No Meeting Link", "Your teacher hasn't set a Google Meet link for this class yet.");
            return;
        }

        if (currentUser?.role === 'student') {
            const isEnrolled = hasActiveStudentAccess(currentUser) &&
                (cls.enrolledStudents || []).includes(currentUser.user);
            const isAttending = !sched.attendingStudents ||
                sched.attendingStudents.includes(currentUser.user);
            if (!isEnrolled || !isAttending) {
                showModalMsg("Access denied", "This class is not assigned to your account.");
                return;
            }
        } else if (!['teacher', 'collaborator'].includes(currentUser?.role)) {
            showModalMsg("Access denied", "Please sign in with an authorized account to join this class.");
            return;
        }

        const meetingLink = sched.link || cls.meetLink;
        if (!meetingLink) {
            showModalMsg("No Meeting Link", "Your teacher hasn't set a Google Meet link for this class yet.");
            return;
        }

        let roomUrl;
        try {
            roomUrl = new URL(meetingLink.trim().match(/^https?:\/\//i) ? meetingLink.trim() : `https://${meetingLink.trim()}`);
        } catch (error) {
            showModalMsg("Invalid Meeting Link", "The meeting link set by your teacher is invalid.");
            return;
        }
        if (!['http:', 'https:'].includes(roomUrl.protocol)) {
            showModalMsg("Invalid Meeting Link", "The meeting link must use HTTP or HTTPS.");
            return;
        }
        roomUrl = roomUrl.href;
        
        const newWindow = window.open(roomUrl, '_blank');
        
        if (!newWindow || newWindow.closed || typeof newWindow.closed == 'undefined') {
            showModalMsg("Browser Blocked the Tab", `Your browser blocked the video class from opening. Please click the link below to join manually:<br><br><a href="${roomUrl}" target="_blank" class="text-blue-600 font-bold underline break-all">${roomUrl}</a>`);
        } else {
            const dayModal = document.getElementById('student-day-modal');
            if (dayModal) dayModal.classList.add('hidden');
        }
    };

    window.updateClassMeetLink = async function(cid, link) {
        const cls = CLASSES.find(c => c.id === cid);
        if(cls) {
            cls.meetLink = link.trim();
            await window.fsSetDoc(window.fsDoc(window.db, window.fPath('classes'), cls.id), cls);
            if (typeof window.showToast === 'function') window.showToast("Saved", "Google Meet link updated.");
        }
    };

   // ==========================================
    // SMART PASTE HANDLER FOR RICH EDITORS
    // ==========================================
    document.addEventListener('paste', function(e) {
        const editor = e.target.closest('.rich-editor');
        if (!editor) return;

        e.preventDefault();
        
        const html = e.clipboardData.getData('text/html');
        const plainText = e.clipboardData.getData('text/plain');

        // 1. IF PLAIN TEXT (or user used Ctrl+Shift+V)
        if (!html) {
            const formattedText = plainText.replace(/\n/g, '<br>');
            document.execCommand('insertHTML', false, formattedText);
            if (window.triggerEditorAutosave) window.triggerEditorAutosave();
            return;
        }

        // 2. IF FORMATTED TEXT (Sanitize to remove inline styles, fonts, and colors)
        const doc = new DOMParser().parseFromString(html, 'text/html');
        // Allowed tags (removes span, div, style, script, etc.)
        const allowedTags = ['B', 'I', 'U', 'STRONG', 'EM', 'P', 'BR', 'UL', 'OL', 'LI', 'TABLE', 'THEAD', 'TBODY', 'TR', 'TH', 'TD', 'H1', 'H2', 'H3'];
        
        function cleanNode(node) {
            // Keep text nodes
            if (node.nodeType === 3) return document.createTextNode(node.textContent);
            // Ignore comments or other node types
            if (node.nodeType !== 1) return document.createDocumentFragment();

            let newNode;
            if (allowedTags.includes(node.nodeName)) {
                // Standardize bold/italics
                const tagName = node.nodeName === 'STRONG' ? 'B' : (node.nodeName === 'EM' ? 'I' : node.nodeName);
                newNode = document.createElement(tagName);
                
                // Preserve table structures
                if (node.hasAttribute('colspan')) newNode.setAttribute('colspan', node.getAttribute('colspan'));
                if (node.hasAttribute('rowspan')) newNode.setAttribute('rowspan', node.getAttribute('rowspan'));
                
                // Automatically style pasted tables to match LMS theme
                if (tagName === 'TABLE') newNode.className = 'border-collapse border border-slate-300 mb-4 bg-white w-full';
                if (tagName === 'TH' || tagName === 'TD') newNode.className = 'border border-slate-300 p-2';
                
            } else {
                // If tag is NOT allowed (like <span> or <div>), unwrap it and keep its children
                newNode = document.createDocumentFragment();
            }

            for (let child of Array.from(node.childNodes)) {
                newNode.appendChild(cleanNode(child));
            }
            return newNode;
        }

        const frag = document.createDocumentFragment();
        for (let child of Array.from(doc.body.childNodes)) {
            frag.appendChild(cleanNode(child));
        }

        const temp = document.createElement('div');
        temp.appendChild(frag);
        
        document.execCommand('insertHTML', false, temp.innerHTML);
        if (window.triggerEditorAutosave) window.triggerEditorAutosave();
    });
    
    // ==========================================
    // ✨ SMART TEMPLATE MANAGER & UNIFIED EDITOR
    // ==========================================

    window.currentTemplateId = null;
    const TEMPLATE_QUESTION_TYPES = {
        reading: [
            ['multiple_choice', 'Multiple Choice'],
            ['fill_blanks', 'Gap Fill'],
            ['dnd_list', 'Drag & Drop'],
            ['tfng', 'True / False / Not Given'],
            ['ynng', 'Yes / No / Not Given'],
            ['matching_headings', 'Matching Headings'],
            ['matching_info', 'Matching Information'],
            ['map_labelling_hotspots', 'Map Labelling (Hotspots)'],
            ['map_labelling_grid', 'Map Labelling (Grid)']
        ],
        listening: [
            ['multiple_choice', 'Multiple Choice'],
            ['fill_blanks', 'Gap Fill'],
            ['dnd_list', 'Drag & Drop'],
            ['map_labelling_hotspots', 'Map Labelling (Hotspots)'],
            ['map_labelling_grid', 'Map Labelling (Grid)']
        ],
        writing: [['essay', 'Writing Essay']],
        speaking: [['audio_record', 'Audio Recording'], ['essay', 'Notes / Text Box']]
    };
    const getTemplateAssignmentKey = (skill, type) => `${skill}:${type}`;
