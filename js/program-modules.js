(function(root) {
    const IELTS_SKILL_MODULES = ['reading', 'listening', 'writing', 'speaking'];
    const PROGRAM_MODULE_ORDER = ['ielts', 'toeic', 'corporate', 'activity'];

    const PROGRAM_MODULE_META = {
        ielts: {
            id: 'ielts',
            icon: '🎓',
            labelEn: 'IELTS',
            labelVi: 'IELTS',
            subEn: '4 Skills (R · L · W · S)',
            subVi: '4 kỹ năng (Nghe · Nói · Đọc · Viết)',
            filterEn: 'IELTS (4 Skills)',
            filterVi: 'IELTS (4 kỹ năng)',
            borderClass: 'border-blue-200',
            hoverBgClass: 'hover:bg-blue-50',
            subTextClass: 'text-blue-600'
        },
        toeic: {
            id: 'toeic',
            icon: '💼',
            labelEn: 'TOEIC',
            labelVi: 'TOEIC',
            subEn: 'L&R / S&W',
            subVi: 'Nghe & Đọc / Nói & Viết',
            filterEn: 'TOEIC',
            filterVi: 'TOEIC',
            borderClass: 'border-teal-200',
            hoverBgClass: 'hover:bg-teal-50',
            subTextClass: 'text-teal-700'
        },
        corporate: {
            id: 'corporate',
            icon: '🏢',
            labelEn: 'Corporate',
            labelVi: 'Doanh nghiệp',
            subEn: 'Staff Training',
            subVi: 'Tiếng Anh Nhân viên',
            filterEn: 'Corporate / Staff',
            filterVi: 'Tiếng Anh Doanh nghiệp',
            borderClass: 'border-violet-200',
            hoverBgClass: 'hover:bg-violet-50',
            subTextClass: 'text-violet-700'
        },
        activity: {
            id: 'activity',
            icon: '🎯',
            labelEn: 'Activities',
            labelVi: 'Hoạt động',
            subEn: 'Interactive Practice',
            subVi: 'Hoạt động tương tác',
            filterEn: 'Activities',
            filterVi: 'Hoạt động',
            borderClass: 'border-fuchsia-200',
            hoverBgClass: 'hover:bg-fuchsia-50',
            subTextClass: 'text-fuchsia-700'
        }
    };

    function getTestProgramModule(testOrModule) {
        const raw = typeof testOrModule === 'string'
            ? testOrModule
            : (testOrModule && testOrModule.module) || '';
        const normalized = String(raw).trim().toLowerCase();
        if (IELTS_SKILL_MODULES.includes(normalized) || normalized === 'ielts') {
            return 'ielts';
        }
        if (PROGRAM_MODULE_ORDER.includes(normalized)) {
            return normalized;
        }
        return normalized || 'ielts';
    }

    function normalizeProgramList(programs) {
        if (!Array.isArray(programs)) return [];
        const seen = new Set();
        programs.forEach(item => {
            const prog = getTestProgramModule(item);
            if (PROGRAM_MODULE_ORDER.includes(prog)) {
                seen.add(prog);
            }
        });
        return PROGRAM_MODULE_ORDER.filter(prog => seen.has(prog));
    }

    function matchesProgramFilter(testOrModule, filterValue) {
        const filter = String(filterValue || 'all').trim().toLowerCase();
        if (!filter || filter === 'all') return true;
        const rawModule = String(
            typeof testOrModule === 'string'
                ? testOrModule
                : (testOrModule && testOrModule.module) || ''
        ).trim().toLowerCase();
        if (filter === 'ielts') {
            return getTestProgramModule(rawModule) === 'ielts';
        }
        return rawModule === filter;
    }

    function getStudentVisiblePrograms(cls, user, assignedTests) {
        const studentKey = user && user.user ? String(user.user) : '';
        const classStudentPrograms = studentKey && cls && cls.studentPrograms && cls.studentPrograms[studentKey];
        const explicitStudent = normalizeProgramList(classStudentPrograms || (user && user.allowedPrograms));
        if (explicitStudent.length > 0) {
            return explicitStudent;
        }

        const explicitClass = normalizeProgramList(cls && cls.allowedPrograms);
        if (explicitClass.length > 0) {
            return explicitClass;
        }

        const inferred = normalizeProgramList(
            (Array.isArray(assignedTests) ? assignedTests : []).map(t => t && t.module)
        );
        if (inferred.length > 0) {
            return inferred;
        }

        return [...PROGRAM_MODULE_ORDER];
    }

    function filterTestsByAllowedPrograms(tests, allowedPrograms) {
        const allowed = normalizeProgramList(allowedPrograms);
        if (!allowed.length) return Array.isArray(tests) ? tests : [];
        const allowedSet = new Set(allowed);
        return (Array.isArray(tests) ? tests : []).filter(t => allowedSet.has(getTestProgramModule(t)));
    }

    root.IELTS_SKILL_MODULES = IELTS_SKILL_MODULES;
    root.PROGRAM_MODULE_ORDER = PROGRAM_MODULE_ORDER;
    root.PROGRAM_MODULE_META = PROGRAM_MODULE_META;
    root.getTestProgramModule = getTestProgramModule;
    root.normalizeProgramList = normalizeProgramList;
    root.matchesProgramFilter = matchesProgramFilter;
    root.getStudentVisiblePrograms = getStudentVisiblePrograms;
    root.filterTestsByAllowedPrograms = filterTestsByAllowedPrograms;

    if (typeof module !== 'undefined' && module.exports) {
        module.exports = {
            IELTS_SKILL_MODULES,
            PROGRAM_MODULE_ORDER,
            PROGRAM_MODULE_META,
            getTestProgramModule,
            normalizeProgramList,
            matchesProgramFilter,
            getStudentVisiblePrograms,
            filterTestsByAllowedPrograms
        };
    }
})(typeof window !== 'undefined' ? window : globalThis);
