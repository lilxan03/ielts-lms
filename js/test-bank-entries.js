(function(root) {
    function cleanTestBankLabel(value = '') {
        return String(value || '')
            .replace(/<br\s*\/?>/gi, ' ')
            .replace(/<\/(?:p|div|h[1-6]|li|tr)>/gi, ' ')
            .replace(/<[^>]*>/g, ' ')
            .replace(/&nbsp;|&#160;/gi, ' ')
            .replace(/&amp;/gi, '&')
            .replace(/&lt;/gi, '<')
            .replace(/&gt;/gi, '>')
            .replace(/&quot;/gi, '"')
            .replace(/&#0?39;|&apos;/gi, "'")
            .replace(/\s+/g, ' ')
            .trim();
    }

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
            .map(cleanTestBankLabel)
            .join(' ')
            .toLocaleLowerCase()
            .includes(normalizedQuery);
    }

    root.cleanTestBankLabel = cleanTestBankLabel;
    root.buildTestBankEntries = buildTestBankEntries;
    root.matchesTestBankEntry = matchesTestBankEntry;
    if (typeof module !== 'undefined' && module.exports) {
        module.exports = { buildTestBankEntries, cleanTestBankLabel, matchesTestBankEntry };
    }
})(typeof window !== 'undefined' ? window : globalThis);
