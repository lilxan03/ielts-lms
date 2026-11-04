    function getAssignedQuestionTemplateHtml(skill, type) {
        const templateId = TEACHER_TEMPLATE_ASSIGNMENTS[getTemplateAssignmentKey(skill, type)];
        return TEACHER_TEMPLATES.find(template => template.id === templateId)?.html || '';
    }

    function renderTemplateAssignmentSettings(templateId) {
        const targetOptions = Object.entries(TEMPLATE_QUESTION_TYPES).map(([skill, types]) =>
            `<optgroup label="${skill.charAt(0).toUpperCase() + skill.slice(1)}">${types.map(([type, label]) =>
                `<option value="${skill}:${type}">${label}</option>`
            ).join('')}</optgroup>`
        ).join('');
        const assignedCount = Object.values(TEACHER_TEMPLATE_ASSIGNMENTS).filter(assignedId => assignedId === templateId).length;
        const assignedTypes = Object.entries(TEACHER_TEMPLATE_ASSIGNMENTS)
            .filter(([, assignedId]) => assignedId === templateId)
            .map(([key]) => {
                const [skill, type] = key.split(':');
                const match = TEMPLATE_QUESTION_TYPES[skill]?.find(([questionType]) => questionType === type);
                return match ? { key, label: `${skill.charAt(0).toUpperCase() + skill.slice(1)} — ${match[1]}` } : null;
            })
            .filter(Boolean);
        const assignedMarkup = assignedTypes.length
            ? assignedTypes.map(({ key, label }) => `<div class="flex items-center justify-between gap-3 rounded-lg border border-blue-100 bg-blue-50 px-3 py-2"><span class="text-xs font-bold text-blue-900">${label}</span><button type="button" onclick="window.unassignTemplateFromQuestionType('${templateId}', '${key}')" class="shrink-0 rounded px-2 py-1 text-xs font-bold text-rose-600 hover:bg-rose-100" aria-label="Remove ${label} assignment">Remove</button></div>`).join('')
            : '<p class="text-xs text-slate-500">No question types use this template as their default yet.</p>';
        return `<section class="mt-6 rounded-xl border border-blue-100 bg-slate-50 p-4">
            <h3 class="font-black text-sm text-slate-800">Auto-assign by skill and question type</h3>
            <p class="mt-1 text-xs text-slate-500">New question blocks of an assigned type will start with this template in the Hint field. You can still edit it or insert another template later.</p>
            <p id="template-assignment-count" class="mt-2 text-xs font-bold text-blue-700">${assignedCount} question type${assignedCount === 1 ? '' : 's'} assigned to this template.</p>
            <div class="mt-3 flex flex-col sm:flex-row gap-2">
                <select id="template-question-type" class="min-w-0 flex-1 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-bold text-slate-700">${targetOptions}</select>
                <button type="button" onclick="window.assignTemplateToQuestionType('${templateId}')" class="rounded-lg bg-blue-600 px-4 py-2 text-sm font-bold text-white hover:bg-blue-700">Assign type</button>
            </div>
            <div id="template-assignment-list" class="mt-3 space-y-2">${assignedMarkup}</div>
        </section>`;
    }

    function refreshTemplateAssignmentSettings(templateId) {
        const settings = document.getElementById('template-assignment-list');
        const selector = document.getElementById('template-question-type');
        const count = document.getElementById('template-assignment-count');
        if (!settings || !selector || !count) return;
        const wrapper = document.createElement('div');
        wrapper.innerHTML = renderTemplateAssignmentSettings(templateId);
        const newSettings = wrapper.querySelector('#template-assignment-list');
        const newSelector = wrapper.querySelector('#template-question-type');
        const newCount = wrapper.querySelector('#template-assignment-count');
        settings.replaceWith(newSettings);
        selector.replaceWith(newSelector);
        count.replaceWith(newCount);
    }

    function enableTemplateManagerResizing() {
        const layout = document.getElementById('template-manager-layout');
        const handle = document.getElementById('template-manager-resizer');
        if (!layout || !handle || handle.dataset.resizerReady) return;
        let ratio = 34;
        try {
            const savedRatio = Number(localStorage.getItem('lms_teacher_template_manager_split'));
            if (Number.isFinite(savedRatio) && savedRatio >= 25 && savedRatio <= 50) ratio = savedRatio;
        } catch (error) {
            console.error('Unable to restore template manager panel widths:', error);
        }
        const applyRatio = () => {
            const vertical = window.matchMedia('(max-width: 767px)').matches;
            layout.style.gridTemplateColumns = vertical
                ? 'minmax(0, 1fr)'
                : `minmax(240px, ${ratio}fr) 10px minmax(0, ${100 - ratio}fr)`;
            layout.style.setProperty('--template-sidebar-ratio', `${Math.min(55, Math.max(25, ratio))}%`);
        };
        applyRatio();
        handle.dataset.resizerReady = 'true';
        window.addEventListener('resize', applyRatio);
        handle.addEventListener('pointerdown', event => {
            event.preventDefault();
            const vertical = window.matchMedia('(max-width: 767px)').matches;
            const startPosition = vertical ? event.clientY : event.clientX;
            const bounds = layout.getBoundingClientRect();
            const availableSize = vertical
                ? bounds.height - handle.offsetHeight
                : bounds.width - handle.offsetWidth;
            const startRatio = ratio;
            handle.setPointerCapture(event.pointerId);
            const resize = moveEvent => {
                if (availableSize <= 0) return;
                const currentPosition = vertical ? moveEvent.clientY : moveEvent.clientX;
                ratio = Math.min(50, Math.max(25, startRatio + (currentPosition - startPosition) / availableSize * 100));
                applyRatio();
            };
            const finishResize = () => {
                handle.removeEventListener('pointermove', resize);
                handle.removeEventListener('pointerup', finishResize);
                handle.removeEventListener('pointercancel', finishResize);
                try {
                    localStorage.setItem('lms_teacher_template_manager_split', String(ratio));
                } catch (error) {
                    console.error('Unable to save template manager panel widths:', error);
                }
            };
            handle.addEventListener('pointermove', resize);
            handle.addEventListener('pointerup', finishResize, { once: true });
            handle.addEventListener('pointercancel', finishResize, { once: true });
        });
    }

    window.openTemplateManager = function() {
        document.getElementById('template-manager-modal').classList.remove('hidden');
        enableTemplateManagerResizing();
        window.renderTemplateList();
        document.getElementById('template-editor-area').innerHTML = '<div class="text-center text-slate-400 mt-20 italic font-medium">Select a template from the left or create a new one.</div>';
        window.currentTemplateId = null;
    };

    window.renderTemplateList = function() {
        const container = document.getElementById('template-list-container');
        container.innerHTML = TEACHER_TEMPLATES.map(t => `
            <div class="p-3 rounded-lg border ${window.currentTemplateId === t.id ? 'border-blue-500 bg-blue-50' : 'border-slate-200 bg-white hover:border-blue-300'} transition cursor-pointer flex justify-between items-center group" onclick="window.editTemplate('${t.id}')">
                <span class="font-bold text-sm text-slate-700 truncate pr-2">${t.name}</span>
                <button onclick="event.stopPropagation(); window.deleteTemplate('${t.id}')" class="text-rose-400 hover:text-white hover:bg-rose-500 px-1.5 py-0.5 rounded text-xs font-bold opacity-0 group-hover:opacity-100 transition">&times;</button>
            </div>
        `).join('');
    };

    window.createNewTemplate = function() {
        const id = 'tpl_' + Date.now();
        TEACHER_TEMPLATES.push({ id, name: 'New Strategy / Explanation', html: '<div class="bg-blue-50 border-l-4 border-blue-500 p-3 mb-2 text-sm text-blue-900 shadow-sm"><strong class="text-blue-700 uppercase tracking-widest text-[10px]">Tiêu đề</strong><br><b>Nội dung:</b><ul class="list-decimal pl-5 mt-1.5 space-y-1"><li>Điểm 1.</li><li>Điểm 2.</li></ul></div><p><br></p>' });
        window.saveTemplatesToCloud();
        window.editTemplate(id);
    };

    window.editTemplate = function(id) {
        window.currentTemplateId = id;
        window.renderTemplateList();
        const t = TEACHER_TEMPLATES.find(x => x.id === id);
        if(!t) return;
        
        document.getElementById('template-editor-area').innerHTML = `
            <label class="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-1">Template Name (Dropdown Label)</label>
            <input type="text" value="${t.name.replace(/"/g, '&quot;')}" oninput="window.updateTemplateName('${id}', this.value)" class="w-full border-2 border-slate-200 p-2.5 rounded-lg text-sm font-bold text-slate-800 outline-none focus:border-blue-500 transition-colors mb-5">
            
            <label class="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-1">HTML Design / Content</label>
            <div class="flex gap-1.5 bg-slate-100 p-2 rounded-t-lg border border-slate-300 shadow-sm">
                <button onmousedown="event.preventDefault(); document.execCommand('bold')" class="px-3 py-1 bg-white border border-slate-200 rounded text-xs font-bold shadow-sm hover:bg-slate-50">B</button>
                <button onmousedown="event.preventDefault(); document.execCommand('italic')" class="px-3 py-1 bg-white border border-slate-200 rounded text-xs italic shadow-sm hover:bg-slate-50">I</button>
                <button onmousedown="event.preventDefault(); document.execCommand('underline')" class="px-3 py-1 bg-white border border-slate-200 rounded text-xs underline shadow-sm hover:bg-slate-50">U</button>
            </div>
            <div id="tpl-edit-html" contenteditable="true" class="rich-editor flex-1 border border-slate-300 rounded-b-lg p-5 outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all bg-white overflow-y-auto leading-relaxed" oninput="window.updateTemplateContent('${id}')">${t.html}</div>
            ${renderTemplateAssignmentSettings(id)}
        `;
    };

    window.assignTemplateToQuestionType = function(templateId) {
        if (!TEACHER_TEMPLATES.some(template => template.id === templateId)) return;
        const target = document.getElementById('template-question-type')?.value || '';
        const [skill, type] = target.split(':');
        if (!TEMPLATE_QUESTION_TYPES[skill]?.some(([questionType]) => questionType === type)) return;
        TEACHER_TEMPLATE_ASSIGNMENTS[getTemplateAssignmentKey(skill, type)] = templateId;
        refreshTemplateAssignmentSettings(templateId);
        window.saveTemplatesToCloud();
    };

    window.unassignTemplateFromQuestionType = function(templateId, key) {
        if (TEACHER_TEMPLATE_ASSIGNMENTS[key] !== templateId) return;
        delete TEACHER_TEMPLATE_ASSIGNMENTS[key];
        refreshTemplateAssignmentSettings(templateId);
        window.saveTemplatesToCloud();
    };

    window.updateTemplateName = function(id, val) {
        const t = TEACHER_TEMPLATES.find(x => x.id === id);
        if(t) { t.name = val; window.saveTemplatesToCloud(); window.renderTemplateList(); }
    };
    window.updateTemplateContent = function(id) {
        const t = TEACHER_TEMPLATES.find(x => x.id === id);
        if(t) { t.html = document.getElementById('tpl-edit-html').innerHTML; window.saveTemplatesToCloud(); }
    };
    window.deleteTemplate = function(id) {
        if(confirm('Permanently delete this template?')) {
            TEACHER_TEMPLATES = TEACHER_TEMPLATES.filter(x => x.id !== id);
            Object.keys(TEACHER_TEMPLATE_ASSIGNMENTS).forEach(key => {
                if (TEACHER_TEMPLATE_ASSIGNMENTS[key] === id) delete TEACHER_TEMPLATE_ASSIGNMENTS[key];
            });
            window.saveTemplatesToCloud();
            if(window.currentTemplateId === id) window.currentTemplateId = null;
            window.openTemplateManager(); 
        }
    };
    window.saveTemplatesToCloud = async function() {
        try {
            await window.fsSetDoc(window.fsDoc(window.db, window.fPath('settings'), 'templates'), {
                items: TEACHER_TEMPLATES,
                assignments: TEACHER_TEMPLATE_ASSIGNMENTS
            });
        } catch(e) {
            console.error('Unable to save teacher templates and question type assignments:', e);
        }
    };

    window.insertCustomTemplate = function(editorId, templateId) {
        const t = TEACHER_TEMPLATES.find(x => x.id === templateId);
        const editor = document.getElementById(editorId);
        if(t && editor) {
             editor.focus();
             document.execCommand('insertHTML', false, t.html);
             if(window.triggerEditorAutosave) window.triggerEditorAutosave();
        }
    };

    window.insertVideo = function() {
        // Create a hidden dynamic file input
        const fileInput = document.createElement('input');
        fileInput.type = 'file';
        fileInput.accept = 'video/*';
    
        fileInput.onchange = async function(e) {
            const file = e.target.files[0];
            if (!file) return;

            // Warn users about large video files
            if (file.size > 50 * 1024 * 1024) { // 50MB Limit
                alert("Video file is too large! Please compress it under 50MB before uploading.");
                return;
            }

            const tempId = 'vid_' + Date.now();
            document.execCommand('insertHTML', false, `<div id="${tempId}" class="my-4 p-4 bg-slate-100 rounded text-center font-bold text-blue-600 border-2 border-dashed border-blue-300 animate-pulse" contenteditable="false">Uploading Video... Please wait...</div><p><br></p>`);
            
            try {
                const path = 'videos/' + Date.now() + '_' + file.name.replace(/[^a-zA-Z0-9.]/g, '');
                const url = await window.uploadMediaToStorage(file, path);
                
                const html = `
                    <div class="my-4 p-2 bg-slate-100 rounded border border-slate-300 inline-block max-w-xl" contenteditable="false">
                        <video controls src="${url}" class="w-full max-h-[360px] rounded bg-black shadow-inner"></video>
                        <div class="text-xs text-slate-500 mt-1 font-sans font-medium text-center">🎥 Embedded Explanation Video</div>
                    </div>
                    <p><br></p>
                `;
                
                const placeholder = document.getElementById(tempId);
                if (placeholder) placeholder.outerHTML = html;
                else document.execCommand('insertHTML', false, html);
                
                if (window.triggerEditorAutosave) window.triggerEditorAutosave();
            } catch (err) {
                console.error("Video Upload Error:", err);
                const placeholder = document.getElementById(tempId);
                if (placeholder) placeholder.innerHTML = `<span class="text-rose-500">Video Upload Failed.</span>`;
            }
        };

        fileInput.click();
    };

    // ==========================================
    // ✨ TEXT-TO-TEST (IELTS MARKDOWN) COMPILER
    // ==========================================
    
