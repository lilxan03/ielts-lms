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

function buildStudentTestAccess(accounts, classes, schedules) {
  const students = new Map(
    accounts
      .filter(account => account.role === 'student' && account.username)
      .map(account => [account.username, account.uid])
  );
  const classesById = new Map(classes.map(cls => [cls.id, cls]));
  const classesByName = new Map();
  classes.forEach(cls => {
    if (!cls.name) return;
    const matches = classesByName.get(cls.name) || [];
    matches.push(cls);
    classesByName.set(cls.name, matches);
  });
  const access = new Map();
  const add = (username, testId, entry) => {
    const uid = students.get(username);
    if (!uid) return;
    const key = `${uid}/${testId}`;
    const existing = access.get(key);
    if (!existing || (existing.source === 'schedule' && entry.source === 'class')) {
      access.set(key, { uid, username, testId, ...entry });
    }
  };

  classes.forEach(cls => {
    const parentClass = cls.parentClassId ? classesById.get(cls.parentClassId) : null;
    collectTestIds(cls, parentClass).forEach(testId => {
      (Array.isArray(cls.enrolledStudents) ? cls.enrolledStudents : [])
        .forEach(username => add(username, testId, { classId: cls.id, source: 'class' }));
    });
  });

  schedules.forEach(schedule => {
    const classMatches = schedule.classId
      ? [classesById.get(schedule.classId)].filter(Boolean)
      : classesByName.get(schedule.className) || [];
    if (classMatches.length !== 1) return;
    const cls = classMatches[0];
    const attendees = Array.isArray(schedule.attendingStudents)
      ? schedule.attendingStudents
      : (Array.isArray(cls.enrolledStudents) ? cls.enrolledStudents : []);
    collectScheduleTestIds(schedule).forEach(testId => {
      attendees.forEach(username => add(username, testId, {
        classId: cls.id,
        scheduleId: schedule.id,
        source: 'schedule'
      }));
    });
  });

  return [...access.values()];
}

module.exports = { buildStudentTestAccess };
