const { onRequest } = require('firebase-functions/v2/https');
const { defineSecret } = require('firebase-functions/params');
const admin = require('firebase-admin');
const OpenAI = require('openai');
const { toFile } = require('openai/uploads');
const { Readable } = require('node:stream');

admin.initializeApp();
const openaiApiKey = defineSecret('OPENAI_API_KEY');

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Access-Control-Allow-Methods': 'POST, OPTIONS'
};

function sendJson(res, status, body) {
  Object.entries(corsHeaders).forEach(([key, value]) => res.set(key, value));
  res.status(status).json(body);
}

function cleanHtml(value) {
  return String(value || '').replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
}

function clampBand(value) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return 0;
  return Math.max(0, Math.min(9, Math.round(parsed * 2) / 2));
}

function normalizeGrade(raw, module) {
  const criteria = module === 'speaking'
    ? ['fluency_coherence', 'lexical_resource', 'grammar', 'pronunciation']
    : ['task_response', 'coherence_cohesion', 'lexical_resource', 'grammar'];
  const scores = {};
  criteria.forEach(key => { scores[key] = clampBand(raw?.scores?.[key]); });
  const validScores = criteria.map(key => scores[key]).filter(score => score > 0);
  const overall = clampBand(raw?.overall || (validScores.length ? validScores.reduce((a, b) => a + b, 0) / validScores.length : 0));
  return {
    overall,
    scores,
    feedback: String(raw?.feedback || '').trim().slice(0, 8000),
    transcript: String(raw?.transcript || '').trim().slice(0, 20000),
    limitations: module === 'speaking'
      ? 'Pronunciation and fluency are estimated from the recording/transcript and should be reviewed by a teacher.'
      : 'This is an AI draft and should be reviewed by a qualified teacher.'
  };
}

const driveAudioCorsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, HEAD, OPTIONS',
  'Access-Control-Allow-Headers': 'Range, Content-Type',
  'Access-Control-Expose-Headers': 'Accept-Ranges, Content-Length, Content-Range, Content-Type',
  'Cache-Control': 'no-store'
};

const audioMimeTypes = {
  aac: 'audio/aac',
  flac: 'audio/flac',
  m4a: 'audio/mp4',
  mp3: 'audio/mpeg',
  mp4: 'audio/mp4',
  oga: 'audio/ogg',
  ogg: 'audio/ogg',
  opus: 'audio/ogg',
  wav: 'audio/wav',
  webm: 'audio/webm'
};

function driveAudioContentType(upstream) {
  const contentType = (upstream.headers.get('content-type') || '').split(';')[0].trim().toLowerCase();
  if (contentType.startsWith('audio/')) return contentType;

  const disposition = upstream.headers.get('content-disposition') || '';
  const encodedName = disposition.match(/filename\*=UTF-8''([^;]+)/i)?.[1];
  const plainName = disposition.match(/filename="?([^";]+)"?/i)?.[1];
  let filename = encodedName || plainName || '';
  try { filename = decodeURIComponent(filename); } catch (error) {}
  const extension = filename.split('.').pop()?.toLowerCase();
  return audioMimeTypes[extension] || contentType || 'application/octet-stream';
}

function getDriveFileDetails(rawUrl) {
  try {
    const url = new URL(String(rawUrl || ''));
    if (url.hostname !== 'drive.google.com' && !url.hostname.endsWith('.drive.google.com')) return null;
    const pathMatch = url.pathname.match(/\/(?:file\/)?d\/([^/]+)/);
    const id = pathMatch?.[1] || url.searchParams.get('id') || '';
    return id ? { id, resourceKey: url.searchParams.get('resourcekey') || '' } : null;
  } catch (error) {
    return null;
  }
}

exports.streamDriveAudio = onRequest({
  cors: true,
  timeoutSeconds: 540,
  memory: '256MiB',
  maxInstances: 5,
  concurrency: 5
}, async (req, res) => {
  Object.entries(driveAudioCorsHeaders).forEach(([key, value]) => res.set(key, value));
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'GET' && req.method !== 'HEAD') return res.status(405).send('GET or HEAD required');

  const fileId = String(req.query.id || '');
  if (!/^[A-Za-z0-9_-]{10,200}$/.test(fileId)) return res.status(400).send('Invalid Google Drive file ID');
  const resourceKey = String(req.query.resourcekey || '');
  if (resourceKey && !/^[A-Za-z0-9_-]{1,200}$/.test(resourceKey)) return res.status(400).send('Invalid Google Drive resource key');
  const testId = String(req.query.testId || '');
  const partIndex = Number(req.query.part);
  if (!testId || testId.length > 150 || testId.includes('/') || !Number.isInteger(partIndex) || partIndex < 0 || partIndex > 49) {
    return res.status(400).send('A valid test ID and part index are required');
  }

  try {
    const testSnapshot = await admin.firestore().collection('tests').doc(testId).get();
    const savedDriveFile = getDriveFileDetails(testSnapshot.data()?.parts?.[partIndex]?.audioUrl);
    if (!savedDriveFile || savedDriveFile.id !== fileId || savedDriveFile.resourceKey !== resourceKey) {
      return res.status(403).send('This Drive file is not attached to the requested test part.');
    }
  } catch (error) {
    console.error('Drive audio authorization check failed:', error);
    return res.status(500).send('Could not verify the audio assigned to this test part.');
  }

  const driveUrl = new URL('https://drive.google.com/uc');
  driveUrl.searchParams.set('export', 'download');
  driveUrl.searchParams.set('id', fileId);
  driveUrl.searchParams.set('confirm', 't');
  if (resourceKey) driveUrl.searchParams.set('resourcekey', resourceKey);
  const requestHeaders = { Accept: 'audio/*, application/octet-stream;q=0.9, */*;q=0.8' };
  const range = req.get('Range');
  if (range) requestHeaders.Range = range;

  const abortController = new AbortController();
  res.on('close', () => {
    if (!res.writableEnded) abortController.abort();
  });

  try {
    const upstream = await fetch(driveUrl, {
      method: req.method,
      headers: requestHeaders,
      redirect: 'follow',
      signal: abortController.signal
    });
    const contentType = driveAudioContentType(upstream);

    if (!upstream.ok) {
      await upstream.body?.cancel();
      return res.status(upstream.status === 404 ? 404 : 502).send('Google Drive did not return the shared audio file.');
    }
    if (contentType === 'text/html' || contentType === 'application/xhtml+xml') {
      await upstream.body?.cancel();
      return res.status(502).send('Google Drive returned a page instead of audio. Check link access and file type.');
    }

    res.status(upstream.status);
    res.set('Content-Type', contentType);
    res.set('Content-Disposition', 'inline');
    ['accept-ranges', 'content-length', 'content-range', 'etag', 'last-modified'].forEach(header => {
      const value = upstream.headers.get(header);
      if (value) res.set(header, value);
    });

    if (req.method === 'HEAD') {
      await upstream.body?.cancel();
      return res.end();
    }
    if (!upstream.body) return res.status(502).end('Google Drive returned an empty response.');

    const audioStream = Readable.fromWeb(upstream.body);
    audioStream.on('error', error => {
      console.error('Drive audio stream error:', error);
      if (!res.headersSent) res.status(502).end('Audio stream failed.');
      else res.destroy(error);
    });
    return audioStream.pipe(res);
  } catch (error) {
    if (error.name !== 'AbortError') console.error('Drive audio proxy error:', error);
    if (!res.headersSent && !res.writableEnded) return res.status(502).send('Could not stream audio from Google Drive.');
  }
});

exports.gradeIELTSSubmission = onRequest({
  secrets: [openaiApiKey],
  timeoutSeconds: 120,
  memory: '512MiB',
  cors: true
}, async (req, res) => {
  if (req.method === 'OPTIONS') return sendJson(res, 204, {});
  if (req.method !== 'POST') return sendJson(res, 405, { error: 'POST required' });

  try {
    const authHeader = req.get('Authorization') || '';
    if (!authHeader.startsWith('Bearer ')) return sendJson(res, 401, { error: 'Authentication required' });
    await admin.auth().verifyIdToken(authHeader.slice(7));

    const body = req.body || {};
    const module = body.module === 'speaking' ? 'speaking' : body.module === 'writing' ? 'writing' : null;
    if (!module) return sendJson(res, 400, { error: 'Only writing and speaking are supported' });

    const client = new OpenAI({ apiKey: openaiApiKey.value() });
    let responseText = cleanHtml(body.responseText);
    let transcript = '';

    if (module === 'speaking') {
      if (!body.audioUrl) return sendJson(res, 400, { error: 'Speaking audio URL is required' });
      const audioResponse = await fetch(body.audioUrl);
      if (!audioResponse.ok) return sendJson(res, 400, { error: 'Could not download speaking audio' });
      const audioBuffer = Buffer.from(await audioResponse.arrayBuffer());
      if (audioBuffer.length > 25 * 1024 * 1024) return sendJson(res, 413, { error: 'Audio file is larger than 25 MB' });
      const audioFile = await toFile(audioBuffer, 'speaking-response.webm');
      const transcription = await client.audio.transcriptions.create({
        file: audioFile,
        model: 'whisper-1',
        response_format: 'text'
      });
      transcript = String(transcription || '').trim();
      responseText = transcript;
    }

    if (!responseText) return sendJson(res, 400, { error: 'No response content found' });
    const rubric = module === 'speaking'
      ? 'fluency_coherence, lexical_resource, grammar, pronunciation'
      : 'task_response, coherence_cohesion, lexical_resource, grammar';
    const prompt = `You are an IELTS examiner producing a cautious draft assessment. Grade this ${module} response using IELTS band descriptors. Return JSON only with this shape: {"overall": number, "scores": {${rubric.split(', ').map(key => `"${key}": number`).join(', ')}}, "feedback": string}. Use only half-band increments from 0 to 9. Explain evidence and weaknesses briefly. Do not claim this is an official score.\n\nTask prompt: ${cleanHtml(body.prompt)}\n\nResponse: ${responseText}`;
    const completion = await client.chat.completions.create({
      model: 'gpt-4o-mini',
      temperature: 0.2,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: 'You grade IELTS responses conservatively and return valid JSON only.' },
        { role: 'user', content: prompt }
      ]
    });
    const raw = JSON.parse(completion.choices[0]?.message?.content || '{}');
    return sendJson(res, 200, normalizeGrade({ ...raw, transcript }, module));
  } catch (error) {
    console.error('IELTS grading error:', error);
    return sendJson(res, 500, { error: 'AI grading failed' });
  }
});