const DEFAULT_TIMEZONE_OFFSET_MINUTES = 420; // Asia/Ho_Chi_Minh (UTC+7)

function normalizeText(value) {
  return String(value == null ? '' : value)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function normalizeRecordingUrl(rawUrl) {
  const trimmed = String(rawUrl || '').trim();
  if (!trimmed || trimmed.length > 2048) return '';
  try {
    const parsed = new URL(trimmed);
    if (parsed.protocol !== 'https:') return '';
    return parsed.toString();
  } catch {
    return '';
  }
}

function parseScheduleStartMs(dateStr, timeStr, tzOffsetMinutes = DEFAULT_TIMEZONE_OFFSET_MINUTES) {
  if (!dateStr || !timeStr) return null;
  const dateMatch = String(dateStr).trim().match(/^(\d{4})-(\d{2})-(\d{2})$/);
  const timeMatch = String(timeStr)
    .trim()
    .match(/^(?:(\d{1,2}):([0-5]\d)\s*(AM|PM)|([01]?\d|2[0-3]):([0-5]\d))$/i);
  if (!dateMatch || !timeMatch) return null;

  const year = Number(dateMatch[1]);
  const month = Number(dateMatch[2]);
  const day = Number(dateMatch[3]);
  let hour = Number(timeMatch[1] || timeMatch[4]);
  const minute = Number(timeMatch[2] || timeMatch[5]);

  if (timeMatch[3]) {
    if (hour < 1 || hour > 12) return null;
    const meridiem = timeMatch[3].toUpperCase();
    if (meridiem === 'PM' && hour < 12) hour += 12;
    if (meridiem === 'AM' && hour === 12) hour = 0;
  }

  const utcGuess = Date.UTC(year, month - 1, day, hour, minute, 0, 0);
  const check = new Date(utcGuess);
  if (
    check.getUTCFullYear() !== year ||
    check.getUTCMonth() !== month - 1 ||
    check.getUTCDate() !== day
  ) {
    return null;
  }

  return utcGuess - tzOffsetMinutes * 60 * 1000;
}

function scoreTitleMatch(schedule, searchTextNorm) {
  if (!searchTextNorm) return 0;
  let score = 0;

  const classNameNorm = normalizeText(schedule.className);
  if (classNameNorm && classNameNorm.length >= 2 && searchTextNorm.includes(classNameNorm)) {
    score += 1000;
  } else if (classNameNorm) {
    const tokens = classNameNorm.split(' ').filter(t => t.length >= 2);
    const matchedTokens = tokens.filter(t => searchTextNorm.includes(t));
    if (tokens.length > 0 && matchedTokens.length === tokens.length) {
      score += 700;
    } else if (matchedTokens.length > 0) {
      score += matchedTokens.length * 150;
    }
  }

  const miniClassNorm = normalizeText(schedule.miniClassName);
  if (miniClassNorm && miniClassNorm.length >= 2 && searchTextNorm.includes(miniClassNorm)) {
    score += 400;
  }

  const topicNorm = normalizeText(schedule.topic);
  if (topicNorm && topicNorm.length >= 3 && searchTextNorm.includes(topicNorm)) {
    score += 300;
  }

  return score;
}

function findMatchingSchedule(schedules, payload = {}) {
  const recordingLink = normalizeRecordingUrl(payload.recordingLink);
  if (!recordingLink) {
    return { matched: false, reason: 'invalid_recording_url' };
  }

  const list = Array.isArray(schedules) ? schedules : [];
  const existingSame = list.find(s => normalizeRecordingUrl(s?.recordingLink) === recordingLink);
  if (existingSame) {
    return { matched: true, alreadySet: true, schedule: existingSame, reason: 'already_linked' };
  }

  const recordedAtMs = payload.recordedAt ? Date.parse(payload.recordedAt) : Date.now();
  const targetMs = Number.isFinite(recordedAtMs) ? recordedAtMs : Date.now();
  const tzOffsetMinutes = Number.isFinite(Number(payload.tzOffsetMinutes))
    ? Number(payload.tzOffsetMinutes)
    : DEFAULT_TIMEZONE_OFFSET_MINUTES;
  const overwrite = Boolean(payload.overwrite);
  const searchTextNorm = normalizeText([payload.subject, payload.meetingTitle].filter(Boolean).join(' '));

  const minDiffHours = -1;
  const maxDiffHours = 24;

  let bestCandidate = null;

  for (const schedule of list) {
    if (!schedule || !schedule.id) continue;
    if (!overwrite && normalizeRecordingUrl(schedule.recordingLink)) continue;

    const startMs = parseScheduleStartMs(schedule.date, schedule.time, tzOffsetMinutes);
    if (startMs === null) continue;

    const diffHours = (targetMs - startMs) / (60 * 60 * 1000);
    if (diffHours < minDiffHours || diffHours > maxDiffHours) continue;

    const titleScore = scoreTitleMatch(schedule, searchTextNorm);
    // Meet recordings usually arrive ~0.5h–3h after class start.
    const timePenalty = diffHours >= 0
      ? Math.abs(diffHours - 1.5) * 15
      : Math.abs(diffHours) * 80 + 100;
    const score = titleScore - timePenalty;

    if (!bestCandidate || score > bestCandidate.score) {
      bestCandidate = { schedule, score, titleScore, diffHours };
    }
  }

  if (!bestCandidate) {
    return { matched: false, reason: 'no_matching_schedule' };
  }

  return {
    matched: true,
    alreadySet: false,
    schedule: bestCandidate.schedule,
    score: bestCandidate.score,
    titleScore: bestCandidate.titleScore,
    diffHours: Number(bestCandidate.diffHours.toFixed(2))
  };
}

module.exports = {
  DEFAULT_TIMEZONE_OFFSET_MINUTES,
  normalizeText,
  normalizeRecordingUrl,
  parseScheduleStartMs,
  findMatchingSchedule
};
