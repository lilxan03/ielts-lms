    window.parseIeltsLatex = function(source) {
        const normalizeLatexInlineFormatting = value => {
            const readGroup = start => {
                let depth = 1;
                let index = start + 1;
                let content = '';
                while (index < value.length && depth > 0) {
                    const char = value[index];
                    if (char === '\\' && index + 1 < value.length) {
                        content += value.slice(index, index + 2);
                        index += 2;
                        continue;
                    }
                    if (char === '{') depth++;
                    else if (char === '}') {
                        depth--;
                        if (!depth) break;
                    }
                    content += char;
                    index++;
                }
                return depth === 0 ? { content, end: index + 1 } : null;
            };
            let output = '';
            for (let index = 0; index < value.length;) {
                if (value[index] !== '\\') {
                    output += value[index++];
                    continue;
                }
                const match = value.slice(index + 1).match(/^[A-Za-z]+/);
                if (!match) {
                    output += value.slice(index, index + 2);
                    index += 2;
                    continue;
                }
                const command = match[0];
                const commandEnd = index + command.length + 1;
                const supported = ['textbf', 'textit', 'emph', 'underline', 'textrm', 'textsf', 'textnormal', 'texttt'];
                if (!supported.includes(command)) {
                    output += value.slice(index, commandEnd);
                    index = commandEnd;
                    continue;
                }
                let groupStart = commandEnd;
                while (/\s/.test(value[groupStart] || '') && groupStart < value.length) groupStart++;
                const group = value[groupStart] === '{' ? readGroup(groupStart) : null;
                if (!group) {
                    output += value.slice(index, commandEnd);
                    index = commandEnd;
                    continue;
                }
                const content = normalizeLatexInlineFormatting(group.content);
                if (command === 'textbf') output += `**${content}**`;
                else if (command === 'textit' || command === 'emph') output += `*${content}*`;
                else if (command === 'underline') output += `__${content}__`;
                else output += content;
                index = group.end;
            }
            return output;
        };
        const normalizeTabularEnvironments = source => {
            const startPattern = /\\begin\s*\{tabular\}\s*\{((?:[^{}]|\{[^{}]*\})*)\}/g;
            let normalized = '';
            let sourceOffset = 0;
            let environment;

            const convertRows = body => {
                const rows = [];
                let cells = [];
                let cell = '';
                let braceDepth = 0;
                let bracketDepth = 0;

                const finishCell = () => {
                    cells.push(cell.trim());
                    cell = '';
                };
                const finishRow = () => {
                    finishCell();
                    if (cells.some(value => value)) rows.push(cells);
                    cells = [];
                };

                for (let index = 0; index < body.length; index++) {
                    const char = body[index];
                    if (char === '\\') {
                        if (body[index + 1] === '\\' && braceDepth === 0 && bracketDepth === 0) {
                            finishRow();
                            index++;
                            continue;
                        }
                        const command = body.slice(index + 1).match(/^[A-Za-z]+/)?.[0];
                        if (command) {
                            if (braceDepth === 0 && bracketDepth === 0 && /^(?:hline|toprule|midrule|bottomrule)$/.test(command)) {
                                index += command.length;
                                continue;
                            }
                            if (braceDepth === 0 && bracketDepth === 0 && command === 'cline') {
                                let argumentStart = index + command.length + 1;
                                while (/\s/.test(body[argumentStart] || '') && argumentStart < body.length) argumentStart++;
                                if (body[argumentStart] === '{') {
                                    let depth = 1;
                                    let argumentEnd = argumentStart + 1;
                                    while (argumentEnd < body.length && depth > 0) {
                                        if (body[argumentEnd] === '{') depth++;
                                        else if (body[argumentEnd] === '}') depth--;
                                        argumentEnd++;
                                    }
                                    if (depth === 0) {
                                        index = argumentEnd - 1;
                                        continue;
                                    }
                                }
                                index += command.length;
                                continue;
                            }
                            cell += body.slice(index, index + command.length + 1);
                            index += command.length;
                            continue;
                        }
                        if (index + 1 < body.length) {
                            cell += body.slice(index, index + 2);
                            index++;
                            continue;
                        }
                    }

                    if (char === '&' && braceDepth === 0 && bracketDepth === 0) {
                        finishCell();
                        continue;
                    }
                    if (char === '{') braceDepth++;
                    else if (char === '}') braceDepth = Math.max(0, braceDepth - 1);
                    else if (char === '[') bracketDepth++;
                    else if (char === ']') bracketDepth = Math.max(0, bracketDepth - 1);
                    cell += char;
                }
                finishRow();

                const columnCount = Math.max(0, ...rows.map(row => row.length));
                if (!columnCount) return '';
                const formatRow = row => `| ${Array.from({ length: columnCount }, (_, index) => normalizeLatexInlineFormatting(row[index] || '')).join(' | ')} |`;
                return `\n${formatRow(rows[0])}\n| ${Array(columnCount).fill('---').join(' | ')} |${rows.length > 1 ? `\n${rows.slice(1).map(formatRow).join('\n')}` : ''}\n`;
            };

            while ((environment = startPattern.exec(source))) {
                const endMarker = /\\end\s*\{tabular\}/g;
                endMarker.lastIndex = startPattern.lastIndex;
                const end = endMarker.exec(source);
                if (!end) break;
                normalized += source.slice(sourceOffset, environment.index);
                normalized += convertRows(source.slice(startPattern.lastIndex, end.index));
                sourceOffset = endMarker.lastIndex;
                startPattern.lastIndex = sourceOffset;
            }
            return normalized + source.slice(sourceOffset);
        };
        const input = normalizeTabularEnvironments(normalizeLatexInlineFormatting(String(source || '')));
        let cursor = 0;

        const fail = (message, at = cursor) => {
            const line = input.slice(0, at).split('\n').length;
            throw new Error(`${message} (line ${line})`);
        };
        const skipWhitespace = () => {
            while (/\s/.test(input[cursor] || '') && cursor < input.length) cursor++;
        };
        const readGroup = (open, close, parseContents) => {
            skipWhitespace();
            if (input[cursor] !== open) fail(`Expected "${open}"`);
            cursor++;
            if (!parseContents) {
                let value = '';
                while (cursor < input.length) {
                    const char = input[cursor++];
                    if (char === '\\' && cursor < input.length) {
                        value += input[cursor++];
                    } else if (char === close) {
                        return value;
                    } else {
                        value += char;
                    }
                }
                fail(`Unclosed "${open}" group`);
            }

            const nodes = parseSequence(true);
            if (input[cursor] !== close) fail(`Unclosed "${open}" group`);
            cursor++;
            return nodes;
        };
        const readOptionalBracket = () => input[cursor] === '[' ? readGroup('[', ']', false) : null;
        const readRequiredNodes = () => readGroup('{', '}', true);
        const readRequiredText = (label) => {
            const nodes = readRequiredNodes();
            if (nodes.some(node => node.type !== 'text')) fail(`${label} must contain plain text`);
            return nodes.map(node => node.value).join('').trim();
        };
        const readMacroList = (macro, argumentCount) => {
            const nodes = readRequiredNodes();
            const entries = nodes.filter(node => node.type === macro);
            if (nodes.some(node => node.type !== 'text' && node.type !== macro)) {
                fail(`Only \\${macro} macros are allowed in this list`);
            }
            const values = entry => entry.values || (entry.value !== undefined ? [entry.value] : []);
            if (entries.some(entry => values(entry).length !== argumentCount || values(entry).some(value => !value))) {
                fail(`Each \\${macro} must have ${argumentCount} non-empty argument${argumentCount === 1 ? '' : 's'}`);
            }
            return entries.map(entry => ({ ...entry, values: values(entry) }));
        };
        const resolveMatchingOption = (answer, options) => {
            const normalizedAnswer = answer.trim().toLowerCase();
            const exact = options.find(option => option.trim().toLowerCase() === normalizedAnswer);
            if (exact) return exact;
            const labelPattern = /^([ivxlcdm]+|[a-z]|\d+)(?:\s*[.):\-]\s*|\s+)(.+)$/i;
            const matchingLabel = options.find(option => {
                const match = option.trim().match(labelPattern);
                return match && match[1].toLowerCase() === normalizedAnswer;
            });
            if (matchingLabel) return matchingLabel;
            const matchingText = options.find(option => {
                const optionText = option.trim().replace(labelPattern, '$2').toLowerCase();
                return optionText === normalizedAnswer;
            });
            return matchingText || null;
        };
        const parseGapOptions = (raw) => {
            const result = { alternatives: [], time: null };
            if (raw === null || raw.trim() === '') return result;
            const fields = raw.split(';').map(field => field.trim()).filter(Boolean);
            if (fields.some(field => /^(?:time|alt)=/i.test(field))) {
                fields.forEach(field => {
                    const timeMatch = field.match(/^time=(.+)$/i);
                    const altMatch = field.match(/^alt=(.+)$/i);
                    if (timeMatch) {
                        const parts = timeMatch[1].trim().split(':').map(Number);
                        if (!/^\d+(?::\d{1,2}){1,2}$/.test(timeMatch[1].trim()) || parts.some(part => !Number.isFinite(part))) {
                            fail(`Invalid gap timestamp "${timeMatch[1]}"`);
                        }
                        if (parts.length === 2 && parts[1] > 59 || parts.length === 3 && (parts[1] > 59 || parts[2] > 59)) {
                            fail(`Invalid gap timestamp "${timeMatch[1]}"`);
                        }
                        result.time = parts.length === 3 ? parts[0] * 3600 + parts[1] * 60 + parts[2] : parts[0] * 60 + parts[1];
                    } else if (altMatch) {
                        result.alternatives.push(...altMatch[1].split('|').map(value => value.trim()).filter(Boolean));
                    } else {
                        fail(`Unknown gap option "${field}"`);
                    }
                });
            } else {
                result.alternatives = raw.split('|').map(value => value.trim()).filter(Boolean);
            }
            return result;
        };
        const parseQuestionNumbers = (text, count) => {
            const source = String(text || '');
            const range = source.match(/\bquestions?\s*(\d+)\s*(?:-|–|—|to)\s*(\d+)\b/i);
            if (range) {
                const first = Number(range[1]);
                const last = Number(range[2]);
                const numbers = Array.from({ length: last - first + 1 }, (_, index) => first + index);
                return numbers.length === count ? numbers : null;
            }
            const list = source.match(/\bquestions?\s+(\d+(?:\s*(?:,|and|&)\s*\d+)+)\b/i);
            if (list) {
                const numbers = list[1].match(/\d+/g).map(Number);
                return numbers.length === count ? numbers : null;
            }
            const prefix = source.match(/^\s*(?:questions?\s*)?(\d+(?:\s*(?:-|–|—|to|,|and|&)\s*\d+)*)\s*[:.)-]\s*/i);
            if (prefix) {
                const numbers = prefix[1].match(/\d+/g).map(Number);
                if (numbers.length === count) return numbers;
            }
            const single = source.match(/\bquestions?\s*(\d+)\b/i);
            return single && count === 1 ? [Number(single[1])] : null;
        };
        const parseItemQuestionNumbers = items => {
            const numbers = items.map(item => item.text.match(/^\s*(?:question\s*)?(\d{1,3})[.)]\s*/i));
            return numbers.every(Boolean) ? numbers.map(match => Number(match[1])) : null;
        };
        const stripQuestionNumberPrefix = (text, numbers) => {
            if (!Array.isArray(numbers) || !numbers.length) return text;
            return String(text).replace(
                /^\s*(?:questions?\s*)?(\d+(?:\s*(?:-|–|—|to|,|and|&)\s*\d+)*)\s*[:.)-]\s*/i,
                (prefix, numberText) => {
                    const values = numberText.match(/\d+/g).map(Number);
                    return values.length === numbers.length && values.every((number, index) => number === numbers[index])
                        ? ''
                        : prefix;
                }
            ).trim();
        };
        const stripItemNumberPrefix = (text, number) =>
            String(text).replace(new RegExp(`^\\s*(?:question\\s*)?${number}[:.)-]\\s*`, 'i'), '');
        const parseSequence = (stopAtClose = false) => {
            const nodes = [];
            let text = '';
            const flushText = () => {
                if (text) nodes.push({ type: 'text', value: text });
                text = '';
            };

            while (cursor < input.length) {
                const char = input[cursor];
                if (char === '}') {
                    if (!stopAtClose) fail(`Unexpected "${char}"`);
                    break;
                }
                if (char !== '\\') {
                    text += char;
                    cursor++;
                    continue;
                }

                const slashAt = cursor++;
                if (cursor >= input.length) fail('Unexpected end after backslash', slashAt);
                if ('\\{}[]%'.includes(input[cursor])) {
                    text += input[cursor++];
                    continue;
                }
                const commandMatch = input.slice(cursor).match(/^[A-Za-z]+/);
                if (!commandMatch) fail('Expected a macro name after backslash', slashAt);
                const command = commandMatch[0];
                cursor += command.length;
                flushText();

                if (command === 'gap') {
                    const options = parseGapOptions(readOptionalBracket());
                    const answer = readRequiredText('Gap answer');
                    if (!answer) fail('Gap answer cannot be empty', slashAt);
                    nodes.push({ type: 'gap', answer, alternatives: options.alternatives, time: options.time });
                } else if (command === 'drop') {
                    const options = parseGapOptions(readOptionalBracket());
                    const answer = readRequiredText('Drag/drop answer');
                    if (!answer) fail('Drag/drop answer cannot be empty', slashAt);
                    nodes.push({ type: 'drop', answer, alternatives: options.alternatives, time: options.time });
                } else if (command === 'choice' || command === 'correct') {
                    nodes.push({ type: command, value: readRequiredText('Choice') });
                } else if (command === 'option') {
                    nodes.push({ type: 'option', value: readRequiredText('Option') });
                } else if (command === 'item') {
                    nodes.push({ type: 'item', values: [readRequiredText('Item text'), readRequiredText('Item answer')] });
                } else if (command === 'ending') {
                    nodes.push({ type: 'ending', values: [readRequiredText('Ending label'), readRequiredText('Sentence ending')] });
                } else if (command === 'hotspot') {
                    nodes.push({ type: 'hotspot', values: [
                        readRequiredText('Hotspot x position'),
                        readRequiredText('Hotspot y position'),
                        readRequiredText('Hotspot answer')
                    ] });
                } else if (command === 'question') {
                    nodes.push({ type: 'question', value: readRequiredText('Speaking follow-up question') });
                } else if (command === 'mcq') {
                    const selectionOption = readOptionalBracket() || '';
                    const selectionMatch = selectionOption.match(/^select\s*=\s*(\d+)$/i);
                    if (selectionOption && !selectionMatch) fail('\\mcq option must be [select=2] or another positive answer count', slashAt);
                    const selectCount = selectionMatch ? Number(selectionMatch[1]) : 1;
                    if (!Number.isSafeInteger(selectCount) || selectCount < 1) fail('Multiple-choice selection count must be a positive integer', slashAt);
                    const question = readRequiredText('Multiple-choice question');
                    if (!question) fail('Multiple-choice question text cannot be empty', slashAt);
                    const optionNodes = readRequiredNodes();
                    const options = optionNodes.filter(node => node.type === 'choice' || node.type === 'correct');
                    if (optionNodes.some(node => node.type !== 'text' && node.type !== 'choice' && node.type !== 'correct')) {
                        fail('Only \\choice and \\correct are allowed inside \\mcq options', slashAt);
                    }
                    if (options.length < 2) fail('A multiple-choice question needs at least two options', slashAt);
                    if (options.some(option => !option.value.trim())) fail('Multiple-choice options cannot be empty', slashAt);
                    if (options.filter(option => option.type === 'correct').length !== selectCount) {
                        fail(`This multiple-choice question needs exactly ${selectCount} \\correct option${selectCount === 1 ? '' : 's'}`, slashAt);
                    }
                    const questionNumbers = parseQuestionNumbers(question, selectCount);
                    nodes.push({
                        type: 'mcq',
                        question: stripQuestionNumberPrefix(question, questionNumbers),
                        selectCount,
                        questionNumbers,
                        options: options.map(option => ({ text: option.value, correct: option.type === 'correct' }))
                    });
                } else if (command === 'shortanswer') {
                    const answerOptions = parseGapOptions(readOptionalBracket());
                    const statement = readRequiredText('Short-answer question');
                    const answer = readRequiredText('Short-answer key');
                    if (!statement || !answer) fail('Short-answer question and key cannot be empty', slashAt);
                    const questionNumbers = parseQuestionNumbers(statement, 1);
                    nodes.push({
                        type: 'fill_blanks',
                        shortAnswer: true,
                        text: `${stripQuestionNumberPrefix(statement, questionNumbers)} {blank:1}`,
                        questionNumbers,
                        gaps: [{ id: 1, answer, alternatives: answerOptions.alternatives, time: answerOptions.time }]
                    });
                } else if (command === 'matchingheadings' || command === 'matchinginfo' || command === 'matchingstatements') {
                    const instruction = readRequiredText('Matching instruction');
                    const items = readMacroList('item', 2);
                    const options = readMacroList('option', 1);
                    if (!items.length || !options.length) fail('Matching questions need at least one item and one option', slashAt);
                    const optionValues = options.map(option => option.values[0]);
                    const resolvedAnswers = items.map(item => resolveMatchingOption(item.values[1], optionValues));
                    if (resolvedAnswers.some(answer => !answer)) {
                        const hint = command === 'matchinginfo' && /sentence.{0,30}ending|ending.{0,30}sentence/i.test(instruction)
                            ? '; for sentence endings, use \\matchingendings with \\ending{label}{ending text}'
                            : '';
                        fail(`Every matching answer must match one of the listed options${hint}`, slashAt);
                    }
                    const questionNumbers = parseItemQuestionNumbers(items.map(item => ({ text: item.values[0] }))) || parseQuestionNumbers(instruction, items.length);
                    const isMatchingStatements = command === 'matchingstatements' ||
                        command === 'matchinginfo' && /\bstatements?\b/i.test(instruction);
                    nodes.push({
                        type: command === 'matchingheadings' ? 'matching_headings' : isMatchingStatements ? 'matching_statements' : 'matching_info',
                        instruction: stripQuestionNumberPrefix(instruction, questionNumbers),
                        items: items.map((item, index) => ({
                            text: questionNumbers ? stripItemNumberPrefix(item.values[0], questionNumbers[index]) : item.values[0],
                            answer: resolvedAnswers[index]
                        })),
                        questionNumbers,
                        options: optionValues
                    });
                } else if (command === 'matchingendings') {
                    const instruction = readRequiredText('Sentence-ending instruction');
                    const items = readMacroList('item', 2);
                    const endings = readMacroList('ending', 2);
                    if (!items.length || endings.length < items.length) {
                        fail('Matching sentence endings need at least one sentence and an ending for every answer', slashAt);
                    }
                    const endingByKey = new Map();
                    endings.forEach(ending => {
                        const key = ending.values[0].trim().toLowerCase();
                        if (endingByKey.has(key)) fail(`Duplicate sentence-ending option "${ending.values[0]}"`, slashAt);
                        endingByKey.set(key, ending.values[1]);
                    });
                    if (items.some(item => !endingByKey.has(item.values[1].trim().toLowerCase()))) {
                        fail('Every sentence-ending answer must match one of the listed ending labels', slashAt);
                    }
                    const questionNumbers = parseItemQuestionNumbers(items.map(item => ({ text: item.values[0] }))) || parseQuestionNumbers(instruction, items.length);
                    nodes.push({
                        type: 'matching_endings',
                        instruction: stripQuestionNumberPrefix(instruction, questionNumbers),
                        items: items.map((item, index) => ({
                            text: questionNumbers ? stripItemNumberPrefix(item.values[0], questionNumbers[index]) : item.values[0],
                            answer: item.values[1]
                        })),
                        questionNumbers,
                        options: endings.map(ending => `${ending.values[0]}. ${ending.values[1]}`)
                    });
                } else if (command === 'mapgrid') {
                    const imageOptions = readOptionalBracket() || '';
                    const image = imageOptions.match(/(?:^|;)\s*image=(.+?)(?:;|$)/i)?.[1]?.trim() || '';
                    if (!/^https?:\/\//i.test(image)) fail('\\mapgrid requires [image=https://...]', slashAt);
                    const instruction = readRequiredText('Map-grid instruction');
                    const items = readMacroList('item', 2);
                    const options = readMacroList('option', 1);
                    if (!items.length || !options.length) fail('Map-grid questions need at least one location and one map option', slashAt);
                    const allowedOptions = new Set(options.map(option => option.values[0].trim().toLowerCase()));
                    if (items.some(item => !allowedOptions.has(item.values[1].trim().toLowerCase()))) {
                        fail('Every map-grid answer must match one of the listed options', slashAt);
                    }
                    const questionNumbers = parseItemQuestionNumbers(items.map(item => ({ text: item.values[0] }))) || parseQuestionNumbers(instruction, items.length);
                    nodes.push({
                        type: 'map_labelling_grid',
                        image,
                        instruction: stripQuestionNumberPrefix(instruction, questionNumbers),
                        items: items.map((item, index) => ({
                            text: questionNumbers ? stripItemNumberPrefix(item.values[0], questionNumbers[index]) : item.values[0],
                            answer: item.values[1]
                        })),
                        questionNumbers,
                        options: options.map(option => option.values[0])
                    });
                } else if (command === 'maphotspots') {
                    const imageOptions = readOptionalBracket() || '';
                    const image = imageOptions.match(/(?:^|;)\s*image=(.+?)(?:;|$)/i)?.[1]?.trim() || '';
                    if (!/^https?:\/\//i.test(image)) fail('\\maphotspots requires [image=https://...]', slashAt);
                    const instruction = readRequiredText('Map-hotspot instruction');
                    const hotspots = readMacroList('hotspot', 3).map(hotspot => {
                        const x = Number(hotspot.values[0]);
                        const y = Number(hotspot.values[1]);
                        if (!Number.isFinite(x) || !Number.isFinite(y) || x < 0 || x > 100 || y < 0 || y > 100) {
                            fail('Hotspot coordinates must be percentages between 0 and 100', slashAt);
                        }
                        return { x, y, answer: hotspot.values[2] };
                    });
                    const options = readMacroList('option', 1).map(option => option.values[0]);
                    if (!hotspots.length || !options.length) fail('Map-hotspot questions need at least one hotspot and one option', slashAt);
                    const allowedOptions = new Set(options.map(option => option.trim().toLowerCase()));
                    if (hotspots.some(hotspot => !allowedOptions.has(hotspot.answer.trim().toLowerCase()))) {
                        fail('Every hotspot answer must match one of the listed options', slashAt);
                    }
                    const questionNumbers = parseQuestionNumbers(instruction, hotspots.length);
                    nodes.push({
                        type: 'map_labelling_hotspots',
                        image,
                        instruction: stripQuestionNumberPrefix(instruction, questionNumbers),
                        questionNumbers,
                        hotspots,
                        options
                    });
                } else if (command === 'writingtask') {
                    const taskOption = readOptionalBracket() || '';
                    const taskMatch = taskOption.match(/^task\s*=\s*([12])$/i);
                    if (!taskMatch) fail('\\writingtask requires [task=1] or [task=2]', slashAt);
                    const title = readRequiredText('Writing task title');
                    const prompt = readRequiredText('Writing task prompt');
                    if (!title || !prompt) fail('Writing task title and prompt cannot be empty', slashAt);
                    nodes.push({ type: 'writingtask', task: `task${taskMatch[1]}`, title, prompt });
                } else if (command === 'speaking') {
                    const title = readRequiredText('Speaking topic');
                    const cueCard = readRequiredText('Speaking cue card');
                    const followUps = readMacroList('question', 1).map(question => question.value);
                    if (!title || !cueCard) fail('Speaking topic and cue card cannot be empty', slashAt);
                    nodes.push({ type: 'speaking', title, cueCard, followUps });
                } else if (command === 'notes') {
                    const text = readRequiredText('Notes text');
                    if (!text) fail('Notes text cannot be empty', slashAt);
                    nodes.push({ type: 'notes', text });
                } else if (command === 'audio') {
                    const url = readRequiredText('Audio URL');
                    if (!/^https?:\/\//i.test(url)) fail('\\audio URL must begin with http:// or https://', slashAt);
                    nodes.push({ type: 'audio', url });
                } else if (command === 'tfng') {
                    const statement = readRequiredText('TFNG statement');
                    const answer = readRequiredText('TFNG answer').toUpperCase().replace(/\s+/g, ' ');
                    const explanation = readOptionalBracket();
                    if (!statement) fail('TFNG statement cannot be empty', slashAt);
                    if (!['TRUE', 'FALSE', 'NOT GIVEN', 'YES', 'NO'].includes(answer)) {
                        fail('TFNG answer must be TRUE, FALSE, NOT GIVEN, YES, or NO', slashAt);
                    }
                    const questionNumbers = parseQuestionNumbers(statement, 1);
                    nodes.push({
                        type: 'tfng',
                        statement: stripQuestionNumberPrefix(statement, questionNumbers),
                        answer,
                        questionNumbers,
                        explanation: explanation ? explanation.trim() : ''
                    });
                } else if (command === 'passage') {
                    const title = readRequiredText('Passage title');
                    const content = readRequiredNodes();
                    if (content.some(node => !['text', 'gap', 'drop'].includes(node.type))) {
                        fail('A passage may contain text and gaps, but not nested questions or passages', slashAt);
                    }
                    nodes.push({ type: 'passage', title, content });
                } else {
                    fail(`Unknown macro "\\${command}"`, slashAt);
                }
            }
            flushText();
            return nodes;
        };

        const nodes = parseSequence();
        let passageTitle = '';
        let audioUrl = '';
        let writingTask = '';
        let speakingQuestions = '';
        let hasSpeaking = false;
        const passageNodes = [];
        const questionOrder = [];
        let passageOrderAdded = false;
        const addPassageOrder = () => {
            if (!passageOrderAdded) {
                questionOrder.push({ type: 'passage_questions' });
                passageOrderAdded = true;
            }
        };
        let passageCount = 0;
        nodes.forEach(node => {
            if (node.type === 'text' || node.type === 'gap' || node.type === 'drop') {
                addPassageOrder();
                passageNodes.push(node);
            } else if (node.type === 'passage') {
                passageCount++;
                if (passageCount > 1) fail('Only one \\passage is allowed per imported part', 0);
                addPassageOrder();
                passageTitle = node.title;
                passageNodes.push(...node.content);
            } else if (node.type === 'audio') {
                if (audioUrl) fail('Only one \\audio source is allowed', 0);
                audioUrl = node.url;
            } else if (node.type === 'writingtask') {
                if (writingTask) fail('Only one \\writingtask is allowed per import', 0);
                writingTask = node.task;
                passageTitle = node.title;
                const question = { type: 'essay', instruction: node.prompt, task: node.task };
                questionOrder.push(question);
            } else if (node.type === 'speaking') {
                if (hasSpeaking) fail('Only one \\speaking macro is allowed per import', 0);
                hasSpeaking = true;
                passageTitle = node.title;
                speakingQuestions = node.followUps.join('\n');
                const question = { type: 'audio_record', instruction: node.cueCard };
                questionOrder.push(question);
            } else if (node.type === 'notes') {
                const question = { type: 'essay', instruction: node.text, text: '' };
                questionOrder.push(question);
            } else if (['mcq', 'tfng', 'matching_headings', 'matching_info', 'matching_statements', 'matching_endings', 'map_labelling_grid', 'map_labelling_hotspots', 'fill_blanks'].includes(node.type)) {
                questionOrder.push(node);
            } else {
                fail(`\\${node.type} must be inside an appropriate question macro`, 0);
            }
        });

        const gaps = [];
        const gapModes = new Set();
        let nextPreviewId = 1;
        let passageHtmlSource = passageNodes.map(node => {
            if (node.type === 'text') return node.value;
            const gap = { ...node, id: nextPreviewId++ };
            gaps.push(gap);
            gapModes.add(node.type);
            return `{${node.type === 'drop' ? 'drop' : 'blank'}:${gap.id}}`;
        }).join('');
        if (gapModes.size > 1) fail('Do not mix \\gap and \\drop in the same passage import', 0);
        let gapQuestion = null;
        if (gaps.length) {
            const firstGapIndex = passageHtmlSource.search(/\{(?:blank|drop):/);
            const gapPrefix = passageHtmlSource.slice(0, firstGapIndex);
            let gapOptions = [];
            let gapPrefixWithoutOptions = gapPrefix;
            if (gapModes.has('drop')) {
                const prefixLines = gapPrefix.split('\n');
                const optionsHeaderIndex = prefixLines.findIndex(line => /^\s*options?\s*:\s*$/i.test(line));
                if (optionsHeaderIndex >= 0) {
                    const optionEntries = [];
                    let optionEndIndex = optionsHeaderIndex + 1;
                    while (optionEndIndex < prefixLines.length) {
                        const line = prefixLines[optionEndIndex];
                        if (!line.trim()) {
                            optionEndIndex++;
                            continue;
                        }
                        if (!/^\s*[A-Z]\s*(?:[.)\-]\s*|\s+)\S/i.test(line)) break;
                        optionEntries.push(line.trim());
                        optionEndIndex++;
                    }
                    if (optionEntries.length) {
                        gapOptions = optionEntries;
                        prefixLines.splice(optionsHeaderIndex, optionEndIndex - optionsHeaderIndex);
                        gapPrefixWithoutOptions = prefixLines.join('\n');
                    }
                }
            }
            const questionNumbers = parseQuestionNumbers(gapPrefixWithoutOptions, gaps.length) || parseQuestionNumbers(gapPrefix, gaps.length);
            const instructionPattern = /^\s*(?:(?:questions?\s+\d+(?:\s*(?:-|–|—|to|,|and|&)\s*\d+)*)\s*[:.)-]\s*)?(?:complete|fill|choose|write|use|answer|select|label|match|circle|tick|mark|enter|record|put)\b/i;
            const prefixLines = gapPrefixWithoutOptions.split('\n');
            const instructionLines = [];
            let firstContentLine = 0;
            while (firstContentLine < prefixLines.length) {
                const line = prefixLines[firstContentLine];
                if (!line.trim()) {
                    firstContentLine++;
                    continue;
                }
                if (!instructionPattern.test(line)) break;
                instructionLines.push(line.trim());
                firstContentLine++;
            }
            const instruction = instructionLines.join('\n');
            const passageText = instructionLines.length
                ? [...prefixLines.slice(firstContentLine), passageHtmlSource.slice(firstGapIndex)].join('\n')
                : gapPrefixWithoutOptions + passageHtmlSource.slice(firstGapIndex);
            passageHtmlSource = passageText;
            const titleInstruction = passageTitle.trim();
            const instructionFromTitle = !!(titleInstruction && instructionPattern.test(titleInstruction));
            const resolvedInstruction = instruction || (instructionFromTitle ? titleInstruction : '');
            const resolvedQuestionNumbers = questionNumbers || (instructionFromTitle
                ? parseQuestionNumbers(titleInstruction, gaps.length)
                : null);
            if (instructionFromTitle) passageTitle = '';
            gapQuestion = {
                type: gapModes.has('drop') ? 'dnd_list' : 'fill_blanks',
                text: passageText,
                instruction: resolvedInstruction,
                gaps,
                options: gapOptions,
                questionNumbers: resolvedQuestionNumbers,
                numberedInPassage: !!resolvedQuestionNumbers,
                instructionMovedFromTitle: instructionFromTitle
            };
        }
        const questions = questionOrder
            .map(question => question.type === 'passage_questions' ? gapQuestion : question)
            .filter(Boolean);
        const previewOrder = questionOrder.flatMap(question => question.type === 'passage_questions'
            ? [{ type: 'passage_preview' }, ...(gapQuestion ? [gapQuestion] : [])]
            : [question]);

        if (!passageNodes.some(node => node.type === 'text' && node.value.trim()) && !questions.length) {
            fail('Enter passage text or at least one question', 0);
        }
        return {
            passage: {
                title: passageTitle,
                instructionMovedFromTitle: !!gapQuestion?.instructionMovedFromTitle,
                text: passageHtmlSource,
                hasGaps: gaps.length > 0
            },
            audioUrl,
            writingTask,
            hasSpeaking,
            speakingQuestions,
            questions,
            previewOrder,
            gapCount: gaps.length
        };
    };

    window.getIeltsLatexTemplates = function() {
        return {
            reading: [
                ['Passage with gap-fill', String.raw`\passage{Passage title}{
Write the passage here. The answer is \gap[alt=alternative]{correct answer}.
}`],
                ['Sentence completion', String.raw`\passage{Reading Passage 1}{
Complete each sentence using words from the passage.
The research began in \gap{1998}.
}`],
                ['Summary / note completion', String.raw`\passage{Reading Passage 1}{
Complete the summary using words from the passage.
The main discovery was \gap{photosynthesis}.
}`],
                ['Table completion', String.raw`\passage{Reading Passage 1}{
Complete the table using information from the passage.
| Species | Habitat |
| --- | --- |
| Red fox | \gap{woodland} |
| Grey seal | \gap{coastal caves} |
}`],
                ['LaTeX tabular gap-fill table', String.raw`\passage{Reading Passage 1}{
Complete the table using information from the passage.
\begin{tabular}{|l|l|l|}
\hline
Part & Description & Uses \\
\hline
Trunk & Up to 30 metres & Used for \gap{timber} \\
Leaves & Up to 6 metres long & Used to make \gap{brushes} \\
\hline
\end{tabular}
}`],
                ['Short-answer questions', String.raw`\shortanswer{When was the research first published?}{1998}
\shortanswer[alt=the year 1998]{What year did the research begin?}{1998}`],
                ['Drag-and-drop completion with options', String.raw`\passage{Passage title}{
Options:
A first option
B second option
C unused option

Complete the sentence using one option.
The answer is \drop{B}.
}`],
                ['Multiple choice', String.raw`\mcq{Write the question here}{
  \choice{Incorrect option}
  \correct{Correct option}
  \choice{Another incorrect option}
}`],
                ['Multiple choice — choose two', String.raw`\mcq[select=2]{Which TWO statements are correct?}{
  \correct{First correct answer}
  \choice{Incorrect answer}
  \correct{Second correct answer}
  \choice{Another incorrect answer}
}`],
                ['True / False / Not Given', String.raw`\tfng{Write a statement based on the passage.}{TRUE}[Explain why this is the answer.]`],
                ['Yes / No / Not Given', String.raw`\tfng{Write a statement about the writer's views.}{YES}[Explain why this is the answer.]`],
                ['Matching headings', String.raw`\matchingheadings{Choose the correct heading for each paragraph.}{
  \item{Paragraph A}{Heading 1}
  \item{Paragraph B}{Heading 2}
}{
  \option{Heading 1}
  \option{Heading 2}
  \option{Unused heading}
}`],
                ['Matching information', String.raw`\matchinginfo{Match each statement to its source.}{
  \item{Write a statement to match.}{Source A}
  \item{Write another statement.}{Source B}
}{
  \option{Source A}
  \option{Source B}
}`],
                ['Matching statements (drag and drop)', String.raw`\matchingstatements{Match each statement with the correct option.}{
  \item{The trunk is used for}{timber}
  \item{Leaves can be used to make}{brushes}
}{
  \option{timber}
  \option{brushes}
  \option{rope}
}`],
                ['Matching sentence endings', String.raw`\matchingendings{Questions 31–34: Complete each sentence with the correct ending, A–F, below.}{
  \item{The researchers concluded that}{A}
  \item{The new approach works because}{B}
}{
  \ending{A}{the method was reliable.}
  \ending{B}{it reduces measurement error.}
  \ending{C}{it requires no training.}
}`],
                ['Matching features', String.raw`\matchinginfo{Match each statement with the researcher who expressed that view.}{
  \item{This approach should be used in schools.}{Professor Lee}
  \item{More evidence is needed before drawing a conclusion.}{Dr Patel}
}{
  \option{Professor Lee}
  \option{Dr Patel}
  \option{Both researchers}
}`],
                ['Map labelling (grid)', String.raw`\mapgrid[image=https://example.com/map.png]{Choose the correct location for each place.}{
  \item{Place name}{A}
}{
  \option{A}
  \option{B}
  \option{C}
}`],
                ['Map labelling (hotspots)', String.raw`\maphotspots[image=https://example.com/map.png]{Label each place on the map.}{
  \hotspot{25}{40}{Place name}
}{
  \option{Place name}
}`]
            ],
            listening: [
                ['Audio with timed gap-fill', String.raw`\audio{https://example.com/audio.mp3}
\passage{Listening Part 1}{
Write the listening transcript here. The answer is \gap[time=01:23;alt=alternative]{correct answer}.
}`],
                ['Form / note completion', String.raw`\audio{https://example.com/audio.mp3}
\passage{Listening Part 1 — Booking details}{
Complete the form. Write NO MORE THAN TWO WORDS AND/OR A NUMBER.
Name: \gap{Amira Khan}
Arrival date: \gap[time=01:23]{14 June}
}`],
                ['Table / summary completion', String.raw`\audio{https://example.com/audio.mp3}
\passage{Listening Part 3 — Research summary}{
Complete the summary using words from the recording.
The project studied \gap{urban wildlife} and began in \gap{2025}.
}`],
                ['Table completion', String.raw`\audio{https://example.com/audio.mp3}
\passage{Listening Part 2 — Course details}{
Complete the table with the information you hear.
| Course | Starting time |
| --- | --- |
| Photography | \gap{9:30 am} |
| Local history | \gap{2 pm} |
}`],
                ['Short-answer questions', String.raw`\audio{https://example.com/audio.mp3}
\shortanswer{What is the name of the booking website?}{City Breaks}
\shortanswer[time=02:15;alt=the west entrance]{Which entrance should visitors use?}{West entrance}`],
                ['Drag-and-drop completion with options', String.raw`\passage{Listening Part 1}{
Options:
A first option
B second option
C unused option

Complete the sentence using one option.
The speaker says \drop{B}.
}`],
                ['Multiple choice', String.raw`\mcq{Write the question here}{
  \choice{Incorrect option}
  \correct{Correct option}
  \choice{Another incorrect option}
}`],
                ['Multiple choice — choose two', String.raw`\mcq[select=2]{Which TWO features does the speaker mention?}{
  \correct{The service is available at weekends.}
  \choice{The service is free for everyone.}
  \correct{The service can be booked online.}
  \choice{The service operates all night.}
}`],
                ['Map labelling (grid)', String.raw`\mapgrid[image=https://example.com/map.png]{Choose the correct location for each place.}{
  \item{Place name}{A}
}{
  \option{A}
  \option{B}
  \option{C}
}`],
                ['Map labelling (hotspots)', String.raw`\maphotspots[image=https://example.com/map.png]{Label each place on the map.}{
  \hotspot{25}{40}{Place name}
}{
  \option{Place name}
}`]
            ],
            writing: [
                ['Writing Task 1 (Academic)', String.raw`\writingtask[task=1]{Writing Task 1}{Summarise the information by selecting and reporting the main features, and make comparisons where relevant.}`],
                ['Task 1 — line / bar / pie chart', String.raw`\writingtask[task=1]{Task 1 — Charts}{The chart shows changes in the percentage of people using four types of transport between 2000 and 2025. Summarise the information by selecting and reporting the main features, and make comparisons where relevant.}`],
                ['Task 1 — table', String.raw`\writingtask[task=1]{Task 1 — Table}{The table compares the average monthly household spending in three countries in 2024. Summarise the information by selecting and reporting the main features, and make comparisons where relevant.}`],
                ['Task 1 — process diagram', String.raw`\writingtask[task=1]{Task 1 — Process}{The diagram shows how drinking water is produced from seawater. Summarise the information by selecting and reporting the main features, and make comparisons where relevant.}`],
                ['Task 1 — maps', String.raw`\writingtask[task=1]{Task 1 — Maps}{The maps show the changes made to a town centre between 1990 and the present day. Summarise the information by selecting and reporting the main features, and make comparisons where relevant.}`],
                ['Writing Task 1 (General Training)', String.raw`\writingtask[task=1]{Writing Task 1}{Write a letter in response to the situation. Include all three bullet points: [point 1], [point 2], and [point 3].}`],
                ['General Training — formal letter', String.raw`\writingtask[task=1]{Task 1 — Formal letter}{You recently bought an item from a shop, but it was damaged. Write a letter to the manager. In your letter: describe the item and the damage; explain what happened; say what you would like the manager to do.}`],
                ['General Training — informal letter', String.raw`\writingtask[task=1]{Task 1 — Informal letter}{A friend is planning to visit your town. Write a letter to your friend. In your letter: recommend a time to visit; suggest places to see; invite your friend to stay with you.}`],
                ['Writing Task 2 essay', String.raw`\writingtask[task=2]{Writing Task 2}{Write about the following topic. Give reasons for your answer and include relevant examples from your knowledge or experience.}`],
                ['Task 2 — agree / disagree', String.raw`\writingtask[task=2]{Task 2 — Opinion essay}{Some people believe that public transport should be free in all cities. To what extent do you agree or disagree? Give reasons for your answer and include relevant examples from your knowledge or experience.}`],
                ['Task 2 — discuss both views', String.raw`\writingtask[task=2]{Task 2 — Discussion essay}{Some people think that university students should study whatever they like, while others believe they should only study subjects that will be useful in the future. Discuss both these views and give your own opinion.}`],
                ['Task 2 — advantages / disadvantages', String.raw`\writingtask[task=2]{Task 2 — Advantages and disadvantages}{More people are choosing to work remotely rather than in an office. Do the advantages of this development outweigh the disadvantages?}`],
                ['Task 2 — problem / solution', String.raw`\writingtask[task=2]{Task 2 — Problem and solution}{Many cities are experiencing increasing traffic congestion. What problems does this cause, and what measures could be taken to solve them?}`],
                ['Task 2 — direct questions', String.raw`\writingtask[task=2]{Task 2 — Two-part question}{People are spending less time with their neighbours than in the past. Why is this happening? How can communities encourage people to know each other better?}`]
            ],
            speaking: [
                ['Part 1 — familiar topic', String.raw`\speaking{Speaking Part 1 — Your home}{Answer questions about your home and where you live.}{
  \question{What do you like most about your home?}
  \question{How long have you lived there?}
  \question{Would you like to live somewhere else in the future?}
}`],
                ['Part 2 — cue card with follow-ups', String.raw`\speaking{Speaking Part 2 — A memorable experience}{Describe an experience you remember well. You should say:
- what happened
- where and when it happened
- who was with you
- and explain why you remember it.
}{
  \question{How do people usually celebrate this kind of experience?}
  \question{Do you think people's memories change over time?}
}`],
                ['Part 3 — discussion topic', String.raw`\speaking{Speaking Part 3 — Memories and society}{Discuss the role of memories in society.}{
  \question{Why do some events become part of a country's history?}
  \question{How has technology changed the way people preserve memories?}
  \question{Should historical events always be remembered?}
}`],
                ['Speaking notes prompt', String.raw`\notes{Make brief notes before you speak. Do not write a full script.}`]
            ]
        };
    };

    window.saveIeltsLatexSelection = function() {
        const editor = document.getElementById('ielts-latex-input');
        const selection = window.getSelection();
        if (selection && selection.rangeCount && editor.contains(selection.getRangeAt(0).commonAncestorContainer)) {
            window.ieltsLatexSavedRange = selection.getRangeAt(0).cloneRange();
        }
    };

    window.getIeltsLatexSource = function() {
        const editor = document.getElementById('ielts-latex-input');
        const serialize = node => {
            if (node.nodeType === Node.TEXT_NODE) return node.nodeValue || '';
            if (node.nodeType !== Node.ELEMENT_NODE) return '';
            const tag = node.tagName.toLowerCase();
            if (tag === 'br') return '\n';
            const children = Array.from(node.childNodes).map(serialize).join('');
            const styles = node.style || {};
            const bold = tag === 'b' || tag === 'strong' || styles.fontWeight === 'bold' || Number(styles.fontWeight) >= 600;
            const italic = tag === 'i' || tag === 'em' || styles.fontStyle === 'italic';
            const underline = tag === 'u' || styles.textDecoration.includes('underline');
            const formatted = `${bold && children ? `**${children}**` : children}`;
            const italicFormatted = `${italic && formatted ? `*${formatted}*` : formatted}`;
            const text = underline && italicFormatted ? `__${italicFormatted}__` : italicFormatted;
            if (tag === 'li') {
                const siblings = Array.from(node.parentElement.children).filter(item => item.tagName === 'LI');
                const prefix = node.parentElement.tagName === 'OL' ? `${siblings.indexOf(node) + 1}. ` : '- ';
                return `${prefix}${text.trim()}\n`;
            }
            if (tag === 'table') {
                const rows = Array.from(node.rows).map(row =>
                    `| ${Array.from(row.cells).map(cell => Array.from(cell.childNodes).map(serialize).join('').trim()).join(' | ')} |`
                );
                if (!rows.length) return '';
                const separator = `| ${Array.from(node.rows[0].cells).map(() => '---').join(' | ')} |`;
                return `\n${rows[0]}\n${separator}${rows.length > 1 ? `\n${rows.slice(1).join('\n')}` : ''}\n`;
            }
            if (tag === 'div' || tag === 'p') return `${text}\n`;
            return text;
        };
        return Array.from(editor.childNodes).map(serialize).join('')
            .replace(/\u00a0/g, ' ')
            .replace(/\n{3,}/g, '\n\n')
            .trim();
    };

    window.insertIeltsLatexTable = function() {
        const editor = document.getElementById('ielts-latex-input');
        const selection = window.getSelection();
        const savedRange = window.ieltsLatexSavedRange;
        let range = savedRange && editor.contains(savedRange.commonAncestorContainer)
            ? savedRange.cloneRange()
            : selection && selection.rangeCount && editor.contains(selection.getRangeAt(0).commonAncestorContainer)
                ? selection.getRangeAt(0)
                : null;
        if (!range) {
            range = document.createRange();
            range.selectNodeContents(editor);
            range.collapse(false);
        }
        range.deleteContents();
        const table = document.createElement('table');
        table.innerHTML = '<tbody><tr><th>Heading 1</th><th>Heading 2</th></tr><tr><td>Item 1</td><td>\\gap{answer}</td></tr></tbody>';
        range.insertNode(table);
        range.setStartAfter(table);
        range.collapse(true);
        selection.removeAllRanges();
        selection.addRange(range);
        editor.focus();
        window.saveIeltsLatexSelection();
        editor.dispatchEvent(new Event('input', { bubbles: true }));
    };

    window.refreshIeltsLatexTemplates = function() {
        const select = document.getElementById('ielts-latex-template');
        const help = document.getElementById('ielts-latex-template-help');
        const skill = APP_DATA && APP_DATA.module;
        const templates = window.getIeltsLatexTemplates()[skill] || [];
        select.innerHTML = '<option value="">Choose a template…</option>' + templates
            .map((template, index) => `<option value="${index}">${template[0]}</option>`).join('');
        select.dataset.skill = skill || '';
        help.textContent = templates.length
            ? `Showing ${templates.length} templates for ${skill}. Insert at the cursor, then replace the example text and answers.`
            : 'No templates are available for the selected skill.';
    };

    window.insertIeltsLatexTemplate = function() {
        const select = document.getElementById('ielts-latex-template');
        const skill = APP_DATA && APP_DATA.module;
        if (select.dataset.skill !== skill) window.refreshIeltsLatexTemplates();
        if (select.value === '') return;
        const template = (window.getIeltsLatexTemplates()[skill] || [])[Number(select.value)];
        if (!template) return;

        const input = document.getElementById('ielts-latex-input');
        input.focus();
        const selection = window.getSelection();
        let range = window.ieltsLatexSavedRange || (selection && selection.rangeCount ? selection.getRangeAt(0) : null);
        if (!range || !input.contains(range.commonAncestorContainer)) {
            range = document.createRange();
            range.selectNodeContents(input);
            range.collapse(false);
        }
        range.deleteContents();
        const insertion = document.createTextNode(`${template[1]}\n\n`);
        range.insertNode(insertion);
        range.setStartAfter(insertion);
        range.collapse(true);
        selection.removeAllRanges();
        selection.addRange(range);
        window.ieltsLatexSavedRange = range.cloneRange();
        input.dispatchEvent(new Event('input', { bubbles: true }));
    };

    window.openIeltsLatexImport = function() {
        const input = document.getElementById('ielts-latex-input');
        input.innerHTML = '';
        window.ieltsLatexSavedRange = null;
        document.getElementById('latex-import-modal').classList.remove('hidden');
        window.refreshIeltsLatexTemplates();
        window.updateIeltsLatexPreview();
        input.focus();
    };

    window.updateIeltsLatexPreview = function() {
        const preview = document.getElementById('ielts-latex-preview');
        const error = document.getElementById('ielts-latex-error');
        const source = window.getIeltsLatexSource();
        const escapeHtml = value => String(value).replace(/[&<>"']/g, char => ({
            '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
        })[char]);
        const formatPreviewText = value => window.formatIELTSLatexImportText(escapeHtml(value));
        const questionCount = question => {
            if (question.type === 'fill_blanks' || question.type === 'dnd_list') return question.gaps.length;
            if (question.type === 'matching_endings') return question.items.length;
            if (question.type === 'matching_headings' || question.type === 'matching_info' || question.type === 'matching_statements' || question.type === 'map_labelling_grid') return question.items.length;
            if (question.type === 'map_labelling_hotspots') return question.hotspots.length;
            if (question.type === 'mcq') return question.selectCount || 1;
            return 1;
        };
        const questionRange = numbers => {
            if (numbers.length > 1 && numbers.every((number, index) => index === 0 || number === numbers[index - 1] + 1)) {
                return `${numbers[0]}-${numbers[numbers.length - 1]}`;
            }
            return numbers.join(', ');
        };
        if (!source) {
            error.classList.add('hidden');
            error.textContent = '';
            preview.innerHTML = '<p class="text-sm text-slate-400">Start typing a passage or IELTS question macro to preview it.</p>';
            return null;
        }
        try {
            const parsed = window.parseIeltsLatex(source);
            error.classList.add('hidden');
            error.textContent = '';
            let html = '';
            let passageHtml = parsed.passage.title
                ? `<h3 class="font-black text-lg text-slate-900">${escapeHtml(parsed.passage.title)}</h3>`
                : '';
            const existingQuestionIds = APP_DATA.parts.flatMap(part =>
                (part.questions || []).flatMap(question => question.ids || []).map(Number));
            let nextQuestionNumber = Math.max(0, ...existingQuestionIds) + 1;
            const previewQuestionNumbers = new Map();
            const getPreviewNumbers = question => {
                const count = questionCount(question);
                const declared = question.questionNumbers;
                const numbers = Array.isArray(declared) && declared.length === count
                    ? declared
                    : Array.from({ length: count }, (_, index) => nextQuestionNumber + index);
                numbers.forEach(number => previewQuestionNumbers.set(question, numbers));
                nextQuestionNumber = Math.max(nextQuestionNumber, ...numbers) + 1;
                return numbers;
            };
            const gapQuestionNumbers = new Map();
            parsed.previewOrder.forEach(question => {
                if (question.type === 'passage_preview') return;
                const numbers = getPreviewNumbers(question);
                if (question.type === 'fill_blanks' || question.type === 'dnd_list') {
                    question.gaps.forEach((gap, index) => gapQuestionNumbers.set(String(gap.id), numbers[index]));
                }
            });
            if (parsed.passage.text.trim()) {
                const gapTimes = new Map();
                parsed.previewOrder.filter(question => question.type === 'fill_blanks' || question.type === 'dnd_list').forEach(question => {
                    question.gaps.forEach(gap => gapTimes.set(String(gap.id), gap.time));
                });
                let body = '';
                let offset = 0;
                const gapPattern = /\{(blank|drop):(\d+)\}/g;
                let gapMatch;
                while ((gapMatch = gapPattern.exec(parsed.passage.text)) !== null) {
                    body += escapeHtml(parsed.passage.text.slice(offset, gapMatch.index));
                    const tokenType = gapMatch[1];
                    const gapId = gapMatch[2];
                    const time = gapTimes.get(gapId);
                    const timestamp = time === null || time === undefined ? '' : ` title="Audio timestamp ${Math.floor(time / 60)}:${String(time % 60).padStart(2, '0')}"`;
                    const number = gapQuestionNumbers.get(gapId);
                    body += tokenType === 'drop'
                        ? `<span role="img" aria-label="Question ${number}, drag-and-drop answer area" class="inline-flex items-center align-middle border-2 border-dashed border-indigo-300 bg-indigo-50 text-indigo-700 rounded px-3 py-1 mx-1 text-xs font-bold">Drop answer · Q${number}</span>`
                        : `<input type="text" disabled aria-label="Question ${number}"${timestamp} class="inline-block align-middle w-24 border border-blue-300 bg-blue-50 rounded px-2 py-1 mx-1" placeholder="Q${number}">`;
                    offset = gapPattern.lastIndex;
                }
                body += escapeHtml(parsed.passage.text.slice(offset));
                passageHtml += `<div class="leading-relaxed whitespace-pre-wrap">${window.formatIELTSLatexImportText(body)}</div>`;
            }
            let renderedPassage = false;
            parsed.previewOrder.forEach(question => {
                if (question.type === 'passage_preview') {
                    html += passageHtml;
                    renderedPassage = true;
                    return;
                }
                const count = questionCount(question);
                const questionNumbers = previewQuestionNumbers.get(question) || getPreviewNumbers(question);
                const firstQuestionNumber = questionNumbers[0];
                const questionLabel = questionRange(questionNumbers);
                if (question.type === 'fill_blanks' || question.type === 'dnd_list') {
                    if (question.shortAnswer) {
                        const statement = formatPreviewText(question.text).replace(/\{(blank|drop):(\d+)\}/g, (_, tokenType, id) => {
                            const number = gapQuestionNumbers.get(String(id)) || firstQuestionNumber;
                            return tokenType === 'drop'
                                ? `<span role="img" aria-label="Question ${number}, drag-and-drop answer area" class="inline-flex items-center align-middle border-2 border-dashed border-indigo-300 bg-indigo-50 text-indigo-700 rounded px-3 py-1 mx-1 text-xs font-bold">Drop answer · Q${number}</span>`
                                : `<input type="text" disabled aria-label="Question ${number}" class="inline-block align-middle w-28 border border-blue-300 bg-blue-50 rounded px-2 py-1 mx-1" placeholder="Q${number}">`;
                        });
                        html += `<section class="border-t border-slate-200 pt-4"><div class="font-bold">${statement}</div><p class="text-xs text-slate-500 mt-1">Short-answer question · answer in your own words as instructed.</p></section>`;
                        return;
                    }
                    const options = question.type === 'dnd_list'
                        ? `<div class="mt-2 flex flex-wrap gap-2">${[...new Set(question.options?.length ? question.options : question.gaps.flatMap(gap => [gap.answer, ...gap.alternatives]))].map(option => `<span class="rounded border border-indigo-200 bg-indigo-50 px-2 py-1 text-xs text-indigo-800">${escapeHtml(option)}</span>`).join('')}</div>`
                        : '';
                    html += `<section class="border-t border-slate-200 pt-4"><p class="font-bold">${question.instruction ? formatPreviewText(question.instruction) : `${question.numberedInPassage ? '' : `${questionLabel}. `}${question.type === 'dnd_list' ? 'Complete the blanks using the options.' : 'Fill in the blanks.'}`}</p><p class="text-sm text-slate-500 mt-1">${question.gaps.length} question${question.gaps.length === 1 ? '' : 's'} in the passage above.</p>${options}</section>`;
                    return;
                }
                if (question.type === 'matching_endings') {
                    html += `<section class="border-t border-slate-200 pt-4"><p class="font-bold mb-2">${questionLabel}. ${formatPreviewText(question.instruction)}</p><div class="space-y-2">${question.items.map((item, index) => `<div class="text-sm">${questionNumbers[index]}. ${formatPreviewText(item.text)} <span class="font-bold text-blue-700">→ ${escapeHtml(item.answer)}</span></div>`).join('')}</div><div class="mt-3 rounded-lg bg-slate-50 p-3 text-sm">${question.options.map(escapeHtml).join('<br>')}</div></section>`;
                    return;
                }
                if (question.type === 'mcq') {
                    const selectionPrompt = question.selectCount > 1 ? `Choose ${question.selectCount} answers.` : '';
                    html += `<section class="border-t border-slate-200 pt-4"><div class="font-bold mb-2">${questionLabel}. ${formatPreviewText(question.question)}</div>${selectionPrompt ? `<p class="text-xs font-bold text-blue-700 mb-2">${selectionPrompt}</p>` : ''}`;
                    question.options.forEach(option => {
                        html += `<div class="py-1 text-sm">${option.correct ? '◉' : '○'} ${formatPreviewText(option.text)}${option.correct ? ' <span class="text-emerald-700 text-xs font-bold">(answer)</span>' : ''}</div>`;
                    });
                    html += '</section>';
                } else {
                    if (question.type === 'tfng') {
                        html += `<section class="border-t border-slate-200 pt-4"><div class="font-bold">${questionLabel}. ${formatPreviewText(question.statement)}</div><div class="text-sm text-slate-500 mt-1">Answer: ${escapeHtml(question.answer)}</div>${question.explanation ? `<div class="text-sm text-purple-700 mt-1">${formatPreviewText(question.explanation)}</div>` : ''}</section>`;
                    } else if (question.type === 'matching_headings' || question.type === 'matching_info' || question.type === 'matching_statements' || question.type === 'map_labelling_grid') {
                        html += `<section class="border-t border-slate-200 pt-4"><div class="font-bold">${questionLabel}. ${formatPreviewText(question.instruction)}</div>${question.image ? `<img src="${escapeHtml(question.image)}" alt="Map" class="max-h-36 my-2">` : ''}<div class="text-sm text-slate-600">${question.items.map((item, index) => `${questionNumbers[index]}. ${formatPreviewText(item.text)} → ${formatPreviewText(item.answer)}`).join('<br>')}</div><div class="text-xs text-slate-500 mt-1">Options: ${question.options.map(escapeHtml).join(', ')}</div></section>`;
                    } else if (question.type === 'map_labelling_hotspots') {
                        html += `<section class="border-t border-slate-200 pt-4"><div class="font-bold">${questionLabel}. ${formatPreviewText(question.instruction)}</div><img src="${escapeHtml(question.image)}" alt="Map" class="max-h-36 my-2"><div class="text-sm text-slate-600">${question.hotspots.map((spot, index) => `Q${questionNumbers[index]} Hotspot (${spot.x}%, ${spot.y}%) → ${formatPreviewText(spot.answer)}`).join('<br>')}</div><div class="text-xs text-slate-500 mt-1">Options: ${question.options.map(escapeHtml).join(', ')}</div></section>`;
                    } else if (question.type === 'essay') {
                        html += `<section class="border-t border-slate-200 pt-4"><div class="font-bold">${questionLabel}. ${formatPreviewText(question.instruction)}</div>${question.text ? `<div class="text-sm mt-1">${formatPreviewText(question.text)}</div>` : ''}</section>`;
                    } else if (question.type === 'audio_record') {
                        html += `<section class="border-t border-slate-200 pt-4"><div class="font-bold">${questionLabel}. Speaking: ${formatPreviewText(question.instruction)}</div>${parsed.speakingQuestions ? `<div class="text-sm mt-1">${formatPreviewText(parsed.speakingQuestions)}</div>` : ''}</section>`;
                    }
                }
            });
            if (!renderedPassage && passageHtml) html = passageHtml + html;
            if (parsed.passage.hasGaps) {
                html = `<div class="text-xs font-black uppercase tracking-wider text-blue-700">Passage with ${parsed.gapCount} inline gap${parsed.gapCount === 1 ? '' : 's'}</div>${html}`;
            }
            preview.innerHTML = html || '<p class="text-sm text-slate-400">Start typing a passage or IELTS question macro to preview it.</p>';
            return parsed;
        } catch (parseError) {
            preview.innerHTML = '<p class="text-sm text-slate-400">Correct the syntax error to see a preview.</p>';
            error.textContent = parseError.message;
            error.classList.remove('hidden');
            return null;
        }
    };

    window.compileIeltsLatex = async function(options = {}) {
        const rapidImport = options.rapid === true;
        const parsed = rapidImport
            ? window.previewRapidLatexImport()
            : window.updateIeltsLatexPreview();
        if (!parsed) {
            if (!rapidImport && !window.getIeltsLatexSource()) {
                showModalMsg('Empty source', 'Enter a passage or question before importing.');
            } else if (rapidImport && !document.getElementById('rapid-latex-input').value.trim()) {
                const error = document.getElementById('rapid-latex-error');
                error.textContent = 'Paste an IELTS LaTeX passage or question before importing.';
                error.classList.remove('hidden');
            }
            return;
        }

        const rapidMode = rapidImport
            ? (document.querySelector('input[name="rapid-mode"]:checked')?.value || 'new')
            : '';
        const selectedRapidTest = rapidImport && rapidMode === 'existing'
            ? TEST_BANK.find(test => test.id === document.getElementById('rapid-existing-test').value)
            : null;
        const rapidTest = selectedRapidTest
            ? {
                ...selectedRapidTest,
                parts: Array.isArray(selectedRapidTest.parts)
                    ? selectedRapidTest.parts.map(part => part
                        ? { ...part, questions: [...(part.questions || [])] }
                        : part)
                    : []
            }
            : null;
        const rapidModule = rapidImport
            ? (rapidMode === 'existing' ? rapidTest?.module : document.getElementById('rapid-test-mod').value)
            : APP_DATA.module;
        const rapidPartIndex = rapidImport
            ? Number(rapidMode === 'existing'
                ? document.getElementById('rapid-existing-part').value
                : document.getElementById('rapid-new-part').value)
            : currentEditorPartIdx;
        if (rapidImport && rapidMode === 'existing' && !rapidTest) {
            const error = document.getElementById('rapid-latex-error');
            error.textContent = 'Select an existing test before importing.';
            error.classList.remove('hidden');
            return;
        }
        const rapidNewTest = rapidImport && rapidMode === 'new'
            ? {
                id: 't_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7),
                title: document.getElementById('rapid-test-title').value.trim() || 'Untitled Rapid Test',
                module: rapidModule,
                topics: [],
                difficulty: document.getElementById('rapid-test-diff').value.trim(),
                parts: getSmartIeltsStructure(rapidModule),
                vocab: []
            }
            : null;
        const targetTest = rapidImport ? (rapidTest || rapidNewTest) : null;
        const targetParts = rapidImport ? (Array.isArray(targetTest.parts) ? targetTest.parts : []) : APP_DATA.parts;
        const part = targetParts[rapidPartIndex];
        if (!part) {
            const error = document.getElementById(rapidImport ? 'rapid-latex-error' : 'ielts-latex-error');
            error.textContent = 'Select a valid test part before importing.';
            error.classList.remove('hidden');
            return;
        }
        const allowedTypes = {
            reading: ['fill_blanks', 'dnd_list', 'multiple_choice', 'tfng', 'ynng', 'matching_headings', 'matching_info', 'matching_endings', 'map_labelling_grid', 'map_labelling_hotspots'],
            listening: ['fill_blanks', 'dnd_list', 'multiple_choice', 'map_labelling_grid', 'map_labelling_hotspots'],
            writing: ['essay'],
            speaking: ['essay', 'audio_record']
        };
        const skillTypes = allowedTypes[rapidModule] || [];
        const unsupported = parsed.questions.find(question => {
            if (rapidModule === 'listening' && ['matching_info', 'matching_headings', 'matching_endings', 'matching_statements'].includes(question.type)) {
                return true;
            }
            const nativeType = question.type === 'mcq' ? 'multiple_choice'
                : question.type === 'matching_endings' || question.type === 'matching_statements' ? 'dnd_list' : question.type;
            return !skillTypes.includes(nativeType);
        });
        if (unsupported || (parsed.writingTask && APP_DATA.module !== 'writing') || (parsed.hasSpeaking && APP_DATA.module !== 'speaking') || (parsed.audioUrl && APP_DATA.module !== 'listening')) {
            const wrongMacro = parsed.writingTask ? 'writingtask' : parsed.hasSpeaking ? 'speaking' : parsed.audioUrl && rapidModule !== 'listening' ? 'audio' : unsupported?.type.replace(/_/g, ' ') || 'question type';
            const message = `The ${wrongMacro} macro is not available for the ${rapidModule || 'current'} skill.`;
            const error = document.getElementById(rapidImport ? 'rapid-latex-error' : 'ielts-latex-error');
            error.textContent = message;
            error.classList.remove('hidden');
            return;
        }

        const hasImportedPassage = !!(parsed.passage.title || parsed.passage.text.trim());
        if (!rapidImport) saveCurrentEditorPart();
        if (hasImportedPassage && (part.text || part.title) &&
            !confirm('This import will replace the current part title and passage text, then append the parsed questions. Continue?')) {
            return;
        }
        const usedIds = new Set(targetParts.flatMap(item =>
            (item.questions || []).flatMap(question => question.ids || []).map(Number)));
        const declaredIds = parsed.questions.flatMap(question =>
            Array.isArray(question.questionNumbers) ? question.questionNumbers : []);
        const declaredIdSet = new Set();
        const duplicateDeclaredIds = declaredIds.filter(id => {
            const duplicate = usedIds.has(id) || declaredIdSet.has(id);
            declaredIdSet.add(id);
            return duplicate;
        });
        if (duplicateDeclaredIds.length) {
            const error = document.getElementById(rapidImport ? 'rapid-latex-error' : 'ielts-latex-error');
            error.textContent = `Question number${duplicateDeclaredIds.length > 1 ? 's' : ''} ${[...new Set(duplicateDeclaredIds)].join(', ')} already exist in this test. Change the LaTeX numbering or import into a new test.`;
            error.classList.remove('hidden');
            return;
        }
        const escapeHtml = value => String(value).replace(/[&<>"']/g, char => ({
            '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
        })[char]);
        const formatText = value => {
            if (value === null || value === undefined) return '';
            const raw = String(value).replace(/\r\n/g, '\n').trim();
            if (!raw) return '';
            return window.formatIELTSLatexImportText(escapeHtml(raw));
        };
        let nextId = Math.max(0, ...usedIds) + 1;
        const newBlocks = [];

        const allocateIds = (count, declared = null) => {
            if (Array.isArray(declared) && declared.length === count) {
                declared.forEach(id => usedIds.add(id));
                nextId = Math.max(nextId, ...declared) + 1;
                return [...declared];
            }
            return Array.from({ length: count }, () => {
                while (usedIds.has(nextId)) nextId++;
                const id = nextId++;
                usedIds.add(id);
                return id;
            });
        };
        const compileGapQuestion = gapBlock => {
            const ids = allocateIds(gapBlock.gaps.length, gapBlock.questionNumbers);
            const gapIds = Object.fromEntries(gapBlock.gaps.map((gap, index) => [gap.id, ids[index]]));
            const marker = gapBlock.type === 'dnd_list' ? 'drop' : 'blank';
            const text = gapBlock.text.replace(/\{(?:blank|drop):(\d+)\}/g, (_, id) => `{${marker}:${gapIds[id]}}`);
            const correctAnswers = {};
            const timestamps = {};
            const dropOptions = Array.isArray(gapBlock.options) ? gapBlock.options : [];
            const dropOptionByLabel = new Map(dropOptions.map(option => {
                const match = String(option).match(/^\s*([A-Z])(?:[.)\-]|\s)\s*(.+)$/i);
                return match ? [match[1].toUpperCase(), option] : null;
            }).filter(Boolean));
            const resolveDropAnswer = answer => {
                const value = String(answer || '').trim();
                const label = value.match(/^([A-Z])(?:[.)])?$/i)?.[1]?.toUpperCase();
                return label ? (dropOptionByLabel.get(label) || value) : value;
            };
            gapBlock.gaps.forEach(gap => {
                const id = gapIds[gap.id];
                const answers = [gap.answer, ...gap.alternatives].map(answer =>
                    gapBlock.type === 'dnd_list' ? resolveDropAnswer(answer) : answer);
                correctAnswers[id] = [...new Set(answers)].join('/');
                if (gap.time !== null) timestamps[id] = gap.time;
            });
            const options = gapBlock.type === 'dnd_list'
                ? [...new Set(dropOptions.length
                    ? dropOptions
                    : gapBlock.gaps.flatMap(gap => [gap.answer, ...gap.alternatives]).map(resolveDropAnswer))]
                : [];
            const block = {
                blockId: 'b_' + Date.now() + Math.random().toString(36).slice(2, 7),
                type: gapBlock.type,
                ids,
                points: ids.length,
                instruction: formatText(gapBlock.instruction || (gapBlock.type === 'dnd_list' ? 'Complete the sentences using the options.' : 'Fill in the blanks.')),
                text: formatText(text),
                options,
                correctAnswers,
                reusable: false,
                ...(gapBlock.type === 'dnd_list' ? { latexSource: true } : {})
            };
            if (Object.keys(timestamps).length) block.timestamps = timestamps;
            return block;
        };

        parsed.questions.forEach(question => {
            if (question.type === 'matching_statements') {
                const ids = allocateIds(question.items.length, question.questionNumbers);
                const correctAnswers = {};
                const text = question.items.map((item, index) => {
                    correctAnswers[ids[index]] = item.answer;
                    return `${ids[index]}. ${item.text} {drop:${ids[index]}}`;
                }).join('\n');
                newBlocks.push({
                    blockId: 'b_' + Date.now() + Math.random().toString(36).slice(2, 7),
                    type: 'dnd_list',
                    questionFormat: 'matching_statements',
                    ids,
                    points: ids.length,
                    instruction: formatText(question.instruction),
                    text: formatText(text),
                    options: question.options,
                    correctAnswers,
                    reusable: false,
                    latexSource: true
                });
                return;
            }
            if (question.type === 'matching_endings') {
                const ids = allocateIds(question.items.length, question.questionNumbers);
                const correctAnswers = {};
                const text = question.items.map((item, index) => {
                    correctAnswers[ids[index]] = question.options.find(option =>
                        option.toLowerCase().startsWith(`${item.answer.toLowerCase()}. `));
                    const stem = item.text.replace(new RegExp(`^\\s*(?:question\\s*)?${ids[index]}[.)]\\s*`, 'i'), '');
                    return `${ids[index]}. ${stem} {drop:${ids[index]}}`;
                }).join('\n');
                newBlocks.push({
                    blockId: 'b_' + Date.now() + Math.random().toString(36).slice(2, 7),
                    type: 'dnd_list',
                    questionFormat: 'matching_sentence_endings',
                    ids,
                    points: ids.length,
                    instruction: formatText(question.instruction),
                    text: formatText(text),
                    options: question.options,
                    correctAnswers,
                    reusable: false,
                    latexSource: true
                });
                return;
            }
            if (question.type === 'fill_blanks' || question.type === 'dnd_list') {
                newBlocks.push(compileGapQuestion(question));
                return;
            }
            let id;
            if (question.type === 'mcq') {
                const ids = allocateIds(question.selectCount || 1, question.questionNumbers);
                const options = question.options.map(option => option.text);
                const correctAnswers = {};
                question.options.filter(option => option.correct).forEach((option, index) => {
                    correctAnswers[ids[index]] = option.text;
                });
                newBlocks.push({
                    blockId: 'b_' + Date.now() + Math.random().toString(36).slice(2, 7),
                    type: 'multiple_choice',
                    ids,
                    points: ids.length,
                    instruction: ids.length > 1 ? `Choose ${ids.length} answers.` : 'Choose the correct answer.',
                    text: formatText(question.question),
                    options,
                    correctAnswers,
                    multi: ids.length > 1,
                    latexSource: true
                });
            } else if (question.type === 'tfng') {
                id = allocateIds(1, question.questionNumbers)[0];
                const isYesNo = question.answer === 'YES' || question.answer === 'NO';
                const answer = question.answer === 'TRUE' ? 'True'
                    : question.answer === 'FALSE' ? 'False'
                    : question.answer === 'YES' ? 'Yes'
                    : question.answer === 'NO' ? 'No'
                    : 'Not Given';
                newBlocks.push({
                    blockId: 'b_' + Date.now() + Math.random().toString(36).slice(2, 7),
                    type: isYesNo ? 'ynng' : 'tfng',
                    ids: [id],
                    points: 1,
                    instruction: isYesNo ? 'Do the statements agree with the claims?' : 'Do the statements agree with the information?',
                    text: formatText(question.statement),
                    options: isYesNo ? ['Yes', 'No', 'Not Given'] : ['True', 'False', 'Not Given'],
                    correctAnswers: { [id]: answer },
                    explanation: formatText(question.explanation || '')
                });
            } else if (question.type === 'matching_headings' || question.type === 'matching_info' || question.type === 'map_labelling_grid') {
                const ids = allocateIds(question.items.length, question.questionNumbers);
                const text = question.type === 'matching_headings'
                    ? question.items.map((item, index) => `${ids[index]}. ${item.text}`).join('\n')
                    : question.items.map(item => escapeHtml(item.text)).join('\n');
                const correctAnswers = {};
                question.items.forEach((item, index) => { correctAnswers[ids[index]] = item.answer; });
                newBlocks.push({
                    blockId: 'b_' + Date.now() + Math.random().toString(36).slice(2, 7),
                    type: question.type,
                    ids,
                    points: ids.length,
                    instruction: formatText(question.instruction),
                    text: question.type === 'matching_headings' ? formatText(text) : text,
                    options: question.options,
                    correctAnswers,
                    reusable: question.type === 'matching_headings' ? false : true,
                    latexSource: true,
                    ...(question.type === 'map_labelling_grid' ? { image: question.image } : {})
                });
            } else if (question.type === 'map_labelling_hotspots') {
                const ids = allocateIds(question.hotspots.length, question.questionNumbers);
                const correctAnswers = {};
                question.hotspots.forEach((hotspot, index) => { correctAnswers[ids[index]] = hotspot.answer; });
                newBlocks.push({
                    blockId: 'b_' + Date.now() + Math.random().toString(36).slice(2, 7),
                    type: question.type,
                    ids,
                    points: ids.length,
                    instruction: formatText(question.instruction),
                    text: '',
                    options: question.options,
                    correctAnswers,
                    reusable: false,
                    image: question.image,
                    latexSource: true,
                    hotspots: question.hotspots.map((hotspot, index) => ({ id: ids[index], x: hotspot.x, y: hotspot.y }))
                });
            } else if (question.type === 'essay') {
                id = allocateIds(1, question.questionNumbers)[0];
                newBlocks.push({
                    blockId: 'b_' + Date.now() + Math.random().toString(36).slice(2, 7),
                    type: 'essay',
                    ids: [id],
                    points: 1,
                    instruction: formatText(question.instruction),
                    text: formatText(question.text || ''),
                    options: [],
                    correctAnswers: {}
                });
            } else if (question.type === 'audio_record') {
                id = allocateIds(1, question.questionNumbers)[0];
                newBlocks.push({
                    blockId: 'b_' + Date.now() + Math.random().toString(36).slice(2, 7),
                    type: 'audio_record',
                    ids: [id],
                    points: 1,
                    instruction: formatText(question.instruction),
                    text: '',
                    options: [],
                    correctAnswers: {}
                });
            }
        });

        if (hasImportedPassage) {
            if (parsed.passage.instructionMovedFromTitle) part.title = '';
            else if (parsed.passage.title) part.title = escapeHtml(parsed.passage.title);
            part.text = parsed.gapCount ? '' : formatText(parsed.passage.text);
        }
        if (parsed.writingTask) part.writingTask = parsed.writingTask;
        if (parsed.hasSpeaking) part.speakingQuestions = formatText(parsed.speakingQuestions);
        if (parsed.audioUrl) part.audioUrl = parsed.audioUrl;
        part.questions.push(...newBlocks);
        part.questions = (Array.isArray(part.questions) ? part.questions : [])
            .map((question, index) => ({
                question,
                index,
                firstId: Array.isArray(question?.ids) && question.ids.length
                    ? Math.min(...question.ids.map(Number).filter(Number.isFinite))
                    : Number.MAX_SAFE_INTEGER
            }))
            .sort((left, right) => left.firstId - right.firstId || left.index - right.index)
            .map(({ question }) => question);
        if (rapidImport) {
            await window.fsSetDoc(window.fsDoc(window.db, window.fPath('tests'), targetTest.id), targetTest);
            if (rapidNewTest) TEST_BANK.unshift(rapidNewTest);
            else {
                const testIndex = TEST_BANK.findIndex(test => test.id === targetTest.id);
                if (testIndex >= 0) TEST_BANK[testIndex] = targetTest;
            }
            document.getElementById('csv-import-modal').classList.add('hidden');
            renderTestBank();
            const targetLabel = `${targetTest.title} (${part.title || `Part ${rapidPartIndex + 1}`})`;
            showModalMsg('LaTeX import complete', `${rapidNewTest ? 'Created' : 'Updated'} "${targetLabel}" with ${newBlocks.length} native question block${newBlocks.length === 1 ? '' : 's'}.`);
            return;
        }
        if (parsed.audioUrl) {
            part.audioUrl = parsed.audioUrl;
            const audioInput = document.getElementById('edit-audio-url');
            if (audioInput) audioInput.value = parsed.audioUrl;
            if (typeof window.updateListeningEditorAudio === 'function') {
                window.updateListeningEditorAudio(parsed.audioUrl);
            }
        }
        if (hasImportedPassage) {
            const titleEl = document.getElementById('edit-passage-title');
            if (titleEl.tagName === 'INPUT' || titleEl.tagName === 'TEXTAREA') titleEl.value = part.title;
            else titleEl.innerHTML = part.title;
            const passageEl = document.getElementById('edit-passage-text');
            if (passageEl.isContentEditable) passageEl.innerHTML = part.text;
            else passageEl.value = part.text;
        }
        document.getElementById('latex-import-modal').classList.add('hidden');
        loadEditorPart(currentEditorPartIdx);
        triggerEditorAutosave();
        showModalMsg('LaTeX import complete', `Added ${newBlocks.length} native question block${newBlocks.length === 1 ? '' : 's'} to this part.`);
    };

    window.compileRapidLatexImport = async function() {
        const source = document.getElementById('rapid-latex-input').value;
        try {
            return await window.compileIeltsLatex({ rapid: true, source });
        } catch (importError) {
            console.error('Rapid LaTeX import failed:', importError);
            const error = document.getElementById('rapid-latex-error');
            error.textContent = `Import failed: ${importError.message || importError}`;
            error.classList.remove('hidden');
        }
    };

    window.openMarkupImport = function() {
        const el = document.getElementById('iml-editor');
        if (el.tagName === 'TEXTAREA') el.value = ''; else el.innerHTML = '';
        document.getElementById('markup-import-modal').classList.remove('hidden');
    };

    // ✨ Custom Markdown Formatter (Converts plaintext styling into perfect LMS HTML)
    window.formatIELTSMarkdown = function(text) {
        if (!text) return '';
        let lines = text.split('\n');
        let out = [];
        let inUl = false;
        let inOl = false;
        const formatInline = value => value
            .replace(/\*\*(.*?)\*\*/g, '<b>$1</b>')
            .replace(/__(.*?)__/g, '<u>$1</u>')
            .replace(/(?<!\*)\*(?!\*)(.*?)(?<!\*)\*(?!\*)/g, '<i>$1</i>');

        for (let i = 0; i < lines.length; i++) {
            let line = lines[i].trim();

            if (/^\|.*\|$/.test(line) && /^\|\s*:?-{3,}:?\s*(?:\|\s*:?-{3,}:?\s*)+\|$/.test((lines[i + 1] || '').trim())) {
                if (inUl) { out.push('</ul>'); inUl = false; }
                if (inOl) { out.push('</ol>'); inOl = false; }
                const cells = row => row.trim().replace(/^\||\|$/g, '').split('|').map(cell => formatInline(cell.trim()));
                const headerCells = cells(line);
                i += 2;
                const bodyRows = [];
                while (i < lines.length && /^\|.*\|$/.test(lines[i].trim())) bodyRows.push(cells(lines[i++]));
                i--;
                out.push(`<table class="border-collapse border border-slate-300 mb-4 bg-white w-full"><thead><tr>${headerCells.map(cell => `<th class="border border-slate-300 p-2">${cell}</th>`).join('')}</tr></thead><tbody>${bodyRows.map(row => `<tr>${row.map(cell => `<td class="border border-slate-300 p-2">${cell}</td>`).join('')}</tr>`).join('')}</tbody></table>`);
                continue;
            }

            if (!line) {
                if (inUl) { out.push('</ul>'); inUl = false; }
                if (inOl) { out.push('</ol>'); inOl = false; }
                out.push('<p><br></p>');
                continue;
            }

            // Inline formatting (bold, italic, underline) - Safely ignores existing HTML tags
            line = formatInline(line);

            // List detection
            const ulMatch = line.match(/^[\-\•]\s+(.*)/);
            const olMatch = line.match(/^(\d+)[\.\)]\s+(.*)/);

            if (ulMatch) {
                if (inOl) { out.push('</ol>'); inOl = false; }
                if (!inUl) { out.push('<ul>'); inUl = true; }
                out.push(`<li>${ulMatch[1]}</li>`);
            } else if (olMatch) {
                if (inUl) { out.push('</ul>'); inUl = false; }
                if (!inOl) { out.push('<ol>'); inOl = true; }
                out.push(`<li>${olMatch[2]}</li>`);
            } else {
                if (inUl) { out.push('</ul>'); inUl = false; }
                if (inOl) { out.push('</ol>'); inOl = false; }
                out.push(`<p>${line}</p>`);
            }
        }
        
        if (inUl) out.push('</ul>');
        if (inOl) out.push('</ol>');

        return out.join('').replace(/<p><\/p>/g, '<p><br></p>');
    };

    window.formatIELTSLatexImportText = function(text) {
        if (!text) return '';
        const compactSource = String(text)
            .replace(/\r\n/g, '\n')
            .replace(/[ \t]+\n/g, '\n')
            .replace(/\n[ \t]*\n+/g, '\n')
            .trim();
        if (!compactSource) return '';
        return window.formatIELTSMarkdown(compactSource)
            .replace(/<p><br><\/p>/g, '')
            .replace(/<p>/g, '<p style="margin:0">')
            .replace(/<ul>/g, '<ul style="margin:0;padding-left:1.25rem">')
            .replace(/<ol>/g, '<ol style="margin:0;padding-left:1.25rem">')
            .replace(/class="border-collapse border border-slate-300 mb-4 bg-white w-full"/g, 'class="border-collapse border border-slate-300 bg-white w-full"');
    };

    window.compileIML = function() {
        const editorEl = document.getElementById('iml-editor');
        let rawHtml = editorEl.innerHTML || editorEl.value || '';
        
        // ✨ HTML PRE-PROCESSOR: Converts pasted Rich Text blocks safely back to parsable lines
        let parseText = rawHtml
            .replace(/<div><br><\/div>/gi, '\n')
            .replace(/<br\s*[\/]?>/gi, '\n')
            .replace(/<\/p>/gi, '\n')
            .replace(/<\/div>/gi, '\n')
            .replace(/<\/li>/gi, '\n')
            .replace(/<li>/gi, '- ') // Preserve list items for the Markdown formatter
            .replace(/&nbsp;/gi, ' ');
            
        // Strip all tags EXCEPT formatting (b, i, u, strong, em) so they pass safely into the UI
        parseText = parseText.replace(/<(?!\/?(b|i|u|strong|em)(>|\s))[^>]+>/gi, '');
        
        // Decode HTML entities (like &gt; back to > for TFNG arrows)
        const txtHelper = document.createElement("textarea");
        txtHelper.innerHTML = parseText;
        rawText = txtHelper.value;

        if (!rawText.trim()) {
            showModalMsg("Empty", "Please paste or type some text to compile.");
            return;
        }

        const lines = rawText.split('\n');
        let newQuestions = [];
        let currentQ = null;
        
        let gapBuffer = []; 
        let gapType = null; 
        let pairBuffer = [];
        let textBuffer = [];
        
        let activeExplicitMode = null; 

        let maxId = 0;
        APP_DATA.parts.forEach(p => {
            (p.questions || []).forEach(q => {
                (q.ids || []).forEach(id => { if (id > maxId) maxId = id; });
            });
        });

        // --- CLOSURE HELPERS TO SEAL BUFFERS INTO BLOCKS ---
        const pushGapBuffer = () => {
            if (gapBuffer.length > 0) {
                const combinedText = gapBuffer.map(g => g.rawText).join('\n');
                let processedText = window.formatIELTSMarkdown(combinedText);
                
                const isDrop = activeExplicitMode === 'dragdrop' || (activeExplicitMode !== 'gapfill' && gapType === 'drag');
                const type = isDrop ? 'dnd_list' : 'fill_blanks';
                
                let ids = [];
                let correctAnswers = {};
                let options = [];

                if (activeExplicitMode === 'dragdrop') {
                    processedText = processedText.replace(/\[([^\[\]]+)\]/g, '{$1}');
                } else if (activeExplicitMode === 'gapfill') {
                    processedText = processedText.replace(/\{([^{}]+)\}/g, '[$1]');
                }

                let matchDrop;
                const regexDrop = /\{([^{}]+)\}/g;
                while ((matchDrop = regexDrop.exec(processedText)) !== null) {
                    maxId++;
                    const ans = matchDrop[1].trim();
                    ids.push(maxId);
                    correctAnswers[maxId] = ans;
                    processedText = processedText.replace(matchDrop[0], `{drop:${maxId}}`);
                    options.push(ans);
                }

                let matchBlank;
                const regexBlank = /\[([^\[\]]+)\]/g;
                while ((matchBlank = regexBlank.exec(processedText)) !== null) {
                    const inner = matchBlank[1].trim().toLowerCase();
                    if (['writing','essay','speaking','headings','matching','map hotspots','map grid','end','gap fill','drag drop','multiple choice','tfng','ynng','matching headings','matching info'].includes(inner)) continue;
                    
                    maxId++;
                    const ans = matchBlank[1].trim();
                    ids.push(maxId);
                    correctAnswers[maxId] = ans;
                    processedText = processedText.replace(matchBlank[0], `{blank:${maxId}}`);
                    if (type === 'dnd_list') options.push(ans); 
                }

                if (ids.length > 0) {
                    newQuestions.push({
                        blockId: 'b_' + Date.now() + Math.random().toString(36).substr(2,5),
                        type: type,
                        ids: ids,
                        points: ids.length,
                        instruction: type === 'dnd_list' ? "Complete the sentences below. Choose the correct word from the box." : "Fill in the blanks.",
                        text: processedText,
                        options: type === 'dnd_list' ? [...new Set(options)].sort(() => Math.random() - 0.5) : [],
                        correctAnswers: correctAnswers,
                        reusable: false
                    });
                }
                gapBuffer = [];
                gapType = null;
            }
        };

        const pushPairBuffer = () => {
            if (pairBuffer.length > 0) {
                let type = 'matching_info';
                let instruction = "Match the information.";
                let isReusable = true;

                if (activeExplicitMode === 'headings' || activeExplicitMode === 'matching_headings') { type = 'matching_headings'; instruction = "Choose the correct heading for each paragraph."; isReusable = false; }
                else if (activeExplicitMode === 'hotspots' || activeExplicitMode === 'map_labelling_hotspots') { type = 'map_labelling_hotspots'; instruction = "Label the map below."; }
                else if (activeExplicitMode === 'grid' || activeExplicitMode === 'map_labelling_grid') { type = 'map_labelling_grid'; instruction = "Match the places to the correct letters on the map."; }
                else if (activeExplicitMode === 'matching' || activeExplicitMode === 'matching_info') { type = 'matching_info'; }
                else if (activeExplicitMode === 'tfng' || activeExplicitMode === 'ynng') {
                    pairBuffer.forEach(m => {
                        maxId++;
                        // Auto-strip leading letters for TFNG/YNNG just in case
                        let cleanRight = m.right.replace(/^(?:[A-Za-z]{1,5}|[0-9]{1,2}|[\-\*\•])[\.\)\:]?\s+/, '').trim();
                        let ansRaw = cleanRight.toUpperCase();
                        if(ansRaw === 'T') ansRaw = 'True'; if(ansRaw === 'F') ansRaw = 'False'; if(ansRaw === 'NG') ansRaw = 'Not Given';
                        if(ansRaw === 'Y') ansRaw = 'Yes'; if(ansRaw === 'N') ansRaw = 'No';
                        newQuestions.push({
                            blockId: 'b_' + Date.now() + Math.random().toString(36).substr(2,5),
                            type: activeExplicitMode,
                            ids: [maxId],
                            points: 1,
                            instruction: activeExplicitMode === 'ynng' ? "Do the statements agree with the claims?" : "Do the statements agree with the information?",
                            text: window.formatIELTSMarkdown(m.left),
                            options: activeExplicitMode === 'ynng' ? ["Yes", "No", "Not Given"] : ["True", "False", "Not Given"],
                            correctAnswers: { [maxId]: ansRaw }
                        });
                    });
                    pairBuffer = [];
                    return;
                }
                else {
                    const isRoman = pairBuffer.every(m => {
                        let r = m.right.trim();
                        const match = r.match(/^(?:[A-Za-z]{1,5}|[0-9]{1,2}|[\-\*\•])[\.\)\:]?\s+(.+)$/);
                        if (match) r = match[1].trim();
                        return /^[ivxlcdm]+$/i.test(r);
                    });
                    if (isRoman) { type = 'matching_headings'; instruction = "Choose the correct heading."; isReusable = false; }
                }

                let ids = [];
                let correctAnswers = {};
                let textLines = [];
                let options = [];

                pairBuffer.forEach(m => {
                    maxId++;
                    ids.push(maxId);
                    if (type !== 'map_labelling_hotspots') textLines.push(m.left);
                    
                    let cleanRight = m.right.trim();
                    
                    // ✨ FIX: Auto-strip leading "A) ", "B. ", "- ", "i.", "iv " from options, EXCEPT for Matching Info!
                    if (type !== 'matching_info') {
                        const prefixRegex = /^(?:[A-Za-z]{1,5}|[0-9]{1,2}|[\-\*\•])[\.\)\:]?\s+(.+)$/;
                        const match = cleanRight.match(prefixRegex);
                        if (match) {
                            cleanRight = match[1].trim();
                        }
                    }
                    
                    correctAnswers[maxId] = cleanRight;
                    options.push(cleanRight);
                });

                newQuestions.push({
                    blockId: 'b_' + Date.now() + Math.random().toString(36).substr(2,5),
                    type: type,
                    ids: ids,
                    points: ids.length,
                    instruction: instruction,
                    // ✨ FIX: Matching Info and Grids use Textareas. They need Raw Newlines (\n), NOT <br> tags!
                    text: ['matching_info', 'map_labelling_grid', 'map_labelling_hotspots'].includes(type) ? textLines.join('\n') : window.formatIELTSMarkdown(textLines.join('\n')),
                    options: [...new Set(options)].sort(), 
                    correctAnswers: correctAnswers,
                    reusable: isReusable,
                    image: (type.includes('map')) ? '' : undefined
                });
                pairBuffer = [];
            }
        };

        const pushTextBuffer = () => {
            if (textBuffer.length > 0) {
                maxId++;
                const isSpeaking = activeExplicitMode === 'speaking';
                const formattedText = window.formatIELTSMarkdown(textBuffer.join('\n'));
                newQuestions.push({
                    blockId: 'b_' + Date.now() + Math.random().toString(36).substr(2,5),
                    type: isSpeaking ? 'audio_record' : 'essay',
                    ids: [maxId],
                    points: 1,
                    instruction: isSpeaking ? "Record your answer." : "You should spend about 40 minutes on this task.",
                    text: formattedText,
                    options: [],
                    correctAnswers: {}
                });
                textBuffer = [];
            }
        };

        const pushCurrentQ = () => {
            if (currentQ) { 
                currentQ.text = window.formatIELTSMarkdown(currentQ.text);
                newQuestions.push(currentQ); 
                currentQ = null; 
            }
        };

        const pushAllBuffers = () => {
            pushGapBuffer();
            pushPairBuffer();
            pushTextBuffer();
            pushCurrentQ();
        };

        // --- MAIN PARSER LOOP ---
        for (let i = 0; i < lines.length; i++) {
            let line = lines[i].trim();
            
            if (!line) {
                if (textBuffer.length > 0) textBuffer.push(""); 
                else if (gapBuffer.length > 0) gapBuffer.push({ rawText: "" }); 
                continue;
            }

            // 1. Detect Explicit Mode Switching Tags (Matches Dropdown Names)
            const modeMatch = line.match(/^\[(Multiple Choice|Gap Fill|Drag Drop|TFNG|YNNG|Matching Headings|Matching Info|Map Hotspots|Map Grid|Writing|Essay|Speaking|End)\]$/i);
            if (modeMatch) {
                pushAllBuffers(); 
                const m = modeMatch[1].toLowerCase();
                
                if (m === 'end') { activeExplicitMode = null; }
                else if (m === 'multiple choice') activeExplicitMode = 'mcq';
                else if (m === 'gap fill') activeExplicitMode = 'gapfill';
                else if (m === 'drag drop') activeExplicitMode = 'dragdrop';
                else if (m === 'tfng') activeExplicitMode = 'tfng';
                else if (m === 'ynng') activeExplicitMode = 'ynng';
                else if (m === 'matching headings') activeExplicitMode = 'matching_headings';
                else if (m === 'matching info') activeExplicitMode = 'matching_info';
                else if (m === 'map hotspots') activeExplicitMode = 'map_labelling_hotspots';
                else if (m === 'map grid') activeExplicitMode = 'map_labelling_grid';
                else if (m === 'writing' || m === 'essay') activeExplicitMode = 'essay';
                else if (m === 'speaking') activeExplicitMode = 'speaking';
                
                continue;
            }

            // End explicit mode
            if (line.match(/^\[End\]$/i)) {
                pushAllBuffers();
                activeExplicitMode = null;
                continue;
            }

            // 2. Absorb lines based on explicit context
            if (activeExplicitMode === 'essay' || activeExplicitMode === 'speaking') {
                textBuffer.push(line);
                continue;
            }
            if (activeExplicitMode === 'gapfill') {
                gapType = 'typing';
                gapBuffer.push({ rawText: line });
                continue;
            }
            if (activeExplicitMode === 'dragdrop') {
                gapType = 'drag';
                gapBuffer.push({ rawText: line });
                continue;
            }
            if (['headings', 'matching', 'hotspots', 'grid'].includes(activeExplicitMode)) {
                const pairMatch = line.match(/^(?:(?:\d+)[\.\)]\s*)?(.*?)\s*->\s*(.+)$/);
                if (pairMatch) {
                    pairBuffer.push({ left: pairMatch[1].trim(), right: pairMatch[2].trim() });
                }
                continue;
            }

            // 3. AUTO-DETECT MODE 
            const tfngMatch = line.match(/^(?:(?:\d+)[\.\)]\s*)?(.*?)->\s*(?:(?:[A-Za-z]{1,5}|[0-9]{1,2}|[\-\*\•])[\.\)\:]?\s+)?(TRUE|FALSE|NOT GIVEN|YES|NO|T|F|NG|Y|N)$/i);
            const matchInfoMatch = line.match(/^(?:(?:\d+)[\.\)]\s*)?(.*?)\s*->\s*(.+)$/);
            const qStartMatch = line.match(/^(\d+)[\.\)]\s+(.*)/);
            
            // Allow auto-detect MCQ even if explicitMode isn't set, OR force it if explicitMode IS mcq
            const optRegex1 = /^(\*?)(?:[A-Za-z]{1,5}|[0-9]{1,2})[\.\)\:]\s+(.*)/;
            const optRegex2 = /^(\*?)[\-\*\•]\s+(.*)/;
            const isOpt = (currentQ?.type === 'multiple_choice' || activeExplicitMode === 'mcq') ? (optRegex1.exec(line) || optRegex2.exec(line)) : null;

            // Detect Gap Type for this specific line
            let lineGapType = null;
            if (line.includes('{') && line.includes('}')) lineGapType = 'drag';
            else if (line.includes('[') && line.includes(']')) lineGapType = 'typing';

            if (activeExplicitMode === 'mcq') {
                if (isOpt) {
                    const isCorrect = isOpt[1] === '*';
                    let optText = isOpt[2].trim();
                    if (!currentQ) {
                        maxId++;
                        currentQ = { blockId: 'b_' + Date.now() + Math.random(), type: 'multiple_choice', ids: [maxId], points: 1, instruction: "Choose the correct answer.", text: "", options: [], correctAnswers: {}, multi: false };
                    }
                    currentQ.options.push(optText);
                    
                    if (isCorrect) {
                        if (Object.keys(currentQ.correctAnswers).length > 0 && currentQ.correctAnswers[currentQ.ids[0]]) {
                            currentQ.multi = true;
                            maxId++;
                            currentQ.ids.push(maxId); 
                            currentQ.correctAnswers[maxId] = optText;
                        } else {
                            currentQ.correctAnswers[currentQ.ids[0]] = optText;
                        }
                    }
                } else {
                    if (currentQ && currentQ.options.length > 0) pushCurrentQ(); // End previous question
                    if (!currentQ) {
                        maxId++;
                        currentQ = { blockId: 'b_' + Date.now() + Math.random(), type: 'multiple_choice', ids: [maxId], points: 1, instruction: "Choose the correct answer.", text: line, options: [], correctAnswers: {}, multi: false };
                    } else {
                        currentQ.text += '\n' + line;
                    }
                }
                continue;
            }

            if (lineGapType) {
                if (gapBuffer.length > 0 && gapType !== null && gapType !== lineGapType) {
                    pushGapBuffer(); // Separates drag blocks from gapfill blocks!
                }
                gapType = lineGapType;
                pushPairBuffer(); pushTextBuffer(); pushCurrentQ(); 
                gapBuffer.push({ rawText: line });
                continue;
            }

            if (isOpt) {
                const isCorrect = isOpt[1] === '*';
                let optText = isOpt[2].trim();
                currentQ.options.push(optText);
                
                if (isCorrect) {
                    if (Object.keys(currentQ.correctAnswers).length > 0 && currentQ.correctAnswers[currentQ.ids[0]]) {
                        currentQ.multi = true;
                        maxId++;
                        currentQ.ids.push(maxId); 
                        currentQ.correctAnswers[maxId] = optText;
                    } else {
                        currentQ.correctAnswers[currentQ.ids[0]] = optText;
                    }
                }
                continue;
            }

            if (tfngMatch) {
                pushAllBuffers();
                maxId++;
                const stmt = tfngMatch[1].trim();
                let ansRaw = tfngMatch[2].toUpperCase();
                
                if(ansRaw === 'T') ansRaw = 'True';
                if(ansRaw === 'F') ansRaw = 'False';
                if(ansRaw === 'NG') ansRaw = 'Not Given';
                if(ansRaw === 'Y') ansRaw = 'Yes';
                if(ansRaw === 'N') ansRaw = 'No';

                const isYnng = ['YES', 'NO', 'Y', 'N'].includes(ansRaw.toUpperCase());

                newQuestions.push({
                    blockId: 'b_' + Date.now() + Math.random().toString(36).substr(2,5),
                    type: isYnng ? 'ynng' : 'tfng',
                    ids: [maxId],
                    points: 1,
                    instruction: isYnng ? "Do the statements agree with the claims?" : "Do the statements agree with the information?",
                    text: window.formatIELTSMarkdown(stmt),
                    options: isYnng ? ["Yes", "No", "Not Given"] : ["True", "False", "Not Given"],
                    correctAnswers: { [maxId]: ansRaw }
                });
                continue;
            }

            if (matchInfoMatch && !tfngMatch) {
                pushGapBuffer(); pushTextBuffer(); pushCurrentQ(); 
                pairBuffer.push({ left: matchInfoMatch[1].trim(), right: matchInfoMatch[2].trim() });
                continue;
            }

            if (qStartMatch) {
                pushAllBuffers();
                maxId++;
                currentQ = {
                    blockId: 'b_' + Date.now() + Math.random().toString(36).substr(2,5),
                    type: 'multiple_choice',
                    ids: [maxId],
                    points: 1,
                    instruction: "Choose the correct answer.",
                    text: qStartMatch[2],
                    options: [],
                    correctAnswers: {},
                    multi: false
                };
                continue;
            }

            if (currentQ && currentQ.options.length === 0) {
                currentQ.text += '\n' + line;
            } else if (gapBuffer.length > 0) {
                gapBuffer.push({ rawText: line });
            }
        }

        // Flush end of script
        pushAllBuffers();

        if (newQuestions.length === 0) {
            showModalMsg("No Output", "Could not detect any valid questions. Please check the Cheatsheet format.");
            return;
        }

        APP_DATA.parts[currentEditorPartIdx].questions.push(...newQuestions);
        document.getElementById('markup-import-modal').classList.add('hidden');
        renderEditorQuestions();
        triggerEditorAutosave();
        showModalMsg("Compiled! ⚡", `Successfully compiled and injected ${newQuestions.length} blocks!`);
    };
