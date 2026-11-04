    function waitForInitialSnapshot(label, reference, onSnapshot) {
        return new Promise((resolve, reject) => {
            let unsubscribe;
            let initialized = false;
            const timeout = setTimeout(() => {
                handleError(new Error('Timed out waiting for the first database response.'));
            }, 20000);
            const handleError = error => {
                if (initialized) {
                    console.error(`Firestore listener failed for ${label}:`, error);
                    return;
                }
                initialized = true;
                clearTimeout(timeout);
                if (typeof unsubscribe === 'function') unsubscribe();
                reject(new Error(`Unable to load ${label}: ${error.message || error}`));
            };

            try {
                unsubscribe = window.fsOnSnapshot(reference, snapshot => {
                    try {
                        onSnapshot(snapshot);
                        if (!initialized) {
                            initialized = true;
                            clearTimeout(timeout);
                            resolve();
                        }
                    } catch (error) {
                        handleError(error);
                    }
                }, handleError);
            } catch (error) {
                handleError(error);
            }
        });
    }

    function waitForAssignedStudentTests() {
        return new Promise((resolve, reject) => {
            let initialized = false;
            let accessUnsubscribe;
            const testUnsubscribes = new Map();
            const loadedTests = new Map();
            const initialTestIds = new Set();
            const settledTestIds = new Set();
            const timeout = setTimeout(() => {
                if (!initialized) {
                    initialized = true;
                    accessUnsubscribe?.();
                    testUnsubscribes.forEach(unsubscribe => unsubscribe());
                    reject(new Error('Timed out waiting for your assigned tests.'));
                }
            }, 20000);
            const updateTestBank = () => {
                TEST_BANK = [...loadedTests.values()];
                window.triggerUIRefresh();
            };
            const settleInitialTest = testId => {
                settledTestIds.add(testId);
                if (!initialized && [...initialTestIds].every(id => settledTestIds.has(id))) {
                    initialized = true;
                    clearTimeout(timeout);
                    resolve();
                }
            };

            try {
                const accessCollection = window.fsCollection(
                    window.db,
                    'student_test_access',
                    currentUser.uid,
                    'tests'
                );
                accessUnsubscribe = window.fsOnSnapshot(accessCollection, snapshot => {
                    const testIds = new Set(snapshot.docs.map(doc => doc.id));
                    if (!initialized) {
                        initialTestIds.forEach(testId => {
                            if (!testIds.has(testId)) initialTestIds.delete(testId);
                        });
                    }
                    for (const [testId, unsubscribe] of testUnsubscribes) {
                        if (!testIds.has(testId)) {
                            unsubscribe();
                            testUnsubscribes.delete(testId);
                            loadedTests.delete(testId);
                        }
                    }

                    if (!initialized) {
                        testIds.forEach(testId => initialTestIds.add(testId));
                    }

                    testIds.forEach(testId => {
                        if (testUnsubscribes.has(testId)) return;
                        const testRef = window.fsDoc(window.db, window.fPath('tests'), testId);
                        const unsubscribe = window.fsOnSnapshot(testRef, testSnapshot => {
                            if (testSnapshot.exists()) loadedTests.set(testId, testSnapshot.data());
                            else loadedTests.delete(testId);
                            updateTestBank();
                            if (!initialized) settleInitialTest(testId);
                        }, error => {
                            testUnsubscribes.delete(testId);
                            if (error.code === 'permission-denied') {
                                loadedTests.delete(testId);
                                updateTestBank();
                                if (!initialized) settleInitialTest(testId);
                                return;
                            }
                            if (!initialized) {
                                initialized = true;
                                clearTimeout(timeout);
                                accessUnsubscribe?.();
                                testUnsubscribes.forEach(stop => stop());
                                reject(new Error(`Unable to load an assigned test: ${error.message || error}`));
                            } else {
                                console.error(`Assigned test listener failed for ${testId}:`, error);
                            }
                        });
                        testUnsubscribes.set(testId, unsubscribe);
                    });

                    if (!initialized && testIds.size === 0) {
                        initialized = true;
                        clearTimeout(timeout);
                        resolve();
                    } else if (!initialized && [...initialTestIds].every(id => settledTestIds.has(id))) {
                        initialized = true;
                        clearTimeout(timeout);
                        resolve();
                    }
                    updateTestBank();
                }, error => {
                    if (initialized) return;
                    initialized = true;
                    clearTimeout(timeout);
                    testUnsubscribes.forEach(unsubscribe => unsubscribe());
                    reject(new Error(`Unable to load your assigned-test list: ${error.message || error}`));
                });
            } catch (error) {
                clearTimeout(timeout);
                reject(error);
            }
        });
    }

    window.bootLMS = async function() {
        try {
            document.getElementById('cloud-loader-text').textContent = "Initializing App...";
            
            // Only teachers can seed initial data; student Rules do not allow querying users.
            if (currentUser?.role === 'teacher') {
                const firstUserQuery = window.fsQuery(window.fsCollection(window.db, window.fPath('users')), window.fsLimit(1));
                const uSnap = await window.fsGetDocs(firstUserQuery);
                if (uSnap.empty) await seedCloudData();
            }

            document.getElementById('cloud-loader-text').textContent = "Establishing Secure Connections...";

            // 2. Attach PUBLIC real-time listeners (Safe data everyone needs to see)
            await Promise.all([
                currentUser?.role === 'student'
                  ? waitForAssignedStudentTests()
                  : waitForInitialSnapshot('tests', window.fsCollection(window.db, window.fPath('tests')), snap => {
                      TEST_BANK = snap.docs.map(d => d.data());
                      window.triggerUIRefresh();
                  }),
                waitForInitialSnapshot(
                  'classes',
                  currentUser?.role === 'student'
                    ? window.fsQuery(
                        window.fsCollection(window.db, window.fPath('classes')),
                        window.fsWhere('enrolledStudents', 'array-contains', currentUser.user)
                      )
                    : window.fsCollection(window.db, window.fPath('classes')),
                  snap => {
                        CLASSES = snap.docs.map(d => d.data());
                        if (['teacher', 'collaborator'].includes(currentUser?.role)) {
                            window.syncPublicCourseCatalog(CLASSES).catch(error => {
                                console.error('Unable to synchronize the public course catalog:', error);
                                window.showToast?.('Course catalog sync failed', 'Deploy the latest Firestore rules and check staff access.', 'error');
                            });
                        }
                        if (currentUser?.role === 'student' && window.refreshStudentScheduleListeners) window.refreshStudentScheduleListeners();
                        if (currentUser?.role === 'student' && window.refreshStudentPresenceListeners) window.refreshStudentPresenceListeners();
                        window.triggerUIRefresh();
                  }
                ),
                waitForInitialSnapshot('billing settings', window.fsDoc(window.db, window.fPath('settings'), 'billing'), snap => {
                    if (snap.exists()) BILLING_SETTINGS = snap.data();
                }),
                waitForInitialSnapshot('availability settings', window.fsDoc(window.db, window.fPath('settings'), 'availability'), snap => {
                    if (snap.exists()) AVAILABILITY = snap.data();
                }),
                waitForInitialSnapshot('packages', window.fsCollection(window.db, window.fPath('packages')), snap => {
                    PACKAGES = snap.docs.map(d => d.data());
                    if(currentUser?.role === 'teacher') renderStudentsList();
                }),
                waitForInitialSnapshot('public profile settings', window.fsDoc(window.db, window.fPath('settings'), 'public_profile'), snap => {
                        if (snap.exists()) PUBLIC_PROFILE = snap.data();
                        if (typeof window.cacheStartupBranding === 'function') window.cacheStartupBranding(PUBLIC_PROFILE);
                        if (typeof window.applyGlobalLogo === 'function') window.applyGlobalLogo();
                        if (document.getElementById('public-landing-ui') && !document.getElementById('public-landing-ui').classList.contains('hidden')) window.renderPublicProfile();
                }),
                waitForInitialSnapshot('hall of fame', window.fsCollection(window.db, window.fPath('hall_of_fame')), snap => {
                    HOF_STUDENTS = snap.docs.map(d => d.data());
                    if(document.getElementById('hof-full-screen') && !document.getElementById('hof-full-screen').classList.contains('hidden')) window.renderHOFGrid();
                    if(document.getElementById('public-landing-ui') && !document.getElementById('public-landing-ui').classList.contains('hidden')) window.renderPublicProfile();
                }),
                ...(['teacher', 'collaborator'].includes(currentUser?.role)
                  ? [waitForInitialSnapshot('study templates', window.fsDoc(window.db, window.fPath('settings'), 'templates'), snap => {
                    TEACHER_TEMPLATES = [];
                    TEACHER_TEMPLATE_ASSIGNMENTS = {};
                    if (snap.exists()) {
                      TEACHER_TEMPLATES = snap.data().items || [];
                      TEACHER_TEMPLATE_ASSIGNMENTS = snap.data().assignments || {};
                    }
                  })]
                  : (TEACHER_TEMPLATES = [], TEACHER_TEMPLATE_ASSIGNMENTS = {}, []))
            ]);

            if (['teacher', 'collaborator'].includes(currentUser?.role)
                && !currentUser?.isDemo
                && localStorage.getItem('student_test_access_v1') !== 'complete') {
                try {
                    const idToken = await window.auth.currentUser.getIdToken();
                    const response = await fetch(
                        'https://us-central1-khanh-ielts-v2.cloudfunctions.net/rebuildStudentTestAccess',
                        { method: 'POST', headers: { Authorization: `Bearer ${idToken}` } }
                    );
                    if (!response.ok) throw new Error(`Access index rebuild returned HTTP ${response.status}.`);
                    localStorage.setItem('student_test_access_v1', 'complete');
                } catch (error) {
                    console.error('Unable to initialize assigned-test access:', error);
                    window.showToast?.(
                        'Assigned tests need setup',
                        'Ask an administrator to deploy the access-index functions and rebuild test access.',
                        'error'
                    );
                }
            }

            // 3. Attach RESTRICTED listeners based on role
            if (currentUser) {
                await window.attachPrivateListeners();
            }
            
            document.getElementById('cloud-loader').classList.add('hidden');
            checkAuth();

        } catch (err) {
            console.error("Cloud Boot Error:", err);
            document.getElementById('loader-spinner')?.classList.add('hidden');
            const loaderText = document.getElementById('cloud-loader-text');
            if (loaderText) {
                loaderText.textContent = `Database connection failed: ${err.message || err}`;
                loaderText.classList.add('text-rose-200');
            }
            throw err;
        }
    };

    window.attachPrivateListeners = async function() {
        const promises = [];

        if (currentUser?.isDemo) {
            prepareDemoSession(currentUser);
            return;
        }
        
        if (currentUser.role === 'teacher') {
            promises.push(waitForInitialSnapshot('users', window.fsCollection(window.db, window.fPath('users')), snap => {
                    USERS = snap.docs.map(userDoc => {
                        const data = userDoc.data();
                        if (Object.prototype.hasOwnProperty.call(data, 'pass')) {
                            window.fsUpdateDoc(userDoc.ref, { pass: window.fsDeleteField() })
                                .catch(error => console.error(`Unable to remove a legacy password field from users/${userDoc.id}:`, error));
                        }
                        return sanitizeUserProfile(data);
                    }).filter(user => user.disabled !== true);
                    window.triggerUIRefresh();
            }));
            
            // TEACHER SUBMISSION LISTENER WITH NATIVE OS NOTIFICATIONS
            let isSubInitial = true;
            promises.push(waitForInitialSnapshot('submissions', window.fsCollection(window.db, window.fPath('submissions')), snap => { 
                    SUBMISSIONS = snap.docs.map(d => d.data()); 
                    window.triggerUIRefresh(); 
                    
                    if (!isSubInitial) {
                        snap.docChanges().forEach(change => {
                            if (change.type === 'added') {
                                const s = change.doc.data();
                                if (s.student !== currentUser.user) window.fireLocalOSNotification("📝 New Submission!", `${s.student} completed: ${s.testName}`);
                            }
                            if (change.type === 'modified') {
                                const s = change.doc.data();
                                if (s.studentReply && !s.teacherReadReply && s.student !== currentUser.user) window.fireLocalOSNotification("💬 New Question", `${s.student} asked a question regarding: ${s.testName}`);
                            }
                        });
                    }
                    isSubInitial = false;
            }));
            
            promises.push(waitForInitialSnapshot('attendance', window.fsCollection(window.db, window.fPath('attendance')), snap => {
                ATTENDANCE = snap.docs.map(d => d.data());
                window.triggerUIRefresh();
            }));
            
            // TEACHER SCHEDULE LISTENER WITH NATIVE OS NOTIFICATIONS
            let isSchedInitial = true;
            promises.push(waitForInitialSnapshot('schedules', window.fsCollection(window.db, window.fPath('schedules')), snap => { 
                    SCHEDULES = snap.docs.map(d => d.data()); 
                    window.triggerUIRefresh(); 
                    
                    if (!isSchedInitial) {
                        snap.docChanges().forEach(change => {
                            if (change.type === 'added') {
                                const s = change.doc.data();
                                if (s.isNewBooking) window.fireLocalOSNotification("📅 New Booking!", `A student booked an appointment for ${s.date} at ${s.time}`);
                            }
                        });
                    }
                    isSchedInitial = false;
            }));

            // TEACHER FORUM LISTENER
            const staffMessageQueries = [
                window.fsCollection(window.db, window.fPath('messages')),
                window.fsCollection(window.db, 'public_messages'),
                ...CLASSES.filter(cls => cls.id).map(cls =>
                    window.fsCollection(window.db, 'classes', cls.id, 'messages')
                )
            ];
            const staffMessageSets = new Map();
            const firstMessageSnapshots = new Set();
            staffMessageQueries.forEach((messageQuery, index) => {
                promises.push(waitForInitialSnapshot('forum messages', messageQuery, snap => {
                    staffMessageSets.set(index, snap.docs.map(d => d.data()));
                    CHAT_MESSAGES = [...staffMessageSets.values()].flat()
                        .sort((a, b) => a.timestamp - b.timestamp);
                    if (document.getElementById('chat-panel') && !document.getElementById('chat-panel').classList.contains('translate-x-full')) window.renderChatMessages();

                    if (firstMessageSnapshots.has(index)) {
                        snap.docChanges().forEach(change => {
                            if (change.type === 'added') {
                                const message = change.doc.data();
                                if (message.author !== currentUser.user) {
                                    window.fireLocalOSNotification("🗂️ New Forum Post", `${message.author}: ${message.text.substring(0, 40)}...`);
                                }
                            }
                        });
                    } else {
                        firstMessageSnapshots.add(index);
                    }
                }).catch(error => {
                    console.error('Unable to load staff forum messages:', error);
                    if (!window._forumPermissionWarningShown) {
                        window._forumPermissionWarningShown = true;
                        window.showToast?.(
                            'Forum messages unavailable',
                            error.message || 'Check the account forum permissions and deploy the latest Firestore rules.',
                            'error'
                        );
                    }
                }));
            });

            promises.push(waitForInitialSnapshot('notes', window.fsCollection(window.db, window.fPath('notes')), snap => {
                ALL_NOTES = {};
                snap.docs.forEach(d => ALL_NOTES[d.id] = d.data().data);
            }));
            promises.push(waitForInitialSnapshot('flashcards', window.fsCollection(window.db, window.fPath('flashcards')), snap => {
                const temp = FLASHCARDS['temp_test_deck'];
                FLASHCARDS = {};
                if(temp) FLASHCARDS['temp_test_deck'] = temp;
                snap.docs.forEach(d => {
                    if(d.id.startsWith(currentUser.user + '_')) FLASHCARDS[d.id.replace(currentUser.user + '_', '')] = d.data().data;
                });
                if (!document.getElementById('student-fc-panel')?.classList.contains('hidden')) window.renderFlashcardPanel();
            }));
        } else if (currentUser.role === 'collaborator') {
            promises.push(waitForInitialSnapshot('current user profile', window.fsDoc(window.db, window.fPath('users'), currentUser.user), snap => { 
                    if(snap.exists()) { 
                        const me = sanitizeUserProfile(snap.data()); USERS = [me]; currentUser = me; sessionStorage.setItem('ielts_session', JSON.stringify(me)); 
                    } 
                    window.triggerUIRefresh();
            }));
        } else {
            // STUDENT: Restricted queries. ONLY downloads their own private data.
            promises.push(waitForInitialSnapshot('current user profile', window.fsDoc(window.db, window.fPath('users'), currentUser.user), snap => { 
                    if(snap.exists()) { 
                        const me = sanitizeUserProfile(snap.data()); USERS = [me]; currentUser = me; sessionStorage.setItem('ielts_session', JSON.stringify(me)); 
                    } 
                    window.triggerUIRefresh();
            }));
            
            // STUDENT SUBMISSION LISTENER WITH NATIVE OS NOTIFICATIONS
            const subQ = window.fsQuery(window.fsCollection(window.db, window.fPath('submissions')), window.fsWhere('student', '==', currentUser.user));
            let isMySubInitial = true;
            promises.push(waitForInitialSnapshot('your submissions', subQ, snap => { 
                    SUBMISSIONS = snap.docs.map(d => d.data()); 
                    window.triggerUIRefresh(); 
                    
                    if (!isMySubInitial) {
                        snap.docChanges().forEach(change => {
                            if (change.type === 'modified') {
                                const s = change.doc.data();
                                if (s.teacherFeedback && Object.keys(s.teacherFeedback).length > 0) window.fireLocalOSNotification("🏆 Test Graded!", `The teacher has returned feedback for: ${s.testName}`);
                            }
                        });
                    }
                    isMySubInitial = false;
            }));
            
            const attQ = window.fsQuery(window.fsCollection(window.db, window.fPath('attendance')), window.fsWhere('student', '==', currentUser.user));
            promises.push(waitForInitialSnapshot('your attendance', attQ, snap => {
                ATTENDANCE = snap.docs.map(d => d.data());
                window.triggerUIRefresh();
            }));

            const myClasses = CLASSES.filter(c => !window.isTemplateClass(c) && (c.enrolledStudents || []).includes(currentUser.user));
            let resolveInitialScheduleLoad;
            let rejectInitialScheduleLoad;
            const initialScheduleLoad = new Promise((resolve, reject) => {
                resolveInitialScheduleLoad = resolve;
                rejectInitialScheduleLoad = reject;
            });
            promises.push(initialScheduleLoad);
            const initialScheduleTimeout = setTimeout(() => {
                if (initialScheduleLoadResolved) return;
                initialScheduleLoadResolved = true;
                rejectInitialScheduleLoad(new Error('Timed out waiting for your schedules.'));
            }, 20000);
            let initialScheduleBatchesRemaining = 0;
            let initialScheduleLoadResolved = false;
            let scheduleListenerGeneration = 0;
            window.studentScheduleUnsubscribes = window.studentScheduleUnsubscribes || [];
            window.refreshStudentScheduleListeners = function() {
                const generation = ++scheduleListenerGeneration;
                window.studentScheduleUnsubscribes.forEach(unsubscribe => unsubscribe());
                window.studentScheduleUnsubscribes = [];
                const enrolledClasses = CLASSES.filter(c => !window.isTemplateClass(c) && (c.enrolledStudents || []).includes(currentUser.user));
                const enrolledClassIds = [...new Set(enrolledClasses.map(c => c.id).filter(Boolean))];
                const scheduleBatches = [];
                const batchCount = Math.ceil(enrolledClassIds.length / 10);
                initialScheduleBatchesRemaining = batchCount;
                if (!batchCount) {
                    SCHEDULES = [];
                    if (!initialScheduleLoadResolved) {
                        initialScheduleLoadResolved = true;
                        clearTimeout(initialScheduleTimeout);
                        resolveInitialScheduleLoad();
                    }
                    window.triggerUIRefresh();
                    return;
                }

                for (let i = 0; i < enrolledClassIds.length; i += 10) {
                    const batchIndex = i / 10;
                    const classIdBatch = enrolledClassIds.slice(i, i + 10);
                    const schedQ = window.fsQuery(window.fsCollection(window.db, window.fPath('schedules')), window.fsWhere('classId', 'in', classIdBatch));
                    let isFirstSnapshot = true;
                    const unsubscribe = window.fsOnSnapshot(schedQ, snap => {
                        if (generation !== scheduleListenerGeneration) return;
                        scheduleBatches[batchIndex] = snap.docs.map(d => d.data());
                        SCHEDULES = scheduleBatches.flat();
                        window.triggerUIRefresh();
                        if (isFirstSnapshot) {
                            isFirstSnapshot = false;
                            initialScheduleBatchesRemaining--;
                            if (!initialScheduleLoadResolved && initialScheduleBatchesRemaining === 0) {
                                initialScheduleLoadResolved = true;
                                clearTimeout(initialScheduleTimeout);
                                resolveInitialScheduleLoad();
                            }
                        }
                    }, error => {
                        if (generation !== scheduleListenerGeneration) return;
                        console.error('Unable to load student schedules:', error);
                        if (!initialScheduleLoadResolved) {
                            initialScheduleLoadResolved = true;
                            clearTimeout(initialScheduleTimeout);
                            rejectInitialScheduleLoad(new Error(`Unable to load your schedules: ${error.message || error}`));
                        }
                    });
                    if (typeof unsubscribe === 'function') window.studentScheduleUnsubscribes.push(unsubscribe);
                }
            };
            window.refreshStudentScheduleListeners();

            window.studentPresenceUnsubscribes = window.studentPresenceUnsubscribes || [];
            window.classPresenceByClass = window.classPresenceByClass || {};
            let presenceListenerGeneration = 0;
            let lastPresenceWriteAt = 0;
            let presenceWriteInFlight = false;
            window.refreshStudentPresenceListeners = function() {
                const generation = ++presenceListenerGeneration;
                window.studentPresenceUnsubscribes.forEach(unsubscribe => unsubscribe());
                window.studentPresenceUnsubscribes = [];
                window.classPresenceByClass = {};
                const enrolledClasses = CLASSES.filter(cls => !window.isTemplateClass(cls) && (cls.enrolledStudents || []).includes(currentUser.user));
                const classIds = [...new Set(enrolledClasses.map(cls => cls.id).filter(Boolean))];
                if (!classIds.length) {
                    window.triggerUIRefresh();
                    return;
                }
                for (let index = 0; index < classIds.length; index += 10) {
                    const classIdBatch = classIds.slice(index, index + 10);
                    const presenceQuery = window.fsQuery(
                        window.fsCollection(window.db, window.fPath('class_presence')),
                        window.fsWhere('classId', 'in', classIdBatch)
                    );
                    const unsubscribe = window.fsOnSnapshot(presenceQuery, snap => {
                        if (generation !== presenceListenerGeneration) return;
                        classIdBatch.forEach(classId => { window.classPresenceByClass[classId] = {}; });
                        snap.docs.forEach(docSnap => {
                            const presence = docSnap.data();
                            if (!classIdBatch.includes(presence.classId) || !presence.student) return;
                            window.classPresenceByClass[presence.classId][presence.student] = presence;
                        });
                        window.triggerUIRefresh();
                    }, error => {
                        if (generation !== presenceListenerGeneration) return;
                        console.error('Unable to load mini-class presence:', error);
                        if (!window.studentPresencePermissionWarningShown) {
                            window.studentPresencePermissionWarningShown = true;
                            if (typeof window.showToast === 'function') window.showToast('Classmate status unavailable', 'Firestore rules must allow enrolled classmates to read class_presence records.', 'error');
                        }
                    });
                    if (typeof unsubscribe === 'function') window.studentPresenceUnsubscribes.push(unsubscribe);
                }
            };

            window.writeStudentPresence = async function(isOnline = true, force = false) {
                if (!currentUser || currentUser.role !== 'student' || presenceWriteInFlight) return;
                const now = Date.now();
                if (!force && now - lastPresenceWriteAt < 45000) return;
                presenceWriteInFlight = true;
                lastPresenceWriteAt = now;
                const enrolledClasses = CLASSES.filter(cls => !window.isTemplateClass(cls) && (cls.enrolledStudents || []).includes(currentUser.user));
                try {
                    await Promise.all(enrolledClasses.map(cls => {
                        const presenceId = encodeURIComponent(`${cls.id}_${currentUser.user}`);
                        return window.fsSetDoc(
                            window.fsDoc(window.db, window.fPath('class_presence'), presenceId),
                            { classId: cls.id, student: currentUser.user, isOnline, lastActiveAt: now }
                        );
                    }));
                } catch (error) {
                    console.error('Unable to update mini-class presence:', error);
                    if (!window.studentPresencePermissionWarningShown) {
                        window.studentPresencePermissionWarningShown = true;
                        if (typeof window.showToast === 'function') window.showToast('Classmate status unavailable', 'Firestore rules must allow students to update their own class_presence records.', 'error');
                    }
                } finally {
                    presenceWriteInFlight = false;
                }
            };

            window.refreshStudentPresenceListeners();
            window.writeStudentPresence(true, true);
            if (!window.studentPresenceHeartbeat) {
                window.studentPresenceHeartbeat = setInterval(() => {
                    if (document.visibilityState === 'visible') window.writeStudentPresence(true);
                }, 45000);
                document.addEventListener('visibilitychange', () => {
                    window.writeStudentPresence(document.visibilityState === 'visible', true);
                });
                window.addEventListener('pagehide', () => window.writeStudentPresence(false, true));
                window.addEventListener('focus', () => window.writeStudentPresence(true));
            }

            if (myClasses.length > 0) {
                // STUDENT FORUM LISTENER WITH NATIVE OS NOTIFICATIONS
                let isMyMsgInitial = true;
                const classMessagesByBatch = new Map();
                for (let index = 0; index < myClasses.length; index++) {
                    const cls = myClasses[index];
                    const msgCollection = window.fsCollection(window.db, 'classes', cls.id, 'messages');
                    promises.push(waitForInitialSnapshot('your class messages', msgCollection, snap => {
                        classMessagesByBatch.set(cls.id, snap.docs.map(d => d.data()));
                        const otherMessages = CHAT_MESSAGES.filter(message => !message.classId);
                        CHAT_MESSAGES = [...otherMessages, ...[...classMessagesByBatch.values()].flat()].sort((a, b) => a.timestamp - b.timestamp);
                        if (document.getElementById('chat-panel') && !document.getElementById('chat-panel').classList.contains('hidden')) window.renderChatMessages();

                        if (!isMyMsgInitial) {
                            snap.docChanges().forEach(change => {
                                if (change.type === 'added') {
                                    const message = change.doc.data();
                                    if (message.author !== currentUser.user) window.fireLocalOSNotification("🗂️ New Class Post", `${message.author}: ${message.text.substring(0, 40)}...`);
                                }
                            });
                        }
                        isMyMsgInitial = false;
                    }).catch(error => {
                        console.error(`Unable to load messages for class ${cls.id}:`, error);
                        if (!window._forumPermissionWarningShown) {
                            window._forumPermissionWarningShown = true;
                            window.showToast?.(
                                'Class forum unavailable',
                                'You can still use the LMS, but your class forum could not be loaded. Ask your teacher to check enrollment and Firestore rules.',
                                'error'
                            );
                        }
                    }));
                }
            } else {
                CHAT_MESSAGES = CHAT_MESSAGES.filter(message => !message.classId);
            }
            
            const studentNotesQuery = window.fsQuery(
                window.fsCollection(window.db, window.fPath('notes')),
                window.fsWhere('owner', '==', currentUser.user)
            );
            promises.push(waitForInitialSnapshot('notes', studentNotesQuery, snap => {
                ALL_NOTES = {};
                snap.docs.forEach(d => {
                    if(d.id.startsWith(currentUser.user)) ALL_NOTES[d.id] = d.data().data;
                });
            }));
            const studentFlashcardsQuery = window.fsQuery(
                window.fsCollection(window.db, window.fPath('flashcards')),
                window.fsWhere('owner', '==', currentUser.user)
            );
            promises.push(waitForInitialSnapshot('flashcards', studentFlashcardsQuery, snap => {
                const temp = FLASHCARDS['temp_test_deck'];
                FLASHCARDS = {};
                if(temp) FLASHCARDS['temp_test_deck'] = temp;
                snap.docs.forEach(d => {
                    FLASHCARDS[d.id.replace(currentUser.user + '_', '')] = d.data().data;
                });
                if (!document.getElementById('student-fc-panel')?.classList.contains('translate-x-full')) window.renderFlashcardPanel();
            }));
        }

        await Promise.all(promises);
    };

    async function seedCloudData() {
        document.getElementById('cloud-loader-text').textContent = "Generating Initial Cloud Data...";
        USERS = [];
        
        TEST_BANK = [
          { id: "t_read_1", title: "Week 1 Reading: Bicycle Evolution", module: "reading", topics: ["History"], vocab: [{term: "magnificent", eng: "Extremely beautiful or impressive", vi: "Tráng lệ, tuyệt vời"}], grammar: [{term: "lacked pedals", type: "Simple Past", expl: "Used to describe a state in the past."}], parts: [{ title: "The Evolution", text: "The bicycle is a magnificent invention.\n\nIn the early 19th century, the 'dandy horse' lacked pedals. {drop:1}\n\nJohn Kemp Starley invented the Rover Safety Bicycle in 1885.", questions: [{ blockId: "b1", type: "tfng", ids: [2], instruction: "Agree?", text: "The dandy horse had pedals.", correctAnswers: {2: "False"}, explanation: "It lacked pedals." }, { blockId: "b2", type: "matching_headings", ids: [1], instruction: "Match heading", options: ["i. First concepts", "ii. The danger"], correctAnswers: {1: "i. First concepts"} }] }] },
          { id: "t_read_2", title: "Week 2 Reading: Renewable Energy", module: "reading", topics: ["Science"], parts: [{ title: "Renewable Energy", text: "Renewable energy sources such as solar, wind, and hydro power are increasingly important.\n\nThey provide a cleaner alternative to fossil fuels and help reduce greenhouse gas emissions.", questions: [{ blockId: "b3", type: "tfng", ids: [1], instruction: "Agree?", text: "Solar energy is a non-renewable source.", correctAnswers: {1: "False"}, explanation: "Solar is renewable." }] }] },
          { id: "t_write_1", title: "Writing Task 2: Work Future", module: "writing", topics: ["Work", "Society"], parts: [{ title: "Task 2", text: "The world of work is changing rapidly. Employees cannot depend on the same job for life.\n\nDiscuss the causes and suggest preparations.\n\nWrite at least 250 words.", questions: [{ blockId: "w1", type: "essay", ids: [1], instruction: "Write your essay below.", points: 9 }] }] },
          { id: "t_speak_1", title: "Speaking: Hometown", module: "speaking", topics: ["Personal"], parts: [{ title: "Part 1: Introduction", text: "Let's talk about your hometown.\n1. Where is your hometown?\n2. What do you like about it?", questions: [{ blockId: "s1", type: "audio_record", ids: [1], instruction: "Record your answer for Part 1" }] }] }
        ];
        for(let t of TEST_BANK) await window.fsSetDoc(window.fsDoc(window.db, window.fPath('tests'), t.id), t);
        
        CLASSES = [{ id: "c_demo", name: "Demo Class", assignedTests: ["t_read_1", "t_read_2", "t_write_1", "t_speak_1"], learningPaths: [
          { id: "week_1", title: "Week 1", items: [{ title: "Week 1 Reading", testId: "t_read_1" }] },
          { id: "week_2", title: "Week 2", items: [{ title: "Week 2 Reading", testId: "t_read_2", prerequisite: { testId: "t_read_1", minScore: 6 } }] }
        ] }];
        for(let c of CLASSES) await window.fsSetDoc(window.fsDoc(window.db, window.fPath('classes'), c.id), c);
        
        await window.fsSetDoc(window.fsDoc(window.db, window.fPath('settings'), 'billing'), BILLING_SETTINGS);

        console.log("Cloud Seeding Complete");
    }

    function checkAuth() {
      if (!currentUser) {
        document.getElementById('public-landing-ui').classList.remove('hidden');
        window.renderPublicProfile();
        
        document.getElementById('auth-ui').classList.add('hidden');
        document.getElementById('start-screen').classList.add('hidden');
        document.getElementById('editor-ui').classList.add('hidden');
        document.body.className = `font-sans overflow-hidden h-screen transition-colors duration-300 text-slate-800 bg-slate-100`; 
        handleAppRouteNavigation(true);
      } else {
        document.getElementById('auth-ui').classList.add('hidden');
        document.getElementById('public-landing-ui').classList.add('hidden');
        
        const savedTheme = localStorage.getItem('ielts_theme') || 'standard';
        if (typeof window.applyTheme === 'function') window.applyTheme(savedTheme);

        const isAdminEmail = [currentUser.email, currentUser.user, window.auth?.currentUser?.email]
            .some(email => typeof email === 'string' && email.trim().toLowerCase() === 'lyquockhanh03@gmail.com');
        if (currentUser.role === 'teacher' || currentUser.role === 'collaborator' || isAdminEmail) {
            openEditor();
        } else { 
            // ✨ SMART RESTORE: Did the student refresh while reviewing a test?
            const savedSub = sessionStorage.getItem('lms_grading_sub');
            if (savedSub && sessionStorage.getItem('lms_grading_mode') === 'student') {
                const subId = Number(savedSub);
                if (SUBMISSIONS.find(s => s.id === subId)) {
                    if (!window.location.hash) window.history.replaceState({ lmsRoute: 'student' }, '', `#/student/review/${subId}`);
                    reviewPastSubmission(subId);
                    handleAppRouteNavigation(true);
                    return; 
                }
            }
            window.renderAccountGate();
        }
        handleAppRouteNavigation(true);
      }
    }

    window.showAuthFromLanding = function() {
        if (routerReady && !appRouterApplying) {
            window.navigateAppRoute('login');
            return;
        }
        document.getElementById('public-landing-ui').classList.add('hidden');
        document.getElementById('auth-ui').classList.remove('hidden');
    };

    window.loginAsDemo = async function() {
        const message = "Anonymous/demo login is disabled for security reasons.";

        if (typeof window.showModalMsg === 'function') {
            window.showModalMsg('Access restricted', message);
        } else if (typeof window.showToast === 'function') {
            window.showToast('Access restricted', message, 'error');
        }

        const buttons = document.querySelectorAll('[data-auth-action="demo-login"]');
        buttons.forEach((b) => {
            b.disabled = true;
            b.title = message;
            b.setAttribute('aria-disabled', 'true');
        });

        console.warn(message);
    };

    window.togglePasswordVisibility = function(inputId, btn) {
        const input = document.getElementById(inputId);
        if (input.type === 'password') {
            input.type = 'text';
            btn.setAttribute('aria-label', 'Hide password');
            btn.setAttribute('aria-pressed', 'true');
            btn.innerHTML = `<svg aria-hidden="true" class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21"></path></svg>`;
        } else {
            input.type = 'password';
            btn.setAttribute('aria-label', 'Show password');
            btn.setAttribute('aria-pressed', 'false');
            btn.innerHTML = `<svg aria-hidden="true" class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"></path><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"></path></svg>`;
        }
    };

    let authMode = 'login';
    function toggleAuthMode() {
      authMode = authMode === 'login' ? 'register' : 'login';
      document.getElementById('auth-subtitle').textContent = authMode === 'login' ? 'Login to your account' : 'Create a new student account';
      document.getElementById('auth-submit-btn').textContent = authMode === 'login' ? 'Log In' : 'Sign Up as Student';
      
      const toggleBtn = document.getElementById('auth-toggle-btn');
      if(toggleBtn) toggleBtn.textContent = authMode === 'login' ? 'Need a student account? Sign up' : 'Already have an account? Log in';

      document.getElementById('auth-pass').autocomplete = authMode === 'login' ? 'current-password' : 'new-password';
      document.getElementById('auth-user').setAttribute('aria-invalid', 'false');
      document.getElementById('auth-pass').setAttribute('aria-invalid', 'false');
      document.getElementById('auth-error').classList.add('hidden');
    }
    window.toggleAuthMode = toggleAuthMode;

    async function ensureStudentReferralIdentity(user) {
      if (!user || user.role !== 'student') return user;

      let code = String(user.referralCode || '').trim().toUpperCase();
      if (code) return user;
      for (let attempt = 0; attempt < 5; attempt++) {
        if (!code) {
          const bytes = new Uint8Array(8);
          if (window.crypto?.getRandomValues) window.crypto.getRandomValues(bytes);
          else for (let i = 0; i < bytes.length; i++) bytes[i] = Math.floor(Math.random() * 256);
          code = `LMS${Array.from(bytes, byte => byte.toString(16).padStart(2, '0')).join('').toUpperCase()}`;
        }

        const codeRef = window.fsDoc(window.db, window.fPath('referral_codes'), code);
        const existing = await window.fsGetDoc(codeRef);
        if (!existing.exists() || existing.data().user === user.user) {
          const updatedUser = { ...user, referralCode: code };
          await window.fsSetDoc(codeRef, { user: user.user, code });
          await window.fsSetDoc(window.fsDoc(window.db, window.fPath('users'), user.user), updatedUser);
          return updatedUser;
        }
        code = '';
      }
      throw new Error('Could not allocate a unique referral code.');
    }

    function sanitizeUserProfile(user) {
      const profile = { ...user };
      delete profile.pass;
      return profile;
    }

    async function createAuthBackedProfile(username, password, profile, allowLegacyUsername = false) {
      if (window.auth?.currentUser?.email?.trim().toLowerCase() !== window.ADMIN_EMAIL) {
        throw new Error('Only the administrator account can create Authentication accounts from this dashboard.');
      }
      const accountUsername = allowLegacyUsername ? username : username.toLowerCase();
      if (!allowLegacyUsername && !window.LMSAuthHelpers.isValidUsername(accountUsername)) {
        throw new Error('Username must use 1-40 letters, numbers, underscores, or hyphens.');
      }
      if (password.length < 6) throw new Error('Password must be at least 6 characters.');

      const secondaryAuth = window.secondaryAuth;
      if (!secondaryAuth) throw new Error('Firebase secondary authentication is not initialized.');

      let createdUser = null;
      let previousProfile = null;
      const profileRef = window.fsDoc(window.db, window.fPath('users'), accountUsername);
      let createdAccessRef = null;
      try {
        const credential = await window.fsAuthCreateSecondary(
          secondaryAuth,
          window.LMSAuthHelpers.usernameToAuthEmail(accountUsername),
          password
        );
        createdUser = credential.user;

        const savedProfile = { ...sanitizeUserProfile(profile), user: accountUsername, uid: createdUser.uid };
        const existingSnapshot = await window.fsGetDoc(profileRef);
        previousProfile = existingSnapshot.exists() ? existingSnapshot.data() : null;
        const trustedAccessRef = window.fsDoc(window.db, window.fPath('account_access'), createdUser.uid);
        createdAccessRef = trustedAccessRef;
        const expiryMillis = getBillingExpiryMillis(savedProfile);
        const access = {
          uid: createdUser.uid,
          username: accountUsername,
          role: savedProfile.role || 'student',
          paid: savedProfile.role === 'student' && savedProfile.isPaid === true &&
            (savedProfile.paymentStatus === 'paid' || savedProfile.status === 'approved'),
          billingExpiresAt: expiryMillis === null ? null : window.fsTimestamp.fromMillis(expiryMillis)
        };
        const batch = window.fsWriteBatch(window.db);
        batch.set(profileRef, savedProfile);
        batch.set(trustedAccessRef, access);
        await batch.commit();
        return savedProfile;
      } catch (error) {
        if (createdUser) {
          try {
            const existingSnapshot = await window.fsGetDoc(profileRef);
            if (existingSnapshot.exists()) {
              if (previousProfile) await window.fsSetDoc(profileRef, sanitizeUserProfile(previousProfile));
              else await window.fsDeleteDoc(profileRef);
            }
            if (createdAccessRef) await window.fsDeleteDoc(createdAccessRef);
            await window.fsAuthDeleteUser(createdUser);
          } catch (cleanupError) {
            console.error('Unable to roll back the newly created Firebase Authentication account:', cleanupError);
            throw new Error(`${error.message} The Authentication account was created but could not be rolled back; remove it in Firebase Console.`);
          }
        }
        throw error;
      } finally {
        if (secondaryAuth.currentUser) {
          try {
            await window.fsAuthSecondarySignOut(secondaryAuth);
          } catch (signOutError) {
            console.error('Unable to sign out the Firebase secondary account creator:', signOutError);
            window.showToast?.('Secondary sign-out failed', 'The account operation completed, but the secondary Firebase session could not be signed out.', 'error');
          }
        }
      }
    }

    async function tryEnsureStudentReferralIdentity(user) {
      try {
        return { user: await ensureStudentReferralIdentity(user), error: null };
      } catch (error) {
        console.error('Student referral setup failed:', error);
        return { user, error };
      }
    }

    function prepareDemoSession(user = currentUser) {
      const demoUser = {
        ...(user?.isDemo ? user : {}),
        user: 'demo_student',
        role: 'student',
        isPaid: true,
        paymentStatus: 'paid',
        billingAccessOverride: true,
        isDemo: true
      };
      let demoClass = CLASSES.find(cls => cls.name?.toLowerCase().includes('demo') && !window.isTemplateClass(cls))
        || CLASSES.find(cls => window.isSchedulableClass(cls))
        || CLASSES.find(cls => !window.isTemplateClass(cls));

      if (!demoClass) {
        demoClass = {
          id: 'demo-local',
          name: 'Demo Class',
          assignedTests: TEST_BANK.map(test => test.id),
          enrolledStudents: [],
          learningPaths: TEST_BANK.map((test, index) => ({
            id: `demo-week-${index + 1}`,
            title: `Practice ${index + 1}`,
            items: [{ title: test.title, testId: test.id }]
          }))
        };
        CLASSES.push(demoClass);
      }
      demoClass.enrolledStudents = [...new Set([...(demoClass.enrolledStudents || []), demoUser.user])];

      currentUser = demoUser;
      USERS = [demoUser];
      FLASHCARDS = {};
      try {
        const savedDecks = JSON.parse(sessionStorage.getItem('demo_flashcards') || '{}');
        if (savedDecks && typeof savedDecks === 'object' && !Array.isArray(savedDecks)) FLASHCARDS = savedDecks;
      } catch (error) {
        console.error('Unable to restore demo flashcards:', error);
      }
      try {
        const savedSubmissions = JSON.parse(sessionStorage.getItem('demo_submissions') || '[]');
        SUBMISSIONS = Array.isArray(savedSubmissions) ? savedSubmissions : [];
      } catch (error) {
        console.error('Unable to restore demo submissions:', error);
        SUBMISSIONS = [];
      }
      ATTENDANCE = [];
      SCHEDULES = [];
      CHAT_MESSAGES = [];
      return demoUser;
    }

    async function handleAuthSubmit() {
      const enteredUsername = document.getElementById('auth-user').value.trim();
      const u = authMode === 'register' ? enteredUsername.toLowerCase() : enteredUsername;
      const p = document.getElementById('auth-pass').value.trim();
      const err = document.getElementById('auth-error');
      const usernameInput = document.getElementById('auth-user');
      const passwordInput = document.getElementById('auth-pass');
      usernameInput.setAttribute('aria-invalid', 'false');
      passwordInput.setAttribute('aria-invalid', 'false');
      if (!u || !p) {
        err.textContent = 'Enter username and password';
        err.classList.remove('hidden');
        if (!u) {
          usernameInput.setAttribute('aria-invalid', 'true');
          usernameInput.focus();
        }
        if (!p) {
          passwordInput.setAttribute('aria-invalid', 'true');
          if (u) passwordInput.focus();
        }
        return;
      }
      if (authMode === 'register' && !window.LMSAuthHelpers.isValidUsername(u)) {
        err.textContent = 'Username must use 1-40 letters, numbers, underscores, or hyphens.';
        err.classList.remove('hidden');
        usernameInput.setAttribute('aria-invalid', 'true');
        usernameInput.focus();
        return;
      }
      if (p.length < 6) {
        err.textContent = 'Password must be at least 6 characters';
        err.classList.remove('hidden');
        passwordInput.setAttribute('aria-invalid', 'true');
        passwordInput.focus();
        return;
      }
      
      err.classList.add('hidden');
      const btn = document.getElementById('auth-submit-btn');
      btn.textContent = "Connecting..."; btn.disabled = true;

      // ✨ FIX: 100% safe email generation even for names with spaces and accents (e.g. "Khanh Lý")
      const mappedEmail = authMode === 'login'
          ? window.LMSAuthHelpers.loginIdentifierToAuthEmail(u)
          : window.LMSAuthHelpers.usernameToAuthEmail(u);

      window.authFlowInProgress = true;
      try {
          if (authMode === 'register') {
            const credential = await window.fsAuthCreate(window.auth, mappedEmail, p);
            currentUser = {
                user: u,
                uid: credential.user.uid,
                role: 'student',
                status: 'unpaid',
                isPaid: false,
                paymentStatus: 'unpaid',
                createdAt: new Date().toLocaleDateString()
            };
            try {
                const profileRef = window.fsDoc(window.db, window.fPath('users'), u);
                const accessRef = window.fsDoc(window.db, window.fPath('account_access'), credential.user.uid);
                const batch = window.fsWriteBatch(window.db);
                batch.set(profileRef, currentUser);
                batch.set(accessRef, { uid: credential.user.uid, username: u, role: 'student', paid: false });
                await batch.commit();
            } catch (profileError) {
                try {
                    await window.fsAuthDeleteUser(credential.user);
                    await window.fsAuthSignOut(window.auth);
                } catch (cleanupError) {
                    console.error('Unable to roll back the student account after profile creation failed:', cleanupError);
                    throw new Error(`${profileError.message} The Authentication account could not be rolled back; remove it in Firebase Console.`);
                }
                throw profileError;
            }
          } else {
            // LOGIN MODE
            let credential;
            try {
                credential = await window.fsAuthSignIn(window.auth, mappedEmail, p);
            } catch (error) {
                err.textContent = error.code === 'auth/invalid-credential'
                    ? 'Invalid username/email or password. For Google-only accounts, use Sign in with Google. Older accounts stored only in Firestore must first be created in Firebase Authentication.'
                    : error.message || 'Invalid username or password';
                err.classList.remove('hidden');
                usernameInput.setAttribute('aria-invalid', 'true');
                passwordInput.setAttribute('aria-invalid', 'true');
                passwordInput.focus();
                return;
            }
            let userDoc;
            try {
                if (!u.includes('@')) {
                    userDoc = await window.fsGetDoc(window.fsDoc(window.db, window.fPath('users'), u));
                }
                if (!userDoc?.exists()) {
                    const ownedProfileQuery = window.fsQuery(
                        window.fsCollection(window.db, window.fPath('users')),
                        window.fsWhere('uid', '==', credential.user.uid),
                        window.fsLimit(1)
                    );
                    const ownedProfileSnapshot = await window.fsGetDocs(ownedProfileQuery);
                    if (!ownedProfileSnapshot.empty) userDoc = ownedProfileSnapshot.docs[0];
                }
            } catch (profileError) {
                console.error('Unable to read the account profile after login attempt:', profileError);
                if (profileError.code === 'permission-denied' || /missing or insufficient permissions/i.test(profileError.message || '')) {
                    throw new Error('Password accepted, but Firestore denied access to this student profile. The Firestore rules must allow the signed-in student to read their own users document.');
                }
                throw profileError;
            }

            if (!userDoc.exists()) {
                throw new Error('The password was accepted, but the student profile is missing in Firestore. Ask the teacher to restore this account profile.');
            }
            currentUser = sanitizeUserProfile(userDoc.data());
            if (currentUser.uid && currentUser.uid !== credential.user.uid) {
                throw new Error('This account profile is linked to a different Firebase Authentication user. Ask the administrator to correct the account link.');
            }
            const profileUpdates = {};
            if (!currentUser.uid) {
                currentUser.uid = credential.user.uid;
                profileUpdates.uid = credential.user.uid;
            }
            if (Object.prototype.hasOwnProperty.call(userDoc.data(), 'pass')) {
                profileUpdates.pass = window.fsDeleteField();
            }
            if (Object.keys(profileUpdates).length) {
                try {
                    await window.fsUpdateDoc(
                        userDoc.ref,
                        profileUpdates
                    );
                } catch (profileUpdateError) {
                    console.error('Unable to update the student profile UID or remove its legacy credential field:', profileUpdateError);
                    window.showToast?.('Profile migration incomplete', 'You are signed in, but the profile update was denied. Ask the administrator to check Firestore permissions.', 'error');
                }
            }
          }

          if (currentUser.disabled === true) {
              if (window.auth?.currentUser) await window.fsAuthSignOut(window.auth);
              currentUser = null;
              sessionStorage.removeItem('ielts_session');
              err.textContent = 'This account has been removed from the LMS. Contact the administrator if you think this is a mistake.';
              err.classList.remove('hidden');
              return;
          }

          const access = await window.loadTrustedAccountAccess(window.auth.currentUser.uid, window.auth.currentUser.email);
          currentUser.role = access.role;
          if (currentUser.role === 'student') {
              currentUser.status = currentUser.status || 'unpaid';
              if (access.paid !== true) currentUser.isPaid = false;
          }

          if (!window.isAccountApproved(currentUser, window.auth?.currentUser)) {
              window.showAwaitingApproval(currentUser);
              return;
          }

          let referralSetupError = null;
          if (currentUser.role === 'student') {
              const referralResult = await tryEnsureStudentReferralIdentity(currentUser);
              currentUser = referralResult.user;
              referralSetupError = referralResult.error;
          }
          
          sessionStorage.setItem('ielts_session', JSON.stringify(currentUser));
          
          if (window.canAccessLMS(currentUser, window.auth?.currentUser)) {
              window.lmsBootedUid = window.auth.currentUser.uid;
              await window.bootLMS();
          } else {
              await window.bootPaymentPortal();
              window.renderAccountGate();
          }
          if (window.auth?.currentUser) window.authenticatedUserHandled = window.auth.currentUser.uid;
          if (window.auth?.currentUser) window.watchTrustedAccountAccess(window.auth.currentUser.uid, window.auth.currentUser.email);
          if (referralSetupError && typeof window.showToast === 'function') {
              window.showToast("Referral code unavailable", "You are signed in, but the referral code could not be created. Ask the teacher to check Firestore permissions.");
          }
      } catch (e) {
          console.error(e); 
          // ✨ FIX: Show the exact error message so we know what broke!
          err.textContent = e.message || 'Cloud network error. Try again.'; 
          err.classList.remove('hidden');
      } finally {
          window.authFlowInProgress = false;
          btn.textContent = authMode === 'register' ? 'Sign Up as Student' : 'Log In';
          btn.disabled = false;
      }
    }
    window.handleAuthSubmit = handleAuthSubmit;
    
    // ✨ NEW: Google Sign-In Handler
    window.handleGoogleLogin = async function() {
        const err = document.getElementById('auth-error');
        const btn = document.getElementById('auth-google-btn');
        const originalText = btn.innerHTML;
        
        if (err) err.classList.add('hidden');
        btn.innerHTML = `<svg class="animate-spin h-5 w-5 text-slate-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg> Connecting...`;
        btn.disabled = true;
        
        try {
            window.authFlowInProgress = false;
            await window.fsSignInWithPopup(window.auth, window.fsGoogleProvider);
            
        } catch (error) {
            console.error("Lỗi đăng nhập Google:", error);
            if (err) {
                err.textContent = 'Đăng nhập Google thất bại: ' + error.message;
                err.classList.remove('hidden');
            }
        } finally {
            btn.innerHTML = originalText;
            btn.disabled = false;
        }
    };

    async function logout() {
      try {
        if (window.auth?.currentUser) {
          await window.fsAuthSignOut(window.auth);
        }

        sessionStorage.removeItem('ielts_session');
        sessionStorage.removeItem('lms_pending_test_route');
        currentUser = null;
        window.authenticatedUserHandled = null;
        window.history.replaceState({ lmsRoute: 'landing' }, '', '#/landing');
        window.location.reload();
      } catch (error) {
        console.error('Sign-out failed:', error);
        window.showToast?.('Sign-out failed', error.message || 'Please try again.');
      }
    }

    // ✨ NEW: Forgot Password Handler at Login Stage
    window.promptForgotPassword = function() {
        showInputPrompt("Reset Password", "Enter your username (or email address if you linked one):", async (inputVal) => {
            const u = inputVal.trim();
            if(!u) return;
            
            let emailToReset = u;
            if (!u.includes('@')) {
                emailToReset = window.LMSAuthHelpers.usernameToAuthEmail(u);
            }
            
            if (emailToReset.endsWith('@khanhlms.com')) {
                // Mapped internal emails cannot actually receive real emails.
                showModalMsg("Teacher Assistance Required", "Since this username maps to an internal address, a reset email cannot be delivered. Ask the administrator to reset it in Firebase Console > Authentication > Users.");
            } else {
                try {
                    await window.fsSendPasswordResetEmail(window.auth, emailToReset);
                    showModalMsg("Success", "A password reset link has been sent to your email address.");
                } catch (err) {
                    console.error(err);
                    showModalMsg("Error", "Could not send reset email: " + err.message);
                }
            }
        });
    };

    // ✨ NEW: Allow users to change their own password securely
    window.promptChangePassword = function() {
        showInputPrompt("Change Password", "Enter your new password (minimum 6 characters):", async (newPass) => {
            if (newPass.length < 6) {
                showModalMsg("Error", "Password must be at least 6 characters long.");
                return;
            }
            try {
                const user = window.auth?.currentUser;
                if (!user || !user.providerData.some(p => p.providerId === 'password')) {
                    throw new Error('This account does not have a password-based Firebase Authentication credential.');
                }
                await window.fsUpdatePassword(user, newPass);
                
                currentUser = sanitizeUserProfile(currentUser);
                sessionStorage.setItem('ielts_session', JSON.stringify(currentUser));
                
                showModalMsg("Success", "Your password has been changed successfully!");
            } catch (err) {
                console.error(err);
                if (err.code === 'auth/requires-recent-login') {
                    showModalMsg("Security Notice", "Please log out and log back in before changing your password.");
                } else {
                    showModalMsg("Error", "Failed to update password: " + err.message);
                }
            }
        });
    };

    // ✨ NEW: Allow Teachers to reset a student's password
    window.promptResetStudentPassword = function(studentUsername) {
        showModalMsg(
            "Reset Student Password",
            `Passwords are managed by Firebase Authentication and are not stored in Firestore. Reset ${studentUsername}'s password from Firebase Console > Authentication > Users.`
        );
    };

        // ✨ NEW: Dynamic Toast Notification Generator
