const test = require('node:test');
const assert = require('node:assert/strict');
const { buildStudentTestAccess } = require('../test-access-index');

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
