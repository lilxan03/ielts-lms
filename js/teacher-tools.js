    window.toggleTeacherDropdown = function(e) {
        if(e) e.stopPropagation();
        const menu = document.getElementById('teacher-dropdown-content');
        if (menu) menu.classList.toggle('hidden');
        const notifMenu = document.getElementById('teacher-notifications-content');
        if(notifMenu && !notifMenu.classList.contains('hidden')) notifMenu.classList.add('hidden');
    };

    window.toggleTeacherNotifications = function(e) {
        if(e) e.stopPropagation();
        const menu = document.getElementById('teacher-notifications-content');
        if (menu) menu.classList.toggle('hidden');
        const pMenu = document.getElementById('teacher-dropdown-content');
        if(pMenu && !pMenu.classList.contains('hidden')) pMenu.classList.add('hidden');
    };

    // Close the dropdown if the user clicks anywhere else on the screen
    document.addEventListener('click', function(e) {
        const pMenu = document.getElementById('teacher-dropdown-content');
        const pContainer = document.getElementById('editor-profile-menu');
        if (pMenu && !pMenu.classList.contains('hidden') && pContainer && !pContainer.contains(e.target)) pMenu.classList.add('hidden');

        const nMenu = document.getElementById('teacher-notifications-content');
        const nContainer = document.getElementById('editor-notifications-menu');
        if (nMenu && !nMenu.classList.contains('hidden') && nContainer && !nContainer.contains(e.target)) nMenu.classList.add('hidden');
    });

    window.openBulkAnnotateModal = function() {
        document.getElementById('modal-title').innerHTML = '📥 Bulk Highlight (Excel Paste)';
        document.getElementById('modal-message').innerHTML = `
            <p class="text-sm text-slate-500 mb-3">Copy columns from your spreadsheet and paste them below. The system will automatically scan the essay and highlight the text.<br><br><b>Format Order:</b> <span class="font-mono text-blue-600 bg-blue-50 px-2 py-1 rounded text-xs">Phrase &rarr; Criterion (TR/CC/LR/GRA) &rarr; Comment</span></p>
            <textarea id="bulk-annotate-input" class="w-full border-2 border-slate-200 p-3 rounded-xl outline-none focus:border-indigo-500 font-mono text-sm h-48 whitespace-pre text-slate-700 shadow-inner" placeholder="On the one hand&#9;CC&#9;Great cohesive device&#10;surpassed&#9;LR&#9;Good advanced vocabulary"></textarea>
        `;
        document.getElementById('modal-input').classList.add('hidden');
        document.getElementById('modal-cancel').classList.remove('hidden');
        document.getElementById('custom-modal').classList.remove('hidden');

        const modalDiv = document.querySelector('#custom-modal > div');
        if (modalDiv) {
            modalDiv.classList.remove('w-96', 'w-[400px]', 'w-[500px]');
            modalDiv.classList.add('w-[600px]');
        }

        document.getElementById('modal-cancel').onclick = () => {
            document.getElementById('custom-modal').classList.add('hidden');
            if (modalDiv) { modalDiv.classList.remove('w-[600px]'); modalDiv.classList.add('w-96'); }
        };
        
        document.getElementById('modal-confirm').onclick = () => {
            const data = document.getElementById('bulk-annotate-input').value;
            if (data) window.processBulkAnnotations(data);
            document.getElementById('custom-modal').classList.add('hidden');
            if (modalDiv) { modalDiv.classList.remove('w-[600px]'); modalDiv.classList.add('w-96'); }
        };
    };

    window.processBulkAnnotations = function(tsvData) {
        if (!tsvData || !tsvData.trim()) return;
        const rows = tsvData.split('\n');
        
        let editor = document.getElementById('edit-passage-text');
        if (!editor || editor.closest('.hidden')) {
             editor = document.querySelector('.rich-editor:focus') || document.getElementById('edit-passage-text');
        }
        if (!editor) return;

        let matchCount = 0;
        const colors = {
            tr: 'bg-blue-100 text-blue-900 border-b-2 border-blue-500',
            cc: 'bg-purple-100 text-purple-900 border-b-2 border-purple-500',
            lr: 'bg-emerald-100 text-emerald-900 border-b-2 border-emerald-500',
            gra: 'bg-amber-100 text-amber-900 border-b-2 border-amber-500'
        };
        const labels = { tr: 'Task Response', cc: 'Coherence / Cohesion', lr: 'Lexical Resource', gra: 'Grammatical Range' };

        rows.forEach(row => {
            const parts = row.split('\t'); 
            if (parts.length >= 3) {
                const phrase = parts[0].trim();
                const crit = parts[1].trim().toLowerCase();
                const note = parts[2].trim();

                if (phrase && colors[crit] && note) {
                    const cleanNote = note.replace(/\n/g, '<br>').replace(/'/g, "\\'").replace(/"/g, '&quot;');
                    const cleanPhrase = phrase.replace(/</g, '&lt;').replace(/>/g, '&gt;');
                    
                    const walker = document.createTreeWalker(editor, NodeFilter.SHOW_TEXT, null, false);
                    let node;
                    const nodesToReplace = [];
                    
                    while (node = walker.nextNode()) {
                        if (node.nodeValue.includes(phrase) && !node.parentNode.closest('.criteria-highlight')) {
                            nodesToReplace.push(node);
                        }
                    }

                    nodesToReplace.forEach(textNode => {
                        if (!textNode.parentNode) return;
                        
                        const text = textNode.nodeValue;
                        const splitParts = text.split(phrase);
                        
                        if (splitParts.length > 1) {
                            const frag = document.createDocumentFragment();
                            for (let i = 0; i < splitParts.length; i++) {
                                frag.appendChild(document.createTextNode(splitParts[i]));
                                if (i < splitParts.length - 1) {
                                    const span = document.createElement('span');
                                    span.className = `${colors[crit]} px-1.5 py-0.5 rounded inline-block cursor-pointer font-medium shadow-sm transition hover:brightness-95 mx-0.5 criteria-highlight`;
                                    span.setAttribute('onclick', `event.stopPropagation(); if(typeof window.showToast === 'function') window.showToast('${labels[crit]}', '${cleanNote}', 'info')`);
                                    span.innerHTML = `<span class="text-[9px] font-black uppercase tracking-widest opacity-70 mr-1 select-none pointer-events-none">[${crit.toUpperCase()}]</span>${cleanPhrase}`;
                                    
                                    frag.appendChild(span);
                                    matchCount++;
                                }
                            }
                            textNode.parentNode.replaceChild(frag, textNode);
                        }
                    });
                }
            }
        });

        if (window.triggerEditorAutosave) window.triggerEditorAutosave();
        
        if (typeof window.showToast === 'function') {
            if (matchCount > 0) {
                window.showToast("Annotations Applied", `Successfully matched and applied ${matchCount} highlights.`);
            } else {
                window.showToast("Notice", "No matching phrases found in the text.", "error");
            }
        }
    };

    window.updateFeedbackText = function(qId, criteria, bandScore) {
        if (!bandScore || !IELTS_DESCRIPTORS[criteria] || !IELTS_DESCRIPTORS[criteria][bandScore]) return;
        const textarea = document.getElementById(`fb-${qId}`);
        if (textarea) {
            const newText = IELTS_DESCRIPTORS[criteria][bandScore];
            textarea.value = textarea.value ? textarea.value + '\\n\\n' + newText : newText;
            textarea.focus();
        }
    };

    window.highlightCriteria = function(type) {
        const selection = window.getSelection();
        if (!selection.rangeCount) {
            if (typeof window.showToast === 'function') window.showToast("Notice", "Please select text in the Sample Answer first.");
            return;
        }
        
        // Save the exact range before the modal steals focus
        const range = selection.getRangeAt(0).cloneRange();
        const text = range.toString().trim();
        
        if (!text) {
            if (typeof window.showToast === 'function') window.showToast("Notice", "Please select text in the Sample Answer first.");
            return;
        }
        
        showInputPrompt(`Add Note for ${type.toUpperCase()}`, "Explain why this text is a good example of this criterion:", (note) => {
            if (!note) return;
            
            const colors = {
                tr: 'bg-blue-100 text-blue-900 border-b-2 border-blue-500',
                cc: 'bg-purple-100 text-purple-900 border-b-2 border-purple-500',
                lr: 'bg-emerald-100 text-emerald-900 border-b-2 border-emerald-500',
                gra: 'bg-amber-100 text-amber-900 border-b-2 border-amber-500'
            };
            const labels = { tr: 'Task Response', cc: 'Coherence / Cohesion', lr: 'Lexical Resource', gra: 'Grammatical Range' };
            
            const cleanNote = note.replace(/\n/g, '<br>').replace(/'/g, "\\'").replace(/"/g, '&quot;');
            
            // Create the wrapper securely via DOM
            const wrapper = document.createElement('span');
            wrapper.className = `${colors[type]} px-1.5 py-0.5 rounded inline-block cursor-pointer font-medium shadow-sm transition hover:brightness-95 mx-0.5 criteria-highlight`;
            wrapper.setAttribute('onclick', `event.stopPropagation(); if(typeof window.showToast === 'function') window.showToast('${labels[type]}', '${cleanNote}', 'info')`);
            
            const tag = document.createElement('span');
            tag.className = 'text-[9px] font-black uppercase tracking-widest opacity-70 mr-1 select-none pointer-events-none';
            tag.textContent = `[${type.toUpperCase()}]`;
            
            wrapper.appendChild(tag);
            wrapper.appendChild(document.createTextNode(text));

            // Extract the old text and inject our newly built interactive node
            range.deleteContents();
            range.insertNode(wrapper);

            // Clean up the browser's selection highlight
            const sel = window.getSelection();
            sel.removeAllRanges();
            
            if (window.triggerEditorAutosave) window.triggerEditorAutosave();
        });
    };

    window.removeCriteriaHighlight = function() {
        const selection = window.getSelection();
        if (!selection.rangeCount) {
            if (typeof window.showToast === 'function') window.showToast("Notice", "Place cursor inside a highlighted criterion to clear it.");
            return;
        }
        
        let node = selection.getRangeAt(0).commonAncestorContainer;
        if (node.nodeType === Node.TEXT_NODE) node = node.parentNode;
        
        const span = node.closest('span.criteria-highlight') || node.closest('span[onclick*="showToast"]');
        
        if (span) {
            const label = span.querySelector('span');
            if (label) label.remove();
            
            const textNode = document.createTextNode(span.textContent);
            span.parentNode.replaceChild(textNode, span);
            
            if (window.triggerEditorAutosave) window.triggerEditorAutosave();
            if (typeof window.showToast === 'function') window.showToast("Removed", "Highlight removed successfully.");
        } else {
            if (typeof window.showToast === 'function') window.showToast("Notice", "Place your cursor inside a highlighted block first to clear it.");
        }
    };

    window.processBulkAnnotations = function(tsvData) {
        if (!tsvData.trim()) return;
        const rows = tsvData.split('\n');
        
        // Target the active sample answer editor
        let editor = document.getElementById('edit-passage-text');
        if (!editor || editor.closest('.hidden')) {
             editor = document.querySelector('.rich-editor:focus') || document.getElementById('edit-passage-text');
        }
        if (!editor) return;

        let matchCount = 0;
        const colors = {
            tr: 'bg-blue-100 text-blue-900 border-b-2 border-blue-500',
            cc: 'bg-purple-100 text-purple-900 border-b-2 border-purple-500',
            lr: 'bg-emerald-100 text-emerald-900 border-b-2 border-emerald-500',
            gra: 'bg-amber-100 text-amber-900 border-b-2 border-amber-500'
        };
        const labels = { tr: 'Task Response', cc: 'Coherence / Cohesion', lr: 'Lexical Resource', gra: 'Grammatical Range' };

        rows.forEach(row => {
            const parts = row.split('\t'); // Split by Tab (Excel standard)
            if (parts.length >= 3) {
                const phrase = parts[0].trim();
                const crit = parts[1].trim().toLowerCase();
                const note = parts[2].trim();

                if (phrase && colors[crit] && note) {
                    const cleanNote = note.replace(/\n/g, '<br>').replace(/'/g, "\\'").replace(/"/g, '&quot;');
                    const cleanPhrase = phrase.replace(/</g, '&lt;').replace(/>/g, '&gt;');
                    
                    // DOM Tree Walker to safely replace text WITHOUT corrupting HTML tags
                    const walker = document.createTreeWalker(editor, NodeFilter.SHOW_TEXT, null, false);
                    let node;
                    const nodesToReplace = [];
                    
                    while (node = walker.nextNode()) {
                        // Avoid double-wrapping existing highlights
                        if (node.nodeValue.includes(phrase) && !node.parentNode.closest('.criteria-highlight')) {
                            nodesToReplace.push(node);
                        }
                    }

                    nodesToReplace.forEach(textNode => {
                        if (!textNode.parentNode) return;
                        
                        const text = textNode.nodeValue;
                        const splitParts = text.split(phrase);
                        
                        if (splitParts.length > 1) {
                            const frag = document.createDocumentFragment();
                            for (let i = 0; i < splitParts.length; i++) {
                                frag.appendChild(document.createTextNode(splitParts[i]));
                                if (i < splitParts.length - 1) {
                                    const span = document.createElement('span');
                                    span.className = `${colors[crit]} px-1.5 py-0.5 rounded inline-block cursor-pointer font-medium shadow-sm transition hover:brightness-95 mx-0.5 criteria-highlight`;
                                    span.setAttribute('onclick', `event.stopPropagation(); if(typeof window.showToast === 'function') window.showToast('${labels[crit]}', '${cleanNote}', 'info')`);
                                    span.innerHTML = `<span class="text-[9px] font-black uppercase tracking-widest opacity-70 mr-1 select-none pointer-events-none">[${crit.toUpperCase()}]</span>${cleanPhrase}`;
                                    
                                    frag.appendChild(span);
                                    matchCount++;
                                }
                            }
                            textNode.parentNode.replaceChild(frag, textNode);
                        }
                    });
                }
            }
        });

        if (window.triggerEditorAutosave) window.triggerEditorAutosave();
        
        if (typeof window.showToast === 'function') {
            if (matchCount > 0) {
                window.showToast("Annotations Applied", `Successfully matched and applied ${matchCount} highlights.`);
            } else {
                window.showToast("Notice", "No matching phrases found in the text.", "error");
            }
        }
    };

    window.insertInlineFeedback = function(editorId) {
        const selectEl = document.getElementById(`inline-crit-${editorId}`);
        if (!selectEl.value) return;
        
        const [crit, band] = selectEl.value.split('-');
        const text = IELTS_DESCRIPTORS[crit][band];
        selectEl.value = ''; // reset dropdown
        
        const editor = document.getElementById(`essay-content-${editorId}`);
        if (!editor) return;
        
        editor.focus();
        
        const htmlToInsert = `<div class="relative bg-amber-50 border-l-4 border-amber-500 pt-3 px-3 pb-1.5 my-2 pr-8 text-sm text-amber-900 shadow-sm" contenteditable="false"><button type="button" onclick="this.parentElement.remove()" contenteditable="false" class="absolute top-1 right-2 text-amber-400 hover:text-rose-500 font-bold text-xl leading-none cursor-pointer" title="Remove this feedback block">&times;</button><strong>${text}</strong><div contenteditable="true" class="text-slate-700 block mt-2 mb-1 p-2 bg-white border border-dashed border-amber-300 rounded outline-none focus:border-solid focus:border-amber-500 min-h-[40px]">[Write specific feedback here...]</div></div><p><br></p>`;
        
        document.execCommand('insertHTML', false, htmlToInsert);
    };

    window.processImageFile = function(file, callback) {
        if (!file || !file.type.startsWith('image/')) return;
        const reader = new FileReader();
        reader.onload = (e) => {
            const img = new Image();
            img.onload = () => {
                const canvas = document.createElement('canvas');
                let w = img.width, h = img.height;
                const maxW = 1000;
                if (w > maxW) { h = Math.round((h * maxW) / w); w = maxW; }
                canvas.width = w; canvas.height = h;
                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0, w, h);
                
                canvas.toBlob(async (blob) => {
                    const path = 'images/' + Date.now() + '_' + Math.random().toString(36).substr(2,5) + '.jpg';
                    try {
                        const url = await window.uploadMediaToStorage(blob, path);
                        callback(url);
                    } catch(err) {
                        console.warn("Storage Rules Blocked Upload. Falling back to Base64 format:", err);
                        // ✨ FIX: Bulletproof Fallback
                        callback(canvas.toDataURL('image/jpeg', 0.8));
                    }
                }, 'image/jpeg', 0.8); 
            };
            img.src = e.target.result;
        };
        reader.readAsDataURL(file);
    };

    window.handleMapClick = function(e, i) {
        if (e.target.tagName === 'INPUT' && e.target.type === 'file') return;
        const q = APP_DATA.parts[currentEditorPartIdx].questions[i];
        if (!q.image) {
            document.getElementById(`map-file-${i}`).click();
            return;
        }
        if (q.type !== 'map_labelling_hotspots') return;
        
        const img = document.getElementById(`map-img-${i}`);
        if (!img) return;
        const rect = img.getBoundingClientRect();
        if (e.clientX < rect.left || e.clientX > rect.right || e.clientY < rect.top || e.clientY > rect.bottom) return;
        
        const x = ((e.clientX - rect.left) / rect.width) * 100;
        const y = ((e.clientY - rect.top) / rect.height) * 100;
        
        if (!q.hotspots) q.hotspots = [];
        const newId = (q.ids && q.ids.length > 0) ? Math.max(...q.ids) + 1 : 1;
        q.hotspots.push({id: newId, x, y});
        if(!q.ids.includes(newId)) q.ids.push(newId);
        
        window.saveCurrentEditorPart();
        renderEditorQuestions();
        window.triggerEditorAutosave();
    };

    window.removeHotspot = function(e, qIdx, id) {
        e.stopPropagation();
        const q = APP_DATA.parts[currentEditorPartIdx].questions[qIdx];
        q.hotspots = q.hotspots.filter(h => h.id !== id);
        q.ids = q.ids.filter(i => i !== id);
        if(q.ids.length === 0) q.ids = [Date.now()%10000]; 
        window.saveCurrentEditorPart();
        renderEditorQuestions();
        window.triggerEditorAutosave();
    };

    window.handleMapPaste = function(e, i) {
        e.preventDefault();
        const items = (e.clipboardData || e.originalEvent.clipboardData).items;
        for (let item of items) {
            if (item.type.indexOf('image') === 0) {
                const file = item.getAsFile();
                window.processImageFile(file, (base64) => {
                    APP_DATA.parts[currentEditorPartIdx].questions[i].image = base64;
                    window.saveCurrentEditorPart();
                    renderEditorQuestions();
                    window.triggerEditorAutosave();
                });
                return;
            }
        }
    };

    window.handleMapFile = function(e, i) {
        const file = e.target.files[0];
        if (!file) return;
        window.processImageFile(file, (base64) => {
            APP_DATA.parts[currentEditorPartIdx].questions[i].image = base64;
            window.saveCurrentEditorPart();
            renderEditorQuestions();
            window.triggerEditorAutosave();
        });
        e.target.value = '';
    };

    window.removeMapImage = function(i) {
        const q = APP_DATA.parts[currentEditorPartIdx].questions[i];
        q.image = null;
        if (q.type === 'map_labelling_hotspots') {
            q.hotspots = [];
            q.ids = [Date.now()%10000];
        }
        window.saveCurrentEditorPart();
        renderEditorQuestions();
        window.triggerEditorAutosave();
    };

    function escapeHtmlAttributeValue(value) {
        return String(value || '').replace(/[&<>"']/g, char => ({
            '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
        })[char]);
    }

    function saveListeningQuestionImage(questionIndex, image) {
        const question = APP_DATA.parts[currentEditorPartIdx]?.questions?.[questionIndex];
        if (!question) return;
        question.image = image || '';
        window.saveCurrentEditorPart();
        renderEditorQuestions();
        window.triggerEditorAutosave();
    }

    window.handleListeningQuestionImageClick = function(e, questionIndex) {
        if (e.target.closest('button')) return;
        document.getElementById(`listening-question-image-file-${questionIndex}`)?.click();
    };

    window.handleListeningQuestionImagePaste = function(e, questionIndex) {
        const clipboard = e.clipboardData || e.originalEvent?.clipboardData;
        if (!clipboard) return;

        const imageItem = Array.from(clipboard.items || []).find(item => item.type.startsWith('image/'));
        if (imageItem) {
            e.preventDefault();
            const file = imageItem.getAsFile();
            if (!file) {
                window.showModalMsg('Paste Error', 'Could not read the pasted image.');
                return;
            }
            window.processImageFile(file, image => saveListeningQuestionImage(questionIndex, image));
            return;
        }

        const pastedText = clipboard.getData('text/plain').trim();
        if (/^https?:\/\/\S+$/i.test(pastedText)) {
            e.preventDefault();
            saveListeningQuestionImage(questionIndex, pastedText);
        }
    };

    window.handleListeningQuestionImageFile = function(e, questionIndex) {
        const file = e.target.files?.[0];
        if (!file) return;
        if (!file.type.startsWith('image/')) {
            window.showModalMsg('Invalid File', 'Please choose an image file.');
            e.target.value = '';
            return;
        }
        window.processImageFile(file, image => saveListeningQuestionImage(questionIndex, image));
        e.target.value = '';
    };

    window.removeListeningQuestionImage = function(questionIndex) {
        saveListeningQuestionImage(questionIndex, '');
    };

    window.setListeningQuestionImageUrl = function(questionIndex, imageUrl) {
        const url = imageUrl.trim();
        if (url && !/^(https?:\/\/|data:image\/)/i.test(url)) {
            window.showModalMsg('Invalid Image Link', 'Use a direct image link beginning with http:// or https://.');
            return;
        }
        saveListeningQuestionImage(questionIndex, url);
    };

    window.handlePartImagePaste = function(e) {
        e.preventDefault();
        const items = (e.clipboardData || e.originalEvent.clipboardData).items;
        for (let item of items) {
            if (item.type.indexOf('image') === 0) {
                const file = item.getAsFile();
                window.processImageFile(file, (base64) => {
                    APP_DATA.parts[currentEditorPartIdx].image = base64;
                    loadEditorPart(currentEditorPartIdx);
                    window.triggerEditorAutosave();
                });
                return;
            }
        }
    };

    window.handlePartImageFile = function(e) {
        const file = e.target.files[0];
        if (!file) return;
        window.processImageFile(file, (base64) => {
            APP_DATA.parts[currentEditorPartIdx].image = base64;
            loadEditorPart(currentEditorPartIdx);
            window.triggerEditorAutosave();
        });
        e.target.value = ''; 
    };

    window.removePartImage = function() {
        APP_DATA.parts[currentEditorPartIdx].image = null;
        loadEditorPart(currentEditorPartIdx);
        window.triggerEditorAutosave();
    };

    // --- GLOBAL BRANDING / LOGO SYSTEM ---
    window.applyGlobalLogo = function() {
        const logoUrl = PUBLIC_PROFILE.appLogo;
        if (typeof window.applyStartupBranding === 'function') window.applyStartupBranding(PUBLIC_PROFILE);
        
        const stuLogo = document.getElementById('app-logo-student');
        if (stuLogo) stuLogo.innerHTML = logoUrl ? `<img src="${logoUrl}" class="w-full h-full object-cover">` : '🎓';
        
        const teacherLogo = document.getElementById('app-logo-teacher');
        if (teacherLogo) teacherLogo.innerHTML = logoUrl ? `<img src="${logoUrl}" class="w-full h-full object-cover">` : '🛠';
        
        const examLogo = document.getElementById('app-logo-exam');
        if (examLogo) examLogo.innerHTML = logoUrl ? `<img src="${logoUrl}" class="w-full h-full object-cover">` : 'I';
        
        const authText = document.getElementById('app-logo-auth-text');
        const authImg = document.getElementById('app-logo-auth-img');
        if (authText && authImg) {
            if (logoUrl) {
                authImg.src = logoUrl;
                authImg.classList.remove('hidden');
                authText.classList.add('hidden');
            } else {
                authImg.classList.add('hidden');
                authText.classList.remove('hidden');
            }
        }
        
        // Also update the Public Storefront editor preview safely
        const preview = document.getElementById('pp-logo-preview');
        const placeholder = document.getElementById('pp-logo-placeholder');
        if (preview && placeholder) {
            if (logoUrl) {
                preview.src = logoUrl;
                preview.classList.remove('hidden');
                placeholder.classList.add('hidden');
            } else {
                preview.src = '';
                preview.classList.add('hidden');
                placeholder.classList.remove('hidden');
            }
        }
    };

    window.handlePPLogo = function(e) {
        const file = e.target.files[0];
        if (!file) return;
        window.processImageFile(file, (base64) => {
            PUBLIC_PROFILE.appLogo = base64;
            window.applyGlobalLogo();
        });
        e.target.value = '';
    };

    window.clearPPLogo = function() {
        PUBLIC_PROFILE.appLogo = null;
        window.applyGlobalLogo();
    };

    // --- PUSH NOTIFICATION SYSTEM ---
    window.requestPushNotifications = async function() {
        if (!window.firebaseApp || !window.FCM_VAPID_KEY) {
            showModalMsg("Configuration Required", "Please add your VAPID key in the code to enable push notifications.");
            return;
        }
        
        try {
            const messaging = window.fsGetMessaging(window.firebaseApp);
            
            // Request OS level permission
            const permission = await Notification.requestPermission();
            if (permission === 'granted') {
                const btn = document.getElementById('btn-push-noti') || document.getElementById('btn-push-noti-teacher');
                if(btn) { btn.textContent = "Connecting..."; btn.disabled = true; }
                
                // Explicitly register the Service Worker to prevent pathing errors
                let swRegistration = null;
                if ('serviceWorker' in navigator) {
                    swRegistration = await navigator.serviceWorker.register('./firebase-messaging-sw.js');
                }

                // Get unique device token
                const token = await window.fsGetToken(messaging, { 
                    vapidKey: window.FCM_VAPID_KEY,
                    serviceWorkerRegistration: swRegistration
                });
                
                if (token && currentUser) {
                    currentUser.fcmToken = token;
                    await window.fsSetDoc(window.fsDoc(window.db, window.fPath('users'), currentUser.user), currentUser);
                    sessionStorage.setItem('ielts_session', JSON.stringify(currentUser));
                    
                    showModalMsg("Enabled! 🔔", "Push notifications are now active on this device.");
                    
                    // Listen for foreground messages
                    window.fsOnMessage(messaging, (payload) => {
                        window.showToast(payload.notification.title, payload.notification.body, 'info');
                    });
                }
                
                if(btn) { btn.innerHTML = "🔔 Notifications Active"; btn.classList.add('bg-emerald-100', 'text-emerald-700'); btn.disabled = false; }
            } else {
                showModalMsg("Permission Denied", "You must allow notifications in your browser settings to receive alerts.");
            }
        } catch (err) {
            console.error('Push Notification Error:', err);
            
            let errMsg = "Could not enable push notifications. Ensure you are running on a local server (http://127.0.0.1) or HTTPS.";
            if (err.message) errMsg += `<br><br><span class="text-[10px] font-mono text-rose-500">${err.message}</span>`;
            
            showModalMsg("Error", errMsg);
            
            const btn = document.getElementById('btn-push-noti') || document.getElementById('btn-push-noti-teacher');
            if(btn) { btn.innerHTML = "🔔 Enable Device Alerts"; btn.disabled = false; }
        }
    };

    window.fireLocalOSNotification = function(title, body) {
        // If the user hasn't granted permission, fall back to the in-app toast
        if (Notification.permission !== 'granted') {
            if (typeof window.showToast === 'function') window.showToast(title, body, 'info');
            return;
        }

        // Fire native OS notification
        const noti = new Notification(title, {
            body: body,
            icon: 'https://ui-avatars.com/api/?name=LMS&background=1e3a8a&color=fff',
            requireInteraction: false
        });

        // If clicked, bring the browser tab back to the front!
        noti.onclick = function() {
            window.focus();
            this.close();
        };
    };

    // --- SPEED READING / SKIMMING ENGINE ---
    window.skimmingState = { timer: null, index: 0, words: [], isPlaying: false };

    window.initSkimmingWords = function() {
        const container = document.getElementById('passage-text-content');
        if (!container) return false;

        // If we already initialized words, just gather them and return
        let words = Array.from(container.querySelectorAll('.reading-word'));
        if (words.length > 0 && container.dataset.skimmingInit === 'true') {
            window.skimmingState.words = words;
            return true;
        }

        // TreeWalker to safely wrap all text nodes without destroying existing HTML
        const walker = document.createTreeWalker(container, NodeFilter.SHOW_TEXT, null, false);
        const nodes = [];
        let node;
        while (node = walker.nextNode()) nodes.push(node);

        nodes.forEach(n => {
            // Only skip if already a reading-word. This ALLOWS wrapping inside vocab/grammar tags!
            if (n.parentNode.closest('.reading-word')) return;
            
            const text = n.nodeValue;
            if (!text.trim()) return;
            
            const frag = document.createDocumentFragment();
            text.split(/(\s+)/).forEach(part => {
                if (/\s+/.test(part)) {
                    frag.appendChild(document.createTextNode(part));
                } else if (part) {
                    const span = document.createElement('span');
                    span.className = 'reading-word';
                    span.textContent = part;
                    frag.appendChild(span);
                }
            });
            n.parentNode.replaceChild(frag, n);
        });

        container.dataset.skimmingInit = 'true';
        
        // Select ONLY reading-word so individual words fade, not entire phrases
        window.skimmingState.words = Array.from(container.querySelectorAll('.reading-word'));
        return true;
    };

    window.startSkimming = function() {
        if (!window.initSkimmingWords()) return;
        if (window.skimmingState.index >= window.skimmingState.words.length) window.restartSkimming();
        
        document.getElementById('btn-skimming-play').style.display = 'none';
        document.getElementById('btn-skimming-pause').style.display = 'inline-flex';
        
        window.skimmingState.isPlaying = true;
        window.updateSkimmingSpeed();
    };

    window.pauseSkimming = function() {
        window.skimmingState.isPlaying = false;
        if (window.skimmingState.timer) clearTimeout(window.skimmingState.timer);
        
        document.getElementById('btn-skimming-pause').style.display = 'none';
        document.getElementById('btn-skimming-play').style.display = 'inline-flex';
    };

    window.restartSkimming = function() {
        window.pauseSkimming();
        window.skimmingState.words.forEach(w => w.classList.remove('is-read', 'is-current'));
        window.skimmingState.index = 0;
    };

    window.updateSkimmingSpeed = function() {
        if (!window.skimmingState.isPlaying) return;
        if (window.skimmingState.timer) clearTimeout(window.skimmingState.timer);
        
        const wpm = parseInt(document.getElementById('reading-speed-input').value) || 220;
        const msPerWord = 60000 / wpm;
        window.skimmingStep(msPerWord);
    };

    window.skimmingStep = function(msPerWord) {
        if (!window.skimmingState.isPlaying) return;
        const words = window.skimmingState.words;
        const idx = window.skimmingState.index;

        if (idx >= words.length) {
            window.pauseSkimming();
            return;
        }

        if (idx > 0) {
            words[idx-1].classList.remove('is-current');
            words[idx-1].classList.add('is-read');
        }

        words[idx].classList.add('is-current');

        // Smart Scrolling: Keeps the word centered in the view
        if (idx % 8 === 0 || words[idx].getBoundingClientRect().bottom > window.innerHeight - 100) {
            words[idx].scrollIntoView({ behavior: 'auto', block: 'center' });
        }

        window.skimmingState.index++;

        // Natural reading dynamics: Pause slightly longer on punctuation
        let delay = msPerWord;
        const text = words[idx].textContent;
        if (/[.?!]$/.test(text)) delay *= 2;
        else if (/[,;]$/.test(text)) delay *= 1.5;

        window.skimmingState.timer = setTimeout(() => window.skimmingStep(msPerWord), delay);
    };

    window.skipSkimmingParagraph = function(direction) {
        if (!window.initSkimmingWords()) return;
        const words = window.skimmingState.words;
        if (!words.length) return;
        
        let currentIdx = window.skimmingState.index;

        if (direction === 1) { // Next
            let currentP = words[Math.min(currentIdx, words.length-1)].closest('p, div, td, li');
            let targetIdx = currentIdx;
            while (targetIdx < words.length && words[targetIdx].closest('p, div, td, li') === currentP) {
                targetIdx++;
            }
            if (targetIdx < words.length) {
                for(let i=currentIdx; i<targetIdx; i++) {
                    words[i].classList.remove('is-current');
                    words[i].classList.add('is-read');
                }
                if(currentIdx > 0 && currentIdx < words.length) words[currentIdx-1].classList.remove('is-current');
                
                window.skimmingState.index = targetIdx;
                words[targetIdx].scrollIntoView({ behavior: 'auto', block: 'center' });
            }
        } else { // Prev
            if (currentIdx === 0) return;
            let startP = words[Math.max(0, currentIdx-1)].closest('p, div, td, li');
            let targetIdx = Math.max(0, currentIdx - 1);
            
            while (targetIdx > 0 && words[targetIdx-1].closest('p, div, td, li') === startP) targetIdx--;
            
            if (targetIdx === currentIdx || targetIdx === currentIdx - 1) {
                if (targetIdx > 0) {
                    let prevP = words[targetIdx-1].closest('p, div, td, li');
                    while (targetIdx > 0 && words[targetIdx-1].closest('p, div, td, li') === prevP) targetIdx--;
                }
            }
            
            for(let i=targetIdx; i<=currentIdx && i<words.length; i++) {
                words[i].classList.remove('is-read', 'is-current');
            }
            if(currentIdx>0 && currentIdx<=words.length) words[currentIdx-1].classList.remove('is-current');
            
            window.skimmingState.index = targetIdx;
            words[targetIdx].scrollIntoView({ behavior: 'auto', block: 'center' });
        }
    };


    // --- SCHEDULED LESSONS / MATERIALS ENGINE ---
    
    // ✨ Overhauled Add Schedule Modal (Includes Native Lesson Attacher)
