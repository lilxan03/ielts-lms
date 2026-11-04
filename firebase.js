    import { initializeApp, getApps } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js";
    import { initializeAppCheck, ReCaptchaEnterpriseProvider } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-app-check.js";
    import { getFirestore, doc, setDoc, getDoc, collection, getDocs, deleteDoc, updateDoc, deleteField, onSnapshot, query, where, limit, Timestamp, writeBatch } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";
    // ✨ NEW: Added sendPasswordResetEmail
    import { getAuth, setPersistence, browserLocalPersistence, signOut, signInWithEmailAndPassword, createUserWithEmailAndPassword, deleteUser, GoogleAuthProvider, signInWithPopup, onAuthStateChanged, updatePassword, sendPasswordResetEmail } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
    import { getStorage, ref, uploadBytes, getDownloadURL } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-storage.js";
    // ✨ NEW: Web Push Notifications SDK
    import { getMessaging, getToken, onMessage } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-messaging.js";

    window.initFirebaseSystem = async function() {
        const firebaseConfig = {
          apiKey: "AIzaSyDqiWcuRrj6s5nNr1NvMSnYk5DyQYNr89E",
          authDomain: "khanh-ielts-v2.firebaseapp.com",
          projectId: "khanh-ielts-v2",
          storageBucket: "khanh-ielts-v2.firebasestorage.app",
          messagingSenderId: "1045761879860",
          appId: "1:1045761879860:web:09bb16937630369e887f61"
        };

        const loaderText = document.getElementById('cloud-loader-text');
        const spinner = document.getElementById('loader-spinner');

        try {
            loaderText.innerHTML = "Initializing App...";
            const app = initializeApp(firebaseConfig);
            const appCheck = initializeAppCheck(app, {
              provider: new ReCaptchaEnterpriseProvider('6LdQU-4tAAAAAE3le0IPyzgPufRryWx9ncBw5lna'),
              isTokenAutoRefreshEnabled: true
            });
            window.firebaseApp = app; // Expose globally for messaging
            const db = getFirestore(app);
            const auth = getAuth(app);
            await setPersistence(auth, browserLocalPersistence);
            const storage = getStorage(app);
            const accountCreatorAppName = 'admin-account-creator';
            const accountCreatorApp = getApps().find(existingApp => existingApp.name === accountCreatorAppName)
                || initializeApp(firebaseConfig, accountCreatorAppName);
            const accountCreatorAuth = getAuth(accountCreatorApp);
            
            // Expose globally
            window.db = db;
            window.storage = storage;
            window.sRef = ref;
            window.sUpload = uploadBytes;
            window.sGetUrl = getDownloadURL;
            window.fsDoc = doc;
            window.fsSetDoc = setDoc;
            window.fsGetDoc = getDoc;
            window.fsUpdateDoc = updateDoc;
            window.fsDeleteField = deleteField;
            window.fsTimestamp = Timestamp;
            window.fsWriteBatch = writeBatch;
            window.fsCollection = collection;
            window.fsGetDocs = getDocs;
            window.fsDeleteDoc = deleteDoc;
            window.fsOnSnapshot = onSnapshot;
            window.fPath = (col) => col;
            
            window.fsQuery = query;
            window.fsWhere = where;
            window.fsLimit = limit;
        
            // Expose Real Authentication methods
            window.auth = auth;
            window.fsAuthSignOut = signOut;
            window.fsAuthSignIn = signInWithEmailAndPassword;
            window.fsAuthCreate = createUserWithEmailAndPassword;
            window.fsAuthCreateSecondary = createUserWithEmailAndPassword;
            window.fsAuthDeleteUser = deleteUser;
            window.fsAuthSecondarySignOut = signOut;
            window.secondaryAuth = accountCreatorAuth;
            window.onAuthStateChanged = onAuthStateChanged;
            window.fsUpdatePassword = updatePassword;
            window.fsSendPasswordResetEmail = sendPasswordResetEmail;
        
            // ✨ NEW: Initialize Google Auth Provider
            window.fsGoogleProvider = new GoogleAuthProvider();
            window.fsSignInWithPopup = signInWithPopup;
            
            // ✨ NEW: Expose Web Push Messaging
            window.fsGetMessaging = getMessaging;
            window.fsGetToken = getToken;
            window.fsOnMessage = onMessage;

            // NEW: Global Storage Uploader Helper with Timeout Anti-Hang Protection
            window.uploadMediaToStorage = async function(fileOrBlob, pathString, timeoutMs = 3000) {
                const storageRef = window.sRef(window.storage, pathString);
                
                const uploadTask = async () => {
                    await window.sUpload(storageRef, fileOrBlob);
                    return await window.sGetUrl(storageRef);
                };
                
                if (!timeoutMs || timeoutMs <= 0) return uploadTask();

                // Keep short timeouts for small media, while allowing callers to opt out for larger uploads.
                const timeoutTask = new Promise((_, reject) => 
                    setTimeout(() => reject(new Error("Firebase Storage upload timed out.")), timeoutMs)
                );
                
                return Promise.race([uploadTask(), timeoutTask]);
            };

            if (typeof window.loadPublicLandingData === 'function') {
                window.loadPublicLandingData();
            }

            // Theo dõi trạng thái đăng nhập chính thức
            onAuthStateChanged(auth, async (user) => {
                if (window.authFlowInProgress) return;

                if (user?.isAnonymous) {
                    try { await signOut(auth); } catch (e) {}
                    const err = document.getElementById('auth-error');
                    if (err) { err.textContent = 'Anonymous login is disabled.'; err.classList.remove('hidden'); }
                    document.getElementById('cloud-loader')?.classList.add('hidden');
                    document.getElementById('public-landing-ui')?.classList.remove('hidden');
                    return;
                }

                if (user) {
                    if (window.authenticatedUserHandled === user.uid) return;
                    
                    const loaderText = document.getElementById('cloud-loader-text');
                    if (loaderText) loaderText.innerHTML = "Verifying account status...";
                    
                    try {
                        if (typeof window.loadPublicLandingData === 'function' &&
                            !(await window.loadPublicLandingData())) {
                            await window.loadPublicLandingData();
                        }

                        const cachedUsername = currentUser?.uid === user.uid ? currentUser.user : null;
                        const accessRef = window.fsDoc(window.db, window.fPath('account_access'), user.uid);
                        const accessSnapshot = await window.fsGetDoc(accessRef);
                        const linkedUsername = accessSnapshot.exists() ? accessSnapshot.data().username : null;
                        let userDocRef = window.fsDoc(window.db, window.fPath('users'), cachedUsername || linkedUsername || user.uid);
                        let userDocSnap = null;
                        try {
                            userDocSnap = await window.fsGetDoc(userDocRef);
                        } catch (profileLookupError) {
                            if (cachedUsername || linkedUsername) throw profileLookupError;
                        }

                        if (!userDocSnap?.exists() && !cachedUsername && !linkedUsername) {
                            const ownedProfileQuery = window.fsQuery(
                                window.fsCollection(window.db, window.fPath('users')),
                                window.fsWhere('uid', '==', user.uid),
                                window.fsLimit(1)
                            );
                            const ownedProfileSnapshot = await window.fsGetDocs(ownedProfileQuery);
                            if (!ownedProfileSnapshot.empty) {
                                userDocSnap = ownedProfileSnapshot.docs[0];
                                userDocRef = userDocSnap.ref;
                            }
                        }
                        
                        if (userDocSnap?.exists()) {
                            const profileData = userDocSnap.data();
                            currentUser = userDocSnap.data();
                            if (currentUser.uid && currentUser.uid !== user.uid) {
                                throw new Error('This profile belongs to a different Firebase Authentication account.');
                            }
                            currentUser.uid = user.uid;
                            if (user.email) currentUser.email = user.email;
                            delete currentUser.pass;
                            if (user.email && profileData.email !== user.email) {
                                try {
                                    await window.fsUpdateDoc(userDocRef, { email: user.email });
                                } catch (emailSyncError) {
                                    console.error('Unable to sync the verified account email to the student profile:', emailSyncError);
                                }
                            }
                        } else {
                            if (cachedUsername || linkedUsername) throw new Error('Your account profile could not be loaded. Ask the administrator to check the account UID and access record.');
                            currentUser = {
                                user: user.uid,
                                uid: user.uid,
                                email: user.email || '',
                                role: 'student',
                                status: 'unpaid',
                                isPaid: false,
                                paymentStatus: 'unpaid',
                                createdAt: new Date().toISOString()
                            };
                            const accessRef = window.fsDoc(window.db, window.fPath('account_access'), user.uid);
                            const accountBatch = window.fsWriteBatch(window.db);
                            accountBatch.set(userDocRef, currentUser);
                            accountBatch.set(accessRef, { uid: user.uid, username: user.uid, role: 'student', paid: false });
                            await accountBatch.commit();
                        }

                        if (currentUser.disabled === true) {
                            await signOut(auth);
                            if (typeof window.showModalMsg === 'function') {
                                window.showModalMsg("Account Disabled", "This account has been removed from the LMS. Contact the administrator if you think this is a mistake.");
                            }
                            return;
                        }

                        const access = await window.loadTrustedAccountAccess(user.uid, user.email);
                        currentUser.accountAccess = access;
                        currentUser.role = access.role;
                        if (currentUser.role === 'student') {
                            currentUser.lastLoginAt = new Date().toISOString();
                            try {
                                await window.fsUpdateDoc(userDocRef, { lastLoginAt: currentUser.lastLoginAt });
                            } catch (loginTrackingError) {
                                console.error('Unable to record student sign-in activity:', loginTrackingError);
                            }
                        }
                        sessionStorage.setItem('ielts_session', JSON.stringify(currentUser));

                        const role = access.role;
                        const canEnterLms = window.canAccessLMS(currentUser, user);

                        if (canEnterLms && typeof window.bootLMS === 'function') {
                            window.lmsBootedUid = user.uid;
                            await window.bootLMS();
                        } else {
                            await window.bootPaymentPortal();
                        }

                        document.getElementById('cloud-loader')?.classList.add('hidden');
                        document.getElementById('auth-ui')?.classList.add('hidden');
                        document.getElementById('public-landing-ui')?.classList.add('hidden');

                        if (role === 'teacher' || role === 'collaborator' || user.email === 'lyquockhanh03@gmail.com') {
                            document.getElementById('awaiting-approval-ui')?.classList.add('hidden');
                            document.getElementById('student-payment-warning')?.classList.add('hidden');
                            document.getElementById('start-screen')?.classList.remove('hidden');
                        } else window.renderAccountGate();

                        window.authenticatedUserHandled = user.uid;
                        window.watchTrustedAccountAccess(user.uid, user.email);

                    } catch (error) {
                        console.error("Lỗi xác thực:", error);
                        if (loaderText) loaderText.textContent = `Không thể kết nối dữ liệu LMS: ${error.message || error}`;
                        document.getElementById('cloud-loader')?.classList.add('hidden');
                        document.getElementById('auth-ui')?.classList.add('hidden');
                        document.getElementById('public-landing-ui')?.classList.remove('hidden');
                        const publicDataError = document.getElementById('public-data-error');
                        if (publicDataError) {
                            publicDataError.textContent = `Không thể tải dữ liệu LMS: ${error.message || error}`;
                            publicDataError.classList.remove('hidden');
                        }
                    }
                } else {
                    window.authenticatedUserHandled = null;
                    window.accountAccessUnsubscribe?.();
                    window.accountAccessUnsubscribe = null;
                    window.trustedAccountAccess = null;
                    window.lmsBootedUid = null;
                    TEST_BANK = [];
                    CLASSES = [];
                    SCHEDULES = [];
                    ATTENDANCE = [];
                    SUBMISSIONS = [];
                    CHAT_MESSAGES = [];
                    currentUser = null;
                    sessionStorage.removeItem('ielts_session');
                    document.getElementById('cloud-loader')?.classList.add('hidden');
                    document.getElementById('auth-ui')?.classList.add('hidden');
                    document.getElementById('awaiting-approval-ui')?.classList.add('hidden');
                    document.getElementById('start-screen')?.classList.add('hidden');
                    document.getElementById('editor-ui')?.classList.add('hidden');
                    document.getElementById('public-landing-ui')?.classList.remove('hidden');
                }
            });
            
        } catch (error) {
            console.error("Firebase System Crash:", error);
            spinner.classList.add('hidden');
            loaderText.innerHTML = `
              <div class='bg-rose-900/50 border border-rose-500 p-4 rounded text-left'>
                 <b class='text-rose-400'>Critical Crash:</b><br>
                 <span class='text-rose-200 text-xs font-mono'>${error.message}</span>
              </div>
            `;
        }
    }

    window.modifyTable = function(action) {
    // 1. Xác định vị trí con trỏ chuột và ô bảng (cell) đang tương tác
    const selection = window.getSelection();
    if (!selection.rangeCount) return;
    
    let node = selection.getRangeAt(0).startContainer;
    if (node.nodeType === 3) node = node.parentNode; // Nếu là text node, lấy thẻ bọc ngoài
    
    const cell = node.closest('td, th');
    if (!cell) {
        if(typeof window.showToast === 'function') window.showToast("Thông báo", "Vui lòng đặt con trỏ chuột vào một ô trong bảng.", "info");
        return;
    }

    const row = cell.parentElement;
    const tbody = row.parentElement;
    const table = tbody.closest('table');

    try {
        if (action === 'merge-right') {
            const nextCell = cell.nextElementSibling;
            if (!nextCell) throw new Error("Không tìm thấy ô bên phải để gộp.");
            
            // Dồn nội dung từ ô bên phải sang ô hiện tại
            if (nextCell.innerHTML.trim() && nextCell.innerHTML !== '<br>') {
                cell.innerHTML += '<br>' + nextCell.innerHTML;
            }
            
            // Tăng số lượng cột chiếm chỗ và xóa ô thừa
            cell.colSpan = (cell.colSpan || 1) + (nextCell.colSpan || 1);
            nextCell.remove();
        } 
        else if (action === 'merge-down') {
            const rows = Array.from(tbody.rows);
            const rowIndex = rows.indexOf(row);
            const nextRow = rows[rowIndex + (cell.rowSpan || 1)];
            
            if (!nextRow) throw new Error("Không tìm thấy dòng bên dưới để gộp.");

            // Xác định ô nằm ngay bên dưới dựa trên cellIndex
            const targetCell = nextRow.cells[cell.cellIndex];
            if (!targetCell) throw new Error("Cấu trúc cột không đồng nhất, không thể gộp dọc.");

            // Dồn nội dung
            if (targetCell.innerHTML.trim() && targetCell.innerHTML !== '<br>') {
                cell.innerHTML += '<br>' + targetCell.innerHTML;
            }
            
            // Tăng số lượng dòng chiếm chỗ và xóa ô thừa
            cell.rowSpan = (cell.rowSpan || 1) + (targetCell.rowSpan || 1);
            targetCell.remove();
        }
        else if (action === 'row-above') {
            const newRow = row.cloneNode(true);
            Array.from(newRow.cells).forEach(c => { c.innerHTML = '<br>'; c.colSpan = 1; c.rowSpan = 1; });
            tbody.insertBefore(newRow, row);
        }
        else if (action === 'row-below') {
            const newRow = row.cloneNode(true);
            Array.from(newRow.cells).forEach(c => { c.innerHTML = '<br>'; c.colSpan = 1; c.rowSpan = 1; });
            if (row.nextElementSibling) tbody.insertBefore(newRow, row.nextElementSibling);
            else tbody.appendChild(newRow);
        }
        else if (action === 'del-row') {
            row.remove();
            if (tbody.rows.length === 0) table.remove();
        }
        else if (action === 'col-left' || action === 'col-right') {
            const index = cell.cellIndex;
            Array.from(tbody.rows).forEach(r => {
                const target = r.cells[index];
                if (target) {
                    const newCell = target.cloneNode(false);
                    newCell.innerHTML = '<br>';
                    newCell.colSpan = 1; 
                    newCell.rowSpan = 1;
                    if (action === 'col-left') r.insertBefore(newCell, target);
                    else r.insertBefore(newCell, target.nextElementSibling);
                }
            });
        }
        else if (action === 'del-col') {
            const index = cell.cellIndex;
            Array.from(tbody.rows).forEach(r => {
                if (r.cells[index]) r.cells[index].remove();
            });
            if (tbody.rows[0] && tbody.rows[0].cells.length === 0) table.remove();
        }
        else if (action === 'unmerge') {
            // Logic tách ô cơ bản
            const cSpan = cell.colSpan || 1;
            const rSpan = cell.rowSpan || 1;
            if (cSpan === 1 && rSpan === 1) return;
            
            cell.colSpan = 1;
            cell.rowSpan = 1;
            
            // Khôi phục các cột bên phải
            for (let i = 1; i < cSpan; i++) {
                const newCell = cell.cloneNode(false);
                newCell.innerHTML = '<br>';
                row.insertBefore(newCell, cell.nextElementSibling);
            }
        }
        else if (action === 'toggle-width') {
            table.style.width = (table.style.width === '100%') ? 'auto' : '100%';
        }
        else if (action === 'toggle-border') {
            table.classList.toggle('no-border');
        }

        // 3. Kích hoạt lưu tự động của hệ thống
        if (typeof window.triggerEditorAutosave === 'function') window.triggerEditorAutosave();

    } catch (err) {
        // Bắt lỗi nhẹ nhàng bằng giao diện Toast thay vì văng bảng thông báo hệ thống
        console.error("Lỗi thao tác bảng:", err);
        if(typeof window.showToast === 'function') {
            window.showToast("Lỗi Thao Tác", err.message, "error");
        }
    }
};

    window.addEventListener('DOMContentLoaded', () => {
        window.applyStudentLanguage(studentLanguage, false);
        window.initFirebaseSystem();
        const editorBuilder = document.getElementById('editor-view-builder');
        if (editorBuilder) {
            editorBuilder.addEventListener('input', triggerEditorAutosave);
            editorBuilder.addEventListener('change', triggerEditorAutosave);
        }

        // Auto-apply the premium focus state to all existing form elements
        const formElements = document.querySelectorAll('input:not([type="checkbox"]):not([type="radio"]), textarea, select');
        formElements.forEach(el => {
            el.className = el.className.replace(/focus:ring-\d/g, '').replace(/focus:ring-[a-z]+-\d+\/\d+/g, '').replace(/focus:border-[a-z]+-\d+/g, '');
            el.classList.add('input-standard');
        });

        // ✨ NEW: Start the Background Reminder Engine (Checks every 30 seconds)
        setInterval(() => {
            if(typeof window.checkUpcomingClasses === 'function') window.checkUpcomingClasses();
            if(typeof window.checkHomeworkDeadlines === 'function') window.checkHomeworkDeadlines();
        }, 30000);
    });
