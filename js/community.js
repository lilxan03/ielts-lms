    window.toggleForumPanel = function(forceOpen = false) {
        if (routerReady && !appRouterApplying && currentUser) {
            const panel = document.getElementById('chat-panel');
            const isOpen = panel && !panel.classList.contains('hidden');
            const rolePath = ['teacher', 'collaborator'].includes(currentUser.role) ? 'teacher/forum' : 'student/forum';
            window.navigateAppRoute(forceOpen || !isOpen ? rolePath : (rolePath.startsWith('teacher') ? 'teacher/bank/tests' : 'student/dashboard'));
            return;
        }
        let p = document.getElementById('chat-panel');

        if (!p) {
            const chatHtml = `
            <div id="chat-panel" class="hidden fixed inset-0 bg-slate-900/80 z-[800] flex items-center justify-center backdrop-blur-md md:p-6 animate-fade-in">
                <div class="bg-white md:rounded-[2rem] shadow-2xl flex flex-col w-full max-w-6xl h-full md:h-[90vh] overflow-hidden border border-slate-200 animate-scale-up">
                    <div class="bg-indigo-950 text-white p-5 md:p-6 flex justify-between items-center shrink-0 shadow-md z-20">
                        <h2 class="font-black flex items-center gap-3 text-xl md:text-2xl tracking-tight"><span class="bg-white/20 p-2 rounded-xl shadow-inner leading-none">🗂️</span> Course Forum</h2>
                        <button onclick="window.toggleForumPanel()" class="text-indigo-300 hover:text-white font-black text-4xl leading-none transition transform hover:scale-110">&times;</button>
                    </div>
                    <div id="forum-split-layout" class="forum-split-layout flex flex-col md:grid flex-1 overflow-hidden">
                        <div class="forum-thread-sidebar bg-slate-50 border-r border-slate-200 p-5 overflow-y-auto flex flex-col gap-4 custom-scrollbar">
                            <div class="rounded-2xl border border-indigo-200 bg-white p-4 shadow-sm">
                                <div class="text-[10px] font-black uppercase tracking-widest text-indigo-500 mb-3 flex items-center gap-2"><span>💬</span> New Question</div>
                                <input id="forum-new-title" class="w-full border-2 border-slate-200 rounded-xl px-3 py-2.5 text-sm mb-3 outline-none focus:border-indigo-500 font-bold text-slate-800" placeholder="Short topic..." />
                                <textarea id="forum-new-body" class="w-full border-2 border-slate-200 rounded-xl px-3 py-2.5 text-sm min-h-[100px] outline-none focus:border-indigo-500 font-medium text-slate-600 resize-none" placeholder="Ask the class or teacher something..."></textarea>
                                <button onclick="window.postForumThread()" class="mt-3 w-full bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl py-3 font-black text-sm shadow-sm transition hover:-translate-y-0.5">Post Question</button>
                            </div>
                            <div id="forum-thread-list" class="space-y-3"></div>
                        </div>
                        <button type="button" id="forum-split-resizer" class="forum-split-resizer" aria-label="Resize forum thread list and discussion panels" title="Drag to resize forum panels"></button>
                        <div class="forum-thread-content flex flex-col bg-white overflow-hidden">
                            <div id="forum-thread-detail" class="flex-1 overflow-y-auto p-6 md:p-8 custom-scrollbar"></div>
                            <div class="border-t border-slate-200 p-4 md:p-6 bg-slate-50">
                                <textarea id="forum-reply-input" class="w-full border-2 border-slate-200 rounded-xl px-4 py-3 text-sm md:text-base min-h-[100px] outline-none focus:border-indigo-500 font-medium text-slate-700 resize-none" placeholder="Write a reply..."></textarea>
                                <button onclick="window.postForumReply()" class="mt-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl px-8 py-3 font-black text-sm shadow-md transition hover:-translate-y-0.5">Post Reply</button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>`;
            document.body.insertAdjacentHTML('beforeend', chatHtml);
            p = document.getElementById('chat-panel');
        }
        enableForumPanelResizing(p);

        if (!window._forumListenerAttached && window.db) {
            const messageSets = new Map();
            const messageQueries = [];
            if (currentUser?.role === 'student') {
                messageQueries.push(window.fsCollection(window.db, 'public_messages'));
                (CLASSES || []).forEach(cls => {
                    if (cls.id) messageQueries.push(window.fsCollection(window.db, 'classes', cls.id, 'messages'));
                });
            } else {
                messageQueries.push(window.fsCollection(window.db, 'public_messages'));
                (CLASSES || []).forEach(cls => {
                    if (cls.id) messageQueries.push(window.fsCollection(window.db, 'classes', cls.id, 'messages'));
                });
            }

            messageQueries.forEach((messageQuery, index) => {
                window.fsOnSnapshot(messageQuery, snapshot => {
                    messageSets.set(index, snapshot.docs.map(doc => doc.data()));
                    FORUM_POSTS = [...messageSets.values()].flat()
                        .filter(message => message.kind === 'forum' || message.parentId || message.threadId || message.postType)
                        .sort((a, b) => (a.timestamp || 0) - (b.timestamp || 0));
                    CHAT_MESSAGES = [...FORUM_POSTS];
                    if (document.getElementById('chat-panel') && !document.getElementById('chat-panel').classList.contains('hidden')) {
                        window.renderForumThreads();
                    }
                }, error => {
                    console.error('Unable to load forum messages:', error);
                    if (error.code === 'permission-denied' && !window._forumPermissionWarningShown) {
                        window._forumPermissionWarningShown = true;
                        window.showToast?.(
                            'Forum access denied',
                            'This account may not have forum access yet. If it is approved, ask the administrator to deploy the latest Firestore rules.',
                            'error'
                        );
                    }
                });
            });
            window._forumListenerAttached = true;
        }

        seedForumDemoData();

        if (forceOpen || p.classList.contains('hidden')) {
            p.classList.remove('hidden');
            window.renderForumThreads();
        } else {
            p.classList.add('hidden');
        }
    };

    function getForumMessageRef(message) {
        return message.classId
            ? window.fsDoc(window.db, 'classes', message.classId, 'messages', message.id)
            : window.fsDoc(window.db, 'public_messages', message.id);
    }

    window.renderForumThreads = function() {
        const list = document.getElementById('forum-thread-list');
        const detail = document.getElementById('forum-thread-detail');
        if (!list || !detail) return;

        seedForumDemoData();
        const threads = FORUM_POSTS.filter(post => !post.parentId).sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));

        if (!threads.length) {
            list.innerHTML = '<div class="text-sm text-slate-500">No questions yet.</div>';
            detail.innerHTML = '<div class="text-sm text-slate-500">Start a thread by posting your first question.</div>';
            return;
        }

        if (!currentForumThreadId || !threads.find(t => t.id === currentForumThreadId)) {
            currentForumThreadId = threads[0].id;
        }

        list.innerHTML = threads.map(thread => {
            const replies = FORUM_POSTS.filter(post => post.parentId === thread.id).length;
            const isActive = thread.id === currentForumThreadId;
            return `
                <button onclick="window.selectForumThread('${thread.id}')" class="w-full text-left rounded-xl border ${isActive ? 'border-indigo-500 bg-indigo-50 shadow-sm' : 'border-slate-200 bg-white hover:border-indigo-300'} p-3 transition">
                    <div class="font-black text-sm text-slate-800">${escapeForumHtml(thread.title || 'Untitled question')}</div>
                    <div class="text-[11px] text-slate-500 mt-1">${replies} reply${replies === 1 ? '' : 'ies'} • ${escapeForumHtml(thread.author || 'Student')}</div>
                </button>`;
        }).join('');

        window.renderForumThreadDetail();
    };

    window.selectForumThread = function(threadId) {
        currentForumThreadId = threadId;
        window.renderForumThreads();
    };

    window.renderForumThreadDetail = function() {
        const detail = document.getElementById('forum-thread-detail');
        if (!detail) return;

        seedForumDemoData();
        const thread = FORUM_POSTS.find(post => post.id === currentForumThreadId && !post.parentId);
        if (!thread) {
            detail.innerHTML = '<div class="text-sm text-slate-500">Choose a thread to view replies.</div>';
            return;
        }

        const replies = FORUM_POSTS.filter(post => post.parentId === thread.id).sort((a, b) => (a.timestamp || 0) - (b.timestamp || 0));
        const canEdit = currentUser?.role === 'teacher';
        const isEditingThread = currentForumEditId === thread.id;

        const threadHtml = isEditingThread ? `
            <div class="rounded-2xl border border-slate-200 bg-slate-50 p-4 shadow-sm">
                <div class="flex items-center justify-between gap-3">
                    <div class="flex-1">
                        <input id="forum-edit-title" class="w-full border border-slate-300 rounded-xl px-3 py-2 text-sm mb-3 outline-none focus:border-indigo-500" value="${escapeForumHtml(thread.title || '')}" />
                        <div class="text-xs text-slate-500 mb-2">Edit thread title</div>
                    </div>
                    <button onclick="window.cancelForumEdit()" class="text-slate-500 hover:text-slate-700 text-sm font-bold">Cancel</button>
                </div>
                <textarea id="forum-edit-body" class="w-full border border-slate-300 rounded-xl px-3 py-2 text-sm min-h-[120px] outline-none focus:border-indigo-500" placeholder="Thread body">${escapeForumHtml(thread.text || '')}</textarea>
                <div class="mt-3 flex gap-2">
                    <button onclick="window.saveForumPostEdit('${thread.id}')" class="bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl px-4 py-2 font-bold text-sm transition">Save Changes</button>
                    <button onclick="window.cancelForumEdit()" class="bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-xl px-4 py-2 font-bold text-sm transition">Cancel</button>
                </div>
            </div>` : `
            <div class="rounded-2xl border border-slate-200 bg-slate-50 p-4 shadow-sm">
                <div class="flex items-start justify-between gap-3">
                    <div>
                        <div class="font-black text-lg text-slate-800">${escapeForumHtml(thread.title || 'Untitled question')}</div>
                        <div class="text-xs text-slate-500 mt-1">${escapeForumHtml(thread.author || 'Student')} • ${new Date(thread.timestamp || Date.now()).toLocaleString()}</div>
                    </div>
                    <div class="flex items-center gap-2">
                        ${thread.role === 'teacher' ? '<span class="bg-rose-100 text-rose-700 text-[10px] font-black uppercase px-2 py-1 rounded">Teacher</span>' : ''}
                        ${canEdit ? `<button onclick="window.editForumPost('${thread.id}')" class="text-indigo-600 hover:text-indigo-800 text-sm font-bold">Edit</button>` : ''}
                    </div>
                </div>
                <p class="mt-3 text-sm text-slate-700 whitespace-pre-wrap">${escapeForumHtml(thread.text || '')}</p>
            </div>`;

        const repliesHtml = replies.length ? replies.map(reply => {
            const isEditingReply = currentForumEditId === reply.id;
            return isEditingReply ? `
                <div class="rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
                    <div class="flex items-center justify-between gap-2 mb-2">
                        <div class="font-black text-sm text-slate-800">${escapeForumHtml(reply.author || 'Student')}</div>
                        <div class="text-[11px] text-slate-500">${new Date(reply.timestamp || Date.now()).toLocaleString()}</div>
                    </div>
                    <textarea id="forum-edit-body" class="w-full border border-slate-300 rounded-xl px-3 py-2 text-sm min-h-[100px] outline-none focus:border-indigo-500">${escapeForumHtml(reply.text || '')}</textarea>
                    <div class="mt-3 flex gap-2">
                        <button onclick="window.saveForumPostEdit('${reply.id}')" class="bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl px-4 py-2 font-bold text-sm transition">Save Reply</button>
                        <button onclick="window.cancelForumEdit()" class="bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-xl px-4 py-2 font-bold text-sm transition">Cancel</button>
                    </div>
                </div>` : `
                <div class="rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
                    <div class="flex items-center justify-between gap-2">
                        <div class="font-black text-sm text-slate-800">${escapeForumHtml(reply.author || 'Student')}</div>
                        <div class="flex items-center gap-2">
                            <div class="text-[11px] text-slate-500">${new Date(reply.timestamp || Date.now()).toLocaleString()}</div>
                            ${canEdit ? `<button onclick="window.editForumPost('${reply.id}')" class="text-indigo-600 hover:text-indigo-800 text-xs font-bold">Edit</button>` : ''}
                        </div>
                    </div>
                    <p class="mt-2 text-sm text-slate-700 whitespace-pre-wrap">${escapeForumHtml(reply.text || '')}</p>
                </div>`;
        }).join('') : '<div class="text-sm text-slate-500 rounded-xl border border-dashed border-slate-200 p-3">No replies yet. Be the first to help.</div>';

        detail.innerHTML = `${threadHtml}
            <div class="mt-4 space-y-3">${repliesHtml}</div>`;
    };

    window.postForumThread = async function() {
        const titleInput = document.getElementById('forum-new-title');
        const bodyInput = document.getElementById('forum-new-body');
        const title = (titleInput?.value || '').trim();
        const body = (bodyInput?.value || '').trim();
        if (!title || !body) return;

        const post = {
            id: 'forum_' + Date.now() + Math.floor(Math.random() * 1000),
            kind: 'forum',
            parentId: null,
            threadId: null,
            title,
            text: body,
            author: currentUser?.user || 'Student',
            avatar: currentUser?.avatar || `https://ui-avatars.com/api/?name=${currentUser?.user || 'Student'}&background=random`,
            role: currentUser?.role || 'student',
            timestamp: Date.now()
        };

        FORUM_POSTS.push(post);
        CHAT_MESSAGES = [...FORUM_POSTS];
        currentForumThreadId = post.id;
        titleInput.value = '';
        bodyInput.value = '';
        window.renderForumThreads();

        try {
            await window.fsSetDoc(getForumMessageRef(post), post);
        } catch (e) {
            console.error('Forum post error:', e);
        }
    };

    window.postForumReply = async function() {
        const input = document.getElementById('forum-reply-input');
        const text = (input?.value || '').trim();
        if (!text || !currentForumThreadId) return;

        const reply = {
            id: 'reply_' + Date.now() + Math.floor(Math.random() * 1000),
            kind: 'forum',
            parentId: currentForumThreadId,
            threadId: currentForumThreadId,
            text,
            author: currentUser?.user || 'Student',
            avatar: currentUser?.avatar || `https://ui-avatars.com/api/?name=${currentUser?.user || 'Student'}&background=random`,
            role: currentUser?.role || 'student',
            timestamp: Date.now()
        };

        FORUM_POSTS.push(reply);
        CHAT_MESSAGES = [...FORUM_POSTS];
        input.value = '';
        window.renderForumThreads();

        try {
            await window.fsSetDoc(getForumMessageRef(reply), reply);
        } catch (e) {
            console.error('Forum reply error:', e);
        }
    };

    window.editForumPost = function(postId) {
        currentForumEditId = postId;
        window.renderForumThreadDetail();
        setTimeout(() => {
            const editor = document.getElementById('forum-edit-body');
            if (editor) editor.focus();
        }, 20);
    };

    window.cancelForumEdit = function() {
        currentForumEditId = null;
        window.renderForumThreadDetail();
    };

    window.saveForumPostEdit = async function(postId) {
        const bodyEl = document.getElementById('forum-edit-body');
        if (!bodyEl) return;
        const text = bodyEl.value.trim();
        if (!text) return;

        const post = FORUM_POSTS.find(p => p.id === postId);
        if (!post) return;

        if (!post.parentId) {
            const titleEl = document.getElementById('forum-edit-title');
            const title = titleEl ? titleEl.value.trim() : post.title || '';
            if (!title) return;
            post.title = title;
        }

        post.text = text;
        post.editedAt = Date.now();
        post.editedBy = currentUser?.user || 'Teacher';

        currentForumEditId = null;
        window.renderForumThreadDetail();

        try {
            if (window.db) {
                await window.fsSetDoc(getForumMessageRef(post), post);
            }
        } catch (e) {
            console.error('Forum edit error:', e);
        }
    };

    window.toggleChatPanel = function() {
        window.toggleForumPanel();
    };
    window.renderChatMessages = function() {
        window.renderForumThreads();
    };
    window.sendChatMessage = function() {
        window.postForumThread();
    };

    // ==========================================
    // ✨ VYGOTSKY ZPD & SCAFFOLDING SYSTEM
    // ==========================================

    window.toggleScaffoldHint = function(blockIdx) {
        const el = document.getElementById(`inline-hint-${blockIdx}`);
        if (el) el.classList.toggle('hidden');
    };

    window.applyFiftyFifty = function(blockIdx) {
        const q = APP_DATA.parts[currentPartIdx].questions[blockIdx];
        if (!q || q.type !== 'multiple_choice' || q.multi) return;

        const qId = q.ids[0];
        const correctAns = (q.correctAnswers?.[qId] || '').toString().toLowerCase().trim();
        
        if (!correctAns) {
            window.showToast("Error", "Teacher hasn't set a correct answer yet.");
            return;
        }

        const radios = document.querySelectorAll(`input[name="q-${qId}"]`);
        let wrongOptions = [];

        radios.forEach(radio => {
            const val = radio.value.toLowerCase().trim();
            const exList = correctAns.split(/[/|]/).map(x => x.trim()); 
            
            if (!exList.includes(val)) {
                wrongOptions.push(radio);
            }
        });

        // Calculate how many to remove (Half of the wrong options)
        const amountToRemove = Math.ceil(wrongOptions.length / 2);
        
        // Shuffle the wrong options array randomly
        wrongOptions.sort(() => Math.random() - 0.5);

        // Disable and fade out the selected wrong options
        for (let i = 0; i < amountToRemove; i++) {
            const radioToDisable = wrongOptions[i];
            radioToDisable.disabled = true;
            
            const labelEl = radioToDisable.closest('label');
            if (labelEl) {
                labelEl.classList.add('opacity-30', 'pointer-events-none', 'grayscale', 'line-through');
            }
        }

        // Disable the 50/50 button so they can only use it once
        const btn = document.getElementById(`btn-5050-${blockIdx}`);
        if (btn) {
            btn.disabled = true;
            btn.classList.add('opacity-50', 'cursor-not-allowed', 'grayscale');
            btn.innerHTML = '🪄 Used';
        }

        window.showToast("🪄 Magic 50/50", `Removed ${amountToRemove} incorrect options to help you focus!`);
    };

    // ==========================================
    // VIRTUAL ECONOMY, MASCOTS & GAMIFICATION
    // ==========================================
    
    // 1. Define the Shop Database (Replace the Emojis with direct Image URLs later!)
    window.SHOP_DB = {
        mascots: [
            { id: 'm_boy1', name: 'Casual Boy', price: 0, img: '👦🏻', desc: 'Default Male Mascot' },
            { id: 'm_girl1', name: 'Casual Girl', price: 0, img: '👧🏻', desc: 'Default Female Mascot' },
            { id: 'm_robot', name: 'IELTS Bot', price: 500, img: '🤖', desc: 'A smart study buddy.' },
            { id: 'm_ninja', name: 'Ninja Scholar', price: 1500, img: '🥷', desc: 'Silent but highly educated.' }
        ],
        clothes: [
            { id: 'c_glasses', name: 'Smart Glasses', price: 200, img: '👓', desc: '+10% Focus' },
            { id: 'c_crown', name: 'Band 9.0 Crown', price: 5000, img: '👑', desc: 'For the absolute best.' },
            { id: 'c_backpack', name: 'Study Bag', price: 300, img: '🎒', desc: 'Carries all your vocab.' }
        ],
        backgrounds: [
            { id: 'bg_def', name: 'Default Blue', price: 0, css: 'bg-blue-900', desc: 'Standard LMS theme.' },
            { id: 'bg_sunset', name: 'Sunset Vibe', price: 800, css: 'bg-gradient-to-r from-orange-500 to-rose-500', desc: 'Warm and relaxing.' },
            { id: 'bg_galaxy', name: 'Deep Space', price: 2000, css: 'bg-gradient-to-r from-slate-900 via-purple-900 to-slate-900', desc: 'Focus in the void.' }
        ]
    };

    // 2. Open the Shop
