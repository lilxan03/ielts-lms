    // Exam State
    let timeLeft = 0; 
    let testMode = 'restricted'; 
    let isTimeFree = false;
    let isPreviewMode = false;
    let answers = {};
    let reviewStatus = {}; 
    let currentPartIdx = 0;
    let currentBlockIdx = 0;
    let timerInterval, autosaveTimeout;
    window.isFullExamMode = false;
    window.fullExamSequence = [];
    window.fullExamCurrentIndex = 0;
    let draggedData = null; 
    let mediaRecorder = null;
    let audioChunks = [];

    // Feature States
    let activeSelectionRange = null;
    let activeHighlightNode = null;
    let currentNotes = []; 
    let isNotesPanelOpen = false;
    let editorAutosaveTimer = null;
    let activeTableCell = null;

    let listeningAnimationFrame = null;

    window.linkifyText = function(text) {
        if (!text) return '';
        const urlRegex = /(https?:\/\/[^\s]+)/g;
        // Escape HTML first, then linkify, then convert newlines to <br>
        return text.replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(urlRegex, function(url) {
            return `<a href="${url}" target="_blank" class="text-blue-600 hover:underline font-bold">${url}</a>`;
        }).replace(/\n/g, '<br>');
    };

    function splitListeningSentences(text) {
        const holder = document.createElement('div');
        holder.innerHTML = text || '';
        const plainText = (holder.textContent || holder.innerText || '').replace(/\s+/g, ' ').trim();
        if (!plainText) return [];
        return (plainText.match(/[^.!?]+[.!?]+|[^.!?]+$/g) || []).map(sentence => sentence.trim()).filter(Boolean);
    }

    function escapeListeningText(text) {
        return String(text || '').replace(/[&<>"']/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[character]));
    }

    function countListeningSyllables(word) {
        const cleaned = String(word || '').toLowerCase().replace(/[^a-záàảãạăắằẳẵặâấầẩẫậđéèẻẽẹêếềểễệíìỉĩịóòỏõọôốồổỗộơớờởỡợúùủũụưứừửữựýỳỷỹỵ]/gi, '');
        if (!cleaned) return 0;
        if (/[áàảãạăắằẳẵặâấầẩẫậéèẻẽẹêếềểễệíìỉĩịóòỏõọôốồổỗộơớờởỡợúùủũụưứừửữựýỳỷỹỵ]/i.test(cleaned)) {
            return Math.max(1, (cleaned.match(/[aeiouyáàảãạăâéèẻẽẹêíìỉĩịóòỏõọôơóúùủũụưứừửữựýỳỷỹỵ]+/gi) || []).length);
        }
        const vowelGroups = (cleaned.match(/[aeiouy]+/g) || []).length;
        const withoutSilentE = cleaned.replace(/e$/i, '');
        return Math.max(1, Math.min(8, (withoutSilentE.match(/[aeiouy]+/g) || []).length || vowelGroups));
    }

    function countListeningTextSyllables(text) {
        return (String(text || '').match(/\S+/g) || []).reduce((sum, word) => sum + countListeningSyllables(word), 0) || 1;
    }

    function ensureListeningWaveform(audio) {
        if (!audio || audio._listeningAnalyser) return;
        try {
            const AudioContextClass = window.AudioContext || window.webkitAudioContext;
            if (!AudioContextClass) return;
            // Never route remote preview audio through a Web Audio source: browsers can mute it when CORS is absent.
            if (!audio.captureStream) return;
            const context = new AudioContextClass();
            const analyser = context.createAnalyser();
            analyser.fftSize = 1024;
            const source = context.createMediaStreamSource(audio.captureStream());
            source.connect(analyser);
            audio._listeningAnalyser = { context, analyser, data: new Uint8Array(analyser.fftSize), hasSignal: false, emptyFrames: 0, maxRms: 0 };
        } catch (error) {
            audio._listeningAnalyser = null;
            console.warn('Audio waveform analyser unavailable', error);
        }
    }

    function isListeningSpeechActive(audio) {
        const state = audio?._listeningAnalyser;
        if (!state) return true;
        state.analyser.getByteTimeDomainData(state.data);
        let sum = 0;
        state.data.forEach(value => {
            const amplitude = (value - 128) / 128;
            sum += amplitude * amplitude;
        });
        const rms = Math.sqrt(sum / state.data.length);
        if (rms > 0.012) state.hasSignal = true;
        if (!state.hasSignal && rms < 0.0001) state.emptyFrames++;
        if (!state.hasSignal && state.emptyFrames > 60) return true;
        return rms > 0.012;
    }

    function getListeningCues(part, audioDuration) {
        const sentences = splitListeningSentences(part.text || '');
        const startOffset = Math.max(0, Number(part.listeningHighlightStart) || 0);
        const cues = sentences.map(text => ({
            text,
            start: null,
            end: null
        }));
        if (Number.isFinite(audioDuration) && audioDuration > startOffset && cues.length) {
            const totalSyllables = cues.reduce((sum, cue) => sum + countListeningTextSyllables(cue.text), 0);
            let elapsed = startOffset;
            cues.forEach(cue => {
                const duration = (audioDuration - startOffset) * countListeningTextSyllables(cue.text) / totalSyllables;
                cue.start = elapsed;
                cue.end = elapsed + duration;
                elapsed += duration;
            });
        }
        return cues;
    }

    function splitKaraokeSentences(text) {
        return splitListeningSentences(text);
    }

    function escapeKaraokeText(text) {
        return escapeListeningText(text);
    }

    let karaokeEditorCueIndex = 0;

    function getKaraokeEditorAudio() {
        return getListeningPlayback('edit-listening-audio', 'edit-listening-youtube-player');
    }

    function formatKaraokeEditorTime(value) {
        const seconds = Math.max(0, Number(value) || 0);
        const minutes = Math.floor(seconds / 60);
        return `${String(minutes).padStart(2, '0')}:${(seconds % 60).toFixed(2).padStart(5, '0')}`;
    }

    function renderKaraokeEditorCues() {
        const list = document.getElementById('karaoke-editor-cues');
        const part = APP_DATA?.parts?.[currentEditorPartIdx];
        if (!list || !part) return;
        const sentences = splitKaraokeSentences(part.text || '');
        if (!Array.isArray(part.karaoke)) part.karaoke = [];
        if (!sentences.length) {
            list.innerHTML = '<div class="text-[11px] text-slate-400 p-2">Add transcript text above first.</div>';
            return;
        }
        list.innerHTML = sentences.map((sentence, index) => {
            const cue = part.karaoke[index] || {};
            const selected = index === karaokeEditorCueIndex;
            const timing = cue.start !== undefined && cue.start !== null
                ? `${formatKaraokeEditorTime(cue.start)} - ${cue.end == null ? '--:--.--' : formatKaraokeEditorTime(cue.end)}`
                : 'Not marked';
            return `<button type="button" onclick="window.selectKaraokeEditorCue(${index})" class="w-full text-left px-2 py-1.5 rounded text-[11px] ${selected ? 'bg-blue-100 border-blue-300 text-blue-900' : 'bg-slate-50 border-transparent text-slate-700'} border flex items-start gap-2"><span class="font-black w-5 shrink-0">${index + 1}</span><span class="flex-1 min-w-0 whitespace-normal break-words">${escapeKaraokeText(sentence)}</span><span class="font-mono shrink-0">${timing}</span></button>`;
        }).join('');
    }

    window.selectKaraokeEditorCue = function(index) {
        karaokeEditorCueIndex = Math.max(0, Number(index) || 0);
        renderKaraokeEditorCues();
    };

    window.markKaraokeStart = function() {
        const part = APP_DATA?.parts?.[currentEditorPartIdx];
        const audio = getKaraokeEditorAudio();
        if (!part || !audio) return;
        if (!Array.isArray(part.karaoke)) part.karaoke = [];
        const cue = part.karaoke[karaokeEditorCueIndex] || {};
        cue.text = splitKaraokeSentences(part.text || '')[karaokeEditorCueIndex] || '';
        cue.start = Number(audio.currentTime) || 0;
        cue.end = null;
        part.karaoke[karaokeEditorCueIndex] = cue;
        renderKaraokeEditorCues();
        triggerEditorAutosave();
    };

    window.markKaraokeEnd = function() {
        const part = APP_DATA?.parts?.[currentEditorPartIdx];
        const audio = getKaraokeEditorAudio();
        if (!part || !audio) return;
        const cue = part.karaoke?.[karaokeEditorCueIndex];
        const now = Number(audio.currentTime) || 0;
        
        if (!cue || cue.start == null) {
            window.markKaraokeStart();
            return;
        }
        if (now <= Number(cue.start)) return;
        
        // 1. Lock in the end time for the current sentence
        cue.end = now;
        
        // 2. Automatically prepare the NEXT sentence and chain its start time
        const sentences = splitKaraokeSentences(part.text || '');
        const nextIndex = Math.min(karaokeEditorCueIndex + 1, sentences.length - 1);
        
        if (nextIndex > karaokeEditorCueIndex) {
            if (!part.karaoke[nextIndex]) part.karaoke[nextIndex] = {};
            part.karaoke[nextIndex].text = sentences[nextIndex] || '';
            part.karaoke[nextIndex].start = now; // This chains the timestamps perfectly!
        }
        
        // 3. Move the editor focus to the next cue
        karaokeEditorCueIndex = nextIndex;
        
        renderKaraokeEditorCues();
        triggerEditorAutosave();
    };

    document.addEventListener('keydown', event => {
        const editor = document.getElementById('editor-ui');
        const audio = getKaraokeEditorAudio();
        const target = event.target;
        if (!editor || editor.classList.contains('hidden') || !audio || audio.closest('.hidden')) return;
        if (event.code !== 'Space' || ['INPUT', 'TEXTAREA', 'BUTTON', 'SELECT'].includes(target.tagName) || target.isContentEditable) return;
        event.preventDefault();
        const cue = APP_DATA?.parts?.[currentEditorPartIdx]?.karaoke?.[karaokeEditorCueIndex];
        if (cue?.start != null && cue.end == null) window.markKaraokeEnd();
        else window.markKaraokeStart();
    });

    function getKaraokeCues(part) {
        const sentences = splitKaraokeSentences(part.text || '');
        const saved = Array.isArray(part.karaoke) ? part.karaoke : [];
        return sentences.map((text, index) => ({
            text,
            start: Number.isFinite(Number(saved[index]?.start)) ? Number(saved[index].start) : null,
            end: Number.isFinite(Number(saved[index]?.end)) ? Number(saved[index].end) : null
        }));
    }

    function getKaraokeAudioContext() {
        const AudioContextClass = window.AudioContext || window.webkitAudioContext;
        return AudioContextClass ? new AudioContextClass() : null;
    }

    function buildSpeechSegments(audioBuffer, startOffset) {
        const channel = audioBuffer.getChannelData(0);
        const frameSize = 2048;
        const frameDuration = frameSize / audioBuffer.sampleRate;
        const rms = [];
        let maxRms = 0;
        for (let offset = 0; offset < channel.length; offset += frameSize) {
            let sum = 0;
            const end = Math.min(channel.length, offset + frameSize);
            for (let index = offset; index < end; index++) sum += channel[index] * channel[index];
            const value = Math.sqrt(sum / Math.max(1, end - offset));
            rms.push(value);
            maxRms = Math.max(maxRms, value);
        }
        const threshold = Math.max(0.012, maxRms * 0.16);
        const segments = [];
        let activeStart = null;
        rms.forEach((value, index) => {
            const time = index * frameDuration;
            const active = time >= startOffset && value >= threshold;
            if (active && activeStart === null) activeStart = time;
            const isEnd = !active && activeStart !== null;
            if (isEnd) {
                const end = time;
                if (end - activeStart >= 0.12) segments.push({ start: activeStart, end });
                activeStart = null;
            }
        });
        if (activeStart !== null) segments.push({ start: activeStart, end: audioBuffer.duration });
        if (!segments.length) segments.push({ start: startOffset, end: audioBuffer.duration });

        // Merge very short pauses so one sentence is not split into dozens of fragments.
        return segments.reduce((merged, segment) => {
            const previous = merged[merged.length - 1];
            if (previous && segment.start - previous.end < 0.38) previous.end = segment.end;
            else merged.push({ ...segment });
            return merged;
        }, []);
    }

    function assignKaraokeCuesFromSpeech(part, audioBuffer) {
        const sentences = splitKaraokeSentences(part.text || '');
        if (!sentences.length) return [];
        const startOffset = Math.max(0, Number(part.listeningHighlightStart) || 0);
        const segments = buildSpeechSegments(audioBuffer, startOffset);
        const weights = sentences.map(sentence => Math.max(1, countListeningTextSyllables(sentence)));
        const totalWeight = weights.reduce((sum, weight) => sum + weight, 0);
        const timelineStart = segments[0].start;
        const timelineEnd = segments[segments.length - 1].end;
        const pauseBoundaries = segments.slice(0, -1).map((segment, index) => (segment.end + segments[index + 1].start) / 2);
        const cues = [];
        let cumulativeWeight = 0;
        let previousBoundary = timelineStart;
        sentences.forEach((text, index) => {
            cumulativeWeight += weights[index];
            const start = previousBoundary;
            if (index === sentences.length - 1) {
                cues.push({ text, start, end: timelineEnd });
                return;
            }
            const expectedBoundary = timelineStart + (timelineEnd - timelineStart) * cumulativeWeight / totalWeight;
            const availableBoundaries = pauseBoundaries.filter(boundary => boundary > start + 0.08 && boundary < timelineEnd - 0.08);
            const end = availableBoundaries.length
                ? availableBoundaries.reduce((nearest, boundary) => Math.abs(boundary - expectedBoundary) < Math.abs(nearest - expectedBoundary) ? boundary : nearest, availableBoundaries[0])
                : expectedBoundary;
            previousBoundary = Math.max(start + 0.08, end);
            cues.push({ text, start, end: previousBoundary });
        });
        return cues;
    }

    function drawKaraokeWaveform(audio, root, audioBuffer) {
        const canvas = root.querySelector('.karaoke-waveform-fallback');
        if (!canvas || !audioBuffer) return;
        const width = Math.max(320, Math.floor(canvas.clientWidth || 640));
        const height = 58;
        const ratio = window.devicePixelRatio || 1;
        canvas.width = width * ratio;
        canvas.height = height * ratio;
        const context = canvas.getContext('2d');
        context.scale(ratio, ratio);
        const data = audioBuffer.getChannelData(0);
        const step = Math.max(1, Math.floor(data.length / width));
        context.clearRect(0, 0, width, height);
        context.fillStyle = '#bfdbfe';
        for (let x = 0; x < width; x++) {
            let peak = 0;
            const start = x * step;
            const end = Math.min(data.length, start + step);
            for (let index = start; index < end; index++) peak = Math.max(peak, Math.abs(data[index]));
            const barHeight = Math.max(2, peak * height * 0.9);
            context.fillRect(x, (height - barHeight) / 2, 1, barHeight);
        }
        const drawProgress = () => {
            const progress = Number.isFinite(audio.duration) && audio.duration > 0 ? audio.currentTime / audio.duration : 0;
            context.fillStyle = 'rgba(37, 99, 235, 0.72)';
            context.fillRect(0, 0, width * Math.max(0, Math.min(1, progress)), height);
            if (!audio.paused && !audio.ended) canvas._waveformFrame = requestAnimationFrame(drawProgress);
        };
        if (canvas._waveformFrame) cancelAnimationFrame(canvas._waveformFrame);
        audio.addEventListener('play', drawProgress);
        canvas.onclick = event => {
            const rect = canvas.getBoundingClientRect();
            const position = Math.max(0, Math.min(1, (event.clientX - rect.left) / rect.width));
            window.seekKaraokeAudio(position * audio.duration);
        };
        drawProgress();
    }

    function initKaraokeWaveformPlugin(audio, root) {
        const container = root?.querySelector('[data-waveform-root]');
        if (!container || !audio || !window.WaveSurfer || container._waveSurfer) return;
        try {
            const waveSurfer = window.WaveSurfer.create({
                container,
                media: audio,
                height: 58,
                waveColor: '#60a5fa',
                progressColor: '#1d4ed8',
                cursorColor: '#0f172a',
                cursorWidth: 2,
                normalize: true,
                interact: true
            });
            container._waveSurfer = waveSurfer;
            waveSurfer.on('error', error => console.warn('Waveform plugin could not render audio', error));
        } catch (error) {
            console.warn('Waveform plugin unavailable; using native fallback.', error);
        }
    }

    function updateRealtimeKaraoke(audio, root) {
        const state = audio?._listeningAnalyser;
        if (!state || !root) return false;
        state.analyser.getByteTimeDomainData(state.data);
        let sum = 0;
        state.data.forEach(value => {
            const amplitude = (value - 128) / 128;
            sum += amplitude * amplitude;
        });
        const rms = Math.sqrt(sum / state.data.length);
        const now = audio.currentTime || 0;
        const part = APP_DATA.parts[currentPartIdx] || {};
        const cues = getKaraokeCues(part, audio.duration);
        if (!cues.length) return false;
        const key = `${currentPartIdx}|${String(part.text || '').length}`;
        if (audio._karaokeLiveKey !== key || audio._karaokeLiveIndex == null || now < (audio._karaokeLiveLastTime || 0)) {
            audio._karaokeLiveKey = key;
            audio._karaokeLiveIndex = Math.max(0, cues.findIndex(cue => cue.start !== null && now >= cue.start && now < (cue.end || Infinity)));
            if (audio._karaokeLiveIndex < 0) audio._karaokeLiveIndex = 0;
            audio._karaokeLiveStartedAt = now;
            audio._karaokeLiveLastVoiceAt = now;
        }
        const isVoice = rms >= Math.max(0.012, state.maxRms || 0.018);
        if (isVoice) {
            state.maxRms = Math.max(state.maxRms || 0, rms);
            audio._karaokeLiveLastVoiceAt = now;
        } else {
            const silenceDuration = now - (audio._karaokeLiveLastVoiceAt || now);
            const sentence = cues[audio._karaokeLiveIndex];
            const minimumSentenceTime = Math.max(0.18, countListeningTextSyllables(sentence?.text || '') * 0.025);
            if (silenceDuration >= 0.12 && now - audio._karaokeLiveStartedAt >= minimumSentenceTime && audio._karaokeLiveIndex < cues.length - 1) {
                audio._karaokeLiveIndex += 1;
                audio._karaokeLiveStartedAt = now;
                audio._karaokeLiveLastVoiceAt = now;
            }
        }
        root.querySelectorAll('[data-karaoke-index]').forEach((line, index) => line.classList.toggle('is-active', index === audio._karaokeLiveIndex));
        const activeLine = root.querySelector(`[data-karaoke-index="${audio._karaokeLiveIndex}"]`);
        if (activeLine && root._lastScrolledIndex !== audio._karaokeLiveIndex) {
            activeLine.scrollIntoView({ block: 'center', behavior: 'auto' });
            root._lastScrolledIndex = audio._karaokeLiveIndex;
        }
        audio._karaokeLiveLastTime = now;
        return true;
    }

    async function prepareKaraokeAudio(audio, root) {
        if (!audio || !root || !audio.currentSrc || !window.fetch) return;
        const part = APP_DATA.parts[currentPartIdx];
        if (!part) return;
        initKaraokeWaveform(audio, root);
        const analysisKey = `${currentPartIdx}|${audio.currentSrc}|${String(part.text || '').length}|${Number(part.listeningHighlightStart) || 0}`;
        if (audio._karaokePreparedFor === analysisKey) return;
        audio._karaokePreparedFor = analysisKey;
        try {
            const context = getKaraokeAudioContext();
            if (!context) return;
            const response = await fetch(audio.currentSrc);
            if (!response.ok) throw new Error('Audio fetch failed');
            const buffer = await context.decodeAudioData(await response.arrayBuffer());
            const hasPauseTiming = Array.isArray(part.karaoke) && part.karaoke.length && part.karaokeTimingMode === 'pause-v2';
            if (!hasPauseTiming) {
                const cues = assignKaraokeCuesFromSpeech(part, buffer);
                if (cues.length) {
                    part.karaoke = cues;
                    part.karaokeTimingMode = 'pause-v2';
                    if (editingTestId && typeof triggerEditorAutosave === 'function') triggerEditorAutosave();
                }
            }
            drawKaraokeWaveform(audio, root, buffer);
            if (part.karaoke && part.karaoke.length) {
                updateKaraokeHighlight(audio, root);
            }
            context.close();
        } catch (error) {
            console.warn('Automatic karaoke analysis unavailable; using duration fallback.', error);
        }
    }

    window.getListeningYoutubeVideoId = function(rawUrl) {
        try {
            let value = String(rawUrl || '').trim();
            if (!value) return '';

            const iframeMatch = value.match(/src\s*=\s*["']([^"']+)["']/i);
            if (iframeMatch && iframeMatch[1]) value = iframeMatch[1];

            const urlMatch = value.match(/https?:\/\/[^\s"'<>]+/i);
            if (urlMatch && urlMatch[0]) value = urlMatch[0].replace(/&amp;/g, '&');

            if (value && !/^[a-z][a-z\d+.-]*:/i.test(value)) value = `https://${value}`;
            const parsedUrl = new URL(value);
            const host = parsedUrl.hostname.replace(/^www\./, '').toLowerCase();
            let id = '';
            if (host === 'youtu.be') id = parsedUrl.pathname.split('/').filter(Boolean)[0] || '';
            else if (host === 'youtube.com' || host === 'm.youtube.com' || host === 'youtube-nocookie.com') {
                id = parsedUrl.searchParams.get('v') || parsedUrl.pathname.match(/^\/(?:embed|shorts|live)\/([^/?]+)/)?.[1] || '';
            }
            return /^[A-Za-z0-9_-]{11}$/.test(id) ? id : '';
        } catch (error) {
            return '';
        }
    };

    window.getListeningSoundCloudEmbedUrl = function(rawUrl) {
        try {
            let value = String(rawUrl || '').trim();
            if (!value) return '';

            const iframeMatch = value.match(/src\s*=\s*["']([^"']+)["']/i);
            if (iframeMatch && iframeMatch[1]) value = iframeMatch[1];

            const urlMatch = value.match(/https?:\/\/[^\s"'<>]+/i);
            if (urlMatch && urlMatch[0]) value = urlMatch[0].replace(/&amp;/g, '&');

            if (value && !/^[a-z][a-z\d+.-]*:/i.test(value)) value = `https://${value}`;
            const parsedUrl = new URL(value);
            const host = parsedUrl.hostname.replace(/^www\./, '').toLowerCase();
            if (!host.includes('soundcloud.com') && !host.includes('snd.sc')) return '';
            const target = host === 'w.soundcloud.com' && /\/player\//i.test(parsedUrl.pathname)
                ? value
                : `https://w.soundcloud.com/player/?url=${encodeURIComponent(value)}`;
            return target;
        } catch (error) {
            return '';
        }
    };

    function loadListeningYoutubeApi() {
        if (window.YT && window.YT.Player) return Promise.resolve(window.YT);
        if (listeningYoutubeApiPromise) return listeningYoutubeApiPromise;
        listeningYoutubeApiPromise = new Promise(resolve => {
            const previousReady = window.onYouTubeIframeAPIReady;
            window.onYouTubeIframeAPIReady = () => {
                if (typeof previousReady === 'function') previousReady();
                resolve(window.YT);
            };
            if (!document.querySelector('script[src="https://www.youtube.com/iframe_api"]')) {
                const script = document.createElement('script');
                script.src = 'https://www.youtube.com/iframe_api';
                document.head.appendChild(script);
            }
        });
        return listeningYoutubeApiPromise;
    };

    function destroyListeningYoutubePlayer(containerId) {
        const record = listeningYoutubePlayers.get(containerId);
        if (!record) return;
        if (record.timeTimer) clearInterval(record.timeTimer);
        if (record.player && typeof record.player.destroy === 'function') record.player.destroy();
        listeningYoutubePlayers.delete(containerId);
        const container = document.getElementById(containerId);
        if (container) {
            container.innerHTML = '';
            delete container.dataset.videoId;
        }
    }

    window.openListeningVideoFallback = function(rawUrl) {
        let value = String(rawUrl || '').trim();
        const videoId = window.getListeningYoutubeVideoId(value);
        if (videoId) {
            value = `https://www.youtube.com/watch?v=${videoId}`;
        }
        if (!value || !/^https?:\/\//i.test(value)) return;
        const popup = window.open(value, '_blank', 'noopener,noreferrer');
        if (!popup) {
            window.location.href = value;
        }
    };

    function renderListeningYoutubeFallback(container, videoId, message) {
        if (!container) return;
        const panel = document.createElement('div');
        panel.className = 'flex h-full w-full items-center justify-center bg-[#0b0b0d] p-6 text-center text-white';
        const content = document.createElement('div');
        const title = document.createElement('div');
        title.className = 'mb-2 text-xl font-bold';
        title.textContent = 'Video cannot play here';
        const detail = document.createElement('div');
        detail.className = 'mb-4 text-sm text-slate-300';
        detail.textContent = message;
        const link = document.createElement('a');
        link.className = 'inline-block rounded-full bg-white px-5 py-2 font-black text-slate-900 shadow';
        link.href = `https://www.youtube.com/watch?v=${videoId}`;
        link.target = '_blank';
        link.rel = 'noopener noreferrer';
        link.textContent = 'Open on YouTube';
        content.append(title, detail, link);
        panel.appendChild(content);
        container.replaceChildren(panel);
    }

    function getListeningPlayback(audioId, youtubeContainerId) {
        const record = youtubeContainerId && listeningYoutubePlayers.get(youtubeContainerId);
        return record ? record.facade : document.getElementById(audioId);
    }

    function getActiveListeningPlayback() {
        const examYoutube = listeningYoutubePlayers.has('exam-listening-youtube-player');
        const examAudio = document.getElementById('exam-listening-audio');
        if (examYoutube || (examAudio && examAudio.getAttribute('src'))) {
            return getListeningPlayback('exam-listening-audio', 'exam-listening-youtube-player');
        }
        return getListeningPlayback('practice-listening-audio', 'practice-youtube-player') || examAudio;
    }

    window.configureListeningMedia = function(rawUrl, audioId, youtubeContainerId, callbacks = {}) {
        const url = (rawUrl || '').trim();
        const videoId = window.getListeningYoutubeVideoId(url);
        const soundcloudEmbedUrl = window.getListeningSoundCloudEmbedUrl(url);
        const audio = document.getElementById(audioId);
        const youtubeContainer = document.getElementById(youtubeContainerId);

        if ((soundcloudEmbedUrl || videoId) && youtubeContainer) {
            if (audio) {
                audio.pause();
                audio.removeAttribute('src');
                audio.load();
                audio.classList.add('hidden');
            }
            youtubeContainer.classList.remove('hidden');

            if (soundcloudEmbedUrl && !videoId) {
                const existing = listeningYoutubePlayers.get(youtubeContainerId);
                if (existing && existing.embedUrl === soundcloudEmbedUrl) {
                    existing.callbacks = callbacks;
                    if (callbacks.onReady) callbacks.onReady();
                    return existing.facade;
                }
                destroyListeningYoutubePlayer(youtubeContainerId);
                const iframe = document.createElement('iframe');
                iframe.src = soundcloudEmbedUrl;
                iframe.title = 'SoundCloud player';
                iframe.allow = 'autoplay; encrypted-media';
                iframe.loading = 'lazy';
                iframe.frameBorder = '0';
                iframe.className = 'w-full h-full rounded-xl';
                iframe.style.border = '0';
                youtubeContainer.innerHTML = '';
                youtubeContainer.appendChild(iframe);

                const record = { embedUrl: soundcloudEmbedUrl, player: iframe, state: 1, callbacks };
                record.facade = {
                    isSoundCloud: true,
                    get currentTime() { return 0; },
                    get duration() { return 0; },
                    set currentTime(value) {},
                    get paused() { return false; },
                    get ended() { return false; },
                    play() { return Promise.resolve(); },
                    pause() {},
                    setKaraokeStateListener(listener) {}
                };
                listeningYoutubePlayers.set(youtubeContainerId, record);
                if (callbacks.onReady) callbacks.onReady();
                return record.facade;
            }

            if (videoId) {
                if (window.location.protocol === 'file:') {
                    if (audio) {
                        audio.pause();
                        audio.removeAttribute('src');
                        audio.load();
                        audio.classList.add('hidden');
                    }
                    youtubeContainer.classList.remove('hidden');
                    youtubeContainer.innerHTML = `
                        <div class="flex h-full w-full items-center justify-center bg-[#0b0b0d] text-white p-6 text-center">
                            <div>
                                <div class="text-3xl font-black mb-3">▶</div>
                                <div class="text-xl font-bold mb-2">YouTube video</div>
                                <div class="text-sm text-slate-300 mb-4">Open this video in a browser tab because embedded YouTube playback is blocked on local files.</div>
                                <button type="button" onclick="window.openListeningVideoFallback('${url.replace(/'/g, "\\'")}' )" class="bg-white text-slate-900 font-black px-5 py-2 rounded-full shadow">Open video</button>
                            </div>
                        </div>
                    `;
                    if (callbacks.onError) callbacks.onError('Embedded YouTube playback is blocked on local files. Opening the video in a new tab instead.');
                    window.openListeningVideoFallback(url);
                    return null;
                }
                const existing = listeningYoutubePlayers.get(youtubeContainerId);
                if (existing && existing.videoId === videoId) {
                    existing.callbacks = callbacks;
                    if (existing.ready && callbacks.onReady) callbacks.onReady();
                    return existing.facade;
                }
                destroyListeningYoutubePlayer(youtubeContainerId);

                const mountId = `${youtubeContainerId}-mount`;
                youtubeContainer.innerHTML = `<div id="${mountId}" class="w-full h-full"></div>`;
                youtubeContainer.dataset.videoId = videoId;
                const record = { videoId, player: null, state: -1, onStateChange: null, timeTimer: null, callbacks };
                record.facade = {
                    isYouTube: true,
                    get currentTime() {
                        try { return record.player ? record.player.getCurrentTime() || 0 : 0; } catch (error) { return 0; }
                    },
                    get duration() {
                        try { return record.player ? record.player.getDuration() || 0 : 0; } catch (error) { return 0; }
                    },
                    set currentTime(value) {
                        const time = Math.max(0, Number(value) || 0);
                        if (record.player) record.player.seekTo(time, true);
                    },
                    get paused() { return record.state !== 1; },
                    get ended() { return record.state === 0; },
                    play() {
                        if (record.player) record.player.playVideo();
                        else record.pendingPlay = true;
                        return Promise.resolve();
                    },
                    pause() { if (record.player) record.player.pauseVideo(); },
                    setKaraokeStateListener(listener) { record.onStateChange = listener; }
                };
                listeningYoutubePlayers.set(youtubeContainerId, record);
                loadListeningYoutubeApi().then(YT => {
                    if (listeningYoutubePlayers.get(youtubeContainerId) !== record) return;
                    const playerVars = {
                        controls: callbacks.controls === false ? 0 : 1,
                        disablekb: callbacks.controls === false ? 1 : 0,
                        fs: callbacks.controls === false ? 0 : 1,
                        playsinline: 1,
                        rel: 0,
                        enablejsapi: 1
                    };
                    if (window.location.protocol === 'http:' || window.location.protocol === 'https:') {
                        playerVars.origin = window.location.origin;
                    }
                    record.player = new YT.Player(mountId, {
                        videoId,
                        width: '100%',
                        height: '100%',
                        playerVars,
                        events: {
                            onReady: () => {
                                record.ready = true;
                                if (record.callbacks.onReady) record.callbacks.onReady();
                                if (record.pendingPlay) record.player.playVideo();
                            },
                            onStateChange: event => {
                                record.state = event.data;
                                if (record.onStateChange) record.onStateChange(event.data === 1);
                                if (event.data === 1 && !record.timeTimer) {
                                    record.timeTimer = setInterval(() => {
                                        if (youtubeContainerId === 'edit-listening-youtube-player') {
                                            const timeLabel = document.getElementById('karaoke-editor-time');
                                            if (timeLabel) timeLabel.textContent = formatKaraokeEditorTime(record.facade.currentTime);
                                        }
                                    }, 100);
                                } else if (event.data !== 1 && record.timeTimer) {
                                    clearInterval(record.timeTimer);
                                    record.timeTimer = null;
                                }
                            },
                            onError: event => {
                                const message = event.data === 153
                                    ? 'This YouTube video does not allow embedded playback (error 153). Use a different YouTube link that allows embedding, or open the original video in a browser. Opening from file:// can also block embedded playback.'
                                    : event.data === 101 || event.data === 150
                                        ? 'This YouTube video does not allow embedded playback.'
                                        : `YouTube player error (${event.data}).`;
                                if (record.callbacks.onError) record.callbacks.onError(message);
                                renderListeningYoutubeFallback(youtubeContainer, videoId, message);
                            }
                        }
                    });
                }).catch(error => {
                    const message = 'The embedded player could not load. Open the video directly on YouTube.';
                    if (record.callbacks.onError) record.callbacks.onError(message);
                    renderListeningYoutubeFallback(youtubeContainer, videoId, message);
                    console.error('YouTube player API failed:', error);
                });
                return record.facade;
            }
        }

        destroyListeningYoutubePlayer(youtubeContainerId);
        if (youtubeContainer) youtubeContainer.classList.add('hidden');
        if (audio) {
            audio.classList.remove('hidden');
            audio.crossOrigin = 'anonymous';
            audio.src = url;
            audio.load();
        }
        return audio;
    };

    window.clearListeningMedia = function(audioId, youtubeContainerId) {
        destroyListeningYoutubePlayer(youtubeContainerId);
        const audio = document.getElementById(audioId);
        if (audio) {
            audio.pause();
            audio.removeAttribute('src');
            audio.load();
        }
    };

    window.renderListeningEditorPreview = function(rawUrl) {
        const audioEl = document.getElementById('edit-listening-audio');
        const status = document.getElementById('edit-audio-preview-status');
        const youtubeVideoId = window.getListeningYoutubeVideoId(rawUrl);
        const soundcloudEmbedUrl = window.getListeningSoundCloudEmbedUrl(rawUrl);
        if (youtubeVideoId) {
            if (status) status.textContent = 'Loading YouTube preview...';
            window.configureListeningMedia(rawUrl, 'edit-listening-audio', 'edit-listening-youtube-player', {
                onReady: () => { if (status) status.textContent = `YouTube preview ready for Part ${currentEditorPartIdx + 1}.`; },
                onError: message => { if (status) status.textContent = message; }
            });
            return;
        }
        if (soundcloudEmbedUrl) {
            if (status) status.textContent = 'Loading SoundCloud preview...';
            window.configureListeningMedia(rawUrl, 'edit-listening-audio', 'edit-listening-youtube-player', {
                onReady: () => { if (status) status.textContent = `SoundCloud preview ready for Part ${currentEditorPartIdx + 1}.`; },
                onError: message => { if (status) status.textContent = message; }
            });
            return;
        }
        if (audioEl) {
            audioEl.onerror = () => { if (status) status.textContent = 'Audio could not be loaded. Check the direct audio URL.'; };
            audioEl.onloadedmetadata = () => {
                if (status) status.textContent = `Audio ready for Part ${currentEditorPartIdx + 1}.`;
            };
            window.configureListeningMedia(rawUrl, 'edit-listening-audio', 'edit-listening-youtube-player');
        }
        if (status) status.textContent = rawUrl ? 'Loading audio preview...' : '';
    };

    window.updateListeningEditorAudio = function(rawUrl) {
        const url = (rawUrl || '').trim();
        const inputEl = document.getElementById('edit-audio-url');
        if (inputEl && inputEl.value !== url) inputEl.value = url;
        
        // Safely assign to data model
        if (APP_DATA && APP_DATA.parts && APP_DATA.parts[currentEditorPartIdx]) {
            APP_DATA.parts[currentEditorPartIdx].audioUrl = url;
        }
        
        window.renderListeningEditorPreview(rawUrl);
        
        if (typeof window.triggerEditorAutosave === 'function') window.triggerEditorAutosave();
    };

    window.seekKaraokeAudio = function(time) {
        const audio = getActiveListeningPlayback();
        const seekTime = Number(time);
        if (audio && Number.isFinite(seekTime)) {
            audio.currentTime = Math.max(0, seekTime);
            audio.play().catch(error => console.log('Auto-play prevented', error));
        }
    };

    window.seekKaraokeSentence = function(index, event) {
        if (event) event.stopPropagation();
        const audio = getActiveListeningPlayback();
        const cues = getKaraokeCues(APP_DATA.parts[currentPartIdx] || {});
        const cue = cues[Number(index)];
        if (!audio || !cue || cue.start === null || !Number.isFinite(Number(cue.start))) return;
        audio._karaokeLiveIndex = Number(index);
        audio._karaokeLiveKey = `${currentPartIdx}|${String(APP_DATA.parts[currentPartIdx]?.text || '').length}`;
        audio._karaokeLiveLastTime = Number(cue.start);
        audio.currentTime = Math.max(0, Number(cue.start));
        const root = document.querySelector('[data-karaoke-root]');
        if (root) {
            root.querySelectorAll('[data-karaoke-index]').forEach((line, lineIndex) => line.classList.toggle('is-active', lineIndex === Number(index)));
            root._lastScrolledIndex = Number(index);
        }
        audio.play().catch(error => console.log('Auto-play prevented', error));
    };

    function renderKaraokeTranscript(part) {
        const cues = getKaraokeCues(part);
        if (!cues.length) return '';
        return `<div class="karaoke-transcript space-y-2 leading-relaxed" data-karaoke-root>${cues.map((cue, index) => {
            let lineText = escapeKaraokeText(cue.text);
            if (typeof isTimeFree !== 'undefined' && isTimeFree) {
                if (APP_DATA?.grammar?.length) {
                    APP_DATA.grammar.forEach((g, gIdx) => {
                        const cleanTerm = String(g.term || '').replace(/^[^a-zA-Z0-9]+|[^a-zA-Z0-9]+$/g, '');
                        if (!cleanTerm) return;
                        const regex = new RegExp(`(?![^<]*>)\\b(${cleanTerm.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})\\b`, 'gi');
                        lineText = lineText.replace(regex, `<span class="grammar-word" onclick="event.stopPropagation(); showGrammarPop(event, ${gIdx})">$1</span>`);
                    });
                }
                if (APP_DATA?.vocab?.length) {
                    APP_DATA.vocab.forEach((v, vIdx) => {
                        const cleanTerm = String(v.term || '').replace(/^[^a-zA-Z0-9]+|[^a-zA-Z0-9]+$/g, '');
                        if (!cleanTerm) return;
                        const regex = new RegExp(`(?![^<]*>)\\b(${cleanTerm.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})\\b`, 'gi');
                        lineText = lineText.replace(regex, `<span class="vocab-word" onclick="event.stopPropagation(); showVocabPop(event, ${vIdx})">$1</span>`);
                    });
                }
            }
            const hasTime = cue.start !== null;
            const clickAttr = hasTime ? `onclick="window.seekKaraokeSentence(${index}, event)"` : '';
            const styleClass = hasTime ? 'cursor-pointer hover:bg-blue-50' : '';
            return `<div class="karaoke-line block w-full px-1.5 py-0.5 rounded transition-all duration-200 ${styleClass}" data-karaoke-index="${index}" ${clickAttr}>${lineText}</div>`;
        }).join('')}</div>`;
    }

    window.seekKaraokeAudioByIndex = function(index) {
        const audio = getActiveListeningPlayback();
        if (!audio) return;
        const cues = getKaraokeCues(APP_DATA.parts[currentPartIdx] || {});
        const cue = cues[Number(index)];
        if (cue && cue.start !== null) window.seekKaraokeAudio(cue.start);
    };

    function updateKaraokeHighlight(audio, root) {
        if (!audio || !root) return;
        const cues = getKaraokeCues(APP_DATA.parts[currentPartIdx] || {});
        const time = audio.currentTime || 0;
        let activeIndex = -1;
        cues.forEach((cue, index) => {
            const isLastOrNoEnd = cue.end === null || cue.end === 0;
            const active = cue.start !== null && (isLastOrNoEnd ? time >= cue.start : time >= cue.start && time < cue.end);
            const line = root.querySelector(`[data-karaoke-index="${index}"]`);
            if (line) line.classList.toggle('is-active', active);
            if (active) activeIndex = index;
        });
        if (activeIndex >= 0 && root._lastScrolledIndex !== activeIndex) {
            const line = root.querySelector(`[data-karaoke-index="${activeIndex}"]`);
            if (line) {
                line.scrollIntoView({ block: 'center', behavior: 'auto' });
                root._lastScrolledIndex = activeIndex;
            }
        }
    }

    function updateLatexGapHighlight(audio) {
        if (!audio || !Number.isFinite(Number(audio.currentTime))) return;
        const gaps = Array.from(document.querySelectorAll('.latex-timed-gap'))
            .map(element => ({ element, time: Number(element.dataset.latexGapTime) }))
            .filter(gap => Number.isFinite(gap.time))
            .sort((left, right) => left.time - right.time);
        const currentTime = Number(audio.currentTime);
        gaps.forEach((gap, index) => {
            const nextTime = gaps.slice(index + 1).find(next => next.time > gap.time)?.time ?? Infinity;
            const active = currentTime >= gap.time && currentTime < nextTime;
            gap.element.classList.toggle('ring-4', active);
            gap.element.classList.toggle('ring-amber-400', active);
            gap.element.classList.toggle('bg-amber-100', active);
        });
    }

    function wireKaraokeAudio(audio, root) {
        if (!audio || !root) return;
        if (audio._karaokeCleanup) audio._karaokeCleanup();
        const tick = () => {
            updateKaraokeHighlight(audio, root);
            updateLatexGapHighlight(audio);
            if (!audio.paused && !audio.ended) audio._karaokeFrame = requestAnimationFrame(tick);
        };
        const start = () => {
            if (audio._karaokeFrame) cancelAnimationFrame(audio._karaokeFrame);
            audio._karaokeFrame = requestAnimationFrame(tick);
        };
        const stop = () => {
            if (audio._karaokeFrame) cancelAnimationFrame(audio._karaokeFrame);
            audio._karaokeFrame = null;
            updateKaraokeHighlight(audio, root);
            updateLatexGapHighlight(audio);
        };
        if (audio.isYouTube) {
            audio.setKaraokeStateListener(playing => playing ? start() : stop());
            audio._karaokeCleanup = () => {
                audio.setKaraokeStateListener(null);
                stop();
            };
            if (!audio.paused) start();
            updateKaraokeHighlight(audio, root);
            return;
        }
        audio.addEventListener('play', start);
        audio.addEventListener('pause', stop);
        audio.addEventListener('ended', stop);
        audio.addEventListener('loadedmetadata', stop);
        audio._karaokeCleanup = () => {
            audio.removeEventListener('play', start);
            audio.removeEventListener('pause', stop);
            audio.removeEventListener('ended', stop);
            audio.removeEventListener('loadedmetadata', stop);
        };
        updateKaraokeHighlight(audio, root);
    }

    function wrapListeningWords(lineHtml) {
        const holder = document.createElement('span');
        holder.innerHTML = lineHtml;
        let wordIndex = 0;
        const walker = document.createTreeWalker(holder, NodeFilter.SHOW_TEXT);
        const textNodes = [];
        let node;
        while (node = walker.nextNode()) textNodes.push(node);
        textNodes.forEach(textNode => {
            if (textNode.parentElement?.closest('.vocab-word')) return;
            const fragment = document.createDocumentFragment();
            textNode.nodeValue.split(/(\s+)/).forEach(part => {
                if (/\s+/.test(part)) fragment.appendChild(document.createTextNode(part));
                else if (part) {
                    const word = document.createElement('span');
                    word.className = 'speech-word';
                    word.textContent = part;
                    fragment.appendChild(word);
                }
            });
            textNode.parentNode.replaceChild(fragment, textNode);
        });
        holder.querySelectorAll('.vocab-word, .grammar-word').forEach(word => {
            if (!word.classList.contains('speech-word')) {
                word.classList.add('speech-word');
            }
        });
        holder.querySelectorAll('.speech-word').forEach(word => {
            word.dataset.listeningWord = String(wordIndex++);
        });
        return holder.innerHTML;
    }

    function renderListeningTranscript(part) {
        const cues = getListeningCues(part);
        if (!cues.length) return '';
        
        return `<div class="listening-transcript space-y-2 leading-relaxed" data-listening-root>${cues.map((cue, index) => {
            let lineText = escapeListeningText(cue.text);
            
            // Keep vocabulary terms clickable inside the listening transcript.
            if (typeof isTimeFree !== 'undefined' && isTimeFree && APP_DATA) {
                if (APP_DATA.grammar && APP_DATA.grammar.length > 0) {
                    APP_DATA.grammar.forEach((g, gIdx) => {
                        const cleanTerm = g.term.replace(/^[^a-zA-Z0-9]+|[^a-zA-Z0-9]+$/g, '');
                        if (!cleanTerm) return;
                        const regex = new RegExp(`(?![^<]*>)\\b(${cleanTerm.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})\\b`, 'gi');
                        lineText = lineText.replace(regex, `<span class="grammar-word" onclick="showGrammarPop(event, ${gIdx})">$1</span>`);
                    });
                }
                if (APP_DATA.vocab && APP_DATA.vocab.length > 0) {
                    APP_DATA.vocab.forEach((v, vIdx) => {
                        const cleanTerm = v.term.replace(/^[^a-zA-Z0-9]+|[^a-zA-Z0-9]+$/g, '');
                        if (!cleanTerm) return;
                        const regex = new RegExp(`(?![^<]*>)\\b(${cleanTerm.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})\\b`, 'gi');
                        lineText = lineText.replace(regex, `<span class="vocab-word" onclick="showVocabPop(event, ${vIdx})">$1</span>`);
                    });
                }
            }
            
            return `<div class="listening-line block w-full px-2 py-1 rounded" data-listening-index="${index}">${wrapListeningWords(lineText)}</div>`;
        }).join('')}</div>`;
    }

    function updateListeningHighlight(audio, root) {
        if (!audio || !root) return;
        const cues = getListeningCues(APP_DATA.parts[currentPartIdx] || {}, audio.duration);
        const time = audio.currentTime || 0;
        let activeIndex = -1;
        cues.forEach((cue, index) => {
            const active = cue.start !== null && time >= cue.start && (cue.end === null || time < cue.end);
            const line = root.querySelector(`[data-listening-index="${index}"]`);
            if (line) {
                line.classList.toggle('is-active', active);
                if (active && isListeningSpeechActive(audio)) {
                    line.querySelectorAll('.speech-word').forEach(word => word.classList.remove('is-speaking'));
                    const words = line.querySelectorAll('.speech-word');
                    const cueEnd = cue.end === null ? audio.duration : cue.end;
                    const cueDuration = Math.max(0.01, cueEnd - cue.start);
                    const progress = Math.min(0.999, Math.max(0, (time - cue.start) / cueDuration));
                    const weights = Array.from(words).map(word => countListeningSyllables(word.textContent));
                    const totalWeight = weights.reduce((sum, weight) => sum + weight, 0) || 1;
                    let targetWeight = progress * totalWeight;
                    let wordIndex = 0;
                    for (let word = 0; word < weights.length; word++) {
                        targetWeight -= weights[word];
                        if (targetWeight < 0) {
                            wordIndex = word;
                            break;
                        }
                    }
                    if (words[wordIndex]) words[wordIndex].classList.add('is-speaking');
                }
            }
            if (active) activeIndex = index;
        });
        if (activeIndex >= 0) {
            const line = root.querySelector(`[data-listening-index="${activeIndex}"]`);
            if (line && line.dataset.listeningScrolled !== 'true') {
                line.scrollIntoView({ block: 'nearest', behavior: 'auto' });
                line.dataset.listeningScrolled = 'true';
            }
        }
    }

    function wireListeningAudio(audio, root) {
        if (!audio || !root) return;
        if (audio._listeningCleanup) audio._listeningCleanup();
        const tick = () => {
            updateListeningHighlight(audio, root);
            if (!audio.paused && !audio.ended) listeningAnimationFrame = requestAnimationFrame(tick);
        };
        const start = () => {
            ensureListeningWaveform(audio);
            if (audio._listeningAnalyser?.context.state === 'suspended') audio._listeningAnalyser.context.resume().catch(() => {});
            if (listeningAnimationFrame) cancelAnimationFrame(listeningAnimationFrame);
            listeningAnimationFrame = requestAnimationFrame(tick);
        };
        const stop = () => {
            if (listeningAnimationFrame) cancelAnimationFrame(listeningAnimationFrame);
            listeningAnimationFrame = null;
            updateListeningHighlight(audio, root);
        };
        audio.addEventListener('play', start);
        audio.addEventListener('pause', stop);
        audio.addEventListener('ended', stop);
        audio.addEventListener('loadedmetadata', stop);
        audio._listeningCleanup = () => {
            audio.removeEventListener('play', start);
            audio.removeEventListener('pause', stop);
            audio.removeEventListener('ended', stop);
            audio.removeEventListener('loadedmetadata', stop);
        };
        updateListeningHighlight(audio, root);
    }

    // --- IELTS BAND DESCRIPTORS (Writing Task 2) ---
    const IELTS_DESCRIPTORS = {
        tr: {
            '9': '[TR] Band 9: The prompt is appropriately addressed and explored in depth. A clear and fully developed position is presented which directly answers the question/s. Ideas are relevant, fully extended and well supported. Any lapses in content or support are extremely rare.',
            '8.5': '[TR] Band 8.5: Meets all criteria for Band 8 and some for Band 9.',
            '8': '[TR] Band 8: The prompt is appropriately and sufficiently addressed. A clear and well-developed position is presented in response to the question/s. Ideas are relevant, well extended and supported. There may be occasional omissions or lapses in content.',
            '7.5': '[TR] Band 7.5: Meets all criteria for Band 7 and some for Band 8.',
            '7': '[TR] Band 7: The main parts of the prompt are appropriately addressed. A clear and developed position is presented. Main ideas are extended and supported but there may be a tendency to over-generalise or there may be a lack of focus and precision in supporting ideas/material.',
            '6.5': '[TR] Band 6.5: Meets all criteria for Band 6 and some for Band 7.',
            '6': '[TR] Band 6: The main parts of the prompt are addressed. A position is presented that is directly relevant, although conclusions may be unclear. Main ideas are relevant, but some may be insufficiently developed.',
            '5.5': '[TR] Band 5.5: Meets all criteria for Band 5 and some for Band 6.',
            '5': '[TR] Band 5: The main parts of the prompt are incompletely addressed. The writer expresses a position, but the development is not always clear. Some main ideas are put forward, but they are limited and not sufficiently developed.',
            '4.5': '[TR] Band 4.5: Meets all criteria for Band 4 and some for Band 5.',
            '4': '[TR] Band 4: The prompt is tackled in a minimal way. A position is discernible, but the reader has to read carefully to find it. Main ideas are difficult to identify and lack relevance or support.'
        },
        cc: {
            '9': '[CC] Band 9: The message can be followed effortlessly. Cohesion is used in such a way that it very rarely attracts attention. Any lapses in coherence or cohesion are minimal. Paragraphing is skilfully managed.',
            '8.5': '[CC] Band 8.5: Meets all criteria for Band 8 and some for Band 9.',
            '8': '[CC] Band 8: The message can be followed with ease. Information and ideas are logically sequenced, and cohesion is well managed. Occasional lapses in coherence and cohesion may occur. Paragraphing is used sufficiently and appropriately.',
            '7.5': '[CC] Band 7.5: Meets all criteria for Band 7 and some for Band 8.',
            '7': '[CC] Band 7: Information and ideas are logically organised, and there is a clear progression throughout. A range of cohesive devices including reference and substitution is used flexibly but with some inaccuracies. Paragraphing is generally used effectively.',
            '6.5': '[CC] Band 6.5: Meets all criteria for Band 6 and some for Band 7.',
            '6': '[CC] Band 6: Information and ideas are generally arranged coherently and there is a clear overall progression. Cohesive devices are used to some good effect but may be faulty or mechanical. Paragraphing may not always be logical.',
            '5.5': '[CC] Band 5.5: Meets all criteria for Band 5 and some for Band 6.',
            '5': '[CC] Band 5: Organisation is evident but is not wholly logical and there may be a lack of overall progression. The relationship of ideas can be followed but sentences are not fluently linked. Paragraphing may be inadequate or missing.',
            '4.5': '[CC] Band 4.5: Meets all criteria for Band 4 and some for Band 5.',
            '4': '[CC] Band 4: Information and ideas are evident but not arranged coherently and there is no clear progression. Relationships between ideas can be unclear and/or inadequately marked. There may be no paragraphing.'
        },
        lr: {
            '9': '[LR] Band 9: Full flexibility and precise use are widely evident. A wide range of vocabulary is used accurately and appropriately with very natural and sophisticated control of lexical features. Minor errors are extremely rare.',
            '8.5': '[LR] Band 8.5: Meets all criteria for Band 8 and some for Band 9.',
            '8': '[LR] Band 8: A wide resource is fluently and flexibly used to convey precise meanings. There is skilful use of uncommon and/or idiomatic items when appropriate, despite occasional inaccuracies. Occasional errors may occur.',
            '7.5': '[LR] Band 7.5: Meets all criteria for Band 7 and some for Band 8.',
            '7': '[LR] Band 7: The resource is sufficient to allow some flexibility and precision. There is some ability to use less common and/or idiomatic items. An awareness of style and collocation is evident, though inappropriacies occur.',
            '6.5': '[LR] Band 6.5: Meets all criteria for Band 6 and some for Band 7.',
            '6': '[LR] Band 6: The resource is generally adequate and appropriate for the task. The meaning is generally clear in spite of a rather restricted range or a lack of precision in word choice. There are some errors but these do not impede communication.',
            '5.5': '[LR] Band 5.5: Meets all criteria for Band 5 and some for Band 6.',
            '5': '[LR] Band 5: The resource is limited but minimally adequate for the task. Simple vocabulary may be used accurately. There may be frequent lapses in the appropriacy of word choice and a lack of flexibility.',
            '4.5': '[LR] Band 4.5: Meets all criteria for Band 4 and some for Band 5.',
            '4': '[LR] Band 4: The resource is limited and inadequate for or unrelated to the task. Vocabulary is basic and may be used repetitively. Inappropriate word choice and/or errors may impede meaning.'
        },
        gra: {
            '9': '[GRA] Band 9: A wide range of structures is used with full flexibility and control. Punctuation and grammar are used appropriately throughout. Minor errors are extremely rare and have minimal impact.',
            '8.5': '[GRA] Band 8.5: Meets all criteria for Band 8 and some for Band 9.',
            '8': '[GRA] Band 8: A wide range of structures is flexibly and accurately used. The majority of sentences are error-free, and punctuation is well managed. Occasional, non-systematic errors occur, but have minimal impact.',
            '7.5': '[GRA] Band 7.5: Meets all criteria for Band 7 and some for Band 8.',
            '7': '[GRA] Band 7: A variety of complex structures is used with some flexibility and accuracy. Grammar and punctuation are generally well controlled, and error-free sentences are frequent. A few errors in grammar may persist.',
            '6.5': '[GRA] Band 6.5: Meets all criteria for Band 6 and some for Band 7.',
            '6': '[GRA] Band 6: A mix of simple and complex sentence forms is used but flexibility is limited. Examples of more complex structures are not marked by the same level of accuracy as in simple structures. Errors occur but rarely impede communication.',
            '5.5': '[GRA] Band 5.5: Meets all criteria for Band 5 and some for Band 6.',
            '5': '[GRA] Band 5: The range of structures is limited and rather repetitive. Although complex sentences are attempted, they tend to be faulty, and the greatest accuracy is achieved on simple sentences. Grammatical errors may be frequent.',
            '4.5': '[GRA] Band 4.5: Meets all criteria for Band 4 and some for Band 5.',
            '4': '[GRA] Band 4: A very limited range of structures is used. Subordinate clauses are rare and simple sentences predominate. Some structures are produced accurately but grammatical errors are frequent and may impede meaning.'
        }
    };
