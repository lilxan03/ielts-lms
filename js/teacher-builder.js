    window.quickAddTeacherGrammar = function(e) {
      e.preventDefault(); e.stopPropagation(); document.getElementById('editor-selection-tooltip').classList.add('hidden');
      const term = window.getSelection().toString().trim();
      if(term) { openTeacherGrammarModal(); document.getElementById('tg-term').value = term; }
    }

    window.toggleGrammarBulk = function() {
      const single = document.getElementById('tg-single-area');
      const bulk = document.getElementById('tg-bulk-area');
      const btn = document.getElementById('tg-bulk-toggle-btn');
      
      if (single.classList.contains('hidden')) {
        single.classList.remove('hidden');
        bulk.classList.add('hidden');
        btn.innerHTML = '📥 Bulk Paste from Excel';
      } else {
        single.classList.add('hidden');
        bulk.classList.remove('hidden');
        btn.innerHTML = '✍️ Single Manual Entry';
      }
    };

    window.processGrammarBulk = function() {
      const text = document.getElementById('tg-bulk-input').value.trim();
      if(!text) {
        showModalMsg("Empty", "Please paste some data from Excel first.");
        return;
      }
      
      const lines = text.split('\n');
      let count = 0;
      
      lines.forEach(line => {
        const parts = line.split('\t'); // Reads the Excel columns based on standard 'tab' spacing
        if(parts[0] && parts[0].trim()) {
          APP_DATA.grammar.push({
            term: parts[0].trim(),
            type: (parts[1] || '').trim(),
            expl: (parts[2] || '').trim()
          });
          count++;
        }
      });
      
      document.getElementById('tg-bulk-input').value = '';
      toggleGrammarBulk(); // Swap back to standard view
      renderTeacherGrammar();
      triggerEditorAutosave();
      showModalMsg("Success", `Imported ${count} grammar points!`);
    };
    
    window.toggleVocabBulk = function() {
      const single = document.getElementById('tv-single-area');
      const bulk = document.getElementById('tv-bulk-area');
      const btn = document.getElementById('tv-bulk-toggle-btn');
      
      if (single.classList.contains('hidden')) {
        single.classList.remove('hidden');
        bulk.classList.add('hidden');
        btn.innerHTML = '✍️ Single Manual Entry';
      } else {
        single.classList.add('hidden');
        bulk.classList.remove('hidden');
        btn.innerHTML = '📥 Bulk Paste from Excel';
      }
    };

    window.processVocabBulk = function() {
      const text = document.getElementById('tv-bulk-input').value.trim();
      if(!text) {
        showModalMsg("Empty", "Please paste some data from Excel first.");
        return;
      }
      
      const lines = text.split('\n');
      let count = 0;
      
      lines.forEach(line => {
        const parts = line.split('\t'); // Reads the Excel columns based on standard 'tab' spacing
          if(parts[0] && parts[0].trim()) {
          APP_DATA.vocab.push({
            term: parts[0].trim(),
            part: document.getElementById('tv-part-select').value, // <-- ADD THIS
            pron: (parts[1] || '').trim(),
            eng: (parts[2] || '').trim(),
            vi: (parts[3] || '').trim(),
            syn: (parts[4] || '').trim(),
            ant: (parts[5] || '').trim(),
            pref: (parts[6] || '').trim(),
            suf: (parts[7] || '').trim(),
            lvl: (parts[8] || '').trim()
          });
          count++;
        }

      });
      
      document.getElementById('tv-bulk-input').value = '';
      toggleVocabBulk(); // Swap back to standard view
      renderTeacherVocab();
      triggerEditorAutosave();
      showModalMsg("Success", `Imported ${count} vocabulary words!`);
    };

    window.execCmd = function(command, value = null) {
      document.execCommand(command, false, value);
      window.triggerEditorAutosave();
    };

    window.insertGap = function(type, blockIdx) {
      let idToUse = 1;
      
      if (typeof blockIdx !== 'undefined' && blockIdx !== null) {
          // Triggered from inside a specific question block on the right
          const blockEl = document.getElementById('editor-questions-list').children[blockIdx];
          if (blockEl) {
              const idsInput = blockEl.querySelector('.q-ids');
              let ids = [];
              
              if (idsInput && !idsInput.readOnly) {
                  ids = idsInput.value.split(',').map(n => Number(n.trim())).filter(n => !isNaN(n));
              }
              if (ids.length === 0 && APP_DATA.parts[currentEditorPartIdx].questions[blockIdx]) {
                  ids = APP_DATA.parts[currentEditorPartIdx].questions[blockIdx].ids;
              }
              
              const qTextEl = blockEl.querySelector('.q-text.rich-editor');
              const currentHtml = qTextEl ? qTextEl.innerHTML : '';
              
              idToUse = ids.find(id => !currentHtml.includes(`{${type}:${id}}`));
              
              if (idToUse === undefined && ids.length > 0) {
                  idToUse = ids[0];
              }
          }
      } else {
          // Triggered from the Passage Text toolbar on the LEFT
          let liveIds = [];
          const blockEls = document.getElementById('editor-questions-list').children;

          // 1. Gather all expected IDs from gap-based questions (Matching, Fill Blanks, D&D)
          Array.from(blockEls).forEach((b, index) => {
              const qType = APP_DATA.parts[currentEditorPartIdx].questions[index]?.type;
              if (['fill_blanks', 'dnd_list', 'matching_headings'].includes(qType)) {
                  const idsInput = b.querySelector('.q-ids');
                  if (idsInput && !idsInput.readOnly) {
                      liveIds.push(...idsInput.value.split(',').map(n => Number(n.trim())).filter(n => !isNaN(n)));
                  }
              }
          });

          // 2. Gather IDs already used in the passage AND inside question texts
          const usedIds = [];
          const regex = /\{(?:drop|blank):(\d+)\}/g;
          let match;

          // Check passage
          const passageHtml = document.getElementById('edit-passage-text').innerHTML;
          while ((match = regex.exec(passageHtml)) !== null) {
              usedIds.push(Number(match[1]));
          }

          // Check question blocks
          Array.from(blockEls).forEach(b => {
              const qText = b.querySelector('.q-text.rich-editor');
              if (qText) {
                  let m;
                  while ((m = regex.exec(qText.innerHTML)) !== null) {
                      usedIds.push(Number(m[1]));
                  }
              }
          });

          // 3. Pick the first expected ID that hasn't been placed anywhere yet
          idToUse = liveIds.find(id => !usedIds.includes(id));

          // 4. Fallback if all are used or no gap blocks exist yet
          if (idToUse === undefined) {
              let maxId = 0;
              APP_DATA.parts.forEach(p => {
                  p.questions.forEach(q => {
                      (q.ids || []).forEach(id => { if (id > maxId) maxId = id; });
                  });
              });
              idToUse = maxId > 0 ? maxId + 1 : 1;
          }
      }

      const tag = type === 'blank' ? `{blank:${idToUse}}` : `{drop:${idToUse}}`;
      document.execCommand('insertHTML', false, tag);
      window.triggerEditorAutosave();
    };

    window.insertVisualTemplate = function(editorId, type, qType) {
      const editor = document.getElementById(editorId);
      if (!editor) return;
      editor.focus();
      
      let html = '';
      const blankTag = (qType === 'dnd_list' || qType === 'matching_headings') ? '{drop:1}' : '{blank:1}';
      
      if (type === 'table') {
          html = `<table class="border-collapse border border-slate-300 mb-4 bg-white w-full" style="table-layout: fixed; width: 100%;"><tbody><tr class="bg-slate-100"><th class="border border-slate-300 p-2 text-left">Heading 1</th><th class="border border-slate-300 p-2 text-left">Heading 2</th></tr><tr><td class="border border-slate-300 p-2 font-medium">Row 1 ${blankTag}</td><td class="border border-slate-300 p-2">Info goes here...</td></tr></tbody></table><p><br></p>`;
      } else if (type === 'flow') {
          html = `<div class="mb-4 flex flex-col items-center text-center"><div class="border-2 border-slate-400 p-2 rounded font-bold bg-white shadow-sm inline-block">Step 1</div><div class="h-6 w-0.5 bg-slate-400"></div><div class="border-2 border-slate-400 p-2 rounded font-bold bg-white shadow-sm inline-block">Step 2 ${blankTag}</div><div class="h-6 w-0.5 bg-slate-400"></div><div class="border-2 border-slate-400 p-2 rounded font-bold bg-white shadow-sm inline-block">Step 3</div></div><p><br></p>`;
      }
      
      const selection = window.getSelection();
      if (selection.getRangeAt && selection.rangeCount) {
          let range = selection.getRangeAt(0);
          if (editor.contains(range.commonAncestorContainer)) {
              const el = document.createElement("div");
              el.innerHTML = html;
              const frag = document.createDocumentFragment();
              let node, lastNode;
              while ( (node = el.firstChild) ) {
                  lastNode = frag.appendChild(node);
              }
              range.insertNode(frag);
              if (lastNode) {
                  range = range.cloneRange();
                  range.setStartAfter(lastNode);
                  range.collapse(true);
                  selection.removeAllRanges();
                  selection.addRange(range);
              }
          } else {
              editor.innerHTML += html;
          }
      } else {
          editor.innerHTML += html;
      }
      
      if (typeof window.saveCurrentEditorPart === 'function') window.saveCurrentEditorPart();
      if (typeof window.triggerEditorAutosave === 'function') window.triggerEditorAutosave();
    };

    window.modifyTable = function(action) {
        if(!activeTableCell) return;
        const table = activeTableCell.closest('table');
        const row = activeTableCell.closest('tr');
        const rowIdx = Array.from(row.parentNode.children).indexOf(row);
        const cells = Array.from(row.children);
        const cellIdx = cells.indexOf(activeTableCell);

        if(action === 'row-above' || action === 'row-below') {
            const newRow = row.cloneNode(true);
            Array.from(newRow.children).forEach(c => { c.innerHTML = '<br>'; c.removeAttribute('colspan'); c.removeAttribute('rowspan'); });
            if(action === 'row-above') row.parentNode.insertBefore(newRow, row);
            else row.parentNode.insertBefore(newRow, row.nextSibling);
        }
        if(action === 'del-row') {
            row.remove();
            document.getElementById('table-controls-tooltip').classList.add('hidden');
        }
        if(action === 'col-left' || action === 'col-right') {
            Array.from(table.rows).forEach(r => {
                const targetCell = r.children[cellIdx] || r.lastElementChild;
                const newCell = document.createElement(targetCell?.tagName || 'td');
                if (targetCell) newCell.className = targetCell.className;
                newCell.innerHTML = '<br>';
                
                if(targetCell && action === 'col-left') r.insertBefore(newCell, targetCell);
                else if(targetCell && action === 'col-right') {
                    if(targetCell.nextSibling) r.insertBefore(newCell, targetCell.nextSibling);
                    else r.appendChild(newCell);
                } else {
                    r.appendChild(newCell);
                }
            });
        }
        if(action === 'del-col') {
            Array.from(table.rows).forEach(r => {
                if(r.children[cellIdx]) r.children[cellIdx].remove();
            });
            document.getElementById('table-controls-tooltip').classList.add('hidden');
        }
        if(action === 'merge-right') {
            const nextCell = activeTableCell.nextElementSibling;
            if(nextCell) {
                activeTableCell.colSpan = (activeTableCell.colSpan || 1) + (nextCell.colSpan || 1);
                activeTableCell.innerHTML += (nextCell.innerHTML === '<br>' ? '' : ' ' + nextCell.innerHTML);
                nextCell.remove();
            }
        }
        if(action === 'merge-down') {
            const nextRow = table.rows[rowIdx + (activeTableCell.rowSpan || 1)];
            if(nextRow && nextRow.children[cellIdx]) {
                const targetCell = nextRow.children[cellIdx];
                activeTableCell.rowSpan = (activeTableCell.rowSpan || 1) + (targetCell.rowSpan || 1);
                activeTableCell.innerHTML += (targetCell.innerHTML === '<br>' ? '' : '<br>' + targetCell.innerHTML);
                targetCell.remove();
            }
        }
        if(action === 'unmerge') {
            const rs = activeTableCell.rowSpan || 1;
            const cs = activeTableCell.colSpan || 1;
            activeTableCell.removeAttribute('rowspan');
            activeTableCell.removeAttribute('colspan');
            
            for(let r=0; r<rs; r++) {
                for(let c=0; c<cs; c++) {
                    if(r===0 && c===0) continue;
                    const targetRow = table.rows[rowIdx + r];
                    if(targetRow) {
                        const newCell = document.createElement(activeTableCell.tagName);
                        newCell.innerHTML = '<br>';
                        const insertBeforeCell = targetRow.children[cellIdx + (r===0?c:0)];
                        if(insertBeforeCell) targetRow.insertBefore(newCell, insertBeforeCell);
                        else targetRow.appendChild(newCell);
                    }
                }
            }
        }
        if(action === 'toggle-width') {
            const isFull = table.classList.contains('w-full');
            if (isFull) {
                table.classList.remove('w-full');
                table.style.width = 'max-content'; // Forces the browser to respect natural text width!
                table.style.tableLayout = 'auto';
            } else {
                table.classList.add('w-full');
                table.style.width = '100%';
                table.style.tableLayout = 'fixed';
            }
        }
        if(action === 'toggle-border') {
            const hasBorder = table.classList.contains('border');
            if (hasBorder) {
                table.classList.remove('border', 'border-slate-300');
                table.classList.add('no-border');
                table.querySelectorAll('th, td').forEach(c => c.classList.remove('border', 'border-slate-300'));
            } else {
                table.classList.add('border', 'border-slate-300');
                table.classList.remove('no-border');
                table.querySelectorAll('th, td').forEach(c => c.classList.add('border', 'border-slate-300'));
            }
        }
        window.saveCurrentEditorPart();
        window.triggerEditorAutosave();
    };

    // --- REPLACEMENT AI GENERATOR FUNCTION ---
    window.generateAIQuestions = async function() {
        const textInput = document.getElementById('ai-source-text').value.trim();
        const imgPreview = document.getElementById('ai-image-preview').src;
        const hasImage = !document.getElementById('ai-image-preview').classList.contains('hidden');
        
        if (!textInput && !hasImage) {
            showModalMsg("Error", "Please upload an image or paste text for the AI to analyze.");
            return;
        }

        const btn = document.getElementById('ai-generate-btn');
        const loading = document.getElementById('ai-loading');
        
        btn.disabled = true;
        btn.classList.add('opacity-50', 'cursor-not-allowed');
        loading.classList.remove('hidden');
        loading.classList.add('flex');

        try {
            // ✨ SECURE BACKEND ARCHITECTURE
            // The frontend NO LONGER holds an API key. It pushes the payload to your backend.
            // Example Firebase Cloud Function Endpoint:
            const cloudFunctionUrl = "https://us-central1-khanh-ielts.cloudfunctions.net/extractIELTSQuestions";
            
            const payload = {
                sourceText: textInput || null,
                imageBase64: aiUploadedImageBase64 || null,
                mimeType: aiUploadedImageMime || null
            };

            const response = await fetch(cloudFunctionUrl, { 
                method: 'POST', 
                headers: { 'Content-Type': 'application/json' }, 
                body: JSON.stringify(payload) 
            });

            if (!response.ok) {
                const errData = await response.text();
                throw new Error(`Server Error: ${errData}`);
            }

            const data = await response.json();
            
            // 1. Inject Passage Text
            if (data.passageText && data.passageText.trim().length > 10) {
               const passTxt = document.getElementById('edit-passage-text');
               if (passTxt.tagName === 'TEXTAREA') passTxt.value = data.passageText;
               else passTxt.innerHTML = data.passageText.split('\n').map(p => p.trim() ? `<p>${p}</p>` : '').join('');
               
               if (data.passageTitle) document.getElementById('edit-passage-title').value = data.passageTitle;
            }

            // 2. Map AI Questions to Editor Objects
            if (data.questions && Array.isArray(data.questions)) {
                data.questions.forEach((q, i) => {
                    const newId = (Date.now() % 10000) + Math.floor(Math.random() * 10000) + i;
                    const validTypes = ['multiple_choice', 'tfng', 'ynng', 'fill_blanks', 'matching_headings', 'dnd_list'];
                    let qType = validTypes.includes(q.type) ? q.type : 'multiple_choice';

                    let newBlock = {
                        blockId: 'b' + Date.now() + i + Math.floor(Math.random() * 1000),
                        type: qType,
                        ids: [newId],
                        points: 1,
                        instruction: q.instruction || "Answer the question.",
                        hint: getAssignedQuestionTemplateHtml(APP_DATA.module, qType),
                        explanation: q.explanation || "",
                        correctAnswers: {}
                    };

                    if (qType === 'multiple_choice' || qType === 'matching_headings') {
                        newBlock.text = q.text || "";
                        newBlock.options = q.options || [];
                        newBlock.correctAnswers[newId] = q.answer || "";
                        newBlock.multi = false;
                    } else if (qType === 'fill_blanks' || qType === 'dnd_list') {
                        let txt = q.text || "";
                        if (!txt.includes('{blank:1}') && !txt.includes('{drop:1}')) {
                            txt += ` {${qType==='fill_blanks'?'blank':'drop'}:${newId}}`; 
                        } else {
                            txt = txt.replace(/\{blank:1\}/g, `{blank:${newId}}`).replace(/\{drop:1\}/g, `{drop:${newId}}`);
                        }
                        newBlock.text = txt;
                        newBlock.correctAnswers[newId] = q.answer || "";
                    } else { 
                        newBlock.text = q.text || "";
                        newBlock.correctAnswers[newId] = q.answer || "";
                    }

                    APP_DATA.parts[currentEditorPartIdx].questions.push(newBlock);
                });
            }

            saveCurrentEditorPart();
            renderEditorQuestions();
            triggerEditorAutosave();
            closeAIGenerator();
            clearAIImage();
            
            const addBtn = document.querySelector('button[onclick="addEditorQuestion()"]');
            if (addBtn) {
                const originalColor = addBtn.className;
                addBtn.className = "bg-emerald-500 text-white px-3 py-2 rounded font-bold shadow text-sm whitespace-nowrap transition-colors";
                addBtn.textContent = `✓ Built ${data.questions?.length || 0} Questions`;
                setTimeout(() => { addBtn.className = originalColor; addBtn.textContent = '＋ Add'; }, 2500);
            }

        } catch (err) {
            console.error("AI Generation Error:", err);
            showModalMsg("Backend AI Connection Required", "The frontend has been successfully secured. To use this feature, you must deploy the Node.js endpoint to Firebase Cloud Functions and place the URL in the code.");
        } finally {
            btn.disabled = false;
            btn.classList.remove('opacity-50', 'cursor-not-allowed');
            loading.classList.add('hidden');
            loading.classList.remove('flex');
        }
    }

    // ✨ NEW: Track the last active input for the "Add Answer / Add Option" feature
    let lastActiveInput = null;
    document.addEventListener('focusin', e => {
        if ((e.target.tagName === 'INPUT' && (e.target.type === 'text' || e.target.type === 'number')) || e.target.tagName === 'TEXTAREA' || e.target.isContentEditable) {
            lastActiveInput = e.target;
        }
    });

    window.importAnswerToInput = function(e, type = 'answer') {
        if (e) { e.preventDefault(); e.stopPropagation(); }
        const edTT = document.getElementById('editor-selection-tooltip');
        if (edTT) edTT.classList.add('hidden');

        const text = window.getSelection().toString().trim();
        if (!text) return;

        // Support both standard inputs and contenteditable divs
        if (lastActiveInput && document.body.contains(lastActiveInput)) {
            
            if (lastActiveInput.isContentEditable) {
                // For Rich Text Editors (like .q-text, .q-inst)
                lastActiveInput.focus();
                
                document.execCommand('insertText', false, text);
                if (typeof window.triggerEditorAutosave === 'function') window.triggerEditorAutosave();
                if (typeof window.showToast === 'function') window.showToast("Inserted", `Added "${text}" to text editor.`);
                
            } else if (!lastActiveInput.readOnly && !lastActiveInput.disabled) {
                // For Standard Inputs and Textareas (.q-opts, .q-correct)
                let textToInsert = text;
                const start = lastActiveInput.selectionStart || 0;
                const end = lastActiveInput.selectionEnd || 0;
                const val = lastActiveInput.value;
                
                // Smart newline logic for "Add Option" in Textareas
                if (lastActiveInput.tagName === 'TEXTAREA' && type === 'option') {
                    // If appending to the end and it doesn't already end in a newline, add one!
                    if (val.length > 0 && start === val.length && !val.endsWith('\n')) {
                        textToInsert = '\n' + text;
                    }
                }
                
                lastActiveInput.value = val.substring(0, start) + textToInsert + val.substring(end);
                
                // Move cursor to end of inserted text so next insert appends correctly
                const newPos = start + textToInsert.length;
                lastActiveInput.setSelectionRange(newPos, newPos);
                
                lastActiveInput.dispatchEvent(new Event('input', {bubbles: true}));
                lastActiveInput.dispatchEvent(new Event('change', {bubbles: true}));
                
                if (typeof window.showToast === 'function') window.showToast(type === 'option' ? "Option Added" : "Answer Added", `Imported "${text}"`);
            }
        } else {
            // Fallback to copying to clipboard
            const fallbackMsg = `Copied "${text}". Please click a box and paste.`;
            if (navigator.clipboard && window.isSecureContext) {
                navigator.clipboard.writeText(text).then(() => {
                    if (typeof window.showToast === 'function') window.showToast("Copied", fallbackMsg);
                }).catch(() => document.execCommand('copy'));
            } else {
                document.execCommand('copy');
                if (typeof window.showToast === 'function') window.showToast("Copied", fallbackMsg);
            }
        }
        window.getSelection().removeAllRanges();
    };

    function quickAddTeacherVocab(e) {
      e.preventDefault(); e.stopPropagation(); document.getElementById('editor-selection-tooltip').classList.add('hidden');
      const term = window.getSelection().toString().trim();
      if(term) { openTeacherVocabModal(); document.getElementById('tv-term').value = term; }
    }

    let isColResizing = false;
    let activeTh = null;
    let startColX = 0;
    let startColWidth = 0;

    document.addEventListener('mousedown', function(e) {
        if(e.target.classList.contains('col-resizer')) {
            isColResizing = true;
            activeTh = e.target.parentElement;
            const table = activeTh.closest('table');
            if(table) {
                table.style.tableLayout = 'fixed';
                if (!table.style.width || table.style.width === 'auto') table.style.width = table.offsetWidth + 'px';
            }
            startColX = e.pageX;
            startColWidth = activeTh.offsetWidth;
            e.preventDefault();
            e.stopPropagation();
            e.target.classList.add('bg-blue-500');
            e.target.classList.remove('hover:bg-blue-400');
        }
    });

    document.addEventListener('mousemove', function(e) {
        if(isColResizing && activeTh) {
            let newWidth = Math.max(30, startColWidth + (e.pageX - startColX));
            activeTh.style.width = newWidth + 'px';
        }
    });

    document.addEventListener('mouseup', function(e) {
        if(isColResizing) {
            isColResizing = false;
            if (activeTh) {
               const resizer = activeTh.querySelector('.col-resizer');
               if(resizer) {
                   resizer.classList.remove('bg-blue-500');
                   resizer.classList.add('hover:bg-blue-400');
               }
            }
            activeTh = null;
            if(window.triggerEditorAutosave) window.triggerEditorAutosave();
        }
    });

    document.addEventListener('mouseover', e => {
       if ((e.target.tagName === 'TH' || e.target.tagName === 'TD') && e.target.closest('.rich-editor')) {
           if (e.target.querySelector('.col-resizer')) return;
           const resizer = document.createElement('div');
           resizer.className = 'col-resizer absolute right-0 top-0 bottom-0 w-2 cursor-col-resize hover:bg-blue-400 z-10';
           resizer.contentEditable = "false";
           e.target.style.position = 'relative';
           e.target.appendChild(resizer);
       }
    });

    function positionSelectionTooltip(tooltip, anchorRect) {
      if (!tooltip || !anchorRect) return;

      tooltip.classList.remove('hidden');
      tooltip.style.position = 'fixed';
      tooltip.style.left = '0px';
      tooltip.style.top = '0px';
      tooltip.style.maxWidth = 'calc(100vw - 16px)';
      tooltip.style.maxHeight = 'calc(100vh - 16px)';
      tooltip.style.overflowY = 'auto';
      tooltip.style.visibility = 'hidden';

      const tooltipRect = tooltip.getBoundingClientRect();
      const width = tooltipRect.width;
      const height = tooltipRect.height;
      const padding = 8;
      const gap = 8;
      const centerX = anchorRect.left + anchorRect.width / 2;
      const centerY = anchorRect.top + anchorRect.height / 2;
      const candidates = [
        { placement: 'top', left: centerX - width / 2, top: anchorRect.top - height - gap },
        { placement: 'bottom', left: centerX - width / 2, top: anchorRect.bottom + gap },
        { placement: 'right', left: anchorRect.right + gap, top: centerY - height / 2 },
        { placement: 'left', left: anchorRect.left - width - gap, top: centerY - height / 2 }
      ];
      const fits = candidate =>
        candidate.left >= padding &&
        candidate.top >= padding &&
        candidate.left + width <= window.innerWidth - padding &&
        candidate.top + height <= window.innerHeight - padding;
      const position = candidates.find(fits) || candidates
        .map(candidate => ({
          ...candidate,
          space: candidate.placement === 'top' ? anchorRect.top :
            candidate.placement === 'bottom' ? window.innerHeight - anchorRect.bottom :
            candidate.placement === 'right' ? window.innerWidth - anchorRect.right :
            anchorRect.left
        }))
        .sort((a, b) => b.space - a.space)[0];

      tooltip.dataset.placement = position.placement;
      tooltip.style.left = `${Math.max(padding, Math.min(position.left, window.innerWidth - width - padding))}px`;
      tooltip.style.top = `${Math.max(padding, Math.min(position.top, window.innerHeight - height - padding))}px`;
      tooltip.style.visibility = '';
    }

    window.addEventListener('scroll', () => {
      ['exam-selection-tooltip', 'clear-highlight-tooltip', 'editor-selection-tooltip', 'vocab-popover', 'grammar-popover'].forEach(id => {
        const tooltip = document.getElementById(id);
        if (tooltip) tooltip.classList.add('hidden');
      });
    }, true);

    document.addEventListener('mouseup', (e) => {
      const edTT = document.getElementById('editor-selection-tooltip');
      const exTT = document.getElementById('exam-selection-tooltip');
      const clTT = document.getElementById('clear-highlight-tooltip');
      const tableTT = document.getElementById('table-controls-tooltip');
      
      if(edTT) edTT.classList.add('hidden'); 
      if(exTT) exTT.classList.add('hidden');
      if(clTT) clTT.classList.add('hidden');

      if (!document.getElementById('editor-ui').classList.contains('hidden')) {
        const cell = e.target.closest('.rich-editor td, .rich-editor th');
        if (cell && tableTT) {
            activeTableCell = cell;
            const rect = cell.getBoundingClientRect();
            tableTT.style.top = `${rect.top - 45}px`; 
            tableTT.style.left = `${Math.min(rect.left, window.innerWidth - 450)}px`;
            tableTT.classList.remove('hidden');
        } else if (tableTT && !e.target.closest('#table-controls-tooltip')) {
            tableTT.classList.add('hidden');
            activeTableCell = null;
        }

        if (e.target.closest('#edit-passage-text') || e.target.closest('#editor-questions-list')) {
          const sel = window.getSelection();
          if (sel && sel.toString().trim().length > 0) {
            const range = sel.getRangeAt(0);
            const rect = range.getBoundingClientRect();
            positionSelectionTooltip(edTT, rect);
          }
        }
      } 
      else if (!document.getElementById('exam-ui').classList.contains('hidden') || !document.getElementById('review-ui').classList.contains('hidden')) {
         const selection = window.getSelection(); const text = selection.toString().trim();
         
         if (text.length > 0 && (e.target.closest('#passage-container') || e.target.closest('#questions-container') || e.target.closest('#review-left-pane') || e.target.closest('#review-right-pane'))) {
            if (e.target.nodeName === 'TEXTAREA' || e.target.nodeName === 'INPUT') return;
            
            activeSelectionRange = selection.getRangeAt(0).cloneRange(); 
            const rect = activeSelectionRange.getBoundingClientRect();
            
            const fcBtn = document.getElementById('tooltip-flashcard-btn');
            const fcDivdr = document.getElementById('tooltip-flashcard-divider');
            const hlGroup = document.getElementById('tooltip-hl-group');
            const hlExtra = document.getElementById('tooltip-hl-extra');
            const noteBtn = document.getElementById('tooltip-note-btn');
            const hlDivdr = document.getElementById('tooltip-hl-divider');
            
            if(!document.getElementById('exam-ui').classList.contains('hidden')) { 
               if(isTimeFree) {
                   if(fcBtn) fcBtn.classList.remove('hidden'); 
                   if(fcDivdr) fcDivdr.classList.remove('hidden'); 
               } else {
                   if(fcBtn) fcBtn.classList.add('hidden'); 
                   if(fcDivdr) fcDivdr.classList.add('hidden'); 
               }
               
               if(hlGroup) hlGroup.classList.remove('hidden');
               if(hlExtra) hlExtra.classList.toggle('hidden', !isTimeFree); 
               
               if(noteBtn) noteBtn.classList.remove('hidden');
               if(hlDivdr) hlDivdr.classList.remove('hidden');
            } else { 
               if(fcBtn) fcBtn.classList.remove('hidden'); 
               if(fcDivdr) fcDivdr.classList.add('hidden'); 
               if(hlGroup) hlGroup.classList.add('hidden');
               if(noteBtn) noteBtn.classList.add('hidden');
               if(hlDivdr) hlDivdr.classList.add('hidden');
            }

            positionSelectionTooltip(exTT, rect);
         } else if (e.target.classList.contains('highlighted-text')) {
            activeHighlightNode = e.target;
            const rect = activeHighlightNode.getBoundingClientRect();
            positionSelectionTooltip(clTT, rect);
         }
      }
    });

    document.addEventListener('mousedown', e => {
      if (!e.target.closest('#exam-selection-tooltip') && !e.target.closest('#clear-highlight-tooltip') && !e.target.classList.contains('highlighted-text') && !e.target.closest('#editor-selection-tooltip') && !e.target.closest('#table-controls-tooltip')) {
         const exTT = document.getElementById('exam-selection-tooltip');
         const clTT = document.getElementById('clear-highlight-tooltip');
         const edTT = document.getElementById('editor-selection-tooltip');
         const tableTT = document.getElementById('table-controls-tooltip');
         if(exTT) exTT.classList.add('hidden');
         if(clTT) clTT.classList.add('hidden');
         if(edTT) edTT.classList.add('hidden');
         if(tableTT) { tableTT.classList.add('hidden'); activeTableCell = null; }
      }
    });

    window.safeHighlightRange = function(range, colorClass, noteId, isNote = false) {
        const root = range.commonAncestorContainer.nodeType === Node.TEXT_NODE 
                     ? range.commonAncestorContainer.parentNode 
                     : range.commonAncestorContainer;

        const treeWalker = document.createTreeWalker(
            root,
            NodeFilter.SHOW_TEXT,
            {
                acceptNode: function(node) {
                    if (!range.intersectsNode(node)) return NodeFilter.FILTER_REJECT;
                    if (!node.nodeValue.trim()) return NodeFilter.FILTER_REJECT;
                    if (['TEXTAREA', 'INPUT', 'SELECT', 'SCRIPT', 'STYLE'].includes(node.parentNode.nodeName)) return NodeFilter.FILTER_REJECT;
                    if (node.parentNode.classList && node.parentNode.classList.contains('highlighted-text')) return NodeFilter.FILTER_REJECT;
                    return NodeFilter.FILTER_ACCEPT;
                }
            },
            false
        );

        const nodes = [];
        let currentNode;
        while (currentNode = treeWalker.nextNode()) {
            nodes.push(currentNode);
        }

        if (nodes.length === 0) return null;

        const wrappedQuotes = [];
        const cls = isNote 
            ? 'highlighted-text bg-amber-200 cursor-pointer border-b-2 border-amber-500'
            : `highlighted-text ${colorClass} cursor-pointer transition-colors`;

        nodes.forEach((node, index) => {
            const isFirst = node === range.startContainer;
            const isLast = node === range.endContainer;

            let startOffset = isFirst ? range.startOffset : 0;
            let endOffset = isLast ? range.endOffset : node.nodeValue.length;

            if (startOffset >= endOffset) return;

            const textToWrap = node.nodeValue.substring(startOffset, endOffset);
            if (!textToWrap.trim()) return;

            wrappedQuotes.push(textToWrap);

            const beforeText = node.nodeValue.substring(0, startOffset);
            const afterText = node.nodeValue.substring(endOffset);

            const span = document.createElement('span');
            span.className = cls;
            span.dataset.id = noteId;
            span.textContent = textToWrap;

            const fragment = document.createDocumentFragment();
            if (beforeText) fragment.appendChild(document.createTextNode(beforeText));
            fragment.appendChild(span);
            if (afterText) fragment.appendChild(document.createTextNode(afterText));

            node.parentNode.replaceChild(fragment, node);
        });

        return wrappedQuotes;
    };
    
    async function saveCurrentNotesToCloud() {
      if (!currentUser || !APP_DATA || !APP_DATA.id || isPreviewMode) return;
      const noteKey = `${currentUser.user}_${APP_DATA.id}`;
      ALL_NOTES[noteKey] = currentNotes;
      await window.fsSetDoc(window.fsDoc(window.db, window.fPath('notes'), noteKey), { owner: currentUser.user, data: currentNotes });
    }

    function highlightSelection(e, colorClass = 'bg-yellow-300') {
      if(e) { e.preventDefault(); e.stopPropagation(); }
      document.getElementById('exam-selection-tooltip').classList.add('hidden'); 
      if (!activeSelectionRange) return;
      
      const noteId = 'h_' + Date.now();
      const quotes = window.safeHighlightRange(activeSelectionRange, colorClass, noteId, false);
      
      if (quotes && quotes.length > 0) {
          window.getSelection().removeAllRanges(); 
          const fullText = quotes.join(' ');
          currentNotes.push({ id: noteId, partIdx: currentPartIdx, quote: quotes, displayQuote: fullText, text: null, color: colorClass });
          saveCurrentNotesToCloud();
      } else {
          showModalMsg("Error", "Could not highlight. Please select standard text without overlapping structural styles.");
      }
    }

    function createNoteFromSelection(e) {
      if(e) { e.preventDefault(); e.stopPropagation(); }
      document.getElementById('exam-selection-tooltip').classList.add('hidden'); 
      if (!activeSelectionRange) return;
      const selectedText = activeSelectionRange.toString();
      showInputPrompt("Add Note", `Note for: "${selectedText.substring(0,30)}..."`, (noteText) => {
        const noteId = 'n_' + Date.now(); 

        const quotes = window.safeHighlightRange(activeSelectionRange, '', noteId, true);
        
        if (quotes && quotes.length > 0) {
            window.getSelection().removeAllRanges();
            const fullText = quotes.join(' ');
            currentNotes.push({ id: noteId, partIdx: currentPartIdx, quote: quotes, displayQuote: fullText, text: noteText });
            saveCurrentNotesToCloud();
            renderNotesPanel(); 
            if(!isNotesPanelOpen) toggleNotesPanel();
        } else {
            showModalMsg("Error", "Could not create note. Please select standard text.");
        }
      });
    }

    function clearHighlight(e) {
      if(e) { e.preventDefault(); e.stopPropagation(); }
      document.getElementById('clear-highlight-tooltip').classList.add('hidden'); 
      if (!activeHighlightNode) return;
      const noteId = activeHighlightNode.dataset.id; 
      
      const spans = document.querySelectorAll(`.highlighted-text[data-id="${noteId}"]`);
      spans.forEach(span => {
          const parent = span.parentNode;
          while (span.firstChild) parent.insertBefore(span.firstChild, span);
          parent.removeChild(span);
      });
      
      currentNotes = currentNotes.filter(n => n.id !== noteId); 
      saveCurrentNotesToCloud();
      renderNotesPanel();
    }

    function toggleNotesPanel() {
      const panel = document.getElementById('notes-panel'); 
      isNotesPanelOpen = !isNotesPanelOpen; 
      panel.classList.toggle('hidden', !isNotesPanelOpen);
    }

    function renderNotesPanel() {
      const list = document.getElementById('notes-list');
      const activeNotes = currentNotes.filter(n => n.text !== null);
      
      if (activeNotes.length === 0) {
        list.innerHTML = `<div class="text-center text-slate-400 mt-10">Select text in the passage to add a note.</div>`;
      } else {
        list.innerHTML = activeNotes.map(n => {
          const displayTxt = n.displayQuote || (Array.isArray(n.quote) ? n.quote.join(' ') : n.quote);
          return `<div class="bg-white border border-slate-200 p-3 rounded shadow-sm relative">
            <button onclick="deleteNote('${n.id}')" class="absolute top-2 right-2 text-slate-400 hover:text-rose-500">&times;</button>
            <p class="text-xs text-slate-500 italic mb-2 border-l-2 border-amber-400 pl-2">"${displayTxt}"</p>
            <p class="font-medium text-slate-800 text-sm">${n.text}</p>
          </div>`;
        }).join('');
      }
    }

    function deleteNote(id) {
      const spans = document.querySelectorAll(`.highlighted-text[data-id="${id}"]`);
      spans.forEach(span => {
          const parent = span.parentNode;
          while (span.firstChild) parent.insertBefore(span.firstChild, span);
          parent.removeChild(span);
      });
      currentNotes = currentNotes.filter(n => n.id !== id);
      saveCurrentNotesToCloud();
      renderNotesPanel();
    }

    function restoreHighlights() {
      ['passage-container', 'questions-container', 'review-left-pane', 'review-right-pane'].forEach(cid => {
         const container = document.getElementById(cid);
         if(!container) return;
         
         const isReview = cid.startsWith('review-');
         const notesToRestore = isReview ? currentNotes : currentNotes.filter(n => n.partIdx === currentPartIdx);
         if(notesToRestore.length === 0) return;

         notesToRestore.forEach(n => {
            const quotes = Array.isArray(n.quote) ? n.quote : [n.quote];

            quotes.forEach(qStr => {
                if (!qStr || !qStr.trim()) return;
                
                const walker = document.createTreeWalker(container, NodeFilter.SHOW_TEXT, {
                    acceptNode: function(node) {
                        if (['TEXTAREA', 'INPUT', 'SELECT', 'SCRIPT', 'STYLE'].includes(node.parentNode.nodeName)) return NodeFilter.FILTER_REJECT;
                        return NodeFilter.FILTER_ACCEPT;
                    }
                }, false);
                
                let node;
                while(node = walker.nextNode()) {
                   if(node.nodeValue.includes(qStr) && !node.parentNode.classList.contains('highlighted-text')) {
                      const cls = n.text === null 
                         ? `highlighted-text ${n.color || 'bg-yellow-300'} cursor-pointer transition-colors` 
                         : 'highlighted-text bg-amber-200 cursor-pointer border-b-2 border-amber-500';
                      
                      const fragment = document.createDocumentFragment();
                      const parts = node.nodeValue.split(qStr);
                      parts.forEach((part, i) => {
                         fragment.appendChild(document.createTextNode(part));
                         if(i < parts.length - 1) {
                            const span = document.createElement('span');
                            span.className = cls; 
                            span.dataset.id = n.id; 
                            span.textContent = qStr;
                            fragment.appendChild(span);
                         }
                      });
                      node.parentNode.replaceChild(fragment, node);
                      break; 
                   }
                }
            });
         });
      });
    }

    function editTest(id) {
      sessionStorage.setItem('lms_editing_test', id);
      if (routerReady && !appRouterApplying && currentUser && ['teacher', 'collaborator'].includes(currentUser.role)) {
          window.navigateAppRoute(`teacher/builder/${encodeURIComponent(id)}`);
          return;
      }
      editingTestId = id; APP_DATA = JSON.parse(JSON.stringify(TEST_BANK.find(t=>t.id===id)));
      if(!APP_DATA.vocab) APP_DATA.vocab = [];
      document.getElementById('builder-test-name').textContent = APP_DATA.title;
      
      const qs = document.getElementById('quick-status-toggle');
      if (qs) qs.value = APP_DATA.status || 'not_started';
      
      // Writing tests use the title field as the REAL task question (shown in every mode),
      // and the passage-text field becomes an optional Sample Answer (Practice Mode only).
      const titleHint = document.getElementById('edit-title-hint');
      const textHint = document.getElementById('edit-text-hint');
      const textLabelSpan = document.getElementById('edit-text-label-text');
      const titleLabel = document.getElementById('edit-title-label');
      
      const ct = document.getElementById('criteria-toolbar');
      const sepCrit = document.getElementById('toolbar-sep-crit');
      const btnBlank = document.getElementById('btn-insert-blank');
      const btnDrop = document.getElementById('btn-insert-drop');
      const sepList = document.getElementById('toolbar-sep-list');

      if (APP_DATA.module === 'writing' || APP_DATA.module === 'speaking') {
          titleHint.classList.remove('hidden');
          textHint.classList.remove('hidden');
          textLabelSpan.textContent = 'Sample Answer (Practice Mode Only)';
          titleLabel.textContent = APP_DATA.module === 'speaking' ? 'Title' : 'Part Title / Main Prompt';
          titleHint.textContent = APP_DATA.module === 'speaking'
              ? '🎓 Enter the topic or title here. Add speaking prompts in the Questions field below.'
              : "🎓 This is the real task question. It's shown to students in Practice Mode AND Full Mock Test.";
          
          if(ct) { ct.classList.remove('hidden'); ct.classList.add('flex'); }
          if(sepCrit) sepCrit.classList.remove('hidden');
          if(btnBlank) btnBlank.classList.add('hidden');
          if(btnDrop) btnDrop.classList.add('hidden');
          if(sepList) sepList.classList.add('hidden');
      } else {
          titleHint.classList.add('hidden');
          textHint.classList.add('hidden');
          textLabelSpan.textContent = 'Prompt / Passage Text';
          titleLabel.textContent = 'Part Title / Main Prompt';
          
          if(ct) { ct.classList.add('hidden'); ct.classList.remove('flex'); }
          if(sepCrit) sepCrit.classList.add('hidden');
          if(btnBlank) btnBlank.classList.remove('hidden');
          if(btnDrop) btnDrop.classList.remove('hidden');
          if(sepList) sepList.classList.remove('hidden');
      }
      
      const qSel = document.getElementById('new-q-type'); qSel.innerHTML = '';
      if(APP_DATA.module==='writing') qSel.innerHTML = '<option value="essay">Writing Essay Box</option>';
      else if(APP_DATA.module==='speaking') qSel.innerHTML = '<option value="audio_record">Audio Recording Box</option><option value="essay">Notes / Text Box</option>';
      else if(APP_DATA.module==='activity') qSel.innerHTML = '<option value="pair_roleplay">🎭 Pair Roleplay (Cards)</option><option value="group_debate">🗣️ Group Debate (Teams)</option><option value="vocab_game">🎲 Multiplayer Vocab Board</option>';
      else {
        qSel.innerHTML = `<option value="multiple_choice">Multiple Choice</option><option value="fill_blanks">Gap Fill</option><option value="dnd_list">Drag/Drop (In-Question)</option>`;
        if(APP_DATA.module==='reading') qSel.innerHTML += `<option value="tfng">True/False/Not Given</option><option value="ynng">Yes/No/Not Given</option><option value="matching_headings">Matching Headings (Passage Drops)</option><option value="matching_info">Matching Information</option><option value="matching_endings">Matching Sentence Endings (Drag &amp; Drop)</option>`;
        qSel.innerHTML += `<option value="map_labelling_hotspots">Map Labelling (Hotspots / Options > Gaps)</option><option value="map_labelling_grid">Map Labelling (Grid / Options < Gaps)</option>`;
      }

      toggleEditorTab('builder'); 
      initResizer();
      loadEditorPart(0);
    }
    
    window.quickUpdateTestStatus = function(val) {
        if (!APP_DATA || !APP_DATA.id) return;
        APP_DATA.status = val;
        
        // Track the exact moment it was approved for monthly earning calculations
        if (val === 'approved' && !APP_DATA.approvedAt) {
            APP_DATA.approvedAt = Date.now();
        }

        window.triggerEditorAutosave();
        
        if (val === 'review_ready') {
            if (typeof window.showToast === 'function') window.showToast("Sent for Review", "The teacher has been notified to check this test!");
        } else if (val === 'approved') {
            if (typeof window.showToast === 'function') window.showToast("Approved", "Test marked as approved and ready for students!");
        }
    };

    function exitBuilder() {
        sessionStorage.removeItem('lms_editing_test');
        saveCurrentEditorPart(); // Takes one final instant snapshot
        toggleEditorTab('bank'); // Glides smoothly back to the dashboard
    }
    
    function editCurrentTestMeta() {
      showTestMetaModal("Edit Test Settings", APP_DATA.title, (APP_DATA.topics || []).join(", "), (title, topics) => {
        APP_DATA.title = title;
        APP_DATA.topics = topics;
        document.getElementById('builder-test-name').textContent = title;
        triggerEditorAutosave();
      });
    }
    
    function triggerEditorAutosave() {
      if (!editingTestId) return;
      const s = document.getElementById('editor-autosave-status');
      s.textContent = "Saving...";
      s.className = "text-xs font-bold text-slate-400 transition-opacity";
      
      clearTimeout(editorAutosaveTimer);
      // ⚡ Reduced from 1500ms to 600ms for near-instant Live Sync!
      editorAutosaveTimer = setTimeout(performEditorAutosave, 600);
    }
    
    async function performEditorAutosave() {
      saveCurrentEditorPart();
      const s = document.getElementById('editor-autosave-status');
      try {
          const idx = TEST_BANK.findIndex(t => t.id === editingTestId);
          if (idx > -1) {
             TEST_BANK[idx] = JSON.parse(JSON.stringify(APP_DATA)); 
             await window.fsSetDoc(window.fsDoc(window.db, window.fPath('tests'), editingTestId), TEST_BANK[idx]);
             s.textContent = "Autosaved";
             s.className = "text-xs font-bold text-emerald-400 transition-opacity";
             setTimeout(() => s.classList.add('opacity-0'), 2000);
          }
      } catch (err) {
          console.error("Autosave failed", err);
          s.textContent = "Save Failed";
          s.className = "text-xs font-bold text-rose-400 transition-opacity";
      }
    }

    async function saveActiveTest() {
      clearTimeout(editorAutosaveTimer);
      saveCurrentEditorPart();
      
      const btn = document.getElementById('editor-save-test');
      btn.textContent = "Saving to Cloud..."; btn.disabled = true;

      try {
          const idx = TEST_BANK.findIndex(t => t.id === editingTestId);
          TEST_BANK[idx] = JSON.parse(JSON.stringify(APP_DATA)); 
          await window.fsSetDoc(window.fsDoc(window.db, window.fPath('tests'), editingTestId), TEST_BANK[idx]);
          showModalMsg("Saved", "Test saved to cloud database successfully."); 
          toggleEditorTab('bank');
      } catch (err) {
          showModalMsg("Error", "Failed to save to cloud.");
      }
      
      btn.textContent = "Save Test Data"; btn.disabled = false;
    }

    function previewActiveTest() {
      saveCurrentEditorPart();
      isPreviewMode = true;

      answers = {};
      reviewStatus = {};
      activeSelectionRange = null;
      activeHighlightNode = null;
      isNotesPanelOpen = false;
      currentNotes = []; 
      document.getElementById('notes-panel').classList.add('hidden');
      document.getElementById('questions-container').innerHTML = '';

      document.getElementById('editor-ui').classList.add('hidden');
      document.getElementById('exam-ui').classList.remove('hidden');
      window.refreshStudentLanguageLock?.();
      
      document.getElementById('exam-candidate-name').textContent = "Teacher (Preview)";
      document.getElementById('exam-preview-badge').classList.remove('hidden');
      document.getElementById('exam-module-title').textContent = APP_DATA.title;
      document.getElementById('exam-action-btn-text').textContent = "EXIT PREVIEW";

      const backBtn = document.getElementById('exam-back-btn');
      const fcBtn = document.getElementById('exam-flashcard-btn');
      if (backBtn) {
          if (testMode === 'free' || isPreviewMode) {
              backBtn.classList.remove('hidden');
              backBtn.classList.add('flex');
              if(fcBtn) { fcBtn.classList.remove('hidden'); fcBtn.classList.add('flex'); }
          } else {
              backBtn.classList.add('hidden');
              backBtn.classList.remove('flex');
              if(fcBtn) { fcBtn.classList.add('hidden'); fcBtn.classList.remove('flex'); }
          }
      }

      const modColors = { reading:'bg-blue-700', listening:'bg-cyan-700', writing:'bg-emerald-700', speaking:'bg-amber-600' };
      document.getElementById('exam-module-bar').className = `${modColors[APP_DATA.module]} text-white px-4 py-2 font-bold flex justify-between items-center z-30 shadow`;

      clearInterval(timerInterval);
      timeLeft = 0; 
      isTimeFree = true; 
      testMode = 'free';

      timerInterval = setInterval(() => {
        timeLeft++;
        const h = Math.floor(timeLeft/3600), m = Math.floor((timeLeft%3600)/60), s = timeLeft%60;
        document.getElementById('timer-display').textContent = `${h>0?h+':':''}${m.toString().padStart(2,'0')}:${s.toString().padStart(2,'0')}`;
        
        // Reset to safe mode just in case
        const wrapper = document.getElementById('timer-wrapper');
        const dot = document.getElementById('timer-dot');
        const display = document.getElementById('timer-display');
        if (wrapper && dot && display) {
            wrapper.className = "bg-slate-800 rounded-full px-6 py-1.5 flex items-center gap-3 shadow-md border border-slate-700";
            dot.className = "w-2 h-2 rounded-full bg-emerald-400 animate-pulse";
            display.className = "font-mono text-xl font-bold text-white tracking-widest drop-shadow-sm";
        }
      }, 1000);

      initResizer(); renderPart(0);
    }

    window.toggleBuilderLeftPanel = function() {
        const leftPane = document.getElementById('builder-left');
        const resizer = document.getElementById('builder-resizer');
        
        if (leftPane.classList.contains('hidden')) {
            // Restore View
            leftPane.classList.remove('hidden');
            if (resizer) resizer.classList.remove('hidden');
        } else {
            // Collapse View to make Questions Full Width
            leftPane.classList.add('hidden');
            if (resizer) resizer.classList.add('hidden');
        }
    };

    window.addEditorPart = function() {
        saveCurrentEditorPart();
        APP_DATA.parts.push({title:`Part ${APP_DATA.parts.length+1}`, text:"", questions:[]});
        loadEditorPart(APP_DATA.parts.length - 1);
        triggerEditorAutosave();
    };

    window.deleteCurrentEditorPart = function() {
        if (APP_DATA.parts.length <= 1) {
            showModalMsg("Cannot Delete", "A test must have at least one part.");
            return;
        }
        showConfirm("Delete Part", `Are you sure you want to delete "${APP_DATA.parts[currentEditorPartIdx].title}" and all its questions?`, () => {
            APP_DATA.parts.splice(currentEditorPartIdx, 1);
            // Renumber subsequent parts smoothly
            APP_DATA.parts.forEach((p, idx) => {
               if(p.title.startsWith("Part ")) p.title = `Part ${idx+1}`;
            });
            if(currentEditorPartIdx >= APP_DATA.parts.length) currentEditorPartIdx = APP_DATA.parts.length - 1;
            loadEditorPart(currentEditorPartIdx);
            triggerEditorAutosave();
        });
    };

    // --- DRAG & DROP FOR PART TABS ---
    let dragPartSourceIdx = null;

    window.partDragStart = function(e, idx) {
        saveCurrentEditorPart(); 
        dragPartSourceIdx = idx;
        e.dataTransfer.effectAllowed = 'move';
        setTimeout(() => e.target.classList.add('opacity-50'), 10);
    };
    
    window.partDragOver = function(e) {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
        e.currentTarget.classList.add('bg-blue-50');
    };
    
    window.partDragLeave = function(e) {
        e.currentTarget.classList.remove('bg-blue-50');
    };
    
    window.partDragEnd = function(e) {
        e.currentTarget.classList.remove('opacity-50', 'bg-blue-50');
    };
    
    window.partDrop = function(e, targetIdx) {
        e.preventDefault();
        e.currentTarget.classList.remove('bg-blue-50', 'opacity-50');
        if (dragPartSourceIdx !== null && dragPartSourceIdx !== targetIdx) {
            const moved = APP_DATA.parts.splice(dragPartSourceIdx, 1)[0];
            APP_DATA.parts.splice(targetIdx, 0, moved);
            
            // Re-align the current view so we don't accidentally switch screens
            if (currentEditorPartIdx === dragPartSourceIdx) {
                currentEditorPartIdx = targetIdx;
            } else if (dragPartSourceIdx < currentEditorPartIdx && targetIdx >= currentEditorPartIdx) {
                currentEditorPartIdx--;
            } else if (dragPartSourceIdx > currentEditorPartIdx && targetIdx <= currentEditorPartIdx) {
                currentEditorPartIdx++;
            }
            
            triggerEditorAutosave();
            loadEditorPart(currentEditorPartIdx);
        }
        dragPartSourceIdx = null;
    };

    window.clearPassageText = function() {
      if (!confirm("Erase all text in the Prompt / Passage Text field for this part? This can't be undone (unless you Ctrl+Z right after).")) return;
      const el = document.getElementById('edit-passage-text');
      if (el) el.innerHTML = '';
      if (APP_DATA && APP_DATA.parts && APP_DATA.parts[currentEditorPartIdx]) {
        APP_DATA.parts[currentEditorPartIdx].text = '';
      }
      window.triggerEditorAutosave();
    };

    function reconcileMatchingHeadingDrops(part) {
      if (!part || !Array.isArray(part.questions)) return false;

      const passageText = String(part.text || '');
      const passageDropIds = [...passageText.matchAll(/\{drop:(\d+)\}/g)].map(match => Number(match[1]));
      if (!passageDropIds.length) return false;

      const questionIds = new Set(part.questions.flatMap(question => question.ids || []).map(Number));
      const existingDropIds = new Set(passageDropIds);
      const unassignedDropIds = [...new Set(passageDropIds.filter(id => !questionIds.has(id)))];
      const missingHeadingIds = part.questions
        .filter(question => question.type === 'matching_headings')
        .flatMap(question => question.ids || [])
        .map(Number)
        .filter(id => !existingDropIds.has(id));
      const remappedIds = new Map();

      unassignedDropIds.slice(0, missingHeadingIds.length).forEach((oldId, index) => {
        remappedIds.set(oldId, missingHeadingIds[index]);
      });
      if (!remappedIds.size) return false;

      part.text = passageText.replace(/\{drop:(\d+)\}/g, (token, rawId) => {
        const id = remappedIds.get(Number(rawId));
        return id === undefined ? token : `{drop:${id}}`;
      });
      return true;
    }

    function loadEditorPart(idx) {
      currentEditorPartIdx = idx; const p = APP_DATA.parts[idx];
      const matchingHeadingDropsChanged = reconcileMatchingHeadingDrops(p);
      
      document.getElementById('editor-tabs').innerHTML = APP_DATA.parts.map((_, i) => 
        `<button 
          draggable="true" 
          ondragstart="window.partDragStart(event, ${i})" 
          ondragover="window.partDragOver(event)" 
          ondrop="window.partDrop(event, ${i})" 
          ondragleave="window.partDragLeave(event)" 
          ondragend="window.partDragEnd(event)"
          onclick="saveCurrentEditorPart(); loadEditorPart(${i})" 
          class="px-6 py-2.5 font-bold rounded-t-lg transition-all border-x border-t flex items-center gap-2 cursor-grab active:cursor-grabbing ${currentEditorPartIdx===i ? 'bg-white text-blue-700 border-slate-300 shadow-[0_-2px_10px_rgba(0,0,0,0.03)] border-b-white translate-y-[1px]' : 'bg-slate-100 text-slate-500 border-transparent hover:bg-slate-200 hover:text-slate-700 border-b-slate-300'}" title="Drag to reorder parts">
          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="opacity-40 pointer-events-none"><circle cx="9" cy="12" r="1"></circle><circle cx="9" cy="5" r="1"></circle><circle cx="9" cy="19" r="1"></circle><circle cx="15" cy="12" r="1"></circle><circle cx="15" cy="5" r="1"></circle><circle cx="15" cy="19" r="1"></circle></svg>
          Part ${i+1}
        </button>`
      ).join('') + `<button onclick="window.addEditorPart()" class="px-5 py-2 font-black text-blue-600 hover:text-blue-800 hover:bg-blue-100/50 rounded-t-lg transition flex items-center gap-1 shrink-0 mt-[2px] ml-2 border border-transparent hover:border-blue-200 border-b-0">+ Add Part</button>`;
      
      const titleEl = document.getElementById('edit-passage-title');
      if (titleEl.tagName === 'INPUT' || titleEl.tagName === 'TEXTAREA') titleEl.value = p.title||'';
      else titleEl.innerHTML = p.title||'';
      window.updateBuilderFeatureVisibility(p);
      const speakingQuestionsEl = document.getElementById('edit-speaking-questions');
      if (speakingQuestionsEl) speakingQuestionsEl.innerHTML = p.speakingQuestions || '';
      
      const editorAudioUrl = p.audioUrl || '';
      document.getElementById('edit-audio-url').value = editorAudioUrl;
      window.renderListeningEditorPreview(editorAudioUrl);
      const editorAudio = document.getElementById('edit-listening-audio');
      const startInput = document.getElementById('edit-listening-start');
      if (startInput) startInput.value = String(Math.max(0, Number(p.listeningHighlightStart) || 0));
      karaokeEditorCueIndex = 0;
      const karaokeEditorAudio = document.getElementById('edit-listening-audio');
      if (karaokeEditorAudio) {
          karaokeEditorAudio.ontimeupdate = () => {
              const timeLabel = document.getElementById('karaoke-editor-time');
              if (timeLabel) timeLabel.textContent = formatKaraokeEditorTime(karaokeEditorAudio.currentTime);
          };
      }
      renderKaraokeEditorCues();
      
      const imgContainer = document.getElementById('part-image-preview-container');
      if (APP_DATA.module === 'writing') {
          imgContainer.innerHTML = '';
      } else if (p.image) {
          imgContainer.innerHTML = `<div class="absolute top-2 right-2 z-20"><button class="bg-rose-500 hover:bg-rose-600 text-white text-xs px-3 py-1.5 rounded-md shadow-md font-bold transition" onclick="event.stopPropagation(); removePartImage()">✕ Clear Image</button></div><img src="${p.image}" class="max-h-[200px] mx-auto block pointer-events-none select-none rounded-lg shadow-sm">`;
      } else {
          imgContainer.innerHTML = `<div class="text-slate-400 font-medium pointer-events-none my-8 flex flex-col items-center gap-2"><svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="text-slate-300"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect><circle cx="8.5" cy="8.5" r="1.5"></circle><polyline points="21 15 16 10 5 21"></polyline></svg> Paste or click to upload image</div>`;
      }
      
      const passTxt = document.getElementById('edit-passage-text');
      if(passTxt.tagName === 'TEXTAREA') passTxt.value = p.text||''; else passTxt.innerHTML = p.text||'';
      renderEditorQuestions();
      if (matchingHeadingDropsChanged) triggerEditorAutosave();

      if (typeof window.loadChartEditorUI === 'function') {
          window.loadChartEditorUI();
      }
    }

        function setTestPdfImportStatus(message, tone = 'info') {
            const el = document.getElementById('test-pdf-import-status');
            if (!el) return;
            const tones = {
                info: 'bg-blue-50 border-blue-200 text-blue-800',
                success: 'bg-emerald-50 border-emerald-200 text-emerald-800',
                error: 'bg-rose-50 border-rose-200 text-rose-800'
            };
            el.className = `mb-6 rounded-xl border px-4 py-3 text-sm font-medium ${tones[tone] || tones.info}`;
            el.textContent = message;
            el.classList.remove('hidden');
        }

        function detectPdfTestModule(text, fileName) {
            const source = `${fileName} ${text}`.toLowerCase();
            if (/listening|section\s*[1-4].*listen/.test(source)) return 'listening';
            if (/writing task|write at least|academic writing|general training writing/.test(source)) return 'writing';
            if (/speaking part|cue card|you will have to talk/.test(source)) return 'speaking';
            return 'reading';
        }

        function parsePdfAnswerKey(lines) {
            const answers = {};
            let inKey = false;
            lines.forEach(line => {
                if (/^(answer\s*key|answers?|key)\b/i.test(line)) {
                    inKey = true;
                    return;
                }
                if (!inKey) return;
                const matches = [...line.matchAll(/(?:^|\s)(\d{1,3})\s*[.)\-:]?\s*([A-Za-z][A-Za-z ]{0,24}?)(?=\s+\d{1,3}\s*[.)\-:]?|$)/g)];
                matches.forEach(match => {
                    const answer = match[2].trim().replace(/[.,;]+$/, '');
                    if (answer) answers[Number(match[1])] = answer;
                });
            });
            return answers;
        }

        function detectPdfQuestionType(questionText, options, context) {
            const source = `${context} ${questionText}`.toLowerCase();
            if (/true\s*\/\s*false\s*\/\s*not given|true,?\s*false,?\s*not given/.test(source)) return 'tfng';
            if (/yes\s*\/\s*no\s*\/\s*not given|yes,?\s*no,?\s*not given/.test(source)) return 'ynng';
            if (/matching headings|heading for each paragraph/.test(source)) return 'matching_headings';
            if (/no more than|complete the notes|complete the summary|fill in the blank|gap/.test(source)) return 'fill_blanks';
            if (options.length >= 2) return 'multiple_choice';
            return 'fill_blanks';
        }

        function normalizePdfLines(pdfText) {
            // Some PDF files expose the whole page as one text row. Split embedded question starts first.
            const separatedText = pdfText.replace(/\s+(?=(?:question\s*)?\d{1,3}\s*[.)\-:]\s)/gi, '\n');
            const rawLines = separatedText.split(/\r?\n/).map(line => line.replace(/[\u00a0\u200b]/g, ' ').replace(/\s+/g, ' ').trim()).filter(Boolean);
            const lines = [];
            for (let index = 0; index < rawLines.length; index++) {
                const line = rawLines[index];
                // PDF.js can place a question number and its text in separate text rows.
                if (/^(?:question\s*)?\d{1,3}$/.test(line.toLowerCase()) && rawLines[index + 1]) {
                    lines.push(`${line}. ${rawLines[++index]}`);
                } else {
                    lines.push(line);
                }
            }
            return lines;
        }

        function getPdfQuestionMatch(line) {
            const match = line.match(/^(?:question\s*|q\s*)?(\d{1,3})\s*(?:[.)\-:]\s*|\s+)(.+)$/i);
            if (!match) return null;
            const id = Number(match[1]);
            const text = match[2].trim();
            if (!text || id < 1 || id > 200) return null;
            return { id, text };
        }

        function parsePdfIntoTest(pdfText, fileName) {
            const lines = normalizePdfLines(pdfText);
            const answerKey = parsePdfAnswerKey(lines);
            const module = detectPdfTestModule(pdfText, fileName);
            const partRegex = /^(?:ielts\s+)?(?:part|section|test)\s*(\d+)(?:\s*[-:.)]\s*|\s+)(.*)$/i;
            const parts = [];
            let current = null;
            let pendingContext = '';
            let questionCount = 0;
            let maxQuestionId = 0;
            const ensurePart = () => {
                if (!current) {
                    current = { title: module === 'reading' ? 'Reading Passage 1' : 'Part 1', text: '', questions: [] };
                    parts.push(current);
                }
            };

            lines.forEach(line => {
                if (/^(answer\s*key|answers?|key)\b/i.test(line)) return;
                const partMatch = line.match(partRegex);
                if (partMatch) {
                    current = { title: `${partMatch[1] ? 'Part ' + partMatch[1] : 'Part'}${partMatch[2] ? ': ' + partMatch[2] : ''}`, text: '', questions: [] };
                    parts.push(current);
                    pendingContext = '';
                    return;
                }

                const questionMatch = getPdfQuestionMatch(line);
                if (questionMatch) {
                    ensurePart();
                    const id = questionMatch.id;
                    const questionText = questionMatch.text;
                    const options = [];
                    const type = detectPdfQuestionType(questionText, options, pendingContext);
                    const q = {
                        blockId: 'pdf_' + Date.now() + '_' + id + '_' + questionCount++,
                        type,
                        ids: [id],
                        points: 1,
                        instruction: pendingContext || 'Answer the question below.',
                        text: type === 'fill_blanks' ? `${questionText} {blank:${id}}` : questionText,
                        options,
                        correctAnswers: {}
                    };
                    if (answerKey[id]) q.correctAnswers[id] = answerKey[id];
                    current.questions.push(q);
                    maxQuestionId = Math.max(maxQuestionId, id);
                    pendingContext = '';
                    return;
                }

                const optionMatch = line.match(/^([A-D]|[ivxlcdm]+)[.)]\s*(.+)$/i);
                if (optionMatch && current && current.questions.length) {
                    const q = current.questions[current.questions.length - 1];
                    q.options.push(`${optionMatch[1].toUpperCase()}. ${optionMatch[2]}`);
                    if (q.type === 'fill_blanks' && q.options.length >= 2) q.type = 'multiple_choice';
                    return;
                }

                if (/^(instructions?|choose|complete|do the following|write|you should spend|questions?\s+\d+)/i.test(line)) {
                    pendingContext = pendingContext ? `${pendingContext}<br>${line}` : line;
                } else if (current && !/page\s+\d+/i.test(line)) {
                    current.text += `${current.text ? '<br>' : ''}${line}`;
                }
            });

            const usableParts = parts.filter(part => part.questions.length || part.text);
            if (!usableParts.some(part => part.questions.length)) throw new Error('Không tìm thấy câu hỏi có đánh số trong text của PDF.');
            usableParts.forEach((part, index) => {
                if (!part.title || /^Part\s*1$/i.test(part.title)) part.title = `Part ${index + 1}`;
                part.questions.forEach(q => {
                    if (!q.correctAnswers[q.ids[0]]) q.correctAnswers[q.ids[0]] = '';
                    if (q.type === 'tfng') q.options = ['True', 'False', 'Not Given'];
                    if (q.type === 'ynng') q.options = ['Yes', 'No', 'Not Given'];
                });
            });
            return { module, parts: usableParts, questionCount, maxQuestionId };
        }

        window.handleTestPdfImport = async function(event) {
            const file = event.target.files && event.target.files[0];
            event.target.value = '';
            if (!file) return;
            if (!window.pdfjsLib) {
                setTestPdfImportStatus('Không tải được PDF.js. Hãy kiểm tra kết nối mạng rồi thử lại.', 'error');
                return;
            }
            setTestPdfImportStatus(`Đang đọc ${file.name}...`, 'info');
            try {
                window.pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
                const pdf = await window.pdfjsLib.getDocument({ data: await file.arrayBuffer() }).promise;
                const pageTexts = [];
                for (let pageNo = 1; pageNo <= pdf.numPages; pageNo++) {
                    const page = await pdf.getPage(pageNo);
                    const content = await page.getTextContent();
                    const rows = [];
                    content.items.forEach(item => {
                        const y = Math.round(item.transform[5]);
                        let row = rows.find(candidate => Math.abs(candidate.y - y) <= 2);
                        if (!row) {
                            row = { y, items: [] };
                            rows.push(row);
                        }
                        row.items.push(item);
                    });
                    pageTexts.push(rows.sort((a, b) => b.y - a.y).map(row => row.items.sort((a, b) => a.transform[4] - b.transform[4]).map(item => item.str).join(' ')).join('\n'));
                }
                const extractedText = pageTexts.join('\n').trim();
                if (extractedText.length < 30) {
                    throw new Error('PDF này không có text layer hoặc là bản scan ảnh. Hãy dùng PDF có thể bôi đen/copy chữ; bản scan cần OCR trước khi import.');
                }
                const result = parsePdfIntoTest(extractedText, file.name);
                const imported = {
                    ...APP_DATA,
                    title: file.name.replace(/\.pdf$/i, '') || APP_DATA.title,
                    module: result.module,
                    parts: result.parts,
                    importedFromPdf: { name: file.name, pages: pdf.numPages, importedAt: Date.now() }
                };
                const testIndex = TEST_BANK.findIndex(test => test.id === editingTestId);
                if (testIndex < 0) throw new Error('Không xác định được test đang mở.');
                TEST_BANK[testIndex] = imported;
                APP_DATA = JSON.parse(JSON.stringify(imported));
                editTest(editingTestId);
                setTestPdfImportStatus(`Đã tạo ${result.questionCount} câu trong ${result.parts.length} part. Module nhận diện: ${result.module}. Hãy kiểm tra đáp án và format trước khi lưu.`, 'success');
            } catch (error) {
                console.error('PDF test import failed', error);
                setTestPdfImportStatus(error.message || 'Không thể phân tích PDF.', 'error');
            }
        };

    // ✨ NEW: Smart Range Parsers
    window.parseIdsString = function(str) {
        let ids = [];
        str.split(',').forEach(part => {
            if (part.includes('-')) {
                const [start, end] = part.split('-').map(n => Number(n.trim()));
                if (!isNaN(start) && !isNaN(end) && start <= end) {
                    for (let j = start; j <= end; j++) ids.push(j);
                }
            } else {
                const n = Number(part.trim());
                if (!isNaN(n)) ids.push(n);
            }
        });
        return [...new Set(ids)].sort((a,b)=>a-b);
    };

    window.formatIdsString = function(ids) {
        if (!ids || ids.length === 0) return '';
        let sorted = [...new Set(ids)].sort((a,b) => a - b);
        let ranges = [];
        let start = sorted[0];
        let prev = sorted[0];

        for (let i = 1; i <= sorted.length; i++) {
            if (sorted[i] === prev + 1) {
                prev = sorted[i];
            } else {
                if (start === prev) ranges.push(start);
                else if (start + 1 === prev) ranges.push(`${start}, ${prev}`);
                else ranges.push(`${start}-${prev}`);
                start = sorted[i];
                prev = sorted[i];
            }
        }
        return ranges.join(', ');
    };

    window.expandOptionsArray = function(arr) {
        if (!arr || arr.length === 0) return [];
        if (arr.length === 1) {
            const match = arr[0].match(/^([A-Za-z])\s*-\s*([A-Za-z])$/);
            if (match) {
                const start = match[1].toUpperCase().charCodeAt(0);
                const end = match[2].toUpperCase().charCodeAt(0);
                if (start <= end) {
                    let expanded = [];
                    for(let c = start; c <= end; c++) expanded.push(String.fromCharCode(c));
                    return expanded;
                }
            }
        }
        return arr;
    };

    function getEditorLocateSegments(part, module) {
        if (module === 'listening') {
            return getListeningCues(part).map((cue, index) => ({ index, text: cue.text }));
        }
        if (module !== 'reading') return [];

        const passageHtml = (part.text || '').split('\n\n')
            .map(paragraph => paragraph.trim() ? `<p>${paragraph}</p>` : '')
            .join('');
        const holder = document.createElement('div');
        holder.innerHTML = passageHtml;
        return Array.from(holder.querySelectorAll('p'))
            .map(paragraph => paragraph.textContent.trim())
            .filter(Boolean)
            .map((text, index) => ({ index, text }));
    }

    function escapeLocateOption(value) {
        return String(value || '').replace(/[&<>"']/g, character => ({
            '&': '&amp;',
            '<': '&lt;',
            '>': '&gt;',
            '"': '&quot;',
            "'": '&#39;'
        })[character]);
    }

    window.assignLocateSelection = function(questionIndex, event) {
        if (event) event.stopPropagation();
        const editor = document.getElementById('edit-passage-text');
        const selection = window.getSelection();
        const selectedText = selection ? selection.toString().replace(/\s+/g, ' ').trim() : '';
        const range = selection && selection.rangeCount ? selection.getRangeAt(0) : null;
        if (!editor || !range || !selectedText || !editor.contains(range.commonAncestorContainer)) {
            if (typeof window.showToast === 'function') {
                window.showToast('Chưa chọn vị trí', 'Hãy bôi đen một đoạn trong passage/script trước.', 'info');
            }
            return;
        }

        saveCurrentEditorPart();
        const part = APP_DATA.parts[currentEditorPartIdx];
        const question = part && part.questions[questionIndex];
        if (!question) return;
        const normalizedSelection = selectedText.replace(/\s+/g, ' ').toLocaleLowerCase();
        const segment = getEditorLocateSegments(part, APP_DATA.module).find(item =>
            item.text.replace(/\s+/g, ' ').toLocaleLowerCase().includes(normalizedSelection)
        );
        if (!segment) {
            if (typeof window.showToast === 'function') {
                window.showToast(
                    'Vị trí chưa hợp lệ',
                    `Hãy chọn đoạn nằm trong một ${APP_DATA.module === 'reading' ? 'paragraph' : 'câu script'} duy nhất.`,
                    'error'
                );
            }
            return;
        }
        question.locateText = selectedText;
        question.locateIndex = segment.index;

        const status = document.getElementById(`locate-assignment-${questionIndex}`);
        if (status) {
            status.textContent = `Đã gán: “${selectedText}”`;
            status.title = selectedText;
        }
        if (typeof window.triggerEditorAutosave === 'function') window.triggerEditorAutosave();
    };

    window.clearLocateSelection = function(questionIndex, event) {
        if (event) event.stopPropagation();
        saveCurrentEditorPart();
        const question = APP_DATA.parts[currentEditorPartIdx]?.questions?.[questionIndex];
        if (!question) return;
        delete question.locateText;
        delete question.locateIndex;
        const status = document.getElementById(`locate-assignment-${questionIndex}`);
        if (status) {
            status.textContent = 'Chưa gán vị trí (Locate tự động)';
            status.title = '';
        }
        if (typeof window.triggerEditorAutosave === 'function') window.triggerEditorAutosave();
    };

    function renderEditorQuestions() {
      const list = document.getElementById('editor-questions-list'); list.innerHTML = '';
      const part = APP_DATA.parts[currentEditorPartIdx];
      const locateSegments = getEditorLocateSegments(part, APP_DATA.module);
      const questionTypeOptions = {
        reading: [
          ['multiple_choice', 'Multiple Choice'],
          ['fill_blanks', 'Gap Fill'],
          ['dnd_list', 'Drag/Drop'],
          ['tfng', 'True / False / Not Given'],
          ['ynng', 'Yes / No / Not Given'],
          ['matching_headings', 'Matching Headings'],
          ['matching_info', 'Matching Information'],
          ['matching_endings', 'Matching Sentence Endings'],
          ['map_labelling_hotspots', 'Map Hotspots'],
          ['map_labelling_grid', 'Map Grid']
        ],
        listening: [
          ['multiple_choice', 'Multiple Choice'],
          ['fill_blanks', 'Gap Fill'],
          ['dnd_list', 'Drag/Drop'],
          ['tfng', 'True / False / Not Given'],
          ['ynng', 'Yes / No / Not Given'],
          ['map_labelling_hotspots', 'Map Hotspots'],
          ['map_labelling_grid', 'Map Grid']
        ],
        writing: [['essay', 'Writing Essay']],
        speaking: [['audio_record', 'Audio Recording'], ['essay', 'Notes / Text']],
        activity: [
          ['pair_roleplay', 'Pair Roleplay'],
          ['group_debate', 'Group Debate'],
          ['vocab_game', 'Vocabulary Game']
        ]
      }[APP_DATA.module] || [];
      part.questions.forEach((q, i) => {
        const div = document.createElement('div'); 
        div.className = 'bg-white rounded-xl border border-slate-200 shadow-sm relative transition-all hover:shadow-md overflow-hidden';
        const esc = s => (s||'').replace(/"/g,'&quot;');
        const formatArr = a => (a||[]).map(value => q.latexSource ? String(value).replace(/[&<>]/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;'}[char])) : value).join('\n');
        const mkLbl = (t) => `<label class="block text-[11px] font-black text-slate-500 uppercase tracking-widest mb-1.5 mt-4 first:mt-0">${t}</label>`;
        
        const mkStandardToolbar = () => `<div class="sticky top-[72px] z-10 flex flex-wrap gap-1.5 bg-slate-100 px-3 py-2 rounded-t-lg border border-slate-300 w-full shadow-md">
            <button type="button" onmousedown="event.preventDefault(); window.execCmd('bold')" class="px-2.5 py-1 bg-white hover:bg-slate-200 text-slate-700 border border-slate-200 shadow-sm text-xs font-bold rounded transition">B</button>
            <button type="button" onmousedown="event.preventDefault(); window.execCmd('italic')" class="px-2.5 py-1 bg-white hover:bg-slate-200 text-slate-700 border border-slate-200 shadow-sm text-xs italic rounded transition">I</button>
            <button type="button" onmousedown="event.preventDefault(); window.execCmd('underline')" class="px-2.5 py-1 bg-white hover:bg-slate-200 text-slate-700 border border-slate-200 shadow-sm text-xs underline rounded transition">U</button>
            <div class="w-px h-5 bg-slate-300 mx-1 self-center"></div>
            <button type="button" onmousedown="event.preventDefault(); window.execCmd('insertUnorderedList')" class="px-2.5 py-1 bg-white hover:bg-slate-200 text-slate-700 border border-slate-200 shadow-sm text-xs font-bold rounded transition">• List</button>
            <button type="button" onmousedown="event.preventDefault(); window.execCmd('insertOrderedList')" class="px-2.5 py-1 bg-white hover:bg-slate-200 text-slate-700 border border-slate-200 shadow-sm text-xs font-bold rounded transition">1. List</button>
            <div class="w-px h-5 bg-slate-300 mx-1 self-center"></div>
            <button type="button" onmousedown="event.preventDefault(); window.insertGap('blank', ${i})" class="px-2.5 py-1 bg-blue-50 border border-blue-200 hover:bg-blue-100 text-blue-700 text-xs font-bold rounded shadow-sm transition" title="Insert Gap Fill Blank">{_} Blank</button>
            <button type="button" onmousedown="event.preventDefault(); window.insertGap('drop', ${i})" class="px-2.5 py-1 bg-indigo-50 border border-indigo-200 hover:bg-indigo-100 text-indigo-700 text-xs font-bold rounded shadow-sm transition" title="Insert Drag & Drop Gap">[↓] Drop</button>
        </div>`;

        const mkTemplateToolbar = (editorId) => {
            const defaultTemplateId = TEACHER_TEMPLATE_ASSIGNMENTS[getTemplateAssignmentKey(APP_DATA.module, q.type)];
            const tplOpts = TEACHER_TEMPLATES.map(t => `<option value="${t.id}">${t.name}${t.id === defaultTemplateId ? ' (Assigned default)' : ''}</option>`).join('');
            const defaultTemplate = TEACHER_TEMPLATES.find(t => t.id === defaultTemplateId);
            return `<div class="sticky top-[72px] z-10 flex flex-wrap gap-1.5 bg-slate-100 px-3 py-2 rounded-t-lg border border-slate-300 w-full shadow-md">
                <button type="button" onmousedown="event.preventDefault(); window.execCmd('bold')" class="px-2.5 py-1 bg-white hover:bg-slate-200 text-slate-700 border border-slate-200 shadow-sm text-xs font-bold rounded transition">B</button>
                <button type="button" onmousedown="event.preventDefault(); window.execCmd('italic')" class="px-2.5 py-1 bg-white hover:bg-slate-200 text-slate-700 border border-slate-200 shadow-sm text-xs italic rounded transition">I</button>
                <button type="button" onmousedown="event.preventDefault(); window.execCmd('underline')" class="px-2.5 py-1 bg-white hover:bg-slate-200 text-slate-700 border border-slate-200 shadow-sm text-xs underline rounded transition">U</button>
                <div class="w-px h-5 bg-slate-300 mx-1 self-center"></div>
                <select onchange="window.insertCustomTemplate('${editorId}', this.value); this.value='';" class="border border-slate-300 rounded-lg px-2 py-1 text-xs outline-none bg-white font-bold text-emerald-700 shadow-sm cursor-pointer hover:border-emerald-500 transition flex-1 sm:flex-none">
                    <option value="">+ Chèn Form Mẫu...${defaultTemplate ? ` (Default: ${defaultTemplate.name})` : ''}</option>
                    ${tplOpts}
                </select>
                <div class="w-px h-5 bg-slate-300 mx-1 self-center"></div>
                <button type="button" onmousedown="event.preventDefault(); window.insertVideo()" class="px-2.5 py-1 bg-rose-50 border border-rose-200 hover:bg-rose-100 text-rose-700 text-xs font-bold rounded shadow-sm transition" title="Insert Local Video File">🎥 Video</button>
            </div>`;
        };
        
        const editorId = `rich-text-${i}`;
        const advToolbar = `<div class="sticky top-[72px] z-10 flex flex-wrap gap-1.5 bg-slate-100 px-3 py-2 rounded-t-lg border border-slate-300 w-full shadow-md">
            <button type="button" onmousedown="event.preventDefault(); window.execCmd('bold')" class="px-2.5 py-1 bg-white hover:bg-slate-200 text-slate-700 border border-slate-200 shadow-sm text-xs font-bold rounded transition">B</button>
            <button type="button" onmousedown="event.preventDefault(); window.execCmd('italic')" class="px-2.5 py-1 bg-white hover:bg-slate-200 text-slate-700 border border-slate-200 shadow-sm text-xs italic rounded transition">I</button>
            <button type="button" onmousedown="event.preventDefault(); window.execCmd('underline')" class="px-2.5 py-1 bg-white hover:bg-slate-200 text-slate-700 border border-slate-200 shadow-sm text-xs underline rounded transition">U</button>
            <div class="w-px h-5 bg-slate-300 mx-1 self-center"></div>
            <button type="button" onmousedown="event.preventDefault(); window.execCmd('insertUnorderedList')" class="px-2.5 py-1 bg-white hover:bg-slate-200 text-slate-700 border border-slate-200 shadow-sm text-xs font-bold rounded transition">• List</button>
            <button type="button" onmousedown="event.preventDefault(); window.execCmd('insertOrderedList')" class="px-2.5 py-1 bg-white hover:bg-slate-200 text-slate-700 border border-slate-200 shadow-sm text-xs font-bold rounded transition">1. List</button>
            <div class="w-px h-5 bg-slate-300 mx-1 self-center"></div>
            <button type="button" onmousedown="event.preventDefault(); window.insertGap('blank', ${i})" class="px-2.5 py-1 bg-blue-50 border border-blue-200 hover:bg-blue-100 text-blue-700 text-xs font-bold rounded shadow-sm transition">{_} Blank</button>
            <button type="button" onmousedown="event.preventDefault(); window.insertGap('drop', ${i})" class="px-2.5 py-1 bg-indigo-50 border border-indigo-200 hover:bg-indigo-100 text-indigo-700 text-xs font-bold rounded shadow-sm transition">[↓] Drop</button>
            <div class="w-px h-5 bg-slate-300 mx-1 self-center"></div>
            <button type="button" onmousedown="event.preventDefault(); window.insertVisualTemplate('${editorId}', 'table', '${q.type}')" class="px-2.5 py-1 bg-white hover:bg-slate-200 text-slate-700 border border-slate-200 shadow-sm text-xs font-bold rounded transition">▦ Table</button>
            <button type="button" onmousedown="event.preventDefault(); window.insertVisualTemplate('${editorId}', 'flow', '${q.type}')" class="px-2.5 py-1 bg-white hover:bg-slate-200 text-slate-700 border border-slate-200 shadow-sm text-xs font-bold rounded transition">↓ Flow</button>
        </div>`;
        
        let html = `
        <div class="bg-slate-50/80 border-b border-slate-200 px-5 py-3 flex justify-between items-center">
            <div class="flex items-center gap-3">
                <span class="bg-blue-100 text-blue-800 font-black text-[10px] px-2.5 py-1 rounded-md uppercase tracking-wider shadow-sm">Block ${i+1}</span>
                <span class="text-sm font-bold text-slate-700 capitalize">${q.questionFormat === 'matching_sentence_endings' ? 'matching sentence endings' : q.type.replace(/_/g, ' ')}</span>
            </div>
            <div class="flex gap-2">
                ${i > 0 ? `<button onclick="moveEditorQuestion(${i}, -1)" class="w-7 h-7 flex items-center justify-center bg-white border border-slate-200 rounded hover:bg-blue-50 hover:text-blue-600 text-slate-500 font-bold transition shadow-sm" title="Move Up">↑</button>` : ''}
                ${i < APP_DATA.parts[currentEditorPartIdx].questions.length - 1 ? `<button onclick="moveEditorQuestion(${i}, 1)" class="w-7 h-7 flex items-center justify-center bg-white border border-slate-200 rounded hover:bg-blue-50 hover:text-blue-600 text-slate-500 font-bold transition shadow-sm" title="Move Down">↓</button>` : ''}
                <select onchange="window.changeEditorQuestionType(${i}, this.value)" class="h-7 max-w-[140px] border border-slate-200 rounded bg-white px-1 text-[11px] font-bold text-indigo-700 shadow-sm cursor-pointer" title="Change this question type">
                    ${questionTypeOptions.map(([type, label]) => `<option value="${type}" ${type === (q.questionFormat === 'matching_sentence_endings' ? 'matching_endings' : q.type) ? 'selected' : ''}>⇄ ${label}</option>`).join('')}
                </select>
                <div class="w-px h-7 bg-slate-300 mx-1"></div>
                <button onclick="window.cloneEditorQuestion(${i})" class="w-7 h-7 flex items-center justify-center bg-white border border-slate-200 rounded hover:bg-emerald-50 hover:text-emerald-600 text-slate-500 font-bold transition shadow-sm" title="Duplicate Block">⧉</button>
                <div class="w-px h-7 bg-slate-300 mx-1"></div>
                <button onclick="APP_DATA.parts[currentEditorPartIdx].questions.splice(${i},1); renderEditorQuestions(); triggerEditorAutosave();" class="w-7 h-7 flex items-center justify-center bg-rose-50 border border-rose-200 rounded hover:bg-rose-500 hover:text-white text-rose-500 font-bold transition shadow-sm" title="Delete Block">✕</button>
            </div>
        </div>
        <div class="p-5 flex flex-col gap-1">`;
        
        const isHotspot = q.type === 'map_labelling_hotspots';
        const baseInputClass = "border-2 border-slate-200 p-2.5 rounded-lg text-sm font-medium text-slate-800 outline-none focus:border-blue-500 transition-colors w-full";
        const answerInputClass = "border-2 border-emerald-200 bg-emerald-50 p-2.5 rounded-lg text-sm font-bold text-emerald-900 outline-none focus:border-emerald-500 transition-colors w-full shadow-inner";

        // ✨ FIX: Points are auto-locked to the number of IDs for all types except Essays/Speaking
        const isAutoPoints = !['essay', 'audio_record', 'vocab_game', 'pair_roleplay', 'group_debate'].includes(q.type);

        html += `<div class="grid grid-cols-2 gap-4 mb-2">
                    <div>${mkLbl('IDs (csv/range)')}<input type="text" class="q-ids ${baseInputClass} font-mono ${isHotspot ? 'bg-slate-100 text-slate-500' : ''}" value="${window.formatIdsString(q.ids)}" ${isHotspot ? 'readonly title="Auto-generated from map hotspots"' : ''} placeholder="e.g. 1-5"></div>
                    <div>${mkLbl('Points')}<input type="number" class="q-points ${baseInputClass} ${isAutoPoints ? 'bg-slate-100 text-slate-500 cursor-not-allowed' : ''}" value="${q.points||1}" ${isAutoPoints ? 'readonly title="Auto-calculated based on number of Question IDs"' : ''}></div>
                 </div>`;
                 
        html += `<div>${mkLbl('Instruction')}${mkStandardToolbar()}<div class="q-inst rich-editor w-full border border-slate-300 bg-white p-3 rounded-b-lg min-h-[70px] focus-within:ring-2 focus-within:ring-blue-500/20 focus-within:border-blue-500 transition-all outline-none" contenteditable="true" oninput="window.triggerEditorAutosave()">${q.instruction||''}</div></div>`;

        const hasDedicatedMapImage = q.type === 'map_labelling_grid' || q.type === 'map_labelling_hotspots';
        if (APP_DATA.module === 'listening' && !hasDedicatedMapImage) {
            html += `<div>${mkLbl('Question Image (Upload, Paste, or Image Link)')}
                <input type="url" value="${escapeHtmlAttributeValue(q.image)}" placeholder="Paste a direct image URL here..." class="${baseInputClass} mb-2 !p-2 !text-blue-600 font-mono shadow-sm" onchange="window.setListeningQuestionImageUrl(${i}, this.value)">
                <div class="relative border-2 border-dashed border-slate-300 bg-slate-50 hover:bg-blue-50 transition flex flex-col items-center justify-center min-h-[100px] cursor-pointer focus:outline-none focus:ring-2 focus:ring-blue-500 overflow-hidden rounded-xl" tabindex="0" onclick="window.handleListeningQuestionImageClick(event, ${i})" onpaste="window.handleListeningQuestionImagePaste(event, ${i})">
                    ${q.image ? `<div class="absolute top-2 right-2 z-20"><button type="button" class="bg-rose-500 hover:bg-rose-600 text-white text-xs font-bold px-3 py-1.5 rounded-md shadow" onclick="event.stopPropagation(); window.removeListeningQuestionImage(${i})">✕ Clear Image</button></div><img src="${escapeHtmlAttributeValue(q.image)}" alt="Question image" class="max-w-full max-h-[240px] object-contain block pointer-events-none select-none rounded-lg">` : `<div class="text-slate-500 font-medium pointer-events-none py-6">Paste an image here or click to upload</div>`}
                </div>
                <input type="file" id="listening-question-image-file-${i}" class="hidden" accept="image/*" onchange="window.handleListeningQuestionImageFile(event, ${i})">
            </div>`;
        }
        
        if (q.type === 'multiple_choice' || q.type === 'tfng' || q.type === 'ynng') {
           html += `<div>${mkLbl('Question Text')}${mkStandardToolbar()}<div class="q-text rich-editor w-full border border-slate-300 bg-white p-4 rounded-b-lg min-h-[120px] focus-within:ring-2 focus-within:ring-blue-500/20 focus-within:border-blue-500 transition-all outline-none" contenteditable="true" oninput="window.triggerEditorAutosave()">${q.text||''}</div></div>`;
           if(q.type === 'multiple_choice') {
               html += `<div>${mkLbl('Options (1/line)')}<textarea class="q-opts ${baseInputClass} min-h-[100px]">${formatArr(q.options)}</textarea></div>`;
               html += `<div class="mt-1 mb-2"><label class="flex items-center text-sm font-bold text-slate-700 cursor-pointer bg-slate-50 border border-slate-200 px-4 py-3 rounded-lg hover:bg-slate-100 transition"><input type="checkbox" class="q-multi mr-3 w-4 h-4 text-blue-600 rounded" ${q.multi ? 'checked' : ''} onchange="APP_DATA.parts[currentEditorPartIdx].questions[${i}].multi = this.checked; saveCurrentEditorPart(); renderEditorQuestions();"> Allow multiple selections (Checkboxes)</label></div>`;
               if (q.multi) {
                   html += `<div>${mkLbl('Answers (ID:Ans) — Use / for multiple valid')}<textarea class="q-correct ${answerInputClass} min-h-[80px]">${q.ids.map(id => `${id}:${q.correctAnswers?.[id]||''}`).join('\n')}</textarea></div>`;
               } else if (q.ids.length > 1) {
                   html += `<div>${mkLbl('Answers (ID:Ans)')}<textarea class="q-correct ${answerInputClass} min-h-[80px]">${q.ids.map(id => `${id}:${q.correctAnswers?.[id]||''}`).join('\n')}</textarea></div>`;
               } else {
                   html += `<div>${mkLbl('Correct Answer (Use / for multiple valid)')}<input type="text" class="q-correct ${answerInputClass}" value="${esc(q.correctAnswers?.[q.ids[0]])}"></div>`;
               }
           } else {
               if (q.ids.length > 1) {
                   html += `<div>${mkLbl('Answers (ID:Ans)')}<textarea class="q-correct ${answerInputClass} min-h-[80px]">${q.ids.map(id => `${id}:${q.correctAnswers?.[id]||''}`).join('\n')}</textarea></div>`;
               } else {
                   html += `<div>${mkLbl('Correct Answer (Use / for multiple valid)')}<input type="text" class="q-correct ${answerInputClass}" value="${esc(q.correctAnswers?.[q.ids[0]])}"></div>`;
               }
           }
        } else if (q.type === 'essay' || q.type === 'audio_record') {
        } else if (q.type === 'matching_info') {
           html += `<div>${mkLbl('Row Statements (1/line)')}<textarea class="q-text ${baseInputClass} min-h-[100px]">${q.text||''}</textarea></div>`;
           html += `<div>${mkLbl('Columns / Options (1/line)')}<textarea class="q-opts ${baseInputClass} min-h-[100px]">${formatArr(q.options)}</textarea></div>`;
           html += `<div>${mkLbl('Answers (ID:Ans)')}<textarea class="q-correct ${answerInputClass} min-h-[100px]">${q.ids.map(id => `${id}:${q.correctAnswers?.[id]||''}`).join('\n')}</textarea></div>`;
        } else if (q.type === 'map_labelling_hotspots') {
           html += `<div>${mkLbl('Map Image (Upload or Paste URL)')}`;
           
           // ✨ FIX: URL input fallback for Hotspots Image
           html += `<input type="text" placeholder="Or paste direct image URL here..." class="${baseInputClass} mb-2 !p-2 !text-blue-600 font-mono shadow-sm" onchange="if(this.value){ APP_DATA.parts[currentEditorPartIdx].questions[${i}].image = this.value; window.saveCurrentEditorPart(); renderEditorQuestions(); window.triggerEditorAutosave(); }">`;
           
           html += `<div class="relative border-2 border-dashed border-slate-400 bg-slate-50 hover:bg-blue-50 transition mt-1 mb-4 flex flex-col items-center justify-center min-h-[160px] cursor-pointer focus:outline-none focus:ring-2 focus:ring-blue-500 overflow-hidden rounded-xl" tabindex="0" onclick="handleMapClick(event, ${i})" onpaste="handleMapPaste(event, ${i})">
                        ${q.image ? `<div class="absolute top-2 right-2 z-20"><button class="bg-rose-500 hover:bg-rose-600 text-white text-xs font-bold px-3 py-1.5 rounded-md shadow" onclick="event.stopPropagation(); removeMapImage(${i})">✕ Clear</button></div><img src="${q.image}" class="max-w-full w-auto block pointer-events-none select-none" id="map-img-${i}">` : `<div class="text-slate-500 font-medium pointer-events-none my-8">Paste or click to upload map image</div>`}
                        ${(q.hotspots || []).map(h => `<div class="absolute bg-white border-2 border-blue-600 rounded flex items-center justify-center text-xs font-bold text-blue-900 shadow-md cursor-pointer hover:bg-rose-100 hover:border-rose-500 transition-colors z-10" style="left:${h.x}%; top:${h.y}%; transform:translate(-50%,-50%); width:32px; height:32px;" onclick="removeHotspot(event, ${i}, ${h.id})" title="Click to remove gap ${h.id}">${h.id}</div>`).join('')}
                    </div></div>`;
           html += `<input type="file" id="map-file-${i}" class="hidden" accept="image/*" onchange="handleMapFile(event, ${i})">`;
           html += `<div>${mkLbl('Map Options / Labels (1/line)')}<textarea class="q-opts ${baseInputClass} min-h-[100px]" placeholder="e.g. Cookery room\nGames room">${formatArr(q.options)}</textarea></div>`;
           html += `<div>${mkLbl('Answers (ID:Ans)')}<textarea class="q-correct ${answerInputClass} min-h-[100px]">${q.ids.map(id => `${id}:${q.correctAnswers?.[id]||''}`).join('\n')}</textarea></div>`;
        } else if (q.type === 'map_labelling_grid') {
           html += `<div class="flex flex-col lg:flex-row gap-6 w-full mb-2">`;
           
           // LEFT SIDE: Map Image Dropzone
           html += `<div class="w-full lg:w-1/2 flex flex-col">`;
           html += `${mkLbl('Map Image (Upload or Paste URL)')}`;
           
           // ✨ FIX: URL input fallback for Grid Image
           html += `<input type="text" placeholder="Or paste direct image URL here..." class="${baseInputClass} mb-2 !p-2 !text-blue-600 font-mono shadow-sm" onchange="if(this.value){ APP_DATA.parts[currentEditorPartIdx].questions[${i}].image = this.value; window.saveCurrentEditorPart(); renderEditorQuestions(); window.triggerEditorAutosave(); }">`;
           
           html += `<div class="relative border-2 border-dashed border-slate-400 bg-slate-50 hover:bg-blue-50 transition mt-1 flex flex-col items-center justify-center min-h-[220px] h-full cursor-pointer focus:outline-none focus:ring-2 focus:ring-blue-500 overflow-hidden rounded-xl" tabindex="0" onclick="handleMapClick(event, ${i})" onpaste="handleMapPaste(event, ${i})">
                        ${q.image ? `<div class="absolute top-2 right-2 z-20"><button class="bg-rose-500 hover:bg-rose-600 text-white text-xs font-bold px-3 py-1.5 rounded-md shadow" onclick="event.stopPropagation(); removeMapImage(${i})">✕ Clear</button></div><img src="${q.image}" class="max-w-[100%] max-h-[250px] w-auto object-contain block pointer-events-none select-none" id="map-img-${i}">` : `<div class="text-slate-500 font-medium pointer-events-none my-4 flex flex-col items-center gap-2"><svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="text-slate-300"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect><circle cx="8.5" cy="8.5" r="1.5"></circle><polyline points="21 15 16 10 5 21"></polyline></svg> Paste or click map image</div>`}
                    </div>`;
           html += `<input type="file" id="map-file-${i}" class="hidden" accept="image/*" onchange="handleMapFile(event, ${i})">`;
           html += `</div>`;
           
           // RIGHT SIDE: Texts
           html += `<div class="w-full lg:w-1/2 flex flex-col justify-between">`;
           html += `<div>${mkLbl('Row Statements (1/line matching IDs)')}<textarea class="q-text ${baseInputClass} min-h-[80px]" placeholder="e.g. Quilt Shop\nHandicrafts Museum">${q.text||''}</textarea></div>`;
           html += `<div class="mt-2">${mkLbl('Columns / Map Letters (1/line)')}<textarea class="q-opts ${baseInputClass} min-h-[70px]" placeholder="e.g. A\nB\nC\nD">${formatArr(q.options)}</textarea></div>`;
           html += `<div class="mt-2">${mkLbl('Answers (ID:Ans)')}<textarea class="q-correct ${answerInputClass} min-h-[70px]">${q.ids.map(id => `${id}:${q.correctAnswers?.[id]||''}`).join('\n')}</textarea></div>`;
           html += `</div>`;
           
           html += `</div>`;
        } else if (q.type === 'pair_roleplay') {
           html += `<div>${mkLbl('Student A Role')}<textarea class="q-text ${baseInputClass} min-h-[100px]" placeholder="Describe the scenario for Student A...">${q.text||''}</textarea></div>`;
           html += `<div>${mkLbl('Student B Role')}<textarea class="q-hint ${baseInputClass} min-h-[100px]" placeholder="Describe the scenario for Student B...">${q.hint||''}</textarea></div>`;
        } else if (q.type === 'group_debate') {
           html += `<div>${mkLbl('Debate Motion / Topic')}<textarea class="q-inst ${baseInputClass} min-h-[60px]" placeholder="e.g. Social media does more harm than good.">${q.instruction||''}</textarea></div>`;
           html += `<div class="grid grid-cols-2 gap-4">`;
           html += `<div>${mkLbl('Affirmative (For) Points')}<textarea class="q-text ${baseInputClass} min-h-[100px]">${q.text||''}</textarea></div>`;
           html += `<div>${mkLbl('Negative (Against) Points')}<textarea class="q-hint ${baseInputClass} min-h-[100px]">${q.hint||''}</textarea></div>`;
           html += `</div>`;
        } else if (q.type === 'vocab_game') {
           html += `<div class="p-5 bg-fuchsia-50 border border-fuchsia-200 rounded-xl text-fuchsia-800 text-[15px] font-medium flex items-center gap-4 shadow-inner"><span class="text-4xl drop-shadow-sm">🎲</span> <p>This block automatically generates a multiplayer Vocabulary Board Game using the words in the <b>Test Vocabulary Bank</b> (click the 🗂️ icon in the top right to add words).</p></div>`;
        } else {
           const optionsLabel = q.questionFormat === 'matching_sentence_endings' ? 'Sentence Endings / Options (1 per line)' : 'Options Bank (1/line)';
           if (q.type === 'fill_blanks' || q.type === 'dnd_list') {
               const textLabel = q.questionFormat === 'matching_sentence_endings' ? 'Sentence Beginnings and Drop Zones' : 'Passage Text With Gaps';
               html += `<div>${mkLbl(textLabel)}${advToolbar}<div id="${editorId}" class="q-text rich-editor w-full border border-slate-300 bg-white p-4 rounded-b-lg min-h-[120px] focus-within:ring-2 focus-within:ring-blue-500/20 focus-within:border-blue-500 transition-all outline-none" contenteditable="true" oninput="window.triggerEditorAutosave()">${q.text||''}</div></div>`;
           } else {
               html += `<div>${mkLbl('Text')}${mkStandardToolbar()}<div class="q-text rich-editor w-full border border-slate-300 bg-white p-4 rounded-b-lg min-h-[120px] focus-within:ring-2 focus-within:ring-blue-500/20 focus-within:border-blue-500 transition-all outline-none" contenteditable="true" oninput="window.triggerEditorAutosave()">${q.text||''}</div></div>`;
           }
           
           if (q.type !== 'fill_blanks') {
               html += `<div>${mkLbl(optionsLabel || 'Options Bank (1/line)')}<textarea class="q-opts ${baseInputClass} min-h-[80px]">${formatArr(q.options)}</textarea></div>`;
           }
           const answerLabel = q.questionFormat === 'matching_sentence_endings' ? 'Correct Ending for Each Question (ID: exact option text)' : 'Answers (ID:Ans)';
           html += `<div>${mkLbl(answerLabel)}<textarea class="q-correct ${answerInputClass} min-h-[80px]">${q.ids.map(id => `${id}:${q.correctAnswers?.[id]||''}`).join('\n')}</textarea></div>`;
           if (q.type === 'dnd_list' || q.type === 'matching_headings') {
              html += `<div class="mt-1 mb-2"><label class="flex items-center text-sm font-bold text-slate-700 cursor-pointer bg-slate-50 border border-slate-200 px-4 py-3 rounded-lg hover:bg-slate-100 transition"><input type="checkbox" class="q-reus mr-3 w-4 h-4 text-blue-600 rounded" ${q.reusable ? 'checked' : ''}> Options are Reusable (can be used multiple times)</label></div>`;
           }
        }
        
        if (!['pair_roleplay', 'group_debate', 'vocab_game'].includes(q.type)) {
            html += `<div>${mkLbl('Kỹ thuật làm bài / Hint (Optional - Shows as a 💡 Hint button during Practice Mode)')}${mkTemplateToolbar(`hint-editor-${i}`)}<div id="hint-editor-${i}" class="q-hint rich-editor w-full border border-slate-300 bg-white p-3 rounded-b-lg min-h-[60px] focus-within:ring-2 focus-within:ring-blue-500/20 focus-within:border-blue-500 transition-all outline-none" contenteditable="true" oninput="window.triggerEditorAutosave()">${q.hint||''}</div></div>`;
            html += `<div>${mkLbl('Giải thích đáp án (Optional - Only shows in Detailed Review)')}${mkTemplateToolbar(`expl-editor-${i}`)}<div id="expl-editor-${i}" class="q-expl rich-editor w-full border border-slate-300 bg-white p-3 rounded-b-lg min-h-[80px] focus-within:ring-2 focus-within:ring-blue-500/20 focus-within:border-blue-500 transition-all outline-none" contenteditable="true" oninput="window.triggerEditorAutosave()">${q.explanation||''}</div></div>`;
        } 
        if (['reading', 'listening'].includes(APP_DATA.module)) {
            const assignedText = q.locateText
                ? `Đã gán: “${escapeLocateOption(q.locateText)}”`
                : 'Chưa gán vị trí (Locate tự động)';
            html += `<div class="mt-4 p-4 bg-blue-50 border border-blue-200 rounded-xl">
                ${mkLbl(`Gán vị trí Locate (${APP_DATA.module === 'reading' ? 'passage' : 'script'})`)}
                <div class="flex flex-wrap items-center gap-2">
                    <button type="button" onmousedown="event.preventDefault()" onclick="window.assignLocateSelection(${i}, event)" class="px-3 py-2 text-xs font-bold text-white bg-blue-700 hover:bg-blue-800 rounded-lg shadow-sm">Gán đoạn đang bôi đen</button>
                    <button type="button" onclick="window.clearLocateSelection(${i}, event)" class="px-3 py-2 text-xs font-bold text-slate-700 bg-white hover:bg-slate-100 border border-slate-300 rounded-lg">Xóa gán</button>
                    <span id="locate-assignment-${i}" class="text-xs text-slate-700 break-words">${assignedText}</span>
                </div>
                <p class="text-xs text-slate-600 mt-2">Bôi đen chính xác phần passage/script ở khung bên trên, sau đó bấm “Gán đoạn đang bôi đen”. Học sinh bấm Locate sẽ tới và thấy phần đã gán.</p>
            </div>`;
        }
        div.innerHTML = html; 
        list.appendChild(div);
      });
    }

    function addEditorQuestion() {
      saveCurrentEditorPart();
      const selectedType = document.getElementById('new-q-type').value;
      const matchingEndings = selectedType === 'matching_endings';
      const type = matchingEndings ? 'dnd_list' : selectedType;
      const qtyInput = document.getElementById('new-q-qty');
      const qty = parseInt(qtyInput ? qtyInput.value : 1) || 1;
      const part = APP_DATA.parts[currentEditorPartIdx];
      
      // Auto-calculate sequential ID across the entire test
      let maxId = 0;
      APP_DATA.parts.forEach(p => {
          p.questions.forEach(q => {
              (q.ids || []).forEach(id => { if (id > maxId) maxId = id; });
          });
      });
      [...(part.text || '').matchAll(/\{(?:drop|blank):(\d+)\}/g)].forEach(match => {
          maxId = Math.max(maxId, Number(match[1]));
      });
      
      // Generate the array of IDs based on quantity
      const ids = [];
      let correctAnswers = {};
      const claimedIds = new Set(APP_DATA.parts.flatMap(existingPart =>
          existingPart.questions.flatMap(question => question.ids || [])
      ).map(Number));
      const unassignedPassageDropIds = type === 'matching_headings'
          ? [...new Set([...(part.text || '').matchAll(/\{drop:(\d+)\}/g)]
              .map(match => Number(match[1]))
              .filter(id => !claimedIds.has(id)))]
          : [];
      for(let i = 0; i < qty; i++) {
          const newId = unassignedPassageDropIds[i] ?? maxId + 1 + i;
          ids.push(newId);
          correctAnswers[newId] = "";
      }
      
      // Smart Defaults based on type
      let instruction = "Answer the questions below.";
      let options = [];
      let text = "";
      let reusable = false;
      
      if (type === 'multiple_choice') {
          instruction = `Choose the correct letter, <b>A, B, C</b> or <b>D</b>.`;
          options = ["A", "B", "C", "D"];
      } else if (type === 'tfng') {
          instruction = `Do the following statements agree with the information given in the Reading Passage?<br><br><b>TRUE</b> if the statement agrees with the information<br><b>FALSE</b> if the statement contradicts the information<br><b>NOT GIVEN</b> if there is no information on this`;
          options = ["True", "False", "Not Given"];
      } else if (type === 'ynng') {
          instruction = `Do the following statements agree with the claims of the writer in the Reading Passage?<br><br><b>YES</b> if the statement agrees with the claims of the writer<br><b>NO</b> if the statement contradicts the claims of the writer<br><b>NOT GIVEN</b> if it is impossible to say what the writer thinks about this`;
          options = ["Yes", "No", "Not Given"];
      } else if (type === 'matching_headings') {
          instruction = `Choose the correct heading for each paragraph from the list of headings below.`;
          options = ["i", "ii", "iii", "iv", "v", "vi", "vii", "viii", "ix", "x"].slice(0, qty + 2);
      } else if (type === 'fill_blanks') {
          instruction = `Complete the summary below.<br>Choose <b>NO MORE THAN TWO WORDS</b> from the passage for each answer.`;
          text = ids.map(id => `{blank:${id}}`).join(" ... ");
      } else if (type === 'dnd_list') {
          instruction = matchingEndings
              ? `Complete each sentence by matching it with an ending from the box.`
              : `Complete the sentences below.<br>Choose the correct word from the box.`;
          options = matchingEndings
              ? ["A. Ending one", "B. Ending two", "C. Ending three"]
              : ["Word1", "Word2", "Word3"];
          if (matchingEndings) text = ids.map(id => `${id}. Write the sentence beginning here {drop:${id}}`).join('\n');
      } else if (type === 'essay') {
          instruction = `You should spend about 40 minutes on this task.<br><br>Write about the following topic:`;
      }
      
      const newQ = { 
          blockId: 'b' + Date.now() + Math.floor(Math.random()*1000), 
          type, 
          ids, 
          points: 1,
          instruction, 
          text,
          options,
          correctAnswers,
          reusable,
          ...(matchingEndings ? { questionFormat: 'matching_sentence_endings' } : {}),
          hint: getAssignedQuestionTemplateHtml(APP_DATA.module, type)
      };
      
      APP_DATA.parts[currentEditorPartIdx].questions.push(newQ); 
      
      if (qtyInput) qtyInput.value = 1; // reset qty
      
      renderEditorQuestions();
      triggerEditorAutosave();
      
      // Auto-scroll to the new question
      setTimeout(() => {
          const qList = document.getElementById('editor-questions-list');
          if (qList && qList.lastElementChild) {
              qList.lastElementChild.scrollIntoView({behavior: "auto", block: "center"});
          }
      }, 100);
    }

    window.cloneEditorQuestion = function(idx) {
        saveCurrentEditorPart(); // Ensure current text changes are grabbed
        const qToClone = APP_DATA.parts[currentEditorPartIdx].questions[idx];
        if (!qToClone) return;
        
        let maxId = 0;
        APP_DATA.parts.forEach(p => p.questions.forEach(q => (q.ids || []).forEach(id => { if (id > maxId) maxId = id; })));
        
        // Deep copy the block
        const clonedQ = JSON.parse(JSON.stringify(qToClone));
        clonedQ.blockId = 'b' + Date.now() + Math.random().toString().slice(2,6);
        
        // Map old IDs to new IDs
        const newIds = [];
        const newCorrectAnswers = {};
        let newText = clonedQ.text || "";
        let newInst = clonedQ.instruction || "";
        
        clonedQ.ids.forEach((oldId, i) => {
            const newId = maxId + 1 + i;
            newIds.push(newId);
            newCorrectAnswers[newId] = clonedQ.correctAnswers[oldId] || "";
            
            // Update {blank:X} and {drop:X} in cloned text safely
            newText = newText.split(`{blank:${oldId}}`).join(`{blank:${newId}}`);
            newText = newText.split(`{drop:${oldId}}`).join(`{drop:${newId}}`);
        });
        
        clonedQ.ids = newIds;
        clonedQ.correctAnswers = newCorrectAnswers;
        clonedQ.text = newText;
        clonedQ.instruction = newInst;
        
        // Insert directly below the original
        APP_DATA.parts[currentEditorPartIdx].questions.splice(idx + 1, 0, clonedQ);
        
        renderEditorQuestions();
        triggerEditorAutosave();
        
        // Auto-scroll
        setTimeout(() => {
            const block = document.getElementById(`q-block-${idx + 1}`);
            if (block) block.scrollIntoView({behavior: "auto", block: "center"});
        }, 100);
    };
    
    window.addBulkImportRow = function() {
        const tbody = document.getElementById('bulk-import-tbody');
        const tr = document.createElement('tr');
        tr.className = "import-row hover:bg-slate-50 transition-colors";
        tr.innerHTML = `
            <td class="p-2 align-middle text-center border-r border-slate-100"><input type="checkbox" class="row-group w-4 h-4 text-blue-600 rounded border-slate-300 cursor-pointer" title="Merge into the same block as the row above" onchange="this.closest('tr').classList.toggle('bg-blue-50/40', this.checked)"></td>
            <td class="p-2 align-top"><input class="w-full border border-slate-200 p-2 rounded text-sm outline-none row-section focus:border-blue-500 bg-white" placeholder="Part 1 / Section 1"></td>
            <td class="p-2 align-top"><textarea class="w-full border border-slate-200 p-2 rounded text-sm outline-none row-passage focus:border-blue-500 resize-none h-14 bg-white" placeholder="Passage / shared context"></textarea></td>
            <td class="p-2 align-top"><select class="w-full border border-slate-200 p-2 rounded text-sm outline-none row-type focus:border-blue-500 font-medium bg-white" data-col="0" onchange="window.checkAutoGroup(this)"><option value="multiple_choice">Multiple Choice</option><option value="fill_blanks">Gap Fill</option><option value="dnd_list">Drag/Drop</option><option value="tfng">True/False</option><option value="ynng">Yes/No</option><option value="matching_headings">Matching Headings</option><option value="matching_info">Matching Info</option><option value="map_labelling_hotspots">Map (Hotspots)</option><option value="map_labelling_grid">Map (Grid)</option><option value="essay">Essay / Writing</option></select></td>
            <td class="p-2 align-top"><textarea class="w-full border border-slate-200 p-2 rounded text-sm outline-none row-inst focus:border-blue-500 resize-none h-14 bg-white" placeholder="Instruction" data-col="1"></textarea></td>
            <td class="p-2 align-top"><textarea class="w-full border border-slate-200 p-2 rounded text-sm outline-none row-text focus:border-blue-500 resize-none h-14 bg-white" placeholder="Question Text" data-col="2"></textarea></td>
            <td class="p-2 align-top"><textarea class="w-full border border-slate-200 p-2 rounded text-sm outline-none row-opts focus:border-blue-500 resize-none h-14 bg-white" placeholder="A, B, C" data-col="3"></textarea></td>
            <td class="p-2 align-top"><textarea class="w-full border border-slate-200 p-2 rounded text-sm outline-none row-ans focus:border-blue-500 resize-none h-14 font-bold text-emerald-700 bg-white" placeholder="Answer" data-col="4"></textarea></td>
            <td class="p-2 align-top"><textarea class="w-full border border-slate-200 p-2 rounded text-sm outline-none row-hint focus:border-blue-500 resize-none h-14 bg-white" placeholder="Hint" data-col="5"></textarea></td>
            <td class="p-2 align-top"><textarea class="w-full border border-slate-200 p-2 rounded text-sm outline-none row-expl focus:border-blue-500 resize-none h-14 bg-white" placeholder="Explanation" data-col="6"></textarea></td>
        `;
        tbody.appendChild(tr);
    };

    window.checkAutoGroup = function(selectEl) {
        const tr = selectEl.closest('tr');
        const prevTr = tr.previousElementSibling;
        if (!prevTr) return;
        
        const currType = selectEl.value;
        const prevType = prevTr.querySelector('.row-type').value;
        const groupCb = tr.querySelector('.row-group');
        
        const groupables = ['fill_blanks', 'dnd_list', 'matching_headings', 'matching_info', 'map_labelling_hotspots', 'map_labelling_grid'];
        const sameSection = tr.querySelector('.row-section').value.trim() === prevTr.querySelector('.row-section').value.trim();
        if (groupables.includes(currType) && currType === prevType && sameSection) {
            groupCb.checked = true;
            tr.classList.add('bg-blue-50/40');
        } else {
            groupCb.checked = false;
            tr.classList.remove('bg-blue-50/40');
        }
    };

    window.isRapidTestImport = false;

    window.toggleRapidMode = function() {
        const mode = document.querySelector('input[name="rapid-mode"]:checked').value;
        if(mode === 'new') {
            document.getElementById('rapid-mode-new').classList.remove('hidden');
            document.getElementById('rapid-mode-existing').classList.add('hidden');
        } else {
            document.getElementById('rapid-mode-new').classList.add('hidden');
            document.getElementById('rapid-mode-existing').classList.remove('hidden');
            window.populateRapidExistingTests();
        }
    };

    window.populateRapidExistingTests = function() {
        const sel = document.getElementById('rapid-existing-test');
        const selectedId = sel.value;
        const query = document.getElementById('rapid-existing-search')?.value || '';
        const module = document.getElementById('rapid-existing-module')?.value || 'all';
        const escapeHtml = value => String(value || '').replace(/[&<>"']/g, char => ({
            '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
        })[char]);
        const tests = TEST_BANK.filter(test => {
            const matchesModule = module === 'all' || test.module === module;
            const searchable = [
                test.title,
                test.module,
                test.difficulty,
                ...(test.topics || []),
                ...(test.parts || []).flatMap(part => [part.title, part.text])
            ].filter(Boolean).join(' ').toLocaleLowerCase();
            const terms = String(query).trim().toLocaleLowerCase().split(/\s+/).filter(Boolean);
            return matchesModule && terms.every(term => searchable.includes(term));
        });
        sel.innerHTML = tests.length
            ? tests.map(test => {
                const partCount = (test.parts || []).length;
                const label = `${test.title || 'Untitled test'} · ${test.module || 'Unspecified'} · ${partCount} part${partCount === 1 ? '' : 's'}${test.difficulty ? ` · Band ${test.difficulty}` : ''}`;
                return `<option value="${escapeHtml(test.id)}">${escapeHtml(label)}</option>`;
            }).join('')
            : '<option value="">No matching tests found</option>';
        if (tests.some(test => test.id === selectedId)) sel.value = selectedId;
        const resultCount = document.getElementById('rapid-existing-count');
        if (resultCount) resultCount.textContent = `${tests.length} of ${TEST_BANK.length} tests`;
        window.updateRapidPartOptions();
    };

    window.updateRapidPartOptions = function() {
        const tid = document.getElementById('rapid-existing-test').value;
        const test = TEST_BANK.find(t => t.id === tid);
        const pSel = document.getElementById('rapid-existing-part');
        if(test && Array.isArray(test.parts) && test.parts.length) {
            pSel.innerHTML = test.parts.map((part, index) =>
                `<option value="${index}">${String(part.title || `Part ${index + 1}`).replace(/[&<>"']/g, char => ({
                    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
                })[char])} · ${((part.questions || []).reduce((count, question) => count + (question.ids || []).length, 0))} questions</option>`
            ).join('');
        } else {
            pSel.innerHTML = '<option value="">No parts available</option>';
        }
        window.populateRapidLatexTemplates();
    };

    window.populateRapidLatexTemplates = function() {
        const select = document.getElementById('rapid-latex-template');
        if (!select || !window.getIeltsLatexTemplates) return;
        const mode = document.querySelector('input[name="rapid-mode"]:checked')?.value || 'new';
        const skill = mode === 'existing'
            ? TEST_BANK.find(test => test.id === document.getElementById('rapid-existing-test').value)?.module
            : document.getElementById('rapid-test-mod')?.value;
        const templates = window.getIeltsLatexTemplates()[skill] || [];
        select.innerHTML = '<option value="">Choose a template…</option>' + templates
            .map((template, index) => `<option value="${index}">${String(template[0]).replace(/[&<>"']/g, char => ({
                '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
            })[char])}</option>`)
            .join('');
    };

    window.insertRapidLatexTemplate = function() {
        const select = document.getElementById('rapid-latex-template');
        const mode = document.querySelector('input[name="rapid-mode"]:checked')?.value || 'new';
        const skill = mode === 'existing'
            ? TEST_BANK.find(test => test.id === document.getElementById('rapid-existing-test').value)?.module
            : document.getElementById('rapid-test-mod')?.value;
        const template = (window.getIeltsLatexTemplates()[skill] || [])[Number(select.value)];
        if (!template || select.value === '') return;
        const input = document.getElementById('rapid-latex-input');
        const start = input.selectionStart ?? input.value.length;
        const end = input.selectionEnd ?? start;
        const before = input.value.slice(0, start);
        const after = input.value.slice(end);
        const insertion = `${before && !before.endsWith('\n') ? '\n\n' : ''}${template[1]}\n\n`;
        input.value = before + insertion + after;
        const caret = before.length + insertion.length;
        input.setSelectionRange(caret, caret);
        input.focus();
        input.dispatchEvent(new Event('input', { bubbles: true }));
        select.value = '';
    };

    window.populateRapidNewParts = function() {
        const module = document.getElementById('rapid-test-mod')?.value || 'reading';
        const select = document.getElementById('rapid-new-part');
        if (!select) return;
        const parts = getSmartIeltsStructure(module);
        select.innerHTML = parts.map((part, index) =>
            `<option value="${index}">${String(part.title || `Part ${index + 1}`).replace(/[&<>"']/g, char => ({
                '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
            })[char])}</option>`
        ).join('');
        window.populateRapidLatexTemplates();
    };

    window.previewRapidLatexImport = function() {
        const source = document.getElementById('rapid-latex-input')?.value || '';
        const preview = document.getElementById('rapid-latex-preview');
        const error = document.getElementById('rapid-latex-error');
        if (!source.trim()) {
            preview.textContent = 'Paste LaTeX to preview the imported questions.';
            error.classList.add('hidden');
            error.textContent = '';
            return null;
        }
        try {
            const parsed = window.parseIeltsLatex(source);
            const descriptions = parsed.questions.map((question, index) => {
                const typeNames = {
                    fill_blanks: 'Fill in the blanks',
                    dnd_list: 'Drag and drop',
                    mcq: 'Multiple choice',
                    tfng: 'True / False / Not Given',
                    ynng: 'Yes / No / Not Given',
                    matching_headings: 'Matching headings',
                    matching_info: 'Matching information',
                    matching_endings: 'Matching sentence endings',
                    map_labelling_grid: 'Map labelling',
                    map_labelling_hotspots: 'Map hotspots',
                    essay: 'Writing task',
                    audio_record: 'Speaking task'
                };
                const declared = Array.isArray(question.questionNumbers) ? question.questionNumbers : [];
                const label = declared.length
                    ? `Q${declared.length > 1 ? `${declared[0]}–${declared[declared.length - 1]}` : declared[0]}`
                    : `Block ${index + 1}`;
                const count = question.gaps?.length || question.items?.length || question.hotspots?.length || question.selectCount || 1;
                return `${label} · ${typeNames[question.type] || question.type} · ${count} question${count === 1 ? '' : 's'}`;
            });
            const prefix = [
                parsed.passage.title ? `Passage: ${parsed.passage.title}` : '',
                parsed.passage.hasGaps ? `${parsed.gapCount} inline blank${parsed.gapCount === 1 ? '' : 's'}` : ''
            ].filter(Boolean);
            preview.textContent = [...prefix, ...descriptions].join('\n') || 'No questions found. Add IELTS macros to import.';
            error.classList.add('hidden');
            error.textContent = '';
            return parsed;
        } catch (parseError) {
            preview.textContent = 'Correct the LaTeX syntax error to see the import preview.';
            error.textContent = parseError.message;
            error.classList.remove('hidden');
            return null;
        }
    };

    window.openRapidFullTestImport = function() {
        window.isRapidTestImport = true;
        document.getElementById('csv-meta-section').classList.remove('hidden');
        document.getElementById('rapid-latex-section').classList.remove('hidden');
        document.getElementById('rapid-smart-paste-section').classList.add('hidden');
        document.getElementById('rapid-grid-section').classList.add('hidden');
        document.getElementById('rapid-add-row').classList.add('hidden');
        document.getElementById('rapid-import-action').textContent = 'Parse LaTeX & Import';
        
        // Reset to "new" mode by default when opened
        const newRadio = document.querySelector('input[name="rapid-mode"][value="new"]');
        if (newRadio) { newRadio.checked = true; window.toggleRapidMode(); }
        window.populateRapidNewParts();

        document.getElementById('csv-import-title').innerHTML = "🚀 Rapid Import";
        
        document.getElementById('smart-paste-area').value = '';
        document.getElementById('rapid-latex-input').value = '';
        window.previewRapidLatexImport();
        document.getElementById('bulk-import-tbody').innerHTML = ''; 
        document.getElementById('rapid-test-title').value = '';
        document.getElementById('rapid-test-diff').value = '';
        const search = document.getElementById('rapid-existing-search');
        const moduleFilter = document.getElementById('rapid-existing-module');
        if (search) search.value = '';
        if (moduleFilter) moduleFilter.value = 'all';
        window.populateRapidExistingTests();
        
        document.getElementById('csv-import-modal').classList.remove('hidden');
    };

    window.openCSVImport = function() {
        window.isRapidTestImport = false;
        document.getElementById('csv-meta-section').classList.add('hidden');
        document.getElementById('rapid-latex-section').classList.add('hidden');
        document.getElementById('rapid-smart-paste-section').classList.remove('hidden');
        document.getElementById('rapid-grid-section').classList.remove('hidden');
        document.getElementById('rapid-add-row').classList.remove('hidden');
        document.getElementById('rapid-import-action').textContent = 'Import Questions';
        document.getElementById('csv-import-title').innerHTML = "📋 Bulk Import Questions";
        
        document.getElementById('smart-paste-area').value = '';
        document.getElementById('bulk-import-tbody').innerHTML = ''; 
        for(let i=0; i<3; i++) window.addBulkImportRow(); // Start with 3 blank rows
        if (APP_DATA.module === 'listening') {
            document.querySelectorAll('#bulk-import-tbody .row-type option').forEach(option => {
                if (['matching_info', 'matching_headings'].includes(option.value)) option.remove();
            });
        }
        document.getElementById('csv-import-modal').classList.remove('hidden');
    };

    // ✨ NEW: Bulletproof Smart Paste Engine with Excel Multiline Fix
    window.handleSmartPaste = function(e) {
        e.preventDefault(); 
        const text = (e.clipboardData || window.clipboardData).getData('text/plain') || (e.clipboardData || window.clipboardData).getData('text');
        if (!text) return;
        
        const tbody = document.getElementById('bulk-import-tbody');
        
        // Detect if grid is completely empty. If so, wipe it clean for a fresh paste.
        const existingRows = tbody.querySelectorAll('.import-row');
        let isEmpty = true;
        existingRows.forEach(r => {
            if (['.row-section', '.row-passage', '.row-inst', '.row-text', '.row-opts', '.row-ans', '.row-hint', '.row-expl']
                .some(selector => r.querySelector(selector).value.trim())) isEmpty = false;
        });
        if (isEmpty) tbody.innerHTML = '';

        // ✨ FIX: Robust TSV Parser that respects Excel's double-quotes around multi-line cells!
        let rows = [];
        let currentRow = [];
        let currentCell = '';
        let inQuotes = false;

        for (let i = 0; i < text.length; i++) {
            const char = text[i];
            if (inQuotes) {
                if (char === '"') {
                    // Check for escaped quotes ("") inside an already quoted cell
                    if (i + 1 < text.length && text[i + 1] === '"') {
                        currentCell += '"'; 
                        i++; // Skip the second quote
                    } else {
                        inQuotes = false; // End of quoted cell
                    }
                } else {
                    currentCell += char; // Keep newlines intact inside quotes!
                }
            } else {
                if (char === '"') {
                    inQuotes = true; // Start of quoted cell
                } else if (char === '\t') {
                    currentRow.push(currentCell);
                    currentCell = '';
                } else if (char === '\n') {
                    currentRow.push(currentCell);
                    rows.push(currentRow);
                    currentRow = [];
                    currentCell = '';
                } else if (char === '\r') {
                    // Ignore carriage returns entirely to prevent blank lines
                } else {
                    currentCell += char;
                }
            }
        }
        // Push the final cell/row if the text doesn't end with a newline
        if (currentCell || currentRow.length > 0) {
            currentRow.push(currentCell);
            rows.push(currentRow);
        }

        // Filter out completely empty rows
        let pasteRows = rows.filter(r => r.some(cell => cell.trim() !== ''));
        if (!pasteRows.length) return;
        const normalizeHeader = value => value.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
        const headerAliases = {
            section: ['section', 'part', 'section part', 'part section', 'test section', 'section name', 'part name', 'test part', 'passage number', 'section number'],
            passage: ['passage', 'passage text', 'passage context', 'context', 'reading text', 'reading passage', 'transcript', 'source text'],
            type: ['type', 'question type', 'item type', 'task type', 'question format'],
            instruction: ['instruction', 'instructions', 'direction', 'directions', 'question instruction'],
            text: ['question', 'question text', 'statement', 'prompt', 'item', 'sentence'],
            options: ['options', 'choices', 'answer options', 'option list'],
            answer: ['answer', 'correct answer', 'correct', 'key', 'answer key'],
            hint: ['hint', 'clue'],
            explanation: ['explanation', 'rationale', 'feedback']
        };
        const firstHeaders = pasteRows[0].map(normalizeHeader);
        const headerMap = {};
        let recognizedHeaders = 0;
        firstHeaders.forEach((header, index) => {
            for (const [field, aliases] of Object.entries(headerAliases)) {
                if (aliases.includes(header)) {
                    if (headerMap[field] === undefined) headerMap[field] = index;
                    recognizedHeaders++;
                    break;
                }
            }
        });
        const choiceColumns = firstHeaders
            .map((header, index) => ({ header, index, label: header.match(/^(?:(?:option|choice)\s*)?([a-d]|\d+)$/)?.[1] || '' }))
            .filter(({label}) => !!label)
            .sort((left, right) => left.label.localeCompare(right.label, undefined, { numeric: true }))
            .map(({index}) => index);
        const hasHeader = recognizedHeaders >= 2 && (
            headerMap.text !== undefined || headerMap.type !== undefined || headerMap.answer !== undefined
        );
        if (hasHeader) pasteRows = pasteRows.slice(1);

        const normalizeType = value => {
            const raw = String(value || '').trim().toLowerCase().replace(/[_-]+/g, ' ');
            if (/^(fill blanks|gap fill|fill in|fill the gaps|completion|sentence completion|note completion|summary completion)$/.test(raw) || /gap|fill.*blank|completion/.test(raw)) return 'fill_blanks';
            if (/drag|drop|dnd/.test(raw)) return 'dnd_list';
            if (/true.*false|tfng/.test(raw)) return 'tfng';
            if (/yes.*no|ynng/.test(raw)) return 'ynng';
            if (/heading/.test(raw)) return 'matching_headings';
            if (/matching.*(info|information)|match.*paragraph/.test(raw)) return 'matching_info';
            if (/hotspot/.test(raw)) return 'map_labelling_hotspots';
            if (/map.*grid|grid.*map/.test(raw)) return 'map_labelling_grid';
            if (/essay|writing/.test(raw)) return 'essay';
            if (/multiple choice|mcq|choose.*(answer|option)/.test(raw)) return 'multiple_choice';
            return '';
        };
        const inferType = (typeValue, instruction, question, options) => {
            const explicitType = normalizeType(typeValue);
            if (explicitType) return explicitType;
            const context = `${instruction} ${question}`.toLowerCase();
            if (/true\s*\/\s*false\s*\/\s*not given|true,?\s*false,?\s*not given|tfng/.test(context)) return 'tfng';
            if (/yes\s*\/\s*no\s*\/\s*not given|yes,?\s*no,?\s*not given|ynng|agree with (?:the )?(?:views|claims)|yes if.*(?:views|claims)/.test(context)) return 'ynng';
            if (/matching headings|heading for each paragraph/.test(context)) return 'matching_headings';
            if (/matching (?:information|features)|which paragraph|which section/.test(context)) return 'matching_info';
            if (/map|plan|diagram/.test(context) && /label|letter|location/.test(context)) return 'map_labelling_grid';
            if (/drag|drop/.test(context)) return 'dnd_list';
            if (/no more than|complete the (?:notes|summary|sentences|table|form)|fill in the blank|gap.?fill/.test(context)) return 'fill_blanks';
            return options.length > 1 ? 'multiple_choice' : 'multiple_choice';
        };
        const parseOptions = value => {
            const raw = String(value || '').trim();
            if (!raw) return [];
            const separator = raw.includes('|') ? /\s*\|\s*/ : raw.includes(';') ? /\s*;\s*/ : /\r?\n/;
            const values = raw.split(separator).map(option => option.trim()).filter(Boolean);
            return values.length > 1 ? values : raw.split(/\s*,\s*/).map(option => option.trim()).filter(Boolean);
        };
        const getField = (cols, field, legacyIndex) => {
            const index = hasHeader ? headerMap[field] : legacyIndex;
            return index === undefined ? '' : String(cols[index] || '').trim();
        };
        
        pasteRows.forEach((pasteCols) => {
            window.addBulkImportRow();
            const tr = tbody.lastElementChild;
            const typeValue = getField(pasteCols, 'type', 0);
            const instruction = getField(pasteCols, 'instruction', 1);
            let question = getField(pasteCols, 'text', 2);
            question = question.replace(/^(?:question\s*)?\d{1,3}\s*[.)\-:]\s*/i, '').trim();
            let options = parseOptions(getField(pasteCols, 'options', 3));
            if (hasHeader && choiceColumns.length) {
                options = choiceColumns.map(index => String(pasteCols[index] || '').trim()).filter(Boolean);
            }
            const type = inferType(typeValue, instruction, question, options);

            tr.querySelector('.row-section').value = getField(pasteCols, 'section', 7);
            tr.querySelector('.row-passage').value = getField(pasteCols, 'passage', 8);
            tr.querySelector('.row-type').value = type;
            tr.querySelector('.row-inst').value = instruction;
            tr.querySelector('.row-text').value = question;
            tr.querySelector('.row-opts').value = options.join('; ');
            tr.querySelector('.row-ans').value = getField(pasteCols, 'answer', 4);
            tr.querySelector('.row-hint').value = getField(pasteCols, 'hint', 5);
            tr.querySelector('.row-expl').value = getField(pasteCols, 'explanation', 6);
            window.checkAutoGroup(tr.querySelector('.row-type'));
        });
        
        // Briefly flash the background to confirm success, then clear the box
        const ta = document.getElementById('smart-paste-area');
        ta.classList.add('bg-emerald-50');
        ta.value = `✓ Successfully loaded ${pasteRows.length} questions! Review them in the table below.`;
        setTimeout(() => {
            ta.classList.remove('bg-emerald-50');
            ta.value = '';
        }, 2000);
        
        if (typeof window.showToast === 'function') window.showToast("Pasted Successfully", `Loaded ${pasteRows.length} rows into the grid.`);
    };

    window.processBulkImport = async function() {
        const rows = document.querySelectorAll('.import-row');
        let importedCount = 0;
        let newQuestions = [];
        const newQuestionsBySection = new Map();
        const rapidMode = window.isRapidTestImport
            ? (document.querySelector('input[name="rapid-mode"]:checked')?.value || 'new')
            : '';
        const templateSkill = window.isRapidTestImport
            ? (rapidMode === 'new'
                ? document.getElementById('rapid-test-mod')?.value
                : TEST_BANK.find(test => test.id === document.getElementById('rapid-existing-test')?.value)?.module)
            : APP_DATA.module;
        const matchingTypes = ['matching_info', 'matching_headings', 'matching_endings', 'matching_statements'];
        if (templateSkill === 'listening' && [...rows].some(row =>
            matchingTypes.includes(row.querySelector('.row-type').value) &&
            ['.row-inst', '.row-text', '.row-opts', '.row-ans', '.row-hint', '.row-expl']
                .some(selector => row.querySelector(selector).value.trim())
        )) {
            showModalMsg('Unsupported question type', 'Matching question types are not available for Listening.');
            return;
        }
        if (!window.isRapidTestImport) saveCurrentEditorPart();
        
        // Find highest existing ID to prevent question number conflicts
        let currentMaxId = 0;
        if (!window.isRapidTestImport) {
            // ✨ FIX: Scan ALL parts of the test, not just the current part, for global chronological order
            APP_DATA.parts.forEach(p => {
                (p.questions || []).forEach(q => {
                    (q.ids || []).forEach(id => { if (id > currentMaxId) currentMaxId = id; });
                });
            });
        } else {
            const currentRapidMode = document.querySelector('input[name="rapid-mode"]:checked')?.value || 'new';
            if (currentRapidMode === 'existing') {
                const tid = document.getElementById('rapid-existing-test').value;
                const test = TEST_BANK.find(t => t.id === tid);
                if (test) {
                    test.parts.forEach(p => (p.questions || []).forEach(q => (q.ids||[]).forEach(id => { if (id > currentMaxId) currentMaxId = id; })));
                }
            }
        }
        
        let currentBlock = null;
        let activeSectionKey = null;
        const getSectionNumber = label =>
            label.match(/(?:passage|section|part|task)\s*(\d+)/i) || label.match(/^\s*(\d+)\s*$/);

        rows.forEach((row, i) => {
            const isGroupCb = row.querySelector('.row-group').checked;
            const type = row.querySelector('.row-type').value;
            const section = row.querySelector('.row-section').value.trim();
            const passage = row.querySelector('.row-passage').value.trim();
            const inst = row.querySelector('.row-inst').value.trim();
            const text = row.querySelector('.row-text').value.trim();
            const optsRaw = row.querySelector('.row-opts').value.trim();
            const ans = row.querySelector('.row-ans').value.trim();
            const hint = row.querySelector('.row-hint').value.trim();
            const expl = row.querySelector('.row-expl').value.trim();

            const sectionKey = section || '__default__';
            if (window.isRapidTestImport) {
                if (activeSectionKey !== sectionKey) currentBlock = null;
                activeSectionKey = sectionKey;
                if (!newQuestionsBySection.has(sectionKey)) {
                    newQuestionsBySection.set(sectionKey, { label: section, passage, questions: [] });
                } else if (passage) {
                    newQuestionsBySection.get(sectionKey).passage = passage;
                }
            }
            if (!text && !ans && !inst && !hint && !expl) return; // Skip blank rows

            // Sequential ID logic
            currentMaxId++; 
            const newId = currentMaxId;
            
            let options = optsRaw
                ? (/[;|]/.test(optsRaw) ? optsRaw.split(/[;|]/) : optsRaw.split(',')).map(o => o.trim()).filter(Boolean)
                : [];
            let normalizedAnswer = ans;
            if (type === 'multiple_choice' && normalizedAnswer && options.length) {
                const answerLabel = normalizedAnswer.match(/^(?:option\s*)?([a-z]|\d+)(?:[.)\]:-]|\s|$)/i)?.[1];
                if (answerLabel) {
                    const matchingOption = options.find(option => {
                        const optionLabel = option.match(/^\s*\(?([a-z]|\d+)[.)\]:-]?\s+/i)?.[1];
                        return optionLabel && optionLabel.toLowerCase() === answerLabel.toLowerCase();
                    });
                    const answerIndex = /^[a-d]$/i.test(answerLabel) ? answerLabel.toUpperCase().charCodeAt(0) - 65 : -1;
                    if (matchingOption) normalizedAnswer = matchingOption;
                    else if (answerIndex >= 0 && options[answerIndex]) normalizedAnswer = options[answerIndex];
                }
            }

            // Prevent grouping for single-ID types (like MCQ, TFNG) to ensure LMS stability
            const groupables = ['fill_blanks', 'dnd_list', 'matching_headings', 'matching_info', 'map_labelling_hotspots', 'map_labelling_grid'];
            const actualIsGroup = isGroupCb && groupables.includes(type);

            // ✨ SMART REPLACE: Auto-convert "___" or "..." from Excel to active LMS input tokens!
            let processedText = text;
            if (['fill_blanks', 'dnd_list'].includes(type)) {
                const token = type === 'fill_blanks' ? `{blank:${newId}}` : `{drop:${newId}}`;
                if (/[_]{2,}/.test(processedText)) {
                    processedText = processedText.replace(/[_]{2,}/, token);
                } else if (/\.{3,}/.test(processedText)) {
                    processedText = processedText.replace(/\.{3,}/, token);
                } else if (processedText) {
                    processedText += ` ${token}`;
                } else {
                    processedText = token;
                }
            }
            if (type === 'matching_headings' && text) processedText = `${newId}. ${text}`;

            if (actualIsGroup && currentBlock && currentBlock.type === type) {
                // MERGE INTO EXISTING BLOCK
                currentBlock.ids.push(newId);
                currentBlock.correctAnswers[newId] = normalizedAnswer;
                currentBlock.points = currentBlock.ids.length;
                
                // Append text dynamically based on type
                if (['fill_blanks', 'dnd_list'].includes(type)) {
                    if (processedText) {
                        // Concat with a space to form a continuous paragraph
                        currentBlock.text = currentBlock.text ? currentBlock.text + '\n' + processedText : processedText;
                    }
                } else if (['matching_info', 'map_labelling_grid'].includes(type)) {
                    if (text && text !== currentBlock.text) {
                        currentBlock.text = currentBlock.text ? currentBlock.text + '\n' + text : text;
                    }
                } else if (type === 'matching_headings' && text) {
                    currentBlock.text = currentBlock.text ? currentBlock.text + '\n' + processedText : processedText;
                }
                
                // Append options if they provided more
                if (options.length > 0) {
                    currentBlock.options = [...new Set([...(currentBlock.options||[]), ...options])];
                }
                
                if (hint) currentBlock.hint = currentBlock.hint ? currentBlock.hint + '<br><br>' + hint : hint;
                if (expl) currentBlock.explanation = currentBlock.explanation ? currentBlock.explanation + '<br><br>' + expl : expl;
                
                importedCount++;
            } else {
                // CREATE NEW BLOCK
                const newBlock = {
                    blockId: 'b' + Date.now() + i,
                    type: type,
                    ids: [newId],
                    points: 1,
                    instruction: inst || "Answer the question.",
                    text: processedText,
                    options: options,
                    hint: hint || getAssignedQuestionTemplateHtml(templateSkill, type),
                    explanation: expl,
                    correctAnswers: {}
                };

                newBlock.correctAnswers[newId] = normalizedAnswer;
                newQuestions.push(newBlock);
                if (window.isRapidTestImport) {
                    newQuestionsBySection.get(sectionKey).questions.push(newBlock);
                }
                currentBlock = newBlock; // Update current block tracker
                importedCount++;
            }
        });

        if (importedCount === 0) {
            showModalMsg("Import Failed", "All rows were empty. Please fill in the grid or paste from Excel.");
            return;
        }

        if (window.isRapidTestImport) {
            const currentRapidMode = document.querySelector('input[name="rapid-mode"]:checked')?.value || 'new';
            
            if (currentRapidMode === 'new') {
                // Create New Test Workflow
                const title = document.getElementById('rapid-test-title').value.trim() || 'Untitled Rapid Test';
                const mod = document.getElementById('rapid-test-mod').value;
                const diff = document.getElementById('rapid-test-diff').value.trim();
                
                let smartParts = getSmartIeltsStructure(mod);
                let nextUnassignedPart = 0;
                newQuestionsBySection.forEach(bucket => {
                    if (!bucket.questions.length) return;
                    const sectionNumber = getSectionNumber(bucket.label);
                    const partNumber = sectionNumber?.[1] || sectionNumber?.[2];
                    let partIndex = partNumber ? Number(partNumber) - 1 : nextUnassignedPart;
                    if (!sectionNumber && bucket.label) nextUnassignedPart++;
                    partIndex = Math.max(0, partIndex);
                    while (partIndex >= smartParts.length) {
                        smartParts.push({ title: `Part ${smartParts.length + 1}`, text: '', questions: [] });
                    }
                    const targetPart = smartParts[partIndex];
                    if (bucket.label && sectionNumber) {
                        const number = partNumber;
                        const suffix = /(?:passage|section|part|task)\s*\d+/i.test(bucket.label)
                            ? bucket.label.replace(/.*?(?:passage|section|part|task)\s*\d+\s*[:\-–]?\s*/i, '').trim()
                            : '';
                        const baseTitle = mod === 'reading' ? `Reading Passage ${number}`
                            : mod === 'writing' ? `Task ${number}`
                            : `Part ${number}`;
                        targetPart.title = suffix ? `${baseTitle}: ${suffix}` : baseTitle;
                    } else if (bucket.label) targetPart.title = bucket.label;
                    if (bucket.passage) targetPart.text = bucket.passage;
                    if (['writing', 'speaking'].includes(mod) &&
                        targetPart.questions.some(question => ['essay', 'audio_record'].includes(question.type))) {
                        targetPart.questions = [];
                    }
                    targetPart.questions.push(...bucket.questions);
                    nextUnassignedPart = Math.max(nextUnassignedPart, partIndex + 1);
                });
                
                const newTest = { 
                    id: 't_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5), 
                    title, 
                    module: mod, 
                    topics: [], 
                    difficulty: diff, 
                    parts: smartParts, 
                    vocab: [] 
                };
                
                TEST_BANK.unshift(newTest);
                await window.fsSetDoc(window.fsDoc(window.db, window.fPath('tests'), newTest.id), newTest);
                
                document.getElementById('csv-import-modal').classList.add('hidden');
                renderTestBank();
                showModalMsg("Success! 🎉", `Created "${title}" and injected ${importedCount} questions successfully!`);
            } else {
                // Add to Existing Test Workflow
                const tid = document.getElementById('rapid-existing-test').value;
                const pIdx = parseInt(document.getElementById('rapid-existing-part').value);
                const test = TEST_BANK.find(t => t.id === tid);
                
                if (test && test.parts[pIdx]) {
                    newQuestionsBySection.forEach(bucket => {
                        if (!bucket.questions.length) return;
                        const sectionNumber = getSectionNumber(bucket.label);
                        const partNumber = sectionNumber?.[1] || sectionNumber?.[2];
                        const targetIndex = partNumber ? Number(partNumber) - 1 : pIdx;
                        while (targetIndex >= test.parts.length) {
                            test.parts.push({ title: bucket.label || `Part ${test.parts.length + 1}`, text: '', questions: [] });
                        }
                        const targetPart = test.parts[targetIndex];
                        if (bucket.label) targetPart.title = bucket.label;
                        if (bucket.passage) targetPart.text = bucket.passage;
                        targetPart.questions.push(...bucket.questions);
                    });
                    await window.fsSetDoc(window.fsDoc(window.db, window.fPath('tests'), test.id), test);
                    
                    document.getElementById('csv-import-modal').classList.add('hidden');
                    renderTestBank();
                    showModalMsg("Success! 🎉", `Added ${importedCount} questions to "${test.title}" (Part ${pIdx + 1}) successfully!`);
                }
            }
        } else {
            // STANDARD EDITOR WORKFLOW: Inject into current part
        newQuestions.forEach(question => {
            if (!question.hint) question.hint = getAssignedQuestionTemplateHtml(APP_DATA.module, question.type);
        });
        APP_DATA.parts[currentEditorPartIdx].questions.push(...newQuestions);
            document.getElementById('csv-import-modal').classList.add('hidden');
            renderEditorQuestions();
            triggerEditorAutosave();
            showModalMsg("Success", `Imported ${importedCount} questions successfully!`);
        }
    };
    
    function moveEditorQuestion(idx, dir) {
      saveCurrentEditorPart(); 
      const qList = APP_DATA.parts[currentEditorPartIdx].questions;
      const target = idx + dir;
      if (target >= 0 && target < qList.length) {
        [qList[idx], qList[target]] = [qList[target], qList[idx]];
        renderEditorQuestions();
        triggerEditorAutosave();
      }
    }

    window.changeEditorQuestionType = function(index, requestedType) {
        const choices = {
            reading: ['multiple_choice', 'fill_blanks', 'dnd_list', 'tfng', 'ynng', 'matching_headings', 'matching_info', 'matching_endings', 'map_labelling_hotspots', 'map_labelling_grid'],
            listening: ['multiple_choice', 'fill_blanks', 'dnd_list', 'tfng', 'ynng', 'map_labelling_hotspots', 'map_labelling_grid'],
            writing: ['essay'],
            speaking: ['audio_record', 'essay'],
            activity: ['pair_roleplay', 'group_debate', 'vocab_game']
        }[APP_DATA.module] || [];
        if (!choices.includes(requestedType)) {
            showModalMsg('Cannot change question type', 'That question type is not available for this skill.');
            renderEditorQuestions();
            return;
        }

        saveCurrentEditorPart();
        const questions = APP_DATA.parts[currentEditorPartIdx].questions;
        const question = questions[index];
        if (!question) return;
        const previousType = question.questionFormat === 'matching_sentence_endings' ? 'matching_endings' : question.type;
        if (previousType === requestedType) return;

        const ids = Array.isArray(question.ids) && question.ids.length ? [...question.ids] : [1];
        const answers = { ...(question.correctAnswers || {}) };
        let text = String(question.text || '');
        const sourceHotspots = Array.isArray(question.hotspots) ? question.hotspots : [];
        if (!text && sourceHotspots.length) {
            text = sourceHotspots.map(hotspot => `${hotspot.id}. ${answers[hotspot.id] || 'Map label'}`).join('\n');
        }
        if (requestedType === 'fill_blanks') {
            text = text.replace(/\{drop:(\d+)\}/g, '{blank:$1}');
            if (!/\{blank:\d+\}/.test(text)) {
                text = `${text}${text ? '\n' : ''}${ids.map(id => `{blank:${id}}`).join(' ')}`;
            }
        } else if (requestedType === 'dnd_list' || requestedType === 'matching_endings') {
            text = text.replace(/\{blank:(\d+)\}/g, '{drop:$1}');
            if (!/\{drop:\d+\}/.test(text)) {
                text = `${text}${text ? '\n' : ''}${ids.map(id => `${id}. {drop:${id}}`).join('\n')}`;
            }
        } else {
            text = text
                .replace(/\s*\{(?:blank|drop):\d+\}/g, '')
                .replace(/(?:^|\n)\s*\d+[.)]\s*$/gm, '')
                .trim();
        }

        question.ids = ['essay', 'audio_record', 'vocab_game', 'pair_roleplay', 'group_debate'].includes(requestedType)
            ? [ids[0]]
            : ids;
        question.type = requestedType === 'matching_endings' ? 'dnd_list' : requestedType;
        question.text = text;
        question.correctAnswers = answers;
        delete question.questionFormat;
        delete question.hotspots;
        if (requestedType === 'matching_endings') {
            question.questionFormat = 'matching_sentence_endings';
            question.instruction = question.instruction || 'Complete each sentence by matching it with an ending from the box.';
        } else if (requestedType === 'multiple_choice') {
            question.options = question.options?.length ? question.options : ['A', 'B', 'C', 'D'];
            question.multi = false;
        } else if (requestedType === 'tfng') {
            question.options = ['True', 'False', 'Not Given'];
            question.multi = false;
        } else if (requestedType === 'ynng') {
            question.options = ['Yes', 'No', 'Not Given'];
            question.multi = false;
        } else if (requestedType === 'dnd_list') {
            question.options = question.options?.length ? question.options : ['Option 1', 'Option 2', 'Option 3'];
            question.reusable = false;
        } else if (requestedType === 'matching_headings') {
            question.options = question.options?.length ? question.options : ['i', 'ii', 'iii', 'iv'];
            question.reusable = false;
        } else if (requestedType === 'matching_info' || requestedType === 'map_labelling_grid') {
            question.options = question.options || [];
            question.reusable = true;
        } else if (requestedType === 'map_labelling_hotspots') {
            question.options = question.options?.length ? question.options : ['Option 1', 'Option 2', 'Option 3'];
            question.hotspots = question.ids.map((id, hotspotIndex) => {
                const previous = sourceHotspots.find(hotspot => hotspot.id === id);
                return previous || {
                    id,
                    x: Math.round(((hotspotIndex + 1) / (question.ids.length + 1)) * 100),
                    y: 50
                };
            });
        } else if (['essay', 'audio_record', 'pair_roleplay', 'group_debate', 'vocab_game'].includes(requestedType)) {
            question.options = [];
            question.correctAnswers = {};
            question.multi = false;
            question.reusable = false;
        } else if (requestedType === 'fill_blanks') {
            question.options = [];
            question.reusable = false;
        }

        question.points = Math.max(1, question.ids.length);
        renderEditorQuestions();
        triggerEditorAutosave();
    };

        window.setListeningHighlightStart = function(value) {
            const start = Math.max(0, Number(value) || 0);
            const input = document.getElementById('edit-listening-start');
            if (input) input.value = String(start);
            if (APP_DATA.parts[currentEditorPartIdx]) APP_DATA.parts[currentEditorPartIdx].listeningHighlightStart = start;
            window.triggerEditorAutosave();
        };

        window.setListeningHighlightStartFromAudio = function() {
            const audio = getKaraokeEditorAudio();
            if (audio) window.setListeningHighlightStart(audio.currentTime || 0);
        };

    function saveCurrentEditorPart() {
      const p = APP_DATA.parts[currentEditorPartIdx];
      const titleEl = document.getElementById('edit-passage-title');
      if (APP_DATA.module === 'writing' && !p.writingTask) {
          const taskNumber = getWritingTaskNumber(p);
          if (taskNumber) p.writingTask = `task${taskNumber}`;
      }
      p.title = titleEl.tagName === 'INPUT' || titleEl.tagName === 'TEXTAREA' ? titleEl.value : titleEl.innerHTML;
      const speakingQuestionsEl = document.getElementById('edit-speaking-questions');
      if (APP_DATA.module === 'speaking' && speakingQuestionsEl) {
          p.speakingQuestions = speakingQuestionsEl.innerHTML;
      }
      p.audioUrl = document.getElementById('edit-audio-url').value;
    const startInput = document.getElementById('edit-listening-start');
    p.listeningHighlightStart = startInput ? Math.max(0, Number(startInput.value) || 0) : 0;
      
      const passTxt = document.getElementById('edit-passage-text');
      p.text = passTxt.tagName === 'TEXTAREA' ? passTxt.value : passTxt.innerHTML;
      
      const blocks = document.getElementById('editor-questions-list').children;
      p.questions = Array.from(blocks).map((b, i) => {
        const old = p.questions[i];
        
        let idsArr = old.ids;
        const idsInput = b.querySelector('.q-ids');
        if (idsInput && !idsInput.readOnly) {
            idsArr = window.parseIdsString(idsInput.value);
            if(idsArr.length === 0) idsArr = old.ids;
        }

        // ✨ FIX: Auto-calculate points based on array length
        const isAutoPoints = !['essay', 'audio_record', 'vocab_game', 'pair_roleplay', 'group_debate'].includes(old.type);
        const calcPoints = isAutoPoints ? Math.max(1, idsArr.length) : (Number(b.querySelector('.q-points').value) || 1);

        const getVal = (el) => el ? (el.isContentEditable ? el.innerHTML : el.value) : '';
        const res = { 
            blockId: old.blockId, type: old.type, ids: idsArr, 
            points: calcPoints, 
            instruction: getVal(b.querySelector('.q-inst')), 
            hint: getVal(b.querySelector('.q-hint')),
            explanation: getVal(b.querySelector('.q-expl')) 
        };
        if (old.questionFormat) res.questionFormat = old.questionFormat;

        if (['reading', 'listening'].includes(APP_DATA.module)) {
            if (old.locateText) res.locateText = old.locateText;
            if (old.locateIndex !== undefined) res.locateIndex = old.locateIndex;
        }
        
        if (old.timestamps) res.timestamps = old.timestamps;
        if (old.latexSource) res.latexSource = true;
        if (old.image) res.image = old.image;
        if (old.hotspots) res.hotspots = old.hotspots;
        
        const qTextEl = b.querySelector('.q-text');
        if (qTextEl) {
            if (qTextEl.isContentEditable) res.text = qTextEl.innerHTML;
            else res.text = qTextEl.value;
        }
        
        if(b.querySelector('.q-opts')) {
            const rawOpts = b.querySelector('.q-opts').value.split('\n').map(s=>s.trim()).filter(Boolean);
            res.options = window.expandOptionsArray(rawOpts); // Expands A-E into columns automatically
        }
        if(b.querySelector('.q-reus')) res.reusable = b.querySelector('.q-reus').checked;
        if(b.querySelector('.q-multi')) res.multi = b.querySelector('.q-multi').checked;
        
        const c = b.querySelector('.q-correct');
        if(c) {
          res.correctAnswers = {};
          if((old.type==='tfng' || old.type==='ynng' || (old.type==='multiple_choice' && !res.multi)) && c.tagName !== 'TEXTAREA') {
             res.correctAnswers[res.ids[0]] = c.value.trim();
          } else {
             // Retain old answers if ID range is expanded
             const parsedAns = {};
             c.value.split('\n').forEach(l => { const m = l.match(/(\d+):(.*)/); if(m) parsedAns[Number(m[1])] = m[2].trim(); });
             res.ids.forEach(id => {
                 res.correctAnswers[id] = parsedAns[id] !== undefined ? parsedAns[id] : (old.correctAnswers[id] || '');
             });
          }
        }
        return res;
      });
    }

    let studentBillingExpiryTimer = null;
