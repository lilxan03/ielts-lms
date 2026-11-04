    // ✨ PASTE YOUR FIREBASE WEB PUSH (VAPID) KEY HERE!
    window.FCM_VAPID_KEY = "BLgRyRFqMdkhp0pYPNvi14jQwdmndPV6q55jhb1za3FXlPIQUdGMBF69UYJme8VHPFMWYqt6kqSPLIRjAfbFBxU"; // <--- GET THIS FROM FIREBASE CONSOLE

    // CLOUD DATABASE VARIABLES
    // Shared HTML safety helpers. Use lmsEscapeHtml for plain text inserted via innerHTML,
    // and lmsSanitizeHtml for teacher-authored rich text (keeps formatting, strips scripts/handlers).
    function lmsEscapeHtml(value) {
        return String(value ?? '').replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[ch]);
    }
    function lmsSanitizeHtml(html) {
        const tpl = document.createElement('template');
        tpl.innerHTML = String(html ?? '');
        tpl.content.querySelectorAll('script, iframe, object, embed, link, meta, base, form').forEach(el => el.remove());
        tpl.content.querySelectorAll('*').forEach(el => {
            [...el.attributes].forEach(attr => {
                const name = attr.name.toLowerCase();
                const val = attr.value.replace(/[\s\u0000-\u001f]/g, '').toLowerCase();
                if (name.startsWith('on') || (['href', 'src', 'xlink:href', 'action', 'formaction'].includes(name) && /^(javascript|vbscript|data:text\/html)/.test(val))) {
                    el.removeAttribute(attr.name);
                }
            });
        });
        return tpl.innerHTML;
    }
    let USERS = [];
    let TEST_BANK = [];
    let CLASSES = [];
    let FLASHCARDS = {};
    let ALL_NOTES = {};
    let SUBMISSIONS = [];
    window.aiDraftOverallByQuestion = {};
    let SCHEDULES = [];
    let ATTENDANCE = [];
    let PACKAGES = []; 
    let paymentCatalogUnsubscribe = null;
    let paymentPackagesUnsubscribe = null;
    let TEACHER_TEMPLATES = [];
    let TEACHER_TEMPLATE_ASSIGNMENTS = {};
    let CHAT_MESSAGES = []; // <--- NEW: Stores all class communications!
    let HOF_STUDENTS = []; // ✨ NEW: Dedicated Collection for Hall of Fame
    let AVAILABILITY = { duration: 60, schedule: {0:[], 1:[], 2:[], 3:[], 4:[], 5:[], 6:[]} };
    let BILLING_SETTINGS = { feePerLesson: 100000, lessonsPerMonth: 12, bankId: 'MB', bankAcc: '0123456789', bankName: 'NGUYEN VAN TEACHER', discCombo: 10, discCourse: 10 };
    let PUBLIC_PROFILE = { missionTitle: '', missionText: '', heroImage: null, features: [], achievements: [], pdfs: [] };
    let currentUser = JSON.parse(sessionStorage.getItem('ielts_session')) || null;
    const STUDENT_LANGUAGE_KEY = 'ielts_student_language';
    let studentLanguage = localStorage.getItem(STUDENT_LANGUAGE_KEY) === 'vi' ? 'vi' : 'en';
    window.studentText = function(english, vietnamese) {
      return studentLanguage === 'vi' ? vietnamese : english;
    };
    window.refreshStudentLanguageLock = function() {
      const exam = document.getElementById('exam-ui');
      const languageButton = document.getElementById('student-language-toggle');
      if (!languageButton) return;
      languageButton.disabled = Boolean(exam && !exam.classList.contains('hidden'));
      languageButton.title = languageButton.disabled
        ? (studentLanguage === 'vi' ? 'Không thể đổi ngôn ngữ khi đang làm bài' : 'Language cannot be changed while taking a test')
        : '';
    };
    window.translateStudentStatic = function() {
      document.querySelectorAll('[data-student-en][data-student-vi]').forEach(element => {
        element.textContent = element.dataset[studentLanguage === 'vi' ? 'studentVi' : 'studentEn'];
      });
      document.querySelectorAll('[data-student-placeholder-en][data-student-placeholder-vi]').forEach(element => {
        element.placeholder = element.dataset[studentLanguage === 'vi' ? 'studentPlaceholderVi' : 'studentPlaceholderEn'];
      });
    };
    window.applyStudentLanguage = function(language = studentLanguage, rerender = true) {
      if (!['en', 'vi'].includes(language)) return;
      const exam = document.getElementById('exam-ui');
      if (exam && !exam.classList.contains('hidden') && language !== studentLanguage) {
        if (typeof window.showToast === 'function') window.showToast('Language locked', 'Language cannot be changed while taking a test.', 'info');
        return;
      }
      studentLanguage = language;
      localStorage.setItem(STUDENT_LANGUAGE_KEY, studentLanguage);
      document.documentElement.lang = studentLanguage === 'vi' ? 'vi' : 'en';
      window.translateStudentStatic();
      const languageButton = document.getElementById('student-language-toggle');
      if (languageButton) {
        languageButton.textContent = studentLanguage === 'vi' ? 'Tiếng Việt' : 'English';
      }
      window.refreshStudentLanguageLock();
      if (rerender && currentUser?.role === 'student' && typeof window.renderStudentDashboard === 'function') {
        window.renderStudentDashboard();
      }
    };
    window.toggleStudentLanguage = function() {
      window.applyStudentLanguage(studentLanguage === 'vi' ? 'en' : 'vi');
    };
    if (currentUser) {
        delete currentUser.pass;
        sessionStorage.setItem('ielts_session', JSON.stringify(currentUser));
    }
    window.authFlowInProgress = false;
    window.authenticatedUserHandled = null;
    window.trustedAccountAccess = null;
    window.accountAccessUnsubscribe = null;
    window.lmsBootedUid = null;
    window.ADMIN_EMAIL = 'lyquockhanh03@gmail.com';

    window.isAccountApproved = function(profile, firebaseUser = window.auth?.currentUser) {
      const email = firebaseUser?.email?.trim().toLowerCase();
      return email === window.ADMIN_EMAIL || profile?.disabled !== true;
    };

    window.loadTrustedAccountAccess = async function(uid, email) {
      if (email?.trim().toLowerCase() === window.ADMIN_EMAIL) {
        window.trustedAccountAccess = { uid, username: currentUser?.user, role: 'teacher', paid: true, admin: true };
        return window.trustedAccountAccess;
      }

      const accessRef = window.fsDoc(window.db, window.fPath('account_access'), uid);
      let accessSnapshot = await window.fsGetDoc(accessRef);
      if (!accessSnapshot.exists()) {
        const username = currentUser?.uid === uid ? currentUser.user : null;
        if (username) {
          const profileRef = window.fsDoc(window.db, window.fPath('users'), username);
          await window.fsSetDoc(accessRef, { uid, username, role: 'student', paid: false });
          accessSnapshot = await window.fsGetDoc(accessRef);
        }
      }
      const data = accessSnapshot.exists() ? accessSnapshot.data() : {};
      const role = ['teacher', 'collaborator', 'student'].includes(data.role) ? data.role : 'student';
      window.trustedAccountAccess = { ...data, uid, role, paid: data.paid === true };
      return window.trustedAccountAccess;
    };

    window.canAccessLMS = function(profile, firebaseUser = window.auth?.currentUser) {
      const access = window.trustedAccountAccess;
      if (firebaseUser?.email?.trim().toLowerCase() === window.ADMIN_EMAIL) return true;
      if (access?.uid !== firebaseUser?.uid) return false;
      if (['teacher', 'collaborator'].includes(access.role)) return true;
      if (access.role !== 'student' || access.paid !== true) return false;
      const expiry = access.billingExpiresAt;
      if (!expiry) return true;
      const expiryMillis = typeof expiry.toMillis === 'function' ? expiry.toMillis() : Number(expiry);
      return Number.isFinite(expiryMillis) && expiryMillis > Date.now();
    };

    window.watchTrustedAccountAccess = function(uid, email) {
      window.accountAccessUnsubscribe?.();
      if (email?.trim().toLowerCase() === window.ADMIN_EMAIL) return;

      const accessRef = window.fsDoc(window.db, window.fPath('account_access'), uid);
      window.accountAccessUnsubscribe = window.fsOnSnapshot(accessRef, async snapshot => {
        if (window.auth?.currentUser?.uid !== uid) return;
        const data = snapshot.exists() ? snapshot.data() : { uid, role: 'student', paid: false };
        window.trustedAccountAccess = { ...data, uid };
        if (currentUser) currentUser.role = data.role || 'student';
        if (window.canAccessLMS(currentUser, window.auth.currentUser)) {
          if (window.lmsBootedUid !== uid) {
            window.lmsBootedUid = uid;
            try {
              await window.bootLMS();
            } catch (error) {
              window.lmsBootedUid = null;
              console.error('Unable to load the paid student LMS:', error);
              window.showToast?.('Could not unlock LMS', error.message || 'Please refresh and try again.', 'error');
            }
          }
          window.renderAccountGate();
        } else {
          window.lmsBootedUid = null;
          TEST_BANK = [];
          CLASSES = [];
          SCHEDULES = [];
          ATTENDANCE = [];
          SUBMISSIONS = [];
          CHAT_MESSAGES = [];
          window.renderAccountGate();
        }
      }, error => {
        console.error('Unable to watch trusted account access:', error);
        window.showToast?.('Account access check failed', 'Refresh the page or contact the administrator.', 'error');
      });
    };

    window.renderAccountGate = function() {
      const hasAccess = window.canAccessLMS(currentUser, window.auth?.currentUser);
      const startScreen = document.getElementById('start-screen');
      const paymentWall = document.getElementById('student-payment-warning');
      document.getElementById('awaiting-approval-ui')?.classList.add('hidden');
      if (currentUser?.role !== 'student') return;

      document.getElementById('auth-ui')?.classList.add('hidden');
      document.getElementById('public-landing-ui')?.classList.add('hidden');
      startScreen?.classList.remove('hidden');
      document.getElementById('editor-ui')?.classList.add('hidden');
      document.getElementById('exam-ui')?.classList.add('hidden');
      startScreen?.querySelector(':scope > header')?.classList.toggle('hidden', !hasAccess);
      document.getElementById('student-sidebar')?.classList.toggle('hidden', !hasAccess);
      document.getElementById('student-sidebar-backdrop')?.classList.toggle('hidden', !hasAccess);
      document.getElementById('student-target-widget')?.classList.toggle('hidden', !hasAccess);
      document.getElementById('student-main-content')?.classList.toggle('hidden', !hasAccess);
      paymentWall?.classList.toggle('hidden', hasAccess);
      if (!hasAccess) {
        window.closeAppSidebar('student');
        window.initStudentDashboard();
      } else {
        window.initStudentDashboard();
      }
    };

    window.bootPaymentPortal = async function() {
      paymentCatalogUnsubscribe?.();
      paymentPackagesUnsubscribe?.();
      const billingSnapshot = await window.fsGetDoc(window.fsDoc(window.db, window.fPath('settings'), 'billing'));
      if (billingSnapshot.exists()) BILLING_SETTINGS = billingSnapshot.data();
      paymentCatalogUnsubscribe = window.fsOnSnapshot(
        window.fsCollection(window.db, window.fPath('course_catalog')),
        snapshot => {
          CLASSES = snapshot.docs.map(doc => doc.data());
          if (document.getElementById('checkout-course')) window.renderStudentCheckout();
        },
        error => {
          console.error('Unable to load the public course catalog:', error);
          window.showToast?.('Could not load courses', 'Refresh the page or contact your teacher.', 'error');
        }
      );
      paymentPackagesUnsubscribe = window.fsOnSnapshot(
        window.fsCollection(window.db, window.fPath('packages')),
        snapshot => {
          PACKAGES = snapshot.docs.map(doc => doc.data());
          if (document.getElementById('checkout-course')) window.renderStudentCheckout();
        },
        error => {
          console.error('Unable to load public course packages:', error);
          window.showToast?.('Could not load bundles', 'Refresh the page or contact your teacher.', 'error');
        }
      );
      window.renderAccountGate();
      if (currentUser?.role === 'student' && !window.trustedAccountAccess?.paid) {
        window.initStudentDashboard();
      }
    };

    window.syncPublicCourseCatalog = async function(classes) {
      if (!['teacher', 'collaborator'].includes(currentUser?.role)) return;
      const entries = classes.map(cls => ({
        id: cls.id,
        name: cls.name || '',
        parentClassId: cls.parentClassId || null,
        feePerLesson: Number(cls.feePerLesson) || Number(BILLING_SETTINGS.feePerLesson) || 100000,
        isTemplate: window.isTemplateClass(cls)
      }));
      const catalogSnapshot = await window.fsGetDocs(window.fsCollection(window.db, window.fPath('course_catalog')));
      const entryIds = new Set(entries.map(entry => entry.id));
      const writes = entries.map(async entry => {
        const previous = catalogSnapshot.docs.find(doc => doc.id === entry.id);
        if (!previous || JSON.stringify(previous.data()) !== JSON.stringify(entry)) {
          await window.fsSetDoc(window.fsDoc(window.db, window.fPath('course_catalog'), entry.id), entry);
        }
      });
      const deletions = catalogSnapshot.docs
        .filter(doc => !entryIds.has(doc.id))
        .map(doc => window.fsDeleteDoc(window.fsDoc(window.db, window.fPath('course_catalog'), doc.id)));
      await Promise.all([...writes, ...deletions]);
    };

    window.syncTrustedAccountAccess = async function(profile) {
      if (!profile?.uid || window.auth?.currentUser?.email?.trim().toLowerCase() !== window.ADMIN_EMAIL) {
        throw new Error('Only the administrator can update trusted account access.');
      }
      const expiryMillis = getBillingExpiryMillis(profile);
      const paid = profile.role === 'student' && profile.isPaid === true &&
        (profile.billingAccessOverride === true || expiryMillis === null || expiryMillis > Date.now());
      await window.fsSetDoc(
        window.fsDoc(window.db, window.fPath('account_access'), profile.uid),
        {
          uid: profile.uid,
          username: profile.user,
          role: profile.role || 'student',
          paid,
          billingExpiresAt: expiryMillis === null ? null : window.fsTimestamp.fromMillis(expiryMillis)
        }
      );
    };

    window.showAwaitingApproval = function(profile) {
      if (profile) {
        currentUser = profile;
        sessionStorage.setItem('ielts_session', JSON.stringify(profile));
      }

      document.getElementById('cloud-loader')?.classList.add('hidden');
      document.getElementById('public-landing-ui')?.classList.add('hidden');
      document.getElementById('auth-ui')?.classList.add('hidden');
      document.getElementById('start-screen')?.classList.add('hidden');
      document.getElementById('editor-ui')?.classList.add('hidden');
      document.getElementById('awaiting-approval-ui')?.classList.remove('hidden');
    };

    window.signOutAwaitingApproval = async function() {
      try {
        await window.fsAuthSignOut(window.auth);
        sessionStorage.removeItem('ielts_session');
        currentUser = null;
        window.authenticatedUserHandled = null;
        document.getElementById('awaiting-approval-ui')?.classList.add('hidden');
        document.getElementById('public-landing-ui')?.classList.remove('hidden');
      } catch (error) {
        console.error('Sign-out failed:', error);
        window.showToast?.('Sign-out failed', error.message || 'Please try again.');
      }
    };

    let APP_DATA = { module: 'reading', parts: [], vocab: [], grammar: [] };
    let editingTestId = null;
    let currentEditorPartIdx = 0;

    function getWritingTaskNumber(part, titleOverride) {
        if (!part || !APP_DATA || APP_DATA.module !== 'writing') return null;
        if (part.writingTask === 'task1' || part.writingTask === 1) return 1;
        if (part.writingTask === 'task2' || part.writingTask === 2) return 2;

        const getTaskNumber = value => {
            const plainTitle = String(value || '').replace(/<[^>]*>/g, ' ').replace(/&nbsp;/gi, ' ');
            const match = plainTitle.match(/\btask\s*([12])\b/i);
            return match ? Number(match[1]) : null;
        };
        const taskFromTitle = getTaskNumber(titleOverride) || getTaskNumber(part.title) || getTaskNumber(APP_DATA.title);
        if (taskFromTitle) return taskFromTitle;

        const partIndex = APP_DATA.parts ? APP_DATA.parts.indexOf(part) : -1;
        if (APP_DATA.parts && APP_DATA.parts.length > 1 && partIndex >= 0) {
            return partIndex === 0 ? 1 : partIndex === 1 ? 2 : null;
        }
        return null;
    }

    function isWritingTask1Part(part, titleOverride) {
        return getWritingTaskNumber(part, titleOverride) === 1;
    }

    function isCurrentEditorWritingTask1Part(part) {
        const titleEl = document.getElementById('edit-passage-title');
        return isWritingTask1Part(part, titleEl ? titleEl.textContent : undefined);
    }

    window.updateBuilderFeatureVisibility = function(part) {
        if (!APP_DATA) return;
        const currentPart = part || (APP_DATA.parts && APP_DATA.parts[currentEditorPartIdx]);
        const titleEl = document.getElementById('edit-passage-title');
        const currentTitle = titleEl
            ? (titleEl.isContentEditable ? titleEl.textContent : titleEl.value)
            : undefined;
        const isListening = APP_DATA.module === 'listening';
        const showCharts = isWritingTask1Part(currentPart, currentTitle);
        const showImages = APP_DATA.module === 'reading';
        const mediaFields = document.getElementById('builder-media-fields');
        const audioField = document.getElementById('audio-field-container');
        const chartsWrapper = document.getElementById('interactive-charts-wrapper');
        const imageField = document.getElementById('image-field-container');
        const speakingQuestionsField = document.getElementById('speaking-questions-field');

        if (mediaFields) mediaFields.classList.toggle('hidden', !(isListening || showCharts || showImages));
        if (audioField) audioField.classList.toggle('hidden', !isListening);
        if (chartsWrapper) chartsWrapper.classList.toggle('hidden', !showCharts);
        if (imageField) imageField.classList.toggle('hidden', !showImages);
        if (speakingQuestionsField) speakingQuestionsField.classList.toggle('hidden', APP_DATA.module !== 'speaking');
    };
    const listeningYoutubePlayers = new Map();
    let listeningYoutubeApiPromise = null;
