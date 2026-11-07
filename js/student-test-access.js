(function(root) {
    function collectTestIds(...sources) {
        const ids = new Set();
        sources.forEach(source => {
            if (!source) return;
            (Array.isArray(source.assignedTests) ? source.assignedTests : []).forEach(id => ids.add(id));
            Object.keys(source.testSettings || {}).forEach(id => ids.add(id));
        });
        return [...ids].filter(id => typeof id === 'string' && id && !id.includes('/'));
    }

    function collectScheduleTestIds(schedule) {
        return [...new Set([
            ...(Array.isArray(schedule.assignedTests) ? schedule.assignedTests : []),
            ...(Array.isArray(schedule.materialIds) ? schedule.materialIds : []),
            ...(Array.isArray(schedule.homeworkTests) ? schedule.homeworkTests : [])
        ])].filter(id => typeof id === 'string' && id && !id.includes('/'));
    }

    function buildStudentTestAccessEntries(user, classes, schedules) {
        if (!user?.uid || !user?.user) return [];

        const templates = new Set(classes
            .filter(cls => !cls.parentClassId && (cls.isTemplate || classes.some(child => child.parentClassId === cls.id)))
            .map(cls => cls.id));
        const enrolledClasses = classes.filter(cls =>
            cls.id
            && !templates.has(cls.id)
            && Array.isArray(cls.enrolledStudents)
            && cls.enrolledStudents.includes(user.user)
        );
        const access = new Map();
        const add = (testId, entry) => {
            if (!access.has(testId) || (access.get(testId).source === 'schedule' && entry.source === 'class')) {
                access.set(testId, {
                    uid: user.uid,
                    username: user.user,
                    testId,
                    ...entry
                });
            }
        };

        enrolledClasses.forEach(cls => {
            const parent = cls.parentClassId ? classes.find(candidate => candidate.id === cls.parentClassId) : null;
            const inherited = {
                assignedTests: cls.inheritedAssignedTests,
                testSettings: cls.inheritedTestSettings
            };
            collectTestIds(cls, parent, inherited).forEach(testId => {
                add(testId, { classId: cls.id, source: 'class' });
            });
        });

        schedules.forEach(schedule => {
            const matches = enrolledClasses.filter(cls => cls.id === schedule.classId);
            if (matches.length !== 1) return;

            const cls = matches[0];
            const attendees = Array.isArray(schedule.attendingStudents)
                ? schedule.attendingStudents
                : cls.enrolledStudents;
            if (!attendees.includes(user.user)) return;

            collectScheduleTestIds(schedule).forEach(testId => {
                add(testId, {
                    classId: cls.id,
                    scheduleId: schedule.id,
                    source: 'schedule'
                });
            });
        });

        return [...access.values()];
    }

    root.buildStudentTestAccessEntries = buildStudentTestAccessEntries;
    if (typeof module !== 'undefined' && module.exports) {
        module.exports = { buildStudentTestAccessEntries };
    }
})(typeof window !== 'undefined' ? window : globalThis);
