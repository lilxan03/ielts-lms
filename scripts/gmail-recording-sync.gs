/**
 * Google Apps Script (Chạy trực tiếp trên gói Firebase Spark miễn phí):
 * Tự động tìm email báo link recording Google Meet trong Gmail,
 * khớp đúng buổi học trong Firestore (`schedules`) và cập nhật `recordingLink`.
 *
 * Yêu cầu bật scope trong `appsscript.json` (xem docs/recording-automation-setup.md):
 * - https://www.googleapis.com/auth/gmail.modify
 * - https://www.googleapis.com/auth/datastore
 * - https://www.googleapis.com/auth/script.external_request
 */

const FIREBASE_PROJECT_ID = 'khanh-ielts-v2';
const FIRESTORE_DOCUMENTS_URL =
  'https://firestore.googleapis.com/v1/projects/' + FIREBASE_PROJECT_ID + '/databases/(default)/documents';
const TZ_OFFSET_MINUTES = 420; // Asia/Ho_Chi_Minh (UTC+7)

const DEFAULT_GMAIL_QUERY = [
  'newer_than:7d',
  '(from:meetings-noreply@google.com OR from:drive-shares-noreply@google.com OR from:gemini-notes@google.com)',
  '(recording OR "ghi hình" OR "Meet Recordings" OR "drive.google.com/file")',
  '-label:LMS-Recording-Synced',
  '-label:LMS-Recording-Unmatched'
].join(' ');

const LABEL_SYNCED = 'LMS-Recording-Synced';
const LABEL_UNMATCHED = 'LMS-Recording-Unmatched';

function getOrCreateLabel(name) {
  return GmailApp.getUserLabelByName(name) || GmailApp.createLabel(name);
}

function extractDriveRecordingUrl(message) {
  const sources = [message.getBody() || '', message.getPlainBody() || ''];
  const patterns = [
    /https:\/\/drive\.google\.com\/file\/d\/[A-Za-z0-9_-]+(?:\/[^\s"'<>)]*)?/i,
    /https:\/\/drive\.google\.com\/open\?id=[A-Za-z0-9_-]+[^\s"'<>)]*/i,
    /https:\/\/docs\.google\.com\/file\/d\/[A-Za-z0-9_-]+(?:\/[^\s"'<>)]*)?/i
  ];

  for (let i = 0; i < sources.length; i++) {
    for (let j = 0; j < patterns.length; j++) {
      const match = sources[i].match(patterns[j]);
      if (match && match[0]) {
        return match[0].replace(/&amp;/g, '&');
      }
    }
  }
  return '';
}

function normalizeText(value) {
  return String(value == null ? '' : value)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function parseScheduleStartMs(dateStr, timeStr) {
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
  return utcGuess - TZ_OFFSET_MINUTES * 60 * 1000;
}

function scoreTitleMatch(schedule, searchTextNorm) {
  if (!searchTextNorm) return 0;
  let score = 0;

  const classNameNorm = normalizeText(schedule.className);
  if (classNameNorm && classNameNorm.length >= 2 && searchTextNorm.indexOf(classNameNorm) !== -1) {
    score += 1000;
  } else if (classNameNorm) {
    const tokens = classNameNorm.split(' ').filter(function (t) { return t.length >= 2; });
    const matchedTokens = tokens.filter(function (t) { return searchTextNorm.indexOf(t) !== -1; });
    if (tokens.length > 0 && matchedTokens.length === tokens.length) {
      score += 700;
    } else if (matchedTokens.length > 0) {
      score += matchedTokens.length * 150;
    }
  }

  const miniClassNorm = normalizeText(schedule.miniClassName);
  if (miniClassNorm && miniClassNorm.length >= 2 && searchTextNorm.indexOf(miniClassNorm) !== -1) {
    score += 400;
  }

  const topicNorm = normalizeText(schedule.topic);
  if (topicNorm && topicNorm.length >= 3 && searchTextNorm.indexOf(topicNorm) !== -1) {
    score += 300;
  }

  return score;
}

function fetchAllSchedules(oauthToken) {
  const schedules = [];
  let pageToken = '';

  do {
    let url = FIRESTORE_DOCUMENTS_URL + '/schedules?pageSize=300';
    if (pageToken) {
      url += '&pageToken=' + encodeURIComponent(pageToken);
    }

    const res = UrlFetchApp.fetch(url, {
      method: 'get',
      headers: { Authorization: 'Bearer ' + oauthToken },
      muteHttpExceptions: true
    });

    if (res.getResponseCode() !== 200) {
      throw new Error('Firestore list schedules failed (' + res.getResponseCode() + '): ' + res.getContentText());
    }

    const data = JSON.parse(res.getContentText() || '{}');
    const docs = data.documents || [];
    for (let i = 0; i < docs.length; i++) {
      const doc = docs[i];
      const fields = doc.fields || {};
      const id = doc.name.split('/').pop();
      schedules.push({
        id: id,
        className: (fields.className && fields.className.stringValue) || '',
        miniClassName: (fields.miniClassName && fields.miniClassName.stringValue) || '',
        topic: (fields.topic && fields.topic.stringValue) || '',
        date: (fields.date && fields.date.stringValue) || '',
        time: (fields.time && fields.time.stringValue) || '',
        recordingLink: (fields.recordingLink && fields.recordingLink.stringValue) || ''
      });
    }
    pageToken = data.nextPageToken || '';
  } while (pageToken);

  return schedules;
}

function findMatchingSchedule(schedules, recordingLink, subject, recordedAtMs) {
  for (let i = 0; i < schedules.length; i++) {
    if (schedules[i].recordingLink === recordingLink) {
      return { matched: true, alreadySet: true, schedule: schedules[i] };
    }
  }

  const searchTextNorm = normalizeText(subject);
  let best = null;

  for (let i = 0; i < schedules.length; i++) {
    const s = schedules[i];
    if (s.recordingLink) continue;

    const startMs = parseScheduleStartMs(s.date, s.time);
    if (startMs === null) continue;

    const diffHours = (recordedAtMs - startMs) / (60 * 60 * 1000);
    if (diffHours < -1 || diffHours > 24) continue;

    const titleScore = scoreTitleMatch(s, searchTextNorm);
    const timePenalty = diffHours >= 0
      ? Math.abs(diffHours - 1.5) * 15
      : Math.abs(diffHours) * 80 + 100;
    const score = titleScore - timePenalty;

    if (!best || score > best.score) {
      best = { schedule: s, score: score };
    }
  }

  return best
    ? { matched: true, alreadySet: false, schedule: best.schedule }
    : { matched: false };
}

function updateScheduleRecording(oauthToken, scheduleId, recordingLink) {
  const url =
    FIRESTORE_DOCUMENTS_URL +
    '/schedules/' +
    encodeURIComponent(scheduleId) +
    '?updateMask.fieldPaths=recordingLink&updateMask.fieldPaths=recordingSource';

  const res = UrlFetchApp.fetch(url, {
    method: 'patch',
    contentType: 'application/json',
    headers: { Authorization: 'Bearer ' + oauthToken },
    payload: JSON.stringify({
      fields: {
        recordingLink: { stringValue: recordingLink },
        recordingSource: { stringValue: 'gmail_auto' }
      }
    }),
    muteHttpExceptions: true
  });

  if (res.getResponseCode() < 200 || res.getResponseCode() >= 300) {
    throw new Error('Firestore update failed (' + res.getResponseCode() + '): ' + res.getContentText());
  }
}

function syncMeetRecordings() {
  const oauthToken = ScriptApp.getOAuthToken();
  const syncedLabel = getOrCreateLabel(LABEL_SYNCED);
  const unmatchedLabel = getOrCreateLabel(LABEL_UNMATCHED);
  const threads = GmailApp.search(DEFAULT_GMAIL_QUERY, 0, 20);

  if (threads.length === 0) {
    Logger.log('No new Meet recording emails found.');
    return;
  }

  const schedules = fetchAllSchedules(oauthToken);

  for (let i = 0; i < threads.length; i++) {
    const thread = threads[i];
    const messages = thread.getMessages();

    for (let j = 0; j < messages.length; j++) {
      const message = messages[j];
      const recordingLink = extractDriveRecordingUrl(message);
      if (!recordingLink) continue;

      const subject = message.getSubject() || '';
      const recordedAtMs = message.getDate().getTime();
      const match = findMatchingSchedule(schedules, recordingLink, subject, recordedAtMs);

      if (match.matched) {
        if (!match.alreadySet) {
          updateScheduleRecording(oauthToken, match.schedule.id, recordingLink);
          match.schedule.recordingLink = recordingLink;
        }
        thread.addLabel(syncedLabel);
        Logger.log('Synced recording to ' + match.schedule.id + ' (' + match.schedule.className + ')');
      } else {
        thread.addLabel(unmatchedLabel);
        Logger.log('No matching schedule for "' + subject + '"');
      }
      break;
    }
  }
}
