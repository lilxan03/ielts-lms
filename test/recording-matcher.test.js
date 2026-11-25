const test = require('node:test');
const assert = require('node:assert/strict');
const {
  normalizeRecordingUrl,
  parseScheduleStartMs,
  findMatchingSchedule
} = require('../recording-matcher');

test('normalizeRecordingUrl accepts valid https URLs and rejects unsafe schemes', () => {
  assert.equal(
    normalizeRecordingUrl('  https://drive.google.com/file/d/abc123/view  '),
    'https://drive.google.com/file/d/abc123/view'
  );
  assert.equal(normalizeRecordingUrl('http://drive.google.com/file/d/abc123/view'), '');
  assert.equal(normalizeRecordingUrl('javascript:alert(1)'), '');
  assert.equal(normalizeRecordingUrl(''), '');
});

test('parseScheduleStartMs converts Asia/Ho_Chi_Minh date and 12h/24h time to UTC ms', () => {
  // 2026-11-25 19:30 GMT+7 == 2026-11-25 12:30 UTC
  const expectedUtc = Date.UTC(2026, 10, 25, 12, 30, 0, 0);
  assert.equal(parseScheduleStartMs('2026-11-25', '7:30 PM'), expectedUtc);
  assert.equal(parseScheduleStartMs('2026-11-25', '19:30'), expectedUtc);
  assert.equal(parseScheduleStartMs('2026-11-25', '12:00 AM'), Date.UTC(2026, 10, 24, 17, 0, 0, 0));
  assert.equal(parseScheduleStartMs('2026-02-30', '7:30 PM'), null);
});

test('findMatchingSchedule prefers class name match in email subject when multiple classes run on the same day', () => {
  const schedules = [
    {
      id: 'sch_1',
      className: 'IELTS 6.5 Evening',
      topic: 'Speaking Part 2',
      date: '2026-11-25',
      time: '7:30 PM',
      recordingLink: ''
    },
    {
      id: 'sch_2',
      className: 'Foundation A',
      topic: 'Grammar',
      date: '2026-11-25',
      time: '7:30 PM',
      recordingLink: ''
    }
  ];

  const result = findMatchingSchedule(schedules, {
    recordingLink: 'https://drive.google.com/file/d/rec001/view',
    recordedAt: '2026-11-25T21:10:00+07:00',
    subject: 'IELTS 6.5 Evening (2026-11-25 19:30 GMT+7) - Recording'
  });

  assert.equal(result.matched, true);
  assert.equal(result.alreadySet, false);
  assert.equal(result.schedule.id, 'sch_1');
  assert.ok(result.titleScore >= 1000);
});

test('findMatchingSchedule falls back to nearest prior schedule when subject has no class name', () => {
  const schedules = [
    {
      id: 'sch_morning',
      className: 'IELTS Morning',
      date: '2026-11-25',
      time: '9:00 AM',
      recordingLink: ''
    },
    {
      id: 'sch_evening',
      className: 'IELTS Evening',
      date: '2026-11-25',
      time: '7:00 PM',
      recordingLink: ''
    }
  ];

  const result = findMatchingSchedule(schedules, {
    recordingLink: 'https://drive.google.com/file/d/rec002/view',
    recordedAt: '2026-11-25T20:45:00+07:00',
    subject: 'Google Meet recording available'
  });

  assert.equal(result.matched, true);
  assert.equal(result.schedule.id, 'sch_evening');
});

test('findMatchingSchedule is idempotent for identical links and skips already-linked schedules unless overwrite=true', () => {
  const schedules = [
    {
      id: 'sch_existing',
      className: 'IELTS 7.0',
      date: '2026-11-25',
      time: '7:00 PM',
      recordingLink: 'https://drive.google.com/file/d/existing/view'
    }
  ];

  const sameResult = findMatchingSchedule(schedules, {
    recordingLink: 'https://drive.google.com/file/d/existing/view',
    recordedAt: '2026-11-25T21:00:00+07:00'
  });
  assert.equal(sameResult.matched, true);
  assert.equal(sameResult.alreadySet, true);
  assert.equal(sameResult.schedule.id, 'sch_existing');

  const skipResult = findMatchingSchedule(schedules, {
    recordingLink: 'https://drive.google.com/file/d/newlink/view',
    recordedAt: '2026-11-25T21:00:00+07:00'
  });
  assert.equal(skipResult.matched, false);
  assert.equal(skipResult.reason, 'no_matching_schedule');

  const overwriteResult = findMatchingSchedule(schedules, {
    recordingLink: 'https://drive.google.com/file/d/newlink/view',
    recordedAt: '2026-11-25T21:00:00+07:00',
    overwrite: true
  });
  assert.equal(overwriteResult.matched, true);
  assert.equal(overwriteResult.alreadySet, false);
  assert.equal(overwriteResult.schedule.id, 'sch_existing');
});
