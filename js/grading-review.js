// Extracted from js/test-player.js: Submissions list, grading view & split review UI
    function renderSubmissions() {
      document.getElementById('submissions-list').innerHTML = SUBMISSIONS.length ? SUBMISSIONS.map(s => `
        <div class="bg-white border border-blue-50 rounded-2xl p-5 mb-4 shadow-sm hover:shadow-md transition flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4">
          <div>
            <h3 class="font-black text-lg text-slate-800 flex items-center gap-2">👤 ${window.getStudentDisplayName ? window.getStudentDisplayName(s.student) : s.student} <span class="text-xs text-blue-600 font-bold bg-blue-50 px-2 py-1 rounded-md border border-blue-100">${s.className}</span></h3>
            <p class="text-sm font-medium text-slate-600 mt-1 flex items-center gap-2">📝 ${s.testName} <span class="text-[10px] text-slate-400 font-bold tracking-widest uppercase bg-slate-100 px-2 py-0.5 rounded">${s.date}</span>
                ${s.secureInfractions > 0 ? `<span class="bg-rose-100 text-rose-700 border border-rose-300 text-[9px] font-bold px-1.5 py-0.5 rounded" title="${s.secureInfractions} Tab Switches Detected">⚠️ ${s.secureInfractions} Warnings</span>` : ''}
            </p>
          </div>
          <div class="text-left sm:text-right flex flex-row sm:flex-col items-center sm:items-end justify-between sm:justify-center">
            <div class="flex items-center gap-2">
                ${s.studentReply && !s.teacherReadReply ? `<span class="bg-rose-500 text-white text-[10px] font-bold px-2 py-1 rounded animate-pulse shadow-sm">New Reply</span>` : ''}
                <p class="font-black text-blue-700 text-xl">${s.score}</p>
            </div>
            <button onclick="openGradingView(${s.id})" class="text-sm bg-blue-50 hover:bg-blue-600 hover:text-white text-blue-700 font-bold px-4 py-2 rounded-lg border border-blue-100 hover:border-blue-600 mt-1 shadow-sm transition">Grade / Review &rarr;</button>
          </div>
        </div>`).join('') : `
        <div class="flex flex-col items-center justify-center py-20 bg-white border-2 border-dashed border-blue-100 rounded-3xl shadow-sm col-span-full animate-fade-in-up">
            <div class="w-20 h-20 bg-blue-50 rounded-full flex items-center justify-center mb-4 border border-blue-100 shadow-inner">
                <svg class="w-10 h-10 text-blue-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5"><path stroke-linecap="round" stroke-linejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path></svg>
            </div>
            <h3 class="text-xl font-black text-blue-900 mb-2">Inbox Empty</h3>
            <p class="text-sm text-slate-500 font-medium max-w-md text-center">When your students complete their assigned tests, their results and essays will appear here for grading.</p>
        </div>`;
    }
    
    window.exportGradesCSV = function() {
        if(SUBMISSIONS.length === 0) {
            showModalMsg("Notice", "No submissions available to export.");
            return;
        }
        let csv = "ID,Date,Student,Class,Test Name,Score\n";
        SUBMISSIONS.forEach(s => {
            const studentName = window.getStudentDisplayName ? window.getStudentDisplayName(s.student) : s.student;
            csv += `"${s.id}","${s.date}","${studentName}","${s.className}","${s.testName}","${s.score}"\n`;
        });
        // Uint8Array applies the UTF-8 BOM to ensure Excel reads accents correctly
        const blob = new Blob([new Uint8Array([0xEF, 0xBB, 0xBF]), csv], { type: 'text/csv;charset=utf-8;' }); 
        const link = document.createElement("a");
        const url = URL.createObjectURL(blob);
        link.setAttribute("href", url);
        link.setAttribute("download", `lms_grades_export_${new Date().toISOString().split('T')[0]}.csv`);
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    async function clearAllSubmissions() { 
      showConfirm("Clear All", "Delete all student data from cloud?", async () => {
        const btn = document.querySelector('button[onclick="clearAllSubmissions()"]');
        if (btn) { btn.textContent = "Clearing..."; btn.disabled = true; }
        
        try {
          const snap = await window.fsGetDocs(window.fsCollection(window.db, window.fPath('submissions')));
          for (let d of snap.docs) {
             await window.fsDeleteDoc(window.fsDoc(window.db, window.fPath('submissions'), d.id));
          }
          SUBMISSIONS = [];
          renderSubmissions(); 
        } catch (err) {
          console.error("Clear Submissions Error:", err);
          showModalMsg("Error", "Could not clear all submissions. Please try again.");
        }
        
        if (btn) { btn.textContent = "Clear All Data"; btn.disabled = false; }
      }); 
    }

    function openGradingView(subId) {
      sessionStorage.setItem('lms_grading_sub', subId);
      sessionStorage.setItem('lms_grading_mode', 'teacher');
      const sub = SUBMISSIONS.find(x => x.id === subId); if(!sub) return;
      
      let test;
      if (sub.syntheticData) {
          test = sub.syntheticData;
      } else {
          test = TEST_BANK.find(t => t.id === sub.testId);
          if(!test) { showModalMsg("Error", "Original test deleted."); return; }
      }

      if (routerReady && !appRouterApplying) {
          window.navigateAppRoute(`teacher/review/${subId}`);
          return;
      }

      // ✨ NEW: Mark student reply as read when teacher opens it!
      if (sub.studentReply && !sub.teacherReadReply) {
          sub.teacherReadReply = true;
          window.fsSetDoc(window.fsDoc(window.db, window.fPath('submissions'), String(subId)), sub);
      }

      APP_DATA = test; answers = sub.answers || {};
      
      document.getElementById('editor-ui').classList.add('hidden');
      document.getElementById('review-ui').classList.remove('hidden');
      document.getElementById('review-module-badge').textContent = `${APP_DATA.module} - GRADING: ${window.getStudentDisplayName ? window.getStudentDisplayName(sub.student) : sub.student}`;
      
      initResizer();
      buildSplitReviewUI(true, subId, sub.teacherFeedback || {});
    }

    function reviewPastSubmission(subId) {
      sessionStorage.setItem('lms_grading_sub', subId);
      sessionStorage.setItem('lms_grading_mode', 'student');
      const sub = SUBMISSIONS.find(x => x.id === subId); if(!sub) return;
      
      let test;
      if (sub.syntheticData) {
          test = sub.syntheticData;
      } else {
          test = TEST_BANK.find(t => t.id === sub.testId);
          if(!test) return;
      }
      
      if (routerReady && !appRouterApplying) {
          window.navigateAppRoute(`student/review/${subId}`);
          return;
      }

      APP_DATA = test; answers = sub.answers || {};
      if (sub.questionAnalytics && sub.questionAnalytics.length) {
        questionBlockAccumulated = {};
        questionBlockStartTimes = {};
        currentActiveQuestionBlockKey = null;
      }
      document.getElementById('start-screen').classList.add('hidden');
      document.getElementById('review-ui').classList.remove('hidden');
      document.getElementById('review-module-badge').textContent = APP_DATA.module;
      
      initResizer();
      window.buildSplitReviewUI(false, subId, sub.teacherFeedback || {});
    }

    window.buildSplitReviewUI = function(isGrading, subId, feedbackObj) {
      const l = document.getElementById('review-left-pane'), r = document.getElementById('review-right-pane');
      const sub = SUBMISSIONS.find(x => x.id === subId) || {}; 
      
      let lHtml = '';
      APP_DATA.parts.forEach((p, i) => {
        let txt = p.text || '';
        if(APP_DATA.module === 'reading' || APP_DATA.module === 'listening') {
           // Replicate Drop Zones for the Passage (Matching Headings / DND Lists)
           [...txt.matchAll(/{drop:(\d+)}/g)].forEach(m => {
              const id = Number(m[1]);
              const g = answers[id] || '';
              
              // Find the correct answer for this ID from the question blocks
              let e = '';
              p.questions.forEach(q => { if (q.correctAnswers && q.correctAnswers[id]) e = q.correctAnswers[id]; });
              
              const gClean = g.toString().toLowerCase().trim();
              const eList = e.toString().toLowerCase().split(/[/|]/).map(x => x.trim());
              const isC = eList.includes(gClean) && gClean !== '';
              
              let resultHtml = '';
              if (!g) {
                  resultHtml = `<div class="inline-flex flex-col min-w-[120px] mx-2 align-middle"><div class="bg-slate-100 border-2 border-slate-300 border-dashed text-slate-500 font-bold text-sm px-3 py-1.5 rounded text-center shadow-sm">Unanswered</div><div class="text-[10px] text-emerald-600 font-bold text-center mt-1">✓ Correct: ${e}</div></div>`;
              } else if (isC) {
                  resultHtml = `<div class="inline-flex min-w-[120px] mx-2 align-middle bg-emerald-50 border-2 border-emerald-500 text-emerald-900 font-bold text-sm px-3 py-1.5 rounded text-center shadow-sm"><span class="bg-emerald-500 text-white text-[10px] px-1.5 py-0.5 rounded mr-2">${id}</span> ${g}</div>`;
              } else {
                  resultHtml = `<div class="inline-flex flex-col min-w-[120px] mx-2 align-middle"><div class="bg-rose-50 border-2 border-rose-500 text-rose-900 font-bold text-sm px-3 py-1.5 rounded text-center shadow-sm line-through opacity-80"><span class="bg-rose-500 text-white text-[10px] px-1.5 py-0.5 rounded mr-2">${id}</span> ${g}</div><div class="text-[11px] text-emerald-700 bg-emerald-50 border border-emerald-200 font-bold text-center mt-1 py-0.5 rounded shadow-sm">✓ ${e}</div></div>`;
              }
              
              txt = txt.replace(m[0], resultHtml);
           });
           
           // Same logic for blank fills in passage text
           [...txt.matchAll(/{blank:(\d+)}/g)].forEach(m => {
              const id = Number(m[1]);
              const g = answers[id] || '';
              let e = '';
              p.questions.forEach(q => { if (q.correctAnswers && q.correctAnswers[id]) e = q.correctAnswers[id]; });
              
              const gClean = g.toString().toLowerCase().trim();
              const eList = e.toString().toLowerCase().split(/[/|]/).map(x => x.trim());
              const isC = eList.includes(gClean) && gClean !== '';
              
              let resultHtml = '';
              if (!g) {
                  resultHtml = `<span class="inline-flex items-center align-middle bg-slate-100 border border-slate-300 border-dashed text-slate-500 text-[14px] font-bold rounded px-1.5 py-0.5 mx-1 shadow-sm whitespace-nowrap"><span class="text-[10px] bg-slate-400 text-white px-1.5 py-0.5 rounded-sm mr-1.5">${id}</span>Unanswered<span class="text-emerald-700 bg-emerald-100 px-1 rounded border border-emerald-400 ml-1.5 shadow-inner">✓ ${e}</span></span>`;
              } else if (isC) {
                  resultHtml = `<span class="inline-flex items-center align-middle bg-emerald-50 border border-emerald-400 text-emerald-800 text-[14px] font-bold rounded px-1.5 py-0.5 mx-1 shadow-sm whitespace-nowrap"><span class="text-[10px] bg-emerald-600 text-white px-1.5 py-0.5 rounded-sm mr-1.5">${id}</span>${g}</span>`;
              } else {
                  resultHtml = `<span class="inline-flex items-center align-middle bg-rose-50 border border-rose-300 text-rose-800 text-[14px] font-bold rounded px-1.5 py-0.5 mx-1 shadow-sm whitespace-nowrap"><span class="text-[10px] bg-rose-600 text-white px-1.5 py-0.5 rounded-sm mr-1.5">${id}</span><s class="opacity-70 mr-1.5 text-rose-600">${g}</s><span class="text-emerald-700 bg-emerald-100 px-1 rounded border border-emerald-400 ml-0.5 shadow-inner">✓ ${e}</span></span>`;
              }
              
              txt = txt.replace(m[0], resultHtml);
           });
           
           txt = txt.split('\n\n').map(x => `<p class="mb-4 leading-relaxed">${x}</p>`).join('');
        } else if(APP_DATA.module === 'writing' || APP_DATA.module === 'speaking') {
           txt = txt.replace(/\n/g, '<br>');
        }
        
        lHtml += `<div class="passage-text font-black text-xl mb-6 mt-8 first:mt-0 text-slate-800">${lmsSanitizeHtml(p.title)}</div>`;
        if (APP_DATA.module === 'speaking' && p.speakingQuestions) {
            lHtml += `<section class="passage-text mb-6"><h2 class="font-bold text-base mb-2">Questions</h2><div class="leading-relaxed">${p.speakingQuestions}</div></section>`;
        }
        if(p.audioUrl) lHtml += `<audio controls src="${p.audioUrl}" class="w-full h-10 mb-6 shadow-sm rounded-lg border border-slate-200"></audio>`;
        if(p.image && APP_DATA.module !== 'writing') lHtml += `<div class="mb-6 bg-slate-50 p-4 border border-slate-200 rounded-xl text-center shadow-inner"><img src="${p.image}" class="max-w-full inline-block rounded shadow-sm"></div>`;
        lHtml += `<div class="leading-loose text-slate-800 text-[1.05rem] selection-wrapper" data-review-part-index="${i}">${txt}</div>`;
      });
      
      l.innerHTML = lHtml;
      if (!isGrading && APP_DATA.module === 'listening') {
        APP_DATA.parts.forEach((part, index) => {
          const passage = l.querySelector(`[data-review-part-index="${index}"]`);
          const summary = highlightListeningDistractors(passage, part);
          if (summary) {
            passage.insertAdjacentHTML('beforebegin', renderListeningDistractorLegend(summary));
          }
        });
      }

      let rHtml = '';
      APP_DATA.parts.forEach((p, i) => {
        rHtml += `<h3 class="font-black text-slate-800 uppercase tracking-widest text-sm mb-4 mt-10 first:mt-0 border-b-2 border-slate-200 pb-2">Results: ${lmsSanitizeHtml(p.title)}</h3>`;
        
        p.questions.forEach((q) => {
          let content = '';
          let qImageHtml = '';
          const hasDedicatedMapImage = q.type === 'map_labelling_grid' || q.type === 'map_labelling_hotspots';
          const genericQuestionImageHtml = APP_DATA.module === 'listening' && q.image && !hasDedicatedMapImage
              ? `<div class="mb-5 text-center bg-slate-50 p-4 border border-slate-200 rounded-xl"><img src="${escapeHtmlAttributeValue(q.image)}" alt="Question image" class="max-w-full max-h-[420px] inline-block rounded shadow-sm"></div>`
              : '';
          let qTextHtml = '';
          let qOptsHtml = '';
          const displayResultOption = value => q.latexSource
              ? String(value).replace(/[&<>"']/g, char => ({
                  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
              })[char])
              : value;

          // 1. Instructions
          const cleanInst = (q.instruction || '').trim();
          const instructionHtml = cleanInst && cleanInst !== '<br>' && cleanInst !== '<p><br></p>' ? `<div class="text-[1.05rem] font-bold text-slate-800 mb-4">${q.instruction}</div>` : '';

          // 2. Build the Question Type specific UI
          if (q.type === 'multiple_choice' || q.type === 'tfng' || q.type === 'ynng') {
              const givenArr = q.ids.map(id => (answers[id] || '').toString().toLowerCase().trim()).filter(Boolean);
              const correctArr = q.ids.flatMap(id => (q.correctAnswers?.[id] || '').toString().toLowerCase().split(/[/|]/).map(x => x.trim())).filter(Boolean);
              const reviewOpts = q.type === 'tfng' ? ['True','False','Not Given'] : (q.type === 'ynng' ? ['Yes','No','Not Given'] : (q.options || []));
              
              let leftoverBadges = q.ids.map(id => `<span class="inline-flex min-w-[28px] h-[28px] px-1.5 bg-slate-800 border border-slate-800 text-white text-sm font-bold items-center justify-center rounded-sm mr-3 shadow-sm">${id}</span>`).join('');
              
              qTextHtml = `<div class="mb-5 flex items-start">${leftoverBadges}<div class="pt-1 text-[1.05rem] text-slate-800 leading-relaxed font-bold">${q.text || ''}</div></div>`;
              
              qOptsHtml = `<div class="space-y-3 pl-10">` + reviewOpts.map(o => {
                  const optClean = o.toLowerCase().trim();
                  const isSelected = givenArr.includes(optClean);
                  const isCorrect = correctArr.includes(optClean);
                  
                  let style = 'bg-white border-slate-300 text-slate-700';
                  let icon = `<input type="${q.multi ? 'checkbox' : 'radio'}" disabled ${isSelected ? 'checked' : ''} class="w-4 h-4 text-blue-600 rounded cursor-not-allowed">`;
                  
                  if (isSelected && isCorrect) {
                      style = 'bg-emerald-50 border-emerald-500 text-emerald-900 shadow-sm ring-1 ring-emerald-500';
                  } else if (isSelected && !isCorrect) {
                      style = 'bg-rose-50 border-rose-500 text-rose-900 shadow-sm ring-1 ring-rose-500';
                  } else if (!isSelected && isCorrect) {
                      style = 'bg-emerald-50 border-emerald-500 text-emerald-900 shadow-sm border-dashed opacity-80';
                  }
                  
                  return `<label class="flex items-center space-x-3 p-3 rounded-lg border transition-colors ${style} cursor-not-allowed">
                      ${icon}
                      <span class="font-medium text-[15px]">${o}</span>
                      ${isSelected && !isCorrect ? `<span class="ml-auto text-xs font-bold text-rose-600 bg-white px-2 py-1 rounded shadow-sm border border-rose-200">Your Answer</span>` : ''}
                      ${isCorrect ? `<span class="ml-auto text-xs font-bold text-emerald-600 bg-white px-2 py-1 rounded shadow-sm border border-emerald-200">Correct Answer</span>` : ''}
                  </label>`;
              }).join('') + `</div>`;
          } 
          else if (q.type === 'fill_blanks' || q.type === 'dnd_list') {
              let rawText = q.text || '';
              q.ids.forEach(id => {
                  const g = answers[id] || '';
                  let e = q.correctAnswers?.[id] || '';
                  
                  const gClean = g.toString().toLowerCase().trim();
                  const eList = e.toString().toLowerCase().split(/[/|]/).map(x => x.trim());
                  const isC = eList.includes(gClean) && gClean !== '';
                  
                  let badgeHtml = '';
                  if (!g) {
                      badgeHtml = `<span class="inline-flex flex-col min-w-[120px] mx-2 align-middle"><span class="bg-slate-100 border border-slate-300 border-dashed text-slate-500 font-bold text-sm px-3 py-1.5 rounded text-center shadow-sm">Unanswered</span><span class="text-[10px] text-emerald-600 font-bold text-center mt-1">✓ Correct: ${e}</span></span>`;
                  } else if (isC) {
                      badgeHtml = `<span class="inline-flex min-w-[120px] mx-2 align-middle bg-emerald-50 border-2 border-emerald-500 text-emerald-900 font-bold text-sm px-3 py-1.5 rounded text-center shadow-sm"><span class="bg-emerald-600 text-white text-[10px] px-1.5 py-0.5 rounded mr-2">${id}</span> ${g}</span>`;
                  } else {
                      badgeHtml = `<span class="inline-flex flex-col min-w-[120px] mx-2 align-middle"><span class="bg-rose-50 border-2 border-rose-500 text-rose-900 font-bold text-sm px-3 py-1.5 rounded text-center shadow-sm line-through opacity-80"><span class="bg-rose-600 text-white text-[10px] px-1.5 py-0.5 rounded mr-2">${id}</span> ${g}</span><span class="text-[11px] text-emerald-700 bg-emerald-50 border border-emerald-200 font-bold text-center mt-1 py-0.5 rounded shadow-sm">✓ ${e}</span></span>`;
                  }

                  const regexDrop = new RegExp(`(^|[\\s>])(${id})([\\.\\)]?)\\s*\\{drop:${id}\\}`, 'g');
                  rawText = rawText.replace(regexDrop, `$1${badgeHtml}`);
                  const regexBlank = new RegExp(`(^|[\\s>])(${id})([\\.\\)]?)\\s*\\{blank:${id}\\}`, 'g');
                  rawText = rawText.replace(regexBlank, `$1${badgeHtml}`);
                  rawText = rawText.replace(`{drop:${id}}`, badgeHtml).replace(`{blank:${id}}`, badgeHtml);
              });
              
              qTextHtml = `<div class="mb-4 text-slate-800 bg-slate-50/50 p-6 rounded-xl border border-slate-200 text-[1.05rem] leading-loose shadow-sm overflow-x-auto">${rawText}</div>`;
              
              if (q.type === 'dnd_list') {
                  qOptsHtml = `<div class="mt-4 p-5 bg-white border border-slate-200 rounded-xl shadow-sm">
                      <p class="text-[11px] font-black text-slate-400 uppercase tracking-widest mb-3">Options Bank</p>
                      <div class="flex flex-wrap gap-2">
                          ${(q.options || []).map(o => `<span class="bg-slate-50 border border-slate-300 text-slate-600 px-3 py-1.5 rounded font-medium shadow-sm">${displayResultOption(o)}</span>`).join('')}
                      </div>
                  </div>`;
              }
          }
          else if (q.type === 'matching_headings') {
              qTextHtml = `<div class="mb-4 text-slate-800 text-[1.05rem] leading-relaxed font-bold">${q.text || ''}</div>`;
              qOptsHtml = `<div class="mt-4 p-5 bg-white border border-slate-200 rounded-xl shadow-sm">
                  <p class="text-[11px] font-black text-slate-400 uppercase tracking-widest mb-3">Options Bank (Headings)</p>
                  <div class="flex flex-col gap-2">
                      ${(q.options || []).map(o => `<span class="bg-slate-50 border border-slate-300 text-slate-700 px-4 py-2.5 rounded font-medium shadow-sm leading-snug">${displayResultOption(o)}</span>`).join('')}
                  </div>
              </div>`;
          }
          else if (q.type === 'matching_info') {
              const statements = (q.text || '').split('\n').filter(Boolean);
              const cols = q.options || [];
              let table = `<div class="overflow-x-auto mb-4 rounded-xl border border-slate-300 shadow-sm"><table class="w-full text-left border-collapse bg-white"><thead><tr class="bg-slate-100"><th class="border-b border-r border-slate-300 px-4 py-3 font-bold text-slate-800 text-[15px]">Statement</th>${cols.map(c => `<th class="border-b border-r border-slate-300 px-3 py-3 text-center min-w-[50px] font-bold text-slate-800 text-[15px]">${displayResultOption(c)}</th>`).join('')}</tr></thead><tbody>`;
              
              statements.forEach((stmt, sIdx) => {
                  const id = q.ids[sIdx];
                  if(!id) return;
                  
                  const g = answers[id] || '';
                  let e = q.correctAnswers?.[id] || '';
                  
                  const gClean = g.toString().toLowerCase().trim();
                  const eList = e.toString().toLowerCase().split(/[/|]/).map(x => x.trim());
                  const isC = eList.includes(gClean) && gClean !== '';
                  
                  let badgeHtml = '';
                  if (!g) {
                      badgeHtml = `<span class="inline-flex items-center align-middle bg-slate-100 border border-slate-300 border-dashed text-slate-500 text-[14px] font-bold rounded px-1.5 py-0.5 mx-1 shadow-sm whitespace-nowrap"><span class="text-[10px] bg-slate-400 text-white px-1.5 py-0.5 rounded-sm mr-1.5">${id}</span>Unanswered<span class="text-emerald-700 bg-emerald-100 px-1 rounded border border-emerald-400 ml-1.5 shadow-inner">✓ ${e}</span></span>`;
                  } else if (isC) {
                      badgeHtml = `<span class="inline-flex items-center align-middle bg-emerald-50 border border-emerald-500 text-emerald-900 text-[14px] font-bold rounded px-1.5 py-0.5 mx-1 shadow-sm whitespace-nowrap"><span class="text-[10px] bg-emerald-600 text-white px-1.5 py-0.5 rounded-sm mr-1.5">${id}</span>${g}</span>`;
                  } else {
                      badgeHtml = `<span class="inline-flex items-center align-middle bg-rose-50 border border-rose-500 text-rose-900 text-[14px] font-bold rounded px-1.5 py-0.5 mx-1 shadow-sm whitespace-nowrap"><span class="text-[10px] bg-rose-600 text-white px-1.5 py-0.5 rounded-sm mr-1.5">${id}</span><s class="opacity-70 mr-1.5 text-rose-600">${g}</s><span class="text-emerald-700 bg-emerald-100 px-1 rounded border border-emerald-400 ml-0.5 shadow-inner">✓ ${e}</span></span>`;
                  }

                  let stmtTxt = stmt;
                  const regex = new RegExp(`(^|[\\s>])(${id})([\\.\\)]?)(?=\\s|<|$)`, 'g');
                  if (regex.test(stmtTxt)) {
                      stmtTxt = stmtTxt.replace(regex, `$1${badgeHtml} `);
                  } else {
                      stmtTxt = badgeHtml + ' ' + stmtTxt;
                  }

                  table += `<tr class="hover:bg-slate-50"><td class="border-b border-r border-slate-300 px-4 py-3 font-medium text-slate-800 text-[15px] leading-relaxed">${stmtTxt}</td>`;
                  cols.forEach(c => {
                      const isSelected = g === c;
                      const isCorrectCell = eList.includes(c.toLowerCase().trim());
                      let bgClass = 'bg-white';
                      let iconHtml = `<input type="radio" disabled ${isSelected ? 'checked' : ''} class="w-4 h-4 text-blue-600 cursor-not-allowed opacity-50">`;
                      
                      if (isSelected && isC) { bgClass = 'bg-emerald-100'; }
                      else if (isSelected && !isC) { bgClass = 'bg-rose-100'; }
                      else if (!isSelected && isCorrectCell) { bgClass = 'bg-emerald-50 opacity-80'; iconHtml = `<span class="text-emerald-600 font-black">✓</span>`; }
                      
                      table += `<td class="border-b border-r border-slate-300 p-2 text-center ${bgClass}">${iconHtml}</td>`;
                  });
                  table += `</tr>`;
              });
              table += `</tbody></table></div>`;
              qTextHtml = table;
          }
          else if (q.type === 'map_labelling_grid' && q.image) {
              const places = (q.text || '').split('\n').filter(Boolean);
              const opts = q.options || [];
              
              let mapHtml = q.image ? `<div class="map-grid-question-map text-center bg-slate-50 p-4 rounded-xl border border-slate-200"><img src="${q.image}" class="max-w-full inline-block rounded shadow-sm"></div>` : '';

              let table = `<div class="overflow-x-auto shadow-sm rounded-xl border border-slate-300 w-full"><table class="w-full text-left border-collapse bg-white"><thead><tr class="bg-slate-100"><th class="border-b border-r border-slate-300 px-4 py-3 font-bold text-slate-800 text-[15px] min-w-[150px]"></th>`;
              opts.forEach(c => {
                  table += `<th class="border-b border-r border-slate-300 px-3 py-3 text-center font-bold text-slate-800 text-sm whitespace-nowrap min-w-[50px]">${displayResultOption(c)}</th>`;
              });
              table += `</tr></thead><tbody>`;
              
              q.ids.forEach((id, idx) => {
                  const placeName = places[idx] || '';
                  table += `<tr class="hover:bg-slate-50 transition-colors">`;
                  
                  const g = answers[id] || '';
                  let e = q.correctAnswers?.[id] || '';
                  
                  const gClean = g.toString().toLowerCase().trim();
                  const eList = e.toString().toLowerCase().split(/[/|]/).map(x => x.trim());
                  const isC = eList.includes(gClean) && gClean !== '';
                  
                  let badgeHtml = '';
                  if (!g) {
                      badgeHtml = `<span class="inline-flex items-center align-middle bg-slate-100 border border-slate-300 border-dashed text-slate-500 text-[14px] font-bold rounded px-1.5 py-0.5 shadow-sm whitespace-nowrap"><span class="text-[10px] bg-slate-400 text-white px-1.5 py-0.5 rounded-sm mr-1.5">${id}</span>Unanswered<span class="text-emerald-700 bg-emerald-100 px-1 rounded border border-emerald-400 ml-1.5 shadow-inner">✓ ${e}</span></span>`;
                  } else if (isC) {
                      badgeHtml = `<span class="inline-flex items-center align-middle bg-emerald-50 border border-emerald-500 text-emerald-900 text-[14px] font-bold rounded px-1.5 py-0.5 shadow-sm whitespace-nowrap"><span class="text-[10px] bg-emerald-600 text-white px-1.5 py-0.5 rounded-sm mr-1.5">${id}</span>${g}</span>`;
                  } else {
                      badgeHtml = `<span class="inline-flex items-center align-middle bg-rose-50 border border-rose-500 text-rose-900 text-[14px] font-bold rounded px-1.5 py-0.5 shadow-sm whitespace-nowrap"><span class="text-[10px] bg-rose-600 text-white px-1.5 py-0.5 rounded-sm mr-1.5">${id}</span><s class="opacity-70 mr-1.5 text-rose-600">${g}</s><span class="text-emerald-700 bg-emerald-100 px-1 rounded border border-emerald-400 ml-0.5 shadow-inner">✓ ${e}</span></span>`;
                  }

                  table += `<td class="border-b border-r border-slate-300 px-4 py-3 font-medium text-slate-800 text-[15px] whitespace-nowrap"><div class="flex items-center gap-4">${badgeHtml} <span>${placeName}</span></div></td>`;
                  
                  opts.forEach(c => {
                      const isSelected = g === c;
                      const isCorrectCell = eList.includes(c.toLowerCase().trim());
                      let bgClass = 'bg-white';
                      let iconHtml = `<input type="radio" disabled ${isSelected ? 'checked' : ''} class="w-4 h-4 text-blue-600 cursor-not-allowed opacity-50">`;
                      
                      if (isSelected && isC) { bgClass = 'bg-emerald-100'; }
                      else if (isSelected && !isC) { bgClass = 'bg-rose-100'; }
                      else if (!isSelected && isCorrectCell) { bgClass = 'bg-emerald-50 opacity-80'; iconHtml = `<span class="text-emerald-600 font-black">✓</span>`; }
                      
                      table += `<td class="border-b border-r border-slate-300 p-0 text-center ${bgClass}"><div class="w-full h-full flex items-center justify-center min-h-[44px]">${iconHtml}</div></td>`;
                  });
                  table += `</tr>`;
              });
              table += `</tbody></table></div>`;
              
              qTextHtml = `<div class="map-grid-question-container mb-4"><div class="map-grid-question-layout">${mapHtml}<div class="map-grid-question-table">${table}</div></div></div>`;
          }
          else if (q.type === 'map_labelling_hotspots' && q.image) {
              qImageHtml = `<div class="mb-6 text-center bg-slate-50 p-6 border border-slate-200 rounded-xl overflow-x-auto shadow-sm"><div class="relative inline-block max-w-full">
                  <img src="${q.image}" class="max-w-full block rounded border border-slate-300 shadow-sm">
                  ${(q.hotspots||[]).map(h => {
                     const id = h.id;
                     const g = answers[id]||'';
                     let e = q.correctAnswers?.[id]||'';
                     
                     const gClean = g.toString().toLowerCase().trim();
                     const eList = e.toString().toLowerCase().split(/[/|]/).map(x => x.trim());
                     const isC = eList.includes(gClean) && gClean !== '';
                     
                     return `<div class="absolute flex flex-col items-center" style="left:${h.x}%; top:${h.y}%; transform:translate(-50%, -50%); z-index:10;">
                        <div class="bg-white px-2 py-1 rounded shadow-md border-2 ${isC?'border-emerald-500':'border-rose-500'} text-xs font-bold text-slate-800 whitespace-nowrap mb-1">
                           <span class="mr-1 inline-block text-[10px] bg-slate-200 rounded px-1">${id}</span> ${g || '<i class="text-slate-400">Unanswered</i>'}
                        </div>
                        <div class="${isC?'hidden':'bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded shadow text-[10px] font-bold whitespace-nowrap border border-emerald-400'}">✓ ${e}</div>
                     </div>`;
                  }).join('')}
              </div></div>`;
              
              qOptsHtml = `<div class="mt-4 p-5 bg-white border border-slate-200 rounded-xl shadow-sm">
                  <p class="text-[11px] font-black text-slate-400 uppercase tracking-widest mb-3">Options Bank</p>
                  <div class="flex flex-wrap gap-2">
                      ${(q.options || []).map(o => `<span class="bg-slate-50 border border-slate-300 text-slate-600 px-3 py-1.5 rounded font-medium shadow-sm">${displayResultOption(o)}</span>`).join('')}
                  </div>
              </div>`;
          }
          else if (q.type === 'essay') {
              let fbData = { annotated: answers[q.ids[0]] || '', tr: '', cc: '', lr: '', gra: '', comment: '' };
              try {
                  if (feedbackObj[q.ids[0]]) fbData = JSON.parse(feedbackObj[q.ids[0]]); 
              } catch(e) { 
                  fbData.comment = feedbackObj[q.ids[0]]; // Legacy fallback
              }
              
              const bandOpts = [9, 8.5, 8, 7.5, 7, 6.5, 6, 5.5, 5, 4.5, 4].map(b => `<option value="${b}">${b}</option>`).join('');
              const mkSelect = (id, lbl, val, crit, qId) => `
              <div class="flex flex-col gap-1.5">
                  <label class="text-[10px] font-black text-slate-500 uppercase tracking-widest pl-1">${lbl}</label>
                  <div class="relative">
                      <select id="${id}" onchange="window.updateFeedbackText('${qId}', '${crit}', this.value)" class="w-full bg-white border-2 border-slate-200 text-indigo-900 font-black text-base rounded-xl pl-4 pr-10 py-2.5 outline-none focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/20 transition-all cursor-pointer appearance-none shadow-sm">
                          <option value="">--</option>
                          ${bandOpts.replace(`value="${val}"`, `value="${val}" selected`)}
                      </select>
                      <div class="absolute inset-y-0 right-4 flex items-center pointer-events-none text-slate-400">
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"></polyline></svg>
                      </div>
                  </div>
              </div>`;

              const inlineOpts = Object.keys(IELTS_DESCRIPTORS).map(crit => {
                  const labels = { tr: 'Task Response', cc: 'Coherence', lr: 'Lexical', gra: 'Grammar' };
                  return `<optgroup label="${labels[crit]}">` + 
                      [9, 8.5, 8, 7.5, 7, 6.5, 6, 5.5, 5, 4.5, 4].map(b => `<option value="${crit}-${b}">Band ${b}</option>`).join('') + 
                      `</optgroup>`;
              }).join('');

              if (isGrading) {
                  content = `
                  <div class="flex flex-wrap gap-6 items-start w-full relative mt-4">
                      <div class="flex-[2_1_400px] w-full min-w-[280px]">
                          <div class="flex flex-wrap gap-2 mb-0 bg-slate-800 p-2 rounded-t-xl border border-slate-700 items-center sticky top-0 z-20 shadow-lg">
                              <div class="flex gap-1 bg-slate-700 p-1 rounded-lg">
                                  <button type="button" onmousedown="event.preventDefault(); document.execCommand('bold')" class="w-8 h-8 flex items-center justify-center bg-transparent text-white hover:bg-slate-500 rounded font-bold transition" title="Bold">B</button>
                                  <button type="button" onmousedown="event.preventDefault(); document.execCommand('italic')" class="w-8 h-8 flex items-center justify-center bg-transparent text-white hover:bg-slate-500 rounded italic transition" title="Italic">I</button>
                                  <button type="button" onmousedown="event.preventDefault(); document.execCommand('strikeThrough')" class="w-8 h-8 flex items-center justify-center bg-transparent text-white hover:bg-slate-500 rounded line-through transition" title="Strike Through">S</button>
                              </div>
                              <div class="w-px h-6 bg-slate-600 self-center mx-1 hidden sm:block"></div>
                              <div class="flex gap-1 bg-slate-700 p-1 rounded-lg flex-1 sm:flex-none justify-center">
                                  <button type="button" onmousedown="event.preventDefault(); document.execCommand('hiliteColor', false, '#fef08a')" class="px-3 h-8 bg-yellow-400/20 text-yellow-300 hover:bg-yellow-400/40 rounded text-xs font-bold transition">Highlight</button>
                                  <button type="button" onmousedown="event.preventDefault(); document.execCommand('foreColor', false, '#ef4444')" class="px-3 h-8 bg-rose-500/20 text-rose-400 hover:bg-rose-500/40 rounded text-xs font-bold transition">Red</button>
                                  <button type="button" onmousedown="event.preventDefault(); document.execCommand('foreColor', false, '#10b981')" class="px-3 h-8 bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/40 rounded text-xs font-bold transition">Green</button>
                              </div>
                              <div class="w-full sm:w-px h-px sm:h-6 bg-slate-600 self-center mx-1"></div>
                              <select id="inline-crit-${q.ids[0]}" onchange="window.insertInlineFeedback('${q.ids[0]}')" class="flex-1 min-w-[140px] bg-slate-700 border border-slate-600 rounded-lg px-3 h-10 text-xs outline-none text-white font-bold shadow-sm cursor-pointer hover:bg-slate-600 transition appearance-none">
                                  <option value="">+ Insert IELTS Descriptor...</option>
                                  ${inlineOpts}
                              </select>
                          </div>
                          <div id="essay-content-${q.ids[0]}" contenteditable="true" class="bg-white border-x border-b border-slate-300 p-6 rounded-b-xl font-sans text-base leading-loose whitespace-pre-wrap outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500 min-h-[400px] shadow-sm transition-all">${fbData.annotated || '<em class="text-slate-400">No response.</em>'}</div>
                      </div>
                      
                      <div class="flex-[1_1_340px] w-full max-w-full xl:max-w-[340px] shrink-0 bg-slate-50 border border-slate-200 p-6 rounded-2xl shadow-sm xl:sticky xl:top-0 z-10 flex flex-col gap-4">
                          <div class="flex items-center gap-3 border-b border-slate-200 pb-4 mb-2">
                              <div class="w-10 h-10 rounded-xl bg-indigo-100 text-indigo-600 flex items-center justify-center text-xl shadow-inner">📊</div>
                              <div>
                                  <h4 class="font-black text-slate-800 text-sm tracking-wide uppercase">Criteria Grading</h4>
                                  <p class="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">Select Band Scores</p>
                              </div>
                          </div>
                          ${renderPeerReviewSummary(sub.peerReviews || [])}
                          <div class="flex flex-col gap-5">
                              ${mkSelect(`tr-${q.ids[0]}`, 'Task Response', fbData.tr, 'tr', q.ids[0])}
                              ${mkSelect(`cc-${q.ids[0]}`, 'Coherence & Cohesion', fbData.cc, 'cc', q.ids[0])}
                              ${mkSelect(`lr-${q.ids[0]}`, 'Lexical Resource', fbData.lr, 'lr', q.ids[0])}
                              ${mkSelect(`gra-${q.ids[0]}`, 'Grammar & Accuracy', fbData.gra, 'gra', q.ids[0])}
                          </div>
                          
                          <div class="mt-2 border-t border-slate-200 pt-5">
                              <label class="block text-[11px] font-black text-slate-500 uppercase tracking-widest mb-2">Overall Comments</label>
                              <textarea id="fb-${q.ids[0]}" class="w-full border-2 border-slate-200 rounded-xl p-4 text-sm outline-none focus:ring-4 focus:ring-indigo-500/20 focus:border-indigo-500 min-h-[160px] resize-y shadow-inner font-medium text-slate-700 transition-all bg-white" placeholder="Write overall feedback here...">${fbData.comment}</textarea>
                          </div>
                          
                          ${sub.studentReply ? `
                          <div class="mt-2 pt-4 border-t border-slate-200">
                              <label class="block text-[10px] font-black text-indigo-600 mb-2 uppercase tracking-widest flex items-center gap-1">💬 Student Reply</label>
                              <div class="bg-indigo-50 p-4 rounded-xl border border-indigo-200 text-sm text-indigo-900 shadow-inner italic leading-relaxed">"${sub.studentReply}"</div>
                          </div>` : ''}
                      </div>
                  </div>`;
              } else {
                  let readOnlyAnnotation = fbData.annotated || '<em class="text-slate-400">No response.</em>';
                  readOnlyAnnotation = readOnlyAnnotation.replace(/\s*(?:<br\s*\/?>)?\s*<button[^>]*onclick="this\.parentElement\.remove\(\)"[^>]*>.*?<\/button>\s*(?:<br\s*\/?>)?\s*/gi, '');
                  readOnlyAnnotation = readOnlyAnnotation.replace(/(?:<br\s*\/?>|<p><br\s*\/?>\s*<\/p>|\s)+<\/div>/gi, '</div>');
                  readOnlyAnnotation = readOnlyAnnotation.replace(/pr-8/gi, 'pr-4');
                  readOnlyAnnotation = readOnlyAnnotation.replace(/contenteditable="true"/gi, 'contenteditable="false"');

                  let feedbackSidebarHtml = '';
                  if (feedbackObj[q.ids[0]]) {
                      feedbackSidebarHtml = `
                      <div class="flex-[1_1_340px] w-full max-w-full xl:max-w-[340px] shrink-0 bg-emerald-50 border border-emerald-200 rounded-2xl p-6 shadow-sm xl:sticky xl:top-0 z-10 flex flex-col gap-4">
                          <h4 class="font-black text-emerald-900 border-b border-emerald-200 pb-3 uppercase tracking-widest text-xs flex items-center gap-2"><span>🏆</span> Feedback & Scores</h4>
                          <div class="grid grid-cols-2 gap-3 mb-2">
                              <div class="bg-white p-3 rounded-xl border border-emerald-200 text-center shadow-sm"><div class="text-[10px] text-slate-400 font-bold uppercase tracking-widest mb-1">TR</div><div class="font-black text-emerald-700 text-2xl leading-none">${fbData.tr || '-'}</div></div>
                              <div class="bg-white p-3 rounded-xl border border-emerald-200 text-center shadow-sm"><div class="text-[10px] text-slate-400 font-bold uppercase tracking-widest mb-1">CC</div><div class="font-black text-emerald-700 text-2xl leading-none">${fbData.cc || '-'}</div></div>
                              <div class="bg-white p-3 rounded-xl border border-emerald-200 text-center shadow-sm"><div class="text-[10px] text-slate-400 font-bold uppercase tracking-widest mb-1">LR</div><div class="font-black text-emerald-700 text-2xl leading-none">${fbData.lr || '-'}</div></div>
                              <div class="bg-white p-3 rounded-xl border border-emerald-200 text-center shadow-sm"><div class="text-[10px] text-slate-400 font-bold uppercase tracking-widest mb-1">GRA</div><div class="font-black text-emerald-700 text-2xl leading-none">${fbData.gra || '-'}</div></div>
                          </div>
                          <div class="text-emerald-900 text-sm leading-relaxed bg-white p-4 rounded-xl border border-emerald-200 shadow-inner font-medium">${fbData.comment || '<i>No overall comments provided.</i>'}</div>
                          
                          <div class="mt-2 pt-4 border-t border-emerald-200">
                              <label class="block text-[10px] font-black text-emerald-700 mb-2 uppercase tracking-widest flex items-center gap-1">💬 Reply to Teacher</label>
                              ${sub.studentReply 
                                  ? `<div class="bg-white p-3 rounded-xl border border-emerald-200 text-sm text-slate-700 shadow-sm italic leading-relaxed">"${sub.studentReply}"</div>` 
                                  : `<textarea id="student-reply-text" class="w-full border-2 border-emerald-200 rounded-xl p-3 text-sm outline-none focus:border-emerald-500 bg-white shadow-inner mb-2 resize-none h-20" placeholder="Ask a question or say thanks..."></textarea>
                                     <button onclick="window.submitStudentReply(${subId})" class="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-2 rounded-lg shadow-sm transition text-sm">Send Reply</button>`
                              }
                          </div>
                      </div>`;
                  } else {
                      feedbackSidebarHtml = `
                      <div class="flex-[1_1_340px] w-full max-w-full xl:max-w-[340px] shrink-0 bg-slate-50 border border-slate-200 rounded-2xl p-6 shadow-sm xl:sticky xl:top-0 z-10 flex flex-col items-center text-center">
                          <div class="w-12 h-12 bg-white rounded-full flex items-center justify-center text-2xl border border-slate-200 shadow-sm mb-3">⏳</div>
                          <h4 class="font-black text-slate-500 uppercase tracking-widest text-xs mb-2">Feedback Pending</h4>
                          <p class="text-sm text-slate-400 italic">Your teacher has not graded this essay yet.</p>
                      </div>`;
                  }

                  content = `
                  <div class="flex flex-wrap gap-6 items-start w-full relative mt-4">
                      <div class="flex-[2_1_400px] w-full min-w-[280px] bg-white border border-slate-300 p-6 sm:p-8 rounded-2xl shadow-sm font-sans text-[1.1rem] leading-loose whitespace-pre-wrap">${readOnlyAnnotation}</div>
                      ${feedbackSidebarHtml}
                  </div>`;
              }
          } else if (q.type === 'audio_record' || APP_DATA.module === 'speaking') {
              const a = answers[q.ids[0]];
              content = a ? `<audio controls src="${a}" class="w-full mt-4"></audio>` : `<p class="italic text-slate-500 mt-4">No recording submitted.</p>`;
              if (isGrading) {
                  let speakingFeedback = { fluency_coherence: '', lexical_resource: '', grammar: '', pronunciation: '', comment: '' };
                  try { if (feedbackObj[q.ids[0]]) speakingFeedback = JSON.parse(feedbackObj[q.ids[0]]); } catch (e) { speakingFeedback.comment = feedbackObj[q.ids[0]] || ''; }
                  const speakingBandOpts = [9, 8.5, 8, 7.5, 7, 6.5, 6, 5.5, 5, 4.5, 4].map(b => `<option value="${b}">${b}</option>`).join('');
                  const speakingField = (key, label) => `<label class="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">${label}<select id="${key}-${q.ids[0]}" class="w-full mt-1 border-2 border-indigo-200 rounded-lg p-2 font-black text-indigo-900"><option value="">--</option>${speakingBandOpts.replace(`value="${speakingFeedback[key]}"`, `value="${speakingFeedback[key]}" selected`)}</select></label>`;
                  content += `<div class="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-3 p-4 bg-indigo-50 border border-indigo-200 rounded-xl">${speakingField('fluency_coherence', 'Fluency & Coherence')}${speakingField('lexical_resource', 'Lexical Resource')}${speakingField('grammar', 'Grammar Range & Accuracy')}${speakingField('pronunciation', 'Pronunciation')}<textarea id="fb-${q.ids[0]}" class="sm:col-span-2 border-2 border-indigo-200 bg-white rounded-xl p-3 text-sm min-h-[100px]" placeholder="Leave speaking feedback notes...">${speakingFeedback.comment || ''}</textarea></div>`;
              } else if (feedbackObj[q.ids[0]]) {
                  let speakingFeedback = { comment: feedbackObj[q.ids[0]] };
                  try { speakingFeedback = JSON.parse(feedbackObj[q.ids[0]]); } catch (e) {}
                  content += `<div class="mt-4 bg-emerald-50 border-2 border-emerald-200 rounded-xl p-5 text-emerald-900 shadow-sm"><b class="block text-[10px] font-black uppercase tracking-widest text-emerald-600 mb-2">Teacher Feedback:</b><div class="text-sm leading-relaxed">${speakingFeedback.comment || ''}</div></div>`;
              }
          }

          let explHtml = '';
          if (q.explanation && q.explanation.trim() !== '' && q.explanation !== '<br>' && q.explanation !== '<p><br></p>') {
              explHtml = `<div class="mt-5 bg-purple-50 border border-purple-200 p-5 rounded-xl text-[1.05rem] leading-relaxed text-purple-900 shadow-inner">
                  <b class="text-purple-700 uppercase tracking-widest text-[10px] block mb-2">📖 Giải thích đáp án (Explanation)</b>
                  ${q.explanation}
              </div>`;
          }

          // Use the beautiful q-block styling from Test Mode!
          rHtml += `<div class="bg-white p-6 rounded-xl border border-slate-200 shadow-sm mb-6 transition theme-q-block">
              ${instructionHtml}
              ${genericQuestionImageHtml}
              <div class="w-full text-slate-800">
                  ${qTextHtml}
                  ${qOptsHtml}
                  ${qImageHtml}
                  ${content}
                  ${explHtml}
              </div>
          </div>`;
        });
      });
      
    if(isGrading) rHtml += `<div class="flex flex-col sm:flex-row gap-3 mt-4"><button onclick="window.requestAIGrade(${subId})" id="btn-ai-grade" class="flex-1 bg-amber-500 text-white font-black py-4 rounded-xl shadow-md hover:bg-amber-600 transition">AI Grade Draft</button><button onclick="saveFeedback(${subId})" id="btn-save-feed" class="flex-1 bg-indigo-600 text-white font-black py-4 rounded-xl shadow-md hover:bg-indigo-700 transition hover:-translate-y-0.5">Save Grades & Feedback</button></div><p class="text-[10px] text-slate-500 mt-2 text-center">AI grading is a draft. Review and edit all scores before saving.</p>`;
      r.innerHTML = rHtml;
      setTimeout(restoreHighlights, 50);
    }

    async function saveFeedback(subId) {
      const sub = SUBMISSIONS.find(x => x.id === subId); if(!sub) return;
      const btn = document.getElementById('btn-save-feed'); btn.textContent="Saving..."; btn.disabled=true;
      
      sub.teacherFeedback = {};
      
      let totalWritingScore = 0;
      let hasWritingScore = false;

    APP_DATA.parts.forEach(p => p.questions.forEach(q => {
         if (q.type === 'essay') {
             // Gather all the new grading data
             const annotatedContent = document.getElementById(`essay-content-${q.ids[0]}`)?.innerHTML || '';
             const tr = document.getElementById(`tr-${q.ids[0]}`)?.value || '';
             const cc = document.getElementById(`cc-${q.ids[0]}`)?.value || '';
             const lr = document.getElementById(`lr-${q.ids[0]}`)?.value || '';
             const gra = document.getElementById(`gra-${q.ids[0]}`)?.value || '';
             const comment = document.getElementById(`fb-${q.ids[0]}`)?.value || '';
             
             // Calculate average if all 4 are filled
             if (tr && cc && lr && gra) {
                 let avg = (Number(tr) + Number(cc) + Number(lr) + Number(gra)) / 4;
                 // Round to nearest 0.5 (IELTS standard)
                 totalWritingScore = Math.round(avg * 2) / 2;
                 hasWritingScore = true;
             }

             // Save as a JSON string to keep database structure compatible
             sub.teacherFeedback[q.ids[0]] = JSON.stringify({
                 annotated: annotatedContent,
                 tr: tr, cc: cc, lr: lr, gra: gra,
                 comment: comment
             });
         } else if (q.type === 'audio_record' || APP_DATA.module === 'speaking') {
             // Keep logic for other types (like Audio feedback)
             const feedback = {
                 fluency_coherence: document.getElementById(`fluency_coherence-${q.ids[0]}`)?.value || '',
                 lexical_resource: document.getElementById(`lexical_resource-${q.ids[0]}`)?.value || '',
                 grammar: document.getElementById(`grammar-${q.ids[0]}`)?.value || '',
                 pronunciation: document.getElementById(`pronunciation-${q.ids[0]}`)?.value || '',
                 comment: document.getElementById(`fb-${q.ids[0]}`)?.value || ''
             };
             if (Object.values(feedback).some(value => String(value).trim())) sub.teacherFeedback[q.ids[0]] = JSON.stringify(feedback);
             const speakingScores = [feedback.fluency_coherence, feedback.lexical_resource, feedback.grammar, feedback.pronunciation].map(Number).filter(Number.isFinite).filter(value => value > 0);
             if (speakingScores.length) {
                 const average = speakingScores.reduce((sum, value) => sum + value, 0) / speakingScores.length;
                 sub.score = `Band ${(window.aiDraftOverallByQuestion[q.ids[0]] || Math.round(average * 2) / 2).toFixed(1)}`;
             }
         }
      }));

      if(APP_DATA.module === 'writing') {
          sub.score = hasWritingScore ? `Band ${totalWritingScore.toFixed(1)}` : "Graded ✓";
      } else if (APP_DATA.module === 'speaking') {
          sub.score = "Graded ✓";
      }
      
      await window.fsSetDoc(window.fsDoc(window.db, window.fPath('submissions'), String(subId)), sub);
      showModalMsg("Saved", "Feedback synced to cloud database successfully.");
      renderSubmissions(); 
      btn.textContent="Save Grades & Feedback"; btn.disabled=false;
    }

        window.requestAIGrade = async function(subId) {
            const sub = SUBMISSIONS.find(item => item.id === subId);
            if (!sub || !window.auth?.currentUser) return;
            const button = document.getElementById('btn-ai-grade');
            if (button) { button.disabled = true; button.textContent = 'AI grading...'; }
            try {
                const test = sub.syntheticData || TEST_BANK.find(item => item.id === sub.testId);
                const module = test?.module || getSubmissionModule(sub);
                const questions = test?.parts?.flatMap(part => part.questions || []) || [];
                const responseQuestion = questions.find(question => question.type === 'essay' || question.type === 'audio_record');
                const response = sub.answers?.[responseQuestion?.ids?.[0]] || '';
                const prompt = test?.parts?.map(part => `${part.title}: ${part.text || ''}`).join('\n\n') || '';
                const token = await window.auth.currentUser.getIdToken();
                const payload = { module, prompt, responseText: module === 'writing' ? response : '', audioUrl: module === 'speaking' ? response : '' };
                const result = await fetch('https://us-central1-khanh-ielts-v2.cloudfunctions.net/gradeIELTSSubmission', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
                    body: JSON.stringify(payload)
                });
                const data = await result.json();
                if (!result.ok) throw new Error(data.error || 'AI grading failed');
                const criteria = data.scores || {};
                if (module === 'writing') {
                    ['task_response', 'coherence_cohesion', 'lexical_resource', 'grammar'].forEach((key, index) => {
                        const id = ['tr', 'cc', 'lr', 'gra'][index];
                        const field = document.getElementById(`${id}-${responseQuestion.ids[0]}`);
                        if (field) field.value = criteria[key] || '';
                    });
                } else {
                    ['fluency_coherence', 'lexical_resource', 'grammar', 'pronunciation'].forEach(key => {
                        const field = document.getElementById(`${key}-${responseQuestion.ids[0]}`);
                        if (field) field.value = criteria[key] || '';
                    });
                }
                const feedback = document.getElementById(`fb-${responseQuestion.ids[0]}`);
                if (feedback) feedback.value = `${data.feedback || ''}\n\nAI draft overall band: ${data.overall || '-'}\n${data.limitations || ''}`;
                window.aiDraftOverallByQuestion[responseQuestion.ids[0]] = Number(data.overall) || 0;
                if (typeof window.showToast === 'function') window.showToast('AI Draft Ready', 'Review the rubric scores and save when satisfied.');
            } catch (error) {
                console.error(error);
                showModalMsg('AI Grading Error', error.message || 'Could not grade this submission.');
            } finally {
                if (button) { button.disabled = false; button.textContent = 'AI Grade Draft'; }
            }
        };

    window.submitStudentReply = async function(subId) {
        const text = document.getElementById('student-reply-text').value.trim();
        if (!text) return;
        
        const sub = SUBMISSIONS.find(x => x.id === subId);
        if (!sub) return;
        
        sub.studentReply = text;
        sub.teacherReadReply = false; // Triggers the teacher's red notification badge
        
        try {
            await window.fsSetDoc(window.fsDoc(window.db, window.fPath('submissions'), String(subId)), sub);
            if (typeof window.showToast === 'function') window.showToast("Sent!", "Your reply has been sent to the teacher.");
            reviewPastSubmission(subId); // Re-render UI to hide text box
        } catch (e) {
            console.error(e);
            showModalMsg("Error", "Could not send reply.");
        }
    };
