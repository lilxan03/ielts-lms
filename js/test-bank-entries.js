(function(root) {
    function buildTestBankEntries(tests) {
        return (Array.isArray(tests) ? tests : []).flatMap(test => [
            { test, partIndex: null },
            ...(Array.isArray(test?.parts) && test.parts.length > 1
                ? test.parts.map((_, partIndex) => ({ test, partIndex }))
                : [])
        ]);
    }

    function matchesTestBankEntry(entry, query) {
        const normalizedQuery = String(query || '').trim().toLocaleLowerCase();
        if (!normalizedQuery) return true;

        const test = entry?.test;
        const titles = [test?.title, ...(Array.isArray(test?.topics) ? test.topics : [])];
        if (Number.isInteger(entry?.partIndex)) {
            titles.push(test?.parts?.[entry.partIndex]?.title);
        } else {
            titles.push(...(Array.isArray(test?.parts) ? test.parts.map(part => part?.title) : []));
        }

        return titles
            .filter(value => typeof value === 'string')
            .join(' ')
            .toLocaleLowerCase()
            .includes(normalizedQuery);
    }

    root.buildTestBankEntries = buildTestBankEntries;
    root.matchesTestBankEntry = matchesTestBankEntry;
    if (typeof module !== 'undefined' && module.exports) {
        module.exports = { buildTestBankEntries, matchesTestBankEntry };
    }
})(typeof window !== 'undefined' ? window : globalThis);
