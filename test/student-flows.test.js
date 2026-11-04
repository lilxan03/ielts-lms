const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');
const authHelpers = require('../js/auth-helpers.js');

const readAppScript = fileName => fs.readFileSync(
    path.join(__dirname, '..', 'js', fileName),
    'utf8'
);

function createClassList() {
    const values = new Set(['hidden']);
    return {
        add: value => values.add(value),
        remove: value => values.delete(value),
        contains: value => values.has(value)
    };
}

function createElement(value = '') {
    const attributes = new Map();
    return {
        value,
        textContent: '',
        innerHTML: '',
        disabled: false,
        classList: createClassList(),
        setAttribute: (name, attributeValue) => attributes.set(name, attributeValue),
        getAttribute: name => attributes.get(name) || null,
        focus: () => {}
    };
}

function createAuthContext() {
    const elements = new Map([
        ['auth-user', createElement('student_01')],
        ['auth-pass', createElement('password123')],
        ['auth-error', createElement()],
        ['auth-submit-btn', createElement()]
    ]);
    const storedValues = new Map();
    const context = {
        console,
        Date,
        Uint8Array,
        Math,
        JSON,
        Object,
        Array,
        String,
        Promise,
        setTimeout,
        clearTimeout,
        currentUser: null,
        window: null,
        document: { getElementById: id => elements.get(id) || createElement() },
        sessionStorage: {
            setItem: (key, value) => storedValues.set(key, value),
            getItem: key => storedValues.get(key) || null,
            removeItem: key => storedValues.delete(key)
        },
        localStorage: { getItem: () => null }
    };
    context.window = context;
    context.LMSAuthHelpers = authHelpers;
    context.auth = { currentUser: null };
    context.db = {};
    context.fPath = collection => collection;
    context.fsDoc = (database, collection, id) => ({ collection, id });
    context.fsGetDoc = async reference => ({
        exists: () => reference.collection === 'users',
        data: () => ({
            user: 'student_01',
            uid: 'student-uid',
            role: 'student',
            status: 'approved',
            isPaid: true,
            referralCode: 'STUDENT01'
        }),
        ref: reference
    });
    context.fsAuthSignIn = async (auth, email) => {
        auth.currentUser = { uid: 'student-uid', email };
        return { user: auth.currentUser };
    };
    context.loadTrustedAccountAccess = async () => ({ role: 'student', paid: true });
    context.isAccountApproved = () => true;
    context.canAccessLMS = () => true;
    context.bootLMS = async () => { context.booted = true; };
    context.watchTrustedAccountAccess = () => {};
    context.tryEnsureStudentReferralIdentity = undefined;

    vm.createContext(context);
    vm.runInContext(readAppScript('auth.js'), context);
    context.bootLMS = async () => { context.booted = true; };
    vm.runInContext('window.runAuthSubmitForTest = handleAuthSubmit;', context);
    return { context, elements, storedValues };
}

function createTestPlayerContext({ failSubmissionWrite = false } = {}) {
    const elements = new Map([
        ['exam-ui', createElement()],
        ['student-class-select', createElement('class-1')],
        ['exam-listening-audio', createElement()],
        ['practice-listening-audio', createElement()],
        ['results-score-area', createElement()],
        ['results-modal', createElement()]
    ]);
    const savedDocuments = [];
    const modalMessages = [];
    const loggedErrors = [];
    const context = {
        console: {
            ...console,
            error: (...args) => loggedErrors.push(args)
        },
        Date,
        Math,
        JSON,
        Object,
        Array,
        String,
        Set,
        Promise,
        clearInterval: () => {},
        timerInterval: null,
        currentUser: { user: 'student_01', gems: 0 },
        getQuestionAnalyticsForSubmission: () => [{ questionId: 1, elapsedSeconds: 12 }],
        APP_DATA: {
            id: 'reading-1',
            title: 'Reading Practice',
            module: 'reading',
            parts: [{
                questions: [{ ids: [1], correctAnswers: { 1: 'A' } }]
            }]
        },
        answers: { 1: 'A' },
        isPreviewMode: false,
        testMode: 'timed',
        CLASSES: [{ id: 'class-1', name: 'IELTS Class' }],
        SUBMISSIONS: [],
        document: {
            getElementById: id => elements.get(id) || createElement(),
            addEventListener: () => {}
        },
        sessionStorage: { setItem: () => {} },
        finalizeCurrentQuestionTiming: () => {},
        buildQuestionAnalyticsSnapshot: () => [{ questionId: 1, elapsedSeconds: 12 }],
        window: null
    };
    context.window = context;
    context.db = {};
    context.fPath = collection => collection;
    context.fsDoc = (database, collection, id) => ({ collection, id });
    context.fsSetDoc = async (reference, value) => {
        if (failSubmissionWrite && reference.collection === 'submissions') {
            throw new Error('Network unavailable');
        }
        savedDocuments.push({ reference, value: JSON.parse(JSON.stringify(value)) });
    };
    context.showModalMsg = (title, message) => modalMessages.push({ title, message });
    context.refreshStudentLanguageLock = () => {};
    context.clearListeningMedia = () => {};
    context.calculateIELTSBand = () => 7.5;
    context.secureInfractions = 0;
    context.isFullExamMode = false;
    context.exitSecureMode = () => {};
    context.updateDashboardHeader = () => {};
    context.renderStudentDashboard = () => {};

    vm.createContext(context);
    vm.runInContext(readAppScript('test-player.js'), context);
    return { context, elements, savedDocuments, modalMessages, loggedErrors };
}

test('student sign-in authenticates, loads access, and starts the LMS', async () => {
    const { context, elements, storedValues } = createAuthContext();

    await context.runAuthSubmitForTest();

    assert.equal(context.auth.currentUser.uid, 'student-uid');
    assert.equal(context.auth.currentUser.email, 'student_01@khanhlms.com');
    assert.equal(context.currentUser.user, 'student_01');
    assert.equal(context.booted, true);
    assert.equal(context.authFlowInProgress, false);
    assert.equal(elements.get('auth-submit-btn').disabled, false);
    assert.equal(JSON.parse(storedValues.get('ielts_session')).uid, 'student-uid');
    assert.equal(elements.get('auth-user').getAttribute('aria-invalid'), 'false');
    assert.equal(elements.get('auth-pass').getAttribute('aria-invalid'), 'false');
});

test('student sign-in accepts an email address directly', async () => {
    const { context, elements } = createAuthContext();
    elements.get('auth-user').value = 'student@gmail.com';

    await context.runAuthSubmitForTest();

    assert.equal(context.auth.currentUser.email, 'student@gmail.com');
    assert.equal(context.currentUser.user, 'student_01');
    assert.equal(context.booted, true);
});

test('sign-in validation marks missing fields for assistive technology', async () => {
    const { context, elements } = createAuthContext();
    elements.get('auth-user').value = '';

    await context.runAuthSubmitForTest();

    assert.equal(elements.get('auth-user').getAttribute('aria-invalid'), 'true');
    assert.equal(elements.get('auth-pass').getAttribute('aria-invalid'), 'false');
    assert.equal(elements.get('auth-error').textContent, 'Enter username and password');
    assert.equal(elements.get('auth-error').classList.contains('hidden'), false);
});

test('student test submission saves answers and records the score', async () => {
    const { context, elements, savedDocuments } = createTestPlayerContext();

    await context.exitTest(true);

    const submissionWrite = savedDocuments.find(({ reference }) => reference.collection === 'submissions');
    assert.ok(submissionWrite, 'submission is saved');
    assert.equal(submissionWrite.value.student, 'student_01');
    assert.equal(submissionWrite.value.testId, 'reading-1');
    assert.deepEqual(submissionWrite.value.answers, { 1: 'A' });
    assert.equal(submissionWrite.value.score, '1/1 (Band 9.0)');
    assert.equal(context.SUBMISSIONS[0].id, submissionWrite.value.id);
    const rewardWrite = savedDocuments.find(({ reference }) => reference.collection === 'users');
    assert.equal(rewardWrite.value.gems, 50);
});

test('failed submission save keeps the test open and shows an error', async () => {
    const { context, elements, savedDocuments, modalMessages, loggedErrors } = createTestPlayerContext({
        failSubmissionWrite: true
    });

    await context.exitTest(true);

    assert.equal(context.SUBMISSIONS.length, 0);
    assert.equal(savedDocuments.length, 0);
    assert.equal(context.currentUser.gems, 0);
    assert.equal(elements.get('exam-ui').classList.contains('hidden'), false);
    assert.equal(elements.get('results-modal').classList.contains('hidden'), true);
    assert.equal(modalMessages[0].title, 'Submission Error');
    assert.match(modalMessages[0].message, /try submitting again/i);
    assert.equal(loggedErrors[0][0], 'Cloud Error saving submission:');
});

test('sign-in form uses accessible labels and announced errors', () => {
    const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
    const authMarkup = html.match(/<form id="auth-form"[\s\S]*?<\/form>/)?.[0];

    assert.ok(authMarkup, 'sign-in uses a form');
    assert.match(authMarkup, /<label for="auth-user"/);
    assert.match(authMarkup, /<label for="auth-pass"/);
    assert.match(authMarkup, /id="auth-user"[^>]*autocomplete="username"/);
    assert.match(authMarkup, /id="auth-pass"[^>]*autocomplete="current-password"/);
    assert.match(html, /id="auth-error"[^>]*role="alert"[^>]*aria-live="assertive"/);
    assert.doesNotMatch(authMarkup, /\bonclick=|\bonkeydown=/);
});

test('auth event module submits the form and handles delegated button actions', () => {
    const listeners = {};
    const formListeners = {};
    const calls = [];
    const context = {
        window: {
            handleAuthSubmit: () => calls.push('submit'),
            togglePasswordVisibility: (...args) => calls.push(['toggle-password', ...args]),
            toggleAuthMode: () => calls.push('toggle-mode')
        },
        document: {
            getElementById: id => id === 'auth-form'
                ? { addEventListener: (name, callback) => { formListeners[name] = callback; } }
                : null,
            addEventListener: (name, callback) => {
                listeners[name] = [...(listeners[name] || []), callback];
            }
        }
    };

    vm.createContext(context);
    vm.runInContext(readAppScript('app-events.js'), context);

    let prevented = false;
    formListeners.submit({ preventDefault: () => { prevented = true; } });
    const button = {
        dataset: { authAction: 'toggle-password' }
    };
    const dispatchClick = targetButton => listeners.click.forEach(listener => listener({
        target: {
            closest: selector => selector === `button[data-${targetButton.dataset.authAction === 'toggle-password' || targetButton.dataset.authAction === 'toggle-mode' ? 'auth' : 'test'}-action]`
                ? targetButton
                : null
        }
    }));
    dispatchClick(button);
    dispatchClick({ dataset: { authAction: 'toggle-mode' } });

    assert.equal(prevented, true);
    assert.deepEqual(calls, ['submit', ['toggle-password', 'auth-pass', button], 'toggle-mode']);
});

test('test mode choices and actions use accessible buttons and delegated listeners', () => {
    const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
    const modeMarkup = html.match(/<div id="test-mode-modal"[\s\S]*?<\/div>\s*<\/div>\s*<\/div>/)?.[0];
    assert.ok(modeMarkup, 'test mode dialog markup exists');
    assert.match(modeMarkup, /role="dialog" aria-modal="true" aria-labelledby="test-mode-title"/);
    assert.match(modeMarkup, /role="group" aria-label="Test time mode"/);
    assert.match(modeMarkup, /<button type="button" id="mode-btn-free"[^>]*aria-pressed="false"/);
    assert.match(modeMarkup, /<button type="button" id="mode-btn-restricted"[^>]*aria-pressed="true"/);
    assert.match(modeMarkup, /<label for="custom-time-input"/);
    assert.doesNotMatch(modeMarkup, /onclick=/);

    const listeners = [];
    const calls = [];
    const context = {
        window: {
            selectTestMode: mode => calls.push(['mode', mode]),
            cancelTestRouteStart: () => calls.push('cancel'),
            confirmStartTest: () => calls.push('start'),
            openTestActivities: () => calls.push('activities')
        },
        document: {
            getElementById: () => null,
            addEventListener: (name, callback) => {
                if (name === 'click') listeners.push(callback);
            }
        }
    };
    vm.createContext(context);
    vm.runInContext(readAppScript('app-events.js'), context);

    for (const action of [
        { testAction: 'select-mode', mode: 'free' },
        { testAction: 'select-mode', mode: 'restricted' },
        { testAction: 'cancel' },
        { testAction: 'start' },
        { testAction: 'activities' }
    ]) {
        const button = { dataset: action };
        listeners.forEach(listener => listener({
            target: { closest: selector => selector === 'button[data-test-action]' ? button : null }
        }));
    }

    assert.deepEqual(calls, [
        ['mode', 'free'],
        ['mode', 'restricted'],
        'cancel',
        'start',
        'activities'
    ]);
});

test('test mode dialog focuses controls, traps Tab, and restores focus on Escape', () => {
    const listeners = {};
    const controls = Array.from({ length: 3 }, () => ({
        disabled: false,
        closest: () => null,
        focus() { document.activeElement = this; }
    }));
    const opener = {
        isConnected: true,
        disabled: false,
        focus() { document.activeElement = this; }
    };
    const modal = {
        querySelector: () => controls[0],
        querySelectorAll: () => controls,
        addEventListener: (name, callback) => { listeners[name] = callback; },
        focus() {}
    };
    const document = {
        body: {},
        activeElement: opener,
        getElementById: id => id === 'test-mode-modal' ? modal : null,
        addEventListener() {}
    };
    const context = {
        document,
        window: {
            cancelTestRouteStart() {
                this.restoreTestModeDialogFocus();
            }
        },
        Array
    };
    vm.createContext(context);
    vm.runInContext(readAppScript('app-events.js'), context);

    context.window.focusTestModeDialog(opener);
    assert.equal(document.activeElement, controls[0]);

    let tabPrevented = false;
    listeners.keydown({
        key: 'Tab',
        shiftKey: true,
        preventDefault: () => { tabPrevented = true; }
    });
    assert.equal(tabPrevented, true);
    assert.equal(document.activeElement, controls[2]);

    document.activeElement = controls[0];
    let escapePrevented = false;
    listeners.keydown({
        key: 'Escape',
        preventDefault: () => { escapePrevented = true; }
    });
    assert.equal(escapePrevented, true);
    assert.equal(document.activeElement, opener);
});
