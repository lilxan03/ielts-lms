const assert = require('node:assert/strict');
const test = require('node:test');
const { isValidUsername, usernameToAuthEmail, loginIdentifierToAuthEmail } = require('../js/auth-helpers.js');

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
