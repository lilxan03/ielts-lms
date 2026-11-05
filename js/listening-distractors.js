(function() {
    const stopWords = new Set([
        'a', 'an', 'and', 'are', 'as', 'at', 'be', 'been', 'being', 'but', 'by',
        'for', 'from', 'had', 'has', 'have', 'he', 'her', 'hers', 'him', 'his',
        'i', 'in', 'into', 'is', 'it', 'its', 'of', 'on', 'or', 'our', 'ours',
        'she', 'that', 'the', 'their', 'theirs', 'them', 'they', 'this', 'those',
        'to', 'was', 'we', 'were', 'which', 'who', 'will', 'with', 'you', 'your'
    ]);
    const signposts = [
        'on the other hand', 'in contrast', 'as a result', 'in fact',
        'for example', 'for instance', 'the main reason', 'the real reason',
        'the problem was', 'the point is', 'not only', 'on the contrary',
        'at first', 'initially', 'originally', 'however', 'although',
        'instead', 'rather', 'actually', 'finally', 'eventually',
        'but', 'yet', 'though', 'because', 'so', 'except'
    ];

    function tokenize(text) {
        return [...String(text || '').matchAll(/[\p{L}\p{N}]+(?:['’-][\p{L}\p{N}]+)*/gu)]
            .map(match => ({
                text: match[0],
                normalized: match[0].normalize('NFKC').toLocaleLowerCase().replace(/[’‘]/g, "'"),
                start: match.index,
                end: match.index + match[0].length
            }));
    }

    function cleanOption(option) {
        return String(option || '').replace(/^\s*(?:[A-Z]|\d+)[.)]\s*/i, '').trim();
    }

    function getOptionPhrases(option) {
        const words = tokenize(cleanOption(option));
        const phrases = new Set();
        for (let length = Math.min(5, words.length); length >= 2; length--) {
            for (let start = 0; start + length <= words.length; start++) {
                const phraseWords = words.slice(start, start + length);
                if (phraseWords.some(word => !stopWords.has(word.normalized))) {
                    phrases.add(phraseWords.map(word => word.normalized).join(' '));
                }
            }
        }
        if (words.length === 1 && (words[0].normalized.length >= 5 || /\d/.test(words[0].normalized))) {
            phrases.add(words[0].normalized);
        }
        return [...phrases];
    }

    function getCorrectOptions(question, id) {
        const answers = String(question.correctAnswers?.[id] || '')
            .split(/[/|]/)
            .flatMap(value => {
                const normalized = tokenize(value).map(word => word.normalized).join(' ');
                return [value.trim().toLocaleLowerCase(), normalized];
            });
        return (question.options || []).map((option, index) => {
            const rawText = String(option || '').trim();
            const text = cleanOption(rawText);
            const normalized = tokenize(text).map(word => word.normalized).join(' ');
            const rawNormalized = tokenize(rawText).map(word => word.normalized).join(' ');
            const letter = String.fromCharCode(97 + index);
            return answers.includes(normalized) || answers.includes(rawNormalized) ||
                answers.includes(letter) || answers.includes(String(index + 1));
        });
    }

    function findPhraseMatches(transcriptTokens, phrase, kind, questionNumber) {
        const phraseTokens = phrase.split(' ');
        const matches = [];
        for (let start = 0; start + phraseTokens.length <= transcriptTokens.length; start++) {
            if (!phraseTokens.every((word, offset) => transcriptTokens[start + offset].normalized === word)) continue;
            matches.push({
                start: transcriptTokens[start].start,
                end: transcriptTokens[start + phraseTokens.length - 1].end,
                kind,
                questionNumber,
                tokenStart: start,
                tokenEnd: start + phraseTokens.length
            });
        }
        return matches;
    }

    window.getListeningDistractorMatches = function(transcript, questions) {
        const words = tokenize(transcript);
        const candidates = [];
        (Array.isArray(questions) ? questions : []).forEach((question, questionIndex) => {
            if (question?.type !== 'multiple_choice') return;
            (question.ids || []).forEach(id => {
                const correctOptions = getCorrectOptions(question, id);
                (question.options || []).forEach((option, optionIndex) => {
                    const kind = correctOptions[optionIndex] ? 'correct' : 'distractor';
                    getOptionPhrases(option).forEach(phrase => {
                        candidates.push(...findPhraseMatches(words, phrase, kind, questionIndex + 1));
                    });
                });
            });
        });

        signposts.forEach(phrase => {
            const phraseTokens = tokenize(phrase).map(word => word.normalized).join(' ');
            candidates.push(...findPhraseMatches(words, phraseTokens, 'signpost', null));
        });

        const priority = { correct: 3, signpost: 2, distractor: 1 };
        const accepted = [];
        candidates.sort((left, right) =>
            priority[right.kind] - priority[left.kind] ||
            (right.end - right.start) - (left.end - left.start) ||
            left.start - right.start
        ).forEach(candidate => {
            const overlaps = accepted.some(match =>
                candidate.tokenStart < match.tokenEnd && candidate.tokenEnd > match.tokenStart
            );
            if (!overlaps) accepted.push(candidate);
        });
        return accepted.sort((left, right) => left.start - right.start);
    };
})();
