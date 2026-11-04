const { after, before, beforeEach, test } = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const path = require('node:path');
const {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment
} = require('@firebase/rules-unit-testing');
const {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  setDoc,
  updateDoc,
  where
} = require('firebase/firestore');

const projectId = 'demo-ielts-lms';
let testEnv;

before(async () => {
  testEnv = await initializeTestEnvironment({
    projectId,
    firestore: {
      rules: readFileSync(path.join(__dirname, '..', 'firestore.rules'), 'utf8')
    }
  });
});

beforeEach(async () => {
  await testEnv.clearFirestore();
  await testEnv.withSecurityRulesDisabled(async context => {
    const db = context.firestore();
    const fixtures = [
      ['account_access/alice-uid', { uid: 'alice-uid', username: 'alice', role: 'student', paid: true }],
      ['account_access/bob-uid', { uid: 'bob-uid', username: 'bob', role: 'student', paid: true }],
      ['account_access/teacher-uid', { uid: 'teacher-uid', username: 'teacher', role: 'teacher', paid: false }],
      ['classes/class-a', { id: 'class-a', name: 'Class A', enrolledStudents: ['alice'], assignedTests: ['test-a'] }],
      ['classes/class-b', { id: 'class-b', name: 'Class B', enrolledStudents: ['bob'], assignedTests: ['test-b'] }],
      ['classes/class-c', { id: 'class-c', name: 'Class C', enrolledStudents: ['alice'], assignedTests: [] }],
      ['tests/test-a', { id: 'test-a', title: 'Assigned test', correctAnswers: { q1: 'answer' } }],
      ['tests/test-b', { id: 'test-b', title: 'Other class test', correctAnswers: { q1: 'secret' } }],
      ['tests/test-c', { id: 'test-c', title: 'Scheduled test' }],
      ['student_test_access/alice-uid/tests/test-a', {
        uid: 'alice-uid',
        username: 'alice',
        testId: 'test-a',
        classId: 'class-a',
        source: 'class'
      }],
      ['student_test_access/bob-uid/tests/test-b', {
        uid: 'bob-uid',
        username: 'bob',
        testId: 'test-b',
        classId: 'class-b',
        source: 'class'
      }],
      ['student_test_access/alice-uid/tests/test-c', {
        uid: 'alice-uid',
        username: 'alice',
        testId: 'test-c',
        classId: 'class-a',
        scheduleId: 'schedule-a',
        source: 'schedule'
      }],
      ['schedules/schedule-a', { id: 'schedule-a', classId: 'class-a', className: 'Class A', homeworkTests: ['test-c'], attendingStudents: ['alice'] }],
      ['schedules/schedule-b', { id: 'schedule-b', classId: 'class-b', className: 'Class B' }],
      ['class_presence/alice-presence', { classId: 'class-a', student: 'alice', isOnline: true, lastActiveAt: 1 }],
      ['class_presence/bob-presence', { classId: 'class-b', student: 'bob', isOnline: true, lastActiveAt: 1 }],
      ['submissions/alice-submission', { id: 'alice-submission', student: 'alice', score: 'Band 7', answers: { q1: 'answer' } }],
      ['notes/alice_test-a', { owner: 'alice', data: ['private note'] }],
      ['notes/bob_test-b', { owner: 'bob', data: ['private note'] }],
      ['flashcards/alice_vocab', { owner: 'alice', data: [{ term: 'word' }] }],
      ['flashcards/bob_vocab', { owner: 'bob', data: [{ term: 'word' }] }],
      ['messages/legacy-message', { id: 'legacy-message', author: 'teacher', classId: null, text: 'Legacy message' }],
      ['public_messages/global-message', { id: 'global-message', author: 'teacher', text: 'General notice' }],
      ['classes/class-a/messages/class-a-message', { id: 'class-a-message', author: 'alice', classId: 'class-a', text: 'Class A post' }],
      ['classes/class-b/messages/class-b-message', { id: 'class-b-message', author: 'bob', classId: 'class-b', text: 'Class B post' }]
    ];
    await Promise.all(fixtures.map(([ref, value]) => setDoc(doc(db, ref), value)));
  });
});

after(async () => {
  await testEnv?.cleanup();
});

test('students can read only currently assigned tests, not list the test bank', async () => {
  const db = testEnv.authenticatedContext('alice-uid', { email: 'alice@example.com' }).firestore();
  await assertSucceeds(getDoc(doc(db, 'tests/test-a')));
  await assertSucceeds(getDoc(doc(db, 'tests/test-c')));
  await assertFails(getDoc(doc(db, 'tests/test-b')));
  await assertFails(getDocs(collection(db, 'tests')));
  await assertSucceeds(getDocs(collection(db, 'student_test_access/alice-uid/tests')));
  await assertFails(getDocs(collection(db, 'student_test_access/bob-uid/tests')));
});

test('a stale test-access record stops working when the class assignment is removed', async () => {
  const db = testEnv.authenticatedContext('alice-uid', { email: 'alice@example.com' }).firestore();
  await testEnv.withSecurityRulesDisabled(async context => {
    await updateDoc(doc(context.firestore(), 'classes/class-a'), { assignedTests: [] });
  });
  await assertFails(getDoc(doc(db, 'tests/test-a')));
});

test('students can query only their enrolled classes and class schedules', async () => {
  const db = testEnv.authenticatedContext('alice-uid', { email: 'alice@example.com' }).firestore();
  const ownClasses = query(collection(db, 'classes'), where('enrolledStudents', 'array-contains', 'alice'));
  const ownSchedules = query(collection(db, 'schedules'), where('classId', '==', 'class-a'));
  const otherSchedules = query(collection(db, 'schedules'), where('classId', '==', 'class-b'));

  await assertSucceeds(getDocs(ownClasses));
  await assertFails(getDocs(collection(db, 'classes')));
  await assertSucceeds(getDocs(ownSchedules));
  await assertFails(getDocs(otherSchedules));
  await assertFails(getDocs(collection(db, 'schedules')));
});

test('class presence is visible only within enrolled classes and students can update only their own status', async () => {
  const db = testEnv.authenticatedContext('alice-uid', { email: 'alice@example.com' }).firestore();
  await assertSucceeds(getDoc(doc(db, 'class_presence/alice-presence')));
  await assertFails(getDoc(doc(db, 'class_presence/bob-presence')));
  await assertFails(getDocs(collection(db, 'class_presence')));
  await assertSucceeds(updateDoc(doc(db, 'class_presence/alice-presence'), { isOnline: false, lastActiveAt: 2 }));
  await assertFails(updateDoc(doc(db, 'class_presence/alice-presence'), { student: 'bob' }));
  await assertFails(setDoc(doc(db, 'class_presence/other-class'), {
    classId: 'class-b',
    student: 'alice',
    isOnline: true,
    lastActiveAt: 2
  }));
});

test('students can read global and enrolled-class messages but not other-class messages', async () => {
  const db = testEnv.authenticatedContext('alice-uid', { email: 'alice@example.com' }).firestore();
  const globalMessages = getDocs(collection(db, 'public_messages'));
  const ownMessages = getDocs(collection(db, 'classes/class-a/messages'));

  await assertSucceeds(globalMessages);
  await assertSucceeds(ownMessages);
  await assertFails(getDoc(doc(db, 'classes/class-b/messages/class-b-message')));
  await assertFails(getDocs(collection(db, 'messages')));
  await assertFails(getDocs(collection(db, 'classes/class-b/messages')));
  await assertFails(updateDoc(doc(db, 'classes/class-a/messages/class-a-message'), { classId: 'class-b' }));
  await assertSucceeds(setDoc(doc(db, 'public_messages/alice-post'), {
    id: 'alice-post',
    kind: 'forum',
    author: 'alice',
    role: 'student',
    title: 'Question',
    text: 'Can you explain this?',
    timestamp: 2
  }));
  await assertFails(setDoc(doc(db, 'public_messages/alice-private-class-post'), {
    id: 'alice-private-class-post',
    author: 'alice',
    role: 'student',
    classId: 'class-b',
    text: 'Wrong destination'
  }));
});

test('submission creation is assignment-limited and later updates cannot change grades or answers', async () => {
  const db = testEnv.authenticatedContext('alice-uid', { email: 'alice@example.com' }).firestore();
  const submission = doc(db, 'submissions/alice-submission');

  await assertSucceeds(setDoc(doc(db, 'submissions/new-assigned-submission'), {
    student: 'alice',
    testId: 'test-a',
    classId: 'class-a',
    className: 'Class A',
    score: 'Band 7',
    answers: { q1: 'answer' }
  }));
  await assertSucceeds(setDoc(doc(db, 'submissions/new-scheduled-submission'), {
    student: 'alice',
    testId: 'test-c',
    classId: 'class-a',
    className: 'Class A',
    scheduleId: 'schedule-a',
    score: 'Band 7',
    answers: {}
  }));
  await assertFails(setDoc(doc(db, 'submissions/scheduled-without-source'), {
    student: 'alice',
    testId: 'test-c',
    classId: 'class-a',
    className: 'Class A',
    score: 'Band 7',
    answers: {}
  }));
  await assertFails(setDoc(doc(db, 'submissions/new-unassigned-submission'), {
    student: 'alice',
    testId: 'test-b',
    classId: 'class-b',
    className: 'Class B',
    score: 'Band 9',
    answers: { q1: 'secret' }
  }));
  await assertFails(setDoc(doc(db, 'submissions/wrong-class-submission'), {
    student: 'alice',
    testId: 'test-a',
    classId: 'class-c',
    className: 'Class C',
    score: 'Band 9',
    answers: { q1: 'answer' }
  }));
  await assertSucceeds(updateDoc(submission, { studentReply: 'Please explain question one.' }));
  await assertFails(updateDoc(submission, { score: 'Band 9' }));
  await assertFails(updateDoc(submission, { answers: { q1: 'changed' } }));
  await assertFails(getDocs(collection(db, 'submissions')));
});

test('notes and flashcards are private to their owner', async () => {
  const db = testEnv.authenticatedContext('alice-uid', { email: 'alice@example.com' }).firestore();
  const ownNotes = query(collection(db, 'notes'), where('owner', '==', 'alice'));
  const ownFlashcards = query(collection(db, 'flashcards'), where('owner', '==', 'alice'));

  await assertSucceeds(getDocs(ownNotes));
  await assertSucceeds(getDocs(ownFlashcards));
  await assertFails(getDoc(doc(db, 'notes/bob_test-b')));
  await assertFails(getDoc(doc(db, 'flashcards/bob_vocab')));
  await assertFails(getDocs(collection(db, 'notes')));
  await assertFails(getDocs(collection(db, 'flashcards')));
  await assertSucceeds(setDoc(doc(db, 'notes/alice_test-c'), { owner: 'alice', data: ['new note'] }));
  await assertFails(setDoc(doc(db, 'flashcards/bob_new'), { owner: 'bob', data: [] }));
  await assertFails(updateDoc(doc(db, 'notes/alice_test-a'), { owner: 'bob' }));
});

test('staff retain access to all tests, classes, schedules, and submissions', async () => {
  const db = testEnv.authenticatedContext('teacher-uid').firestore();
  await assertSucceeds(getDocs(collection(db, 'tests')));
  await assertSucceeds(getDocs(collection(db, 'classes')));
  await assertSucceeds(getDocs(collection(db, 'schedules')));
  await assertSucceeds(getDocs(collection(db, 'submissions')));
});
