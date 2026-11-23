const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const { compileTestSource } = require('../scripts/import-test');

test('compiles Cam 16 Reading Test 2 Part 1 with passage, TFNG Q1-8, and Note Completion Q9-13', () => {
  const sourcePath = path.join(__dirname, '..', 'tests-source', 'cam16-reading-test2.json');
  const source = JSON.parse(fs.readFileSync(sourcePath, 'utf8'));
  const compiled = compileTestSource(source);

  assert.equal(compiled.id, 't_1791805707037_ubm5e');
  assert.equal(compiled.module, 'reading');
  assert.equal(compiled.parts.length, 3);

  const part1 = compiled.parts[0];
  assert.equal(part1.title, 'The White Horse of Uffington');
  assert.ok(part1.text.includes('geoglyphs'), 'Part 1 should preserve the reading passage');
  assert.ok(part1.text.startsWith('<p>'), 'Passage should wrap paragraphs in clean <p> tags');
  assert.ok(!part1.text.includes('margin:0'), 'Passage paragraphs should not override .passage-text p spacing');
  assert.ok((part1.text.match(/<p>/g) || []).length >= 9, 'Passage should preserve all distinct paragraphs');
  assert.equal(part1.questions.length, 9);

  const allIds = part1.questions.flatMap(q => q.ids);
  assert.deepEqual(allIds, [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13]);

  assert.equal(part1.questions[0].type, 'tfng');
  assert.equal(part1.questions[0].correctAnswers[1], 'True');
  assert.equal(part1.questions[1].correctAnswers[2], 'Not Given');
  assert.equal(part1.questions[3].correctAnswers[4], 'False');

  const noteBlock = part1.questions[8];
  assert.equal(noteBlock.type, 'fill_blanks');
  assert.deepEqual(noteBlock.ids, [9, 10, 11, 12, 13]);
  assert.deepEqual(noteBlock.correctAnswers, {
    9: 'Ridgeway',
    10: 'documents',
    11: 'soil',
    12: 'fertility',
    13: 'Rhiannon'
  });
});

test('merges updated part without overwriting existing other parts in Firestore doc', () => {
  const existingDoc = {
    id: 'cam16_reading_test2',
    title: 'Cambridge 16 - Reading Test 2',
    module: 'reading',
    topics: ['History'],
    difficulty: 'Cambridge 16',
    vocab: [{ term: 'geoglyph' }],
    parts: [
      { title: 'Old Part 1', text: 'old', questions: [] },
      { title: 'Existing Part 2', text: 'keep me', questions: [{ blockId: 'b_keep', type: 'tfng', ids: [14], points: 1, correctAnswers: { 14: 'True' } }] },
      { title: 'Reading Passage 3', text: '', questions: [] }
    ]
  };
  const sourcePath = path.join(__dirname, '..', 'tests-source', 'cam16-reading-test2.json');
  const source = JSON.parse(fs.readFileSync(sourcePath, 'utf8'));
  const merged = compileTestSource(source, { existingDoc, onlyPart: 1 });

  assert.equal(merged.parts[0].title, 'The White Horse of Uffington');
  assert.equal(merged.parts[1].title, 'Existing Part 2');
  assert.equal(merged.parts[1].text, 'keep me');
  assert.deepEqual(merged.vocab, [{ term: 'geoglyph' }]);
});

test('compiles Cam 17 Reading Tests 1-4 cleanly with inline gaps, matching_info grid, and footnotes', () => {
  const expectedIds = {
    1: 't_1791805707810_4l0my',
    2: 't_1791805708012_20mow',
    3: 't_1791805708214_ullpq',
    4: 't_1791805708435_d7sbb'
  };

  for (let t = 1; t <= 4; t++) {
    const sourcePath = path.join(__dirname, '..', 'tests-source', `cam17-reading-test${t}.json`);
    const source = JSON.parse(fs.readFileSync(sourcePath, 'utf8'));
    const compiled = compileTestSource(source);

    assert.equal(compiled.id, expectedIds[t]);
    assert.equal(compiled.module, 'reading');
    assert.equal(compiled.parts.length, 3);

    const allIds = compiled.parts.flatMap(part => part.questions.flatMap(q => q.ids));
    assert.deepEqual(allIds, Array.from({ length: 40 }, (_, i) => i + 1));

    compiled.parts.forEach(part => {
      assert.ok(!part.text.includes('margin:0'), `Cam 17 T${t} passage should not contain margin:0`);
      assert.ok(!/<ul>|<li>/.test(part.text), `Cam 17 T${t} passage footnotes should not render as <ul>`);
      part.questions.forEach(q => {
        if (q.type === 'fill_blanks' || q.type === 'dnd_list') {
          assert.ok(!/<\/li>\s*<\/ul>\s*<p[^>]*>\s*\{(?:blank|drop):\d+\}/.test(q.text), `Split list item in Cam 17 T${t} Q${q.ids.join(',')}`);
          assert.ok(!/([^.?!:>])\s*<\/p>\s*<p[^>]*>\s*\{(?:blank|drop):\d+\}/.test(q.text), `Split paragraph before gap in Cam 17 T${t} Q${q.ids.join(',')}`);
          assert.ok(!/\{(?:blank|drop):\d+\}\s*<\/p>\s*<p[^>]*>\s*[a-z,;:.?!]/.test(q.text), `Split paragraph after gap in Cam 17 T${t} Q${q.ids.join(',')}`);
        }
        if (q.type === 'matching_info') {
          q.text.split('\n').forEach((line, idx) => {
            assert.ok(line.startsWith(`<b>${q.ids[idx]}.</b> `), `Matching info item ${q.ids[idx]} missing number prefix`);
          });
        }
      });
    });
  }

  // Specifically verify Test 2 Part 2 Q19-23 Matching Researchers stays reusable matching_info
  const t2 = compileTestSource(JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'tests-source', 'cam17-reading-test2.json'), 'utf8')));
  const q19 = t2.parts[1].questions.find(q => q.ids.includes(19));
  assert.equal(q19.type, 'matching_info');
  assert.equal(q19.reusable, true);

  // Specifically verify Test 4 Part 1 Q7-13 renders as a single intact HTML table
  const t4 = compileTestSource(JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'tests-source', 'cam17-reading-test4.json'), 'utf8')));
  const q7 = t4.parts[0].questions.find(q => q.ids.includes(7));
  assert.equal(q7.type, 'fill_blanks');
  assert.ok(q7.text.includes('<table') && q7.text.includes('{blank:7}') && q7.text.includes('{blank:13}') && !q7.text.includes('| **Method**'), 'Table completion should compile as one complete <table>');
});
