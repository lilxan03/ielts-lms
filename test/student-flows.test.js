const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');
const authHelpers = require('../js/auth-helpers.js');
const { buildStudentTestAccessEntries } = require('../js/student-test-access.js');
const { buildTestBankEntries, cleanTestBankLabel, matchesTestBankEntry } = require('../js/test-bank-entries.js');

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
    const profileLookups = [];
    let ownedProfileLookups = 0;
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
        profileLookups,
        get ownedProfileLookups() { return ownedProfileLookups; },
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
    context.fsGetDoc = async reference => {
        profileLookups.push(reference.id);
        return {
            exists: () => reference.collection === 'users' && reference.id === 'student_01',
            data: () => ({
                user: 'student_01',
                uid: 'student-uid',
                role: 'student',
                status: 'approved',
                isPaid: true,
                referralCode: 'STUDENT01'
            }),
            ref: reference
        };
    };
    context.fsCollection = (database, collection) => ({ collection });
    context.fsWhere = (field, operator, value) => ({ field, operator, value });
    context.fsLimit = count => ({ count });
    context.fsQuery = (collection, ...constraints) => ({ collection, constraints });
    context.fsGetDocs = async () => {
        ownedProfileLookups++;
        return {
            empty: false,
            docs: [{
                exists: () => true,
                data: () => ({
                    user: 'student_01',
                    uid: 'student-uid',
                    role: 'student',
                    status: 'approved',
                    isPaid: true,
                    referralCode: 'STUDENT01'
                }),
                ref: { collection: 'users', id: 'student_01' }
            }]
        };
    };
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
        ['results-modal', createElement()],
        ['question-feedback-context', createElement()],
        ['question-feedback-description', createElement()],
        ['question-feedback-modal', createElement()],
        ['question-feedback-submit', createElement()]
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
        currentUser: { user: 'student_01', role: 'student', gems: 0 },
        getQuestionAnalyticsForSubmission: (testData, answerMap) => [{
            partIndex: 0,
            blockIndex: 0,
            questionType: testData.parts[0].questions[0].type || 'unknown',
            correct: answerMap[1] === 'A',
            correctCount: answerMap[1] === 'A' ? 1 : 0,
            totalCount: 1,
            scoreable: ['reading', 'listening'].includes(testData.module)
        }],
        APP_DATA: {
            id: 'reading-1',
            title: 'Reading Practice',
            module: 'reading',
            parts: [{
                questions: [{ type: 'fill_blanks', ids: [1], correctAnswers: { 1: 'A' } }]
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
    context.auth = { currentUser: { uid: 'student-uid' } };
    context.db = {};
    context.fPath = collection => collection;
    context.fsCollection = (database, collection) => ({ collection });
    context.fsDoc = (database, collection, id) => collection === undefined
        ? { collection: database.collection, id: 'generated-feedback' }
        : { collection, id };
    context.fsServerTimestamp = () => 'server timestamp';
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

test('students can submit feedback with test and question metadata', async () => {
    const { context, elements, savedDocuments } = createTestPlayerContext();

    context.openQuestionFeedbackForm('reading-1', 0, [1], 'Part One');
    assert.equal(elements.get('question-feedback-context').textContent, 'Reading Practice · Part One · Q1');
    elements.get('question-feedback-description').value = 'The answer field is not visible.';
    await context.submitQuestionFeedback({ preventDefault() {} });

    assert.equal(savedDocuments.length, 1);
    assert.equal(savedDocuments[0].reference.collection, 'question_feedback');
    assert.equal(savedDocuments[0].value.uid, 'student-uid');
    assert.equal(savedDocuments[0].value.student, 'student_01');
    assert.equal(savedDocuments[0].value.testId, 'reading-1');
    assert.deepEqual(savedDocuments[0].value.questionIds, [1]);
    assert.equal(savedDocuments[0].value.description, 'The answer field is not visible.');
    assert.equal(savedDocuments[0].value.createdAt, 'server timestamp');
});

test('question feedback is unavailable in student profile preview mode', async () => {
    const { context, elements, savedDocuments } = createTestPlayerContext();
    context.isStudentProfilePreview = true;

    context.openQuestionFeedbackForm('reading-1', 0, [1], 'Part One');
    elements.get('question-feedback-description').value = 'This should not be submitted.';
    await context.submitQuestionFeedback({ preventDefault() {} });

    assert.equal(savedDocuments.length, 0);
    assert.equal(elements.get('question-feedback-modal').classList.contains('flex'), false);
});

test('teacher student-profile preview shows read-only student learning data', () => {
    const elements = new Map([
        ['student-profile-preview-modal', createElement()],
        ['student-profile-preview-content', createElement()],
        ['student-profile-preview-title', createElement()]
    ]);
    const context = {
        console,
        window: null,
        document: { getElementById: id => elements.get(id) || createElement() },
        lmsEscapeHtml: value => String(value ?? '').replace(/[&<>"']/g, char => ({
            '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
        })[char]),
        USERS: [{ user: 'alice', role: 'student', realName: '<Student>', email: 'alice@example.com' }],
        CLASSES: [{ id: 'class-a', name: 'IELTS Reading', enrolledStudents: ['alice'], assignedTests: ['test-a'] }],
        TEST_BANK: [
            { id: 'test-a', title: 'Reading Practice' },
            { id: 'test-c', title: 'Scheduled Homework' }
        ],
        SCHEDULES: [{
            classId: 'class-a',
            attendingStudents: ['alice'],
            homeworkTests: ['test-c']
        }],
        SUBMISSIONS: [{ id: 1, student: 'alice', testName: 'Reading Practice', score: 'Band 7' }],
        ATTENDANCE: [{ student: 'alice' }]
    };
    context.window = context;
    context.isTemplateClass = cls => cls.isTemplate === true;
    vm.createContext(context);
    vm.runInContext(readAppScript('teacher-admin.js'), context);

    context.openStudentProfilePreview('alice');

    assert.equal(elements.get('student-profile-preview-modal').classList.contains('flex'), true);
    assert.equal(elements.get('student-profile-preview-title').textContent, '<Student> · Student profile');
    assert.match(elements.get('student-profile-preview-content').innerHTML, /&lt;Student&gt;/);
    assert.match(elements.get('student-profile-preview-content').innerHTML, /IELTS Reading/);
    assert.match(elements.get('student-profile-preview-content').innerHTML, /Reading Practice/);
    assert.match(elements.get('student-profile-preview-content').innerHTML, /Scheduled Homework/);
    assert.match(elements.get('student-profile-preview-content').innerHTML, /Band 7/);
});

test('test grammar flashcards use the app lexical grammar data', () => {
    const elements = new Map([
        ['panel-fc-list-select', {
            querySelector: () => null,
            appendChild(option) { this.option = option; },
            dispatchEvent: () => {}
        }],
        ['study-mode-deck-name', createElement()],
        ['study-mode-modal', { classList: createClassList() }]
    ]);
    const context = {
        console,
        Event,
        document: {
            getElementById: id => elements.get(id) || createElement(),
            createElement: () => ({ style: {} })
        },
        window: null,
        switchStudyMode: mode => {
            context.studyMode = mode;
            context.studyDeckLengthWhenOpened = context.studyDeck.length;
        }
    };
    context.window = context;
    vm.createContext(context);
    vm.runInContext(
        'let APP_DATA = { title: "Preview Test", grammar: [{ term: "Having finished", type: "Participle clause", expl: "Shows a completed action." }] }; let FLASHCARDS = {};',
        context
    );
    vm.runInContext(readAppScript('study-tools.js'), context);
    context.window.switchStudyMode = mode => {
        context.studyMode = mode;
        context.studyDeckLengthWhenOpened = context.studyDeck.length;
    };

    context.window.startTestGrammarStudy();

    const deck = vm.runInContext('FLASHCARDS.temp_test_deck', context);
    assert.equal(context.APP_DATA, undefined);
    assert.equal(deck.length, 1);
    assert.equal(deck[0].term, 'Having finished');
    assert.equal(deck[0].def, '[Participle clause] Shows a completed action.');
    assert.equal(context.studyDeckLengthWhenOpened, 1);
    assert.equal(context.studyDeck[0].term, 'Having finished');
    assert.equal(context.studyDeck[0].def, '[Participle clause] Shows a completed action.');
    assert.equal(context.studyMode, 'flashcards');
    assert.equal(elements.get('study-mode-deck-name').textContent, 'Preview Test (Grammar Bank)');
});

test('student access sync writes only the signed-in student assigned test entries', async () => {
    const { context } = createAuthContext();
    const writes = [];
    context.currentUser = { uid: 'student-uid', user: 'student_01', role: 'student' };
    context.CLASSES = [{
        id: 'class-a',
        assignedTests: ['assigned-test'],
        enrolledStudents: ['student_01']
    }, {
        id: 'class-b',
        assignedTests: ['other-test'],
        enrolledStudents: ['another-student']
    }];
    context.SCHEDULES = [];
    context.buildStudentTestAccessEntries = buildStudentTestAccessEntries;
    context.fsDoc = (collection, id) => ({ collection, id });
    context.fsGetDocs = async () => ({ docs: [] });
    context.fsWriteBatch = () => ({
        set: (reference, value) => writes.push({ reference, value }),
        delete: reference => writes.push({ reference, deleted: true }),
        commit: async () => {}
    });

    await context.syncStudentTestAccess();

    assert.equal(writes.length, 1);
    assert.equal(writes[0].reference.id, 'assigned-test');
    assert.equal(writes[0].value.uid, 'student-uid');
    assert.equal(writes[0].value.username, 'student_01');
    assert.equal(writes[0].value.classId, 'class-a');
    assert.equal(writes[0].value.source, 'class');
});

test('student sign-in accepts an email address directly', async () => {
    const { context, elements } = createAuthContext();
    elements.get('auth-user').value = 'student@gmail.com';

    await context.runAuthSubmitForTest();

    assert.equal(context.auth.currentUser.email, 'student@gmail.com');
    assert.equal(context.currentUser.user, 'student_01');
    assert.equal(context.booted, true);
    assert.deepEqual(context.profileLookups, []);
    assert.equal(context.ownedProfileLookups, 1);
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
    assert.deepEqual(submissionWrite.value.questionAnalytics[0], {
        partIndex: 0,
        blockIndex: 0,
        questionType: 'fill_blanks',
        correct: true,
        correctCount: 1,
        totalCount: 1,
        scoreable: true
    });
    assert.equal(context.SUBMISSIONS[0].id, submissionWrite.value.id);
    const rewardWrite = savedDocuments.find(({ reference }) => reference.collection === 'users');
    assert.equal(rewardWrite.value.gems, 50);
});

test('Micro-Dictation targets numbers, proper names, and longer words', () => {
    const context = {
        window: null,
        URL,
        console
    };
    context.window = context;
    vm.createContext(context);
    vm.runInContext(readAppScript('micro-dictation.js'), context);

    const targets = Array.from(
        context.getMicroDictationTargets('The researcher met Dr Smith in 2024 to discuss biodiversity.'),
        ({ word }) => word
    );
    assert.deepEqual(targets, ['researcher', 'Smith', '2024', 'biodiversity']);

    const segments = context.buildMicroDictationSegments({
        text: 'The museum hosted researchers in 2024. Visitors travelled from Australia.'
    }, 17, 5);
    assert.deepEqual(Array.from(segments, segment => [segment.start, segment.end]), [
        [0, 5], [5, 10], [10, 15], [15, 17]
    ]);
    assert.equal(segments.map(segment => segment.text).join(' ').split(/\s+/).length, 10);
    assert.deepEqual(Array.from(context.buildMicroDictationSegments({ text: 'One sentence.' }, Infinity, 8)), []);
});

test('Listening distractor analysis highlights matching options and signposts', () => {
    const context = { window: null };
    context.window = context;
    vm.createContext(context);
    vm.runInContext(readAppScript('listening-distractors.js'), context);

    const questions = [{
        type: 'multiple_choice',
        ids: [3],
        options: ['The route was cheaper', 'The cost was high'],
        correctAnswers: { 3: 'The route was cheaper' }
    }];
    const transcript = 'At first, we thought the cost was high. However, the route was cheaper.';
    const matches = Array.from(
        context.getListeningDistractorMatches(transcript, questions),
        ({ kind, start, end }) => [kind, transcript.slice(start, end)]
    );

    assert.deepEqual(matches, [
        ['signpost', 'At first'],
        ['distractor', 'the cost was high'],
        ['signpost', 'However'],
        ['correct', 'the route was cheaper']
    ]);

    const overlapQuestions = [{
        type: 'multiple_choice',
        ids: [1],
        options: ['the route was cheaper', 'route was'],
        correctAnswers: { 1: 'the route was cheaper' }
    }];
    const overlapMatches = Array.from(
        context.getListeningDistractorMatches('The route was cheaper.', overlapQuestions),
        ({ kind, start, end }) => [kind, 'The route was cheaper.'.slice(start, end)]
    );
    assert.deepEqual(overlapMatches, [['correct', 'The route was cheaper']]);
    assert.deepEqual(Array.from(context.getListeningDistractorMatches('No related phrases.', questions)), []);
});

test('Listening answer diagnostics distinguish typos, plural mismatches, and incorrect answers', () => {
    const { context } = createTestPlayerContext();

    assert.equal(context.classifyListeningAnswerError('enviroment', 'environment'), 'typo');
    assert.equal(context.classifyListeningAnswerError('book', 'books'), 'plural_singular');
    assert.equal(context.classifyListeningAnswerError('bus', 'buses'), 'plural_singular');
    assert.equal(context.classifyListeningAnswerError('house', 'houses'), 'plural_singular');
    assert.equal(context.classifyListeningAnswerError('children', 'child'), 'plural_singular');
    assert.equal(context.classifyListeningAnswerError('river', 'mountain'), 'incorrect');
    assert.equal(context.classifyListeningAnswerError('', 'mountain'), 'unanswered');
    assert.equal(context.classifyListeningAnswerError('Environment!', 'environment'), null);
});

test('Speaking Part 2 simulation records for one minute of prep and two minutes without manual stop', async () => {
    const { context, elements } = createTestPlayerContext();
    let now = 1_000_000;
    let tick;
    let recorder;
    let stoppedTracks = 0;
    context.Date = class extends Date {
        static now() { return now; }
    };
    context.setInterval = callback => {
        tick = callback;
        return 2;
    };
    context.clearInterval = () => {};
    context.setTimeout = () => 1;
    context.clearTimeout = () => {};
    context.navigator = {
        mediaDevices: {
            getUserMedia: async () => ({
                getTracks: () => [{ stop: () => { stoppedTracks++; } }]
            })
        }
    };
    context.MediaRecorder = class {
        constructor(_stream, options) {
            this.state = 'inactive';
            this.mimeType = 'audio/webm';
            this.options = options;
            recorder = this;
        }
        start() { this.state = 'recording'; }
        stop() {
            this.state = 'inactive';
            this.ondataavailable({ data: new Blob(['spoken response']) });
            this.onstop();
        }
    };
    context.Blob = Blob;
    context.FileReader = class {
        readAsDataURL() {
            this.result = 'data:audio/webm;base64,c3Bva2Vu';
            this.onload();
        }
    };
    context.document.getElementById = id => {
        if (!elements.has(id)) elements.set(id, createElement());
        return elements.get(id);
    };
    context.APP_DATA = {
        module: 'speaking',
        parts: [{ questions: [{ type: 'audio_record', ids: [42] }] }]
    };
    elements.set('mic-playback-42', createElement());
    context.currentPartIdx = 0;
    context.answers = {};

    await vm.runInContext('startSpeakingPartTwoSimulation()', context);
    assert.match(elements.get('speaking-simulation-status').textContent, /Preparation time/);
    assert.equal(elements.get('exam-submit-btn').disabled, true);
    assert.equal(recorder.state, 'inactive');

    now += 59_999;
    tick();
    assert.equal(recorder.state, 'inactive');
    now += 1;
    tick();
    assert.equal(recorder.state, 'recording');
    assert.equal(recorder.options.audioBitsPerSecond, 32_000);

    now += 119_999;
    tick();
    assert.equal(recorder.state, 'recording');
    now += 1;
    tick();
    assert.equal(recorder.state, 'inactive');
    assert.equal(context.answers[42], 'data:audio/webm;base64,c3Bva2Vu');
    assert.equal(elements.get('exam-submit-btn').disabled, false);
    assert.equal(stoppedTracks, 1);
});

test('dynamic mind map renders safe task vocabulary and grouped discourse markers', () => {
    const context = { window: null };
    context.window = context;
    vm.createContext(context);
    vm.runInContext(readAppScript('dynamic-mindmap.js'), context);

    const html = context.renderDynamicMindMap(
        {
            title: '<p>Describe a place &amp; explain why you like it</p>',
            mindMap: {
                phrases: [
                    { branch: 'support', term: 'improve public transport', detail: 'More frequent buses and trains' },
                    { branch: 'example', term: '<img src=x onerror=alert(1)>' }
                ],
                topics: [{ label: 'Transport', ideas: ['More people commute by bus', 'Fewer cars in city centres', '<svg onload=alert(1)>'] }]
            }
        },
        [
            { term: 'a hidden gem', eng: 'A little-known place' },
            { term: '<img src=x onerror=alert(1)>' }
        ],
        'sample-topic-network',
        ['Work', 'Society & Culture']
    );

    assert.match(html, /Describe a place &amp; explain why you like it/);
    assert.match(html, /a hidden gem/);
    assert.match(html, /To begin with/);
    assert.match(html, /On the other hand/);
    assert.match(html, /data-mindmap-select-branch="example"/);
    assert.match(html, /Cross-topic Idea Network/);
    assert.match(html, /data-network-topic="topic-work"/);
    assert.match(html, /Society &amp; Culture/);
    assert.match(html, /data-network-add-topic/);
    assert.match(html, /data-network-add-idea="topic-work"/);
    assert.match(html, /data-network-link-mode/);
    assert.match(html, /not submitted/);
    assert.match(html, /improve public transport/);
    assert.match(html, /data-mindmap-default-branch="support"/);
    assert.match(html, /data-mindmap-draggable="true"/);
    assert.match(html, /More people commute by bus/);
    assert.match(html, /Fewer cars in city centres/);
    assert.match(html, /data-network-topic="topic-transport"/);
    assert.doesNotMatch(html, /<svg onload=alert/);
    assert.doesNotMatch(html, /<img src=x/);
    assert.doesNotMatch(html, /onerror=alert/);

    const partOneWords = context.filterDynamicMindMapVocabulary(
        [
            { term: 'Part one term', part: 'Part 1' },
            { term: 'Part two term', part: 'Part 2' },
            { term: 'Legacy unassigned term' }
        ],
        { title: '<b>Part 1</b>' },
        0,
        2
    );
    assert.deepEqual(Array.from(partOneWords, word => word.term), ['Part one term', 'Legacy unassigned term']);
    assert.equal(context.hasDynamicMindMapContent({ title: 'Writing task' }, []), false);
    assert.equal(context.hasDynamicMindMapContent({ title: 'Speaking task', mindMap: { topics: [{ label: 'Work', ideas: [] }] } }, []), false);
    assert.equal(context.hasDynamicMindMapContent(
        { title: 'Speaking task', mindMap: { phrases: [{ branch: 'main', term: 'develop confidence' }] } },
        []
    ), true);
    assert.equal(context.hasDynamicMindMapContent(
        { title: 'Writing task', mindMap: { topics: [{ label: 'Education', ideas: ['Online learning'] }] } },
        []
    ), true);
    assert.equal(context.hasDynamicMindMapContent(
        { title: 'Writing task' },
        [{ term: 'make a contribution' }]
    ), true);
    assert.equal(context.shouldRenderDynamicMindMap('writing', { title: 'Task' }, []), false);
    assert.equal(context.shouldRenderDynamicMindMap('speaking', { title: 'Task' }, []), false);
    assert.equal(context.shouldRenderDynamicMindMap(
        'writing',
        { title: 'Task', mindMap: { topics: [{ label: 'Education', ideas: ['Online learning'] }] } },
        []
    ), true);
    assert.equal(context.shouldRenderDynamicMindMap('reading', { title: 'Task' }, []), true);
});

test('scaffolded Writing provides task-specific blocks and combines them into a submission-ready essay', () => {
    const context = { window: null };
    context.window = context;
    vm.createContext(context);
    vm.runInContext(readAppScript('scaffolded-writing.js'), context);

    const taskTwo = Array.from(context.getScaffoldedWritingBlocks({ title: 'Writing Task 2' }), block => block.id);
    const taskOne = Array.from(context.getScaffoldedWritingBlocks({ writingTask: 'task1' }), block => block.id);
    assert.deepEqual(taskTwo, ['paraphrase', 'thesis', 'body-one', 'body-two', 'conclusion']);
    assert.deepEqual(taskOne, ['paraphrase', 'overview', 'details-one', 'details-two']);

    const blocks = ['The chart shows...', 'Overall, ...', 'First, ...', 'In comparison, ...'];
    const combined = context.combineScaffoldedWritingBlocks(blocks);
    assert.equal(combined, blocks.join('\n\n'));
    assert.deepEqual(
        Array.from(context.splitScaffoldedWritingAnswer(combined, 4)),
        blocks
    );
    assert.deepEqual(
        Array.from(context.splitScaffoldedWritingAnswer('An older response with no paragraph breaks.', 5)),
        ['An older response with no paragraph breaks.']
    );
    assert.deepEqual(
        Array.from(context.splitScaffoldedWritingAnswer('A\n\nB\n\nC\n\nD\n\nE\n\nF', 4)),
        ['A', 'B', 'C', 'D\n\nE\n\nF']
    );
});

test('reading syntax chunking keeps the selected range when a label button takes focus', () => {
    const root = {
        contains: () => true,
        querySelectorAll: () => []
    };
    const status = { textContent: '' };
    const textNode = { nodeType: 3, parentElement: { closest: () => ({}) } };
    const endTextNode = { nodeType: 3, parentElement: { closest: () => ({}) } };
    let insertedChunk = null;
    const range = {
        commonAncestorContainer: textNode,
        startContainer: textNode,
        endContainer: endTextNode,
        collapsed: false,
        cloneRange() { return this; },
        intersectsNode: () => false,
        extractContents: () => ({ textContent: 'The students' }),
        insertNode: chunk => { insertedChunk = chunk; }
    };
    const selection = {
        rangeCount: 1,
        isCollapsed: false,
        getRangeAt: () => range,
        removeAllRanges() { this.rangeCount = 0; this.isCollapsed = true; }
    };
    const documentListeners = {};
    const context = {
        window: null,
        document: {
            getElementById: id => ({
                'passage-text-content': root,
                'syntax-chunking-status': status
            })[id] || null,
            addEventListener: (name, callback) => { documentListeners[name] = callback; },
            createElement: () => ({
                dataset: {},
                setAttribute() {},
                appendChild(content) { this.content = content; }
            })
        }
    };
    context.window = context;
    context.getSelection = () => selection;
    context.window.getSelection = context.getSelection;
    vm.createContext(context);
    vm.runInContext(readAppScript('test-player.js'), context);

    documentListeners.selectionchange();
    selection.rangeCount = 0;
    selection.isCollapsed = true;
    context.applySyntaxChunk('subject');

    assert.equal(insertedChunk.className, 'syntax-chunk syntax-chunk--subject');
    assert.equal(insertedChunk.dataset.syntaxRole, 'subject');
    assert.equal(insertedChunk.content.textContent, 'The students');
    assert.match(status.textContent, /Đã đánh dấu/);
});

test('real-time writing analysis highlights grammar patterns, connectors, repetition, and escapes text', () => {
    const context = { window: null };
    context.window = context;
    vm.createContext(context);
    vm.runInContext(readAppScript('scaffolded-writing.js'), context);

    const text = 'I has a apple. However, the public transport system improves cities. The public transport system improves cities.';
    const analysis = context.analyzeWritingText(text);
    const highlights = Array.from(analysis.highlights, item => ({
        kind: item.kind,
        text: item.text
    }));

    assert.ok(highlights.some(item => item.kind === 'grammar' && item.text === 'I has'));
    assert.ok(highlights.some(item => item.kind === 'grammar' && item.text === 'a '));
    assert.ok(highlights.some(item => item.kind === 'discourse' && item.text === 'However'));
    assert.ok(highlights.filter(item => item.kind === 'repetition').length >= 2);
    assert.deepEqual(Array.from(context.analyzeWritingText('').highlights), []);

    const markup = context.renderWritingTextAnalyzer('<script>alert(1)</script>');
    assert.doesNotMatch(markup, /<script>/);
    assert.match(markup, /&lt;script&gt;/);
    assert.match(context.renderWritingTextAnalyzer(''), /Start writing to see live highlights/);
});

test('Listening fill-in typo classifications are stored with each submission', async () => {
    const { context, savedDocuments } = createTestPlayerContext();
    context.APP_DATA.module = 'listening';
    context.APP_DATA.parts[0].questions[0].correctAnswers[1] = 'environment';
    context.answers[1] = 'enviroment';

    await context.exitTest(true);

    const submission = savedDocuments.find(({ reference }) => reference.collection === 'submissions').value;
    assert.deepEqual(submission.questionAnalytics[0].errorDetails, [{
        id: 1,
        category: 'typo',
        given: 'enviroment',
        expected: 'environment'
    }]);
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
    assert.match(modeMarkup, /id="student-part-search"/);
    assert.match(modeMarkup, /data-test-part-action="all"/);
    assert.doesNotMatch(modeMarkup, /onclick=/);

    const listeners = { click: [], input: [] };
    const calls = [];
    const context = {
        window: {
            selectTestMode: mode => calls.push(['mode', mode]),
            cancelTestRouteStart: () => calls.push('cancel'),
            confirmStartTest: () => calls.push('start'),
            openTestActivities: () => calls.push('activities'),
            selectStudentTestParts: index => calls.push(['parts', index]),
            filterStudentTestParts: query => calls.push(['filter-parts', query])
        },
        document: {
            getElementById: () => null,
            addEventListener: (name, callback) => {
                if (listeners[name]) listeners[name].push(callback);
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
        listeners.click.forEach(listener => listener({
            target: { closest: selector => selector === 'button[data-test-action]' ? button : null }
        }));
    }
    for (const action of [
        { testPartAction: 'all' },
        { testPartAction: 'single', partIndex: '2' }
    ]) {
        const button = { dataset: action };
        listeners.click.forEach(listener => listener({
            target: { closest: selector => selector === 'button[data-test-part-action]' ? button : null }
        }));
    }
    listeners.input.forEach(listener => listener({
        target: { id: 'student-part-search', value: 'Passage 2' }
    }));

    assert.deepEqual(calls, [
        ['mode', 'free'],
        ['mode', 'restricted'],
        'cancel',
        'start',
        'activities',
        ['parts', undefined],
        ['parts', 2],
        ['filter-parts', 'Passage 2']
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

test('test banks create searchable single-part entries alongside the full test', () => {
    const readingTest = {
        id: 'cam-07-test-1',
        title: 'Cam 07 Test 1 Reading',
        topics: ['Cambridge 07'],
        parts: [
            { title: '<b>Let’s Go Bats</b>' },
            { title: '<h2><b>Making Every Drop Count</b></h2>' },
            { title: '<h2><b>EDUCATING PSYCHE</b></h2>' }
        ]
    };
    const singlePartTest = {
        id: 'writing-task-1',
        title: 'Writing Task 1',
        parts: [{ title: 'Chart Description' }]
    };
    const entries = buildTestBankEntries([readingTest, singlePartTest]);

    assert.deepEqual(entries.map(entry => [entry.test.id, entry.partIndex]), [
        ['cam-07-test-1', null],
        ['cam-07-test-1', 0],
        ['cam-07-test-1', 1],
        ['cam-07-test-1', 2],
        ['writing-task-1', null]
    ]);
    assert.deepEqual(entries.filter(entry => matchesTestBankEntry(entry, 'bats')).map(entry => [
        entry.test.id,
        entry.partIndex
    ]), [
        ['cam-07-test-1', null],
        ['cam-07-test-1', 0]
    ]);
    assert.deepEqual(entries.filter(entry => matchesTestBankEntry(entry, 'making every drop')).map(entry => [
        entry.test.id,
        entry.partIndex
    ]), [
        ['cam-07-test-1', null],
        ['cam-07-test-1', 1]
    ]);
    assert.equal(cleanTestBankLabel('<h2><b>EDUCATING PSYCHE</b></h2>'), 'EDUCATING PSYCHE');
    assert.equal(cleanTestBankLabel('Transport from Airport to Milton<br>'), 'Transport from Airport to Milton');
});

test('teacher test bank renders virtual part entries and labels parent-test actions', () => {
    const source = readAppScript('teacher-dashboard.js');

    assert.match(source, /window\.buildTestBankEntries\(TEST_BANK\)/);
    assert.match(source, /window\.matchesTestBankEntry\(entry, query\)/);
    assert.match(source, /const cardTitle = isPartEntry \? partTitle : window\.cleanTestBankLabel\(t\.title\)/);
    assert.match(source, /Assign full test; students can choose this part separately/);
});
