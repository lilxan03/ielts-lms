const test = require('node:test');
const assert = require('node:assert/strict');
const { buildStudentTestAccess } = require('../test-access-index');
const { buildStudentTestAccessEntries } = require('../js/student-test-access');

test('builds access only for enrolled students and inherits parent assignments', () => {
  const entries = buildStudentTestAccess(
    [
      { uid: 'alice-uid', role: 'student', username: 'alice' },
      { uid: 'bob-uid', role: 'student', username: 'bob' },
      { uid: 'teacher-uid', role: 'teacher', username: 'teacher' }
    ],
    [
      { id: 'parent', assignedTests: ['test-parent'], enrolledStudents: [] },
      { id: 'class-a', parentClassId: 'parent', enrolledStudents: ['alice'] },
      { id: 'class-b', assignedTests: ['test-b'], enrolledStudents: ['bob'] }
    ],
    []
  );

  assert.deepEqual(entries, [
    { uid: 'alice-uid', username: 'alice', testId: 'test-parent', classId: 'class-a', source: 'class' },
    { uid: 'bob-uid', username: 'bob', testId: 'test-b', classId: 'class-b', source: 'class' }
  ]);
});

test('indexes scheduled materials only for allowed attendees and prefers class assignments', () => {
  const entries = buildStudentTestAccess(
    [
      { uid: 'alice-uid', role: 'student', username: 'alice' },
      { uid: 'bob-uid', role: 'student', username: 'bob' }
    ],
    [
      { id: 'class-a', name: 'IELTS A', enrolledStudents: ['alice', 'bob'], assignedTests: ['shared-test'] }
    ],
    [
      {
        id: 'schedule-a',
        classId: 'class-a',
        assignedTests: ['shared-test'],
        homeworkTests: ['homework-test'],
        attendingStudents: ['alice']
      }
    ]
  );

  assert.deepEqual(entries, [
    { uid: 'alice-uid', username: 'alice', testId: 'shared-test', classId: 'class-a', source: 'class' },
    { uid: 'bob-uid', username: 'bob', testId: 'shared-test', classId: 'class-a', source: 'class' },
    { uid: 'alice-uid', username: 'alice', testId: 'homework-test', classId: 'class-a', scheduleId: 'schedule-a', source: 'schedule' }
  ]);
});

test('ignores malformed IDs and ambiguous legacy schedule class names', () => {
  const entries = buildStudentTestAccess(
    [{ uid: 'alice-uid', role: 'student', username: 'alice' }],
    [
      { id: 'class-a', name: 'Duplicate', enrolledStudents: ['alice'], assignedTests: ['safe-test', 'bad/id'] },
      { id: 'class-b', name: 'Duplicate', enrolledStudents: ['alice'] }
    ],
    [{ id: 'schedule-a', className: 'Duplicate', homeworkTests: ['ambiguous-test'] }]
  );

  assert.deepEqual(entries, [
    { uid: 'alice-uid', username: 'alice', testId: 'safe-test', classId: 'class-a', source: 'class' }
  ]);
});

test('student-side index includes assigned, inherited, and scheduled tests only for the signed-in student', () => {
  const entries = buildStudentTestAccessEntries(
    { uid: 'alice-uid', user: 'alice' },
    [
      { id: 'template', name: 'Course', isTemplate: true, assignedTests: ['parent-test'] },
      { id: 'class-a', name: 'Class A', parentClassId: 'template', enrolledStudents: ['alice'], testSettings: { 'settings-test': {} } },
      { id: 'class-b', name: 'Class B', enrolledStudents: ['bob'], assignedTests: ['private-test'] }
    ],
    [
      { id: 'schedule-a', classId: 'class-a', attendingStudents: ['alice'], homeworkTests: ['homework-test'] },
      { id: 'schedule-b', classId: 'class-b', assignedTests: ['other-homework'] }
    ]
  );

  assert.deepEqual(entries, [
    { uid: 'alice-uid', username: 'alice', testId: 'settings-test', classId: 'class-a', source: 'class' },
    { uid: 'alice-uid', username: 'alice', testId: 'parent-test', classId: 'class-a', source: 'class' },
    { uid: 'alice-uid', username: 'alice', testId: 'homework-test', classId: 'class-a', scheduleId: 'schedule-a', source: 'schedule' }
  ]);
});

test('student-side index ignores malformed IDs and schedules for non-attendees', () => {
  const entries = buildStudentTestAccessEntries(
    { uid: 'alice-uid', user: 'alice' },
    [{ id: 'class-a', enrolledStudents: ['alice'], assignedTests: ['safe-test', 'bad/id'] }],
    [{ id: 'schedule-a', classId: 'class-a', attendingStudents: [], materialIds: ['not-for-alice'] }]
  );

  assert.deepEqual(entries, [
    { uid: 'alice-uid', username: 'alice', testId: 'safe-test', classId: 'class-a', source: 'class' }
  ]);
});

test('student-side index can use inherited assignments mirrored onto an enrolled child class', () => {
  const entries = buildStudentTestAccessEntries(
    { uid: 'alice-uid', user: 'alice' },
    [{
      id: 'class-a',
      parentClassId: 'hidden-parent',
      enrolledStudents: ['alice'],
      inheritedAssignedTests: ['parent-test'],
      inheritedTestSettings: { 'parent-settings-test': {} }
    }],
    []
  );

  assert.deepEqual(entries, [
    { uid: 'alice-uid', username: 'alice', testId: 'parent-test', classId: 'class-a', source: 'class' },
    { uid: 'alice-uid', username: 'alice', testId: 'parent-settings-test', classId: 'class-a', source: 'class' }
  ]);
});
