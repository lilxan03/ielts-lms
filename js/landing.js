    window.populateLandingPageEditor = function() {
        document.getElementById('pp-app-name').value = PUBLIC_PROFILE.appName || '';
        document.getElementById('pp-opening-title').value = PUBLIC_PROFILE.openingTitle || '';
        document.getElementById('pp-opening-message').value = PUBLIC_PROFILE.openingMessage || '';
        document.getElementById('pp-title').value = PUBLIC_PROFILE.missionTitle || '';
        document.getElementById('pp-mission').value = PUBLIC_PROFILE.missionText || '';
        
        // Handle Hero Image
        window.tempPPHero = PUBLIC_PROFILE.heroImage || null;
        window.tempPPHeroRevision = Number(PUBLIC_PROFILE.heroImageRevision) || 0;
        const heroPreview = document.getElementById('pp-hero-preview');
        if (heroPreview) {
            heroPreview.src = window.tempPPHeroRevision >= 2 && window.tempPPHero
                ? window.tempPPHero
                : 'assets/teacher-graduation.png';
            heroPreview.classList.remove('hidden');
        }

        // Handle TRF Image
        window.tempPPTrf = PUBLIC_PROFILE.trfImage || null;
        const trfPreview = document.getElementById('pp-trf-preview');
        const trfPlaceholder = document.getElementById('pp-trf-placeholder');
        if(window.tempPPTrf && trfPreview) {
            trfPreview.src = window.tempPPTrf;
            trfPreview.classList.remove('hidden');
            if(trfPlaceholder) trfPlaceholder.classList.add('hidden');
        } else if(trfPreview) {
            trfPreview.src = '';
            trfPreview.classList.add('hidden');
            if(trfPlaceholder) trfPlaceholder.classList.remove('hidden');
        }
        
        window.tempPPFeatures = [...(PUBLIC_PROFILE.features || [])];
        window.tempPPAchievements = [...(PUBLIC_PROFILE.achievements || [])];
        window.tempPPPdfs = [...(PUBLIC_PROFILE.pdfs || [])];
        window.tempPPBio = PUBLIC_PROFILE.bio || '';
        window.tempPPSpecialties = [...(PUBLIC_PROFILE.specialties || [])];
        window.tempPPCredentials = [...(PUBLIC_PROFILE.credentials || [])];
        window.tempPPPhilosophy = PUBLIC_PROFILE.philosophy || '';
        window.tempPPClasses = [...(PUBLIC_PROFILE.classes || [])];
        window.tempPPServices = [...(PUBLIC_PROFILE.services || [])];
        window.tempPPHighlights = [...(PUBLIC_PROFILE.highlights || [])];

        const bioInput = document.getElementById('pp-bio');
        const philosophyInput = document.getElementById('pp-philosophy');
        if (bioInput) bioInput.value = window.tempPPBio;
        if (philosophyInput) philosophyInput.value = window.tempPPPhilosophy;
        
        // ✨ NEW: Safely migrate old data and load new data into the working editor
        let workingHof = [];
        if (HOF_STUDENTS.length > 0) {
            workingHof = JSON.parse(JSON.stringify(HOF_STUDENTS));
        } else if (PUBLIC_PROFILE.hallOfFame && PUBLIC_PROFILE.hallOfFame.length > 0) {
            // Migration fallback
            workingHof = JSON.parse(JSON.stringify(PUBLIC_PROFILE.hallOfFame));
        }
        
        workingHof.forEach(h => {
            if(!h.id) h.id = 'hof_' + Date.now() + Math.random().toString(36).substr(2,5);
        });
        
        window.tempPPHallOfFame = workingHof;
        
        window.renderPPList('features');
        window.renderPPList('achievements');
        window.renderPPList('specialties');
        window.renderPPList('credentials');
        window.renderPPList('classes');
        window.renderPPList('services');
        window.renderPPList('highlights');
        window.renderPPPdfList();
        window.renderPPHallOfFame();
    };

    window.handlePPHero = function(e) {
        const file = e.target.files[0];
        if (!file) return;
        window.compressProfileImage(file, 1200, 0.82, (base64) => {
            window.tempPPHero = base64;
            window.tempPPHeroRevision = 2;
            document.getElementById('pp-hero-preview').src = base64;
            document.getElementById('pp-hero-preview').classList.remove('hidden');
        });
    };

    window.handlePPTrf = function(e) {
        const file = e.target.files[0];
        if (!file) return;
        window.compressProfileImage(file, 600, 0.5, (base64) => {
            window.tempPPTrf = base64;
            document.getElementById('pp-trf-preview').src = base64;
            document.getElementById('pp-trf-preview').classList.remove('hidden');
            document.getElementById('pp-trf-placeholder').classList.add('hidden');
        });
    };

    window.clearPPTrf = function() {
        window.tempPPTrf = null;
        document.getElementById('pp-trf-upload').value = '';
        document.getElementById('pp-trf-preview').src = '';
        document.getElementById('pp-trf-preview').classList.add('hidden');
        document.getElementById('pp-trf-placeholder').classList.remove('hidden');
    };

    window.addPPList = function(type) {
        if(type === 'features') window.tempPPFeatures.push('New Feature...');
        if(type === 'achievements') window.tempPPAchievements.push('New Achievement...');
        if(type === 'specialties') window.tempPPSpecialties.push('New Specialty...');
        if(type === 'credentials') window.tempPPCredentials.push('New Credential...');
        if(type === 'classes') window.tempPPClasses.push('New Class...');
        if(type === 'services') window.tempPPServices.push('New Service...');
        if(type === 'highlights') window.tempPPHighlights.push('New Highlight...');
        window.renderPPList(type);
    };

    window.renderPPList = function(type) {
        const c = document.getElementById(`pp-${type}-list`);
        if(!c) return;
        const arr = type === 'features' ? window.tempPPFeatures :
            type === 'achievements' ? window.tempPPAchievements :
            type === 'specialties' ? window.tempPPSpecialties :
            type === 'credentials' ? window.tempPPCredentials :
            type === 'classes' ? window.tempPPClasses :
            type === 'services' ? window.tempPPServices :
            window.tempPPHighlights;
        c.innerHTML = arr.map((item, i) => `
            <div class="flex gap-2">
                <input type="text" value="${(item || '').replace(/"/g, '&quot;')}" oninput="window.updatePPList('${type}', ${i}, this.value)" class="flex-1 border border-slate-200 p-2 rounded text-sm outline-none focus:border-blue-500">
                <button onclick="window.removePPList('${type}', ${i})" class="text-rose-500 font-bold px-2 hover:bg-rose-50 rounded">✕</button>
            </div>
        `).join('');
    };

    window.updatePPList = function(type, i, val) {
        if(type === 'features') window.tempPPFeatures[i] = val;
        if(type === 'achievements') window.tempPPAchievements[i] = val;
        if(type === 'specialties') window.tempPPSpecialties[i] = val;
        if(type === 'credentials') window.tempPPCredentials[i] = val;
        if(type === 'classes') window.tempPPClasses[i] = val;
        if(type === 'services') window.tempPPServices[i] = val;
        if(type === 'highlights') window.tempPPHighlights[i] = val;
    };

    window.removePPList = function(type, i) {
        if(type === 'features') window.tempPPFeatures.splice(i, 1);
        if(type === 'achievements') window.tempPPAchievements.splice(i, 1);
        if(type === 'specialties') window.tempPPSpecialties.splice(i, 1);
        if(type === 'credentials') window.tempPPCredentials.splice(i, 1);
        if(type === 'classes') window.tempPPClasses.splice(i, 1);
        if(type === 'services') window.tempPPServices.splice(i, 1);
        if(type === 'highlights') window.tempPPHighlights.splice(i, 1);
        window.renderPPList(type);
    };

    window.handlePPPdf = async function(e) {
        const file = e.target.files[0];
        if (!file) return;
        
        // Since it's going to Storage, we can bump the limit up to 5MB easily!
        if (file.size > 5000000) { alert("File too large! Lead Magnet PDFs must be under 5MB."); return; } 
        
        const btn = document.getElementById('pp-pdf-upload');
        btn.disabled = true;
        
        const path = 'pdfs/' + Date.now() + '_' + file.name.replace(/[^a-zA-Z0-9.]/g, '');
        
        try {
            const url = await window.uploadMediaToStorage(file, path);
            window.tempPPPdfs.push({ name: file.name, data: url });
            window.renderPPPdfList();
        } catch (err) {
            console.error("PDF Upload Error:", err);
            alert("Failed to upload PDF.");
        }
        
        btn.disabled = false;
        btn.value = '';
    };

    window.renderPPPdfList = function() {
        const c = document.getElementById('pp-pdf-list');
        c.innerHTML = window.tempPPPdfs.map((p, i) => `
            <div class="flex justify-between items-center bg-slate-50 p-2 rounded border border-slate-200 text-sm">
                <span class="truncate font-bold text-slate-700">${p.name}</span>
                <button onclick="window.tempPPPdfs.splice(${i},1); window.renderPPPdfList()" class="text-rose-500 font-bold px-2 hover:bg-rose-100 rounded ml-2">✕</button>
            </div>
        `).join('');
    };

    // --- HALL OF FAME LOGIC ---
    window.addPPHallOfFame = function() {
        const newId = 'hof_' + Date.now() + Math.random().toString(36).substr(2,5);
        window.tempPPHallOfFame.unshift({ id: newId, name: '', score: '', quote: '', avatar: null, trf: null });
        window.renderPPHallOfFame();
    };

    window.handleHofImage = function(e, i, field) {
        const file = e.target.files[0];
        if (!file) return;
        
        // ✨ NEW: Since they have their own database file now, we can increase the resolution heavily!
        const maxDim = field === 'avatar' ? 200 : 800;
        const quality = field === 'avatar' ? 0.6 : 0.7;
        
        window.compressProfileImage(file, maxDim, quality, (base64) => {
            window.tempPPHallOfFame[i][field] = base64;
            window.renderPPHallOfFame();
        });
    };

    window.renderPPHallOfFame = function() {
        const c = document.getElementById('pp-hall-of-fame-list');
        if(!c) return; 

        if(window.tempPPHallOfFame.length === 0) {
            c.innerHTML = `<p class="text-sm text-slate-400 italic bg-slate-50 p-4 border border-slate-200 rounded-xl text-center">No students added yet.</p>`;
            return;
        }

        c.innerHTML = window.tempPPHallOfFame.map((student, i) => `
            <div class="bg-slate-50 border border-slate-200 p-4 rounded-xl flex flex-col gap-4 relative">
                <button type="button" onclick="window.removePPHallOfFame(${i})" class="absolute top-2 right-2 text-rose-400 hover:text-rose-600 bg-rose-50 w-6 h-6 rounded flex items-center justify-center font-bold">&times;</button>
                
                <div class="flex gap-4 items-start">
                    <div class="flex flex-col gap-2 shrink-0">
                        <div class="w-16 h-16 rounded-full border border-slate-300 bg-white overflow-hidden relative group cursor-pointer" onclick="document.getElementById('hof-avatar-${i}').click()">
                            <img src="${student.avatar || 'https://ui-avatars.com/api/?name=Avatar&background=random'}" class="w-full h-full object-cover">
                            <div class="absolute inset-0 bg-black/50 text-white text-[9px] font-bold flex items-center justify-center opacity-0 group-hover:opacity-100 transition text-center">Change Face</div>
                        </div>
                        <input type="file" id="hof-avatar-${i}" accept="image/*" class="hidden" onchange="window.handleHofImage(event, ${i}, 'avatar')">
                    </div>
                    
                    <div class="flex-1 space-y-2 pr-4">
                        <input type="text" placeholder="Student Name" value="${(student.name||'').replace(/"/g, '&quot;')}" oninput="window.tempPPHallOfFame[${i}].name = this.value" class="w-full border border-slate-200 p-2 rounded text-sm outline-none focus:border-blue-500 font-bold">
                        <div class="flex gap-2">
                            <input type="text" placeholder="Score (e.g., Band 8.0)" value="${(student.score||'').replace(/"/g, '&quot;')}" oninput="window.tempPPHallOfFame[${i}].score = this.value" class="w-1/3 border border-slate-200 p-2 rounded text-sm outline-none focus:border-blue-500 text-emerald-700 font-black bg-white">
                            <input type="text" placeholder="Or paste Avatar Image URL..." value="${student.avatar && student.avatar.startsWith('http') ? student.avatar : ''}" onchange="if(this.value){ window.tempPPHallOfFame[${i}].avatar = this.value; window.renderPPHallOfFame(); }" class="flex-1 border border-slate-200 p-2 rounded text-xs outline-none focus:border-blue-500 font-mono text-blue-600 bg-white">
                        </div>
                    </div>
                </div>
                
                <textarea placeholder="Student's quote or comment..." oninput="window.tempPPHallOfFame[${i}].quote = this.value" class="w-full border border-slate-200 p-2 rounded text-sm outline-none focus:border-blue-500 bg-white resize-none h-16">${(student.quote||'')}</textarea>
                
                <div class="border-t border-slate-200 pt-3">
                    <label class="block text-[10px] font-bold text-slate-500 uppercase mb-2">TRF / Score Screenshot (Optional)</label>
                    <div class="flex items-center gap-3 mb-2">
                        ${student.trf ? `<img src="${student.trf}" class="h-10 rounded border border-slate-300"> <button type="button" onclick="window.tempPPHallOfFame[${i}].trf = null; window.renderPPHallOfFame()" class="text-[10px] text-rose-500 hover:underline">Remove TRF</button>` : ''}
                        <button type="button" onclick="document.getElementById('hof-trf-${i}').click()" class="text-[10px] bg-white border border-slate-300 px-2 py-1.5 rounded shadow-sm hover:bg-slate-100 font-bold">+ Upload Score Pic</button>
                        <input type="file" id="hof-trf-${i}" accept="image/*" class="hidden" onchange="window.handleHofImage(event, ${i}, 'trf')">
                    </div>
                    <input type="text" placeholder="Or paste TRF Image URL..." value="${student.trf && student.trf.startsWith('http') ? student.trf : ''}" onchange="if(this.value){ window.tempPPHallOfFame[${i}].trf = this.value; window.renderPPHallOfFame(); }" class="w-full border border-slate-200 p-2 rounded text-xs outline-none focus:border-blue-500 font-mono text-blue-600 bg-white">
                </div>
            </div>
        `).join('');
    };

    window.removePPHallOfFame = function(i) {
        window.tempPPHallOfFame.splice(i, 1);
        window.renderPPHallOfFame();
    };
    // END OF HALL OF FAME EDITOR LOGIC

    window.savePublicProfile = async function() {
        const btn = document.getElementById('btn-save-pub');
        btn.textContent = 'Saving...'; btn.disabled = true;

        PUBLIC_PROFILE = {
            ...PUBLIC_PROFILE,
            appName: document.getElementById('pp-app-name').value.trim(),
            openingTitle: document.getElementById('pp-opening-title').value.trim(),
            openingMessage: document.getElementById('pp-opening-message').value.trim(),
            missionTitle: document.getElementById('pp-title').value.trim(),
            missionText: document.getElementById('pp-mission').value.trim(),
            heroImage: window.tempPPHero,
            heroImageRevision: Number(window.tempPPHeroRevision) || 0,
            trfImage: window.tempPPTrf,
            bio: window.tempPPBio.trim(),
            specialties: window.tempPPSpecialties.filter(s => s.trim()),
            credentials: window.tempPPCredentials.filter(c => c.trim()),
            philosophy: window.tempPPPhilosophy.trim(),
            classes: window.tempPPClasses.filter(c => c.trim()),
            services: window.tempPPServices.filter(s => s.trim()),
            highlights: window.tempPPHighlights.filter(h => h.trim()),
            features: window.tempPPFeatures.filter(f => f.trim()),
            achievements: window.tempPPAchievements.filter(a => a.trim()),
            pdfs: window.tempPPPdfs
            // Note: hallOfFame is no longer stored here!
        };

        // Size check strictly for the Landing Page data
        const payloadString = JSON.stringify(PUBLIC_PROFILE);
        if (new Blob([payloadString]).size > 1000000) {
             showModalMsg("Storage Limit Exceeded ⚠️", `Your Landing Page data is too large. Delete heavy PDF files or reduce your main hero image size.`);
             btn.textContent = 'Save Changes'; btn.disabled = false;
             return;
        }

        try {
            // 1. Save Landing Page Details
            await window.fsSetDoc(window.fsDoc(window.db, window.fPath('settings'), 'public_profile'), PUBLIC_PROFILE);
            window.cacheStartupBranding(PUBLIC_PROFILE);
            window.applyGlobalLogo();
            window.renderPublicProfile();
            
            // 2. ✨ NEW: Save Hall of Fame safely to their own individual database files!
            const currentIds = window.tempPPHallOfFame.map(h => h.id);
            const deletedStudents = HOF_STUDENTS.filter(h => !currentIds.includes(h.id));
            
            // Delete students removed from the editor
            for (let ds of deletedStudents) {
                await window.fsDeleteDoc(window.fsDoc(window.db, window.fPath('hall_of_fame'), ds.id));
            }
            
            // Save active students (only if they have a name)
            const validStudents = window.tempPPHallOfFame.filter(h => h.name.trim() !== '');
            for (let s of validStudents) {
                if(!s.id) s.id = 'hof_' + Date.now() + Math.random().toString(36).substr(2,5);
                await window.fsSetDoc(window.fsDoc(window.db, window.fPath('hall_of_fame'), s.id), s);
            }

            showModalMsg("Saved", "Your public storefront and Hall of Fame have been successfully updated!");
        } catch (e) {
            console.error(e);
            showModalMsg("Error", "Could not save to cloud. Detailed error: " + e.message);
        }
        btn.textContent = 'Save Changes'; btn.disabled = false;
    };

    window.openHOFScreen = function() {
        if (routerReady && !appRouterApplying) {
            window.navigateAppRoute('hall-of-fame');
            return;
        }
        document.getElementById('hof-full-screen').classList.remove('hidden');
        window.renderHOFGrid();
    };

    window.closeHOFScreen = function() {
        document.getElementById('hof-full-screen').classList.add('hidden');
        const homeRoute = currentUser
            ? (['teacher', 'collaborator'].includes(currentUser.role) ? 'teacher/bank/tests' : 'student/dashboard')
            : 'landing';
        window.navigateAppRoute(homeRoute, true);
    };

    window.renderHOFGrid = function() {
        const grid = document.getElementById('hof-full-grid');
        if(!grid) return;
        
        // ✨ NEW: Automatically sort students from highest score to lowest score
        const sortedStudents = [...HOF_STUDENTS].sort((a, b) => {
            // Extracts just the numbers (e.g., "Band 8.5" becomes 8.5)
            const scoreA = parseFloat((a.score || '').replace(/[^\d.]/g, '')) || 0;
            const scoreB = parseFloat((b.score || '').replace(/[^\d.]/g, '')) || 0;
            return scoreB - scoreA; // Sort descending
        });
        
        grid.innerHTML = sortedStudents.map(student => `
             <div class="bg-white rounded-3xl p-8 shadow-xl shadow-slate-200/50 border border-slate-100 flex flex-col items-center text-center relative overflow-hidden group hover:-translate-y-2 transition-transform duration-300">
                <div class="absolute top-0 inset-x-0 h-32 bg-gradient-to-b from-amber-50 to-white"></div>
                
                <div class="relative w-32 h-32 mb-6 z-10 shrink-0">
                    <img src="${student.avatar || 'https://ui-avatars.com/api/?name=Student&background=random'}" class="w-full h-full rounded-full object-cover border-4 border-white shadow-lg bg-slate-50 pointer-events-none select-none" style="-webkit-user-drag: none;">
                    <div class="absolute -bottom-3 -right-3 bg-gradient-to-br from-amber-400 to-orange-500 text-white font-black text-base px-4 py-1 rounded-full border-4 border-white shadow-md whitespace-nowrap transform rotate-[-5deg]">Band ${student.score}</div>
                </div>
                
                <h4 class="font-black text-slate-800 text-2xl mb-4 z-10">${student.name}</h4>
                ${student.quote ? `<p class="text-base text-slate-600 italic mb-8 leading-relaxed z-10 font-medium relative">"${student.quote}"</p>` : ''}
                
                ${student.trf ? `
                    <div class="mt-auto w-full z-10">
                        <button onclick="window.openLightbox('${student.trf}', event)" class="w-full bg-slate-50 hover:bg-amber-50 text-slate-700 hover:text-amber-800 border border-slate-200 hover:border-amber-300 font-bold py-3.5 rounded-xl transition-colors shadow-sm flex items-center justify-center gap-2 group-hover:bg-amber-500 group-hover:text-white group-hover:border-amber-500">
                            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="12" y1="18" x2="12" y2="12"></line><line x1="9" y1="15" x2="15" y2="15"></line></svg>
                            View Official TRF Score
                        </button>
                    </div>
                ` : ''}
            </div>
        `).join('');
    };

    function ensurePartInteractiveCharts(part) {
    if (part.interactiveChart && (!Array.isArray(part.interactiveCharts) || part.interactiveCharts.length === 0)) {
        part.interactiveCharts = JSON.parse(JSON.stringify([part.interactiveChart]));
        delete part.interactiveChart;
        return true;
    }
    if (!Array.isArray(part.interactiveCharts)) part.interactiveCharts = [];
    return false;
}

window.loadChartEditorUI = function() {
    const container = document.getElementById('chart-editor-list');
    if (!container) return;

    document.querySelectorAll('.builder-chart-canvas').forEach(canvas => {
        const chartStatus = Chart.getChart(canvas);
        if (chartStatus) chartStatus.destroy();
    });
    container.innerHTML = '';

    const part = APP_DATA.parts[currentEditorPartIdx];
    if (!part) return;
    window.updateBuilderFeatureVisibility(part);
    if (!isCurrentEditorWritingTask1Part(part)) return;

    if (ensurePartInteractiveCharts(part) && typeof window.triggerEditorAutosave === 'function') {
        window.triggerEditorAutosave();
    }

    container.innerHTML = part.interactiveCharts.map((chart, index) => `
        <div class="bg-white p-4 rounded-xl border border-slate-200 shadow-sm relative animate-fade-in mb-4">
            <button type="button" onclick="window.removeEditorChart(${index})" class="absolute top-3 right-3 w-8 h-8 flex justify-center items-center bg-rose-50 text-rose-500 hover:bg-rose-500 hover:text-white rounded-lg font-bold transition">&times;</button>
            <h4 class="text-xs font-black text-slate-400 uppercase tracking-widest mb-3 border-b border-slate-100 pb-2">Biểu đồ #${index + 1}</h4>
            <div class="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4 pr-10">
                <div>
                    <label class="text-[10px] font-bold text-slate-500 uppercase">Loại biểu đồ</label>
                    <select id="edit-chart-type-${index}" class="w-full border-2 border-slate-200 p-2 rounded-lg text-sm font-bold text-slate-700 outline-none focus:border-indigo-500 transition-colors bg-slate-50 cursor-pointer" onchange="window.saveEditorChart(${index})">
                        <option value="bar" ${chart.type === 'bar' ? 'selected' : ''}>Bar Chart (Cột)</option>
                        <option value="line" ${chart.type === 'line' ? 'selected' : ''}>Line Graph (Đường)</option>
                        <option value="pie" ${chart.type === 'pie' ? 'selected' : ''}>Pie Chart (Tròn)</option>
                        <option value="doughnut" ${chart.type === 'doughnut' ? 'selected' : ''}>Doughnut Chart</option>
                        <option value="table" ${chart.type === 'table' ? 'selected' : ''}>Table</option>
                    </select>
                </div>
                <div>
                    <label class="text-[10px] font-bold text-slate-500 uppercase">Tiêu đề</label>
                    <input type="text" id="edit-chart-title-${index}" value="${chart.title || ''}" placeholder="e.g. Population..." class="w-full border-2 border-slate-200 p-2 rounded-lg text-sm font-bold text-slate-700 outline-none focus:border-indigo-500 transition-colors bg-slate-50" oninput="window.saveEditorChart(${index})">
                </div>
                <div>
                    <label class="text-[10px] font-bold text-slate-500 uppercase">Đơn vị (Trục Y & Tooltip)</label>
                    <div class="flex gap-2">
                        <select id="edit-chart-unit-type-${index}" class="w-2/5 border-2 border-slate-200 p-2 rounded-lg text-sm font-bold text-slate-700 outline-none focus:border-indigo-500 bg-slate-50 cursor-pointer" onchange="window.saveEditorChart(${index})">
                            <option value="" ${!chart.unitType ? 'selected' : ''}>Số</option>
                            <option value="%" ${chart.unitType === '%' ? 'selected' : ''}>%</option>
                            <option value="custom" ${chart.unitType === 'custom' ? 'selected' : ''}>Khác</option>
                        </select>
                        <input type="text" id="edit-chart-unit-custom-${index}" value="${chart.unitCustom || ''}" placeholder="kg, km..." class="w-3/5 border-2 border-slate-200 p-2 rounded-lg text-sm font-bold text-slate-700 outline-none focus:border-indigo-500 bg-slate-50 ${chart.unitType === 'custom' ? '' : 'hidden'}" oninput="window.saveEditorChart(${index})">
                    </div>
                </div>
                <div>
                    <label class="text-[10px] font-bold text-slate-500 uppercase">Mốc thời gian (tùy chọn)</label>
                    <input type="text" id="edit-chart-time-${index}" value="${chart.time || ''}" placeholder="e.g. 2024" class="w-full border-2 border-slate-200 p-2 rounded-lg text-sm font-bold text-slate-700 outline-none focus:border-indigo-500 bg-slate-50" oninput="window.saveEditorChart(${index})">
                </div>
            </div>
            <label class="text-[10px] font-bold text-slate-500 uppercase flex justify-between items-end mb-1">
                <span>Dữ liệu CSV (Category, Series...)</span>
            </label>
            <div class="flex flex-wrap gap-2 mb-2">
                <button type="button" onclick="window.downloadEditorChartCsvTemplate(${index})" class="px-3 py-1.5 text-xs font-bold text-indigo-700 bg-indigo-50 border border-indigo-200 rounded-lg hover:bg-indigo-100">Tải mẫu CSV</button>
                <button type="button" onclick="document.getElementById('edit-chart-csv-file-${index}').click()" class="px-3 py-1.5 text-xs font-bold text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50">Nhập CSV</button>
                <input id="edit-chart-csv-file-${index}" type="file" accept=".csv,text/csv" class="hidden" onchange="window.importEditorChartCsv(${index}, this)">
                <span class="self-center text-[11px] text-slate-500">CSV gồm cấu hình biểu đồ (loại, tiêu đề, đơn vị, thời gian) và bảng dữ liệu. Ô số trống được tính là 0.</span>
            </div>
            <textarea id="edit-chart-data-${index}" class="w-full border-2 border-slate-200 p-3 rounded-lg text-sm outline-none focus:border-indigo-500 h-24 font-mono whitespace-pre bg-slate-50 custom-scrollbar mb-1" placeholder="# Interactive Chart,1&#10;type,bar&#10;title,Population&#10;unitType,%&#10;unitCustom,&#10;time,2026&#10;Category,2021,2026&#10;Singapore,4500,7000" oninput="window.saveEditorChart(${index}, true)">${chart.rawTsv || ''}</textarea>
            <p id="edit-chart-data-error-${index}" class="hidden text-xs font-semibold text-rose-600 mb-3" role="alert"></p>
            <div class="interactive-chart-frame">
                <canvas id="builder-chart-preview-${index}" class="builder-chart-canvas"></canvas>
            </div>
        </div>
    `).join('');

    setTimeout(() => {
        if (APP_DATA.parts[currentEditorPartIdx] !== part) return;
        window.renderEditorChartPreviews(part);
    }, 0);
};

window.renderEditorChartPreviews = function(part) {
    const charts = part.interactiveCharts || [];
    const pointColorMap = window.getChartPointColorMap(charts);
    const legendOwnerIndex = window.getChartLegendOwnerIndex(charts);
    charts.forEach((chart, index) => {
        if (chart.labels && chart.labels.length > 0) {
            window.renderCanvasChart(
                `builder-chart-preview-${index}`,
                window.getChartConfigInReferenceOrder(charts, index),
                pointColorMap,
                undefined,
                { showLegend: index === legendOwnerIndex }
            );
        }
    });
};

window.addEditorChart = function() {
    const part = APP_DATA.parts[currentEditorPartIdx];
    if (!isCurrentEditorWritingTask1Part(part)) return;
    ensurePartInteractiveCharts(part);
    part.interactiveCharts.push({ type: 'bar', title: '', rawTsv: '', labels: [], datasets: [], unitType: '', unitCustom: '', time: '' });
    window.loadChartEditorUI();
    if (typeof window.triggerEditorAutosave === 'function') window.triggerEditorAutosave();
};

window.parseEditorChartData = function(rawData, type) {
    const text = String(rawData || '').replace(/^\uFEFF/, '');
    if (!text.trim()) return { labels: [], datasets: [], metadata: null };

    const firstLine = text.split(/\r?\n/, 1)[0];
    const delimiter = firstLine.includes('\t') ? '\t' : ',';
    const rows = [];
    let row = [];
    let cell = '';
    let inQuotes = false;

    for (let index = 0; index < text.length; index++) {
        const character = text[index];
        if (character === '"') {
            if (inQuotes && text[index + 1] === '"') {
                cell += '"';
                index++;
            } else {
                inQuotes = !inQuotes;
            }
        } else if (!inQuotes && character === delimiter) {
            row.push(cell.trim());
            cell = '';
        } else if (!inQuotes && (character === '\n' || character === '\r')) {
            if (character === '\r' && text[index + 1] === '\n') index++;
            row.push(cell.trim());
            if (row.some(value => value !== '')) rows.push(row);
            row = [];
            cell = '';
        } else {
            cell += character;
        }
    }

    if (inQuotes) throw new Error('CSV có dấu ngoặc kép chưa được đóng.');
    row.push(cell.trim());
    if (row.some(value => value !== '')) rows.push(row);
    const hasMetadata = rows[0] && rows[0][0].toLocaleLowerCase() === '# interactive chart';
    const metadata = hasMetadata ? {} : null;
    let dataStart = 0;
    if (hasMetadata) {
        if (rows[0][1] !== '1') throw new Error('Phiên bản CSV interactive chart không được hỗ trợ.');
        dataStart = rows.findIndex((candidate, index) =>
            index > 0 && candidate[0].toLocaleLowerCase() === 'category'
        );
        if (dataStart < 0) throw new Error('CSV thiếu dòng tiêu đề Category của bảng dữ liệu.');
        rows.slice(1, dataStart).forEach((metadataRow, index) => {
            if (metadataRow.length !== 2) throw new Error(`Dòng cấu hình ${index + 2} cần đúng 2 cột.`);
            const key = metadataRow[0].toLocaleLowerCase();
            if (!['type', 'title', 'unittype', 'unitcustom', 'time'].includes(key)) {
                throw new Error(`Tùy chọn cấu hình "${metadataRow[0]}" ở dòng ${index + 2} không hợp lệ.`);
            }
            metadata[key] = metadataRow[1];
        });
        ['type', 'title', 'unittype', 'unitcustom', 'time'].forEach(key => {
            if (!Object.prototype.hasOwnProperty.call(metadata, key)) {
                throw new Error(`CSV thiếu cấu hình "${key}".`);
            }
        });
        if (!['bar', 'line', 'pie', 'doughnut', 'table'].includes(metadata.type)) {
            throw new Error(`Loại biểu đồ "${metadata.type}" không hợp lệ.`);
        }
        if (!['', '%', 'custom'].includes(metadata.unittype)) {
            throw new Error(`Loại đơn vị "${metadata.unittype}" không hợp lệ.`);
        }
        metadata.unitType = metadata.unittype;
        delete metadata.unittype;
        type = metadata.type;
    }
    const dataRows = rows.slice(dataStart);
    if (dataRows.length < 2) throw new Error('Cần có dòng tiêu đề và ít nhất một dòng dữ liệu.');
    if (dataRows[0].length < 2) throw new Error('Cần ít nhất một cột số liệu bên cạnh cột Category.');

    const columnCount = dataRows[0].length;
    const labels = [];
    const values = dataRows.slice(1).map((dataRow, rowIndex) => {
        if (dataRow.length !== columnCount) {
            throw new Error(`Dòng dữ liệu ${rowIndex + 1} có ${dataRow.length} cột; cần đúng ${columnCount} cột.`);
        }
        if (!dataRow[0]) throw new Error(`Dòng dữ liệu ${rowIndex + 1} chưa có Category.`);
        labels.push(dataRow[0]);
        return dataRow.slice(1).map((value, columnIndex) => {
            if (!value) return 0;
            const normalized = value.replace(/,/g, '');
            if (!/^[+-]?(?:\d+\.?\d*|\.\d+)(?:e[+-]?\d+)?$/i.test(normalized)) {
                throw new Error(`Giá trị "${value}" ở dòng dữ liệu ${rowIndex + 1}, cột ${columnIndex + 2} không phải là số.`);
            }
            const number = Number(normalized);
            if (!Number.isFinite(number)) {
                throw new Error(`Giá trị ở dòng dữ liệu ${rowIndex + 1}, cột ${columnIndex + 2} vượt giới hạn.`);
            }
            return number;
        });
    });

    const colors = ['#b2dfdb', '#00897b', '#004d40', '#ffb74d', '#f57c00', '#1976d2'];
    const datasets = dataRows[0].slice(1).map((label, datasetIndex) => {
        const seriesColor = colors[datasetIndex % colors.length];
        const pointColors = ['bar', 'pie', 'doughnut'].includes(type)
            ? labels.map((_, pointIndex) => colors[pointIndex % colors.length])
            : seriesColor;
        return {
            label: label || `Dataset ${datasetIndex + 1}`,
            data: values.map(dataRow => dataRow[datasetIndex]),
            backgroundColor: pointColors,
            borderColor: pointColors,
            borderWidth: 1,
            borderRadius: type === 'bar' ? 3 : 0,
            tension: 0.3
        };
    });
    return { labels, datasets, metadata };
};

window.downloadEditorChartCsvTemplate = function(index) {
    const part = APP_DATA.parts[currentEditorPartIdx];
    const chart = part && Array.isArray(part.interactiveCharts) ? part.interactiveCharts[index] : null;
    if (!chart) return;

    const quote = value => `"${String(value).replace(/"/g, '""')}"`;
    const datasetLabels = (chart.datasets || []).map((dataset, datasetIndex) => dataset.label || `Series ${datasetIndex + 1}`);
    const headers = ['Category', ...(datasetLabels.length ? datasetLabels : ['Series 1', 'Series 2'])];
    const rows = (chart.labels || []).map((label, labelIndex) => [
        label,
        ...headers.slice(1).map((_, datasetIndex) => {
            const value = chart.datasets && chart.datasets[datasetIndex] && chart.datasets[datasetIndex].data
                ? chart.datasets[datasetIndex].data[labelIndex]
                : 0;
            return value === undefined || value === null ? 0 : value;
        })
    ]);
    if (!rows.length) rows.push(['Category 1', ...headers.slice(1).map(() => 0)], ['Category 2', ...headers.slice(1).map(() => 0)]);
    const metadataRows = [
        ['# Interactive Chart', '1'],
        ['type', chart.type || 'bar'],
        ['title', chart.title || ''],
        ['unitType', chart.unitType || ''],
        ['unitCustom', chart.unitCustom || ''],
        ['time', chart.time || '']
    ];
    const csv = [...metadataRows, [], headers, ...rows].map(values => values.map(quote).join(',')).join('\r\n');
    const url = URL.createObjectURL(new Blob(['\uFEFF', csv], { type: 'text/csv;charset=utf-8' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = `chart-${index + 1}-template.csv`;
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 0);
};

window.importEditorChartCsv = function(index, input) {
    const file = input && input.files && input.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
        const dataEl = document.getElementById(`edit-chart-data-${index}`);
        if (!dataEl) return;
        dataEl.value = String(reader.result || '').replace(/^\uFEFF/, '');
        window.saveEditorChart(index, true);
    };
    reader.onerror = () => {
        const errorEl = document.getElementById(`edit-chart-data-error-${index}`);
        if (errorEl) {
            errorEl.textContent = 'Không thể đọc tệp CSV. Vui lòng chọn lại tệp.';
            errorEl.classList.remove('hidden');
        }
        if (typeof window.showToast === 'function') window.showToast('Lỗi CSV', 'Không thể đọc tệp CSV.', 'error');
    };
    reader.readAsText(file);
    input.value = '';
};

window.removeEditorChart = function(index) {
    const part = APP_DATA.parts[currentEditorPartIdx];
    if (!isCurrentEditorWritingTask1Part(part) || !Array.isArray(part.interactiveCharts)) return;
    window.showConfirm("Xóa biểu đồ", "Bạn có chắc chắn muốn xóa biểu đồ này khỏi bài test?", () => {
        part.interactiveCharts.splice(index, 1);
        window.loadChartEditorUI();
        if (typeof window.triggerEditorAutosave === 'function') window.triggerEditorAutosave();
    });
};

window.saveEditorChart = function(index, applyCsvMetadata = false) {
    const part = APP_DATA.parts[currentEditorPartIdx];
    if (!isCurrentEditorWritingTask1Part(part) || !Array.isArray(part.interactiveCharts) || !part.interactiveCharts[index]) return;

    const dataEl = document.getElementById(`edit-chart-data-${index}`);
    const typeEl = document.getElementById(`edit-chart-type-${index}`);
    const titleEl = document.getElementById(`edit-chart-title-${index}`);
    if (!dataEl || !typeEl || !titleEl) return;
    const unitTypeEl = document.getElementById(`edit-chart-unit-type-${index}`);
    const unitCustomEl = document.getElementById(`edit-chart-unit-custom-${index}`);
    const timeEl = document.getElementById(`edit-chart-time-${index}`);

    const chart = part.interactiveCharts[index];
    const rawData = dataEl.value;
    const type = typeEl.value;
    const unitType = unitTypeEl ? unitTypeEl.value : '';
    const unitCustom = unitCustomEl ? unitCustomEl.value : '';
    if (unitCustomEl) unitCustomEl.classList.toggle('hidden', unitType !== 'custom');

    chart.rawTsv = rawData;
    const errorEl = document.getElementById(`edit-chart-data-error-${index}`);
    try {
        const parsed = window.parseEditorChartData(rawData, type);
        const metadata = applyCsvMetadata ? parsed.metadata : null;
        chart.type = metadata ? metadata.type : type;
        chart.title = metadata ? metadata.title : titleEl.value;
        chart.unitType = metadata ? metadata.unitType : unitType;
        chart.unitCustom = metadata ? metadata.unitcustom : unitCustom;
        chart.time = metadata ? metadata.time : (timeEl ? timeEl.value.trim() : '');
        if (metadata) {
            typeEl.value = chart.type;
            titleEl.value = chart.title;
            if (unitTypeEl) unitTypeEl.value = chart.unitType;
            if (unitCustomEl) {
                unitCustomEl.value = chart.unitCustom;
                unitCustomEl.classList.toggle('hidden', chart.unitType !== 'custom');
            }
            if (timeEl) timeEl.value = chart.time;
        }
        chart.labels = parsed.labels;
        chart.datasets = parsed.datasets;
        if (errorEl) {
            errorEl.textContent = '';
            errorEl.classList.add('hidden');
        }
    } catch (error) {
        if (errorEl) {
            errorEl.textContent = error.message;
            errorEl.classList.remove('hidden');
        }
    }
    if (typeof window.triggerEditorAutosave === 'function') window.triggerEditorAutosave();
    window.renderEditorChartPreviews(part);
};

window.getChartConfigInReferenceOrder = function(charts, chartIndex) {
    const chart = charts && charts[chartIndex];
    if (!chart || chartIndex === 0 || !Array.isArray(chart.labels)) return chart;

    const referenceLabels = charts[0] && Array.isArray(charts[0].labels)
        ? charts[0].labels
        : [];
    const labelKey = label => String(label).trim().toLocaleLowerCase();
    const labelIndices = new Map();
    chart.labels.forEach((label, index) => {
        const key = labelKey(label);
        if (!labelIndices.has(key)) labelIndices.set(key, index);
    });

    const orderedLabels = [];
    const orderedIndices = [];
    const addedKeys = new Set();

    referenceLabels.forEach(label => {
        const key = labelKey(label);
        const index = labelIndices.get(key);
        if (index !== undefined && !addedKeys.has(key)) {
            orderedLabels.push(chart.labels[index]);
            orderedIndices.push(index);
            addedKeys.add(key);
        }
    });
    chart.labels.forEach((label, index) => {
        const key = labelKey(label);
        if (!addedKeys.has(key)) {
            orderedLabels.push(label);
            orderedIndices.push(index);
            addedKeys.add(key);
        }
    });

    return {
        ...chart,
        labels: orderedLabels,
        sourceLabelIndices: orderedIndices,
        datasets: (chart.datasets || []).map(dataset => ({
            ...dataset,
            data: Array.isArray(dataset.data)
                ? orderedIndices.map(index => dataset.data[index])
                : dataset.data
        }))
    };
};

window.getChartPointColorMap = function(charts) {
    const colors = ['#b2dfdb', '#00897b', '#004d40', '#ffb74d', '#f57c00', '#1976d2'];
    const colorMap = new Map();

    (charts || []).forEach(chart => {
        (chart.labels || []).forEach(label => {
            const key = String(label).trim().toLocaleLowerCase();
            if (key && !colorMap.has(key)) {
                colorMap.set(key, colors[colorMap.size % colors.length]);
            }
        });
    });

    return colorMap;
};

window.getChartLegendOwnerIndex = function(charts) {
    return (charts || []).findIndex(chart =>
        chart.type !== 'table'
        && Array.isArray(chart.labels)
        && chart.labels.length > 0
        && Array.isArray(chart.datasets)
        && chart.datasets.length > 0
    );
};

window.chartSelectionsByPart = window.chartSelectionsByPart || new WeakMap();

window.getSelectedChartObjects = function(part) {
    return window.chartSelectionsByPart.get(part) || new Map();
};

window.getChartObjectKey = function(chartIndex, datasetIndex, label, labelIndex) {
    return `${chartIndex}|${datasetIndex}|${labelIndex}|${String(label).trim().toLocaleLowerCase()}`;
};

window.getChartObservationTime = function(chart, dataset) {
    const label = String(chart.time || '').trim();
    const yearMatch = label.match(/\b(19\d{2}|20\d{2}|21\d{2})\b/);
    if (yearMatch) return { label, sortValue: Number(yearMatch[1]) };

    const timestamp = Date.parse(label);
    return { label, sortValue: Number.isFinite(timestamp) ? timestamp : null };
};

window.escapeChartHtml = function(value) {
    return String(value).replace(/[&<>"']/g, character => ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#39;'
    })[character]);
};

window.createStudentChartComparisonPanel = function(charts) {
    return `
        <section id="student-chart-comparison" class="mt-6 p-4 bg-indigo-50 border border-indigo-200 rounded-xl">
            <h3 class="font-bold text-indigo-900 mb-1">Chart comparison</h3>
            <p class="text-xs text-slate-600 mb-3">Click individual bars, points, or slices to select figures. The same category in different charts can be selected separately.</p>
            <div id="student-chart-selected-objects" class="flex flex-wrap gap-2 mb-3"></div>
            <div id="student-chart-comparison-results" class="mt-3 text-sm text-slate-700 space-y-3" aria-live="polite">Select figures on the charts to compare them.</div>
        </section>
    `;
};

window.updateStudentChartSelectionVisuals = function(part, charts) {
    const selected = window.getSelectedChartObjects(part);
    const pointColors = ['#b2dfdb', '#00897b', '#004d40', '#ffb74d', '#f57c00', '#1976d2'];
    const pointColorMap = window.getChartPointColorMap(charts);

    charts.forEach((chart, chartIndex) => {
        const config = window.getChartConfigInReferenceOrder(charts, chartIndex);
        if (!config || !Array.isArray(config.labels)) return;

        if (config.type === 'table') {
            const table = document.getElementById(`student-exam-chart-${chartIndex}`);
            if (!table) return;
            table.querySelectorAll('[data-chart-dataset][data-chart-label]').forEach(button => {
                const datasetIndex = Number(button.dataset.chartDataset);
                const labelIndex = Number(button.dataset.chartLabel);
                const sourceLabelIndex = config.sourceLabelIndices ? config.sourceLabelIndices[labelIndex] : labelIndex;
                const key = window.getChartObjectKey(
                    chartIndex,
                    datasetIndex,
                    config.labels[labelIndex],
                    sourceLabelIndex
                );
                const isSelected = selected.has(key);
                button.setAttribute('aria-pressed', String(isSelected));
                button.classList.toggle('bg-indigo-100', isSelected);
                button.classList.toggle('ring-2', isSelected);
                button.classList.toggle('ring-indigo-600', isSelected);
                button.classList.toggle('hover:bg-slate-100', !isSelected);
            });
            return;
        }

        const chartInstance = Chart.getChart(`student-exam-chart-${chartIndex}`);
        if (!chartInstance) return;
        const usesPointColors = ['bar', 'pie', 'doughnut'].includes(config.type);

        config.datasets.forEach((dataset, datasetIndex) => {
            const renderedDataset = chartInstance.data.datasets[datasetIndex];
            if (!renderedDataset) return;
            const isSelectedAt = config.labels.map((label, labelIndex) => {
                const sourceLabelIndex = config.sourceLabelIndices ? config.sourceLabelIndices[labelIndex] : labelIndex;
                return selected.has(window.getChartObjectKey(chartIndex, datasetIndex, label, sourceLabelIndex));
            });

            if (config.type === 'line') {
                renderedDataset.pointBorderWidth = isSelectedAt.map(isSelected => isSelected ? 4 : 2);
                renderedDataset.pointBorderColor = config.labels.map((_, labelIndex) =>
                    isSelectedAt[labelIndex] ? '#0f172a' : dataset.borderColor
                );
            } else if (usesPointColors) {
                const colors = config.labels.map((label, labelIndex) =>
                    pointColorMap.get(String(label).trim().toLocaleLowerCase()) || pointColors[labelIndex % pointColors.length]
                );
                renderedDataset.backgroundColor = colors;
                renderedDataset.borderColor = colors.map((color, labelIndex) =>
                    isSelectedAt[labelIndex] ? '#0f172a' : color
                );
                renderedDataset.borderWidth = isSelectedAt.map(isSelected => isSelected ? 3 : 1);
            }
        });
        chartInstance.update('none');
    });
};

window.toggleStudentChartObject = function(part, charts, chartIndex, datasetIndex, label, labelIndex) {
    const selected = new Map(window.getSelectedChartObjects(part));
    const key = window.getChartObjectKey(chartIndex, datasetIndex, label, labelIndex);
    if (selected.has(key)) selected.delete(key);
    else selected.set(key, { key, chartIndex, datasetIndex, labelIndex, label: String(label) });
    window.chartSelectionsByPart.set(part, selected);

    window.updateStudentChartSelectionVisuals(part, charts);
    window.updateStudentChartComparison(part, charts);
};

window.updateStudentChartComparison = function(part, charts) {
    const selectedContainer = document.getElementById('student-chart-selected-objects');
    const resultsContainer = document.getElementById('student-chart-comparison-results');
    if (!selectedContainer || !resultsContainer) return;

    const selected = [...window.getSelectedChartObjects(part).values()];
    selectedContainer.replaceChildren();
    selected.forEach(item => {
        const chip = document.createElement('button');
        chip.type = 'button';
        chip.className = 'px-2.5 py-1 rounded-full bg-white border border-indigo-300 text-indigo-800 text-xs font-bold hover:bg-indigo-100';
        const chart = charts[item.chartIndex];
        const dataset = chart && chart.datasets && chart.datasets[item.datasetIndex];
        chip.textContent = `${item.label} (${chart && chart.time || `Chart ${item.chartIndex + 1}`}${dataset && dataset.label ? `, ${dataset.label}` : ''}) ×`;
        chip.title = 'Remove this selected figure';
        chip.onclick = () => window.toggleStudentChartObject(part, charts, item.chartIndex, item.datasetIndex, item.label, item.labelIndex);
        selectedContainer.appendChild(chip);
    });

    if (selected.length < 2) {
        resultsContainer.textContent = 'Select at least two figures on the charts to see their comparison.';
        return;
    }
    const numberFormat = value => new Intl.NumberFormat(undefined, { maximumFractionDigits: 2 }).format(value);
    const formatUnitValue = figure => {
        const suffix = figure.unit === '%' ? '%' : figure.unit ? ` ${window.escapeChartHtml(figure.unit)}` : '';
        return `${numberFormat(figure.value)}${suffix}`;
    };
    const figures = selected.map(item => {
        const chart = charts[item.chartIndex];
        const dataset = chart.datasets && chart.datasets[item.datasetIndex];
        const labelIndex = item.labelIndex;
        const unit = chart.unitType === '%'
            ? '%'
            : chart.unitType === 'custom'
                ? String(chart.unitCustom || '').trim()
                : '';
        return {
            ...item,
            chart,
            dataset,
            time: window.getChartObservationTime(chart, dataset || {}),
            unit,
            value: labelIndex >= 0 && dataset ? Number(dataset.data[labelIndex]) : NaN
        };
    }).filter(item => Number.isFinite(item.value));

    const pairRows = [];
    for (let left = 0; left < figures.length; left++) {
        for (let right = left + 1; right < figures.length; right++) {
            const a = figures[left];
            const b = figures[right];
            const aName = `${window.escapeChartHtml(a.label)} (${window.escapeChartHtml(a.time.label || `Chart ${a.chartIndex + 1}`)}${a.dataset.label ? `, ${window.escapeChartHtml(a.dataset.label)}` : ''})`;
            const bName = `${window.escapeChartHtml(b.label)} (${window.escapeChartHtml(b.time.label || `Chart ${b.chartIndex + 1}`)}${b.dataset.label ? `, ${window.escapeChartHtml(b.dataset.label)}` : ''})`;
            const difference = Math.abs(a.value - b.value);
            const [larger, smaller] = a.value >= b.value ? [a, b] : [b, a];
            const sameUnit = a.unit === b.unit;
            const isPercentage = sameUnit && a.unit === '%';
            const differenceLabel = isPercentage ? 'percentage points' : a.unit ? window.escapeChartHtml(a.unit) : 'units';
            let grammarExamples;
            if (a.unit !== b.unit) {
                grammarExamples = `<p>The units differ (${window.escapeChartHtml(a.unit || 'no unit')} vs ${window.escapeChartHtml(b.unit || 'no unit')}), so direct numeric comparisons may be misleading.</p>`;
            } else if (a.value === b.value) {
                grammarExamples = `
                    <p><b>Equal comparison:</b> ${aName} is equal to ${bName}.</p>
                    <p><b>Same-as structure:</b> ${aName} is the same as ${bName}.</p>
                `;
            } else {
                const comparative = a.value > b.value
                    ? `${aName} is ${numberFormat(difference)} ${differenceLabel} higher than ${bName}.`
                    : `${aName} is ${numberFormat(difference)} ${differenceLabel} lower than ${bName}.`;
                const relativeDifference = b.value !== 0
                    ? `<p><b>Relative percentage change:</b> Compared with ${bName}, ${aName} is ${numberFormat((a.value - b.value) / Math.abs(b.value) * 100)}% ${a.value > b.value ? 'higher' : 'lower'}.</p>`
                    : '';
                const ratioSentence = smaller.value > 0
                    ? `<p><b>Multiplicative comparison:</b> ${window.escapeChartHtml(larger.label)} (${window.escapeChartHtml(larger.time.label || `Chart ${larger.chartIndex + 1}`)}) is ${numberFormat(larger.value / smaller.value)} times as high as ${window.escapeChartHtml(smaller.label)} (${window.escapeChartHtml(smaller.time.label || `Chart ${smaller.chartIndex + 1}`)}); conversely, ${window.escapeChartHtml(smaller.label)} is ${numberFormat(smaller.value / larger.value)} times as high as ${window.escapeChartHtml(larger.label)}.</p>`
                    : '';
                grammarExamples = `<p><b>Comparative:</b> ${comparative}</p>${relativeDifference}${ratioSentence}`;
            }
            const differenceText = sameUnit
                ? `<p><b>${isPercentage ? 'Percentage-point difference' : 'Absolute difference'}:</b> ${numberFormat(difference)} ${differenceLabel}.</p>`
                : '';
            pairRows.push(`<li class="p-4 bg-white rounded-lg border border-indigo-100"><p class="font-bold text-slate-900">${aName}: ${formatUnitValue(a)} &nbsp;|&nbsp; ${bName}: ${formatUnitValue(b)}</p><div class="mt-2 space-y-1">${differenceText}${grammarExamples}</div></li>`);
        }
    }

    const trendGroups = new Map();
    figures.filter(item => item.time.sortValue !== null).forEach(item => {
        const key = `${item.dataset.label || ''}|${item.label.trim().toLocaleLowerCase()}|${item.unit}`;
        if (!trendGroups.has(key)) trendGroups.set(key, []);
        trendGroups.get(key).push(item);
    });
    const trendRows = [];
    trendGroups.forEach(items => {
        items.sort((a, b) => a.time.sortValue - b.time.sortValue);
        if (new Set(items.map(item => item.time.sortValue)).size < 2) return;
        const first = items[0];
        const last = [...items].reverse().find(item => item.time.sortValue !== first.time.sortValue);
        if (!last) return;
        const difference = last.value - first.value;
        const trend = difference > 0 ? 'increased' : difference < 0 ? 'decreased' : 'remained unchanged';
        const label = window.escapeChartHtml(first.label);
        const isPercentage = first.unit === '%' && last.unit === '%';
        const unit = first.unit === '%' ? '%' : first.unit ? ` ${window.escapeChartHtml(first.unit)}` : '';
        const changeUnit = isPercentage ? ' percentage points' : unit || ' units';
        const relativeChange = first.value !== 0
            ? ` This represents a ${numberFormat(Math.abs(difference / Math.abs(first.value) * 100))}% ${difference > 0 ? 'increase' : difference < 0 ? 'decrease' : 'change'} relative to the starting value.`
            : '';
        trendRows.push(`<li class="p-3 bg-white rounded-lg border border-indigo-100"><b>${label}</b> ${trend} from ${numberFormat(first.value)}${unit} in ${window.escapeChartHtml(first.time.label)} to ${numberFormat(last.value)}${unit} in ${window.escapeChartHtml(last.time.label)} (a change of ${numberFormat(Math.abs(difference))}${changeUnit}).${relativeChange}</li>`);
    });

    resultsContainer.innerHTML = figures.length < 2
        ? '<p>Select at least two valid numeric figures to compare them.</p>'
        : `<section class="p-4 bg-indigo-50 border border-indigo-200 rounded-xl"><h4 class="text-base font-black text-indigo-900">Grammar point used: the comparison</h4><p class="text-xs text-slate-600 mt-1 mb-3">Compare figures with comparative adjectives, equal comparisons, and percentage changes.</p><div><h5 class="font-bold text-slate-800 mb-2">Figure comparisons</h5><ul class="space-y-2">${pairRows.join('')}</ul></div>${trendRows.length ? `<div class="mt-4"><h5 class="font-bold text-slate-800 mb-2">Trends over time</h5><ul class="space-y-2">${trendRows.join('')}</ul></div>` : ''}</section>`;
};

// Hàm Render chung (dùng cho cả Teacher Builder và Student Exam)
window.renderCanvasChart = function(canvasId, config, pointColorMap, selectionContext, renderOptions = {}) {
    const chartStatus = Chart.getChart(canvasId);
    if (chartStatus) chartStatus.destroy();

    const canvas = document.getElementById(canvasId);
    if (!canvas) return null;
    if (!config || !config.labels || config.labels.length === 0) return null;

    const cleanCanvas = canvas.cloneNode(false);
    canvas.replaceWith(cleanCanvas);
    const unitLabel = config.unitType === '%'
        ? '%'
        : config.unitType === 'custom' && config.unitCustom
            ? ` ${config.unitCustom}`
            : '';
    const chartPointColorMap = pointColorMap || window.getChartPointColorMap([config]);
    const numberFormatForChart = value => new Intl.NumberFormat(undefined, { maximumFractionDigits: 2 }).format(Number(value));
    if (config.type === 'table') {
        const tableContainer = document.createElement('div');
        tableContainer.id = canvasId;
        tableContainer.className = 'w-full h-full overflow-auto rounded-lg bg-white';
        const selectedObjects = selectionContext
            ? window.getSelectedChartObjects(selectionContext.part)
            : new Map();
        const tableRows = config.labels.map((label, labelIndex) => {
            const sourceLabelIndex = config.sourceLabelIndices ? config.sourceLabelIndices[labelIndex] : labelIndex;
            const objectColor = chartPointColorMap.get(String(label).trim().toLocaleLowerCase()) || '#334155';
            const values = config.datasets.map((dataset, datasetIndex) => {
                const value = dataset.data[labelIndex];
                const key = selectionContext
                    ? window.getChartObjectKey(selectionContext.chartIndex, datasetIndex, label, sourceLabelIndex)
                    : '';
                const isSelected = key && selectedObjects.has(key);
                const cellContent = `${window.escapeChartHtml(numberFormatForChart(value))}${window.escapeChartHtml(unitLabel)}`;
                return `<td class="border-b border-slate-100 px-4 py-3 text-right font-semibold text-slate-700"><button type="button" class="rounded px-2 py-1 ${isSelected ? 'bg-indigo-100 ring-2 ring-indigo-600' : 'hover:bg-slate-100'} ${selectionContext ? 'cursor-pointer' : 'cursor-default'}" ${selectionContext ? `data-chart-dataset="${datasetIndex}" data-chart-label="${labelIndex}" aria-label="Select ${window.escapeChartHtml(label)}, ${window.escapeChartHtml(dataset.label || '')}: ${cellContent}" aria-pressed="${Boolean(isSelected)}"` : 'disabled'}>${cellContent}</button></td>`;
            }).join('');
            return `<tr class="hover:bg-slate-50"><th scope="row" class="border-b border-slate-100 px-4 py-3 text-left font-bold" style="color:${objectColor}">${window.escapeChartHtml(label)}</th>${values}</tr>`;
        }).join('');
        tableContainer.innerHTML = `
            ${config.title ? `<h3 class="px-4 pt-4 text-base font-bold text-slate-800">${window.escapeChartHtml(config.title)}</h3>` : ''}
            <table class="w-full min-w-max border-collapse text-sm">
                <thead><tr class="bg-slate-50"><th scope="col" class="border-b border-slate-200 px-4 py-3 text-left font-black text-slate-600">Category</th>${config.datasets.map(dataset => `<th scope="col" class="border-b border-slate-200 px-4 py-3 text-right font-black text-slate-600">${window.escapeChartHtml(dataset.label || '')}</th>`).join('')}</tr></thead>
                <tbody>${tableRows}</tbody>
            </table>
        `;
        cleanCanvas.replaceWith(tableContainer);
        if (selectionContext) {
            tableContainer.querySelectorAll('[data-chart-dataset]').forEach(button => {
                button.addEventListener('click', () => {
                    const labelIndex = Number(button.dataset.chartLabel);
                    const datasetIndex = Number(button.dataset.chartDataset);
                    window.toggleStudentChartObject(
                        selectionContext.part,
                        selectionContext.charts,
                        selectionContext.chartIndex,
                        datasetIndex,
                        config.labels[labelIndex],
                        config.sourceLabelIndices ? config.sourceLabelIndices[labelIndex] : labelIndex
                    );
                });
            });
        }
        return tableContainer;
    }
    const pointColors = ['#b2dfdb', '#00897b', '#004d40', '#ffb74d', '#f57c00', '#1976d2'];
    const usesPointColors = ['bar', 'pie', 'doughnut'].includes(config.type);
    const selectedObjects = selectionContext
        ? window.getSelectedChartObjects(selectionContext.part)
        : new Set();

    return new Chart(cleanCanvas, {
        type: config.type,
        data: {
            labels: config.labels,
            datasets: config.datasets.map((dataset, datasetIndex) => {
                const interactiveDataset = {
                    ...dataset,
                    hoverBorderColor: '#0f172a',
                    hoverBorderWidth: 3,
                    hoverOffset: 8
                };

                const selectedIndices = config.labels.map((label, index) =>
                    selectionContext && selectedObjects.has(
                        window.getChartObjectKey(
                            selectionContext.chartIndex,
                            datasetIndex,
                            label,
                            config.sourceLabelIndices ? config.sourceLabelIndices[index] : index
                        )
                    ) ? index : -1
                );
                if (config.type === 'line') {
                    interactiveDataset.pointRadius = Math.max(Number(dataset.pointRadius) || 0, 4);
                    interactiveDataset.pointHoverRadius = Math.max(Number(dataset.pointHoverRadius) || 0, 9);
                    interactiveDataset.pointHitRadius = Math.max(Number(dataset.pointHitRadius) || 0, 16);
                    interactiveDataset.pointBorderWidth = config.labels.map((_, index) => selectedIndices[index] >= 0 ? 4 : 2);
                    interactiveDataset.pointBorderColor = config.labels.map((label, index) => selectedIndices[index] >= 0 ? '#0f172a' : dataset.borderColor);
                }

                if (!usesPointColors) return interactiveDataset;

                const colors = config.labels.map((label, index) => {
                    const key = String(label).trim().toLocaleLowerCase();
                    return chartPointColorMap.get(key) || pointColors[index % pointColors.length];
                });

                return {
                    ...interactiveDataset,
                    backgroundColor: colors,
                    borderColor: config.labels.map((label, index) => selectedIndices[index] >= 0 ? '#0f172a' : colors[index]),
                    borderWidth: config.labels.map((_, index) => selectedIndices[index] >= 0 ? 3 : 1)
                };
            })
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            onClick: function(event, activeElements) {
                if (!selectionContext || !activeElements.length) return;
                const element = activeElements[0];
                const objectLabel = config.labels[element.index];
                if (objectLabel !== undefined) {
                    window.toggleStudentChartObject(
                        selectionContext.part,
                        selectionContext.charts,
                        selectionContext.chartIndex,
                        element.datasetIndex,
                        objectLabel,
                        config.sourceLabelIndices ? config.sourceLabelIndices[element.index] : element.index
                    );
                }
            },
            onHover: function(event, activeElements, chart) {
                chart.canvas.style.cursor = activeElements.length > 0 ? 'pointer' : 'default';
            },
            plugins: {
                title: { 
                    display: !!config.title, 
                    text: config.title, 
                    font: { size: 18, family: 'sans-serif', weight: 'bold' },
                    color: '#1e293b',
                    padding: { bottom: 20 }
                },
                tooltip: {
                    mode: 'nearest',
                    intersect: config.type !== 'line',
                    backgroundColor: 'rgba(255, 255, 255, 0.98)',
                    titleColor: '#0f172a',
                    bodyColor: '#334155',
                    borderColor: '#94a3b8', // Viền trắng xám giống hệt ảnh mẫu
                    borderWidth: 1,
                    boxPadding: 4,
                    padding: 10,
                    titleFont: { size: 13 },
                    bodyFont: { size: 14, weight: 'bold' },
                    callbacks: {
                        label: function(context) {
                            const label = context.dataset.label ? `${context.dataset.label}: ` : '';
                            return context.raw === null || context.raw === undefined
                                ? label
                                : `${label}${context.raw}${unitLabel}`;
                        }
                    }
                },
                legend: {
                    display: renderOptions.showLegend !== false,
                    position: 'bottom',
                    labels: { usePointStyle: true, padding: 20, font: { weight: 'bold' } }
                }
            },
            interaction: {
                mode: 'nearest',
                intersect: config.type !== 'line',
            },
            scales: config.type !== 'pie' && config.type !== 'doughnut' ? {
                y: { 
                    beginAtZero: true, 
                    grid: { color: '#f1f5f9' },
                    border: { display: false },
                    ticks: {
                        callback: function(value) {
                            return `${value}${unitLabel}`;
                        }
                    }
                },
                x: { 
                    grid: { display: false },
                    border: { display: false }
                }
            } : {}
        },
        plugins: [{
            id: `chart-value-labels-${canvasId}`,
            afterDatasetsDraw: function(chart) {
                const context = chart.ctx;
                context.save();
                context.font = 'bold 12px sans-serif';
                context.textAlign = 'center';
                context.textBaseline = 'middle';
                chart.data.datasets.forEach((dataset, datasetIndex) => {
                    const meta = chart.getDatasetMeta(datasetIndex);
                    meta.data.forEach((element, dataIndex) => {
                        const value = dataset.data[dataIndex];
                        if (value === null || value === undefined || !Number.isFinite(Number(value))) return;
                        const position = element.tooltipPosition();
                        const x = position.x;
                        let y = position.y;
                        if (config.type === 'bar') y = element.y - 10;
                        else if (config.type === 'line') y = element.y - 12;
                        const label = `${numberFormatForChart(value)}${unitLabel}`;
                        context.lineWidth = 3;
                        context.strokeStyle = 'rgba(255, 255, 255, 0.95)';
                        context.strokeText(label, x, y);
                        context.fillStyle = '#0f172a';
                        context.fillText(label, x, y);
                    });
                });
                context.restore();
            }
        }]
    });
};

    window.loadPublicLandingData = function() {
        if (window.publicLandingDataPromise) return window.publicLandingDataPromise;

        window.renderPublicProfile();
        window.publicLandingDataPromise = (async () => {
            const [profileResult, packagesResult, hallOfFameResult] = await Promise.allSettled([
                window.fsGetDoc(window.fsDoc(window.db, window.fPath('settings'), 'public_profile')),
                window.fsGetDocs(window.fsCollection(window.db, window.fPath('packages'))),
                window.fsGetDocs(window.fsCollection(window.db, window.fPath('hall_of_fame')))
            ]);
            const failures = [];

            if (profileResult.status === 'fulfilled') {
                if (profileResult.value.exists()) PUBLIC_PROFILE = profileResult.value.data();
                if (typeof window.cacheStartupBranding === 'function') window.cacheStartupBranding(PUBLIC_PROFILE);
                if (typeof window.applyGlobalLogo === 'function') window.applyGlobalLogo();
            } else {
                failures.push(['settings/public_profile', profileResult.reason]);
            }

            if (packagesResult.status === 'fulfilled') {
                PACKAGES = packagesResult.value.docs.map(doc => doc.data());
            } else {
                failures.push(['packages', packagesResult.reason]);
            }

            if (hallOfFameResult.status === 'fulfilled') {
                HOF_STUDENTS = hallOfFameResult.value.docs.map(doc => doc.data());
            } else {
                failures.push(['hall_of_fame', hallOfFameResult.reason]);
            }

            const errorBanner = document.getElementById('public-data-error');
            if (failures.length) {
                failures.forEach(([path, error]) => console.error(`Unable to load public landing data (${path}):`, error));
                if (errorBanner) {
                    errorBanner.textContent = 'Some public page information could not be loaded. Check the Firestore public read rules and refresh the page.';
                    errorBanner.classList.remove('hidden');
                }
                window.publicLandingDataPromise = null;
            } else if (errorBanner) {
                errorBanner.classList.add('hidden');
                errorBanner.textContent = '';
            }

            window.renderPublicProfile();
            return failures.length === 0;
        })();

        return window.publicLandingDataPromise;
    };

    window.scrollToPublicPackages = function() {
        document.getElementById('public-packages-section')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    };

    window.renderPublicProfile = function() {
        const c = document.getElementById('public-profile-content');
        if(!c) return;

        const teacherImageUrl = Number(PUBLIC_PROFILE.heroImageRevision) >= 2 && PUBLIC_PROFILE.heroImage
            ? PUBLIC_PROFILE.heroImage
            : 'assets/teacher-graduation.png';
        const teacherImageHtml = teacherImageUrl
            ? `<img src="${lmsEscapeHtml(teacherImageUrl)}" alt="${lmsEscapeHtml(PUBLIC_PROFILE.appName || 'Giáo viên IELTS')}" class="w-full aspect-[4/5] max-h-[34rem] object-cover rounded-[2rem] shadow-2xl border border-white/15">`
            : `<div class="aspect-[4/5] max-h-[34rem] rounded-[2rem] border border-white/15 bg-gradient-to-br from-blue-500/30 via-indigo-500/20 to-cyan-400/20 shadow-2xl flex flex-col items-center justify-center p-8 text-center">
                   <div class="text-7xl sm:text-8xl font-black tracking-tighter text-white/90">IELTS</div>
                   <div class="mt-6 flex flex-wrap justify-center gap-2">${['Reading', 'Listening', 'Writing', 'Speaking'].map(skill => `<span class="rounded-full border border-white/20 bg-white/10 px-3 py-1.5 text-xs font-bold text-blue-50">${skill}</span>`).join('')}</div>
               </div>`;
        const certificateCardHtml = PUBLIC_PROFILE.trfImage
            ? `<button type="button" class="absolute -bottom-5 left-3 right-3 sm:left-6 sm:right-6 flex items-center gap-3 rounded-2xl border border-slate-200 bg-white p-3 text-left shadow-xl transition hover:-translate-y-1" onclick="window.openLightbox('${PUBLIC_PROFILE.trfImage}', event)">
                   <img src="${PUBLIC_PROFILE.trfImage}" alt="IELTS certificate" class="h-14 w-14 shrink-0 rounded-lg border border-slate-200 bg-slate-50 object-cover">
                   <span class="min-w-0"><span class="block text-xs font-black uppercase tracking-wider text-emerald-700">Chứng chỉ IELTS</span><span class="mt-1 block text-sm font-semibold text-slate-600">Nhấn để xem ảnh</span></span>
                   <span class="ml-auto text-lg text-slate-400" aria-hidden="true">↗</span>
               </button>`
            : '';
        
        let resourcesHtml = '';
        if (PUBLIC_PROFILE.pdfs && PUBLIC_PROFILE.pdfs.length > 0) {
            resourcesHtml = `
                <section class="rounded-2xl border border-slate-200 bg-white p-6 text-left shadow-sm">
                    <h3 class="text-xl font-bold text-slate-900 mb-4">🎁 Tài liệu miễn phí</h3>
                    <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        ${PUBLIC_PROFILE.pdfs.map(f => `
                            <div class="bg-slate-50 border border-slate-200 rounded-xl p-4 flex items-center justify-between shadow-sm">
                                <div class="truncate text-slate-700 font-bold text-sm">${f.name}</div>
                                <a href="${f.data}" download="${f.name}" class="shrink-0 bg-blue-700 text-white hover:bg-blue-800 px-3 py-1.5 rounded-lg font-black text-xs transition">Tải về</a>
                            </div>
                        `).join('')}
                    </div>
                </section>
            `;
        }

        // ✨ NEW: HOF Button now opens the massive separate UI
        let hofButtonHtml = '';
        if (HOF_STUDENTS && HOF_STUDENTS.length > 0) {
            hofButtonHtml = `<button onclick="window.openHOFScreen()" class="mt-10 bg-gradient-to-r from-amber-400 to-orange-500 hover:from-amber-500 hover:to-orange-600 text-amber-950 font-black px-8 py-3.5 rounded-full shadow-[0_10px_25px_-5px_rgba(245,158,11,0.5)] transition hover:-translate-y-1 flex items-center justify-center gap-3 mx-auto border-2 border-amber-300"><span class="text-2xl drop-shadow-md">🏆</span> Kết quả học viên</button>`;
        }

        const specialties = PUBLIC_PROFILE.specialties || [];
        const credentials = PUBLIC_PROFILE.credentials || [];
        const hasTeacherDetails = Boolean(PUBLIC_PROFILE.bio || PUBLIC_PROFILE.philosophy || specialties.length || credentials.length);
        const teacherProfileImageHtml = `<img src="${lmsEscapeHtml(teacherImageUrl)}" alt="${lmsEscapeHtml(PUBLIC_PROFILE.appName || 'Giáo viên IELTS')}" class="h-full min-h-[18rem] w-full object-cover">`;
        const teacherDetailsHtml = `<section class="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm" aria-labelledby="public-teacher-method-heading">
                <div class="grid ${teacherProfileImageHtml ? 'md:grid-cols-[minmax(12rem,0.8fr)_minmax(0,1.5fr)]' : ''}">
                    ${teacherProfileImageHtml ? `<div class="max-h-[34rem] overflow-hidden bg-slate-100">${teacherProfileImageHtml}</div>` : ''}
                    <div class="p-6 sm:p-9">
                        <p class="text-sm font-black uppercase tracking-[0.16em] text-blue-700">Đội ngũ giảng dạy</p>
                        <h2 id="public-teacher-method-heading" class="mt-2 text-2xl sm:text-3xl font-black text-slate-900">Giới thiệu giáo viên &amp; phương pháp</h2>
                        <p class="mt-2 text-slate-500">Tìm hiểu chuyên môn và định hướng giảng dạy.</p>
                        ${PUBLIC_PROFILE.bio ? `<p class="mt-6 whitespace-pre-line text-base leading-relaxed text-slate-700">${lmsEscapeHtml(PUBLIC_PROFILE.bio)}</p>` : ''}
                        ${specialties.length ? `<div class="mt-6"><h3 class="text-sm font-bold uppercase tracking-wider text-slate-500">Chuyên môn</h3><div class="mt-3 flex flex-wrap gap-2">${specialties.map(s => `<span class="rounded-full border border-cyan-100 bg-cyan-50 px-3 py-1.5 text-sm font-semibold text-cyan-900">${lmsEscapeHtml(s)}</span>`).join('')}</div></div>` : ''}
                        ${PUBLIC_PROFILE.philosophy ? `<div class="mt-6 rounded-2xl border-l-4 border-emerald-500 bg-emerald-50 p-5"><h3 class="font-bold text-emerald-900">Phương pháp giảng dạy</h3><p class="mt-2 whitespace-pre-line leading-relaxed text-slate-700">${lmsEscapeHtml(PUBLIC_PROFILE.philosophy)}</p></div>` : ''}
                        ${credentials.length ? `<div class="mt-6"><h3 class="text-sm font-bold uppercase tracking-wider text-slate-500">Chứng chỉ &amp; bằng cấp</h3><ul class="mt-3 space-y-2">${credentials.map(credential => `<li class="flex items-start gap-2 text-slate-700"><span class="mt-1 text-amber-600" aria-hidden="true">●</span><span>${lmsEscapeHtml(credential)}</span></li>`).join('')}</ul></div>` : ''}
                        ${!hasTeacherDetails ? `<p class="mt-6 rounded-xl bg-slate-50 p-4 text-slate-600">Thông tin giới thiệu giáo viên và phương pháp giảng dạy chưa được cập nhật.</p>` : ''}
                    </div>
                </div>
            </section>`;

        const cvSections = [];
        if ((PUBLIC_PROFILE.classes || []).length) cvSections.push(`<div class="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm"><h3 class="text-xl font-bold text-violet-800 mb-4">📚 Lớp học tiêu biểu</h3><ul class="space-y-2">${(PUBLIC_PROFILE.classes || []).map(cls => `<li class="text-slate-700 flex items-start gap-2"><span class="mt-1 text-violet-600">→</span><span>${cls}</span></li>`).join('')}</ul></div>`);
        if ((PUBLIC_PROFILE.services || []).length) cvSections.push(`<div class="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm"><h3 class="text-xl font-bold text-sky-800 mb-4">✨ Dịch vụ</h3><ul class="space-y-2">${(PUBLIC_PROFILE.services || []).map(service => `<li class="text-slate-700 flex items-start gap-2"><span class="mt-1 text-sky-600">✦</span><span>${service}</span></li>`).join('')}</ul></div>`);
        if ((PUBLIC_PROFILE.highlights || []).length) cvSections.push(`<div class="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm"><h3 class="text-xl font-bold text-rose-800 mb-4">⭐ Điểm nổi bật</h3><ul class="space-y-2">${(PUBLIC_PROFILE.highlights || []).map(h => `<li class="text-slate-700 flex items-start gap-2"><span class="mt-1 text-rose-600">★</span><span>${h}</span></li>`).join('')}</ul></div>`);

        const detailSections = [];
        if (teacherDetailsHtml) detailSections.push(teacherDetailsHtml);
        if (cvSections.length) detailSections.push(`<div class="grid grid-cols-1 lg:grid-cols-2 gap-5">${cvSections.join('')}</div>`);
        if ((PUBLIC_PROFILE.achievements || []).length || (PUBLIC_PROFILE.features || []).length) {
            detailSections.push(`<div class="grid grid-cols-1 md:grid-cols-2 gap-5">
                ${(PUBLIC_PROFILE.achievements || []).length ? `<section class="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"><h3 class="text-xl font-bold text-amber-700 mb-4">🏆 Thành tích</h3><ul class="space-y-3">${PUBLIC_PROFILE.achievements.map(item => `<li class="flex items-start gap-3 text-slate-700"><span class="mt-1 text-amber-600">★</span><span class="leading-snug">${item}</span></li>`).join('')}</ul></section>` : ''}
                ${(PUBLIC_PROFILE.features || []).length ? `<section class="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"><h3 class="text-xl font-bold text-emerald-800 mb-4">🚀 Nền tảng học tập</h3><ul class="space-y-3">${PUBLIC_PROFILE.features.map(item => `<li class="flex items-start gap-3 text-slate-700"><span class="mt-1 text-emerald-600">✓</span><span class="leading-snug">${item}</span></li>`).join('')}</ul></section>` : ''}
            </div>`);
        }
        if (hofButtonHtml) detailSections.push(`<div class="text-center">${hofButtonHtml}</div>`);
        if (resourcesHtml) detailSections.push(resourcesHtml);

        c.innerHTML = `
            <div class="grid grid-cols-1 md:grid-cols-2 items-center gap-10 lg:gap-16 text-left">
                <div class="max-w-2xl">
                    <div class="inline-flex items-center gap-2 rounded-full border border-blue-300/25 bg-white/10 px-3 py-1.5 text-xs font-black uppercase tracking-[0.16em] text-blue-100">
                        <span class="h-2 w-2 rounded-full bg-cyan-300"></span>${lmsEscapeHtml(PUBLIC_PROFILE.appName || 'Lộ trình học IELTS')}
                    </div>
                    <h1 class="mt-6 text-4xl sm:text-5xl lg:text-6xl font-black leading-[1.08] tracking-tight text-white drop-shadow-sm">${PUBLIC_PROFILE.missionTitle || 'Học IELTS bài bản, tiến bộ từng bước'}</h1>
                    <p class="mt-5 max-w-xl text-lg sm:text-xl leading-relaxed text-blue-100">${PUBLIC_PROFILE.missionText || 'Tìm khóa học và lộ trình phù hợp với mục tiêu IELTS của bạn.'}</p>
                    <div class="mt-8 flex flex-col sm:flex-row gap-3">
                        <button type="button" onclick="window.scrollToPublicPackages()" class="inline-flex min-h-12 items-center justify-center rounded-xl bg-white px-6 py-3 text-base font-black text-blue-900 shadow-lg transition hover:-translate-y-0.5 hover:bg-blue-50 focus:outline-none focus-visible:ring-4 focus-visible:ring-white/40">Xem khóa học <span class="ml-2" aria-hidden="true">↓</span></button>
                        <button type="button" onclick="window.showAuthFromLanding()" class="inline-flex min-h-12 items-center justify-center rounded-xl border border-white/30 bg-white/10 px-6 py-3 text-base font-bold text-white transition hover:bg-white/20 focus:outline-none focus-visible:ring-4 focus-visible:ring-white/40">Đăng nhập / đăng ký</button>
                    </div>
                    <p class="mt-4 text-sm text-blue-200">Xem thông tin khóa học trước khi đăng ký.</p>
                </div>
                <div class="relative mx-auto w-full max-w-md pb-8 md:pb-10">
                    ${teacherImageHtml}
                    ${certificateCardHtml}
                </div>
            </div>

        `;

        const detailsContainer = document.getElementById('public-profile-details');
        if (detailsContainer) detailsContainer.innerHTML = detailSections.join('');

        // Render Public Packages
        const pgrid = document.getElementById('public-packages-grid');
        if (pgrid) {
            if (PACKAGES.length === 0) {
                pgrid.innerHTML = `<div class="col-span-full text-center text-slate-500 italic bg-white p-10 rounded-2xl border border-slate-200">Course bundles opening soon. Check back later!</div>`;
            } else {
                pgrid.innerHTML = PACKAGES.map(p => {
                    const classNames = (p.classes || []).map(cid => {
                        const found = CLASSES.find(c => c.id === cid);
                        return found && !window.isTemplateClass(found) ? found.name : '';
                    }).filter(Boolean);
                    
                    return `
                    <div class="bg-white border-2 border-blue-100 rounded-2xl p-6 shadow-sm hover:shadow-xl hover:border-blue-400 transition-all flex flex-col transform hover:-translate-y-1 relative overflow-hidden group">
                        <div class="absolute inset-0 bg-gradient-to-br from-blue-50 to-indigo-50 opacity-0 group-hover:opacity-100 transition-opacity"></div>
                        <div class="relative z-10 flex flex-col h-full">
                            <h3 class="text-xl font-black text-blue-950 mb-2">${p.name}</h3>
                            <p class="text-[10px] font-black uppercase tracking-widest text-emerald-600 bg-emerald-50 px-2 py-1 rounded inline-block w-max mb-4 border border-emerald-200">${classNames.length} Courses Included</p>
                            <ul class="space-y-2 mb-6 flex-1">
                                ${classNames.map(n => `<li class="text-sm font-medium text-slate-600 flex items-start gap-2"><span class="text-blue-500 mt-0.5 font-bold">✓</span> ${n}</li>`).join('')}
                            </ul>
                            <div class="mt-auto border-t border-slate-100 pt-4 flex items-center justify-between mb-4">
                                <span class="text-[10px] text-slate-400 uppercase font-black tracking-widest">Base Tuition</span>
                                <span class="text-lg font-black text-emerald-600">${formatVND(p.feePerLesson || BILLING_SETTINGS.feePerLesson || 100000)}<span class="text-xs text-slate-400 font-bold">/lesson</span></span>
                            </div>
                            <button onclick="window.showAuthFromLanding()" class="w-full bg-slate-900 hover:bg-black text-white font-bold py-3 rounded-xl shadow-md transition">Đăng ký khóa học</button>
                        </div>
                    </div>`;
                }).join('');
            }
        }
    };

    function getClassParent(cls) {
      return cls?.parentClassId ? CLASSES.find(candidate => candidate.id === cls.parentClassId) || null : null;
    }

    window.isTemplateClass = function(cls) {
      return Boolean(cls && !cls.parentClassId && (cls.isTemplate || CLASSES.some(candidate => candidate.parentClassId === cls.id)));
    };

    window.isSchedulableClass = function(cls) {
      return Boolean(cls?.parentClassId && getClassParent(cls));
    };

    function getSchedulableClassOptions() {
      const options = CLASSES.filter(window.isSchedulableClass).map(cls => ({
        key: cls.id,
        label: cls.name,
        cls,
        isLegacyMiniClass: false
      }));

      CLASSES.forEach(parent => {
        if (!parent.miniClasses || typeof parent.miniClasses !== 'object') return;
        const enrolledStudents = Array.isArray(parent.enrolledStudents) ? parent.enrolledStudents : null;
        const groupedStudents = new Map();
        Object.entries(parent.miniClasses).forEach(([student, miniName]) => {
          const name = String(miniName || '').trim();
          if (!name || (enrolledStudents && !enrolledStudents.includes(student))) return;
          if (!groupedStudents.has(name)) groupedStudents.set(name, []);
          groupedStudents.get(name).push(student);
        });

        groupedStudents.forEach((students, name) => {
          if (CLASSES.some(cls => cls.parentClassId === parent.id && cls.name === name)) return;
          const key = `legacy-mini:${encodeURIComponent(parent.id)}:${encodeURIComponent(name)}`;
          options.push({
            key,
            label: `${parent.name} · ${name}`,
            cls: { ...parent, enrolledStudents: students, miniClassName: name, isLegacyMiniClass: true },
            isLegacyMiniClass: true
          });
        });
      });

      return options;
    }

    function getSelectedSchedulableClass(value) {
      return getSchedulableClassOptions().find(option => option.key === value) || null;
    }

    function getClassAssignedTests(cls) {
      if (!cls) return [];
      const source = getClassParent(cls) || cls;
      return [...new Set(Array.isArray(source.assignedTests) ? source.assignedTests : [])];
    }

    function getClassBaseFee(cls) {
      const source = getClassParent(cls) || cls;
      return Number(source?.feePerLesson) || Number(BILLING_SETTINGS.feePerLesson) || 100000;
    }

    function getClassTestSettings(cls, testId) {
      if (!cls) return {};
      const parentSettings = getClassParent(cls)?.testSettings?.[testId] || {};
      const inheritedSettings = { ...parentSettings };
      if (getClassParent(cls)) {
        delete inheritedSettings.dueDate;
        delete inheritedSettings.dueTime;
      }
      return { ...inheritedSettings, ...(cls.testSettings?.[testId] || {}) };
    }

    function getClassLearningPaths(cls) {
      if (!cls) return [];
      const source = getClassParent(cls) || cls;
      const learningPathEnabled = source.learningPathEnabled !== false;
      const fallbackTests = getClassAssignedTests(cls);
      const hasPaths = Array.isArray(source.learningPaths) && source.learningPaths.length;

      if (learningPathEnabled && hasPaths) {
        return source.learningPaths.map((path, idx) => ({
          id: path.id || `path_${idx + 1}`,
          title: path.title || `Week ${idx + 1}`,
          description: path.description || '',
          items: (path.items || []).map((item, itemIndex) => ({
            id: item.id || `${path.id || `path_${idx + 1}`}_item_${itemIndex + 1}`,
            title: item.title || '',
            testId: item.testId || item.id || null,
            type: item.type || 'test',
            prerequisite: item.prerequisite || null
          }))
        }));
      }

      return [{
        id: 'default_path',
        title: 'Assigned Materials',
        description: '',
        items: fallbackTests.map((tid, index) => ({
          id: `default_item_${index + 1}`,
          title: '',
          testId: tid,
          type: 'test',
          prerequisite: null
        }))
      }];
    }
