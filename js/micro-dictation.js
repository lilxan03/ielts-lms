(function() {
    let activeAudio = null;
    let activeFrame = null;

    const numberWords = new Set([
        'zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten',
        'eleven', 'twelve', 'thirteen', 'fourteen', 'fifteen', 'sixteen', 'seventeen', 'eighteen',
        'nineteen', 'twenty', 'thirty', 'forty', 'fifty', 'sixty', 'seventy', 'eighty', 'ninety',
        'hundred', 'thousand', 'million', 'billion', 'half', 'quarter'
    ]);
    const sentenceStarters = new Set([
        'a', 'an', 'although', 'after', 'and', 'as', 'at', 'before', 'because', 'but', 'by',
        'during', 'for', 'from', 'he', 'her', 'here', 'his', 'however', 'if', 'in', 'it',
        'many', 'most', 'near', 'next', 'of', 'on', 'or', 'our', 'she', 'some', 'that',
        'the', 'their', 'there', 'these', 'they', 'this', 'those', 'to', 'we', 'when',
        'where', 'which', 'while', 'who', 'with', 'you'
    ]);
    const nameTitles = new Set(['dr', 'mr', 'mrs', 'ms', 'prof', 'professor', 'sir', 'saint']);

    function escapeHtml(value) {
        return String(value || '').replace(/[&<>"']/g, character => ({
            '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
        })[character]);
    }

    function getPlainTranscript(text) {
        return String(text || '')
            .replace(/<[^>]*>/g, ' ')
            .replace(/&nbsp;|&#160;/gi, ' ')
            .replace(/&amp;/gi, '&')
            .replace(/&lt;/gi, '<')
            .replace(/&gt;/gi, '>')
            .replace(/&quot;/gi, '"')
            .replace(/&#39;|&apos;/gi, "'")
            .replace(/&#(\d{1,7});/g, (entity, value) => {
                const codePoint = Number(value);
                return codePoint <= 0x10ffff ? String.fromCodePoint(codePoint) : entity;
            })
            .replace(/\s+/g, ' ')
            .trim();
    }

    function splitTranscript(text) {
        return (getPlainTranscript(text).match(/[^.!?]+[.!?]+|[^.!?]+$/g) || [])
            .map(sentence => sentence.trim())
            .filter(Boolean);
    }

    function getSyllableWeight(text) {
        return (String(text).match(/[aeiouy]+/gi) || []).length || 1;
    }

    function buildCueTimes(part, duration) {
        const sentences = splitTranscript(part.text);
        const startOffset = Math.max(0, Number(part.listeningHighlightStart) || 0);
        const saved = Array.isArray(part.karaoke) ? part.karaoke : [];
        const hasSavedTimings = sentences.length && sentences.every((sentence, index) =>
            saved[index] && Number.isFinite(Number(saved[index].start)) && Number.isFinite(Number(saved[index].end)) &&
            Number(saved[index].end) > Number(saved[index].start)
        );

        if (hasSavedTimings) {
            return sentences.map((text, index) => ({
                text,
                start: Math.max(0, Number(saved[index].start)),
                end: Math.min(duration, Number(saved[index].end))
            })).filter(cue => cue.end > cue.start);
        }

        const availableDuration = Math.max(0, duration - startOffset);
        if (!sentences.length || !availableDuration) return [];
        const weights = sentences.map(getSyllableWeight);
        const totalWeight = weights.reduce((sum, weight) => sum + weight, 0);
        let currentTime = startOffset;
        return sentences.map((text, index) => {
            const start = currentTime;
            currentTime += availableDuration * weights[index] / totalWeight;
            return { text, start, end: currentTime };
        });
    }

    function buildMicroDictationSegments(part, audioDuration, segmentDuration) {
        if (!Number.isFinite(audioDuration) || audioDuration <= 0 ||
            !Number.isFinite(segmentDuration) || segmentDuration < 5 || segmentDuration > 10) return [];
        const cues = buildCueTimes(part, audioDuration);
        const segmentCount = Math.ceil(audioDuration / segmentDuration);
        if (!cues.length || segmentCount > 3000) return [];
        const segmentTexts = Array.from({ length: segmentCount }, () => []);
        cues.forEach(cue => {
            const words = cue.text.split(/\s+/).filter(Boolean);
            words.forEach((word, wordIndex) => {
                const wordTime = cue.start + (cue.end - cue.start) * (wordIndex + 0.5) / words.length;
                const segmentIndex = Math.min(segmentCount - 1, Math.floor(wordTime / segmentDuration));
                segmentTexts[segmentIndex].push(word);
            });
        });
        return Array.from({ length: segmentCount }, (_, index) => {
            const start = index * segmentDuration;
            const end = Math.min(audioDuration, start + segmentDuration);
            return { start, end, text: segmentTexts[index].join(' ') };
        }).filter(segment => segment.text);
    }

    function normalizeAnswer(value) {
        return String(value || '')
            .normalize('NFKC')
            .toLocaleLowerCase()
            .replace(/[’‘]/g, "'")
            .replace(/[^\p{L}\p{N}'-]/gu, '');
    }

    function getTargetWords(sentence) {
        const matches = [...sentence.matchAll(/[\p{L}\p{N}]+(?:['’-][\p{L}\p{N}]+)*/gu)];
        const targets = [];
        matches.forEach((match, index) => {
            const word = match[0];
            const lower = word.toLocaleLowerCase();
            const isNumber = /\d/.test(word) || numberWords.has(lower);
            const isSentenceInitial = index === 0 || /[.!?]\s*$/.test(sentence.slice(0, match.index));
            const isProperName = /^\p{Lu}/u.test(word) &&
                !nameTitles.has(lower) && (!isSentenceInitial || !sentenceStarters.has(lower));
            const isDifficultWord = word.length >= 8;
            if (isNumber || isProperName || isDifficultWord) targets.push({ word, index });
        });
        return targets;
    }

    window.getMicroDictationTargets = getTargetWords;
    window.buildMicroDictationSegments = buildMicroDictationSegments;

    window.renderMicroDictation = function(part, enabled) {
        const transcript = getPlainTranscript(part?.text);
        const source = String(part?.audioUrl || '').trim();
        if (!source) return '';
        let audioUrl;
        try {
            audioUrl = new URL(source, window.location.href);
        } catch {
            return '';
        }
        const youtubeUrl = typeof window.getListeningYoutubeVideoId === 'function' &&
            window.getListeningYoutubeVideoId(part.audioUrl);
        const soundCloudUrl = typeof window.getListeningSoundCloudEmbedUrl === 'function' &&
            window.getListeningSoundCloudEmbedUrl(part.audioUrl);
        if (!enabled || !transcript || !['http:', 'https:'].includes(audioUrl.protocol) || youtubeUrl || soundCloudUrl) return '';

        return `
          <section class="micro-dictation" id="micro-dictation" aria-label="Micro-dictation practice">
            <div class="micro-dictation__intro">
              <div>
                <h3>Micro-Dictation · Nghe chép ngắt quãng</h3>
                <p>Nghe từng đoạn ngắn, điền từ nghe được. Bài tập ưu tiên số liệu, tên riêng và từ dài.</p>
              </div>
              <label>Đoạn nghe
                <select id="micro-dictation-duration" aria-label="Segment length">
                  <option value="5">5 giây</option>
                  <option value="8" selected>8 giây</option>
                  <option value="10">10 giây</option>
                </select>
              </label>
            </div>
            <audio id="micro-dictation-audio" preload="metadata" src="${escapeHtml(audioUrl.href)}"></audio>
            <div id="micro-dictation-content" class="micro-dictation__content" aria-live="polite">
              <p>Đang tải thời lượng audio để tạo các đoạn luyện nghe…</p>
            </div>
          </section>`;
    };

    window.initMicroDictation = function(part) {
        const root = document.getElementById('micro-dictation');
        const audio = root?.querySelector('#micro-dictation-audio');
        const content = root?.querySelector('#micro-dictation-content');
        const durationSelect = root?.querySelector('#micro-dictation-duration');
        if (!root || !audio || !content || !durationSelect) return;
        window.stopMicroDictation?.();
        activeAudio = audio;

        let segments = [];
        let activeSegment = 0;
        let checked = false;

        const stopPlayback = () => {
            if (activeFrame !== null) cancelAnimationFrame(activeFrame);
            activeFrame = null;
            audio.pause();
        };
        window.stopMicroDictation = stopPlayback;

        const renderSegment = () => {
            stopPlayback();
            checked = false;
            const segment = segments[activeSegment];
            if (!segment) {
                content.innerHTML = '<p>Không có đoạn nghe khả dụng.</p>';
                return;
            }

            const targets = getTargetWords(segment.text);
            if (!targets.length) {
                content.innerHTML = `
                  <div class="micro-dictation__meta">Đoạn ${activeSegment + 1} / ${segments.length} · ${segment.start.toFixed(1)}–${segment.end.toFixed(1)} giây</div>
                  <p class="micro-dictation__transcript">${escapeHtml(segment.text)}</p>
                  <p class="micro-dictation__hint">Đoạn này chưa có từ mục tiêu phù hợp (số liệu, tên riêng hoặc từ dài). Chọn đoạn tiếp theo để luyện.</p>
                  <div class="micro-dictation__actions">
                    <button type="button" data-dictation-play>▶ Nghe đoạn</button>
                    <button type="button" data-dictation-next ${activeSegment >= segments.length - 1 ? 'disabled' : ''}>Đoạn tiếp theo →</button>
                  </div>`;
            } else {
                let targetIndex = 0;
                let wordIndex = 0;
                const transcriptHtml = segment.text.replace(/[\p{L}\p{N}]+(?:['’-][\p{L}\p{N}]+)*/gu, word => {
                    const target = targets[targetIndex];
                    if (!target || target.word !== word || target.index !== wordIndex) {
                        wordIndex++;
                        return escapeHtml(word);
                    }
                    const currentTarget = targetIndex++;
                    wordIndex++;
                    return `<input class="micro-dictation__blank" type="text" autocomplete="off" autocapitalize="off" spellcheck="false" aria-label="Dictation word ${currentTarget + 1}" data-dictation-answer="${currentTarget}">`;
                });
                content.innerHTML = `
                  <div class="micro-dictation__meta">Đoạn ${activeSegment + 1} / ${segments.length} · ${segment.start.toFixed(1)}–${segment.end.toFixed(1)} giây · ${targets.length} từ cần nghe</div>
                  <p class="micro-dictation__transcript">${transcriptHtml}</p>
                  <p class="micro-dictation__hint">Ô trống ưu tiên số liệu, tên riêng và từ dài. Hãy nghe trước khi kiểm tra.</p>
                  <div class="micro-dictation__actions">
                    <button type="button" data-dictation-play>▶ Nghe đoạn</button>
                    <button type="button" data-dictation-check>Kiểm tra</button>
                    <button type="button" data-dictation-next ${activeSegment >= segments.length - 1 ? 'disabled' : ''}>Đoạn tiếp theo →</button>
                  </div>
                  <p class="micro-dictation__status" role="status" aria-live="polite"></p>`;
            }

            content.querySelector('[data-dictation-play]')?.addEventListener('click', async () => {
                stopPlayback();
                audio.currentTime = segment.start;
                try {
                    await audio.play();
                } catch (error) {
                    console.error('Unable to play the micro-dictation segment:', error);
                    const status = content.querySelector('.micro-dictation__status') || content.querySelector('.micro-dictation__hint');
                    if (status) status.textContent = 'Không phát được audio. Kiểm tra liên kết hoặc thử lại.';
                    return;
                }
                const stopAtSegmentEnd = () => {
                    if (audio.currentTime >= segment.end || audio.ended) {
                        stopPlayback();
                        return;
                    }
                    activeFrame = requestAnimationFrame(stopAtSegmentEnd);
                };
                activeFrame = requestAnimationFrame(stopAtSegmentEnd);
            });

            content.querySelector('[data-dictation-check]')?.addEventListener('click', () => {
                if (checked) return;
                checked = true;
                let correct = 0;
                const blanks = [...content.querySelectorAll('[data-dictation-answer]')];
                blanks.forEach((input, index) => {
                    const expected = normalizeAnswer(targets[index].word);
                    const isCorrect = normalizeAnswer(input.value) === expected;
                    if (isCorrect) correct++;
                    input.disabled = true;
                    input.classList.add(isCorrect ? 'is-correct' : 'is-incorrect');
                    if (!isCorrect) input.title = `Đáp án: ${targets[index].word}`;
                });
                const status = content.querySelector('.micro-dictation__status');
                if (status) {
                    status.textContent = `Đúng ${correct}/${blanks.length}. ${blanks.map((input, index) =>
                        `${index + 1}. ${targets[index].word}`).join(' · ')}`;
                }
            });

            content.querySelector('[data-dictation-next]')?.addEventListener('click', () => {
                if (activeSegment >= segments.length - 1) return;
                activeSegment++;
                renderSegment();
            });
        };

        const buildSegments = () => {
            const duration = Number(durationSelect.value);
            segments = buildMicroDictationSegments(part, audio.duration, duration);
            activeSegment = 0;
            if (!segments.length) {
                content.innerHTML = '<p>Không đủ thông tin thời lượng hoặc transcript để chia đoạn nghe.</p>';
                return;
            }
            renderSegment();
        };

        audio.addEventListener('loadedmetadata', buildSegments, { once: true });
        audio.addEventListener('error', () => {
            content.innerHTML = '<p>Không thể tải audio cho Micro-Dictation. Kiểm tra liên kết audio của bài nghe.</p>';
        }, { once: true });
        durationSelect.addEventListener('change', () => {
            if (Number.isFinite(audio.duration) && audio.duration > 0) buildSegments();
        });
        if (audio.readyState >= 1 && Number.isFinite(audio.duration)) buildSegments();
    };
})();
