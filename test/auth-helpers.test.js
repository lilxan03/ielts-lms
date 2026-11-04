const assert = require('node:assert/strict');
const test = require('node:test');
const {
    isValidUsername,
    usernameToAuthEmail,
    loginIdentifierToAuthEmail,
    getStudentDisplayName
} = require('../js/auth-helpers.js');

test('accepts usernames with letters, numbers, underscores, and hyphens', () => {
    assert.equal(isValidUsername('Student_01'), true);
    assert.equal(isValidUsername('teacher-name'), true);
});

test('rejects empty, long, or unsupported usernames', () => {
    assert.equal(isValidUsername(''), false);
    assert.equal(isValidUsername('a'.repeat(41)), false);
    assert.equal(isValidUsername('student name'), false);
    assert.equal(isValidUsername('khánh'), false);
});

test('maps usernames to the existing internal login email format', () => {
    assert.equal(usernameToAuthEmail('Student_01'), 'student_01@khanhlms.com');
    assert.equal(usernameToAuthEmail('Teacher-Name'), 'teacher-name@khanhlms.com');
});

test('accepts either a username or an email as the login identifier', () => {
    assert.equal(loginIdentifierToAuthEmail(' Student_01 '), 'student_01@khanhlms.com');
    assert.equal(loginIdentifierToAuthEmail(' Name@Gmail.com '), 'name@gmail.com');
});

test('uses a friendly student name instead of exposing an auth UID', () => {
    const uid = 'QX7u9H2kP4nM8vL1aB3cD5eF6gH0';
    assert.equal(getStudentDisplayName({ uid, user: uid, email: 'learner@gmail.com' }, { uid }), 'learner');
    assert.equal(getStudentDisplayName({ uid, user: uid }, { uid }), 'Student');
    assert.equal(getStudentDisplayName({ uid, user: 'student_01' }, { uid }), 'student_01');
    assert.equal(getStudentDisplayName({ uid, user: uid, displayName: 'Linh' }, { uid }), 'Linh');
});
