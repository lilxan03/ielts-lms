(function (root, factory) {
    const helpers = factory(root);
    if (root) {
        root.LMSAuthHelpers = helpers;
        root.formatUserDisplayName = helpers.getStudentDisplayName;
    }
    if (typeof module !== 'undefined' && module.exports) module.exports = helpers;
})(typeof window !== 'undefined' ? window : typeof globalThis !== 'undefined' ? globalThis : null, function (root) {
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

    function isLikelyUid(value, explicitUid = '') {
        const str = String(value || '').trim();
        if (!str) return false;
        if (explicitUid && str === String(explicitUid).trim()) return true;
        return !str.includes('@') && !/\s/.test(str) && /^[A-Za-z0-9_-]{20,}$/.test(str);
    }

    function resolveProfileObject(profileOrId, usersList) {
        if (profileOrId && typeof profileOrId === 'object') return profileOrId;
        const key = String(profileOrId || '').trim();
        if (!key) return null;
        const list = Array.isArray(usersList)
            ? usersList
            : (root && Array.isArray(root.USERS) ? root.USERS : []);
        const found = list.find(u =>
            u && (u.user === key || u.username === key || u.uid === key || u.email === key)
        );
        if (found) return found;
        if (root?.currentUser && (root.currentUser.user === key || root.currentUser.uid === key || root.currentUser.username === key)) {
            return root.currentUser;
        }
        return { user: key };
    }

    function getStudentDisplayName(profileOrId, authUser, usersList) {
        const profile = resolveProfileObject(profileOrId, usersList);
        const uid = String(profile?.uid || authUser?.uid || '').trim();

        // Only use authUser fallback fields if authUser actually belongs to this profile
        const isSameAsAuthUser = Boolean(
            authUser && (
                !profile ||
                (!profile.user && !profile.uid && !profile.email) ||
                (profile.uid && profile.uid === authUser.uid) ||
                (profile.user && profile.user === authUser.uid) ||
                (profile.email && authUser.email && String(profile.email).toLowerCase() === String(authUser.email).toLowerCase())
            )
        );
        const matchedAuth = isSameAsAuthUser ? authUser : null;

        const profileName = [
            profile?.displayName,
            profile?.fullName,
            profile?.realName,
            profile?.name,
            matchedAuth?.displayName
        ].find(value => typeof value === 'string' && value.trim() && !isLikelyUid(value, uid));
        if (profileName) return profileName.trim();

        const email = String(profile?.email || matchedAuth?.email || '').trim();
        if (email.includes('@') && !email.toLowerCase().endsWith('@khanhlms.com')) {
            const prefix = email.slice(0, email.indexOf('@')).trim();
            if (prefix && !isLikelyUid(prefix, uid)) return prefix;
        }

        const internalPrefix = email.toLowerCase().endsWith('@khanhlms.com')
            ? email.slice(0, email.indexOf('@')).trim()
            : '';

        const usernameCandidate = [
            profile?.username,
            internalPrefix,
            profile?.user
        ].find(value => typeof value === 'string' && value.trim() && !isLikelyUid(value, uid) && !String(value).toLowerCase().endsWith('@khanhlms.com'));
        if (usernameCandidate) return usernameCandidate.trim();

        if (typeof profile?.parentName === 'string' && profile.parentName.trim() && !isLikelyUid(profile.parentName, uid)) {
            return profile.parentName.trim();
        }

        return 'Student';
    }

    return Object.freeze({
        isValidUsername,
        usernameToAuthEmail,
        loginIdentifierToAuthEmail,
        isLikelyUid,
        getStudentDisplayName
    });
});
