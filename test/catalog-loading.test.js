const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

const landingScript = fs.readFileSync(path.join(__dirname, '..', 'js', 'landing.js'), 'utf8');

function createLandingContext(getDocs) {
    const renderStates = [];
    const context = {
        console: { ...console, error: () => {} },
        Date,
        Intl,
        Math,
        JSON,
        Number,
        String,
        Array,
        Object,
        Set,
        Map,
        Promise,
        Blob,
        document: { getElementById: () => null, querySelectorAll: () => [] },
        fsDoc: (database, collection, id) => ({ collection, id }),
        fsCollection: (database, collection) => ({ collection }),
        fPath: collection => collection,
        fsGetDoc: async () => ({ exists: () => false, data: () => ({}) }),
        fsGetDocs: getDocs,
        db: {},
        window: null,
        renderStates
    };
    context.window = context;
    vm.createContext(context);
    vm.runInContext(landingScript, context);
    context.renderPublicProfile = () => renderStates.push(context.publicPackagesStatus);
    return context;
}

test('public packages remain in a loading state until packages are fetched', async () => {
    let resolvePackages;
    const context = createLandingContext(reference => new Promise(resolve => {
        if (reference.collection === 'packages') resolvePackages = resolve;
        else resolve({ docs: [] });
    }));

    const load = context.loadPublicLandingData();
    assert.equal(context.publicPackagesStatus, 'loading');
    assert.match(context.getPublicPackagesStatusMarkup(), /Đang tải thông tin khóa học/);
    assert.deepEqual(context.renderStates, ['loading']);

    resolvePackages({ docs: [] });
    assert.equal(await load, true);
    assert.equal(context.publicPackagesStatus, 'loaded');
    assert.equal(context.getPublicPackagesStatusMarkup(), '');
});

test('public package query errors show a retry state instead of claiming no packages exist', async () => {
    let shouldFail = true;
    const context = createLandingContext(async reference => {
        if (shouldFail && reference.collection === 'packages') throw new Error('Firestore unavailable');
        return { docs: [] };
    });

    assert.equal(await context.loadPublicLandingData(), false);
    assert.equal(context.publicPackagesStatus, 'error');
    assert.match(context.getPublicPackagesStatusMarkup(), /Thử tải lại/);

    shouldFail = false;
    assert.equal(await context.loadPublicLandingData(), true);
    assert.equal(context.publicPackagesStatus, 'loaded');
    assert.equal(context.getPublicPackagesStatusMarkup(), '');
});
