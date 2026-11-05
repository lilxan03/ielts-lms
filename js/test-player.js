    let speakingSimulationSession = null;
    let savedSyntaxChunkSelection = null;

    window.startFullExam = function() {
        // Pull directly from the GLOBAL Test Bank
        const allListening = TEST_BANK.filter(t => t.module === 'listening');
        const allReading = TEST_BANK.filter(t => t.module === 'reading');
        const allWriting = TEST_BANK.filter(t => t.module === 'writing');

        if (!allListening.length || !allReading.length || !allWriting.length) {
            showModalMsg("Cannot Start", "Your global Test Bank is missing tests. Ensure you have created at least 1 Listening, 1 Reading, and 1 Writing test in the system.");
            return;
        }

        // Synthetic Generator: Mixes & matches parts from ALL available tests to form a unique mock exam
        const generateSyntheticTest = (moduleName, requiredParts, sourceTests) => {
            // A part only counts as "usable" if it actually has visible content to show the student.
            const hasContent = (p) => {
                if (!p) return false;
                if (moduleName === 'listening') {
                    // Audio is the essential content; transcript text is optional.
                    return !!p.audioUrl;
                }
                if (moduleName === 'writing') {
                    // The real task question now lives in the TITLE field ("Part Title / Main
                    // Prompt") - that's what's shown to students in every mode. The text field is
                    // just an optional sample answer for Practice Mode, so it's irrelevant here.
                    const plain = (p.title || '').replace(/<[^>]*>/g, ' ').replace(/&nbsp;/g, ' ').trim();
                    if (!plain) return false;
                    const wordCount = plain.split(/\s+/).filter(Boolean).length;
                    return wordCount >= 5; // must be an actual sentence, not just "Part 1" or a stray word
                }
                // Reading & other modules: just need actual passage/prompt text present.
                return !!(p.text && p.text.trim().length > 0);
            };

            let selectedParts = [];
            for (let i = 0; i < requiredParts; i++) {
                // Find all parts at this specific index (e.g., all "Part 1s") that ACTUALLY have questions AND content
                let validPartsForThisIndex = sourceTests
                    .map(t => t.parts[i])
                    .filter(p => p && p.questions && p.questions.length > 0 && hasContent(p));
                
                if (validPartsForThisIndex.length > 0) {
                    let randomPart = validPartsForThisIndex[Math.floor(Math.random() * validPartsForThisIndex.length)];
                    let clonedPart = JSON.parse(JSON.stringify(randomPart));
                    // Writing's title IS the real task question now - never overwrite it.
                    // Other modules just use the title as a decorative label, safe to normalize.
                    if (moduleName !== 'writing') clonedPart.title = `Part ${i + 1}`;
                    selectedParts.push(clonedPart);
                } else {
                    // Fallback: If no "Part X" exists anywhere, grab ANY valid part from this module
                    let allValidPartsAnywhere = sourceTests.flatMap(t => t.parts).filter(p => p && p.questions && p.questions.length > 0 && hasContent(p));
                    if (allValidPartsAnywhere.length > 0) {
                        let randomPart = allValidPartsAnywhere[Math.floor(Math.random() * allValidPartsAnywhere.length)];
                        let clonedPart = JSON.parse(JSON.stringify(randomPart));
                        if (moduleName !== 'writing') clonedPart.title = `Part ${i + 1}`;
                        selectedParts.push(clonedPart);
                    }
                }
            }

            const vocab = sourceTests
                .flatMap(test => Array.isArray(test.vocab) ? test.vocab : [])
                .filter(word => word && word.term)
                .filter((word, index, words) => words.findIndex(item => item.term.toLowerCase() === word.term.toLowerCase()) === index);

            return {
                id: 'mock_' + moduleName + '_' + Date.now(),
                title: `Full Mock Exam - ${moduleName.charAt(0).toUpperCase() + moduleName.slice(1)}`,
                module: moduleName,
                topics: ['Generated Mock Exam'],
                parts: selectedParts,
                vocab
            };
        };

        const synthListening = generateSyntheticTest('listening', 4, allListening);
        const synthReading = generateSyntheticTest('reading', 3, allReading);
        const synthWriting = generateSyntheticTest('writing', 2, allWriting);

        if (!synthListening.parts.length || !synthReading.parts.length || !synthWriting.parts.length) {
            showModalMsg("Cannot Start", "Some tests in your bank are completely empty. Please ensure tests have actual content and questions.");
            return;
        }

        window.isFullExamMode = true;
        window.fullExamSequence = [synthListening, synthReading, synthWriting];
        window.fullExamCurrentIndex = 0;

        showConfirm("Start Full Exam", "This will start a timed mock exam consisting of Listening (40m), Reading (60m), and Writing (60m). The parts have been dynamically mixed and matched from your entire Test Bank to create a completely unique test! Make sure you have roughly 2.5 hours available.<br><br><b class='text-rose-600'>⚠️ Note: This exam runs in Secure Browser Mode. Leaving the tab will record a security violation.</b>", () => {
            testMode = 'restricted';
            isTimeFree = false;
            startTest(null, null, window.fullExamSequence[0]);
        });
    };

    function isSpeakingSimulationLocked() {
      return speakingSimulationSession &&
          ['requesting', 'preparation', 'recording', 'saving'].includes(speakingSimulationSession.phase);
    }

    function updateSpeakingSimulationLock(locked) {
      const submitButton = document.getElementById('exam-submit-btn');
      if (submitButton) {
          submitButton.disabled = locked;
          submitButton.setAttribute('aria-disabled', String(locked));
          submitButton.title = locked
              ? 'The timed Speaking attempt must finish before submitting.'
              : '';
      }
    }

    function clearSpeakingPartTwoSession() {
      const session = speakingSimulationSession;
      if (!session) return;
      session.cancelled = true;
      clearInterval(session.interval);
      if (session.recorder && session.recorder.state === 'recording') session.recorder.stop();
      session.stream?.getTracks().forEach(track => track.stop());
      speakingSimulationSession = null;
      updateSpeakingSimulationLock(false);
    }

    function formatSpeakingCountdown(milliseconds) {
      const seconds = Math.max(0, Math.ceil(milliseconds / 1000));
      return `${Math.floor(seconds / 60).toString().padStart(2, '0')}:${(seconds % 60).toString().padStart(2, '0')}`;
    }

    function getSpeakingSimulationPartKey(part) {
      return `${part?.title || ''}|${part?.speakingQuestions || ''}|${(part?.questions || [])
          .filter(question => question.type === 'audio_record')
          .map(question => `${question.ids?.join(',') || ''}:${question.instruction || ''}`)
          .join('|')}`;
    }

    function updateSpeakingSimulationDisplay(session, message, remaining) {
      if (speakingSimulationSession !== session || session.cancelled) return;
      const status = document.getElementById('speaking-simulation-status');
      const countdown = document.getElementById('speaking-simulation-countdown');
      if (status) status.textContent = message;
      if (countdown && remaining !== null) countdown.textContent = formatSpeakingCountdown(remaining);
    }

    function failSpeakingPartTwoSession(session, error) {
      if (speakingSimulationSession !== session || session.cancelled) return;
      clearInterval(session.interval);
      session.phase = 'failed';
      session.stream?.getTracks().forEach(track => track.stop());
      updateSpeakingSimulationDisplay(
          session,
          'Microphone setup failed. The timed attempt did not start; submit or leave the test.',
          0
      );
      updateSpeakingSimulationLock(false);
      console.error('Speaking simulation microphone error:', error);
      showModalMsg('Microphone Unavailable', 'Allow microphone access and check that your microphone is connected. This attempt was not recorded.');
      if (session.autoSubmitOnUnlock) window.exitTest(true);
    }

    function completeSpeakingRecording(session) {
      if (speakingSimulationSession !== session || session.cancelled) return;
      if (session.phase !== 'saving') return;
      clearInterval(session.interval);
      const recording = new Blob(session.chunks, {
          type: session.recorder.mimeType || 'audio/webm'
      });
      const status = document.getElementById('speaking-simulation-status');
      if (status) status.textContent = 'Recording complete. Saving your response…';
      const reader = new FileReader();
      reader.onload = () => {
          if (speakingSimulationSession !== session || session.cancelled) return;
          const base64Audio = reader.result;
          if (typeof base64Audio !== 'string' || base64Audio.length > 950000) {
              session.phase = 'failed';
              updateSpeakingSimulationLock(false);
              updateSpeakingSimulationDisplay(session, 'Recording could not be saved because it exceeds the allowed size.', 0);
              showModalMsg('Recording Too Large', 'Your two-minute audio exceeded the storage limit, so it could not be attached to this submission.');
              if (session.autoSubmitOnUnlock) window.exitTest(true);
              return;
          }
          answers[session.questionId] = base64Audio;
          triggerAutosave();
          const playback = document.getElementById(`mic-playback-${session.questionId}`);
          if (playback) {
              playback.src = base64Audio;
              playback.classList.remove('hidden');
          }
          session.phase = 'complete';
          updateSpeakingSimulationLock(false);
          updateSpeakingSimulationDisplay(session, 'Recording saved. You can now submit your test.', null);
          if (session.autoSubmitOnUnlock) window.exitTest(true);
      };
      reader.onerror = error => {
          if (speakingSimulationSession !== session || session.cancelled) return;
          session.phase = 'failed';
          updateSpeakingSimulationLock(false);
          updateSpeakingSimulationDisplay(session, 'Audio processing failed. The recording could not be saved.', 0);
          console.error('Speaking simulation audio processing error:', error);
          showModalMsg('Audio Processing Error', 'Your recording could not be processed. Please check your device and try a new attempt.');
          if (session.autoSubmitOnUnlock) window.exitTest(true);
      };
      reader.readAsDataURL(recording);
      session.stream?.getTracks().forEach(track => track.stop());
    }

    function startSpeakingSimulationRecording(session) {
      if (speakingSimulationSession !== session || session.cancelled) return;
      try {
          session.recorder.start();
          session.phase = 'recording';
          session.deadline = Date.now() + 120000;
          updateSpeakingSimulationDisplay(session, 'Recording — keep speaking until time is up. / Đang ghi âm — hãy tiếp tục nói đến khi hết giờ.', 120000);
      } catch (error) {
          failSpeakingPartTwoSession(session, error);
      }
    }

    function tickSpeakingPartTwoSession(session) {
      if (speakingSimulationSession !== session || session.cancelled) return;
      const remaining = Math.max(0, session.deadline - Date.now());
      if (session.phase === 'preparation') {
          if (remaining <= 0) {
              startSpeakingSimulationRecording(session);
          } else {
              updateSpeakingSimulationDisplay(session, 'Preparation time — plan your response. / Thời gian chuẩn bị — hãy lập ý.', remaining);
          }
          return;
      }
      if (session.phase === 'recording') {
          if (remaining <= 0) {
              session.phase = 'saving';
              clearInterval(session.interval);
              updateSpeakingSimulationDisplay(session, 'Time is up. Processing your recording… / Đã hết giờ. Đang xử lý bản ghi…', 0);
              try {
                  session.recorder.stop();
              } catch (error) {
                  failSpeakingPartTwoSession(session, error);
              }
          } else {
              updateSpeakingSimulationDisplay(session, 'Recording — keep speaking until time is up. / Đang ghi âm — hãy tiếp tục nói đến khi hết giờ.', remaining);
          }
      }
    }

    async function startSpeakingPartTwoSimulation() {
      if (speakingSimulationSession?.phase === 'complete') return;
      const part = APP_DATA.parts[currentPartIdx];
      const question = part?.questions?.find(item => item.type === 'audio_record' && item.ids?.length === 1);
      if (!question) {
          showModalMsg('Speaking Cue Card Unavailable', 'This Part 2 needs exactly one audio-recording question to run the timed simulation.');
          window.isSpeakingPartTwoSimulation = false;
          return;
      }
      const session = {
          questionId: question.ids[0],
          phase: 'requesting',
          cancelled: false,
          chunks: [],
          deadline: 0,
          interval: null,
          recorder: null,
          stream: null
      };
      speakingSimulationSession = session;
      updateSpeakingSimulationLock(true);
      updateSpeakingSimulationDisplay(session, 'Requesting microphone access… / Đang yêu cầu quyền sử dụng micrô…', 60000);
      try {
          if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder !== 'function') {
              throw new Error('This browser does not support microphone recording.');
          }
          session.stream = await navigator.mediaDevices.getUserMedia({ audio: true });
          if (speakingSimulationSession !== session || session.cancelled) {
              session.stream.getTracks().forEach(track => track.stop());
              return;
          }
          session.recorder = new MediaRecorder(session.stream, { audioBitsPerSecond: 32000 });
          session.recorder.ondataavailable = event => {
              if (event.data?.size) session.chunks.push(event.data);
          };
          session.recorder.onstop = () => completeSpeakingRecording(session);
          session.recorder.onerror = event => failSpeakingPartTwoSession(session, event.error || event);
          session.phase = 'preparation';
          session.deadline = Date.now() + 60000;
          updateSpeakingSimulationDisplay(session, 'Preparation time — plan your response. / Thời gian chuẩn bị — hãy lập ý.', 60000);
          session.interval = setInterval(() => tickSpeakingPartTwoSession(session), 100);
      } catch (error) {
          failSpeakingPartTwoSession(session, error);
      }
    }

    function startTest(tid, selectedParts = null, syntheticTestObj = null) {
      clearSpeakingPartTwoSession();
      if (syntheticTestObj) {
          APP_DATA = syntheticTestObj;
      } else {
          const t = TEST_BANK.find(x => x.id === tid); if(!t) return;
          APP_DATA = JSON.parse(JSON.stringify(t)); 
          
          if (selectedParts && selectedParts.length > 0) {
              APP_DATA.parts = selectedParts.map(idx => APP_DATA.parts[idx]).filter(Boolean);
          }
      }
      if (APP_DATA.module === 'speaking' && window.isSpeakingPartTwoSimulation) {
          const savedPartIndex = window.speakingSimulationPartKey
              ? APP_DATA.parts.findIndex(part => getSpeakingSimulationPartKey(part) === window.speakingSimulationPartKey)
              : -1;
          window.speakingSimulationPartIndex = savedPartIndex >= 0 ? savedPartIndex : APP_DATA.parts.findIndex((part, index) => {
              const label = `${part.title || ''} ${part.speakingQuestions || ''} ${(part.questions || []).map(question => `${question.instruction || ''} ${question.text || ''}`).join(' ')}`;
              const sourceIndex = selectedParts?.[index] ?? index;
              return /\bpart\s*2\b|\bcue[\s-]*card\b/i.test(label) ||
                  sourceIndex === window.speakingSimulationSourcePartIndex || index === 1;
          });
          if (window.speakingSimulationPartIndex < 0) {
              window.isSpeakingPartTwoSimulation = false;
              window.speakingSimulationSourcePartIndex = -1;
              window.speakingSimulationPartKey = '';
          } else {
              window.speakingSimulationPartKey = getSpeakingSimulationPartKey(APP_DATA.parts[window.speakingSimulationPartIndex]);
          }
      } else {
          window.speakingSimulationPartIndex = -1;
          window.speakingSimulationPartKey = '';
      }

      if (window.isFullExamMode && !window.activeSyntheticExamReturnHash) {
          window.activeSyntheticExamReturnHash = window.location.hash || '#/student/dashboard';
      }
      if (currentUser?.role === 'student' && !window.isFullExamMode && APP_DATA.id && TEST_BANK.some(test => test.id === APP_DATA.id)) {
          const routeParts = selectedParts || APP_DATA.parts.map((_, index) => index);
          const testRouteHash = buildTestHashRoute(APP_DATA.id, routeParts);
          const currentRoute = parseTestHashRoute();
          const isDirectRouteStart = directTestRoutePending?.id === APP_DATA.id || currentRoute?.id === APP_DATA.id;
          if (isDirectRouteStart) {
              window.history.replaceState({ lmsRoute: 'test' }, '', testRouteHash);
          } else {
              window.history.pushState({ lmsRoute: 'test' }, '', testRouteHash);
          }
          activeTestRoute = true;
          directTestRoutePending = null;
          window.activeTestRouteHash = testRouteHash;
      }

      // Check for Secure Mode
      let requireSecure = window.isFullExamMode;
      const cid = document.getElementById('student-class-select')?.value;
      const cls = CLASSES.find(c => c.id === cid);
      if (!window.isFullExamMode && cls && cls.testSettings && APP_DATA.id && cls.testSettings[APP_DATA.id]?.secureMode) {
          requireSecure = true;
      }

      if (requireSecure) {
          window.enterSecureMode();
      }

      answers = {}; reviewStatus = {};
      isPreviewMode = false; 
      questionBlockStartTimes = {};
      questionBlockAccumulated = {};
      currentActiveQuestionBlockKey = null;
      
      const noteKey = `${currentUser.user}_${APP_DATA.id}`;
      if (!ALL_NOTES[noteKey]) ALL_NOTES[noteKey] = [];
      currentNotes = ALL_NOTES[noteKey];
      
      activeSelectionRange = null;
      activeHighlightNode = null;
      isNotesPanelOpen = false;
      document.getElementById('notes-panel').classList.add('hidden');
      document.getElementById('questions-container').innerHTML = '';
      renderNotesPanel(); 
      
      document.getElementById('start-screen').classList.add('hidden');
      document.getElementById('exam-ui').classList.remove('hidden');
      window.refreshStudentLanguageLock?.();
      document.getElementById('exam-candidate-name').textContent = currentUser.user;
      document.getElementById('exam-preview-badge').classList.add('hidden');
      document.getElementById('exam-module-title').textContent = APP_DATA.title + (window.isFullExamMode ? ` (Full Exam - Section ${window.fullExamCurrentIndex + 1}/3)` : '');
      document.getElementById('exam-action-btn-text').textContent = window.isFullExamMode ? (window.fullExamCurrentIndex < 2 ? "NEXT SECTION" : "SUBMIT EXAM") : "SUBMIT TEST";
      
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

      const grammarBtn = document.getElementById('exam-grammar-btn');
      if (grammarBtn) {
          grammarBtn.classList.remove('hidden');
          grammarBtn.classList.add('flex');
      }

      const modColors = { reading:'bg-blue-700', listening:'bg-cyan-700', writing:'bg-emerald-700', speaking:'bg-amber-600' };
      document.getElementById('exam-module-bar').className = `${modColors[APP_DATA.module]} text-white px-4 py-2 font-bold flex justify-between items-center z-30 shadow`;
      
      clearInterval(timerInterval);
      let customMins = parseInt(document.getElementById('custom-time-input') ? document.getElementById('custom-time-input').value : 0);
      let defaultSecs = (APP_DATA.module==='listening'?40*60:APP_DATA.module==='writing'?60*60:APP_DATA.module==='speaking'?15*60:60*60);
      timeLeft = isTimeFree ? 0 : (customMins > 0 && !window.isFullExamMode ? customMins * 60 : defaultSecs);
      
      timerInterval = setInterval(() => {
        isTimeFree ? timeLeft++ : timeLeft--;
        if(!isTimeFree && timeLeft <= 0) { clearInterval(timerInterval); window.exitTest(true); return; }
        const h = Math.floor(timeLeft/3600), m = Math.floor((timeLeft%3600)/60), s = timeLeft%60;
        document.getElementById('timer-display').textContent = `${h>0?h+':':''}${m.toString().padStart(2,'0')}:${s.toString().padStart(2,'0')}`;
        
        // ✨ NEW: Exam Urgency Simulator (Triggers under 5 minutes)
        const wrapper = document.getElementById('timer-wrapper');
        const dot = document.getElementById('timer-dot');
        const display = document.getElementById('timer-display');
        
        if (wrapper && dot && display) {
            if (!isTimeFree && timeLeft > 0 && timeLeft <= 300) {
                // Urgent State (Red Pulse)
                wrapper.className = "bg-rose-100 rounded-full px-6 py-1.5 flex items-center gap-3 shadow-md border-2 border-rose-400 animate-pulse transition-all duration-300";
                dot.className = "w-2 h-2 rounded-full bg-rose-600 animate-ping";
                display.className = "font-mono text-xl font-bold text-rose-700 tracking-widest drop-shadow-sm";
            } else {
                // Safe State (Dark Slate / Emerald)
                wrapper.className = "bg-slate-800 rounded-full px-6 py-1.5 flex items-center gap-3 shadow-md border border-slate-700 transition-all duration-300";
                dot.className = "w-2 h-2 rounded-full bg-emerald-400 animate-pulse";
                display.className = "font-mono text-xl font-bold text-white tracking-widest drop-shadow-sm";
            }
        }
      }, 1000);
      
      initResizer(); renderPart(0);
    }

    function initResizer() {
      if (window._resizersAttached) return;
      window._resizersAttached = true;
      
      const examResizer = document.getElementById('resizer');
      const examLeft = document.getElementById('passage-container');
      const examSplit = document.getElementById('split-container');
      
      const revResizer = document.getElementById('review-resizer');
      const revLeft = document.getElementById('review-left-pane');
      const revSplit = document.getElementById('review-split-container');

      const buildResizer = document.getElementById('builder-resizer');
      const buildLeft = document.getElementById('builder-left');
      const buildSplit = document.getElementById('builder-split');

      const attachDragLogic = (r, l, s) => {
          if (!r || !l || !s) return;
          let activePointerId = null;
          const startDrag = event => {
              if (event.button !== undefined && event.button !== 0) return;
              activePointerId = event.pointerId;
              event.preventDefault();
              document.body.style.cursor = getComputedStyle(s).flexDirection.startsWith('column') ? 'row-resize' : 'col-resize';
              l.style.userSelect = 'none';
              r.style.background = '#60a5fa';
          };

          const onDrag = event => {
              if (activePointerId === null || event.pointerId !== activePointerId) return;
              event.preventDefault();
              const rect = s.getBoundingClientRect();
              const isVertical = getComputedStyle(s).flexDirection.startsWith('column');
              const size = isVertical ? rect.height : rect.width;
              const offset = isVertical ? event.clientY - rect.top : event.clientX - rect.left;
              if (!size) return;
              const percentage = Math.max(15, Math.min((offset / size) * 100, 85));
              if (isVertical) {
                  l.style.height = `${percentage}%`;
              } else {
                  l.style.width = `${percentage}%`;
              }
              l.style.flex = 'none';
          };

          const endDrag = event => {
              if (activePointerId === null || event.pointerId !== activePointerId) return;
              activePointerId = null;
              document.body.style.cursor = '';
              l.style.userSelect = '';
              r.style.background = '';
          };

          r.addEventListener('pointerdown', startDrag);
          document.addEventListener('pointermove', onDrag, { passive: false });
          document.addEventListener('pointerup', endDrag);
          document.addEventListener('pointercancel', endDrag);
      };

      attachDragLogic(examResizer, examLeft, examSplit);
      attachDragLogic(revResizer, revLeft, revSplit);
      attachDragLogic(buildResizer, buildLeft, buildSplit);
    }

    function startListeningAudio() {
        const audio = getActiveListeningPlayback();
        if (audio) {
            if (!audio.isYouTube) {
                audio.muted = false;
                audio.volume = 1;
            }
            audio.play().catch(e => console.error("Audio playback error:", e));
        }
        document.getElementById('listening-exam-overlay').classList.add('hidden');
        document.getElementById('listening-exam-overlay').classList.remove('flex');
    }
    window.toggleSampleAnswer = function() {
        const content = document.getElementById('sample-answer-content');
        const label = document.getElementById('sample-answer-toggle-label');
        if (!content) return;
        const nowHidden = content.classList.toggle('hidden');
        if (label) label.textContent = nowHidden ? 'Show Sample Answer' : 'Hide Sample Answer';
        if (nowHidden && window.speechSynthesis) {
            sampleSpeechRunId++;
            window.speechSynthesis.cancel();
            const speechButton = document.getElementById('sample-answer-speech-button');
            if (speechButton) speechButton.textContent = '🔊 Listen to Sample Answer';
            clearSpeechWordHighlight(content);
        }
    };
    let sampleSpeechRunId = 0;
    function isVietnameseSpeech(text) {
        if (/[ăâđêôơưĂÂĐÊÔƠƯ]/.test(text)) return true;
        const vietnameseMarkers = /\b(xin chào|cảm ơn|tôi|bạn|mình|là|và|không|những|được|có|này|cho|một|người|thích|quê|nhà)\b/i;
        return vietnameseMarkers.test(text);
    }
    function getSpeechVoice(language) {
        const voices = window.speechSynthesis.getVoices();
        const matchingVoices = voices.filter(voice => voice.lang.toLowerCase().startsWith(language));
        if (language === 'vi') return matchingVoices[0];
        return matchingVoices.find(voice => voice.lang.toLowerCase() === 'en-gb') || matchingVoices[0];
    }
    function prepareSpeechWordMarkup(content) {
        if (content.querySelector('.speech-word')) return;
        const walker = document.createTreeWalker(content, NodeFilter.SHOW_TEXT);
        const textNodes = [];
        let node;
        while (node = walker.nextNode()) textNodes.push(node);
        textNodes.forEach(textNode => {
            const fragment = document.createDocumentFragment();
            textNode.nodeValue.split(/(\s+)/).forEach(part => {
                if (/\s+/.test(part)) {
                    fragment.appendChild(document.createTextNode(part));
                } else if (part) {
                    const word = document.createElement('span');
                    word.className = 'speech-word';
                    word.textContent = part;
                    fragment.appendChild(word);
                }
            });
            textNode.parentNode.replaceChild(fragment, textNode);
        });
    }
    function clearSpeechWordHighlight(content) {
        content.querySelectorAll('.speech-word.is-speaking').forEach(word => word.classList.remove('is-speaking'));
    }
    window.toggleSampleAnswerSpeech = function() {
        const content = document.getElementById('sample-answer-content');
        const button = document.getElementById('sample-answer-speech-button');
        if (!content || !button) return;
        if (!('speechSynthesis' in window) || !('SpeechSynthesisUtterance' in window)) {
            button.textContent = 'Speech unavailable';
            button.disabled = true;
            return;
        }

        if (window.speechSynthesis.speaking || window.speechSynthesis.pending) {
            sampleSpeechRunId++;
            window.speechSynthesis.cancel();
            button.textContent = '🔊 Listen to Sample Answer';
            clearSpeechWordHighlight(content);
            return;
        }

        const text = content.textContent.trim();
        if (!text) return;
        prepareSpeechWordMarkup(content);
        const wordElements = Array.from(content.querySelectorAll('.speech-word'));
        const segments = text.match(/[^.!?。！？]+[.!?。！？]+|[^.!?。！？]+$/g) || [text];
        const runId = ++sampleSpeechRunId;
        let segmentIndex = 0;
        let segmentWordStart = 0;
        const highlightWord = wordIndex => {
            clearSpeechWordHighlight(content);
            const word = wordElements[wordIndex];
            if (word) {
                word.classList.add('is-speaking');
                word.scrollIntoView({ behavior: 'auto', block: 'nearest' });
            }
        };
        const speakNextSegment = () => {
            if (runId !== sampleSpeechRunId || segmentIndex >= segments.length) {
                if (runId === sampleSpeechRunId) {
                    clearSpeechWordHighlight(content);
                    button.textContent = '🔊 Listen to Sample Answer';
                }
                return;
            }

            const segment = segments[segmentIndex++].trim();
            if (!segment) return speakNextSegment();
            const currentSegmentWordStart = segmentWordStart;
            segmentWordStart += (segment.match(/\S+/g) || []).length;
            const language = isVietnameseSpeech(segment) ? 'vi' : 'en';
            const utterance = new SpeechSynthesisUtterance(segment);
            utterance.lang = language === 'vi' ? 'vi-VN' : 'en-GB';
            utterance.voice = getSpeechVoice(language);
            utterance.rate = 0.9;
            utterance.onstart = () => {
                button.textContent = '⏹️ Stop Listening';
                highlightWord(currentSegmentWordStart);
            };
            utterance.onboundary = event => {
                const spokenWordCount = (segment.slice(0, event.charIndex).match(/\S+/g) || []).length;
                highlightWord(currentSegmentWordStart + spokenWordCount);
            };
            utterance.onend = speakNextSegment;
            utterance.onerror = () => {
                if (runId === sampleSpeechRunId) {
                    clearSpeechWordHighlight(content);
                    button.textContent = '🔊 Listen to Sample Answer';
                }
            };
            window.speechSynthesis.speak(utterance);
        };
        speakNextSegment();
    };
    window.calculateIELTSBand = function(correct, total) {
        if (total === 0) return 0;
        let projected = Math.round((correct / total) * 40); // Standardize to a 40-question scale
        if (projected >= 39) return 9.0;
        if (projected >= 37) return 8.5;
        if (projected >= 35) return 8.0;
        if (projected >= 33) return 7.5;
        if (projected >= 30) return 7.0;
        if (projected >= 27) return 6.5;
        if (projected >= 23) return 6.0;
        if (projected >= 20) return 5.5;
        if (projected >= 16) return 5.0;
        if (projected >= 13) return 4.5;
        if (projected >= 10) return 4.0;
        if (projected >= 7) return 3.5;
        if (projected >= 5) return 3.0;
        if (projected >= 3) return 2.5;
        if (projected >= 2) return 2.0; 
        if (projected >= 1) return 1.0; 
        return 0; 
    };

    window.toggleTranscript = function() {
        const transcriptPanel = document.getElementById('listening-transcript-panel');
        if (!transcriptPanel) return;
        transcriptPanel.classList.toggle('hidden');
    };

    window.readingSpeed = 220;
    window.readingTimer = null;
    window.readingWordIndex = 0;
    window.readingModeActive = false;

    function getReadingDelayMs() {
        const wpm = Number(window.readingSpeed || 220);
        const safeWpm = Number.isFinite(wpm) && wpm > 0 ? wpm : 220;
        return Math.max(120, 60000 / safeWpm);
    }

    function stopReadingMode() {
        window.readingModeActive = false;
        if (window.readingTimer) {
            clearTimeout(window.readingTimer);
            window.readingTimer = null;
        }
        const root = document.getElementById('passage-text-content');
        if (!root) return;
        root.querySelectorAll('.reading-word, .vocab-word').forEach(word => {
            word.classList.remove('is-current', 'is-read');
            word.style.opacity = '1';
            word.style.transform = 'none';
            word.style.filter = 'none';
            word.style.visibility = 'visible';
            word.style.maxWidth = 'none';
            word.style.marginRight = '';
        });
    }

    function ensureReadingWords(root) {
        if (!root) return [];

        const textWalker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
            acceptNode(node) {
                const parent = node.parentElement;
                if (!parent || parent.closest('.drop-zone') || parent.closest('.reading-mode-controls')) {
                    return NodeFilter.FILTER_REJECT;
                }
                if (parent.classList.contains('vocab-word')) {
                    return NodeFilter.FILTER_REJECT;
                }
                return /\S/.test(node.textContent) ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT;
            }
        });

        const textNodes = [];
        while (textWalker.nextNode()) textNodes.push(textWalker.currentNode);

        textNodes.forEach(node => {
            const fragment = document.createDocumentFragment();
            const parts = node.textContent.split(/(\s+)/);
            parts.forEach(part => {
                if (!part) return;
                if (/^\s+$/.test(part)) {
                    fragment.appendChild(document.createTextNode(part));
                    return;
                }
                const span = document.createElement('span');
                span.className = 'reading-word';
                span.textContent = part;
                fragment.appendChild(span);
            });
            node.replaceWith(fragment);
        });

        root.querySelectorAll('.vocab-word').forEach(word => {
            word.classList.add('reading-word');
        });

        return [...root.querySelectorAll('.reading-word')];
    }

    function startReadingMode() {
        const root = document.getElementById('passage-text-content');
        if (!root) return;

        const words = ensureReadingWords(root);
        if (!words.length) return;

        stopReadingMode();
        window.readingModeActive = true;
        window.readingWordIndex = 0;

        const tick = () => {
            if (!window.readingModeActive) return;

            const word = words[window.readingWordIndex];
            if (!word) {
                stopReadingMode();
                return;
            }

            words.forEach((item, index) => {
                item.classList.toggle('is-current', index === window.readingWordIndex);
                item.classList.toggle('is-read', index < window.readingWordIndex);
                if (index < window.readingWordIndex) {
                    item.style.opacity = '0';
                    item.style.transform = 'translateY(-3px)';
                    item.style.filter = 'blur(2px)';
                    item.style.visibility = 'visible';
                    item.style.maxWidth = 'none';
                    item.style.marginRight = '0';
                } else {
                    item.style.opacity = '1';
                    item.style.transform = 'none';
                    item.style.filter = 'none';
                    item.style.visibility = 'visible';
                    item.style.maxWidth = 'none';
                    item.style.marginRight = '';
                }
            });

            word.classList.add('is-current');
            word.style.opacity = '1';
            word.style.transform = 'none';
            window.readingTimer = setTimeout(() => {
                if (!window.readingModeActive) return;
                word.classList.remove('is-current');
                word.classList.add('is-read');
                word.style.opacity = '0';
                word.style.transform = 'translateY(-3px)';
                word.style.filter = 'blur(2px)';
                word.style.visibility = 'visible';
                word.style.maxWidth = 'none';
                word.style.marginRight = '0';
                window.readingWordIndex += 1;
                if (window.readingWordIndex < words.length) {
                    tick();
                } else {
                    stopReadingMode();
                }
            }, getReadingDelayMs());
        };

        tick();
    }

    window.setReadingSpeed = function(value) {
        const speed = Number(value);
        if (!Number.isFinite(speed) || speed <= 0) return;
        window.readingSpeed = speed;
        const input = document.getElementById('reading-speed-input');
        if (input) input.value = String(Math.round(speed));
        if (window.readingModeActive) {
            startReadingMode();
        }
    };

    window.pauseReadingMode = function() {
        if (window.readingTimer) {
            clearTimeout(window.readingTimer);
            window.readingTimer = null;
        }
        window.readingModeActive = false;
    };

    window.toggleReadingMode = function() {
        if (window.readingModeActive) {
            window.pauseReadingMode();
            return;
        }
        startReadingMode();
    };

    window.captureSyntaxChunkSelection = function() {
        const root = document.getElementById('passage-text-content');
        const selection = window.getSelection();
        if (!root || !selection || selection.rangeCount === 0 || selection.isCollapsed) return;
        const range = selection.getRangeAt(0);
        if (root.contains(range.commonAncestorContainer)) {
            savedSyntaxChunkSelection = range.cloneRange();
        }
    };

    window.applySyntaxChunk = function(role) {
        const roleLabels = {
            subject: 'Chủ ngữ / Subject',
            verb: 'Động từ / Verb',
            object: 'Tân ngữ / Object'
        };
        const root = document.getElementById('passage-text-content');
        const status = document.getElementById('syntax-chunking-status');
        const selection = window.getSelection();
        if (!root || !roleLabels[role]) return;

        const selectedRange = selection && selection.rangeCount > 0 && !selection.isCollapsed
            ? selection.getRangeAt(0)
            : null;
        const range = selectedRange && root.contains(selectedRange.commonAncestorContainer)
            ? selectedRange
            : savedSyntaxChunkSelection;
        if (!range || !root.contains(range.commonAncestorContainer) || range.collapsed) {
            if (status) status.textContent = 'Chọn một cụm từ trong đoạn văn trước khi gán nhãn.';
            return;
        }

        const getParagraph = node => (node.nodeType === 1 ? node : node.parentElement)?.closest('p');
        const startParagraph = getParagraph(range.startContainer);
        const endParagraph = getParagraph(range.endContainer);
        if (!startParagraph || startParagraph !== endParagraph) {
            if (status) status.textContent = 'Hãy chọn cụm từ trong cùng một đoạn văn.';
            return;
        }

        const overlapsChunk = [...root.querySelectorAll('.syntax-chunk')].some(chunk => range.intersectsNode(chunk));
        if (overlapsChunk) {
            if (status) status.textContent = 'Xoá nhãn hiện tại trước khi gán nhãn chồng lên cụm từ.';
            return;
        }

        const chunk = document.createElement('span');
        chunk.className = `syntax-chunk syntax-chunk--${role}`;
        chunk.dataset.syntaxRole = role;
        chunk.setAttribute('aria-label', roleLabels[role]);
        chunk.appendChild(range.extractContents());
        range.insertNode(chunk);
        selection?.removeAllRanges();
        savedSyntaxChunkSelection = null;
        if (status) status.textContent = `Đã đánh dấu ${roleLabels[role]}.`;
    };

    window.clearSyntaxChunks = function() {
        const root = document.getElementById('passage-text-content');
        if (!root) return;
        root.querySelectorAll('.syntax-chunk').forEach(chunk => {
            chunk.replaceWith(...chunk.childNodes);
        });
        savedSyntaxChunkSelection = null;
        const status = document.getElementById('syntax-chunking-status');
        if (status) status.textContent = 'Đã xoá các nhãn cấu trúc câu.';
    };

    window.updateScaffoldedWriting = function(questionId, textarea) {
      const questionEditor = textarea?.closest('[data-writing-scaffold-question]');
      if (!questionEditor) return;
      const blocks = Array.from(questionEditor.querySelectorAll('[data-writing-scaffold-block]'));
      const answer = window.combineScaffoldedWritingBlocks?.(blocks.map(block => block.value)) || '';
      const wordCount = answer.trim().split(/\s+/).filter(Boolean).length;
      const count = questionEditor.querySelector('[data-writing-scaffold-count]');
      const analysis = questionEditor.querySelector('[data-writing-analysis]');
      if (count) count.textContent = String(wordCount);
      if (analysis && window.renderWritingTextAnalyzer) {
          analysis.innerHTML = window.renderWritingTextAnalyzer(answer);
      }
      handleAns(questionId, answer);
    };

    window.updateWritingEssay = function(questionId, textarea) {
      handleAns(questionId, textarea.value);
      const count = document.getElementById(`wc-${questionId}`);
      const analysis = document.getElementById(`writing-analysis-${questionId}`);
      if (count) count.textContent = String(textarea.value.trim().split(/\s+/).filter(Boolean).length);
      if (analysis && window.renderWritingTextAnalyzer) {
          analysis.innerHTML = window.renderWritingTextAnalyzer(textarea.value);
      }
    };

    function renderReadingControls() {
        return `
          <div class="reading-mode-controls">
            <button type="button" onclick="window.toggleReadingMode()">${window.readingModeActive ? 'Pause' : 'Read'}</button>
            <label for="reading-speed-input">WPM</label>
            <input id="reading-speed-input" type="number" min="40" max="800" step="10" value="${Math.round(window.readingSpeed || 220)}" oninput="window.setReadingSpeed(this.value)" />
          </div>
        `;
    }

    function renderPart(idx) {
      if (isSpeakingSimulationLocked()) return;
      finalizeCurrentQuestionTiming();
      currentPartIdx = idx; currentBlockIdx = 0;
      document.getElementById('part-indicator').textContent = `Part ${idx + 1} of ${APP_DATA.parts.length}`;
      const p = APP_DATA.parts[idx];
      
      let pText = p.text || '';
      [...pText.matchAll(/{drop:(\d+)}/g)].forEach(m => {
        const id = Number(m[1]), ans = answers[id]||'';
        const cls = ans ? 'bg-blue-100 border-blue-600 text-blue-900 cursor-grab shadow-sm' : 'bg-slate-50 border-slate-300 text-slate-400 border-dashed';
        
        // Check if this specific drop ID belongs to a Matching Headings question
        let isHeading = false;
        p.questions.forEach(q => {
            if (q.type === 'matching_headings' && q.ids.includes(id)) {
                isHeading = true;
            }
        });

        // Apply full-width block styles for headings, and small inline styles for normal gaps
        let layoutClasses = isHeading 
            ? "flex w-full min-h-[44px] px-4 py-2 mb-4 mt-2 text-left items-center justify-start" 
            : "inline-flex min-w-[80px] px-2 h-7 mx-1 align-middle items-center justify-center text-center";

        pText = pText.replace(m[0], `<div class="drop-zone ${layoutClasses} border-2 ${cls} font-bold text-sm rounded transition-colors" ondragover="dragOver(event)" ondragleave="dragLeave(event)" ondrop="drop(event, ${id})" onclick="window.handleDropZoneClick(${id}, event)" ${ans ? `draggable="true" ondragstart="dragStart(event, '${ans.replace(/'/g,"\\'")}', ${id})"` : ''}>${ans}</div>`);
      });
     
      

      let htmlText = pText.split('\n\n').map(para => para.trim() ? `<p>${para}</p>` : '').join('');
      readingControls = (typeof isTimeFree !== 'undefined' && isTimeFree && APP_DATA.module === 'reading') ? `
        <div class="reading-mode-controls">
            <button id="btn-skimming-play" onclick="window.startSkimming()" style="display:inline-flex; align-items:center; gap:4px;">▶ Play</button>
            <button id="btn-skimming-pause" onclick="window.pauseSkimming()" style="display:none; align-items:center; gap:4px; background-color:#fef3c7; color:#92400e; border-color:#fcd34d;">⏸ Pause</button>
            <button onclick="window.restartSkimming()" style="background-color:#f1f5f9; color:#475569; border-color:#cbd5e1;">🔄 Restart</button>
            <div style="width:1px; height:20px; background-color:#bfdbfe; margin:0 4px;"></div>
            <button onclick="window.skipSkimmingParagraph(-1)" title="Previous Paragraph" style="background-color:#ffffff; color:#475569; border-color:#cbd5e1;">⏪ Prev</button>
            <button onclick="window.skipSkimmingParagraph(1)" title="Next Paragraph" style="background-color:#ffffff; color:#475569; border-color:#cbd5e1;">Next ⏩</button>
            <div style="width:1px; height:20px; background-color:#bfdbfe; margin:0 4px;"></div>
            <label>WPM</label>
            <input type="number" id="reading-speed-input" value="220" min="50" max="1000" onchange="window.updateSkimmingSpeed()">
        </div>` : '';

      let studyToggles = '';
      
      if (isTimeFree) {
          if (APP_DATA.grammar && APP_DATA.grammar.length > 0) {
              APP_DATA.grammar.forEach((g, gIdx) => {
                  const cleanTerm = g.term.replace(/^[^a-zA-Z0-9]+|[^a-zA-Z0-9]+$/g, '');
                  if (!cleanTerm) return;
                  const regex = new RegExp(`(?![^<]*>)\\b(${cleanTerm.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})\\b`, 'gi');
                  htmlText = htmlText.replace(regex, `<span class="grammar-word" onclick="showGrammarPop(event, ${gIdx})">$1</span>`);
              });
          }
          if (APP_DATA.vocab && APP_DATA.vocab.length > 0) {
              APP_DATA.vocab.forEach((v, vIdx) => {
                  const cleanTerm = v.term.replace(/^[^a-zA-Z0-9]+|[^a-zA-Z0-9]+$/g, '');
                  if (!cleanTerm) return;
                  const regex = new RegExp(`(?![^<]*>)\\b(${cleanTerm.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})\\b`, 'gi');
                  htmlText = htmlText.replace(regex, `<span class="vocab-word" onclick="showVocabPop(event, ${vIdx})">$1</span>`);
              });
          }
          
          if ((APP_DATA.vocab && APP_DATA.vocab.length > 0) || (APP_DATA.grammar && APP_DATA.grammar.length > 0)) {
              studyToggles = `
              <div class="flex flex-wrap gap-4 mb-6 p-4 bg-white border border-slate-200 rounded-xl shadow-sm justify-start md:justify-center w-full">
                  <label class="flex items-center gap-2 text-sm font-bold text-slate-700 cursor-pointer select-none hover:text-blue-600 transition">
                      <input type="checkbox" checked onchange="document.getElementById('passage-container').classList.toggle('hide-vocab', !this.checked)" class="w-4 h-4 text-blue-600 rounded"> 💡 Show Vocab Highlights
                  </label>
                  <label class="flex items-center gap-2 text-sm font-bold text-slate-700 cursor-pointer select-none hover:text-emerald-600 transition">
                      <input type="checkbox" checked onchange="document.getElementById('passage-container').classList.toggle('hide-grammar', !this.checked)" class="w-4 h-4 text-emerald-600 rounded"> 🪄 Show Grammar Highlights
                  </label>
              </div>`;
          }
      }

      let media = '';
      if(p.audioUrl && APP_DATA.module === 'listening') media += `<audio controls src="${p.audioUrl}" class="w-full h-10 mb-4 rounded"></audio>`;
      let visualHtml = '';
      let chartsToRender = [];
      if (isWritingTask1Part(p) && Array.isArray(p.interactiveCharts) && p.interactiveCharts.length > 0) {
          chartsToRender = p.interactiveCharts;
      } else if (isWritingTask1Part(p) && p.interactiveChart) {
          chartsToRender = [p.interactiveChart];
      }

      if (chartsToRender.length > 0) {
          visualHtml = `<div class="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">`;
          chartsToRender.forEach((chart, chartIndex) => {
              const singleChartClass = chartsToRender.length === 1 ? 'md:col-span-2' : '';
              visualHtml += `
                  <div class="interactive-chart-frame ${singleChartClass} bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
                      <canvas id="student-exam-chart-${chartIndex}"></canvas>
                  </div>
              `;
          });
          visualHtml += `</div>`;
          visualHtml += window.createStudentChartComparisonPanel(chartsToRender);
      } else if (p.image && APP_DATA.module !== 'writing') {
          visualHtml = `<img src="${p.image}" class="w-full rounded-xl shadow-sm mb-6 object-contain max-h-[400px] cursor-zoom-in" onclick="openLightbox(this.src)">`;
      }
      media += visualHtml;
      
      const passageContainer = document.getElementById('passage-container');
      const resizer = document.getElementById('resizer');
      const listeningOverlay = document.getElementById('listening-exam-overlay');
      const examAudio = document.getElementById('exam-listening-audio');
            const listeningTranscriptHtml = renderKaraokeTranscript(p) || renderListeningTranscript(p);

      window.listeningMediaInjection = '';
      window.createListeningVideoCard = function(playerId, videoUrl, showTranscriptButton = false) {
          const transcriptButton = showTranscriptButton
              ? '<button onclick="toggleTranscript()" class="youtube-embed-transcript-btn" title="Show/Hide Transcript">👁️ Transcript</button>'
              : '';
          const soundcloudEmbedUrl = window.getListeningSoundCloudEmbedUrl(videoUrl);
          if (soundcloudEmbedUrl) {
              return `
                  <div class="youtube-embed-shell">
                      <div class="youtube-embed-card">
                          <iframe id="${playerId}" src="${soundcloudEmbedUrl}" title="SoundCloud player" class="youtube-player-frame" style="border:0;" allow="autoplay; encrypted-media" loading="lazy"></iframe>
                      </div>
                      <div class="youtube-embed-actions">
                          ${transcriptButton}
                      </div>
                  </div>
              `;
          }
          return `
              <div class="youtube-embed-shell">
                  <div class="youtube-embed-card">
                      <div id="${playerId}" class="youtube-player-frame" aria-label="Listening video player"></div>
                  </div>
                  <div class="youtube-embed-actions">
                      ${transcriptButton}
                  </div>
              </div>
          `;
      };

      if (APP_DATA.module === 'listening') {
        const listeningAudioUrl = (p.audioUrl || '').trim();
                    const listeningYoutubeVideoId = window.getListeningYoutubeVideoId(p.audioUrl || '');
                    const listeningSoundCloudEmbedUrl = window.getListeningSoundCloudEmbedUrl(p.audioUrl || '');
                    window.clearListeningMedia('practice-listening-audio', 'practice-youtube-player');
          const notice = document.getElementById('listening-exam-notice');
          const instruction = document.getElementById('listening-exam-instruction');
          const buttonLabel = document.getElementById('listening-exam-button-label');
                    if (notice) notice.textContent = listeningYoutubeVideoId
                            ? 'You will watch and listen to this YouTube clip. Playback is synchronized with the transcript.'
                            : listeningSoundCloudEmbedUrl
                                ? 'You will listen to this SoundCloud track. The embedded player is enabled for the transcript section.'
                                : 'You will be listening to an audio clip during this test. You will not be permitted to pause or rewind the audio while answering the questions.';
          if (instruction) instruction.textContent = 'To continue, click Play.';
          if (buttonLabel) buttonLabel.textContent = 'Play';
          passageContainer.classList.remove('hidden');
          resizer.classList.remove('hidden');
          
          if (listeningAudioUrl) {
              if (listeningYoutubeVideoId || listeningSoundCloudEmbedUrl) {
                  window.listeningMediaInjection = window.createListeningVideoCard('practice-youtube-player', listeningAudioUrl, Boolean(isTimeFree));
                  window.clearListeningMedia('exam-listening-audio', 'exam-listening-youtube-player');
                  if (listeningOverlay) {
                      listeningOverlay.classList.remove('hidden');
                      listeningOverlay.classList.add('flex');
                  }
              } else if (!isTimeFree) {
                  if (examAudio.dataset.audioUrl !== listeningAudioUrl) {
                      window.configureListeningMedia(listeningAudioUrl, 'exam-listening-audio', 'exam-listening-youtube-player');
                      examAudio.dataset.audioUrl = listeningAudioUrl;
                      if (listeningOverlay) {
                          listeningOverlay.classList.remove('hidden');
                          listeningOverlay.classList.add('flex');
                      }
                  }
              } else {
                  // ✨ NEW: Compact single-row layout. No header text, reduced padding, side-by-side elements.
                  window.listeningMediaInjection = `<div class="bg-blue-50 border border-blue-200 p-1.5 rounded-lg shadow-sm flex items-center gap-3"><audio id="practice-listening-audio" controls crossorigin="anonymous" src="${listeningAudioUrl}" class="w-full flex-1 h-9 outline-none"></audio><button onclick="toggleTranscript()" class="shrink-0 text-xs bg-white border border-blue-300 text-blue-700 px-3 py-1.5 rounded shadow hover:bg-blue-100 font-bold transition" title="Show/Hide Transcript">👁️ Transcript</button></div>`;
                  if (examAudio && examAudio.src) { examAudio.pause(); examAudio.src = ''; }
                  if (listeningOverlay) { listeningOverlay.classList.add('hidden'); listeningOverlay.classList.remove('flex'); }
              }
          } else {
              window.clearListeningMedia('exam-listening-audio', 'exam-listening-youtube-player');
              if (listeningOverlay) { listeningOverlay.classList.add('hidden'); listeningOverlay.classList.remove('flex'); }
          }
          passageContainer.style.width = '50%';
          const transcriptPanelHtml = `
              <div id="listening-transcript-panel" class="hidden mt-6 passage-text text-justify">
                  <div class="passage-text font-bold mb-4">${lmsSanitizeHtml(p.title)} (Transcript)</div>
                  ${listeningTranscriptHtml || htmlText}
              </div>
          `;
          const microDictationHtml = window.renderMicroDictation?.(p, Boolean(isTimeFree)) || '';
          passageContainer.innerHTML = `${window.listeningMediaInjection || ''}${studyToggles}${microDictationHtml}${transcriptPanelHtml}`;
          if (microDictationHtml) window.initMicroDictation?.(p);
          const listeningPlayback = listeningYoutubeVideoId
              ? window.configureListeningMedia(listeningAudioUrl, 'practice-listening-audio', 'practice-youtube-player', { controls: Boolean(isTimeFree) })
              : getActiveListeningPlayback();
          wireKaraokeAudio(listeningPlayback, passageContainer);
      } else if (APP_DATA.module === 'writing' || APP_DATA.module === 'speaking') {
          passageContainer.classList.remove('hidden');
          resizer.classList.remove('hidden');
          passageContainer.style.width = '50%'; 
          
          // ✨ FIX: Grab the Part Title (which acts as the main essay prompt for Writing)
          const titleHtml = p.title ? `<div class="passage-text font-bold mb-6 text-lg">${lmsSanitizeHtml(p.title)}</div>` : '';
          const speakingQuestionsHtml = APP_DATA.module === 'speaking' && p.speakingQuestions
              ? `<section class="passage-text mb-6"><h2 class="font-bold text-base mb-2">Questions</h2><div class="leading-relaxed">${p.speakingQuestions}</div></section>`
              : '';
          
          let examPromptHtml = p.questions.map((q) => {
              let html = '';
              if (q.instruction && q.instruction !== '<br>' && q.instruction !== '<p><br></p>') {
                  html += `<div class="text-[1.05rem] font-bold text-slate-800 mb-2">${q.instruction}</div>`;
              }
              if (q.text && q.text !== '<br>' && q.text !== '<p><br></p>') {
                  html += `<div class="text-[1.05rem] text-slate-800 leading-relaxed mb-6 font-bold">${q.text}</div>`;
              }
              return html;
          }).join('');
          
          if (!isTimeFree) {
              // ✨ FIX: Inject the titleHtml at the very top of the passage container!
              passageContainer.innerHTML = `${titleHtml}${speakingQuestionsHtml}${examPromptHtml}${media}`;
          } else {
              let sampleAnswerBlock = '';
              const mindMapHtml = window.renderDynamicMindMap?.(
                  p,
                  APP_DATA.vocab,
                  `${APP_DATA.id || 'test'}-part-${currentPartIdx}`,
                  APP_DATA.topics
              ) || '';
              if (mindMapHtml) {
                  sampleAnswerBlock = mindMapHtml;
              } else {
                  const sampleText = (p.text || '').trim();
                  if (sampleText && sampleText !== '<br>' && sampleText !== '<p><br></p>') {
                      const speechButton = APP_DATA.module === 'speaking' ? `
                          <button type="button" id="sample-answer-speech-button" onclick="window.toggleSampleAnswerSpeech()" class="text-xs font-bold bg-amber-500 text-white border border-amber-600 px-4 py-2.5 rounded-lg shadow-sm hover:bg-amber-600 transition flex items-center gap-2" aria-label="Listen to sample answer">
                              🔊 Listen to Sample Answer
                          </button>` : '';
                      sampleAnswerBlock = `
                      <div class="mt-8 pt-6 border-t border-slate-200 w-full">
                          <div class="flex flex-wrap items-center gap-2">
                            <button type="button" onclick="window.toggleSampleAnswer()" class="text-xs font-bold bg-white border border-slate-300 text-slate-700 px-4 py-2.5 rounded-lg shadow-sm hover:bg-slate-50 transition flex items-center gap-2">
                              👁️ <span id="sample-answer-toggle-label">Show Sample Answer</span>
                            </button>${speechButton}
                          </div>
                          <div id="sample-answer-content" class="hidden mt-4 passage-text text-justify bg-blue-50/50 border border-blue-200 rounded-xl p-6 shadow-inner text-base text-slate-800 leading-relaxed">${htmlText}</div>
                      </div>`;
                  }
              }
              // ✨ FIX: Inject the titleHtml here as well!
              passageContainer.innerHTML = `${titleHtml}${speakingQuestionsHtml}${examPromptHtml}${media}${sampleAnswerBlock}`;
              if (mindMapHtml) window.initDynamicMindMap?.(passageContainer);
          }

          if (examAudio && examAudio.src) { examAudio.pause(); examAudio.src = ''; }
          if (listeningOverlay) { listeningOverlay.classList.add('hidden'); listeningOverlay.classList.remove('flex'); }
      } else {
          // CLEAN STANDARD LAYOUT (Reading)
          passageContainer.classList.remove('hidden');
          resizer.classList.remove('hidden');
          passageContainer.style.width = '50%'; 

          const showReadingControls = APP_DATA.module === 'reading' && isTimeFree;
          const readingControls = showReadingControls ? renderReadingControls() : '';

          // Shows Title, Image/Chart (if provided), and the main Passage Text/Prompt. 
          
          // Overriding any legacy reading controls with our new advanced speed-reading panel
          let advancedReadingControls = (typeof isTimeFree !== 'undefined' && isTimeFree && APP_DATA.module === 'reading') ? `
            <div class="reading-mode-controls">
                <button id="btn-skimming-play" onclick="window.startSkimming()" style="display:inline-flex; align-items:center; gap:4px;">▶ Play</button>
                <button id="btn-skimming-pause" onclick="window.pauseSkimming()" style="display:none; align-items:center; gap:4px; background-color:#fef3c7; color:#92400e; border-color:#fcd34d;">⏸ Pause</button>
                <button onclick="window.restartSkimming()" style="background-color:#f1f5f9; color:#475569; border-color:#cbd5e1;">🔄 Restart</button>
                <div style="width:1px; height:20px; background-color:#bfdbfe; margin:0 4px;"></div>
                <button onclick="window.skipSkimmingParagraph(-1)" title="Previous Paragraph" style="background-color:#ffffff; color:#475569; border-color:#cbd5e1;">⏪ Prev</button>
                <button onclick="window.skipSkimmingParagraph(1)" title="Next Paragraph" style="background-color:#ffffff; color:#475569; border-color:#cbd5e1;">Next ⏩</button>
                <div style="width:1px; height:20px; background-color:#bfdbfe; margin:0 4px;"></div>
                <label>WPM</label>
                <input type="number" id="reading-speed-input" value="220" min="50" max="1000" onchange="window.updateSkimmingSpeed()">
            </div>` : '';

          const syntaxChunkingControls = APP_DATA.module === 'reading' ? `
            <div class="syntax-chunking-controls" aria-label="Syntax highlighting and chunking tools">
                <strong>Syntax Chunking / Phân tích cấu trúc câu</strong>
                <span>Select text inside one paragraph, then choose a label:</span>
                <button type="button" class="syntax-chunking-button syntax-chunking-button--subject" onpointerdown="window.captureSyntaxChunkSelection()" onmousedown="event.preventDefault()" onclick="window.applySyntaxChunk('subject')">Chủ ngữ · S</button>
                <button type="button" class="syntax-chunking-button syntax-chunking-button--verb" onpointerdown="window.captureSyntaxChunkSelection()" onmousedown="event.preventDefault()" onclick="window.applySyntaxChunk('verb')">Động từ · V</button>
                <button type="button" class="syntax-chunking-button syntax-chunking-button--object" onpointerdown="window.captureSyntaxChunkSelection()" onmousedown="event.preventDefault()" onclick="window.applySyntaxChunk('object')">Tân ngữ · O</button>
                <button type="button" class="syntax-chunking-clear" onmousedown="event.preventDefault()" onclick="window.clearSyntaxChunks()">Xoá nhãn</button>
                <span id="syntax-chunking-status" class="syntax-chunking-status" role="status" aria-live="polite">Công cụ giúp bạn đọc theo cụm thay vì dịch từng từ.</span>
            </div>` : '';

          passageContainer.innerHTML = `${advancedReadingControls}${syntaxChunkingControls}${studyToggles}<div class="passage-text font-bold mb-6">${lmsSanitizeHtml(p.title)}</div>${media}<div id="passage-text-content" class="passage-text text-justify">${htmlText}</div>`;
          const speedInput = document.getElementById('reading-speed-input');
          if (speedInput) {
              speedInput.value = String(Math.round(window.readingSpeed || 220));
          }
          
          if (examAudio && examAudio.src) { examAudio.pause(); examAudio.src = ''; }
          if (listeningOverlay) { listeningOverlay.classList.add('hidden'); listeningOverlay.classList.remove('flex'); }
      }

      if (chartsToRender.length > 0) {
          setTimeout(() => {
              if (APP_DATA.parts[currentPartIdx] !== p) return;
              const pointColorMap = window.getChartPointColorMap(chartsToRender);
              const legendOwnerIndex = window.getChartLegendOwnerIndex(chartsToRender);
              chartsToRender.forEach((chart, chartIndex) => {
                  window.renderCanvasChart(
                      `student-exam-chart-${chartIndex}`,
                      window.getChartConfigInReferenceOrder(chartsToRender, chartIndex),
                      pointColorMap,
                      { part: p, charts: chartsToRender, chartIndex },
                      { showLegend: chartIndex === legendOwnerIndex }
                  );
              });
              window.updateStudentChartComparison(p, chartsToRender);
          }, 0);
      }
      
      renderQuestions(); 
      activateQuestionBlock(currentPartIdx, currentBlockIdx);
      updateExamUI();
      restoreHighlights();
      if (APP_DATA.module === 'speaking' && window.isSpeakingPartTwoSimulation &&
          currentPartIdx === window.speakingSimulationPartIndex) {
          startSpeakingPartTwoSimulation();
      }
    }
    
    function positionLookupPopover(popover, anchor) {
      positionSelectionTooltip(popover, anchor);

      const arrow = popover.querySelector('.arrow');
      if (!arrow || ['left', 'right'].includes(popover.dataset.placement)) return;

      const popoverRect = popover.getBoundingClientRect();
      const anchorCenter = anchor.left + anchor.width / 2;
      const arrowInset = 12;
      const arrowLeft = Math.max(arrowInset, Math.min(anchorCenter - popoverRect.left, popoverRect.width - arrowInset));
      arrow.style.left = `${arrowLeft}px`;
    }

    function showVocabPop(e, idx) {
      e.stopPropagation(); const v = APP_DATA.vocab[idx]; if(!v) return;
      document.getElementById('vp-term').textContent = v.term;
      document.getElementById('vp-pron').textContent = v.pron || ''; document.getElementById('vp-pron').classList.toggle('hidden', !v.pron);
      document.getElementById('vp-eng').innerHTML = v.eng ? `<b>EN:</b> ${v.eng}` : '';
      document.getElementById('vp-vi').innerHTML = v.vi ? `<b>VI:</b> ${v.vi}` : '';
      
      const lvlEl = document.getElementById('vp-lvl');
      lvlEl.textContent = v.lvl || ''; lvlEl.classList.toggle('hidden', !v.lvl);
      
      const affixEl = document.getElementById('vp-affix');
      let affixHtml = [];
      if (v.pref) affixHtml.push(`Prefix: <span class="text-emerald-800">${v.pref}</span>`);
      if (v.suf) affixHtml.push(`Suffix: <span class="text-emerald-800">${v.suf}</span>`);
      affixEl.innerHTML = affixHtml.join(' &nbsp;|&nbsp; ');
      affixEl.classList.toggle('hidden', affixHtml.length === 0);

      const extrasEl = document.getElementById('vp-extras');
      let extraHtml = [];
      if (v.syn) extraHtml.push(`<div><b class="text-slate-400">Synonyms:</b> <span class="text-blue-600 font-medium">${v.syn}</span></div>`);
      if (v.ant) extraHtml.push(`<div><b class="text-slate-400">Antonyms:</b> <span class="text-rose-500 font-medium">${v.ant}</span></div>`);
      extrasEl.innerHTML = extraHtml.join('');
      extrasEl.classList.toggle('hidden', extraHtml.length === 0);
      
      const pop = document.getElementById('vocab-popover'); 
      const rect = (e.currentTarget || e.target).getBoundingClientRect();
      positionLookupPopover(pop, rect);
    }

    function showGrammarPop(e, idx) {
      e.stopPropagation(); const g = APP_DATA.grammar[idx]; if(!g) return;
      document.getElementById('gp-term').textContent = g.term;
      document.getElementById('gp-type').textContent = g.type || 'Grammar Point';
      document.getElementById('gp-expl').innerHTML = g.expl || '';
      
      const pop = document.getElementById('grammar-popover'); 
      const rect = (e.currentTarget || e.target).getBoundingClientRect();
      positionLookupPopover(pop, rect);
    }
    
    document.addEventListener('mouseup', e => { 
        if(!e.target.closest('#vocab-popover') && !e.target.classList.contains('vocab-word')) document.getElementById('vocab-popover').classList.add('hidden'); 
        if(!e.target.closest('#grammar-popover') && !e.target.classList.contains('grammar-word')) document.getElementById('grammar-popover').classList.add('hidden'); 
    });

    window.locateQuestion = function(questionIndex, event) {
        if (event) event.stopPropagation();
        const part = APP_DATA?.parts?.[currentPartIdx];
        const question = part?.questions?.[questionIndex];
        const status = document.getElementById(`locate-status-${questionIndex}`);
        const passage = document.getElementById('passage-container');
        if (!part || !question || !passage) return;

        if (APP_DATA.module === 'listening' && !isTimeFree) return;
        if (passage.classList.contains('hidden')) window.toggleTranscript();

        const root = APP_DATA.module === 'reading'
            ? document.getElementById('passage-text-content')
            : passage;
        if (!root) return;

        const questionText = document.createElement('div');
        questionText.innerHTML = `${question.instruction || ''} ${question.text || ''}`;
        const stopWords = new Set([
            'about', 'after', 'again', 'against', 'among', 'also', 'been', 'before', 'being', 'between',
            'both', 'could', 'does', 'each', 'from', 'have', 'into', 'more', 'most', 'much', 'must',
            'only', 'other', 'over', 'same', 'some', 'such', 'than', 'that', 'their', 'them', 'then',
            'there', 'these', 'they', 'this', 'those', 'through', 'under', 'very', 'what', 'when',
            'where', 'which', 'while', 'will', 'with', 'would', 'your', 'according', 'answer',
            'following', 'question', 'questions', 'choose', 'select', 'complete', 'write', 'words',
            'letters', 'numbers', 'paragraph', 'passage', 'statement', 'statements', 'information'
        ]);
        const getTerms = text => String(text || '')
            .toLocaleLowerCase()
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '')
            .match(/[\p{L}\p{N}]{3,}/gu) || [];
        const queryTerms = [...new Set(getTerms(questionText.textContent).filter(term => !stopWords.has(term)))];
        const candidates = APP_DATA.module === 'listening'
            ? [...root.querySelectorAll('[data-karaoke-index], [data-listening-index]')]
            : [...root.querySelectorAll('p')].filter(candidate => candidate.textContent.trim());
        if (!candidates.length && root.textContent.trim()) candidates.push(root);
        if (!candidates.length) {
            if (status) status.textContent = 'Không tìm được từ khóa phù hợp trong nội dung.';
            return;
        }

        const normalizeTarget = text => String(text || '').replace(/\s+/g, ' ').trim().toLocaleLowerCase();
        const indexedTarget = Number(question.locateIndex);
        let bestIndex = question.locateText
            && Number.isInteger(indexedTarget)
            && candidates[indexedTarget]
            && normalizeTarget(candidates[indexedTarget].textContent).includes(normalizeTarget(question.locateText))
                ? indexedTarget
                : -1;
        if (bestIndex < 0 && question.locateText) {
            bestIndex = candidates.findIndex(candidate =>
                normalizeTarget(candidate.textContent).includes(normalizeTarget(question.locateText))
            );
        }
        const usedAssignedTarget = bestIndex >= 0 && Boolean(question.locateText);
        if (bestIndex < 0) {
            if (question.locateText) {
                if (status) status.textContent = 'Vị trí đã gán không còn trong passage/script. Giáo viên cần gán lại.';
                return;
            }
            if (!queryTerms.length) {
                if (status) status.textContent = 'Không tìm được từ khóa phù hợp trong nội dung.';
                return;
            }
            const candidateTerms = candidates.map(candidate => new Set(getTerms(candidate.textContent)));
            const documentFrequency = new Map();
            candidateTerms.forEach(terms => terms.forEach(term => {
                documentFrequency.set(term, (documentFrequency.get(term) || 0) + 1);
            }));
            let bestScore = 0;
            candidateTerms.forEach((terms, index) => {
                let score = 0;
                queryTerms.forEach(term => {
                    if (terms.has(term)) {
                        const frequency = documentFrequency.get(term) || 1;
                        score += 1 + Math.log((candidates.length + 1) / frequency);
                    }
                });
                if (score > bestScore) {
                    bestScore = score;
                    bestIndex = index;
                }
            });
        }
        if (bestIndex < 0) {
            if (status) status.textContent = 'Không tìm thấy từ khóa trong passage/transcript.';
            return;
        }

        passage.querySelectorAll('.locate-match').forEach(element => {
            if (element.dataset.locateExact === 'true' && element.parentNode) {
                const parent = element.parentNode;
                while (element.firstChild) parent.insertBefore(element.firstChild, element);
                parent.removeChild(element);
            } else {
                element.classList.remove('locate-match');
            }
        });
        const target = candidates[bestIndex];
        let exactHighlight = false;
        if (question.locateText) {
            const walker = document.createTreeWalker(target, NodeFilter.SHOW_TEXT);
            const textNodes = [];
            let textNode;
            while ((textNode = walker.nextNode())) textNodes.push(textNode);

            let normalizedText = '';
            const positions = [];
            textNodes.forEach(node => {
                const value = node.nodeValue || '';
                for (let offset = 0; offset < value.length; offset++) {
                    const character = value[offset];
                    if (/\s/.test(character)) {
                        if (normalizedText && !normalizedText.endsWith(' ')) {
                            normalizedText += ' ';
                            positions.push({ node, offset });
                        }
                        continue;
                    }
                    const normalizedCharacter = character.toLocaleLowerCase();
                    for (let characterIndex = 0; characterIndex < normalizedCharacter.length; characterIndex++) {
                        normalizedText += normalizedCharacter[characterIndex];
                        positions.push({ node, offset });
                    }
                }
            });

            const normalizedQuery = normalizeTarget(question.locateText);
            const matchStart = normalizedText.indexOf(normalizedQuery);
            if (matchStart >= 0 && normalizedQuery.length > 0) {
                const start = positions[matchStart];
                const end = positions[matchStart + normalizedQuery.length - 1];
                if (start && end) {
                    const range = document.createRange();
                    range.setStart(start.node, start.offset);
                    range.setEnd(end.node, end.offset + 1);
                    const highlight = document.createElement('span');
                    highlight.className = 'locate-match';
                    highlight.dataset.locateExact = 'true';
                    highlight.appendChild(range.extractContents());
                    range.insertNode(highlight);
                    exactHighlight = true;
                }
            }
        }
        if (!exactHighlight) target.classList.add('locate-match');
        target.scrollIntoView({ block: 'center', behavior: 'auto' });

        if (APP_DATA.module === 'listening') {
            const cueIndex = Number(target.dataset.karaokeIndex ?? target.dataset.listeningIndex);
            const audio = getActiveListeningPlayback();
            const savedStart = part.karaoke?.[cueIndex]?.start;
            const karaokeCue = savedStart != null && Number.isFinite(Number(savedStart))
                ? { start: Number(savedStart) }
                : null;
            const cue = karaokeCue && karaokeCue.start !== null
                ? karaokeCue
                : getListeningCues(part, audio && Number.isFinite(audio.duration) ? audio.duration : undefined)[cueIndex];
            if (audio && cue && cue.start !== null && Number.isFinite(Number(cue.start))) {
                audio.currentTime = Math.max(0, Number(cue.start));
                audio.play().catch(error => console.log('Auto-play prevented', error));
            }
            if (status) status.textContent = usedAssignedTarget
                ? `Đã đến vị trí đã gán (câu transcript ${cueIndex + 1}).`
                : `Đã tìm thấy ở câu transcript ${cueIndex + 1}.`;
        } else if (status) {
            status.textContent = usedAssignedTarget
                ? `Đã đến vị trí đã gán (đoạn ${bestIndex + 1}).`
                : `Đã tìm thấy ở đoạn ${bestIndex + 1}.`;
        }
    };

    function renderQuestions() {
      const c = document.getElementById('questions-container'); 
      
      let mediaDiv = document.getElementById('practice-audio-wrapper');
      let qListContainer = document.getElementById('questions-list-container');
      
      if (!qListContainer) {
          // ✨ NEW: Changed top-0 to -top-8 to seal the top gap perfectly, and reduced pb-4 to pb-3
          c.innerHTML = `<div id="practice-audio-wrapper" class="sticky -top-8 z-[60] -mt-8 -mx-8 px-8 pt-8 pb-3 mb-4 border-b border-slate-200 shadow-sm theme-bg-sec empty:hidden"></div><div id="questions-list-container" class="flex flex-col"></div>`;
          mediaDiv = document.getElementById('practice-audio-wrapper');
          qListContainer = document.getElementById('questions-list-container');
      }
      
      if (APP_DATA.module === 'listening') {
          if (mediaDiv.innerHTML !== '') mediaDiv.innerHTML = '';
          mediaDiv.dataset.audioUrl = '';
      } else if (window.listeningMediaInjection) {
          const audioUrl = APP_DATA.parts[currentPartIdx].audioUrl || '';
          if (mediaDiv.dataset.audioUrl !== audioUrl) {
              window.clearListeningMedia('practice-listening-audio', 'practice-youtube-player');
              mediaDiv.innerHTML = window.listeningMediaInjection;
              mediaDiv.dataset.audioUrl = audioUrl;
              if (window.getListeningYoutubeVideoId(audioUrl)) {
                  window.configureListeningMedia(audioUrl, 'practice-listening-audio', 'practice-youtube-player', { controls: isTimeFree });
              }
              wireKaraokeAudio(getListeningPlayback('practice-listening-audio', 'practice-youtube-player'), document.getElementById('passage-container'));
          }
      } else {
          if (mediaDiv.innerHTML !== '') {
              window.clearListeningMedia('practice-listening-audio', 'practice-youtube-player');
              mediaDiv.innerHTML = '';
          }
          mediaDiv.dataset.audioUrl = '';
      }
      
      qListContainer.innerHTML = '';
      
      const makeBadge = (id) => `<span onclick="window.toggleReviewByIds([${id}]); event.stopPropagation();" title="Click to mark Q${id} for review" class="q-badge-single-${id} inline-flex min-w-[28px] h-[28px] px-1.5 bg-white border border-slate-800 text-slate-800 text-sm font-bold items-center justify-center cursor-pointer hover:bg-slate-100 transition shrink-0 select-none align-middle mx-1 rounded-sm">${id}</span>`;

      const highlightVocab = (str) => {
          if (!str || !isTimeFree || !APP_DATA.vocab || APP_DATA.vocab.length === 0) return str;
          let res = str;
          APP_DATA.vocab.forEach((v, vIdx) => {
              const cleanTerm = v.term.replace(/^[^a-zA-Z0-9]+|[^a-zA-Z0-9]+$/g, '');
              if (!cleanTerm) return;
              const regex = new RegExp(`(?![^<]*>)\\b(${cleanTerm.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})\\b`, 'gi');
              res = res.replace(regex, `<span class="vocab-word" onclick="showVocabPop(event, ${vIdx})">$1</span>`);
          });
          return res;
      };

      APP_DATA.parts[currentPartIdx].questions.forEach((q, i) => {
        const div = document.createElement('div'); div.id = `q-block-${i}`; div.className = 'mb-8 p-6 rounded-lg border shadow-sm cursor-pointer transition theme-q-block'; div.onclick = () => { if (isSpeakingSimulationLocked()) return; currentBlockIdx=i; activateQuestionBlock(currentPartIdx, i); updateExamUI(); };
        
        let unplacedIds = new Set(q.ids);
        
        let rawText = q.text || '';
        if (q.type === 'fill_blanks' || q.type === 'dnd_list') {
            q.ids.forEach(id => {
                const regexDrop = new RegExp(`(^|[\\s>])(${id})([\\.\\)]?)\\s*\\{drop:${id}\\}`, 'g');
                rawText = rawText.replace(regexDrop, `$1{drop:${id}}`);
                const regexBlank = new RegExp(`(^|[\\s>])(${id})([\\.\\)]?)\\s*\\{blank:${id}\\}`, 'g');
                rawText = rawText.replace(regexBlank, `$1{blank:${id}}`);
            });
        }
        
        let pt = (str) => {
            if(!str) return '';
            let res = str;
            const sortedIds = [...q.ids].sort((a,b) => b - a); 
            sortedIds.forEach(id => {
                const regex = new RegExp(`(^|[\\s>])(${id})([\\.\\)]?)(?=\\s|<|$)`, 'g');
                if (regex.test(res)) {
                    res = res.replace(regex, `$1${makeBadge(id)} `);
                    unplacedIds.delete(id);
                }
            });
            return highlightVocab(res);
        };

        let content = '';
        const escapeLatexOption = value => String(value).replace(/[&<>"']/g, char => ({
            '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
        })[char]);
        const displayOption = value => q.latexSource ? escapeLatexOption(value) : pt(value);
        const optionAttribute = value => q.latexSource ? escapeLatexOption(value) : value.replace(/'/g, "\\'");
        const optionHandlerArg = value => q.latexSource ? 'this.textContent' : `'${value.replace(/'/g, "\\'")}'`;
        
        if(q.type === 'multiple_choice' || q.type === 'tfng' || q.type === 'ynng') {
           const opts = q.type === 'tfng' ? ['True','False','Not Given'] : (q.type === 'ynng' ? ['Yes','No','Not Given'] : q.options);
           let qText = pt(rawText);
           let remainingInlineBadges = Array.from(unplacedIds).map(id => { unplacedIds.delete(id); return makeBadge(id); }).join('');

           if (q.type === 'multiple_choice' && q.multi) {
               const selectedVals = q.ids.map(id => answers[id]).filter(Boolean);
               content = `<div class="mb-4 flex items-start">${remainingInlineBadges}<div class="pt-1">${qText}</div></div><div class="space-y-2">${opts.map(o => {
                  let oText = displayOption(o); 
                  const isChecked = selectedVals.includes(o);
                  return `<label class="flex items-center space-x-3 cursor-pointer p-2 rounded hover:bg-slate-50"><input type="checkbox" value="${optionAttribute(o)}" ${isChecked?'checked':''} onchange="handleMultiAns('${q.ids.join(',')}', this)" class="w-4 h-4 text-blue-600 rounded border-slate-300"><span>${oText}</span></label>`
               }).join('')}</div>`;
           } else {
               content = `<div class="mb-4 flex items-start">${remainingInlineBadges}<div class="pt-1">${qText}</div></div><div class="space-y-2">${opts.map(o => {
                  let oText = displayOption(o); 
                  return `<label class="flex items-center space-x-3 cursor-pointer p-2 rounded hover:bg-slate-50"><input type="radio" name="q-${q.ids[0]}" value="${optionAttribute(o)}" ${answers[q.ids[0]]===o?'checked':''} onchange="handleAns(${q.ids[0]}, this.value)" class="w-4 h-4 text-blue-600"><span>${oText}</span></label>`
               }).join('')}</div>`;
           }
        } else if(q.type === 'fill_blanks') {
           let txt = pt(rawText); 
           q.ids.forEach(id => {
               unplacedIds.delete(id);
               const ans = answers[id]||'';
               const gapTime = Number(q.timestamps?.[id]);
               const timedGapAttrs = Number.isFinite(gapTime) ? `data-latex-gap-time="${gapTime}"` : '';
               const inputHtml = `<span ${timedGapAttrs} class="${Number.isFinite(gapTime) ? 'latex-timed-gap ' : ''}inline-flex items-center align-middle border border-slate-400 rounded bg-white h-[36px] p-0.5 mx-1 shadow-sm focus-within:border-blue-600 focus-within:ring-1 focus-within:ring-blue-600 transition-all max-w-[calc(100%-8px)]">
                   <span onclick="window.toggleReviewByIds([${id}]); event.stopPropagation();" title="Click to mark Q${id} for review" class="q-badge-single-${id} flex items-center justify-center min-w-[26px] h-[26px] bg-white border border-slate-800 text-slate-800 text-base font-bold rounded-sm cursor-pointer hover:bg-slate-100 transition shrink-0 select-none">${id}</span>
                   <input type="text" value="${ans.replace(/"/g, '&quot;')}" oninput="handleAns(${id}, this.value)" placeholder="" class="px-2 w-20 sm:w-28 flex-1 text-base font-bold text-blue-900 bg-transparent outline-none">
               </span>`;
               txt = txt.split(`{blank:${id}}`).join(inputHtml);
           });
           content = `<div class="leading-relaxed overflow-x-auto w-full pb-2">${txt}</div>`;
        } else if(q.type === 'dnd_list') {
           let txt = pt(rawText);
           q.ids.forEach(id => {
              unplacedIds.delete(id);
              const ans = answers[id]||'';
              const hasAns = !!ans;
              const dropZoneHtml = `<span class="drop-zone inline-flex items-center align-middle rounded bg-white h-[36px] p-0.5 mx-1 transition-all ${hasAns ? 'border-2 border-blue-500 shadow-sm cursor-grab bg-blue-50' : 'border border-dashed border-slate-400'}"
                   ondragover="dragOver(event)" ondragleave="dragLeave(event)" ondrop="drop(event, ${id})" onclick="window.handleDropZoneClick(${id}, event)"
                   ${hasAns ? `draggable="true" ondragstart="dragStart(event, '${ans.replace(/'/g,"\\'")}', ${id})"` : ''}>
                  <span onclick="window.toggleReviewByIds([${id}]); event.stopPropagation();" title="Click to mark Q${id} for review" class="q-badge-single-${id} flex items-center justify-center min-w-[26px] h-[26px] bg-white border border-slate-800 text-slate-800 text-base font-bold rounded-sm cursor-pointer hover:bg-slate-100 transition shrink-0 select-none">${id}</span>
                  <span class="px-2 min-w-[100px] text-center text-base ${hasAns ? 'font-bold text-blue-900' : 'text-slate-400 italic'} pointer-events-none">${hasAns ? ans : 'Drop answer here'}</span>
              </span>`;
              txt = txt.split(`{drop:${id}}`).join(dropZoneHtml);
           });
           
           let availOpts = q.options || [];
           if (!q.reusable) {
               const used = q.ids.map(i => answers[i]).filter(Boolean);
               availOpts = availOpts.filter(o => { if(used.includes(o)) { used.splice(used.indexOf(o), 1); return false; } return true; });
           }

           // ✨ NEW: Removed explicit text-sizes so .draggable-item inherits the global scalable font size. Increased px/py paddings.
           if (APP_DATA.module === 'listening') {
               content = `<div class="flex flex-col md:flex-row flex-wrap gap-8 items-start justify-start w-full"><div class="leading-relaxed overflow-x-auto max-w-full">${txt}</div><div class="w-full sm:w-auto min-w-[140px] shrink-0 p-3 bg-slate-50 border border-slate-100 rounded-xl drop-zone-options transition-colors" ondragover="optionsDragOver(event)" ondragleave="optionsDragLeave(event)" ondrop="returnToOptions(event)"><p class="italic text-xs text-slate-500 mb-2 font-medium"></p><div class="flex flex-col gap-2 min-h-[32px] items-start">${availOpts.map(o => `<div draggable="true" ondragstart="dragStart(event, ${optionHandlerArg(o)})" onclick="window.mobileTapSelect(event, this, ${optionHandlerArg(o)})" class="draggable-item bg-white border border-slate-200 rounded px-3 py-1.5 min-w-[40px] text-center leading-snug font-medium text-slate-700 shadow-sm hover:border-blue-300 hover:text-blue-700 transition cursor-grab inline-block max-w-fit">${displayOption(o)}</div>`).join('')}</div></div></div>`;
           } else {
               content = `<div class="mb-5 leading-relaxed">${txt}</div><div class="p-4 bg-slate-50 border border-slate-100 rounded-xl drop-zone-options transition-colors" ondragover="optionsDragOver(event)" ondragleave="optionsDragLeave(event)" ondrop="returnToOptions(event)"><p class="italic text-sm text-slate-500 mb-3">Drag and drop an option to fill in each blank.</p><div class="flex flex-wrap gap-2 min-h-[32px]">${availOpts.map(o => `<div draggable="true" ondragstart="dragStart(event, ${optionHandlerArg(o)})" onclick="window.mobileTapSelect(event, this, ${optionHandlerArg(o)})" class="draggable-item bg-white border border-slate-200 rounded px-3 py-1.5 min-w-[40px] text-center font-medium text-slate-700 shadow-sm hover:border-blue-300 hover:text-blue-700 transition cursor-grab">${displayOption(o)}</div>`).join('')}</div></div>`;
           }
        } else if(q.type === 'matching_headings') {
           let txt = pt(rawText);
           let availOpts = q.options || [];
           if (!q.reusable) {
               const used = q.ids.map(i => answers[i]).filter(Boolean);
               availOpts = availOpts.filter(o => { if(used.includes(o)) { used.splice(used.indexOf(o), 1); return false; } return true; });
           }
           content = (txt ? `<div class="mb-5 leading-relaxed">${txt}</div>` : '') + `<div class="p-4 bg-slate-50 border border-slate-100 rounded-xl drop-zone-options transition-colors" ondragover="optionsDragOver(event)" ondragleave="optionsDragLeave(event)" ondrop="returnToOptions(event)"><p class="italic text-sm text-slate-500 mb-3">Drag into passage gaps on the left.</p><div class="flex flex-col gap-2 min-h-[32px]">${availOpts.map(o => `<div draggable="true" ondragstart="dragStart(event, ${optionHandlerArg(o)})" onclick="window.mobileTapSelect(event, this, ${optionHandlerArg(o)})" class="draggable-item bg-white border border-slate-200 rounded px-4 py-3 w-full text-left font-medium text-slate-700 shadow-sm hover:border-blue-300 hover:text-blue-700 transition cursor-grab leading-snug">${displayOption(o)}</div>`).join('')}</div></div>`;
        } else if (q.type === 'map_labelling_hotspots') {
           let availOpts = q.options || [];
           const used = q.ids.map(i => answers[i]).filter(Boolean);
           availOpts = availOpts.filter(o => { if(used.includes(o)) { used.splice(used.indexOf(o), 1); return false; } return true; });

           let mapHtml = '';
           if (q.image) {
               mapHtml = `<div class="relative inline-block max-w-full">
                   <img src="${q.image}" class="max-w-full block rounded border border-slate-300 shadow-sm" draggable="false">
                   ${(q.hotspots||[]).map(h => {
                       const id = h.id;
                       const ans = answers[id]||'';
                       const hasAns = !!ans;
                       return `<span class="absolute drop-zone inline-flex items-center justify-center align-middle bg-white min-h-[38px] p-1 transition-all ${hasAns ? 'border border-slate-500 shadow cursor-grab' : 'border-2 border-dashed border-slate-600 rounded-sm'}"
                           style="left:${h.x}%; top:${h.y}%; transform:translate(-50%, -50%); z-index:10;"
                           ondragover="dragOver(event)" ondragleave="dragLeave(event)" ondrop="drop(event, ${id})" onclick="window.handleDropZoneClick(${id}, event)"
                           ${hasAns ? `draggable="true" ondragstart="dragStart(event, '${ans.replace(/'/g,"\\'")}', ${id})"` : ''}>
                          <span onclick="window.toggleReviewByIds([${id}]); event.stopPropagation();" title="Click to mark Q${id} for review" class="q-badge-single-${id} flex items-center justify-center min-w-[28px] h-[28px] bg-white border border-slate-800 text-slate-800 text-base font-bold cursor-pointer hover:bg-slate-100 transition shrink-0 select-none ${hasAns ? 'mr-3' : ''}">${id}</span>
                          <span class="pr-2 text-center text-base ${hasAns ? 'font-bold text-slate-900' : 'hidden'} whitespace-nowrap pointer-events-none">${hasAns ? ans : ''}</span>
                      </span>`;
                   }).join('')}
               </div>`;
           }

           content = `<div class="flex flex-col lg:flex-row flex-wrap gap-8 items-start justify-start w-full">
               <div class="leading-relaxed overflow-x-auto max-w-full flex-1 selection-wrapper text-center bg-slate-50 p-4 border border-slate-100 rounded-xl">
                   ${mapHtml || '<div class="italic text-slate-400">Map image not provided.</div>'}
               </div>
               <div class="w-full sm:w-auto min-w-[160px] shrink-0 p-4 bg-white border border-slate-100 rounded-xl drop-zone-options transition-colors" ondragover="optionsDragOver(event)" ondragleave="optionsDragLeave(event)" ondrop="returnToOptions(event)">
                   <div class="flex flex-col gap-2 min-h-[40px] items-stretch">
                       ${availOpts.map(o => `<div draggable="true" ondragstart="dragStart(event, ${optionHandlerArg(o)})" onclick="window.mobileTapSelect(event, this, ${optionHandlerArg(o)})" class="draggable-item bg-white border border-slate-200 rounded px-3 py-2 font-medium text-slate-800 shadow-sm hover:border-blue-300 hover:text-blue-700 transition cursor-grab inline-block max-w-fit md:max-w-full text-left md:text-center">${displayOption(o)}</div>`).join('')}
                   </div>
               </div>
           </div>`;
        } else if (q.type === 'map_labelling_grid') {
           const places = (rawText).split('\n').filter(Boolean);
           const opts = q.options || [];
           
           let mapHtml = q.image ? `<div class="map-grid-question-map text-center bg-slate-50 p-4 rounded-lg border border-slate-200"><img src="${q.image}" class="max-w-full inline-block rounded border border-slate-300 shadow-sm"></div>` : '';

           let table = `<div class="overflow-x-auto shadow-sm rounded border border-slate-300 w-full"><table class="w-full text-left border-collapse bg-white"><thead><tr class="bg-[#c2d4ec]">`;
           table += `<th class="border border-slate-300 px-4 py-3 font-bold text-slate-800 min-w-[150px]"></th>`;
           opts.forEach(c => {
               table += `<th class="border border-slate-300 px-3 py-3 text-center font-bold text-slate-800 text-sm whitespace-nowrap min-w-[50px]">${displayOption(c)}</th>`;
           });
           table += `</tr></thead><tbody>`;
           
           q.ids.forEach((id, idx) => {
               unplacedIds.delete(id);
               const placeName = highlightVocab(places[idx] || '');
               table += `<tr class="hover:bg-slate-50 transition-colors">`;
               table += `<td class="border border-slate-300 px-4 py-3 font-medium text-slate-800 whitespace-nowrap"><div class="flex items-center gap-4">${makeBadge(id)} <span class="text-[0.95rem]">${placeName}</span></div></td>`;
               
               opts.forEach(c => {
                   const isSelected = answers[id] === c;
                   const bgClass = isSelected ? 'bg-[#d0e3f5]' : 'bg-white hover:bg-slate-100';
                   table += `<td class="border border-slate-300 p-0 text-center cursor-pointer transition-colors ${bgClass}" onclick="handleAns(${id}, this.dataset.val); renderPart(currentPartIdx);" data-val="${q.latexSource ? escapeLatexOption(c) : c.replace(/"/g,"&quot;")}">
                       <div class="w-full h-full flex items-center justify-center min-h-[44px]">
                           ${isSelected ? `<svg class="w-6 h-6 text-[#5cb85c] font-black drop-shadow-sm" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="4" d="M5 13l4 4L19 7"></path></svg>` : ''}
                       </div>
                   </td>`;
               });
               table += `</tr>`;
           });
           table += `</tbody></table></div>`;
           
           content = `<div class="map-grid-question-container"><div class="map-grid-question-layout">${mapHtml}<div class="map-grid-question-table">${table}</div></div></div>`;
        } else if(q.type === 'matching_info') {
           const statements = (rawText).split('\n').filter(Boolean);
           const cols = q.options || [];
           let table = `<div class="overflow-x-auto mb-4"><table class="w-full text-left border-collapse border border-slate-300 bg-white"><thead><tr class="bg-slate-50"><th class="border border-slate-300 px-3 py-2 font-bold text-slate-700" style="font-size: 0.95rem;">Statement</th>${cols.map(c => `<th class="border border-slate-300 px-2 py-2 text-center min-w-[40px] font-bold text-slate-700" style="font-size: 0.95rem;">${displayOption(c)}</th>`).join('')}</tr></thead><tbody>`;
           statements.forEach((stmt, sIdx) => {
              const id = q.ids[sIdx];
              if(!id) return;
              let stmtTxt = pt(stmt);
              table += `<tr><td class="border border-slate-300 px-3 py-2 font-medium text-slate-700" style="font-size: 0.95rem; line-height: 1.4;">${stmtTxt}</td>`;
              cols.forEach(c => {
                 table += `<td class="border border-slate-300 p-1.5 text-center bg-white"><input type="radio" name="q-${id}" value="${optionAttribute(c)}" ${answers[id]===c?'checked':''} onchange="handleAns(${id}, this.value)" class="w-4 h-4 text-blue-600 cursor-pointer"></td>`;
              });
              table += `</tr>`;
           });
           table += `</tbody></table></div>`;
           content = table;
        } else if(q.type === 'essay') {
           let txt = pt(rawText);
           if (APP_DATA.module === 'writing' || APP_DATA.module === 'speaking') {
               txt = '';
           }
           if (APP_DATA.module === 'writing' && isTimeFree && typeof window.getScaffoldedWritingBlocks === 'function') {
               const blocks = window.getScaffoldedWritingBlocks(APP_DATA.parts[currentPartIdx]);
               const draftBlocks = window.splitScaffoldedWritingAnswer?.(answers[q.ids[0]], blocks.length) || [];
               const escapeDraft = value => String(value || '').replace(/[&<>"']/g, character => ({
                   '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
               })[character]);
               const wordCount = String(answers[q.ids[0]] || '').trim().split(/\s+/).filter(Boolean).length;
               content = `${txt ? `<div class="mb-4 leading-relaxed whitespace-pre-wrap">${txt}</div>` : ''}
                 <section class="scaffolded-writing" data-writing-scaffold-question aria-label="Scaffolded writing editor">
                   <header class="scaffolded-writing__header">
                     <div><h3>Scaffolded Writing / Viết theo khối</h3><p>Build your response one paragraph at a time. Your blocks are combined into one answer when submitted.</p></div>
                     <span><b data-writing-scaffold-count>${wordCount}</b> words</span>
                   </header>
                   ${blocks.map((block, index) => `
                     <label class="scaffolded-writing__block">
                       <span class="scaffolded-writing__block-heading"><b>${escapeDraft(block.title)}</b><small>${escapeDraft(block.hint)}</small></span>
                       <textarea data-writing-scaffold-block="${escapeDraft(block.id)}" oninput="window.updateScaffoldedWriting(${q.ids[0]}, this)" class="scaffolded-writing__textarea" rows="${index < 2 ? 3 : 6}" placeholder="Write this part of your response…">${escapeDraft(draftBlocks[index] || '')}</textarea>
                     </label>
                   `).join('')}
                   <div data-writing-analysis>${window.renderWritingTextAnalyzer?.(answers[q.ids[0]] || '') || ''}</div>
                 </section>`;
           } else {
               const essayAnswer = answers[q.ids[0]] || '';
               const escapeDraft = value => String(value || '').replace(/[&<>"']/g, character => ({
                   '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
               })[character]);
               content = (txt ? `<div class="mb-4 leading-relaxed whitespace-pre-wrap">${txt}</div>` : '') + `<textarea id="writing-textarea" oninput="window.updateWritingEssay(${q.ids[0]}, this)" onblur="handleAns(${q.ids[0]}, this.value)" class="w-full h-96 border border-slate-300 rounded p-4 outline-none focus:ring-2 focus:ring-emerald-500 resize-none font-sans text-lg" placeholder="Start typing...">${escapeDraft(essayAnswer)}</textarea><div class="text-right text-sm text-slate-500 mt-2 font-bold">Words: <span id="wc-${q.ids[0]}">${essayAnswer.trim().split(/\\s+/).filter(Boolean).length}</span></div><div id="writing-analysis-${q.ids[0]}">${window.renderWritingTextAnalyzer?.(essayAnswer) || ''}</div>`;
           }
        } else if(q.type === 'audio_record') {
           let txt = pt(rawText);
           if (APP_DATA.module === 'speaking') {
               txt = '';
           }
           const simulatedCueCard = APP_DATA.module === 'speaking' &&
               window.isSpeakingPartTwoSimulation &&
               currentPartIdx === window.speakingSimulationPartIndex &&
               q.ids.length === 1;
           const simulationComplete = simulatedCueCard &&
               speakingSimulationSession?.phase === 'complete' &&
               speakingSimulationSession.questionId === q.ids[0] &&
               Boolean(answers[q.ids[0]]);
           content = (txt ? `<div class="mb-4 leading-relaxed whitespace-pre-wrap">${txt}</div>` : '') +
               (simulatedCueCard
                   ? `<section class="speaking-simulation-panel mt-4 rounded-2xl border-2 border-amber-300 bg-amber-50 p-5 sm:p-7 text-center shadow-inner" aria-live="polite">
                        <p id="speaking-simulation-status" class="font-bold text-amber-950">${simulationComplete ? 'Recording saved. You can now submit your test.' : 'Preparing your timed attempt…'}</p>
                        <div id="speaking-simulation-countdown" class="mt-3 font-mono text-5xl sm:text-6xl font-black tracking-wider text-amber-700" aria-label="Speaking timer">${simulationComplete ? '00:00' : '01:00'}</div>
                        <p class="mt-3 text-xs font-medium text-amber-900">Preparation: 60 seconds · Recording: 2 minutes / Chuẩn bị: 60 giây · Ghi âm: 2 phút</p>
                        <audio id="mic-playback-${q.ids[0]}" controls src="${simulationComplete ? escapeHtmlAttributeValue(answers[q.ids[0]]) : ''}" class="${simulationComplete ? '' : 'hidden'} w-full mt-5"></audio>
                      </section>`
                   : `<div class="flex items-center gap-4 bg-amber-50 p-4 rounded border border-amber-200"><button id="mic-btn-${q.ids[0]}" onclick="toggleRecording(${q.ids[0]})" class="w-16 h-16 rounded-full bg-rose-500 text-white font-bold shadow-lg hover:bg-rose-600 flex items-center justify-center transition"><svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z"></path><path d="M19 10v2a7 7 0 0 1-14 0v-2"></path><line x1="12" y1="19" x2="12" y2="22"></line></svg></button><div class="flex-1"><p id="mic-status-${q.ids[0]}" class="font-bold text-slate-700">Click to Record</p><audio id="mic-playback-${q.ids[0]}" controls src="${answers[q.ids[0]]||''}" class="w-full mt-2 ${answers[q.ids[0]]?'':'hidden'}"></audio></div></div>`);
        } else if (q.type === 'pair_roleplay') {
            qTextHtml = `
            <div class="grid grid-cols-1 md:grid-cols-2 gap-6 mt-4">
                <!-- Student A -->
                <div class="relative rounded-2xl border-2 border-blue-200 bg-blue-50 overflow-hidden shadow-sm group">
                    <div class="absolute inset-0 bg-blue-900/90 backdrop-blur-sm flex flex-col items-center justify-center text-white z-10 transition-opacity duration-300 cursor-pointer" onclick="this.classList.add('opacity-0', 'pointer-events-none')">
                        <span class="text-4xl mb-2">🕵️‍♂️</span>
                        <span class="font-black tracking-widest uppercase">Student A</span>
                        <span class="text-xs font-medium opacity-75 mt-1">Click to reveal your secret role</span>
                    </div>
                    <div class="p-6">
                        <h4 class="font-black text-blue-900 uppercase tracking-widest text-xs mb-3 border-b border-blue-200 pb-2">Student A's Card</h4>
                        <div class="text-[1.05rem] text-slate-700 leading-relaxed whitespace-pre-wrap">${pt(q.text)}</div>
                    </div>
                </div>
                <!-- Student B -->
                <div class="relative rounded-2xl border-2 border-emerald-200 bg-emerald-50 overflow-hidden shadow-sm group">
                    <div class="absolute inset-0 bg-emerald-900/90 backdrop-blur-sm flex flex-col items-center justify-center text-white z-10 transition-opacity duration-300 cursor-pointer" onclick="this.classList.add('opacity-0', 'pointer-events-none')">
                        <span class="text-4xl mb-2">🕵️‍♀️</span>
                        <span class="font-black tracking-widest uppercase">Student B</span>
                        <span class="text-xs font-medium opacity-75 mt-1">Click to reveal your secret role</span>
                    </div>
                    <div class="p-6">
                        <h4 class="font-black text-emerald-900 uppercase tracking-widest text-xs mb-3 border-b border-emerald-200 pb-2">Student B's Card</h4>
                        <div class="text-[1.05rem] text-slate-700 leading-relaxed whitespace-pre-wrap">${pt(q.hint)}</div>
                    </div>
                </div>
            </div>`;
        } else if (q.type === 'group_debate') {
            qTextHtml = `
            <div class="flex flex-col items-center mb-8">
                <div class="bg-slate-800 text-white px-6 py-4 rounded-2xl shadow-lg border-2 border-slate-700 text-center max-w-2xl w-full">
                    <span class="text-[10px] font-black uppercase tracking-widest text-slate-400 block mb-2">Debate Motion</span>
                    <h3 class="text-2xl font-black">${pt(q.instruction)}</h3>
                </div>
            </div>
            <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div class="bg-emerald-50 rounded-2xl p-6 border border-emerald-200 shadow-sm">
                    <h4 class="font-black text-emerald-800 uppercase tracking-widest text-sm mb-4 flex items-center gap-2"><span>👍</span> Affirmative Team</h4>
                    <div class="text-[1.05rem] text-slate-700 leading-relaxed whitespace-pre-wrap">${pt(q.text)}</div>
                </div>
                <div class="bg-rose-50 rounded-2xl p-6 border border-rose-200 shadow-sm">
                    <h4 class="font-black text-rose-800 uppercase tracking-widest text-sm mb-4 flex items-center gap-2"><span>👎</span> Negative Team</h4>
                    <div class="text-[1.05rem] text-slate-700 leading-relaxed whitespace-pre-wrap">${pt(q.hint)}</div>
                </div>
            </div>`;
            instructionHtml = ''; // Suppress the standard instruction above the grid
        } else if (q.type === 'vocab_game') {
            const gameWords = APP_DATA.vocab || [];
            if (gameWords.length < 2) {
                qTextHtml = `<div class="p-6 text-center text-slate-500 italic bg-slate-50 border border-slate-200 rounded-xl">Teacher needs to add at least 2 words to the Test Vocabulary Bank to generate the game.</div>`;
            } else {
                qTextHtml = `
                <div class="bg-fuchsia-50 rounded-3xl p-8 border border-fuchsia-200 shadow-inner">
                    <div class="text-center mb-8">
                        <span class="text-4xl drop-shadow-md mb-2 block">🎲</span>
                        <h3 class="text-2xl font-black text-fuchsia-900 tracking-tight">Vocabulary Challenge</h3>
                        <p class="text-sm font-bold text-fuchsia-600 mt-1 uppercase tracking-widest">Team A vs Team B</p>
                    </div>
                    <div class="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                        ${gameWords.map((v, idx) => `
                            <div class="flip-card h-32 cursor-pointer perspective-1000 group" onclick="this.classList.toggle('flipped')">
                                <div class="flip-card-inner w-full h-full relative transition-transform duration-500 rounded-2xl shadow-sm" style="transform-style: preserve-3d;">
                                    <div class="flip-card-front absolute w-full h-full bg-white border-2 border-fuchsia-300 rounded-2xl flex items-center justify-center p-4 backface-hidden shadow-sm group-hover:border-fuchsia-500 transition-colors" style="-webkit-backface-visibility: hidden; backface-visibility: hidden;">
                                        <span class="text-3xl font-black text-fuchsia-200 group-hover:text-fuchsia-300 transition-colors">${idx + 1}</span>
                                    </div>
                                    <div class="flip-card-back absolute w-full h-full bg-fuchsia-600 border-2 border-fuchsia-700 rounded-2xl flex flex-col items-center justify-center p-4 backface-hidden shadow-md text-center" style="transform: rotateY(180deg); -webkit-backface-visibility: hidden; backface-visibility: hidden;">
                                        <span class="font-black text-white text-lg leading-tight drop-shadow-sm">${v.term}</span>
                                        <span class="text-[10px] text-fuchsia-200 font-medium mt-1 leading-snug line-clamp-2">${v.eng || v.vi || ''}</span>
                                    </div>
                                </div>
                            </div>
                        `).join('')}
                    </div>
                </div>`;
            }
        }
        
        let chkBtn = '';
        let btnContainer = '';
        
        if (isTimeFree) {
            if (q.type === 'multiple_choice' && !q.multi) {
                btnContainer += `<button id="btn-5050-${i}" onclick="window.applyFiftyFifty(${i})" class="text-xs bg-amber-100 hover:bg-amber-200 text-amber-800 font-bold px-3 py-1.5 rounded transition shadow-sm mr-2 border border-amber-200">🪄 50/50</button>`;
            }
            if (q.hint && q.hint.trim() !== '' && q.hint !== '<br>' && q.hint !== '<p><br></p>') {
                btnContainer += `<button onclick="window.toggleScaffoldHint(${i})" class="text-xs bg-sky-100 hover:bg-sky-200 text-sky-800 font-bold px-3 py-1.5 rounded transition shadow-sm mr-2 border border-sky-200">💡 Hint / Kỹ thuật</button>`;
            }
            if (q.type !== 'essay' && q.type !== 'audio_record') {
                btnContainer += `<button onclick="quickCheckAnswer(${i})" class="text-xs bg-slate-200 hover:bg-emerald-100 text-slate-700 hover:text-emerald-800 font-bold px-3 py-1.5 rounded transition shadow-sm">Check Answer</button>`;
            }
        }

        if (APP_DATA.module === 'reading' || (APP_DATA.module === 'listening' && isTimeFree)) {
            btnContainer += `<button type="button" onclick="window.locateQuestion(${i}, event)" class="text-xs bg-blue-50 hover:bg-blue-100 text-blue-800 font-bold px-3 py-1.5 rounded transition shadow-sm border border-blue-200 mr-2">🔎 Locate</button><span id="locate-status-${i}" class="text-xs text-slate-500" aria-live="polite"></span>`;
        }
        
        if (isPreviewMode && q.type !== 'essay' && q.type !== 'audio_record') {
            btnContainer += `<button onclick="window.savePreviewAnswersToBank(${i})" class="text-xs bg-purple-100 hover:bg-purple-200 text-purple-700 hover:text-purple-800 font-bold px-3 py-1.5 rounded transition border border-purple-200 ml-2 flex items-center gap-1 shadow-sm"><svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"></path><polyline points="17 21 17 13 7 13 7 21"></polyline><polyline points="7 3 7 8 15 8"></polyline></svg> Add Answer</button>`;
        }
        
        if (btnContainer) {
            chkBtn = `<div class="mt-4 flex justify-end items-center">${btnContainer}</div>
                      <div id="quick-res-${i}" class="hidden mt-2 p-2 rounded text-base font-bold"></div>
                      <div id="inline-hint-${i}" class="hidden mt-4 text-slate-700 text-[15px] leading-relaxed bg-sky-50 p-5 rounded-xl border border-sky-200 shadow-inner animate-fade-in-up">
                          ${q.hint || ''}
                      </div>`;
        }

        let leftoverBadges = Array.from(unplacedIds).map(id => makeBadge(id)).join('');

        let instructionHtml = '';
        const cleanInst = (q.instruction || '').trim();
        const hasInst = cleanInst && cleanInst !== '<br>' && cleanInst !== '<p><br></p>';
        
        let finalInst = highlightVocab(q.instruction);
        const hasDedicatedMapImage = q.type === 'map_labelling_grid' || q.type === 'map_labelling_hotspots';
        const questionImageHtml = APP_DATA.module === 'listening' && q.image && !hasDedicatedMapImage
            ? `<div class="mb-5 text-center bg-slate-50 p-4 border border-slate-200 rounded-xl"><img src="${escapeHtmlAttributeValue(q.image)}" alt="Question image" class="max-w-full max-h-[420px] inline-block rounded shadow-sm"></div>`
            : '';

        if (APP_DATA.module === 'writing' || APP_DATA.module === 'speaking') {
            if (leftoverBadges) instructionHtml = `<div class="flex gap-1 flex-wrap shrink-0 mb-2">${leftoverBadges}</div>`;
            qTextHtml = ''; 
        } else if (leftoverBadges || hasInst) {
            instructionHtml = `
            <div class="flex flex-col gap-2">
                ${leftoverBadges ? `<div class="flex gap-1 flex-wrap shrink-0 mb-2">${leftoverBadges}</div>` : ''}
                ${hasInst ? `<div class="text-base text-slate-800 whitespace-pre-wrap leading-relaxed">${finalInst}</div>` : ''}
            </div>`;
        }

        div.innerHTML = `
          <div class="flex flex-col ${instructionHtml ? 'gap-3' : 'gap-0'}">
            ${instructionHtml}
            ${questionImageHtml}
            <div class="w-full text-slate-800 ${instructionHtml ? 'mt-2' : 'mt-0'}">
              ${content}
              ${chkBtn}
            </div>
          </div>
        `;
        qListContainer.appendChild(div);
      });
    }

    async function toggleRecording(id) {
      if (isSpeakingSimulationLocked()) return;
      const btn = document.getElementById(`mic-btn-${id}`), st = document.getElementById(`mic-status-${id}`), pb = document.getElementById(`mic-playback-${id}`);
      if(mediaRecorder && mediaRecorder.state === "recording") {
        mediaRecorder.stop(); btn.classList.remove('animate-pulse', 'bg-rose-700'); btn.classList.add('bg-rose-500'); st.textContent = 'Processing...';
      } else {
        try {
          const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
          mediaRecorder = new MediaRecorder(stream); audioChunks = [];
          mediaRecorder.ondataavailable = e => audioChunks.push(e.data);
          mediaRecorder.onstop = async () => {
            const blob = new Blob(audioChunks, { type: 'audio/webm' });
            st.textContent = 'Saving audio...';
            
            // Convert the audio blob into a Base64 text string
            const reader = new FileReader();
            reader.onloadend = () => {
                const base64Audio = reader.result;
                
                // Firestore has a 1MB limit. Warn the student if they talk for way too long.
                if (base64Audio.length > 950000) {
                    st.textContent = 'Recording too long! Please keep it under 2 minutes.';
                    return;
                }
                
                answers[id] = base64Audio; 
                triggerAutosave(); 
                pb.src = base64Audio; 
                pb.classList.remove('hidden'); 
                st.textContent = 'Recorded successfully.';
            };
            
            reader.onerror = () => {
                st.textContent = 'Audio processing failed. Try again.';
            };
            
            reader.readAsDataURL(blob);

            stream.getTracks().forEach(t => t.stop());
          };
          mediaRecorder.start(); btn.classList.add('animate-pulse', 'bg-rose-700'); btn.classList.remove('bg-rose-500'); st.textContent = 'Recording... (Click to Stop)'; pb.classList.add('hidden');
        } catch(err) { showModalMsg("Mic Error", "Microphone access denied or unavailable."); }
      }
    }

    function handleAns(id, v) { 
        answers[id] = v; 
        
        // Clear visual feedback on edit so the user knows they are modifying it
        const textInput = document.querySelector(`input[oninput="handleAns(${id}, this.value)"]`);
        if (textInput) {
            textInput.parentElement.classList.remove('border-emerald-500', 'border-rose-500', 'bg-emerald-50', 'bg-rose-50', 'shake');
            textInput.parentElement.classList.add('border-slate-400');
        }
        
        triggerAutosave(); 
        updateExamUI(); 
    }

    function buildQuestionAnalyticsSnapshot() {
      if (!APP_DATA || !APP_DATA.parts) return [];
      const analytics = getQuestionAnalyticsForSubmission(APP_DATA, answers);
      if (APP_DATA.module !== 'listening') return analytics;

      analytics.forEach(item => {
        const question = APP_DATA.parts[item.partIndex]?.questions?.[item.blockIndex];
        if (question?.type !== 'fill_blanks') return;
        item.errorDetails = (question.ids || []).flatMap(id => {
          const expected = String(question.correctAnswers?.[id] || '');
          const given = String(answers[id] || '');
          const category = window.classifyListeningAnswerError(given, expected);
          return category ? [{ id, category, given, expected }] : [];
        });
      });
      return analytics;
    }

    function normalizeListeningAnswer(value) {
      return String(value || '')
        .normalize('NFKC')
        .toLocaleLowerCase()
        .replace(/[’‘]/g, "'")
        .replace(/[^\p{L}\p{N}'\s-]/gu, '')
        .replace(/\s+/g, ' ')
        .trim();
    }

    function getPluralForm(word) {
      const irregular = {
        child: 'children', man: 'men', woman: 'women', person: 'people',
        mouse: 'mice', goose: 'geese', tooth: 'teeth', foot: 'feet',
        leaf: 'leaves', life: 'lives', knife: 'knives', wife: 'wives',
        half: 'halves', self: 'selves', shelf: 'shelves', wolf: 'wolves',
        analysis: 'analyses', basis: 'bases', crisis: 'crises', thesis: 'theses'
      };
      if (irregular[word]) return irregular[word];
      const irregularSingular = Object.entries(irregular).find(([, plural]) => plural === word);
      if (irregularSingular) return irregularSingular[0];
      if (/[^aeiou]y$/.test(word)) return `${word.slice(0, -1)}ies`;
      if (/(s|x|z|ch|sh)$/.test(word)) return `${word}es`;
      return `${word}s`;
    }

    function isPluralSingularMismatch(given, expected) {
      const givenWords = given.split(' ');
      const expectedWords = expected.split(' ');
      if (givenWords.length !== expectedWords.length) return false;
      let changedWord = false;
      for (let index = 0; index < givenWords.length; index++) {
        const givenWord = givenWords[index];
        const expectedWord = expectedWords[index];
        if (givenWord === expectedWord) continue;
        if (changedWord || getPluralForm(givenWord) !== expectedWord && getPluralForm(expectedWord) !== givenWord) return false;
        changedWord = true;
      }
      return changedWord;
    }

    function getLevenshteinDistance(left, right) {
      let previous = Array.from({ length: right.length + 1 }, (_, index) => index);
      for (let leftIndex = 1; leftIndex <= left.length; leftIndex++) {
        const current = [leftIndex];
        for (let rightIndex = 1; rightIndex <= right.length; rightIndex++) {
          current[rightIndex] = Math.min(
            current[rightIndex - 1] + 1,
            previous[rightIndex] + 1,
            previous[rightIndex - 1] + (left[leftIndex - 1] === right[rightIndex - 1] ? 0 : 1)
          );
        }
        previous = current;
      }
      return previous[right.length];
    }

    window.classifyListeningAnswerError = function(givenAnswer, expectedAnswers) {
      const given = normalizeListeningAnswer(givenAnswer);
      const expectedList = String(expectedAnswers || '').split(/[/|]/)
        .map(normalizeListeningAnswer)
        .filter(Boolean);
      if (!given) return 'unanswered';
      if (expectedList.includes(given)) return null;
      if (expectedList.some(expected => isPluralSingularMismatch(given, expected))) return 'plural_singular';

      const givenWords = given.split(' ');
      const hasTypo = expectedList.some(expected => {
        const expectedWords = expected.split(' ');
        if (givenWords.length !== expectedWords.length) return false;
        return givenWords.every((word, index) => {
          const expectedWord = expectedWords[index];
          if (word === expectedWord) return true;
          const distance = getLevenshteinDistance(word, expectedWord);
          const maxDistance = Math.max(word.length, expectedWord.length) >= 8 ? 2 : 1;
          return distance > 0 && distance <= maxDistance &&
            distance / Math.max(word.length, expectedWord.length, 1) <= 0.2;
        });
      });
      return hasTypo ? 'typo' : 'incorrect';
    };

    window.renderListeningErrorAnalysis = function(submissions) {
      const errorLabels = {
        typo: window.studentText?.('Spelling typo', 'Sai chính tả') || 'Spelling typo',
        plural_singular: window.studentText?.('Singular / plural', 'Thiếu / thừa số nhiều') || 'Singular / plural',
        incorrect: window.studentText?.('Incorrect answer', 'Sai hoàn toàn') || 'Incorrect answer',
        unanswered: window.studentText?.('Not answered', 'Chưa trả lời') || 'Not answered'
      };
      const errors = (Array.isArray(submissions) ? submissions : []).flatMap(submission =>
        (submission?.questionAnalytics || []).flatMap(item =>
          (item.errorDetails || []).map(detail => ({ questionNumber: item.questionNumber, ...detail }))
        )
      );
      if (!errors.length) return '';

      const counts = errors.reduce((result, error) => {
        result[error.category] = (result[error.category] || 0) + 1;
        return result;
      }, {});
      const escapeHtml = value => String(value)
        .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;').replace(/'/g, '&#39;');

      return `
        <section class="listening-error-analysis" aria-label="${window.studentText?.('Listening error analysis', 'Phân tích lỗi Listening') || 'Listening error analysis'}">
          <h3>${window.studentText?.('Listening error check', 'Phân tích lỗi Listening') || 'Listening error check'}</h3>
          <div class="listening-error-analysis__summary">
            ${Object.entries(counts).map(([category, count]) => `
              <span class="listening-error-analysis__badge listening-error-analysis__badge--${category}">
                ${escapeHtml(errorLabels[category] || errorLabels.incorrect)}: ${count}
              </span>`).join('')}
          </div>
          <ul>
            ${errors.map(error => `
              <li><strong>Q${Number(error.questionNumber) || '?'}</strong> · ${escapeHtml(errorLabels[error.category] || errorLabels.incorrect)}:
                <span>${escapeHtml(error.given || window.studentText?.('(blank)', '(bỏ trống)') || '(blank)')}</span>
                <span aria-hidden="true">→</span>
                <span>${escapeHtml(error.expected)}</span>
              </li>`).join('')}
          </ul>
        </section>`;
    };

    function highlightListeningDistractors(root, part) {
      const questions = (part.questions || []).filter(question =>
        question.type === 'multiple_choice' && Array.isArray(question.options) && question.options.length
      );
      if (!root || APP_DATA.module !== 'listening' || !questions.length ||
          typeof window.getListeningDistractorMatches !== 'function') return null;

      const summary = { distractor: 0, correct: 0, signpost: 0 };
      const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
        acceptNode(node) {
          const parent = node.parentElement;
          if (!parent || !/\S/.test(node.textContent) ||
              parent.closest('script, style, audio, button, .drop-zone, .inline-flex, .listening-distractor-highlight')) {
            return NodeFilter.FILTER_REJECT;
          }
          return NodeFilter.FILTER_ACCEPT;
        }
      });
      const textNodes = [];
      while (walker.nextNode()) textNodes.push(walker.currentNode);

      textNodes.forEach(node => {
        const matches = window.getListeningDistractorMatches(node.textContent, questions);
        if (!matches.length) return;
        const fragment = document.createDocumentFragment();
        let lastIndex = 0;
        matches.forEach(match => {
          if (match.start < lastIndex) return;
          if (match.start > lastIndex) fragment.appendChild(document.createTextNode(node.textContent.slice(lastIndex, match.start)));
          const mark = document.createElement('mark');
          mark.className = `listening-distractor-highlight listening-distractor-highlight--${match.kind}`;
          mark.dataset.distractorKind = match.kind;
          mark.textContent = node.textContent.slice(match.start, match.end);
          mark.title = match.kind === 'distractor'
            ? 'Possible distractor: this phrase matches an incorrect option'
            : match.kind === 'correct'
              ? 'Correct-answer evidence'
              : 'Listening signpost';
          fragment.appendChild(mark);
          summary[match.kind]++;
          lastIndex = match.end;
        });
        if (lastIndex < node.textContent.length) {
          fragment.appendChild(document.createTextNode(node.textContent.slice(lastIndex)));
        }
        node.replaceWith(fragment);
      });
      return Object.values(summary).some(Boolean) ? summary : null;
    }

    function renderListeningDistractorLegend(summary) {
      if (!summary) return '';
      return `<div class="listening-distractor-legend" aria-label="Distractor highlight legend">
        <strong>Distractor review / Phân tích bẫy:</strong>
        ${summary.distractor ? '<span><i class="listening-distractor-swatch listening-distractor-swatch--red"></i>Possible distractor mention / Thông tin nhiễu</span>' : ''}
        ${summary.correct ? '<span><i class="listening-distractor-swatch listening-distractor-swatch--green"></i>Correct-option phrase / Cụm từ khớp đáp án</span>' : ''}
        ${summary.signpost ? '<span><i class="listening-distractor-swatch listening-distractor-swatch--green"></i>Signposting word / Từ chuyển ý</span>' : ''}
        <small>Phrase matches are automated hints; review them in context.</small>
      </div>`;
    }
    window.quickCheckAnswer = function(blockIdx) {
        const q = APP_DATA.parts[currentPartIdx].questions[blockIdx];
        if (!q) return;

        let total = 0;
        let correct = 0;

        if (q.multi) {
            // Check Checkbox/Multi-select answers
            const given = q.ids.map(id => (answers[id] || '').toString().toLowerCase()).filter(Boolean);
            const correctOpts = q.ids.flatMap(id => (q.correctAnswers?.[id] || '').toString().toLowerCase().split(/[/|]/).map(x => x.trim())).filter(Boolean);
            
            q.ids.forEach(id => {
                total++;
                const ex = (q.correctAnswers?.[id] || '').toString().toLowerCase();
                if (ex) {
                    const matchIdx = given.indexOf(ex);
                    if (matchIdx !== -1) { correct++; given.splice(matchIdx, 1); }
                }
            });

            // UI Highlight Logic
            const blockEl = document.getElementById(`q-block-${blockIdx}`);
            if(blockEl) {
                const labels = blockEl.querySelectorAll('label');
                labels.forEach(lbl => {
                    const cb = lbl.querySelector('input[type="checkbox"]');
                    if (cb) {
                        const val = cb.value.toLowerCase().trim();
                        lbl.classList.remove('bg-emerald-50', 'border-emerald-500', 'text-emerald-900', 'ring-1', 'ring-emerald-500', 'bg-rose-50', 'border-rose-500', 'text-rose-900', 'ring-rose-500', 'shake');
                        if (cb.checked) {
                            if (correctOpts.includes(val)) {
                                lbl.classList.add('bg-emerald-50', 'border-emerald-500', 'text-emerald-900', 'ring-1', 'ring-emerald-500');
                            } else {
                                lbl.classList.add('bg-rose-50', 'border-rose-500', 'text-rose-900', 'ring-1', 'ring-rose-500', 'shake');
                            }
                        }
                    }
                });
            }
        } else {
            // Check standard questions (Text, Radio, Dropdowns)
            q.ids.forEach(id => {
                total++;
                const exStr = (q.correctAnswers?.[id] || '').toString().toLowerCase();
                const gv = (answers[id] || '').toString().toLowerCase().trim();
                const exList = exStr.split(/[/|]/).map(x => x.trim()); // Supports multiple valid answers separated by / or |
                const isC = exStr && exList.includes(gv) && gv !== '';
                if (isC) correct++;

                // UI Highlight Logic
                
                // 1. Text Inputs (Fill Blanks)
                const textInput = document.querySelector(`input[oninput="handleAns(${id}, this.value)"]`);
                if (textInput) {
                    const parent = textInput.parentElement;
                    parent.classList.remove('border-slate-400', 'border-emerald-500', 'border-rose-500', 'bg-emerald-50', 'bg-rose-50', 'shake');
                    if (gv === '') {
                        parent.classList.add('border-slate-400');
                    } else if (isC) {
                        parent.classList.add('border-emerald-500', 'bg-emerald-50');
                    } else {
                        parent.classList.add('border-rose-500', 'bg-rose-50', 'shake');
                    }
                }

                // 2. Drop Zones (Passage & Question)
                const dropZones = document.querySelectorAll(`.drop-zone[ondrop="drop(event, ${id})"]`);
                dropZones.forEach(dz => {
                    dz.classList.remove('border-blue-500', 'border-slate-300', 'border-slate-400', 'border-emerald-500', 'border-rose-500', 'bg-blue-50', 'bg-emerald-50', 'bg-rose-50', 'text-emerald-900', 'text-rose-900', 'shake');
                    if (gv === '') {
                        dz.classList.add('border-slate-400', 'border-dashed');
                    } else if (isC) {
                        dz.classList.add('border-emerald-500', 'bg-emerald-50', 'text-emerald-900', 'border-solid', 'border-2');
                    } else {
                        dz.classList.add('border-rose-500', 'bg-rose-50', 'text-rose-900', 'border-solid', 'border-2', 'shake');
                    }
                });

                // 3. Radio Buttons (Standard & Matching Info)
                const radios = document.querySelectorAll(`input[type="radio"][name="q-${id}"], input[type="radio"][onchange="handleAns(${id}, this.value)"]`);
                radios.forEach(radio => {
                    const lbl = radio.closest('label');
                    const td = radio.closest('td');
                    if (lbl) {
                        lbl.classList.remove('bg-emerald-50', 'border-emerald-500', 'text-emerald-900', 'ring-1', 'ring-emerald-500', 'bg-rose-50', 'border-rose-500', 'text-rose-900', 'ring-rose-500', 'shake');
                        if (radio.checked) {
                            if (isC) lbl.classList.add('bg-emerald-50', 'border-emerald-500', 'text-emerald-900', 'ring-1', 'ring-emerald-500');
                            else lbl.classList.add('bg-rose-50', 'border-rose-500', 'text-rose-900', 'ring-1', 'ring-rose-500', 'shake');
                        }
                    } else if (td) {
                        td.classList.remove('bg-emerald-100', 'bg-rose-100');
                        if (radio.checked) {
                            if (isC) td.classList.add('bg-emerald-100');
                            else td.classList.add('bg-rose-100');
                        }
                    }
                });
                
                // 4. Map Labelling Grid
                const mapCells = document.querySelectorAll(`td[onclick*="handleAns(${id}"]`);
                mapCells.forEach(td => {
                    td.classList.remove('bg-emerald-100', 'bg-rose-100');
                    if (td.innerHTML.includes('svg')) {
                        if (isC) td.classList.add('bg-emerald-100');
                        else td.classList.add('bg-rose-100');
                    }
                });
            });
        }

        const resDiv = document.getElementById(`quick-res-${blockIdx}`);
        if (!resDiv) return;

        // Clear old colors
        resDiv.classList.remove('hidden', 'bg-emerald-100', 'text-emerald-800', 'bg-rose-100', 'text-rose-800', 'bg-amber-100', 'text-amber-800');

        // Apply new result status
        if (correct === total && total > 0) {
            resDiv.classList.add('bg-emerald-100', 'text-emerald-800');
            resDiv.innerHTML = `✅ All Correct!`;
        } else if (correct > 0) {
            resDiv.classList.add('bg-amber-100', 'text-amber-800');
            resDiv.innerHTML = `⚠️ Partially Correct (${correct}/${total})`;
        } else {
            resDiv.classList.add('bg-rose-100', 'text-rose-800');
            resDiv.innerHTML = `❌ Incorrect. Try again!`;
        }
    };

    function handleMultiAns(idsStr, cb) {
        const ids = idsStr.split(',').map(Number);
        const val = cb.value;
        if (cb.checked) {
            const emptyId = ids.find(id => !answers[id]);
            if (emptyId !== undefined) {
                answers[emptyId] = val;
            } else {
                cb.checked = false;
                showModalMsg("Selection Limit", `You can only select up to ${ids.length} options for this question.`);
                return;
            }
        } else {
            const idToClear = ids.find(id => answers[id] === val);
            if (idToClear !== undefined) answers[idToClear] = '';
            const currentAns = ids.map(id => answers[id]).filter(Boolean);
            ids.forEach((id, idx) => { answers[id] = currentAns[idx] || ''; });
        }
        triggerAutosave();
        updateExamUI();
    }
    
    // Core Drag and Drop Fix (Explicit data transfer setup required by DOM)
    function dragStart(e, d, sourceId = null) { 
        e.dataTransfer.setData('text/plain', d); 
        e.dataTransfer.effectAllowed = 'move';
        draggedData = { text: d, sourceId }; 
    }
    function dragOver(e) { 
        e.preventDefault(); 
        e.dataTransfer.dropEffect = 'move';
        e.currentTarget.classList.add('drag-over'); 
    }
    function dragLeave(e) { e.currentTarget.classList.remove('drag-over'); }
    
    function drop(e, id) { 
        e.preventDefault(); e.currentTarget.classList.remove('drag-over'); 
        
        let droppedText = e.dataTransfer.getData('text/plain');
        if(!droppedText && draggedData) droppedText = draggedData.text;

        if(droppedText) { 
            if(draggedData && draggedData.sourceId && draggedData.sourceId !== id) {
                answers[draggedData.sourceId] = '';
            }
            handleAns(id, droppedText); 
            draggedData=null; 
            renderPart(currentPartIdx);
        } 
    }
    
    function clearDrop(id, e) { e.stopPropagation(); if(answers[id]) { answers[id]=''; renderPart(currentPartIdx); triggerAutosave(); updateExamUI(); } }
    
    function optionsDragOver(e) { 
        e.preventDefault(); 
        e.dataTransfer.dropEffect = 'move';
        e.currentTarget.classList.add('drag-over'); 
    }
    function optionsDragLeave(e) { e.currentTarget.classList.remove('drag-over'); }
    function returnToOptions(e) {
        e.preventDefault(); e.currentTarget.classList.remove('drag-over');
        if(draggedData && draggedData.sourceId) {
            answers[draggedData.sourceId] = '';
            draggedData = null;
            renderPart(currentPartIdx);
            triggerAutosave(); updateExamUI();
        }
    }

        // ✨ NEW: Mobile "Tap-to-Select, Tap-to-Place" Fallback Logic
    window.mobileSelectedData = null;

    window.mobileTapSelect = function(e, el, text, sourceId = null) {
        e.stopPropagation(); // Prevents accidentally returning to the bank
        
        // If they tapped the same item again, deselect it
        if (window.mobileSelectedData && window.mobileSelectedData.el === el) {
            el.classList.remove('mobile-selected');
            window.mobileSelectedData = null;
            return;
        }
        
        // Clear any previous selection visually
        document.querySelectorAll('.mobile-selected').forEach(node => node.classList.remove('mobile-selected'));
        
        // Select the new item
        el.classList.add('mobile-selected');
        window.mobileSelectedData = { text, sourceId, el };
    };

    window.handleDropZoneClick = function(id, e) {
        e.stopPropagation();
        
        if (window.mobileSelectedData) {
            // They were "holding" an item and tapped this zone! Place it!
            const data = window.mobileSelectedData;
            data.el.classList.remove('mobile-selected');
            
            // If they moved it from another gap, clear the old gap first
            if (data.sourceId && data.sourceId !== id) {
                answers[data.sourceId] = ''; 
            }
            
            // Overwrite the gap with the new text
            handleAns(id, data.text);
            window.mobileSelectedData = null;
            renderPart(currentPartIdx);
        } else {
            // They were holding nothing, so they want to clear the gap (return to bank)
            clearDrop(id, e);
        }
    };

    window.mobileTapReturn = function(e) {
        if (window.mobileSelectedData) {
            if (window.mobileSelectedData.sourceId) {
                answers[window.mobileSelectedData.sourceId] = '';
                renderPart(currentPartIdx);
                triggerAutosave(); updateExamUI();
            }
            window.mobileSelectedData.el.classList.remove('mobile-selected');
            window.mobileSelectedData = null;
        }
    };

        window.savePreviewAnswersToBank = async function(blockIdx) {
        if (!isPreviewMode || !editingTestId) return;
        const q = APP_DATA.parts[currentPartIdx].questions[blockIdx];
        if (!q) return;

        let updatedCount = 0;
        if (!q.correctAnswers) q.correctAnswers = {};

        q.ids.forEach(id => {
            const currentVal = answers[id] || '';
            // Only flag as an update if they filled something in, OR if they are clearing an old answer
            if (currentVal !== '' || q.correctAnswers[id]) {
                q.correctAnswers[id] = currentVal.trim();
                if (currentVal !== '') updatedCount++;
            }
        });

        // Sync to global memory
        const idx = TEST_BANK.findIndex(t => t.id === editingTestId);
        if (idx > -1) {
            TEST_BANK[idx] = JSON.parse(JSON.stringify(APP_DATA));
            
            // ✨ FIX: INSTANTLY update the background Editor DOM so it doesn't wipe the data when we exit!
            if (typeof renderEditorQuestions === 'function') {
                renderEditorQuestions();
            }

            try {
                // Sync to cloud immediately
                await window.fsSetDoc(window.fsDoc(window.db, window.fPath('tests'), editingTestId), TEST_BANK[idx]);
                
                if (typeof window.showToast === 'function') {
                    window.showToast("Saved to Test Bank", `Added ${updatedCount} correct answer(s).`);
                }
            } catch (e) {
                console.error(e);
                if (typeof window.showToast === 'function') window.showToast("Error", "Failed to save to cloud database.", "error");
            }
        }
    };

    function triggerAutosave() {
      const s = document.getElementById('autosave-status'); s.classList.remove('opacity-0');
      clearTimeout(autosaveTimeout); autosaveTimeout = setTimeout(() => s.classList.add('opacity-0'), 1500);
    }
    
    function handlePrev() { if (isSpeakingSimulationLocked()) return; if (currentBlockIdx > 0) { finalizeCurrentQuestionTiming(); currentBlockIdx--; activateQuestionBlock(currentPartIdx, currentBlockIdx); document.getElementById(`q-block-${currentBlockIdx}`).scrollIntoView(); updateExamUI(); } else if (currentPartIdx > 0) renderPart(currentPartIdx - 1); }
    function handleNext() { if (isSpeakingSimulationLocked()) return; if (currentBlockIdx < APP_DATA.parts[currentPartIdx].questions.length - 1) { finalizeCurrentQuestionTiming(); currentBlockIdx++; activateQuestionBlock(currentPartIdx, currentBlockIdx); document.getElementById(`q-block-${currentBlockIdx}`).scrollIntoView(); updateExamUI(); } else if (currentPartIdx < APP_DATA.parts.length - 1) renderPart(currentPartIdx + 1); }
    function toggleReview(cb) { const q = APP_DATA.parts[currentPartIdx].questions[currentBlockIdx]; if(q) q.ids.forEach(id => reviewStatus[id] = cb.checked); updateExamUI(); }
    
    window.toggleReviewByIds = function(ids) {
      const isReviewed = ids.some(id => reviewStatus[id]);
      ids.forEach(id => reviewStatus[id] = !isReviewed);
      updateExamUI();
    };

    function updateExamUI() {
      const q = APP_DATA.parts[currentPartIdx].questions[currentBlockIdx];
      document.getElementById('review-checkbox').checked = q ? !!reviewStatus[q.ids[0]] : false;
      
      APP_DATA.parts[currentPartIdx].questions.forEach((_q, i) => {
         document.getElementById(`q-block-${i}`).classList.toggle('ring-2', i===currentBlockIdx);
         _q.ids.forEach(id => {
            const badges = document.querySelectorAll(`.q-badge-single-${id}`);
            badges.forEach(badge => {
                if(reviewStatus[id]) {
                    badge.classList.remove('bg-white', 'text-slate-800', 'border-slate-800', 'hover:bg-slate-100');
                    badge.classList.add('bg-blue-600', 'text-white', 'border-blue-600', 'ring-2', 'ring-blue-300', 'ring-offset-2', 'hover:bg-blue-700');
                } else {
                    badge.classList.add('bg-white', 'text-slate-800', 'border-slate-800', 'hover:bg-slate-100');
                    badge.classList.remove('bg-blue-600', 'text-white', 'border-blue-600', 'ring-2', 'ring-blue-300', 'ring-offset-2', 'hover:bg-blue-700');
                }
            });
         });
      });
      
      const pal = document.getElementById('palette-container'); pal.innerHTML = '';
      APP_DATA.parts.forEach((p, pIdx) => {
        const div = document.createElement('div'); div.className = 'flex items-center px-4 py-2 cursor-pointer shrink-0';
        if(pIdx === currentPartIdx) {
          div.classList.add('bg-slate-100','rounded'); div.innerHTML = `<span class="font-bold mr-3">Part ${pIdx+1}</span>`;
          const ql = document.createElement('div'); ql.className='flex gap-1';
          p.questions.forEach((qb, bIdx) => qb.ids.forEach(id => {
            const isAns = answers[id]&&String(answers[id]).trim();
            const btn = document.createElement('button'); btn.textContent = id; 
            btn.onclick = () => { if (isSpeakingSimulationLocked()) return; currentBlockIdx=bIdx; document.getElementById(`q-block-${bIdx}`).scrollIntoView(); updateExamUI(); };
            btn.oncontextmenu = (e) => { e.preventDefault(); window.toggleReviewByIds([id]); };
            btn.className = `w-7 h-7 flex items-center justify-center text-xs font-bold transition ${reviewStatus[id]?'rounded-full ring-2 ring-blue-400 bg-blue-50 text-blue-800':'rounded-sm'} ${bIdx===currentBlockIdx?'border-2 border-blue-600 bg-white text-blue-800':(isAns?'bg-transparent text-slate-800 underline decoration-2 underline-offset-2':'bg-transparent text-slate-500 hover:bg-slate-200')}`;
            ql.appendChild(btn);
          }));
          div.appendChild(ql);
        } else {
          div.classList.add('hover:bg-slate-50','rounded'); div.onclick = () => renderPart(pIdx);
          div.innerHTML = `<span class="font-medium text-slate-600">Part ${pIdx+1}</span>`;
        }
        pal.appendChild(div);
      });
    // ✨ NEW: Calculate and update the Peripheral Progress Bar
      let totalQuestions = 0;
      let answeredQuestions = 0;
      
      APP_DATA.parts.forEach((p) => {
          p.questions.forEach((qb) => {
              qb.ids.forEach(id => {
                  totalQuestions++;
                  const ans = answers[id];
                  // Check if answer exists and isn't just empty whitespace
                  if (ans !== undefined && ans !== null && String(ans).trim() !== '') {
                      answeredQuestions++;
                  }
              });
          });
      });
      
      const progressBar = document.getElementById('exam-progress-bar');
      if (progressBar && totalQuestions > 0) {
          const pct = (answeredQuestions / totalQuestions) * 100;
          progressBar.style.width = `${pct}%`;
          
          // Color psychology: Turn blue when complete, stay emerald while working
          if (pct === 100) {
              progressBar.classList.remove('bg-emerald-500', 'shadow-[0_0_10px_rgba(16,185,129,0.5)]');
              progressBar.classList.add('bg-blue-600', 'shadow-[0_0_10px_rgba(37,99,235,0.5)]');
          } else {
              progressBar.classList.add('bg-emerald-500', 'shadow-[0_0_10px_rgba(16,185,129,0.5)]');
              progressBar.classList.remove('bg-blue-600', 'shadow-[0_0_10px_rgba(37,99,235,0.5)]');
          }
      }
    }

    window.exitTestWithoutSaving = function() {
      if (isSpeakingSimulationLocked()) return;
      showConfirm("Leave Practice Mode", "Are you sure you want to go back? Your progress will NOT be saved and no score will be recorded.", () => {
        clearSpeakingPartTwoSession();
        window.exitSecureMode();
        finalizeCurrentQuestionTiming();
        clearInterval(timerInterval); 
        document.getElementById('exam-ui').classList.add('hidden');
        window.refreshStudentLanguageLock?.();
        
        const examAudio = document.getElementById('exam-listening-audio');
        window.clearListeningMedia('exam-listening-audio', 'exam-listening-youtube-player');
        window.clearListeningMedia('practice-listening-audio', 'practice-youtube-player');
        
        if (isPreviewMode) {
           isPreviewMode = false;
           document.getElementById('editor-ui').classList.remove('hidden');
           toggleEditorTab('builder');
        } else {
           document.getElementById('start-screen').classList.remove('hidden'); 
           window.renderStudentDashboard(); 
           replaceWithDashboardRoute();
        }
      });
    };

    window.exitTest = async function(autoSubmit = false) {
      if (isSpeakingSimulationLocked()) {
          if (autoSubmit) speakingSimulationSession.autoSubmitOnUnlock = true;
          return;
      }
      const proceed = async () => {
        clearSpeakingPartTwoSession();
        window.stopMicroDictation?.();
        finalizeCurrentQuestionTiming();
        clearInterval(timerInterval); document.getElementById('exam-ui').classList.add('hidden');
        window.refreshStudentLanguageLock?.();
        
        const examAudio = document.getElementById('exam-listening-audio');
        window.clearListeningMedia('exam-listening-audio', 'exam-listening-youtube-player');
        window.clearListeningMedia('practice-listening-audio', 'practice-youtube-player');
        
        let total = 0, correct = 0;
        let bandScoreText = 'Pending Grade';

        if(APP_DATA.module === 'reading' || APP_DATA.module === 'listening') {
          APP_DATA.parts.forEach(p => p.questions.forEach(q => {
             if (q.multi) {
                 const given = q.ids.map(id => (answers[id]||'').toString().toLowerCase()).filter(Boolean);
                 q.ids.forEach(id => {
                    total++;
                    const ex = (q.correctAnswers?.[id]||'').toString().toLowerCase();
                    if (ex) {
                        const matchIdx = given.indexOf(ex);
                        if (matchIdx !== -1) { correct++; given.splice(matchIdx, 1); }
                    }
                 });
             } else {
                 q.ids.forEach(id => {
                    total++; 
                    const exStr = (q.correctAnswers?.[id]||'').toString().toLowerCase(); 
                    const gv = (answers[id]||'').toString().toLowerCase().trim();
                    const exList = exStr.split(/[/|]/).map(x => x.trim());
                    if(exStr && exList.includes(gv) && gv !== '') correct++;
                 });
             }
          }));
          
          // ✨ CALCULATE BAND SCORE
          const band = window.calculateIELTSBand(correct, total);
          bandScoreText = `${correct}/${total} (Band ${band.toFixed(1)})`;
        }
        
        let completedSubmission = null;
        if (!isPreviewMode) {
          const clsId = document.getElementById('student-class-select').value;
          const submissionClass = CLASSES.find(cls => cls.id === clsId);
          const availableSchedules = typeof SCHEDULES === 'undefined' ? [] : SCHEDULES;
          const submissionSchedule = availableSchedules.find(schedule =>
              window.scheduleBelongsToClass(schedule, submissionClass) &&
              (!schedule.attendingStudents || schedule.attendingStudents.includes(currentUser.user)) &&
              [...(schedule.assignedTests || []), ...(schedule.materialIds || []), ...(schedule.homeworkTests || [])].includes(APP_DATA.id)
          );
          finalizeCurrentQuestionTiming();
          const questionAnalytics = buildQuestionAnalyticsSnapshot();
          const sub = { 
              id: Date.now(), 
              student: currentUser.user, 
              testId: APP_DATA.id, 
              testName: APP_DATA.title + (testMode === 'free' ? ' (Practice)' : '') + (window.isFullExamMode ? ' (Full Exam)' : ''), 
              classId: clsId,
              className: CLASSES.find(c=>c.id===clsId)?.name||'', 
              ...(submissionSchedule ? { scheduleId: submissionSchedule.id } : {}),
              date: new Date().toLocaleDateString(), 
              answers: JSON.parse(JSON.stringify(answers)), 
              score: bandScoreText, // Store the calculated band in the DB!
              syntheticData: window.isFullExamMode ? JSON.parse(JSON.stringify(APP_DATA)) : null,
              questionAnalytics,
              secureInfractions: window.secureInfractions || 0
          };
          completedSubmission = sub;
          
          SUBMISSIONS.unshift(sub);
          
          // ✨ SUPPORT FOR FULL MOCKS
          if (window.isFullExamMode) {
              if (!window.fullExamSubmissions) window.fullExamSubmissions = [];
              window.fullExamSubmissions.push(sub);
          } else {
              window.currentActiveSubmissionId = sub.id; 
          }

          try {
              if (currentUser.isDemo) {
                  sessionStorage.setItem('demo_submissions', JSON.stringify(SUBMISSIONS));
              } else {
                  await window.fsSetDoc(window.fsDoc(window.db, window.fPath('submissions'), String(sub.id)), sub);
              }
          } catch (error) {
              console.error("Cloud Error saving submission:", error);
              SUBMISSIONS = SUBMISSIONS.filter(item => item !== sub);
              if (Array.isArray(window.fullExamSubmissions)) {
                  window.fullExamSubmissions = window.fullExamSubmissions.filter(item => item.id !== sub.id);
              }
              if (window.currentActiveSubmissionId === sub.id) window.currentActiveSubmissionId = null;
              document.getElementById('exam-ui').classList.remove('hidden');
              showModalMsg("Submission Error", "Your test could not be saved. Your answers are still on this screen. Check your connection and try submitting again.");
              return;
          }

          // 🏆 ECONOMY REWARD: Grant 50 Gems for normal test
          if (!window.isFullExamMode) {
              const previousGems = currentUser.gems || 0;
              currentUser.gems = previousGems + 50;
              try {
                  if (!currentUser.isDemo) {
                      await window.fsSetDoc(window.fsDoc(window.db, window.fPath('users'), currentUser.user), currentUser);
                  }
                  sessionStorage.setItem('ielts_session', JSON.stringify(currentUser));
                  window.updateDashboardHeader();
              } catch (error) {
                  console.error("Cloud Error saving test reward:", error);
                  currentUser.gems = previousGems;
                  sessionStorage.setItem('ielts_session', JSON.stringify(currentUser));
                  window.updateDashboardHeader();
                  window.showToast?.("Reward Error", "Your test was saved, but the gem reward could not be saved. Please contact your teacher.", "error");
              }
          }
        }

        if (window.isFullExamMode) {
            window.fullExamCurrentIndex++;
            if (window.fullExamCurrentIndex < window.fullExamSequence.length) {
                const stageAnalytics = window.renderQuestionTypeAnalytics?.(
                    completedSubmission ? [completedSubmission] : [],
                    window.studentText?.('This stage: question-type analysis', 'Phân tích dạng câu hỏi của giai đoạn này') || 'This stage: question-type analysis'
                ) || '';
                const listeningErrors = APP_DATA.module === 'listening'
                    ? window.renderListeningErrorAnalysis?.(completedSubmission ? [completedSubmission] : []) || ''
                    : '';
                if (stageAnalytics || listeningErrors) {
                    const modal = document.getElementById('custom-modal');
                    const modalTitle = document.getElementById('modal-title');
                    const modalMessage = document.getElementById('modal-message');
                    const confirmButton = document.getElementById('modal-confirm');
                    const cancelButton = document.getElementById('modal-cancel');
                    const input = document.getElementById('modal-input');
                    let transitionStarted = false;
                    let transitionTimer;
                    const continueToNextSection = () => {
                        if (transitionStarted) return;
                        transitionStarted = true;
                        clearTimeout(transitionTimer);
                        modal.classList.add('hidden');
                        modal.classList.remove('full-exam-analytics-modal');
                        startTest(null, null, window.fullExamSequence[window.fullExamCurrentIndex]);
                    };

                    modalTitle.textContent = window.studentText?.('Section complete', 'Hoàn thành phần thi') || 'Section complete';
                    modalMessage.innerHTML = `${stageAnalytics}${listeningErrors}<p class="mb-0 mt-3 text-center text-xs text-slate-500">${window.studentText?.('Continuing automatically in 10 seconds.', 'Tự động chuyển phần sau 10 giây.') || 'Continuing automatically in 10 seconds.'}</p>`;
                    confirmButton.textContent = window.studentText?.('Continue now', 'Tiếp tục ngay') || 'Continue now';
                    confirmButton.onclick = continueToNextSection;
                    cancelButton.classList.add('hidden');
                    input.classList.add('hidden');
                    modal.classList.add('full-exam-analytics-modal');
                    modal.classList.remove('hidden');
                    transitionTimer = setTimeout(continueToNextSection, 10000);
                } else {
                    showModalMsg("Section Complete", "Moving to the next section in 3 seconds...");
                    setTimeout(() => {
                        document.getElementById('custom-modal').classList.add('hidden');
                        startTest(null, null, window.fullExamSequence[window.fullExamCurrentIndex]);
                    }, 3000);
                }
            } else {
                // ✨ FULL MOCK COMPLETED
                window.isFullExamMode = false;
                window.activeSyntheticExamReturnHash = null;
                window.exitSecureMode();

                let resultsHtml = '<div class="space-y-3 mt-6 text-left max-h-[300px] overflow-y-auto">';
                (window.fullExamSubmissions || []).forEach(s => {
                    let scoreBadge = '';
                    if (s.score.includes('Band')) {
                        const bandMatch = s.score.match(/(Band [0-9.]+)/);
                        if (bandMatch) scoreBadge = `<span class="bg-blue-100 text-blue-800 border border-blue-300 font-black px-3 py-1.5 rounded-lg shadow-sm text-sm">${bandMatch[1]}</span>`;
                    } else {
                        scoreBadge = `<span class="bg-amber-100 text-amber-800 border border-amber-300 font-bold px-3 py-1.5 rounded-lg shadow-sm text-xs uppercase tracking-widest">${s.score}</span>`;
                    }
                    
                    resultsHtml += `
                    <div class="flex justify-between items-center p-4 border border-slate-200 rounded-xl bg-white shadow-sm hover:border-blue-300 transition cursor-default">
                        <span class="font-bold text-slate-800 text-[15px] truncate pr-4">${s.testName.replace(' (Full Exam)', '')}</span>
                        ${scoreBadge}
                    </div>`;
                });
                resultsHtml += '</div>';

                document.getElementById('results-score-area').innerHTML = `
                    <div class="text-3xl font-black text-slate-800 mb-2">Exam Complete!</div>
                    <p class="text-sm font-medium text-slate-500">You have completed all 3 sections of the mock exam.</p>
                    ${resultsHtml}
                    ${window.renderQuestionTypeAnalytics?.(
                      window.fullExamSubmissions || [],
                      window.studentText?.('Full mock: question-type analysis', 'Phân tích dạng câu hỏi của bài thi thử') || 'Full mock: question-type analysis'
                    ) || ''}
                    ${window.renderListeningErrorAnalysis?.(window.fullExamSubmissions || []) || ''}
                    <div class="mt-8 inline-block bg-amber-100 border border-amber-300 text-amber-800 font-black px-6 py-3 rounded-xl shadow-sm animate-bounce text-lg tracking-wide">🎉 +150 💎 Earned!</div>
                `;
                document.getElementById('results-modal').classList.remove('hidden');
                
                // Grant Full Exam Bonus
                if (!isPreviewMode) {
                    currentUser.gems = (currentUser.gems || 0) + 150;
                    window.fsSetDoc(window.fsDoc(window.db, window.fPath('users'), currentUser.user), currentUser);
                    sessionStorage.setItem('ielts_session', JSON.stringify(currentUser));
                    window.updateDashboardHeader();
                }
            }
        } else {
            window.exitSecureMode();
            if(APP_DATA.module === 'reading' || APP_DATA.module === 'listening') {
               const band = window.calculateIELTSBand(correct, total);
               document.getElementById('results-score-area').innerHTML = `
                    <div class="text-5xl font-black text-blue-700 mb-2">${correct}/${total}</div>
                    <div class="text-xl font-bold text-emerald-600 mb-3 bg-emerald-50 border border-emerald-200 inline-block px-4 py-1.5 rounded-xl shadow-sm">Estimated Band: ${band.toFixed(1)}</div>
                    <div class="text-xs font-bold text-slate-400 uppercase tracking-widest mt-2">Score Recorded</div>
                    ${window.renderQuestionTypeAnalytics?.(
                      completedSubmission ? [completedSubmission] : [],
                      window.studentText?.('This stage: question-type analysis', 'Phân tích dạng câu hỏi của giai đoạn này') || 'This stage: question-type analysis'
                    ) || ''}
                    ${APP_DATA.module === 'listening' ? window.renderListeningErrorAnalysis?.(completedSubmission ? [completedSubmission] : []) || '' : ''}
                    <div class="mt-6 inline-block bg-amber-100 border border-amber-300 text-amber-800 font-black px-4 py-2 rounded-xl shadow-sm animate-bounce">🎉 +50 💎 Earned!</div>
               `;
            } else {
               document.getElementById('results-score-area').innerHTML = `<div class="text-2xl font-bold text-amber-600">Response Recorded</div><p class="text-sm text-slate-500 mt-2">${isPreviewMode ? 'Preview session ended.' : 'Waiting for teacher review.'}</p><div class="mt-6 inline-block bg-amber-100 border border-amber-300 text-amber-800 font-black px-4 py-2 rounded-xl shadow-sm animate-bounce">🎉 +50 💎 Earned!</div>`;
            }
            document.getElementById('results-modal').classList.remove('hidden');
        }
      };

      if (autoSubmit) {
          await proceed();
      } else {
          let title = isPreviewMode ? "End Preview" : (window.isFullExamMode ? "Submit Section" : "Submit Test");
          let desc = isPreviewMode ? "End preview and check results?" : (window.isFullExamMode ? "Are you sure you want to finish this section early? You will be moved to the next skill." : "Are you sure you want to finish?");
          
          // ✨ NEW: Smart Missing Answer Scanner
          if (!isPreviewMode) {
              let missingCount = 0;
              APP_DATA.parts.forEach(p => {
                  p.questions.forEach(q => {
                      (q.ids || []).forEach(id => {
                          const val = answers[id];
                          if (val === undefined || val === null || val.toString().trim() === '') {
                              missingCount++;
                          }
                      });
                  });
              });
              
              if (missingCount > 0) {
                  title = "⚠️ Incomplete Test";
                  desc = `<div class="bg-rose-50 border-l-4 border-rose-500 p-3 mb-3 text-rose-800 font-medium shadow-sm">You have <b>${missingCount} unanswered question${missingCount > 1 ? 's' : ''}</b> left blank!</div>Are you sure you want to submit your test early?`;
              }
          }

          showConfirm(title, desc, proceed);
      }
    };
    
    window.retakeCurrentTest = function() {
        document.getElementById('results-modal').classList.add('hidden');
        
        if (isPreviewMode) {
            previewActiveTest();
        } else if (window.isFullExamMode) {
            window.fullExamCurrentIndex = 0;
            startTest(null, null, window.fullExamSequence[0]);
        } else {
            // Keep the exact same APP_DATA (which already has the specific selected parts filtered)
            startTest(null, null, JSON.parse(JSON.stringify(APP_DATA)));
        }
    };

    window.retakeFromReview = function() {
        document.getElementById('review-ui').classList.add('hidden');
        sessionStorage.removeItem('lms_grading_sub');
        sessionStorage.removeItem('lms_grading_mode');
        
        const tid = APP_DATA?.id;
        
        if (currentUser.role === 'teacher' || currentUser.role === 'collaborator') {
            document.getElementById('editor-ui').classList.remove('hidden');
            if (tid && TEST_BANK.find(t=>t.id === tid)) {
                editTest(tid);
            } else {
                toggleEditorTab('bank');
            }
            return;
        } 
        
        // Student routing logic
        document.getElementById('start-screen').classList.remove('hidden');
        
        if (!tid || tid.startsWith('mock_') || !TEST_BANK.find(t=>t.id === tid)) {
            renderStudentDashboard();
            if (tid && tid.startsWith('mock_')) {
                if (typeof window.showToast === 'function') window.showToast("Notice", "Please generate a new Mock Exam from the dashboard.", "info");
            } else if (tid) {
                if (typeof window.showToast === 'function') window.showToast("Notice", "This test is no longer available in the bank.", "error");
            }
            return;
        }

        // Check if still legally assigned to their class
        const item = getCurrentStudentAssignedTest(tid);
        if (!item) {
            renderStudentDashboard();
            if (typeof window.showToast === 'function') window.showToast("Notice", "This test is no longer assigned to your current class.", "error");
            return;
        }

        openModeSelection(tid);
    };

    function exitToDashboard() { 
      document.getElementById('results-modal').classList.add('hidden'); 
      if (isPreviewMode) {
         isPreviewMode = false;
         document.getElementById('editor-ui').classList.remove('hidden');
         toggleEditorTab('builder');
      } else {
         document.getElementById('start-screen').classList.remove('hidden'); 
         renderStudentDashboard(); 
         replaceWithDashboardRoute();
      }
    }
    
    window.openExplanationsReview = function() {
      document.getElementById('results-modal').classList.add('hidden');
      
      // ✨ ROUTE TO HISTORY FOR FULL EXAMS
      if (window.fullExamSubmissions && window.fullExamSubmissions.length > 0) {
          window.fullExamSubmissions = []; // Clear array
          document.getElementById('start-screen').classList.remove('hidden'); 
          window.openStudentHistory(); // Send to history so they can pick which specific section to review!
      } else if (!isPreviewMode && window.currentActiveSubmissionId) {
          reviewPastSubmission(window.currentActiveSubmissionId);
      } else {
          // Fallback for Teacher Preview Mode
          document.getElementById('review-ui').classList.remove('hidden');
          document.getElementById('review-module-badge').textContent = APP_DATA.module + (isPreviewMode ? ' (Preview)' : '');
          buildSplitReviewUI(false, null, {});
      }
    };
    
    function closeReviewScreen() {
      sessionStorage.removeItem('lms_grading_sub');
      sessionStorage.removeItem('lms_grading_mode');
      document.getElementById('review-ui').classList.add('hidden');
      if (isPreviewMode) {
         isPreviewMode = false;
         document.getElementById('editor-ui').classList.remove('hidden');
         toggleEditorTab('builder');
      }
      else if (currentUser && currentUser.role === 'teacher') {
         document.getElementById('editor-ui').classList.remove('hidden');
         replaceWithDashboardRoute();
      } else {
         document.getElementById('start-screen').classList.remove('hidden');
         renderStudentDashboard();
         replaceWithDashboardRoute();
      }
    }

    function renderSubmissions() {
      document.getElementById('submissions-list').innerHTML = SUBMISSIONS.length ? SUBMISSIONS.map(s => `
        <div class="bg-white border border-blue-50 rounded-2xl p-5 mb-4 shadow-sm hover:shadow-md transition flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4">
          <div>
            <h3 class="font-black text-lg text-slate-800 flex items-center gap-2">👤 ${s.student} <span class="text-xs text-blue-600 font-bold bg-blue-50 px-2 py-1 rounded-md border border-blue-100">${s.className}</span></h3>
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
            csv += `"${s.id}","${s.date}","${s.student}","${s.className}","${s.testName}","${s.score}"\n`;
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
      document.getElementById('review-module-badge').textContent = `${APP_DATA.module} - GRADING: ${sub.student}`;
      
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
