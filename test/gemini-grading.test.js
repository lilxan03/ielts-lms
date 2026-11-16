const assert = require('node:assert/strict');
const test = require('node:test');
const {
  GEMINI_MODEL,
  buildGradingPrompt,
  buildGenerateContentBody,
  getAllowedStorageUrl,
  normalizeMediaMimeType,
  parseInlineAudioDataUrl,
  parseGeminiResponse
} = require('../lib/gemini-grading');

test('builds IELTS Writing prompts for task response and visual evidence', () => {
  const prompt = buildGradingPrompt('writing', 'Task 1: Describe the chart. Chart data: [{"labels":["A","B"]}]', 'The chart shows...');
  assert.match(prompt, /Task 1/);
  assert.match(prompt, /chart, diagram, map, process/);
  assert.match(prompt, /do not invent visual data/i);
  assert.match(prompt, /"task_response": number/);
  assert.match(prompt, /Candidate response:\nThe chart shows/);
});

test('builds Speaking prompts that assess and transcribe the audio', () => {
  const prompt = buildGradingPrompt('speaking', 'Describe your hometown.');
  assert.match(prompt, /assess the supplied recording directly/i);
  assert.match(prompt, /transcribe the candidate’s spoken response faithfully/i);
  assert.match(prompt, /"pronunciation": number/);
  assert.match(prompt, /"transcript": string/);
});

test('builds Gemini JSON generation requests with optional media parts', () => {
  const media = { inlineData: { mimeType: 'audio/webm', data: 'YXVkaW8=' } };
  const body = buildGenerateContentBody('Assess this recording', [media]);
  assert.equal(GEMINI_MODEL, 'gemini-3.6-flash');
  assert.deepEqual(body.contents[0].parts, [{ text: 'Assess this recording' }, media]);
  assert.equal(body.generationConfig.responseMimeType, 'application/json');
  assert.equal(body.generationConfig.temperature, 0.2);
});

test('parses Gemini JSON assessments and rejects empty or malformed output', () => {
  assert.deepEqual(parseGeminiResponse({
    candidates: [{ content: { parts: [{ text: '{"overall":7,"scores":{"grammar":7}}' }] } }]
  }), { overall: 7, scores: { grammar: 7 } });
  assert.throws(() => parseGeminiResponse({ candidates: [] }), /empty assessment/);
  assert.throws(() => parseGeminiResponse({
    candidates: [{ content: { parts: [{ text: 'not JSON' }] } }]
  }), /invalid assessment format/);
});

test('only allows HTTPS media URLs from Firebase or Google Cloud Storage', () => {
  assert.equal(getAllowedStorageUrl('https://firebasestorage.googleapis.com/v0/b/test/o/audio.webm').hostname, 'firebasestorage.googleapis.com');
  assert.equal(getAllowedStorageUrl('https://storage.googleapis.com/test/audio.webm').hostname, 'storage.googleapis.com');
  assert.equal(getAllowedStorageUrl('http://firebasestorage.googleapis.com/audio.webm'), null);
  assert.equal(getAllowedStorageUrl('https://example.com/audio.webm'), null);
  assert.equal(getAllowedStorageUrl('http://127.0.0.1/secret'), null);
});

test('normalizes supported Gemini media MIME types and rejects unsupported formats', () => {
  const audioUrl = new URL('https://firebasestorage.googleapis.com/audio.webm');
  const imageUrl = new URL('https://firebasestorage.googleapis.com/chart.png');
  assert.equal(normalizeMediaMimeType('audio/webm; codecs=opus', audioUrl, 'audio'), 'audio/webm');
  assert.equal(normalizeMediaMimeType('audio/mpeg', audioUrl, 'audio'), 'audio/mp3');
  assert.equal(normalizeMediaMimeType('application/octet-stream', audioUrl, 'audio'), 'audio/webm');
  assert.equal(normalizeMediaMimeType('image/png', imageUrl, 'image'), 'image/png');
  assert.equal(normalizeMediaMimeType('image/gif', imageUrl, 'image'), null);
});

test('parses the app’s inline Speaking recordings without accepting malformed data URLs', () => {
  const result = parseInlineAudioDataUrl('data:audio/webm;codecs=opus;base64,YXVkaW8=');
  assert.equal(result.mimeType, 'audio/webm');
  assert.equal(result.buffer.toString(), 'audio');
  assert.equal(parseInlineAudioDataUrl('data:text/html;base64,PHNjcmlwdD4='), null);
  assert.equal(parseInlineAudioDataUrl('data:audio/webm;base64,%%%'), null);
});
