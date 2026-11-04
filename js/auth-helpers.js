(function (root, factory) {
    const helpers = factory();
    if (root) root.LMSAuthHelpers = helpers;
    if (typeof module !== 'undefined' && module.exports) module.exports = helpers;
})(typeof window !== 'undefined' ? window : null, function () {
    function isValidUsername(username) {
        return /^[A-Za-z0-9_-]{1,40}$/.test(username);
    }

    function usernameToAuthEmail(username) {
        const safeEmailPrefix = encodeURIComponent(username).replace(/%/g, '').toLowerCase();
        return `${safeEmailPrefix}@khanhlms.com`;
    }

    function loginIdentifierToAuthEmail(identifier) {
        const value = String(identifier || '').trim();
        return value.includes('@') ? value.toLowerCase() : usernameToAuthEmail(value);
    }

    return Object.freeze({ isValidUsername, usernameToAuthEmail, loginIdentifierToAuthEmail });
});
