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

    function getStudentDisplayName(profile, authUser) {
        const uid = String(profile?.uid || authUser?.uid || '');
        const profileName = [
            profile?.displayName,
            profile?.fullName,
            profile?.realName,
            authUser?.displayName
        ].find(value => typeof value === 'string' && value.trim() && value.trim() !== uid);
        if (profileName) return profileName.trim();

        const email = String(profile?.email || authUser?.email || '').trim();
        if (email.includes('@') && !email.toLowerCase().endsWith('@khanhlms.com')) {
            return email.slice(0, email.indexOf('@'));
        }

        const username = String(profile?.user || '').trim();
        return username && username !== uid ? username : 'Student';
    }

    return Object.freeze({ isValidUsername, usernameToAuthEmail, loginIdentifierToAuthEmail, getStudentDisplayName });
});
