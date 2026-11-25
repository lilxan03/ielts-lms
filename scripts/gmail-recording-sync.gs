/**
 * Google Apps Script: Tự động lấy link recording Google Meet từ Gmail
 * và gửi về Firebase Cloud Function `ingestClassRecording` để gắn vào buổi học trên LMS.
 *
 * Cấu hình trong Project Settings -> Script Properties:
 * - WEBHOOK_URL     : URL của Cloud Function `ingestClassRecording`
 * - WEBHOOK_SECRET  : Giá trị secret `RECORDING_WEBHOOK_SECRET` đã đặt trên Firebase
 * - GMAIL_QUERY     : (Tùy chọn) Bộ lọc tìm email recording
 */

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

  for (const content of sources) {
    for (const pattern of patterns) {
      const match = content.match(pattern);
      if (match && match[0]) {
        return match[0].replace(/&amp;/g, '&');
      }
    }
  }
  return '';
}

function syncMeetRecordings() {
  const props = PropertiesService.getScriptProperties();
  const webhookUrl = (props.getProperty('WEBHOOK_URL') || '').trim();
  const webhookSecret = (props.getProperty('WEBHOOK_SECRET') || '').trim();
  const query = (props.getProperty('GMAIL_QUERY') || DEFAULT_GMAIL_QUERY).trim();

  if (!webhookUrl || !webhookSecret) {
    throw new Error('Missing WEBHOOK_URL or WEBHOOK_SECRET in Script Properties.');
  }

  const syncedLabel = getOrCreateLabel(LABEL_SYNCED);
  const unmatchedLabel = getOrCreateLabel(LABEL_UNMATCHED);
  const threads = GmailApp.search(query, 0, 20);

  for (const thread of threads) {
    const messages = thread.getMessages();
    let threadHandled = false;

    for (const message of messages) {
      const recordingLink = extractDriveRecordingUrl(message);
      if (!recordingLink) continue;

      const payload = {
        recordingLink: recordingLink,
        subject: message.getSubject() || '',
        recordedAt: message.getDate().toISOString()
      };

      const response = UrlFetchApp.fetch(webhookUrl, {
        method: 'post',
        contentType: 'application/json',
        headers: {
          'x-webhook-secret': webhookSecret
        },
        payload: JSON.stringify(payload),
        muteHttpExceptions: true
      });

      const status = response.getResponseCode();
      const bodyText = response.getContentText() || '{}';
      if (status < 200 || status >= 300) {
        Logger.log('Webhook error (' + status + '): ' + bodyText);
        continue;
      }

      const result = JSON.parse(bodyText);
      if (result.matched) {
        thread.addLabel(syncedLabel);
        Logger.log('Synced recording to schedule ' + result.scheduleId + ' (' + result.className + ')');
      } else {
        thread.addLabel(unmatchedLabel);
        Logger.log('No matching schedule for "' + payload.subject + '": ' + (result.reason || 'unknown'));
      }
      threadHandled = true;
      break;
    }

    if (!threadHandled) {
      Logger.log('No Drive recording link found in thread: ' + thread.getFirstMessageSubject());
    }
  }
}
