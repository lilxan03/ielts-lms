#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');
const crypto = require('crypto');

const ROOT_DIR = path.resolve(__dirname, '..');
const LATEX_IMPORT_PATH = path.join(ROOT_DIR, 'js', 'latex-import.js');
const FIREBASERC_PATH = path.join(ROOT_DIR, '.firebaserc');

function loadLatexRuntime() {
  const code = fs.readFileSync(LATEX_IMPORT_PATH, 'utf8');
  const sandbox = {
    window: {},
    console,
    Math,
    Date,
    RegExp,
    Array,
    Object,
    Set,
    Map,
    Number,
    String,
    Boolean,
    JSON,
    Error,
    parseInt,
    parseFloat,
    isNaN,
    isFinite
  };
  sandbox.globalThis = sandbox;
  vm.runInNewContext(code, sandbox, { filename: 'js/latex-import.js' });
  if (typeof sandbox.window.parseIeltsLatex !== 'function' || typeof sandbox.window.formatIELTSLatexImportText !== 'function') {
    throw new Error('Could not initialize parseIeltsLatex from js/latex-import.js');
  }
  return sandbox.window;
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, char => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
  })[char]);
}

function makeBlockId(seed) {
  const hash = crypto.createHash('sha1').update(String(seed)).digest('hex').slice(0, 10);
  return `b_${hash}`;
}

function getDefaultParts(moduleName) {
  const mod = String(moduleName || 'reading').toLowerCase();
  if (mod === 'listening') {
    return [1, 2, 3, 4].map(n => ({ title: `Part ${n}`, text: '', audioUrl: '', questions: [] }));
  }
  if (mod === 'writing') {
    return [
      { title: 'Task 1', text: '', writingTask: 'task1', questions: [] },
      { title: 'Task 2', text: '', writingTask: 'task2', questions: [] }
    ];
  }
  if (mod === 'speaking') {
    return [1, 2, 3].map(n => ({ title: `Part ${n}`, text: '', speakingQuestions: '', questions: [] }));
  }
  return [1, 2, 3].map(n => ({ title: `Reading Passage ${n}`, text: '', questions: [] }));
}

function compileQuestionGroup(latexSource, runtime, idState, seedPrefix) {
  const parsed = runtime.parseIeltsLatex(latexSource);
  const formatText = value => {
    if (value === null || value === undefined) return '';
    const raw = String(value).replace(/\r\n/g, '\n').trim();
    if (!raw) return '';
    return runtime.formatIELTSLatexImportText(escapeHtml(raw));
  };

  const allocateIds = (count, declared = null) => {
    if (Array.isArray(declared) && declared.length === count) {
      declared.forEach(id => {
        if (idState.usedIds.has(id)) {
          throw new Error(`Duplicate question number ${id} in ${seedPrefix}`);
        }
        idState.usedIds.add(id);
      });
      idState.nextId = Math.max(idState.nextId, ...declared) + 1;
      return [...declared];
    }
    return Array.from({ length: count }, () => {
      while (idState.usedIds.has(idState.nextId)) idState.nextId++;
      const id = idState.nextId++;
      idState.usedIds.add(id);
      return id;
    });
  };

  const blocks = [];
  const groupIsYesNo = parsed.questions.some(
    q => q.type === 'tfng' && (q.answer === 'YES' || q.answer === 'NO')
  );
  const isExplicitMatchingInfo = /\\matchinginfo\b/.test(latexSource) && !/\\matchingstatements\b/.test(latexSource);
  parsed.questions.forEach((question, qIndex) => {
    const blockSeed = `${seedPrefix}_${qIndex}_${question.type}`;

    if (question.type === 'fill_blanks' || question.type === 'dnd_list') {
      const ids = allocateIds(question.gaps.length, question.questionNumbers);
      const gapIds = Object.fromEntries(question.gaps.map((gap, index) => [gap.id, ids[index]]));
      const marker = question.type === 'dnd_list' ? 'drop' : 'blank';
      const rawGapText = question.text.replace(/\{(?:blank|drop):(\d+)\}/g, (_, id) => `{${marker}:${gapIds[id]}}`);
      const text = rawGapText.replace(/([^\n])\n(\{(?:blank|drop):\d+\})/g, (match, before, token) => (
        /^\s*\*\*[^*]+\*\*\s*$/.test(before) ? match : `${before} ${token}`
      ));
      const correctAnswers = {};
      const timestamps = {};
      const dropOptions = Array.isArray(question.options) ? question.options : [];
      const dropOptionByLabel = new Map(dropOptions.map(option => {
        const match = String(option).match(/^\s*([A-Z])(?:[.)\-]|\s)\s*(.+)$/i);
        return match ? [match[1].toUpperCase(), option] : null;
      }).filter(Boolean));
      const resolveDropAnswer = answer => {
        const value = String(answer || '').trim();
        const label = value.match(/^([A-Z])(?:[.)])?$/i)?.[1]?.toUpperCase();
        return label ? (dropOptionByLabel.get(label) || value) : value;
      };
      question.gaps.forEach(gap => {
        const id = gapIds[gap.id];
        const answers = [gap.answer, ...gap.alternatives].map(answer =>
          question.type === 'dnd_list' ? resolveDropAnswer(answer) : answer);
        correctAnswers[id] = [...new Set(answers)].join('/');
        if (gap.time !== null && gap.time !== undefined) timestamps[id] = gap.time;
      });
      const options = question.type === 'dnd_list'
        ? [...new Set(dropOptions.length
          ? dropOptions
          : question.gaps.flatMap(gap => [gap.answer, ...gap.alternatives]).map(resolveDropAnswer))]
        : [];
      const formattedGapText = formatText(text)
        .replace(/([^.?!:>])\s*<\/p>\s*<p(?:\s+style="margin:0")?>\s*(\{(?:blank|drop):\d+\})/g, '$1 $2')
        .replace(/(\{(?:blank|drop):\d+\})\s*<\/p>\s*<p(?:\s+style="margin:0")?>\s*([a-z,;:.?!])/g, '$1 $2')
        .replace(/<\/li>\s*<\/ul>\s*<p(?:\s+style="margin:0")?>\s*(\{(?:blank|drop):\d+\}[^<]*(?:<(?!\/p>)[^<]*)*)<\/p>/g, ' $1</li></ul>')
        .replace(/<\/ul>\s*<ul(?:\s+style="margin:0;padding-left:1\.25rem")?>/g, '');
      const block = {
        blockId: makeBlockId(`${blockSeed}_${ids.join(',')}`),
        type: question.type,
        ids,
        points: ids.length,
        instruction: formatText(question.instruction || (question.type === 'dnd_list' ? 'Complete the sentences using the options.' : 'Fill in the blanks.')),
        text: formattedGapText,
        options,
        correctAnswers,
        reusable: false,
        ...(question.type === 'dnd_list' ? { latexSource: true } : {})
      };
      if (Object.keys(timestamps).length) block.timestamps = timestamps;
      blocks.push(block);
      return;
    }

    if (question.type === 'matching_statements' && !isExplicitMatchingInfo) {
      const ids = allocateIds(question.items.length, question.questionNumbers);
      const correctAnswers = {};
      const text = question.items.map((item, index) => {
        correctAnswers[ids[index]] = item.answer;
        return `${ids[index]}. ${item.text} {drop:${ids[index]}}`;
      }).join('\n');
      blocks.push({
        blockId: makeBlockId(`${blockSeed}_${ids.join(',')}`),
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
      blocks.push({
        blockId: makeBlockId(`${blockSeed}_${ids.join(',')}`),
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

    if (question.type === 'mcq') {
      const ids = allocateIds(question.selectCount || 1, question.questionNumbers);
      const options = question.options.map(option => option.text);
      const correctAnswers = {};
      question.options.filter(option => option.correct).forEach((option, index) => {
        correctAnswers[ids[index]] = option.text;
      });
      blocks.push({
        blockId: makeBlockId(`${blockSeed}_${ids.join(',')}`),
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
      return;
    }

    if (question.type === 'tfng') {
      const id = allocateIds(1, question.questionNumbers)[0];
      const isYesNo = groupIsYesNo || question.answer === 'YES' || question.answer === 'NO';
      const answer = question.answer === 'TRUE' ? 'True'
        : question.answer === 'FALSE' ? 'False'
        : question.answer === 'YES' ? 'Yes'
        : question.answer === 'NO' ? 'No'
        : 'Not Given';
      blocks.push({
        blockId: makeBlockId(`${blockSeed}_${id}`),
        type: isYesNo ? 'ynng' : 'tfng',
        ids: [id],
        points: 1,
        instruction: isYesNo ? 'Do the statements agree with the claims?' : 'Do the statements agree with the information?',
        text: formatText(question.statement),
        options: isYesNo ? ['Yes', 'No', 'Not Given'] : ['True', 'False', 'Not Given'],
        correctAnswers: { [id]: answer },
        explanation: formatText(question.explanation || '')
      });
      return;
    }

    if (question.type === 'matching_headings' || question.type === 'matching_info' || (question.type === 'matching_statements' && isExplicitMatchingInfo) || question.type === 'map_labelling_grid') {
      const resolvedType = question.type === 'matching_statements' ? 'matching_info' : question.type;
      const ids = allocateIds(question.items.length, question.questionNumbers);
      const text = resolvedType === 'matching_headings'
        ? ''
        : resolvedType === 'matching_info'
          ? question.items.map((item, index) => `<b>${ids[index]}.</b> ${escapeHtml(item.text)}`).join('\n')
          : question.items.map(item => escapeHtml(item.text)).join('\n');
      const correctAnswers = {};
      question.items.forEach((item, index) => { correctAnswers[ids[index]] = item.answer; });
      const block = {
        blockId: makeBlockId(`${blockSeed}_${ids.join(',')}`),
        type: resolvedType,
        ids,
        points: ids.length,
        instruction: formatText(question.instruction),
        text,
        options: question.options,
        correctAnswers,
        reusable: resolvedType === 'matching_headings' ? false : true,
        latexSource: true,
        ...(resolvedType === 'map_labelling_grid' ? { image: question.image } : {})
      };
      if (resolvedType === 'matching_headings') {
        block._headingItems = question.items.map((item, index) => ({
          id: ids[index],
          label: item.text
        }));
      }
      blocks.push(block);
      return;
    }

    if (question.type === 'map_labelling_hotspots') {
      const ids = allocateIds(question.hotspots.length, question.questionNumbers);
      const correctAnswers = {};
      question.hotspots.forEach((hotspot, index) => { correctAnswers[ids[index]] = hotspot.answer; });
      blocks.push({
        blockId: makeBlockId(`${blockSeed}_${ids.join(',')}`),
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
      return;
    }

    if (question.type === 'essay') {
      const id = allocateIds(1, question.questionNumbers)[0];
      blocks.push({
        blockId: makeBlockId(`${blockSeed}_${id}`),
        type: 'essay',
        ids: [id],
        points: 1,
        instruction: formatText(question.instruction),
        text: formatText(question.text || ''),
        options: [],
        correctAnswers: {}
      });
      return;
    }

    if (question.type === 'audio_record') {
      const id = allocateIds(1, question.questionNumbers)[0];
      blocks.push({
        blockId: makeBlockId(`${blockSeed}_${id}`),
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

  return { parsed, blocks };
}

function formatPassageHtml(value, runtime) {
  if (value === null || value === undefined) return '';
  const raw = String(value).replace(/\r\n/g, '\n').trim();
  if (!raw) return '';
  let inFootnotes = false;
  return raw
    .split(/\n{2,}/)
    .map(block => block.trim())
    .filter(Boolean)
    .map(block => {
      if (/^-{3,}$/.test(block)) {
        inFootnotes = true;
        return '<hr style="margin:1.25rem 0;border:0;border-top:1px solid rgba(148,163,184,0.35);">';
      }
      if (inFootnotes && /^\*{1,2}\s*\S/m.test(block)) {
        return block
          .split('\n')
          .map(line => line.trim())
          .filter(Boolean)
          .map(line => `<p>${escapeHtml(line)}</p>`)
          .join('');
      }
      const rendered = runtime
        .formatIELTSLatexImportText(escapeHtml(block))
        .replace(/<p\s+style="margin:0">/g, '<p>');
      return rendered;
    })
    .join('');
}

function compilePart(partSource, moduleName, runtime, idState, testId) {
  const partNumber = Number(partSource.partNumber || 1);
  const formatText = value => {
    if (value === null || value === undefined) return '';
    const raw = String(value).replace(/\r\n/g, '\n').trim();
    if (!raw) return '';
    return runtime.formatIELTSLatexImportText(escapeHtml(raw));
  };

  const part = {
    title: partSource.title ? String(partSource.title).trim() : (moduleName === 'reading' ? `Reading Passage ${partNumber}` : `Part ${partNumber}`),
    text: partSource.passageHtml
      ? String(partSource.passageHtml)
      : (partSource.passage ? formatPassageHtml(partSource.passage, runtime) : ''),
    questions: []
  };

  if (partSource.audioUrl) part.audioUrl = String(partSource.audioUrl).trim();
  if (partSource.writingTask) part.writingTask = String(partSource.writingTask).trim();
  if (partSource.speakingQuestions) part.speakingQuestions = formatText(partSource.speakingQuestions);

  const groups = Array.isArray(partSource.questionGroups)
    ? partSource.questionGroups
    : (partSource.latex ? [partSource.latex] : []);

  groups.forEach((group, groupIndex) => {
    const latex = typeof group === 'string' ? group : String(group?.latex || '');
    if (!latex.trim()) return;
    const { parsed, blocks } = compileQuestionGroup(
      latex,
      runtime,
      idState,
      `${testId}_p${partNumber}_g${groupIndex}`
    );
    if (!part.audioUrl && parsed.audioUrl) part.audioUrl = parsed.audioUrl;
    if (!part.writingTask && parsed.writingTask) part.writingTask = parsed.writingTask;
    if (!part.speakingQuestions && parsed.hasSpeaking) {
      part.speakingQuestions = formatText(parsed.speakingQuestions);
    }
    if (!part.text && !parsed.gapCount && parsed.passage.text.trim()) {
      part.text = formatPassageHtml(parsed.passage.text, runtime);
      if (parsed.passage.title && !partSource.title) {
        part.title = escapeHtml(parsed.passage.title);
      }
    }
    part.questions.push(...blocks);
  });

  part.questions = part.questions
    .map((question, index) => ({
      question,
      index,
      firstId: Array.isArray(question?.ids) && question.ids.length
        ? Math.min(...question.ids.map(Number).filter(Number.isFinite))
        : Number.MAX_SAFE_INTEGER
    }))
    .sort((a, b) => a.firstId - b.firstId || a.index - b.index)
    .map(item => item.question);

  // Inject {drop:ID} above matching paragraph/section headings in part.text for matching_headings
  part.questions.forEach(q => {
    if (q.type === 'matching_headings' && Array.isArray(q._headingItems)) {
      q._headingItems.forEach(({ id, label }) => {
        if (part.text.includes(`{drop:${id}}`)) return;
        const m = String(label || '').match(/(?:Section|Paragraph)\s+([A-Z])\b/i);
        if (m) {
          const letter = m[1].toUpperCase();
          const secRe = new RegExp(`(<p>\\s*(?:<strong>|<b>)${letter}(?:</strong>|</b>))`);
          if (secRe.test(part.text)) {
            part.text = part.text.replace(secRe, `<p><strong>Question ${id}</strong> {drop:${id}}</p>$1`);
          }
        }
      });
      delete q._headingItems;
    }
  });

  return { partNumber, part };
}

function compileTestSource(source, options = {}) {
  if (!source || typeof source !== 'object') {
    throw new Error('Test source must be a JSON object');
  }
  const id = String(source.id || '').trim();
  const title = String(source.title || '').trim();
  const moduleName = String(source.module || 'reading').trim().toLowerCase();
  if (!id) throw new Error('Test source requires a non-empty "id"');
  if (!title) throw new Error('Test source requires a non-empty "title"');
  if (!['reading', 'listening', 'writing', 'speaking'].includes(moduleName)) {
    throw new Error(`Unsupported module "${moduleName}"`);
  }

  const runtime = options.runtime || loadLatexRuntime();
  const existingDoc = options.existingDoc || null;
  const onlyPart = options.onlyPart ? Number(options.onlyPart) : null;

  const baseParts = Array.isArray(existingDoc?.parts) && existingDoc.parts.length
    ? existingDoc.parts.map(p => JSON.parse(JSON.stringify(p)))
    : getDefaultParts(moduleName);

  const sourceParts = Array.isArray(source.parts) ? source.parts : [];
  const targetSourceParts = onlyPart
    ? sourceParts.filter(p => Number(p.partNumber) === onlyPart)
    : sourceParts;

  if (!targetSourceParts.length) {
    throw new Error(onlyPart ? `Part ${onlyPart} not found in source file` : 'No parts defined in source file');
  }

  const replacingIndices = new Set(targetSourceParts.map(p => Math.max(0, Number(p.partNumber || 1) - 1)));
  const usedIds = new Set();
  baseParts.forEach((part, idx) => {
    if (replacingIndices.has(idx)) return;
    (part?.questions || []).forEach(q => {
      (q?.ids || []).forEach(num => usedIds.add(Number(num)));
    });
  });
  const idState = {
    usedIds,
    nextId: Math.max(0, ...usedIds) + 1
  };

  targetSourceParts.forEach(partSource => {
    const { partNumber, part } = compilePart(partSource, moduleName, runtime, idState, id);
    const partIndex = Math.max(0, partNumber - 1);
    while (baseParts.length <= partIndex) {
      baseParts.push({
        title: moduleName === 'reading' ? `Reading Passage ${baseParts.length + 1}` : `Part ${baseParts.length + 1}`,
        text: '',
        questions: []
      });
    }
    baseParts[partIndex] = part;
  });

  const testDoc = {
    ...(existingDoc || {}),
    id,
    title,
    module: moduleName,
    topics: Array.isArray(source.topics) ? source.topics : (existingDoc?.topics || []),
    difficulty: source.difficulty !== undefined ? String(source.difficulty) : (existingDoc?.difficulty || ''),
    parts: baseParts,
    vocab: Array.isArray(source.vocab) ? source.vocab : (existingDoc?.vocab || [])
  };

  if (Array.isArray(source.grammar)) testDoc.grammar = source.grammar;
  return testDoc;
}

function getDefaultProjectId() {
  if (process.env.FIREBASE_PROJECT_ID) return process.env.FIREBASE_PROJECT_ID;
  if (fs.existsSync(FIREBASERC_PATH)) {
    try {
      const rc = JSON.parse(fs.readFileSync(FIREBASERC_PATH, 'utf8'));
      if (rc?.projects?.default) return rc.projects.default;
    } catch (_) {}
  }
  return 'khanh-ielts-v2';
}

function findServiceAccountPath() {
  if (process.env.GOOGLE_APPLICATION_CREDENTIALS && fs.existsSync(process.env.GOOGLE_APPLICATION_CREDENTIALS)) {
    return process.env.GOOGLE_APPLICATION_CREDENTIALS;
  }
  const adminDir = path.join(ROOT_DIR, 'firebaseadmin');
  if (fs.existsSync(adminDir) && fs.statSync(adminDir).isDirectory()) {
    const preferred = path.join(adminDir, 'serviceAccountKey.json');
    if (fs.existsSync(preferred)) return preferred;
    const anyJson = fs.readdirSync(adminDir).find(name => name.endsWith('.json'));
    if (anyJson) return path.join(adminDir, anyJson);
  }
  const rootMatch = fs.readdirSync(ROOT_DIR).find(name => /serviceAccount.*\.json$/i.test(name));
  if (rootMatch) return path.join(ROOT_DIR, rootMatch);
  return null;
}

function initFirestore() {
  const admin = require('firebase-admin');
  if (!admin.apps.length) {
    const projectId = getDefaultProjectId();
    const keyPath = findServiceAccountPath();
    if (keyPath) {
      const serviceAccount = JSON.parse(fs.readFileSync(keyPath, 'utf8'));
      admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
        projectId: serviceAccount.project_id || projectId
      });
    } else {
      admin.initializeApp({ projectId });
    }
  }
  return admin.firestore();
}

function summarizeTest(testDoc) {
  const partSummaries = testDoc.parts.map((part, index) => {
    const ids = (part.questions || []).flatMap(q => q.ids || []);
    const range = ids.length ? `Q${Math.min(...ids)}–Q${Math.max(...ids)} (${ids.length} câu)` : '0 câu';
    const blocks = (part.questions || []).length;
    const passageStatus = part.text ? `passage ${part.text.length} ký tự` : 'chưa có passage';
    return `  • Part ${index + 1} (${part.title}): ${passageStatus}, ${blocks} block, ${range}`;
  });
  return [
    `Test: ${testDoc.title} [${testDoc.id}] (${testDoc.module})`,
    ...partSummaries
  ].join('\n');
}

async function importTestFile(filePath, options = {}) {
  const absolutePath = path.resolve(filePath);
  const raw = JSON.parse(fs.readFileSync(absolutePath, 'utf8'));
  const runtime = options.runtime || loadLatexRuntime();

  if (options.dryRun) {
    const compiled = compileTestSource(raw, { runtime, onlyPart: options.onlyPart });
    console.log('[DRY RUN] Biên dịch thành công:\n' + summarizeTest(compiled));
    return compiled;
  }

  let db;
  try {
    db = initFirestore();
  } catch (err) {
    throw new Error(`Không thể khởi tạo Firebase Admin: ${err.message}`);
  }

  const docRef = db.collection('tests').doc(raw.id);
  let existingDoc = null;
  try {
    const snap = await docRef.get();
    if (snap.exists) existingDoc = snap.data();
  } catch (err) {
    if (/Could not load the default credentials|credential/i.test(err.message)) {
      const help = [
        'Chưa tìm thấy khóa Firebase Admin (Service Account) để ghi vào Firestore.',
        'Cách thiết lập 1 lần duy nhất (đã được .gitignore bảo vệ, không bị push lên Git):',
        '  1. Mở Firebase Console -> Project Settings -> Service accounts -> Generate new private key.',
        '  2. Lưu file JSON vào: firebaseadmin/serviceAccountKey.json',
        '  3. Chạy lại lệnh: npm run import:test -- ' + path.relative(ROOT_DIR, absolutePath)
      ].join('\n');
      throw new Error(help);
    }
    throw err;
  }

  const compiled = compileTestSource(raw, {
    runtime,
    existingDoc,
    onlyPart: options.onlyPart
  });

  await docRef.set(compiled);
  console.log(`${existingDoc ? '[UPDATED]' : '[CREATED]'} Đã nhập lên Firestore (tests/${compiled.id}):\n${summarizeTest(compiled)}`);
  return compiled;
}

async function main() {
  const args = process.argv.slice(2);
  let dryRun = false;
  let all = false;
  let onlyPart = null;
  const files = [];

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === '--dry-run') dryRun = true;
    else if (arg === '--all') all = true;
    else if (arg === '--part' && args[i + 1]) onlyPart = Number(args[++i]);
    else if (!arg.startsWith('-')) files.push(arg);
  }

  if (all) {
    const dir = path.join(ROOT_DIR, 'tests-source');
    if (fs.existsSync(dir)) {
      fs.readdirSync(dir)
        .filter(name => name.endsWith('.json'))
        .sort()
        .forEach(name => files.push(path.join(dir, name)));
    }
  }

  if (!files.length) {
    console.log('Cách dùng:\n  node scripts/import-test.js <file.json> [--part N] [--dry-run]\n  node scripts/import-test.js --all [--dry-run]');
    process.exit(1);
  }

  const runtime = loadLatexRuntime();
  for (const file of files) {
    await importTestFile(file, { dryRun, onlyPart, runtime });
  }
}

if (require.main === module) {
  main().catch(err => {
    console.error('\n❌ Import thất bại:\n' + err.message);
    process.exit(1);
  });
}

module.exports = {
  loadLatexRuntime,
  compileTestSource,
  findServiceAccountPath,
  importTestFile
};
