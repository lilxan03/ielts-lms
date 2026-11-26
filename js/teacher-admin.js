    window.handleCustomQR = async function(e) {
        const file = e.target.files[0];
        if (!file) return;
        
        document.getElementById('bill-custom-qr').disabled = true;
        
        // ✨ FIX: Use the bulletproof local Base64 compressor instead of Firebase Storage
        // This prevents the "Failed to upload QR code" alert by saving it directly to the database document!
        window.compressProfileImage(file, 600, 0.8, (base64) => {
            tempCustomQRBase64 = base64;
            const preview = document.getElementById('bill-custom-qr-preview');
            preview.src = tempCustomQRBase64;
            preview.classList.remove('hidden');
            document.getElementById('bill-custom-qr-clear').classList.remove('hidden');
            document.getElementById('bill-custom-qr').disabled = false;
            
            if (typeof window.showToast === 'function') window.showToast("QR Loaded", "Image processed successfully. Click Save Settings to apply.");
        });
    };

    window.clearCustomQR = function() {
        tempCustomQRBase64 = null;
        document.getElementById('bill-custom-qr').value = '';
        document.getElementById('bill-custom-qr-preview').classList.add('hidden');
        document.getElementById('bill-custom-qr-clear').classList.add('hidden');
    };

    window.deleteSubmission = function(id) {
        showConfirm("Delete Submission", "Are you sure you want to permanently delete this student's submission?", async () => {
            SUBMISSIONS = SUBMISSIONS.filter(s => s.id !== id);
            await window.fsDeleteDoc(window.fsDoc(window.db, window.fPath('submissions'), String(id)));
            renderClasses(); 
        });
    };

    // Save individual class fees to Firebase instantly
    window.deleteSubmission = function(id) {
        showConfirm("Delete Submission", "Are you sure you want to permanently delete this student's submission?", async () => {
            SUBMISSIONS = SUBMISSIONS.filter(s => s.id !== id);
            await window.fsDeleteDoc(window.fsDoc(window.db, window.fPath('submissions'), String(id)));
            renderClasses(); 
        });
    };

    // Save individual package fees to Firebase instantly
    window.updatePackageFee = async function(pid, fee) {
        const pkg = PACKAGES.find(p => p.id === pid);
        if(pkg) {
            pkg.feePerLesson = fee ? Number(fee) : null; 
            await window.fsSetDoc(window.fsDoc(window.db, window.fPath('packages'), pkg.id), pkg);
        }
    };

    let paymentAccessRefreshTimer = null;
    const paymentAccessColumnDefaults = [22, 15, 13, 14, 14, 12, 10];
    const paymentAccessColumnMinimums = [16, 10, 10, 10, 10, 9, 8];
    const paymentAccessColumnStorageKey = 'lms_payment_access_column_widths';

    function enablePaymentAccessColumnResizing(table) {
        const columns = Array.from(table.querySelectorAll('col'));
        let widths = [...paymentAccessColumnDefaults];
        try {
            const savedWidths = JSON.parse(localStorage.getItem(paymentAccessColumnStorageKey) || 'null');
            if (Array.isArray(savedWidths) && savedWidths.length === paymentAccessColumnDefaults.length &&
                savedWidths.every(width => Number.isFinite(width) && width > 0)) {
                const total = savedWidths.reduce((sum, width) => sum + width, 0);
                widths = savedWidths.map(width => width * 100 / total);
            }
        } catch (error) {
            console.error('Unable to restore payment table column widths:', error);
        }

        const applyWidths = () => columns.forEach((column, index) => {
            column.style.width = `${widths[index]}%`;
        });
        applyWidths();

        table.querySelectorAll('[data-payment-col-resizer]').forEach(handle => {
            handle.addEventListener('pointerdown', event => {
                event.preventDefault();
                const leftIndex = Number(handle.dataset.paymentColResizer);
                const rightIndex = leftIndex + 1;
                const startX = event.clientX;
                const tableWidth = table.getBoundingClientRect().width;
                if (!tableWidth || rightIndex >= widths.length) return;
                const startLeftWidth = widths[leftIndex];
                const startRightWidth = widths[rightIndex];
                handle.setPointerCapture(event.pointerId);

                const resize = moveEvent => {
                    const delta = (moveEvent.clientX - startX) / tableWidth * 100;
                    const pairTotal = startLeftWidth + startRightWidth;
                    const minLeft = paymentAccessColumnMinimums[leftIndex];
                    const minRight = paymentAccessColumnMinimums[rightIndex];
                    widths[leftIndex] = Math.min(pairTotal - minRight, Math.max(minLeft, startLeftWidth + delta));
                    widths[rightIndex] = pairTotal - widths[leftIndex];
                    applyWidths();
                };
                const finishResize = () => {
                    handle.removeEventListener('pointermove', resize);
                    handle.removeEventListener('pointerup', finishResize);
                    handle.removeEventListener('pointercancel', finishResize);
                    try {
                        localStorage.setItem(paymentAccessColumnStorageKey, JSON.stringify(widths));
                    } catch (error) {
                        console.error('Unable to save payment table column widths:', error);
                    }
                };

                handle.addEventListener('pointermove', resize);
                handle.addEventListener('pointerup', finishResize, { once: true });
                handle.addEventListener('pointercancel', finishResize, { once: true });
            });
        });
    }

    function enableTeacherTimetableResizing() {
        const workspace = document.getElementById('teacher-timetable-workspace');
        const handle = document.getElementById('teacher-timetable-resizer');
        if (!workspace || !handle || handle.dataset.resizerReady) return;

        let ratio = 67;
        try {
            const savedRatio = Number(localStorage.getItem('lms_teacher_timetable_split'));
            if (Number.isFinite(savedRatio) && savedRatio >= 40 && savedRatio <= 75) ratio = savedRatio;
        } catch (error) {
            console.error('Unable to restore timetable panel widths:', error);
        }
        const applyRatio = () => {
            workspace.style.setProperty('--teacher-calendar-ratio', `${ratio}fr`);
            workspace.style.gridTemplateColumns = `minmax(0, ${ratio}fr) 10px minmax(0, ${100 - ratio}fr)`;
        };
        applyRatio();
        handle.dataset.resizerReady = 'true';
        handle.addEventListener('pointerdown', event => {
            if (window.matchMedia('(max-width: 767px)').matches) return;
            event.preventDefault();
            const startX = event.clientX;
            const availableWidth = workspace.getBoundingClientRect().width - handle.offsetWidth;
            const startRatio = ratio;
            handle.setPointerCapture(event.pointerId);
            const resize = moveEvent => {
                if (availableWidth <= 0) return;
                ratio = Math.min(75, Math.max(40, startRatio + (moveEvent.clientX - startX) / availableWidth * 100));
                applyRatio();
            };
            const finishResize = () => {
                handle.removeEventListener('pointermove', resize);
                handle.removeEventListener('pointerup', finishResize);
                handle.removeEventListener('pointercancel', finishResize);
                try {
                    localStorage.setItem('lms_teacher_timetable_split', String(ratio));
                } catch (error) {
                    console.error('Unable to save timetable panel widths:', error);
                }
            };
            handle.addEventListener('pointermove', resize);
            handle.addEventListener('pointerup', finishResize, { once: true });
            handle.addEventListener('pointercancel', finishResize, { once: true });
        });
    }

    function enableForumPanelResizing(panel) {
        const layout = panel?.querySelector('#forum-split-layout');
        const handle = panel?.querySelector('#forum-split-resizer');
        if (!layout || !handle || handle.dataset.resizerReady) return;

        let ratio = 34;
        try {
            const savedRatio = Number(localStorage.getItem('lms_forum_sidebar_ratio'));
            if (Number.isFinite(savedRatio) && savedRatio >= 25 && savedRatio <= 55) ratio = savedRatio;
        } catch (error) {
            console.error('Unable to restore forum panel widths:', error);
        }
        const applyRatio = () => layout.style.setProperty('--forum-list-width', `${ratio}%`);
        applyRatio();
        handle.dataset.resizerReady = 'true';
        handle.addEventListener('pointerdown', event => {
            if (window.matchMedia('(max-width: 767px)').matches) return;
            event.preventDefault();
            const startX = event.clientX;
            const availableWidth = layout.getBoundingClientRect().width - handle.offsetWidth;
            const startRatio = ratio;
            handle.setPointerCapture(event.pointerId);
            const resize = moveEvent => {
                if (availableWidth <= 0) return;
                ratio = Math.min(55, Math.max(25, startRatio + (moveEvent.clientX - startX) / availableWidth * 100));
                applyRatio();
            };
            const finishResize = () => {
                handle.removeEventListener('pointermove', resize);
                handle.removeEventListener('pointerup', finishResize);
                handle.removeEventListener('pointercancel', finishResize);
                try {
                    localStorage.setItem('lms_forum_sidebar_ratio', String(ratio));
                } catch (error) {
                    console.error('Unable to save forum panel widths:', error);
                }
            };
            handle.addEventListener('pointermove', resize);
            handle.addEventListener('pointerup', finishResize, { once: true });
            handle.addEventListener('pointercancel', finishResize, { once: true });
        });
    }

    function renderPaymentAccessList() {
        const container = document.getElementById('payment-access-list');
        if (!container) return;
        if (paymentAccessRefreshTimer) clearTimeout(paymentAccessRefreshTimer);

        const students = USERS.filter(user => user.role === 'student').sort((a, b) => {
            if (a.paymentStatus === 'pending' && b.paymentStatus !== 'pending') return -1;
            if (b.paymentStatus === 'pending' && a.paymentStatus !== 'pending') return 1;
            return String(a.user).localeCompare(String(b.user));
        });
        const now = Date.now();
        const nextExpiry = students
            .map(user => getBillingExpiryMillis(user))
            .filter(expiry => expiry !== null && expiry > now)
            .sort((a, b) => a - b)[0];

        if (nextExpiry) {
            paymentAccessRefreshTimer = setTimeout(
                renderPaymentAccessList,
                Math.min(nextExpiry - now + 100, 2147483647)
            );
        }

        if (!students.length) {
            container.innerHTML = '<div class="p-8 text-center text-slate-500 italic">No students to display.</div>';
            return;
        }

        container.innerHTML = `<table class="payment-access-table w-full min-w-[1200px] text-left border-collapse" style="table-layout:fixed">
            <colgroup>${paymentAccessColumnDefaults.map(() => '<col>').join('')}</colgroup>
            <thead><tr class="bg-slate-50 border-b border-slate-200 text-[10px] font-black text-slate-400 uppercase tracking-widest">
                <th class="p-4 relative">Student<button type="button" class="payment-col-resizer" data-payment-col-resizer="0" aria-label="Resize Student column"></button></th>
                <th class="p-4 relative">Paid Plan<button type="button" class="payment-col-resizer" data-payment-col-resizer="1" aria-label="Resize Paid Plan column"></button></th>
                <th class="p-4 relative">Last Payment<button type="button" class="payment-col-resizer" data-payment-col-resizer="2" aria-label="Resize Last Payment column"></button></th>
                <th class="p-4 relative">Payment Deadline<button type="button" class="payment-col-resizer" data-payment-col-resizer="3" aria-label="Resize Payment Deadline column"></button></th>
                <th class="p-4 text-center relative">Access Status<button type="button" class="payment-col-resizer" data-payment-col-resizer="4" aria-label="Resize Access Status column"></button></th>
                <th class="p-4 relative">Pending Payment<button type="button" class="payment-col-resizer" data-payment-col-resizer="5" aria-label="Resize Pending Payment column"></button></th>
                <th class="p-4 text-right">Action</th>
            </tr></thead><tbody class="divide-y divide-slate-100 text-sm">
                ${students.map(user => {
                    const billing = getStudentBillingStatus(user, now);
                    const statusClass = billing.hasAccess
                        ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                        : billing.pending
                            ? 'bg-amber-50 text-amber-700 border-amber-200'
                            : 'bg-rose-50 text-rose-700 border-rose-200';
                    const plan = user.billingPlanTitle || (billing.legacy ? 'Existing access (no expiry recorded)' : '—');
                    const pendingInfo = user.paymentStatus === 'pending' ? (user.pendingInfo || 'Awaiting review') : '—';
                    const pendingTaxMeta = user.paymentStatus === 'pending' && (user.pendingTaxPayerName || user.pendingTaxPayerPhone || user.pendingTaxId)
                        ? [
                            user.pendingTaxPayerName ? `Người nộp: ${user.pendingTaxPayerName}` : '',
                            user.pendingTaxPayerPhone ? `SĐT: ${user.pendingTaxPayerPhone}` : '',
                            user.pendingTaxId ? `MST/CCCD: ${user.pendingTaxId}` : '',
                            user.pendingTaxInvoiceRequested ? 'Yêu cầu HĐ' : ''
                          ].filter(Boolean).join(' · ')
                        : '';
                    const safePendingInfo = lmsEscapeHtml(pendingInfo);
                    const safePendingTaxMeta = lmsEscapeHtml(pendingTaxMeta);
                    const email = typeof user.email === 'string' && !user.email.trim().toLowerCase().endsWith('@khanhlms.com')
                        ? user.email.trim()
                        : '';
                    const username = String(user.username || user.user || '').trim();
                    const isUidUsername = Boolean(username && (
                        (user.uid && username === String(user.uid)) ||
                        /^[A-Za-z0-9_-]{20,}$/.test(username)
                    ));
                    const studentLabel = email || (!isUidUsername ? username : '') || String(user.realName || '').trim() || 'Email not linked';
                    const studentSubLabel = email && username && username.toLowerCase() !== email.toLowerCase() && !isUidUsername
                        ? username
                        : !email && studentLabel !== 'Email not linked' && studentLabel !== username
                            ? 'Username unavailable'
                            : '';
                    const safeStudentLabel = String(studentLabel).replace(/[&<>"']/g, char => ({
                        '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
                    })[char]);
                    const safeStudentSubLabel = String(studentSubLabel).replace(/[&<>"']/g, char => ({
                        '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
                    })[char]);
                    const action = user.paymentStatus === 'pending'
                        ? `<button onclick="togglePaymentStatus('${user.user}', true)" class="bg-emerald-600 hover:bg-emerald-700 text-white text-[10px] font-bold px-3 py-1.5 rounded-lg shadow-sm whitespace-nowrap">✓ Approve payment</button>`
                        : `<button onclick="togglePaymentStatus('${user.user}', ${!billing.hasAccess})" class="bg-white border border-slate-200 hover:bg-slate-50 text-slate-600 text-[10px] font-bold px-3 py-1.5 rounded-lg whitespace-nowrap">${billing.hasAccess ? 'Lock access' : 'Unlock access'}</button>`;
                    return `<tr class="hover:bg-blue-50/40">
                        <td class="p-4 font-bold text-slate-800" title="${safeStudentLabel}${safeStudentSubLabel ? ` · ${safeStudentSubLabel}` : ''}"><span class="block truncate">${safeStudentLabel}</span>${safeStudentSubLabel ? `<span class="block text-[10px] font-medium text-slate-500 truncate">${safeStudentSubLabel}</span>` : ''}</td>
                        <td class="p-4 text-slate-700">${plan}</td>
                        <td class="p-4 text-slate-600"><div>${formatBillingDate(user.billingLastPaymentAt)}</div><div class="text-xs font-bold text-emerald-700">${user.billingLastPaymentAmount ? formatVND(user.billingLastPaymentAmount) : '—'}</div></td>
                        <td class="p-4">
                            <div class="font-bold ${billing.expiry !== null && billing.expiry <= now && !billing.overridden ? 'text-rose-600' : 'text-slate-700'}">${billing.overridden ? 'Manual override' : formatBillingDate(billing.expiry)}</div>
                            <button onclick="window.editStudentBillingDeadline('${user.user}')" class="mt-1 text-[10px] font-bold text-blue-600 hover:text-blue-800 hover:underline">${billing.expiry === null ? 'Set deadline' : 'Edit deadline'}</button>
                        </td>
                        <td class="p-4 text-center"><span class="inline-flex border px-2.5 py-1 rounded-full text-[10px] font-black whitespace-nowrap ${statusClass}">${billing.label}</span></td>
                        <td class="p-4 text-xs text-slate-600 max-w-[260px]" title="${safePendingInfo}${safePendingTaxMeta ? ` | ${safePendingTaxMeta}` : ''}"><div class="truncate font-semibold">${safePendingInfo}</div>${safePendingTaxMeta ? `<div class="truncate text-[10px] text-indigo-700 font-medium mt-0.5">${safePendingTaxMeta}</div>` : ''}</td>
                        <td class="p-4 text-right">${action}</td>
                    </tr>`;
                }).join('')}
            </tbody></table>`;
        enablePaymentAccessColumnResizing(container.querySelector('.payment-access-table'));
    }

    window.editStudentBillingDeadline = function(username) {
        if (!currentUser || currentUser.role !== 'teacher') return;
        const student = USERS.find(user => user.user === username && user.role === 'student');
        if (!student) {
            showModalMsg('Student Not Found', 'Could not find this student account. Refresh the list and try again.');
            return;
        }

        const modal = document.getElementById('custom-modal');
        const title = document.getElementById('modal-title');
        const message = document.getElementById('modal-message');
        const input = document.getElementById('modal-input');
        const cancel = document.getElementById('modal-cancel');
        const confirm = document.getElementById('modal-confirm');
        title.textContent = `Payment Deadline: ${window.getStudentDisplayName ? window.getStudentDisplayName(student) : student.user}`;
        message.innerHTML = `
            <label for="student-billing-deadline-input" class="block text-sm font-bold text-slate-700 mb-2">Last day to pay (access remains available through this date)</label>
            <input id="student-billing-deadline-input" type="date" value="${formatBillingDateInput(getBillingExpiryMillis(student))}" class="w-full border-2 border-slate-200 p-3 rounded-xl font-bold text-slate-800 outline-none focus:border-blue-500">
            <p class="text-xs text-slate-500 mt-2">If the student has not renewed by the end of this date, course access will be locked. Saving a deadline also disables any manual access override.</p>
            ${getBillingExpiryMillis(student) !== null ? `<button type="button" onclick="window.clearStudentBillingDeadline('${student.user}')" class="mt-3 text-xs font-bold text-rose-600 hover:text-rose-800 hover:underline">Remove payment deadline</button>` : ''}
        `;
        input.classList.add('hidden');
        cancel.textContent = 'Cancel';
        cancel.classList.remove('hidden');
        confirm.textContent = 'Save Deadline';
        confirm.disabled = false;
        modal.classList.remove('hidden');

        cancel.onclick = () => {
            modal.classList.add('hidden');
            confirm.textContent = 'OK';
            confirm.disabled = false;
        };
        confirm.onclick = async () => {
            const deadlineInput = document.getElementById('student-billing-deadline-input');
            const deadline = parseBillingDeadlineDate(deadlineInput?.value);
            if (deadline === null) {
                showModalMsg('Invalid Date', 'Choose a valid payment deadline before saving.');
                return;
            }

            confirm.disabled = true;
            confirm.textContent = 'Saving...';
            const updatedStudent = { ...student, billingExpiresAt: deadline, billingAccessOverride: false, billingDeadlineSetByEditor: true };
            try {
                await window.fsSetDoc(window.fsDoc(window.db, window.fPath('users'), username), updatedStudent);
                await window.syncTrustedAccountAccess(updatedStudent);
                Object.assign(student, updatedStudent);
                modal.classList.add('hidden');
                confirm.textContent = 'OK';
                confirm.disabled = false;
                renderStudentsList();
                renderPaymentAccessList();
                if (typeof window.showToast === 'function') window.showToast('Deadline Saved', `${username}'s access deadline is ${formatBillingDate(deadline)}.`);
            } catch (error) {
                console.error(`Unable to save payment deadline for "${username}":`, error);
                confirm.disabled = false;
                confirm.textContent = 'Save Deadline';
                showModalMsg('Save Failed', 'Could not save the payment deadline. Please try again.');
            }
        };
    };

    window.clearStudentBillingDeadline = async function(username) {
        if (!currentUser || currentUser.role !== 'teacher') return;
        const student = USERS.find(user => user.user === username && user.role === 'student');
        if (!student) {
            showModalMsg('Student Not Found', 'Could not find this student account. Refresh the list and try again.');
            return;
        }
        const updatedStudent = { ...student };
        delete updatedStudent.billingExpiresAt;
        delete updatedStudent.billingDeadlineSetByEditor;
        updatedStudent.billingAccessOverride = false;
        try {
            await window.fsSetDoc(window.fsDoc(window.db, window.fPath('users'), username), updatedStudent);
            await window.syncTrustedAccountAccess(updatedStudent);
            Object.assign(student, updatedStudent);
            document.getElementById('custom-modal').classList.add('hidden');
            const confirm = document.getElementById('modal-confirm');
            confirm.textContent = 'OK';
            confirm.disabled = false;
            renderStudentsList();
            renderPaymentAccessList();
            if (typeof window.showToast === 'function') window.showToast('Deadline Removed', `${username}'s payment deadline was removed.`);
        } catch (error) {
            console.error(`Unable to remove payment deadline for "${username}":`, error);
            showModalMsg('Save Failed', 'Could not remove the payment deadline. Please try again.');
        }
    };

    window.renderPaymentsView = function() {
        document.getElementById('bill-fee').value = BILLING_SETTINGS.feePerLesson || 100000;
        document.getElementById('bill-lpm').value = BILLING_SETTINGS.lessonsPerMonth || 12;
        document.getElementById('bill-disc-combo').value = BILLING_SETTINGS.discCombo || 10;
        document.getElementById('bill-disc-course').value = 20;
        const setFieldVal = (id, val) => { const el = document.getElementById(id); if (el) el.value = val; };
        setFieldVal('bill-hkd-name', BILLING_SETTINGS.hkdName || '');
        setFieldVal('bill-hkd-tax-id', BILLING_SETTINGS.hkdTaxId || '');
        setFieldVal('bill-hkd-sector', BILLING_SETTINGS.hkdBusinessSector || 'Dịch vụ giáo dục, đào tạo tiếng Anh');
        setFieldVal('bill-hkd-address', BILLING_SETTINGS.hkdAddress || '');
        setFieldVal('bill-hkd-vat', BILLING_SETTINGS.hkdVatRate !== undefined && BILLING_SETTINGS.hkdVatRate !== null ? BILLING_SETTINGS.hkdVatRate : 0);
        setFieldVal('bill-hkd-pit', BILLING_SETTINGS.hkdPitRate !== undefined && BILLING_SETTINGS.hkdPitRate !== null ? BILLING_SETTINGS.hkdPitRate : 2);
        setFieldVal('bill-bank-id', BILLING_SETTINGS.bankId || 'MB');
        setFieldVal('bill-bank-acc', BILLING_SETTINGS.bankAcc || '');
        setFieldVal('bill-bank-name', BILLING_SETTINGS.bankName || '');

        if (BILLING_SETTINGS.customQR) {
            tempCustomQRBase64 = BILLING_SETTINGS.customQR;
            const preview = document.getElementById('bill-custom-qr-preview');
            preview.src = tempCustomQRBase64;
            preview.classList.remove('hidden');
            const clearBtn = document.getElementById('bill-custom-qr-clear');
            if (clearBtn) clearBtn.classList.remove('hidden');
        } else {
            window.clearCustomQR();
        }

        // Render the Packages list
        const pkgList = document.getElementById('packages-pricing-list');
        renderPaymentAccessList();
        if (typeof window.renderHkdTaxLedger === 'function') window.renderHkdTaxLedger();
        if (pkgList) {
            if (PACKAGES.length === 0) {
                pkgList.innerHTML = `<div class="col-span-full text-slate-400 italic text-sm py-4 text-center bg-slate-50 rounded-xl border border-slate-100">No packages created yet.</div>`;
            } else {
                pkgList.innerHTML = PACKAGES.map(p => {
                    const clsCount = p.classes ? p.classes.length : 0;
                    return `
                    <div class="bg-slate-50 p-5 rounded-2xl border border-slate-200 flex flex-col justify-between shadow-sm">
                        <div class="flex justify-between items-start mb-3">
                            <h4 class="font-black text-slate-800 text-lg leading-tight">${p.name}</h4>
                            <div class="flex gap-2">
                                <button onclick="window.editPackage('${p.id}')" class="text-blue-600 hover:text-white text-xs font-bold bg-blue-50 hover:bg-blue-600 px-3 py-1.5 rounded-lg shadow-sm border border-blue-200 transition">Edit</button>
                                <button onclick="window.deletePackage('${p.id}')" class="text-rose-500 hover:text-white text-xs font-bold bg-rose-50 hover:bg-rose-500 px-3 py-1.5 rounded-lg shadow-sm border border-rose-200 transition">Delete</button>
                            </div>
                        </div>
                        <div class="text-[10px] font-black tracking-widest uppercase text-purple-600 bg-purple-100 px-2 py-1 rounded-md inline-block w-max mb-4 border border-purple-200">Includes ${clsCount} Courses</div>
                        <div class="flex items-center justify-between mt-auto border-t border-slate-200 pt-3">
                            <span class="text-[10px] font-black text-slate-400 uppercase tracking-widest">Fee/Lesson:</span>
                            <input type="number" onchange="window.updatePackageFee('${p.id}', this.value)" value="${p.feePerLesson || ''}" placeholder="${BILLING_SETTINGS.feePerLesson || 100000}" class="w-24 text-sm text-emerald-700 font-black outline-none text-right bg-white border border-slate-200 rounded-lg px-2 py-1 shadow-inner focus:border-emerald-400 focus:ring-1 focus:ring-emerald-400 transition-colors">
                        </div>
                    </div>`;
                }).join('');
            }
        }
        
        // Ensure the chart is rendered when the view is opened
        setTimeout(() => window.updateRevenueChart('month'), 50);
    };

    // ✨ NEW: Sổ chi tiết doanh thu S1-HKD (Thông tư 88/2021/TT-BTC) & Tính thuế HKD (Thông tư 40/2021/TT-BTC)
    window.formatHkdReceiptNumber = function(timestamp, index = 1) {
        const d = new Date(Number(timestamp) || Date.now());
        const yyyy = d.getFullYear();
        const mm = String(d.getMonth() + 1).padStart(2, '0');
        const seq = String(Math.max(1, index)).padStart(4, '0');
        return `PT-${yyyy}${mm}-${seq}`;
    };

    window.collectHkdTaxEntries = function(usersList = USERS, billingSettings = BILLING_SETTINGS) {
        const entries = [];
        const safeUsers = Array.isArray(usersList) ? usersList : [];
        safeUsers.forEach(u => {
            if (!u || u.role !== 'student') return;
            const history = Array.isArray(u.paymentHistory) ? u.paymentHistory : [];
            if (history.length > 0) {
                history.forEach((payment, idx) => {
                    const amount = Number(payment.amount) || 0;
                    if (amount <= 0) return;
                    const approvedAt = Number(payment.approvedAt) || Number(u.billingLastPaymentAt) || Date.now();
                    const dateObj = new Date(approvedAt);
                    const year = dateObj.getFullYear();
                    const month = dateObj.getMonth() + 1;
                    const quarter = Math.floor((month - 1) / 3) + 1;
                    const payerName = payment.payerName || u.taxPayerName || u.realName || u.parentName || (window.getStudentDisplayName ? window.getStudentDisplayName(u) : u.user);
                    const payerPhone = payment.payerPhone || u.phone || '';
                    const taxId = payment.taxId || u.taxId || '';
                    const taxAddress = payment.taxAddress || u.taxAddress || '';
                    const courseNames = Array.isArray(payment.classes) && payment.classes.length
                        ? payment.classes.join(', ')
                        : (payment.courseDescription || payment.plan || u.billingPlanTitle || 'Học phí khóa học');
                    entries.push({
                        id: payment.id || `pay_${u.user}_${idx}`,
                        receiptNo: payment.receiptNo || window.formatHkdReceiptNumber(approvedAt, entries.length + 1),
                        approvedAt,
                        year,
                        quarter,
                        month,
                        studentUsername: u.user,
                        studentEmail: u.email || '',
                        payerName,
                        payerPhone,
                        taxId,
                        taxAddress,
                        invoiceRequested: Boolean(payment.invoiceRequested),
                        paymentMethod: payment.paymentMethod || 'Chuyển khoản NH',
                        receivingBank: payment.receivingBank || (billingSettings?.bankAcc ? `${billingSettings.bankId || 'MB'} - ${billingSettings.bankAcc}` : ''),
                        plan: payment.plan || 'Học phí',
                        months: Number(payment.months) || 1,
                        lessons: Number(payment.lessons) || 0,
                        description: payment.description || `Thu học phí ${courseNames} (${payment.plan || `${payment.months || 1} tháng`}) - HV: ${payerName}`,
                        amount
                    });
                });
            } else if (u.isPaid && Number(u.billingLastPaymentAmount) > 0) {
                const amount = Number(u.billingLastPaymentAmount) || 0;
                const approvedAt = Number(u.billingLastPaymentAt) || Date.now();
                const dateObj = new Date(approvedAt);
                const year = dateObj.getFullYear();
                const month = dateObj.getMonth() + 1;
                const quarter = Math.floor((month - 1) / 3) + 1;
                const payerName = u.taxPayerName || u.realName || u.parentName || (window.getStudentDisplayName ? window.getStudentDisplayName(u) : u.user);
                entries.push({
                    id: u.lastApprovedPaymentId || `legacy_${u.user}`,
                    receiptNo: window.formatHkdReceiptNumber(approvedAt, entries.length + 1),
                    approvedAt,
                    year,
                    quarter,
                    month,
                    studentUsername: u.user,
                    studentEmail: u.email || '',
                    payerName,
                    payerPhone: u.phone || '',
                    taxId: u.taxId || '',
                    taxAddress: u.taxAddress || '',
                    invoiceRequested: false,
                    paymentMethod: 'Chuyển khoản NH',
                    receivingBank: billingSettings?.bankAcc ? `${billingSettings.bankId || 'MB'} - ${billingSettings.bankAcc}` : '',
                    plan: u.billingPlanTitle || 'Học phí',
                    months: Number(u.billingPlanMonths) || 1,
                    lessons: Number(u.totalLessonsPaid) || 0,
                    description: `Thu học phí (${u.billingPlanTitle || 'Khóa học'}) - HV: ${payerName}`,
                    amount
                });
            }
        });

        const manualEntries = Array.isArray(billingSettings?.manualTaxEntries) ? billingSettings.manualTaxEntries : [];
        manualEntries.forEach((m, idx) => {
            const amount = Number(m.amount) || 0;
            if (amount <= 0) return;
            const approvedAt = Number(m.approvedAt) || Date.now();
            const dateObj = new Date(approvedAt);
            const year = dateObj.getFullYear();
            const month = dateObj.getMonth() + 1;
            const quarter = Math.floor((month - 1) / 3) + 1;
            entries.push({
                id: m.id || `manual_${idx}`,
                receiptNo: m.receiptNo || window.formatHkdReceiptNumber(approvedAt, entries.length + 1),
                approvedAt,
                year,
                quarter,
                month,
                studentUsername: m.studentUsername || '',
                studentEmail: '',
                payerName: m.payerName || 'Khách nộp học phí',
                payerPhone: m.payerPhone || '',
                taxId: m.taxId || '',
                taxAddress: m.taxAddress || '',
                invoiceRequested: Boolean(m.invoiceRequested),
                paymentMethod: m.paymentMethod || 'Chuyển khoản NH',
                receivingBank: m.receivingBank || '',
                plan: m.plan || 'Phiếu thu bổ sung',
                months: Number(m.months) || 1,
                lessons: Number(m.lessons) || 0,
                description: m.description || `Thu học phí - ${m.payerName || ''}`,
                amount,
                isManual: true
            });
        });

        entries.sort((a, b) => a.approvedAt - b.approvedAt);
        const countersByMonth = {};
        entries.forEach(entry => {
            const ym = `${entry.year}${String(entry.month).padStart(2, '0')}`;
            countersByMonth[ym] = (countersByMonth[ym] || 0) + 1;
            if (!entry.receiptNo || /^PT-\d{6}-\d{4}$/.test(entry.receiptNo)) {
                entry.receiptNo = `PT-${ym}-${String(countersByMonth[ym]).padStart(4, '0')}`;
            }
        });
        return entries.sort((a, b) => b.approvedAt - a.approvedAt);
    };

    window.calculateHkdTaxSummary = function(entries, options = {}) {
        const vatRate = Number.isFinite(Number(options.vatRate)) ? Number(options.vatRate) : 0;
        const pitRate = Number.isFinite(Number(options.pitRate)) ? Number(options.pitRate) : 2;
        const periodRevenue = (entries || []).reduce((sum, item) => sum + (Number(item.amount) || 0), 0);
        const annualRevenue = Number.isFinite(Number(options.annualRevenue)) ? Number(options.annualRevenue) : periodRevenue;
        const vatAmount = Math.round(periodRevenue * (vatRate / 100));
        const pitAmount = Math.round(periodRevenue * (pitRate / 100));
        const totalTax = vatAmount + pitAmount;
        const netRevenue = periodRevenue - totalTax;
        const invoiceRequestedCount = (entries || []).filter(item => item.invoiceRequested).length;
        return {
            transactionCount: (entries || []).length,
            invoiceRequestedCount,
            periodRevenue,
            annualRevenue,
            vatRate,
            pitRate,
            vatAmount,
            pitAmount,
            totalTax,
            netRevenue
        };
    };

    window.renderHkdTaxLedger = function() {
        const periodTypeEl = document.getElementById('hkd-tax-period-type');
        const yearEl = document.getElementById('hkd-tax-year');
        const subperiodEl = document.getElementById('hkd-tax-subperiod');
        const cardsContainer = document.getElementById('hkd-tax-summary-cards');
        const tableContainer = document.getElementById('hkd-tax-ledger-table-container');
        const subtitleEl = document.getElementById('hkd-tax-profile-subtitle');
        if (!cardsContainer || !tableContainer) return;

        const allEntries = window.collectHkdTaxEntries(USERS, BILLING_SETTINGS);
        const now = new Date();
        const currentYear = now.getFullYear();
        const currentMonth = now.getMonth() + 1;
        const currentQuarter = Math.floor((currentMonth - 1) / 3) + 1;

        const yearsSet = new Set([currentYear, ...allEntries.map(e => e.year)]);
        const years = Array.from(yearsSet).sort((a, b) => b - a);
        const selectedYear = Number(yearEl?.value) || currentYear;
        if (yearEl) {
            yearEl.innerHTML = years.map(y => `<option value="${y}" ${y === selectedYear ? 'selected' : ''}>Năm ${y}</option>`).join('');
        }

        const periodType = periodTypeEl ? periodTypeEl.value : 'quarter';
        if (subperiodEl) {
            if (periodType === 'year') {
                subperiodEl.classList.add('hidden');
            } else if (periodType === 'quarter') {
                subperiodEl.classList.remove('hidden');
                const prevQ = /^Q[1-4]$/.test(subperiodEl.value) ? Number(subperiodEl.value.slice(1)) : currentQuarter;
                subperiodEl.innerHTML = [1, 2, 3, 4].map(q => `<option value="Q${q}" ${q === prevQ ? 'selected' : ''}>Quý ${q}</option>`).join('');
            } else {
                subperiodEl.classList.remove('hidden');
                const prevM = /^M\d+$/.test(subperiodEl.value) ? Number(subperiodEl.value.slice(1)) : currentMonth;
                subperiodEl.innerHTML = Array.from({ length: 12 }, (_, i) => i + 1).map(m => `<option value="M${m}" ${m === prevM ? 'selected' : ''}>Tháng ${m}</option>`).join('');
            }
        }

        const subVal = subperiodEl ? subperiodEl.value : `Q${currentQuarter}`;
        const yearEntries = allEntries.filter(e => e.year === selectedYear);
        const filteredEntries = yearEntries.filter(e => {
            if (periodType === 'year') return true;
            if (periodType === 'quarter') return `Q${e.quarter}` === subVal;
            if (periodType === 'month') return `M${e.month}` === subVal;
            return true;
        });

        const annualRevenue = yearEntries.reduce((sum, e) => sum + e.amount, 0);
        const vatRate = BILLING_SETTINGS.hkdVatRate !== undefined && BILLING_SETTINGS.hkdVatRate !== null ? Number(BILLING_SETTINGS.hkdVatRate) : 0;
        const pitRate = BILLING_SETTINGS.hkdPitRate !== undefined && BILLING_SETTINGS.hkdPitRate !== null ? Number(BILLING_SETTINGS.hkdPitRate) : 2;
        const summary = window.calculateHkdTaxSummary(filteredEntries, { vatRate, pitRate, annualRevenue });

        const periodLabel = periodType === 'year'
            ? `Năm ${selectedYear}`
            : periodType === 'quarter'
                ? `Quý ${subVal.replace('Q', '')}/${selectedYear}`
                : `Tháng ${subVal.replace('M', '')}/${selectedYear}`;

        if (subtitleEl) {
            const hkdTitle = [
                BILLING_SETTINGS.hkdName ? `HKD: ${BILLING_SETTINGS.hkdName}` : '',
                BILLING_SETTINGS.hkdTaxId ? `MST/CCCD: ${BILLING_SETTINGS.hkdTaxId}` : '',
                BILLING_SETTINGS.hkdBusinessSector || 'Dịch vụ giáo dục, đào tạo tiếng Anh'
            ].filter(Boolean).join(' · ');
            subtitleEl.textContent = `${hkdTitle} — Kỳ kê khai: ${periodLabel}`;
        }

        cardsContainer.innerHTML = `
            <div class="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
                <div class="text-[10px] font-black text-slate-400 uppercase tracking-widest">Doanh thu kỳ (${lmsEscapeHtml(periodLabel)})</div>
                <div class="text-2xl font-black text-blue-800 mt-1">${formatVND(summary.periodRevenue)}</div>
                <div class="text-xs font-semibold text-slate-500 mt-1">${summary.transactionCount} chứng từ thu · ${summary.invoiceRequestedCount} yêu cầu biên lai/HĐ</div>
            </div>
            <div class="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
                <div class="text-[10px] font-black text-slate-400 uppercase tracking-widest">Thuế GTGT (${summary.vatRate}%) &amp; TNCN (${summary.pitRate}%)</div>
                <div class="text-2xl font-black text-rose-700 mt-1">${formatVND(summary.totalTax)}</div>
                <div class="text-xs font-semibold text-slate-500 mt-1">GTGT: ${formatVND(summary.vatAmount)} · TNCN: ${formatVND(summary.pitAmount)}</div>
            </div>
            <div class="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
                <div class="text-[10px] font-black text-slate-400 uppercase tracking-widest">Doanh thu thực nhận sau thuế</div>
                <div class="text-2xl font-black text-emerald-700 mt-1">${formatVND(summary.netRevenue)}</div>
                <div class="text-xs font-semibold text-slate-500 mt-1">Đã trừ dự toán thuế HKD trong kỳ</div>
            </div>
            <div class="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
                <div class="text-[10px] font-black text-slate-400 uppercase tracking-widest">Lũy kế năm ${selectedYear}</div>
                <div class="text-2xl font-black text-indigo-800 mt-1">${formatVND(summary.annualRevenue)}</div>
                <div class="text-xs font-semibold text-slate-500 mt-1">${yearEntries.length} giao dịch trong năm ${selectedYear}</div>
            </div>
        `;

        if (filteredEntries.length === 0) {
            tableContainer.innerHTML = `<div class="p-8 text-center text-slate-500 italic text-sm">Chưa có chứng từ thu học phí nào trong kỳ ${lmsEscapeHtml(periodLabel)}. Khi giáo viên duyệt học phí, chứng từ sẽ tự động ghi vào sổ S1-HKD tại đây.</div>`;
            return;
        }

        tableContainer.innerHTML = `
            <table class="w-full min-w-[1100px] text-left border-collapse text-sm">
                <thead>
                    <tr class="bg-slate-50 border-b border-slate-200 text-[10px] font-black text-slate-500 uppercase tracking-widest">
                        <th class="p-3.5">Số hiệu CT</th>
                        <th class="p-3.5">Ngày tháng</th>
                        <th class="p-3.5">Người nộp / Học viên</th>
                        <th class="p-3.5">MST / CCCD &amp; SĐT</th>
                        <th class="p-3.5">Diễn giải nội dung (S1-HKD)</th>
                        <th class="p-3.5">Hình thức</th>
                        <th class="p-3.5 text-right">Doanh thu</th>
                        <th class="p-3.5 text-right">Thuế (${summary.vatRate + summary.pitRate}%)</th>
                    </tr>
                </thead>
                <tbody class="divide-y divide-slate-100">
                    ${filteredEntries.map(item => {
                        const itemTax = Math.round(item.amount * ((summary.vatRate + summary.pitRate) / 100));
                        const dateStr = new Date(item.approvedAt).toLocaleDateString('vi-VN');
                        return `<tr class="hover:bg-indigo-50/30">
                            <td class="p-3.5 font-mono text-xs font-black text-indigo-800 whitespace-nowrap">${lmsEscapeHtml(item.receiptNo)}</td>
                            <td class="p-3.5 text-xs font-bold text-slate-600 whitespace-nowrap">${lmsEscapeHtml(dateStr)}</td>
                            <td class="p-3.5">
                                <div class="font-bold text-slate-800">${lmsEscapeHtml(item.payerName)}</div>
                                ${item.taxAddress ? `<div class="text-[11px] text-slate-500 truncate max-w-[220px]" title="${lmsEscapeHtml(item.taxAddress)}">${lmsEscapeHtml(item.taxAddress)}</div>` : ''}
                            </td>
                            <td class="p-3.5 text-xs font-mono text-slate-600">
                                <div>${item.taxId ? `CCCD/MST: <b>${lmsEscapeHtml(item.taxId)}</b>` : '<span class="text-slate-400 font-sans italic">Chưa cung cấp</span>'}</div>
                                ${item.payerPhone ? `<div class="text-[11px] text-slate-500">SĐT: ${lmsEscapeHtml(item.payerPhone)}</div>` : ''}
                                ${item.invoiceRequested ? `<span class="inline-block mt-0.5 px-1.5 py-0.5 rounded bg-amber-100 text-amber-800 font-sans font-black text-[9px] uppercase">Yêu cầu xuất HĐ</span>` : ''}
                            </td>
                            <td class="p-3.5 text-xs text-slate-700 max-w-[320px]">
                                <div class="font-semibold text-slate-800">${lmsEscapeHtml(item.description)}</div>
                                <div class="text-[10px] text-slate-400 mt-0.5">${lmsEscapeHtml(item.plan)} ${item.lessons ? `· ${item.lessons} buổi` : ''}</div>
                            </td>
                            <td class="p-3.5 text-xs font-semibold text-slate-600 whitespace-nowrap">${lmsEscapeHtml(item.paymentMethod)}</td>
                            <td class="p-3.5 text-right font-black text-emerald-700 whitespace-nowrap">${formatVND(item.amount)}</td>
                            <td class="p-3.5 text-right font-bold text-rose-600 whitespace-nowrap">${formatVND(itemTax)}</td>
                        </tr>`;
                    }).join('')}
                </tbody>
                <tfoot>
                    <tr class="bg-indigo-50/60 border-t-2 border-indigo-100 font-black text-slate-900">
                        <td colspan="6" class="p-3.5 text-right uppercase text-xs tracking-wider text-indigo-950">Tổng cộng kỳ ${lmsEscapeHtml(periodLabel)} (${summary.transactionCount} chứng từ):</td>
                        <td class="p-3.5 text-right text-emerald-800">${formatVND(summary.periodRevenue)}</td>
                        <td class="p-3.5 text-right text-rose-700">${formatVND(summary.totalTax)}</td>
                    </tr>
                </tfoot>
            </table>
        `;
    };

    window.exportHkdTaxLedgerCSV = function() {
        const periodTypeEl = document.getElementById('hkd-tax-period-type');
        const yearEl = document.getElementById('hkd-tax-year');
        const subperiodEl = document.getElementById('hkd-tax-subperiod');
        const allEntries = window.collectHkdTaxEntries(USERS, BILLING_SETTINGS);
        const now = new Date();
        const selectedYear = Number(yearEl?.value) || now.getFullYear();
        const periodType = periodTypeEl ? periodTypeEl.value : 'quarter';
        const subVal = subperiodEl ? subperiodEl.value : 'Q1';

        const filtered = allEntries.filter(e => {
            if (e.year !== selectedYear) return false;
            if (periodType === 'year') return true;
            if (periodType === 'quarter') return `Q${e.quarter}` === subVal;
            if (periodType === 'month') return `M${e.month}` === subVal;
            return true;
        }).sort((a, b) => a.approvedAt - b.approvedAt);

        const vatRate = BILLING_SETTINGS.hkdVatRate !== undefined && BILLING_SETTINGS.hkdVatRate !== null ? Number(BILLING_SETTINGS.hkdVatRate) : 0;
        const pitRate = BILLING_SETTINGS.hkdPitRate !== undefined && BILLING_SETTINGS.hkdPitRate !== null ? Number(BILLING_SETTINGS.hkdPitRate) : 2;
        const summary = window.calculateHkdTaxSummary(filtered, { vatRate, pitRate });

        const csvEscape = val => {
            const s = String(val ?? '').replace(/\r?\n/g, ' ');
            return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
        };

        const hkdName = BILLING_SETTINGS.hkdName || 'HKD IELTS W KHANH';
        const hkdTaxId = BILLING_SETTINGS.hkdTaxId || '';
        const hkdAddress = BILLING_SETTINGS.hkdAddress || '';
        const hkdSector = BILLING_SETTINGS.hkdBusinessSector || 'Dịch vụ giáo dục, đào tạo tiếng Anh';
        const periodCode = periodType === 'year' ? `${selectedYear}` : `${selectedYear}_${subVal}`;

        const rows = [
            ['SỔ CHI TIẾT DOANH THU BÁN HÀNG HÓA, DỊCH VỤ (Mẫu số S1-HKD - Thông tư 88/2021/TT-BTC)'],
            ['Hộ, cá nhân kinh doanh:', hkdName, 'Mã số thuế / CCCD:', hkdTaxId],
            ['Địa chỉ:', hkdAddress, 'Ngành nghề:', hkdSector],
            ['Kỳ kê khai thuế:', periodCode, `Tỷ lệ thuế GTGT: ${vatRate}%`, `Tỷ lệ thuế TNCN: ${pitRate}%`],
            [],
            ['STT', 'Số hiệu chứng từ', 'Ngày tháng chứng từ', 'Họ tên người nộp / Học viên', 'Số điện thoại', 'Số CCCD / MST người mua', 'Địa chỉ người mua', 'Diễn giải nội dung thu học phí', 'Hình thức thanh toán', 'Yêu cầu xuất HĐ', 'Doanh thu tính thuế (VND)', `Thuế GTGT (${vatRate}%)`, `Thuế TNCN (${pitRate}%)`, 'Tổng thuế phải nộp (VND)']
        ];

        filtered.forEach((item, index) => {
            const dateStr = new Date(item.approvedAt).toLocaleDateString('vi-VN');
            const vatAmt = Math.round(item.amount * (vatRate / 100));
            const pitAmt = Math.round(item.amount * (pitRate / 100));
            rows.push([
                index + 1,
                item.receiptNo,
                dateStr,
                item.payerName,
                item.payerPhone,
                item.taxId,
                item.taxAddress,
                item.description,
                item.paymentMethod,
                item.invoiceRequested ? 'Có' : 'Không',
                item.amount,
                vatAmt,
                pitAmt,
                vatAmt + pitAmt
            ]);
        });

        rows.push([
            '', '', '', '', '', '', '', 'TỔNG CỘNG KỲ KÊ KHAI', '', '',
            summary.periodRevenue,
            summary.vatAmount,
            summary.pitAmount,
            summary.totalTax
        ]);

        const csvContent = '\uFEFF' + rows.map(row => row.map(csvEscape).join(',')).join('\r\n');
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `So_Doanh_Thu_S1_HKD_${periodCode}.csv`;
        document.body.appendChild(link);
        link.click();
        link.remove();
        URL.revokeObjectURL(url);
        if (typeof window.showToast === 'function') {
            window.showToast('Đã xuất Sổ S1-HKD', `Đã tải file CSV khai thuế kỳ ${periodCode}.`);
        }
    };

    window.promptAddManualTaxEntry = function() {
        if (!currentUser || currentUser.role !== 'teacher') return;
        const todayInput = formatBillingDateInput(Date.now());
        document.getElementById('modal-title').textContent = 'Ghi Phiếu Thu Học Phí Vào Sổ S1-HKD';
        document.getElementById('modal-message').innerHTML = `
            <div class="space-y-3 mt-2 text-left">
                <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                        <label class="block text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1">Họ tên người nộp / Học viên *</label>
                        <input type="text" id="manual-tax-payer" placeholder="Nguyễn Văn A" class="w-full border-2 border-slate-200 p-2.5 rounded-lg font-bold text-slate-800 outline-none focus:border-indigo-500 text-sm">
                    </div>
                    <div>
                        <label class="block text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1">Số tiền thu (VND) *</label>
                        <input type="number" id="manual-tax-amount" min="1000" step="1000" placeholder="1200000" class="w-full border-2 border-slate-200 p-2.5 rounded-lg font-black text-emerald-700 outline-none focus:border-indigo-500 text-sm">
                    </div>
                </div>
                <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                        <label class="block text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1">Ngày thu tiền *</label>
                        <input type="date" id="manual-tax-date" value="${todayInput}" class="w-full border-2 border-slate-200 p-2.5 rounded-lg font-bold text-slate-800 outline-none focus:border-indigo-500 text-sm">
                    </div>
                    <div>
                        <label class="block text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1">Số điện thoại</label>
                        <input type="text" id="manual-tax-phone" placeholder="0912345678" class="w-full border-2 border-slate-200 p-2.5 rounded-lg font-mono text-slate-800 outline-none focus:border-indigo-500 text-sm">
                    </div>
                </div>
                <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                        <label class="block text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1">Số CCCD / MST cá nhân</label>
                        <input type="text" id="manual-tax-id" placeholder="Tùy chọn" class="w-full border-2 border-slate-200 p-2.5 rounded-lg font-mono text-slate-800 outline-none focus:border-indigo-500 text-sm">
                    </div>
                    <div>
                        <label class="block text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1">Hình thức thanh toán</label>
                        <select id="manual-tax-method" class="w-full border-2 border-slate-200 p-2.5 rounded-lg font-bold text-slate-800 outline-none focus:border-indigo-500 text-sm bg-white">
                            <option value="Chuyển khoản NH">Chuyển khoản NH</option>
                            <option value="Tiền mặt">Tiền mặt</option>
                        </select>
                    </div>
                </div>
                <div>
                    <label class="block text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1">Địa chỉ người nộp</label>
                    <input type="text" id="manual-tax-address" placeholder="Quận/Huyện, Tỉnh/TP (Tùy chọn)" class="w-full border-2 border-slate-200 p-2.5 rounded-lg font-medium text-slate-800 outline-none focus:border-indigo-500 text-sm">
                </div>
                <div>
                    <label class="block text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1">Diễn giải chứng từ (S1-HKD) *</label>
                    <input type="text" id="manual-tax-desc" placeholder="Thu học phí khóa IELTS Intensive (1 tháng)" class="w-full border-2 border-slate-200 p-2.5 rounded-lg font-medium text-slate-800 outline-none focus:border-indigo-500 text-sm">
                </div>
                <label class="flex items-center gap-2 pt-1 cursor-pointer">
                    <input type="checkbox" id="manual-tax-invoice" class="w-4 h-4 accent-indigo-600 rounded">
                    <span class="text-xs font-bold text-slate-700">Khách yêu cầu xuất hóa đơn / biên lai học phí</span>
                </label>
            </div>
        `;
        document.getElementById('modal-input').classList.add('hidden');
        document.getElementById('modal-cancel').classList.remove('hidden');
        document.getElementById('custom-modal').classList.remove('hidden');

        document.getElementById('modal-cancel').onclick = () => document.getElementById('custom-modal').classList.add('hidden');
        document.getElementById('modal-confirm').onclick = async () => {
            const payerName = document.getElementById('manual-tax-payer')?.value.trim();
            const amount = Number(document.getElementById('manual-tax-amount')?.value) || 0;
            const dateVal = document.getElementById('manual-tax-date')?.value;
            const payerPhone = document.getElementById('manual-tax-phone')?.value.trim() || '';
            const taxId = document.getElementById('manual-tax-id')?.value.trim() || '';
            const paymentMethod = document.getElementById('manual-tax-method')?.value || 'Chuyển khoản NH';
            const taxAddress = document.getElementById('manual-tax-address')?.value.trim() || '';
            const desc = document.getElementById('manual-tax-desc')?.value.trim() || `Thu học phí - ${payerName}`;
            const invoiceRequested = Boolean(document.getElementById('manual-tax-invoice')?.checked);

            if (!payerName || amount <= 0) {
                alert('Vui lòng nhập họ tên người nộp và số tiền hợp lệ.');
                return;
            }
            const parsedDate = parseBillingDeadlineDate(dateVal) || Date.now();
            const entry = {
                id: `manual_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
                approvedAt: parsedDate,
                payerName,
                payerPhone,
                taxId,
                taxAddress,
                paymentMethod,
                description: desc,
                invoiceRequested,
                amount
            };
            const btn = document.getElementById('modal-confirm');
            btn.disabled = true;
            btn.textContent = 'Đang lưu...';
            try {
                if (!Array.isArray(BILLING_SETTINGS.manualTaxEntries)) BILLING_SETTINGS.manualTaxEntries = [];
                BILLING_SETTINGS.manualTaxEntries.push(entry);
                await window.fsSetDoc(window.fsDoc(window.db, window.fPath('settings'), 'billing'), BILLING_SETTINGS);
                document.getElementById('custom-modal').classList.add('hidden');
                window.renderHkdTaxLedger();
                window.updateRevenueChart('month');
                if (typeof window.showToast === 'function') window.showToast('Đã ghi sổ S1-HKD', `Đã thêm phiếu thu của ${payerName}.`);
            } catch (e) {
                console.error('Could not save manual tax entry:', e);
                showModalMsg('Lỗi', 'Không thể lưu phiếu thu lên hệ thống.');
            } finally {
                btn.disabled = false;
                btn.textContent = 'OK';
            }
        };
    };

    // ✨ NEW: Global Revenue Chart Generator (Uses real S1-HKD ledger entries when available)
    window.revenueChartInstance = null;
    window.updateRevenueChart = function(period) {
        ['month', 'quarter', 'year'].forEach(p => {
            const btn = document.getElementById(`btn-chart-${p}`);
            if(btn) {
                if(p === period) btn.className = "px-4 py-1.5 text-xs font-bold rounded-md bg-white shadow-sm text-blue-700 transition border border-slate-200";
                else btn.className = "px-4 py-1.5 text-xs font-bold rounded-md text-slate-500 hover:text-slate-700 transition border border-transparent";
            }
        });

        const ctx = document.getElementById('revenueChart');
        if(!ctx) return;

        if (window.revenueChartInstance) {
            window.revenueChartInstance.destroy();
        }

        const ledgerEntries = typeof window.collectHkdTaxEntries === 'function' ? window.collectHkdTaxEntries(USERS, BILLING_SETTINGS) : [];
        const now = new Date();
        const currentYear = now.getFullYear();
        const currentMonth = now.getMonth() + 1;
        const currentQuarter = Math.floor((currentMonth - 1) / 3) + 1;

        let labels = [];
        let data = [];

        if (ledgerEntries.length > 0) {
            if (period === 'month') {
                labels = ['Tuần 1', 'Tuần 2', 'Tuần 3', 'Tuần 4'];
                data = [0, 0, 0, 0];
                ledgerEntries.filter(e => e.year === currentYear && e.month === currentMonth).forEach(e => {
                    const day = new Date(e.approvedAt).getDate();
                    const weekIdx = Math.min(3, Math.floor((day - 1) / 7));
                    data[weekIdx] += e.amount;
                });
            } else if (period === 'quarter') {
                const startMonth = (currentQuarter - 1) * 3 + 1;
                labels = [`Tháng ${startMonth}`, `Tháng ${startMonth + 1}`, `Tháng ${startMonth + 2}`];
                data = [0, 0, 0];
                ledgerEntries.filter(e => e.year === currentYear && e.quarter === currentQuarter).forEach(e => {
                    const idx = e.month - startMonth;
                    if (idx >= 0 && idx < 3) data[idx] += e.amount;
                });
            } else if (period === 'year') {
                labels = ['T1', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'T8', 'T9', 'T10', 'T11', 'T12'];
                data = Array(12).fill(0);
                ledgerEntries.filter(e => e.year === currentYear).forEach(e => {
                    if (e.month >= 1 && e.month <= 12) data[e.month - 1] += e.amount;
                });
            }
        } else {
            // Fallback baseline when no payment history exists yet
            const activeCount = USERS.filter(u => u.role === 'student' && hasActiveStudentAccess(u)).length;
            const defaultFee = BILLING_SETTINGS.feePerLesson || 100000;
            const defaultLpm = BILLING_SETTINGS.lessonsPerMonth || 12;
            const avgMonthlyValue = activeCount > 0 ? (activeCount * defaultFee * defaultLpm) : 0;

            if (period === 'month') {
                labels = ['Week 1', 'Week 2', 'Week 3', 'Week 4'];
                data = [avgMonthlyValue*0.2, avgMonthlyValue*0.4, avgMonthlyValue*0.1, avgMonthlyValue*0.3].map(Math.round);
            } else if (period === 'quarter') {
                labels = ['Month 1', 'Month 2', 'Month 3'];
                data = [avgMonthlyValue*0.8, avgMonthlyValue*1.2, avgMonthlyValue*0.9].map(Math.round);
            } else if (period === 'year') {
                labels = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
                data = labels.map((_, i) => Math.round(avgMonthlyValue * 0.5 + (Math.sin(i)*avgMonthlyValue*0.2) + (i*avgMonthlyValue*0.1)));
            }
        }

        window.revenueChartInstance = new Chart(ctx, {
            type: 'line',
            data: {
                labels: labels,
                datasets: [{
                    label: 'Estimated Revenue (VND)',
                    data: data,
                    borderColor: '#2563eb', // Tailwind blue-600
                    backgroundColor: 'rgba(37, 99, 235, 0.1)',
                    borderWidth: 3,
                    fill: true,
                    tension: 0.4, // Smooth curved lines
                    pointBackgroundColor: '#ffffff',
                    pointBorderColor: '#2563eb',
                    pointBorderWidth: 2,
                    pointRadius: 4,
                    pointHoverRadius: 6
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { display: false },
                    tooltip: {
                        callbacks: {
                            label: function(context) {
                                let label = context.dataset.label || '';
                                if (label) label += ': ';
                                if (context.parsed.y !== null) {
                                    label += new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(context.parsed.y);
                                }
                                return label;
                            }
                        }
                    }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        grid: { borderDash: [4, 4], color: '#f1f5f9' },
                        ticks: {
                            font: { family: "'Inter', sans-serif", size: 10 },
                            color: '#94a3b8',
                            callback: function(value) {
                                return new Intl.NumberFormat('vi-VN', { notation: "compact", compactDisplay: "short" }).format(value);
                            }
                        }
                    },
                    x: {
                        grid: { display: false },
                        ticks: { font: { family: "'Inter', sans-serif", size: 11 }, color: '#64748b' }
                    }
                }
            }
        });
    };

    window.currentRegistryView = 'students';

    window.switchRegistryView = function(view) {
        window.currentRegistryView = view;
        const btnStu = document.getElementById('reg-tab-students');
        const btnStaff = document.getElementById('reg-tab-staff');
        
        if (view === 'students') {
            if (btnStu) btnStu.className = "px-5 py-2 rounded-lg text-sm font-bold bg-white text-blue-700 shadow-sm transition";
            if (btnStaff) btnStaff.className = "px-5 py-2 rounded-lg text-sm font-bold bg-transparent text-slate-500 hover:text-slate-700 transition";
        } else {
            if (btnStaff) btnStaff.className = "px-5 py-2 rounded-lg text-sm font-bold bg-white text-purple-700 shadow-sm transition";
            if (btnStu) btnStu.className = "px-5 py-2 rounded-lg text-sm font-bold bg-transparent text-slate-500 hover:text-slate-700 transition";
        }
        renderStudentsList();
    };

    window.removeUserFromSystem = function(username) {
        const account = USERS.find(user => user.user === username);
        if (!account || account.role !== 'student') {
            showModalMsg("Cannot Remove Account", "Only student accounts can be removed here.");
            return;
        }
        if (account.user === currentUser?.user) {
            showModalMsg("Cannot Remove Account", "You cannot remove the account currently in use.");
            return;
        }

        showConfirm(
            "Remove Account from LMS",
            `Remove <b>${username}</b> from the LMS? This blocks future LMS sign-ins and removes their class memberships. Historical submissions and attendance are retained.`,
            async () => {
                try {
                    const profileIds = [...new Set([account.uid, account.user, account.email].filter(Boolean))];
                    let profileRef = null;
                    let profileSnap = null;
                    for (const id of profileIds) {
                        const candidateRef = window.fsDoc(window.db, window.fPath('users'), id);
                        const candidateSnap = await window.fsGetDoc(candidateRef);
                        if (candidateSnap.exists()) {
                            profileRef = candidateRef;
                            profileSnap = candidateSnap;
                            break;
                        }
                    }
                    if (!profileRef || !profileSnap) {
                        throw new Error(`Could not find the Firestore profile for ${username}.`);
                    }

                    const disabledProfile = {
                        ...profileSnap.data(),
                        disabled: true,
                        disabledAt: new Date().toISOString(),
                        disabledBy: currentUser.user
                    };
                    await window.fsSetDoc(profileRef, disabledProfile);
                    USERS = USERS.filter(user => user.user !== username);

                    const updatedClasses = CLASSES.filter(cls =>
                        (cls.enrolledStudents || []).includes(username) ||
                        Object.prototype.hasOwnProperty.call(cls.miniClasses || {}, username)
                    ).map(cls => {
                        const updated = { ...cls };
                        if (Array.isArray(updated.enrolledStudents)) {
                            updated.enrolledStudents = updated.enrolledStudents.filter(student => student !== username);
                        }
                        if (updated.miniClasses) {
                            updated.miniClasses = { ...updated.miniClasses };
                            delete updated.miniClasses[username];
                        }
                        return updated;
                    });
                    const classErrors = [];
                    for (const cls of updatedClasses) {
                        try {
                            await window.fsSetDoc(window.fsDoc(window.db, window.fPath('classes'), cls.id), cls);
                            const classIndex = CLASSES.findIndex(item => item.id === cls.id);
                            if (classIndex >= 0) CLASSES[classIndex] = cls;
                        } catch (error) {
                            console.error(`Could not remove ${username} from class ${cls.id}:`, error);
                            classErrors.push(cls.name || cls.id);
                        }
                    }

                    renderClasses();
                    renderStudentsList();
                    if (classErrors.length) {
                        showModalMsg("Account Disabled; Class Cleanup Incomplete", `${username} is disabled, but could not be removed from: ${classErrors.join(', ')}. Check Firestore permissions and retry.`);
                        return;
                    }
                    window.showToast?.("Account Removed", `${username} is disabled and removed from LMS classes.`);
                } catch (error) {
                    console.error(`Could not remove LMS account ${username}:`, error);
                    showModalMsg("Removal Failed", `Could not disable <b>${username}</b>. Check Firestore permissions and try again.<br><span class="text-xs text-rose-600">${error.message}</span>`);
                }
            }
        );
    };

    window.deleteStaff = function(username) {
        window.removeUserFromSystem(username);
    };

    const studentRegistryColumnDefaults = [27, 15, 12, 8, 17, 13, 8];
    const studentRegistryColumnMinimums = [18, 10, 9, 7, 12, 10, 7];
    const studentRegistryColumnStorageKey = 'lms_student_registry_column_widths';

    function getStudentRegistryColumnWidths() {
        try {
            const savedWidths = JSON.parse(localStorage.getItem(studentRegistryColumnStorageKey) || 'null');
            if (Array.isArray(savedWidths) && savedWidths.length === studentRegistryColumnDefaults.length &&
                savedWidths.every(width => Number.isFinite(width) && width > 0)) {
                const total = savedWidths.reduce((sum, width) => sum + width, 0);
                return savedWidths.map(width => width * 100 / total);
            }
        } catch (error) {
            console.error('Unable to restore student registry column widths:', error);
        }
        return [...studentRegistryColumnDefaults];
    }

    function enableStudentRegistryColumnResizing(table) {
        const columns = Array.from(table.querySelectorAll('col'));
        let widths = getStudentRegistryColumnWidths();
        const applyWidths = () => columns.forEach((column, index) => {
            column.style.width = `${widths[index]}%`;
        });
        applyWidths();

        table.querySelectorAll('[data-registry-col-resizer]').forEach(handle => {
            handle.addEventListener('pointerdown', event => {
                event.preventDefault();
                const leftIndex = Number(handle.dataset.registryColResizer);
                const rightIndex = leftIndex + 1;
                const startX = event.clientX;
                const tableWidth = table.getBoundingClientRect().width;
                const startLeftWidth = widths[leftIndex];
                const startRightWidth = widths[rightIndex];

                handle.setPointerCapture(event.pointerId);
                const resize = moveEvent => {
                    const delta = (moveEvent.clientX - startX) / tableWidth * 100;
                    const pairTotal = startLeftWidth + startRightWidth;
                    const minLeft = studentRegistryColumnMinimums[leftIndex];
                    const minRight = studentRegistryColumnMinimums[rightIndex];
                    const leftWidth = Math.min(pairTotal - minRight, Math.max(minLeft, startLeftWidth + delta));
                    widths[leftIndex] = leftWidth;
                    widths[rightIndex] = pairTotal - leftWidth;
                    applyWidths();
                };
                const finishResize = () => {
                    handle.removeEventListener('pointermove', resize);
                    handle.removeEventListener('pointerup', finishResize);
                    handle.removeEventListener('pointercancel', finishResize);
                    try {
                        localStorage.setItem(studentRegistryColumnStorageKey, JSON.stringify(widths));
                    } catch (error) {
                        console.error('Unable to save student registry column widths:', error);
                    }
                };

                handle.addEventListener('pointermove', resize);
                handle.addEventListener('pointerup', finishResize, { once: true });
                handle.addEventListener('pointercancel', finishResize, { once: true });
            });
        });
    }

    window.openStudentProfilePreview = function(username) {
        const student = USERS.find(user => user.role === 'student' && user.user === username);
        if (!student || currentUser?.role !== 'teacher') return;
        if (window.isStudentProfilePreview) window.exitStudentProfilePreview();

        const banner = document.getElementById('student-preview-banner');
        const label = document.getElementById('student-preview-name');
        if (!banner || !label) return;

        window.studentProfilePreviewState = {
            teacher: currentUser,
            route: window.location.hash || '#/teacher/bank/tests'
        };
        window.studentProfilePreviewUser = student.user;
        window.isStudentProfilePreview = true;
        currentUser = { ...student, role: 'student' };
        const isUidUser = window.LMSAuthHelpers?.isLikelyUid ? window.LMSAuthHelpers.isLikelyUid(student.user, student.uid) : /^[A-Za-z0-9_-]{20,}$/.test(String(student.user || ''));
        const friendlyPreviewName = student.realName || (window.getStudentDisplayName ? window.getStudentDisplayName(student) : student.user);
        label.textContent = isUidUser ? friendlyPreviewName : `${friendlyPreviewName} (@${student.user})`;
        banner.classList.remove('hidden');
        document.getElementById('editor-ui')?.classList.add('hidden');
        document.getElementById('start-screen')?.classList.remove('hidden');
        window.initStudentDashboard();
        window.navigateAppRoute('student/dashboard', true);
    };

    window.exitStudentProfilePreview = function() {
        const state = window.studentProfilePreviewState;
        if (!window.isStudentProfilePreview || !state) return;
        window.isStudentProfilePreview = false;
        window.studentProfilePreviewUser = null;
        window.studentProfilePreviewState = null;
        currentUser = state.teacher;
        document.getElementById('student-preview-banner')?.classList.add('hidden');
        window.navigateAppRoute(state.route.replace(/^#\/?/, ''), true);
    };

    function renderStudentsList() {
        const container = document.getElementById('registry-table-container');
        const countBadge = document.getElementById('student-count-badge');
        if (!container) return;

        if (window.currentRegistryView === 'students') {
            const students = USERS.filter(u => u.role === 'student');
            if (countBadge) countBadge.textContent = students.length;

            let html = `<table class="student-registry-table w-full text-left border-collapse whitespace-nowrap min-w-[1180px]" style="table-layout:fixed">
                <colgroup>${studentRegistryColumnDefaults.map(() => '<col>').join('')}</colgroup>
                <thead>
                    <tr class="bg-slate-50 border-b border-slate-200 text-[10px] font-black text-slate-400 uppercase tracking-widest">
                        <th class="p-4 relative">Student Account<button type="button" class="registry-col-resizer" data-registry-col-resizer="0" aria-label="Resize Student Account column"></button></th>
                        <th class="p-4 relative">Parent / Contact Name<button type="button" class="registry-col-resizer" data-registry-col-resizer="1" aria-label="Resize Parent / Contact Name column"></button></th>
                        <th class="p-4 relative">Phone / Zalo<button type="button" class="registry-col-resizer" data-registry-col-resizer="2" aria-label="Resize Phone / Zalo column"></button></th>
                        <th class="p-4 text-center relative">Lessons<button type="button" class="registry-col-resizer" data-registry-col-resizer="3" aria-label="Resize Lessons column"></button></th>
                        <th class="p-4 relative">Joined Date<button type="button" class="registry-col-resizer" data-registry-col-resizer="4" aria-label="Resize Joined Date column"></button></th>
                        <th class="p-4 text-center relative">Status<button type="button" class="registry-col-resizer" data-registry-col-resizer="5" aria-label="Resize Status column"></button></th>
                        <th class="p-4 text-right">Actions</th>
                    </tr>
                </thead>
                <tbody class="divide-y divide-slate-100 text-sm">`;

            if (students.length === 0) {
                html += '<tr><td colspan="7" class="p-8 text-center text-slate-500 italic text-sm">No students found. Add a student to populate the registry.</td></tr>';
            } else {
                students.sort((a,b) => {
                    if (a.paymentStatus === 'pending' && b.paymentStatus !== 'pending') return -1;
                    if (b.paymentStatus === 'pending' && a.paymentStatus !== 'pending') return 1;
                    return 0;
                });

                html += students.map(s => {
                    const trackedAtt = ATTENDANCE.filter(a => a.student === s.user).length;
                    const remaining = s.totalLessonsPaid ? Math.max(0, s.totalLessonsPaid - trackedAtt) : 'N/A';
                    const isPending = s.paymentStatus === 'pending';
                    const billing = getStudentBillingStatus(s);
                    const accountLabel = (s.email && !s.email.toLowerCase().endsWith('@khanhlms.com'))
                        ? s.email
                        : (window.getStudentDisplayName ? window.getStudentDisplayName(s) : s.user);
                    
                    let statusBadge = '';
                    if (isPending) {
                        statusBadge = `<div class="inline-flex flex-col gap-1"><span class="bg-amber-100 text-amber-800 border border-amber-200 text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded shadow-sm whitespace-nowrap text-center">${billing.label}</span>`;
                        if(s.pendingInfo) statusBadge += `<span class="text-[9px] text-rose-500 font-bold truncate max-w-[120px]" title="${s.pendingInfo}">${s.pendingInfo}</span></div>`;
                    } else if (billing.hasAccess) {
                        statusBadge = `<span class="bg-emerald-50 text-emerald-700 border border-emerald-200 text-[10px] font-black uppercase tracking-widest px-2.5 py-1 rounded shadow-sm whitespace-nowrap">${billing.label}</span>`;
                    } else {
                        statusBadge = `<span class="bg-rose-50 text-rose-700 border border-rose-200 text-[10px] font-black uppercase tracking-widest px-2.5 py-1 rounded shadow-sm whitespace-nowrap">${billing.label}</span>`;
                    }

                    return `
                    <tr class="hover:bg-blue-50/40 transition-colors ${isPending ? 'bg-rose-50/20' : ''}">
                        <td class="p-4">
                            <div class="flex items-center gap-3">
                                <img src="${s.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(accountLabel)}&background=random`}" class="w-8 h-8 rounded-full border border-slate-200 shadow-sm shrink-0 object-cover">
                                <div class="flex flex-col">
                                    <span class="font-bold text-slate-800 text-sm leading-tight">${accountLabel}</span>
                                    <span class="text-[10px] text-slate-400 font-bold mt-0.5">${s.realName || '<span class="italic font-medium">No real name set</span>'}</span>
                                </div>
                            </div>
                        </td>
                        <td class="p-4 text-sm font-medium text-slate-700">${s.parentName || '<span class="text-slate-300 italic text-xs">Unset</span>'}</td>
                        <td class="p-4 text-sm font-mono text-slate-600">${s.phone || '<span class="text-slate-300 italic text-xs font-sans">Unset</span>'}</td>
                        <td class="p-4 text-center">
                            <span class="font-black text-lg ${remaining > 0 && remaining <= 3 ? 'text-amber-500' : remaining === 0 ? 'text-rose-500' : 'text-indigo-600'}">${remaining}</span>
                            ${s.totalLessonsPaid ? `<span class="text-[10px] text-slate-400 font-bold ml-0.5">/ ${s.totalLessonsPaid}</span>` : ''}
                        </td>
                        <td class="p-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest">${s.createdAt || 'N/A'}</td>
                        <td class="p-4 text-center">${statusBadge}</td>
                        <td class="p-2 text-right student-actions-cell">
                            <details class="student-actions-dropdown">
                                <summary class="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-2 text-xs font-bold text-slate-700 shadow-sm hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400">
                                    Actions <span aria-hidden="true">⋯</span>
                                </summary>
                                <div class="student-actions-menu">
                                    <button type="button" data-student-profile-preview="${lmsEscapeHtml(s.user)}">👁️ Switch to student dashboard</button>
                                    <button type="button" onclick="togglePaymentStatus('${s.user}', ${isPending || !billing.hasAccess}); this.closest('details').open = false">${isPending ? '✓ Approve payment' : billing.hasAccess ? '🔒 Lock access' : '🔓 Unlock access'}</button>
                                    <button type="button" onclick="window.promptEditStudentContact('${s.user}'); this.closest('details').open = false">✏️ Edit contact info</button>
                                    <button type="button" onclick="window.openRadarEditor('${s.user}'); this.closest('details').open = false">📊 Edit radar chart</button>
                                    <button type="button" onclick="window.promptResetStudentPassword('${s.user}'); this.closest('details').open = false">🔑 Reset password</button>
                                    <button type="button" class="danger" onclick="window.removeUserFromSystem('${s.user}'); this.closest('details').open = false">🗑️ Remove student</button>
                                </div>
                            </details>
                        </td>
                    </tr>
                    `;
                }).join('');
            }
            html += `</tbody></table>`;
            container.innerHTML = html;
            enableStudentRegistryColumnResizing(container.querySelector('.student-registry-table'));
            container.querySelectorAll('[data-student-profile-preview]').forEach(button => {
                button.addEventListener('click', () => {
                    window.openStudentProfilePreview(button.dataset.studentProfilePreview);
                    button.closest('details').open = false;
                });
            });

        } else {
            const staff = USERS.filter(u => u.role === 'teacher');
            if (countBadge) countBadge.textContent = staff.length;

            let html = `<table class="w-full text-left border-collapse whitespace-nowrap min-w-[700px]">
                <thead>
                    <tr class="bg-slate-50 border-b border-slate-200 text-[10px] font-black text-slate-400 uppercase tracking-widest">
                        <th class="p-4">Teacher Account</th>
                        <th class="p-4">Role</th>
                        <th class="p-4 text-right">Actions</th>
                    </tr>
                </thead>
                <tbody class="divide-y divide-slate-100 text-sm">`;

            if (staff.length === 0) {
                html += '<tr><td colspan="3" class="p-8 text-center text-slate-500 italic text-sm">No teachers found.</td></tr>';
            } else {
                html += staff.map(s => {
                    const isMe = s.user === currentUser.user;
                    const actions = `<button onclick="window.promptResetStudentPassword('${s.user}')" class="bg-white border border-slate-200 hover:border-amber-400 hover:text-amber-600 text-slate-500 px-3 py-1.5 rounded-lg transition shadow-sm text-xs font-bold" title="Reset Password">🔑 Reset Pass</button>`;
                    const staffLabel = window.getStudentDisplayName ? window.getStudentDisplayName(s) : s.user;
                    return `
                    <tr class="hover:bg-slate-50 transition-colors">
                        <td class="p-4">
                            <div class="flex items-center gap-3">
                                <img src="${s.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(staffLabel)}&background=random`}" class="w-8 h-8 rounded-full border border-slate-200 shadow-sm shrink-0 object-cover">
                                <div class="flex flex-col">
                                    <span class="font-bold text-slate-800 text-sm">${staffLabel} ${isMe ? '<span class="text-[9px] font-black text-blue-600 bg-blue-50 border border-blue-200 px-2 py-0.5 rounded ml-1 uppercase tracking-widest">You</span>' : ''}</span>
                                    <span class="text-[10px] font-medium text-slate-400">Added: ${s.createdAt || 'N/A'}</span>
                                </div>
                            </div>
                        </td>
                        <td class="p-4">
                            <span class="text-[10px] font-black uppercase tracking-widest px-2.5 py-1 rounded shadow-sm bg-indigo-100 text-indigo-700 border border-indigo-200">${s.role}</span>
                        </td>
                        <td class="p-4 text-right">${actions}</td>
                    </tr>
                    `;
                }).join('');
            }
            html += `</tbody></table>`;
            container.innerHTML = html;
        }
    }

    // ✨ NEW: Edit Student Contact Information Modal
    window.promptEditStudentContact = function(username) {
        const u = USERS.find(x => x.user === username);
        if(!u) return;

        document.getElementById('modal-title').textContent = `Edit Profile: ${username}`;
        document.getElementById('modal-message').innerHTML = `
            <div class="space-y-3 mt-2">
                <div>
                    <label class="block text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1.5">Student Real Name</label>
                    <input type="text" id="edit-real-name" value="${(u.realName || '').replace(/"/g, '&quot;')}" class="w-full border-2 border-slate-200 p-2.5 rounded-lg outline-none focus:border-blue-500 font-bold text-slate-800 transition">
                </div>
                <div>
                    <label class="block text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1.5">Parent / Guardian Name</label>
                    <input type="text" id="edit-parent-name" value="${(u.parentName || '').replace(/"/g, '&quot;')}" class="w-full border-2 border-slate-200 p-2.5 rounded-lg outline-none focus:border-blue-500 font-bold text-slate-800 transition">
                </div>
                <div>
                    <label class="block text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1.5">Phone / Zalo Number</label>
                    <input type="text" id="edit-phone" value="${(u.phone || '').replace(/"/g, '&quot;')}" class="w-full border-2 border-slate-200 p-2.5 rounded-lg outline-none focus:border-blue-500 font-mono text-blue-700 font-bold transition">
                </div>
                <div>
                    <label class="block text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1.5">Số CCCD / MST cá nhân (Khai thuế HKD)</label>
                    <input type="text" id="edit-tax-id" value="${(u.taxId || '').replace(/"/g, '&quot;')}" placeholder="12 số CCCD hoặc Mã số thuế" class="w-full border-2 border-slate-200 p-2.5 rounded-lg outline-none focus:border-blue-500 font-mono text-slate-800 font-bold transition">
                </div>
                <div>
                    <label class="block text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1.5">Địa chỉ (Ghi sổ doanh thu / Hóa đơn)</label>
                    <input type="text" id="edit-tax-address" value="${(u.taxAddress || '').replace(/"/g, '&quot;')}" placeholder="Quận/Huyện, Tỉnh/Thành phố" class="w-full border-2 border-slate-200 p-2.5 rounded-lg outline-none focus:border-blue-500 font-medium text-slate-700 transition">
                </div>
                <div>
                    <label class="block text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1.5">School / Internal Notes</label>
                    <input type="text" id="edit-school" value="${(u.school || '').replace(/"/g, '&quot;')}" class="w-full border-2 border-slate-200 p-2.5 rounded-lg outline-none focus:border-blue-500 font-medium text-slate-700 transition">
                </div>
            </div>
        `;
        document.getElementById('modal-input').classList.add('hidden');
        document.getElementById('modal-cancel').classList.remove('hidden');
        document.getElementById('custom-modal').classList.remove('hidden');

        document.getElementById('modal-cancel').onclick = () => document.getElementById('custom-modal').classList.add('hidden');
        document.getElementById('modal-confirm').onclick = async () => {
            const btn = document.getElementById('modal-confirm');
            btn.textContent = "Saving..."; btn.disabled = true;
            
            u.realName = document.getElementById('edit-real-name').value.trim();
            u.parentName = document.getElementById('edit-parent-name').value.trim();
            u.phone = document.getElementById('edit-phone').value.trim();
            u.taxId = document.getElementById('edit-tax-id')?.value.trim() || '';
            u.taxAddress = document.getElementById('edit-tax-address')?.value.trim() || '';
            if (u.realName) u.taxPayerName = u.realName;
            u.school = document.getElementById('edit-school').value.trim();
            
            try {
                await window.fsSetDoc(window.fsDoc(window.db, window.fPath('users'), username), u);
                document.getElementById('custom-modal').classList.add('hidden');
                renderStudentsList();
                if (typeof window.renderHkdTaxLedger === 'function') window.renderHkdTaxLedger();
                if (typeof window.showToast === 'function') window.showToast("Saved", "Contact & tax information updated successfully.");
            } catch(e) {
                showModalMsg("Error", "Failed to save contact info to the cloud.");
            }
            btn.textContent = "OK"; btn.disabled = false;
        };
    };

    function renderPackagePublicDetailsFields(pkg = {}) {
        const fields = [
            ['targetAudience', 'Học viên phù hợp', 'Ví dụ: band đầu vào hoặc mục tiêu học viên đã xác nhận'],
            ['goal', 'Mục tiêu khóa học', 'Mục tiêu cụ thể đã được xác nhận'],
            ['curriculum', 'Nội dung / kỹ năng học', 'Các nội dung và kỹ năng thực tế của khóa học'],
            ['duration', 'Thời lượng khóa học', 'Ví dụ: số tuần hoặc số tháng'],
            ['lessonCount', 'Số buổi học', 'Tổng số buổi của khóa'],
            ['format', 'Hình thức học', 'Ví dụ: trực tuyến, trực tiếp hoặc kết hợp'],
            ['schedule', 'Lịch học dự kiến', 'Ngày, giờ hoặc cách xếp lịch đã thống nhất'],
            ['classSize', 'Sĩ số lớp', 'Số lượng học viên nếu đã xác định']
        ];
        return `
            <div class="mt-4 max-h-[50vh] space-y-3 overflow-y-auto pr-1">
                <p class="text-xs leading-relaxed text-slate-500">Thông tin bên dưới sẽ hiển thị công khai. Chỉ điền nội dung đã được xác nhận; trường để trống sẽ không xuất hiện trên trang chủ.</p>
                ${fields.map(([key, label, placeholder]) => {
                    const value = lmsEscapeHtml(pkg[key] || '');
                    const isLongText = key === 'curriculum';
                    return `
                        <label class="block text-xs font-bold text-slate-600">
                            ${label}
                            ${isLongText
                                ? `<textarea id="pkg-detail-${key}" rows="3" placeholder="${placeholder}" class="mt-1 w-full resize-y rounded border border-slate-200 p-2 text-sm font-normal text-slate-800 focus:border-purple-500 focus:outline-none">${value}</textarea>`
                                : `<input type="text" id="pkg-detail-${key}" value="${value}" placeholder="${placeholder}" class="mt-1 w-full rounded border border-slate-200 p-2 text-sm font-normal text-slate-800 focus:border-purple-500 focus:outline-none">`}
                        </label>
                    `;
                }).join('')}
            </div>
        `;
    }

    function readPackagePublicDetailsFromForm() {
        return ['targetAudience', 'goal', 'curriculum', 'duration', 'lessonCount', 'format', 'schedule', 'classSize']
            .reduce((details, key) => {
                details[key] = document.getElementById(`pkg-detail-${key}`).value.trim();
                return details;
            }, {});
    }

    // Modal to create packages
    window.promptCreatePackage = function() {
        if(CLASSES.length === 0) { showModalMsg("Error", "Create some classes first before grouping them into a package."); return; }
        
        const classChecks = CLASSES.filter(c => !window.isTemplateClass(c)).map(c => `
            <label class="flex items-center space-x-3 cursor-pointer p-2 hover:bg-slate-100 rounded border border-slate-200 mb-2 bg-white shadow-sm transition">
                <input type="checkbox" class="pkg-class-cb w-4 h-4 text-purple-600 rounded" value="${c.id}">
                <span class="font-bold text-sm text-slate-700">${c.name}</span>
            </label>
        `).join('');

        document.getElementById('modal-title').textContent = "Create New Bundle";
        document.getElementById('modal-message').innerHTML = `
            <div class="mb-3">
                <label class="block text-xs font-bold text-slate-500 mb-1">Package Name</label>
                <input type="text" id="pkg-name" placeholder="e.g. Master IELTS VIP Bundle" class="w-full border-2 border-slate-200 p-2 rounded focus:border-purple-500 outline-none font-bold text-slate-800">
            </div>
            <div class="mb-4">
                <label class="block text-xs font-bold text-slate-500 mb-1">Base Fee per Lesson (VND)</label>
                <input type="number" id="pkg-fee" placeholder="e.g. 150000" class="w-full border-2 border-slate-200 p-2 rounded focus:border-purple-500 outline-none font-bold text-emerald-600">
            </div>
            <div class="mb-2">
                <label class="block text-xs font-bold text-slate-500 mb-2">Select Courses to Include:</label>
                <div class="max-h-40 overflow-y-auto bg-slate-50 p-2 rounded border border-slate-200 shadow-inner">${classChecks}</div>
            </div>
            ${renderPackagePublicDetailsFields()}
        `;
        document.getElementById('modal-input').classList.add('hidden');
        document.getElementById('modal-cancel').classList.remove('hidden');
        document.getElementById('custom-modal').classList.remove('hidden');

        document.getElementById('modal-cancel').onclick = () => document.getElementById('custom-modal').classList.add('hidden');
        document.getElementById('modal-confirm').onclick = async () => {
            const name = document.getElementById('pkg-name').value.trim();
            const fee = Number(document.getElementById('pkg-fee').value);
            const selectedClasses = Array.from(document.querySelectorAll('.pkg-class-cb:checked')).map(cb => cb.value);

            if(name && fee > 0 && selectedClasses.length > 0) {
                const newPkg = {
                    id: 'pkg_' + Date.now(),
                    name,
                    feePerLesson: fee,
                    classes: selectedClasses,
                    ...readPackagePublicDetailsFromForm()
                };
                PACKAGES.push(newPkg);
                await window.fsSetDoc(window.fsDoc(window.db, window.fPath('packages'), newPkg.id), newPkg);
                document.getElementById('custom-modal').classList.add('hidden');
                if (typeof window.renderPaymentsView === 'function') window.renderPaymentsView();
            } else {
                alert("Please enter a name, a valid fee per lesson, and select at least one class.");
            }
        };
    }

    window.editPackage = function(pid) {
        const pkg = PACKAGES.find(p => p.id === pid);
        if(!pkg) return;

        const classChecks = CLASSES.filter(c => !window.isTemplateClass(c)).map(c => `
            <label class="flex items-center space-x-3 cursor-pointer p-2 hover:bg-slate-100 rounded border border-slate-200 mb-2 bg-white shadow-sm transition">
                <input type="checkbox" class="pkg-class-cb w-4 h-4 text-purple-600 rounded" value="${c.id}" ${(pkg.classes || []).includes(c.id) ? 'checked' : ''}>
                <span class="font-bold text-sm text-slate-700">${c.name}</span>
            </label>
        `).join('');

        document.getElementById('modal-title').textContent = "Edit Bundle";
        document.getElementById('modal-message').innerHTML = `
            <div class="mb-3">
                <label class="block text-xs font-bold text-slate-500 mb-1">Package Name</label>
                <input type="text" id="pkg-name" value="${pkg.name}" class="w-full border-2 border-slate-200 p-2 rounded focus:border-purple-500 outline-none font-bold text-slate-800">
            </div>
            <div class="mb-2">
                <label class="block text-xs font-bold text-slate-500 mb-2">Select Courses to Include:</label>
                <div class="max-h-40 overflow-y-auto bg-slate-50 p-2 rounded border border-slate-200 shadow-inner">${classChecks}</div>
            </div>
            ${renderPackagePublicDetailsFields(pkg)}
            <p class="text-[10px] text-slate-400 mt-2 italic">Note: You can change the Fee/Lesson directly on the package card.</p>
        `;
        document.getElementById('modal-input').classList.add('hidden');
        document.getElementById('modal-cancel').classList.remove('hidden');
        document.getElementById('custom-modal').classList.remove('hidden');

        document.getElementById('modal-cancel').onclick = () => document.getElementById('custom-modal').classList.add('hidden');
        document.getElementById('modal-confirm').onclick = async () => {
            const name = document.getElementById('pkg-name').value.trim();
            const selectedClasses = Array.from(document.querySelectorAll('.pkg-class-cb:checked')).map(cb => cb.value);

            if(name && selectedClasses.length > 0) {
                pkg.name = name;
                pkg.classes = selectedClasses;
                Object.assign(pkg, readPackagePublicDetailsFromForm());
                await window.fsSetDoc(window.fsDoc(window.db, window.fPath('packages'), pkg.id), pkg);
                document.getElementById('custom-modal').classList.add('hidden');
                if (typeof window.renderPaymentsView === 'function') window.renderPaymentsView();
            } else {
                alert("Please enter a name and select at least one class.");
            }
        };
    }

    window.deletePackage = async function(id) {
        showConfirm("Delete Bundle", "Remove this package? Students who already bought it will keep their classes.", async () => {
            PACKAGES = PACKAGES.filter(p => p.id !== id);
            await window.fsDeleteDoc(window.fsDoc(window.db, window.fPath('packages'), id));
            if (typeof window.renderPaymentsView === 'function') window.renderPaymentsView();
        });
    }

    async function saveBillingSettings() {
        const btn = document.getElementById('btn-save-billing');
        btn.textContent = "Saving..."; btn.disabled = true;
        
        const vatInput = document.getElementById('bill-hkd-vat');
        const pitInput = document.getElementById('bill-hkd-pit');
        const parsedVat = vatInput && vatInput.value !== '' ? Number(vatInput.value) : (BILLING_SETTINGS.hkdVatRate ?? 0);
        const parsedPit = pitInput && pitInput.value !== '' ? Number(pitInput.value) : (BILLING_SETTINGS.hkdPitRate ?? 2);

        BILLING_SETTINGS = {
            ...BILLING_SETTINGS,
            bankId: (document.getElementById('bill-bank-id')?.value || BILLING_SETTINGS.bankId || 'MB').trim().toUpperCase(),
            bankAcc: (document.getElementById('bill-bank-acc')?.value ?? BILLING_SETTINGS.bankAcc ?? '').trim(),
            bankName: (document.getElementById('bill-bank-name')?.value ?? BILLING_SETTINGS.bankName ?? '').trim().toUpperCase(),
            hkdName: (document.getElementById('bill-hkd-name')?.value ?? BILLING_SETTINGS.hkdName ?? '').trim(),
            hkdTaxId: (document.getElementById('bill-hkd-tax-id')?.value ?? BILLING_SETTINGS.hkdTaxId ?? '').trim(),
            hkdBusinessSector: (document.getElementById('bill-hkd-sector')?.value ?? BILLING_SETTINGS.hkdBusinessSector ?? 'Dịch vụ giáo dục, đào tạo tiếng Anh').trim(),
            hkdAddress: (document.getElementById('bill-hkd-address')?.value ?? BILLING_SETTINGS.hkdAddress ?? '').trim(),
            hkdVatRate: Number.isFinite(parsedVat) && parsedVat >= 0 ? parsedVat : 0,
            hkdPitRate: Number.isFinite(parsedPit) && parsedPit >= 0 ? parsedPit : 2,
            feePerLesson: Number(document.getElementById('bill-fee').value) || 100000,
            lessonsPerMonth: Number(document.getElementById('bill-lpm').value) || 12,
            discCombo: Number(document.getElementById('bill-disc-combo').value) || 0,
            discCourse: 20,
            customQR: tempCustomQRBase64
        };

        try {
            await window.fsSetDoc(window.fsDoc(window.db, window.fPath('settings'), 'billing'), BILLING_SETTINGS);
            if (typeof window.renderHkdTaxLedger === 'function') window.renderHkdTaxLedger();
            showModalMsg("Saved", "Pricing, Banking and HKD Tax settings updated. Students and tax ledgers will use the new configurations automatically.");
        } catch (e) {
            showModalMsg("Error", "Could not save settings to cloud.");
        }
        btn.textContent = "Save Settings"; btn.disabled = false;
    }

    window.promptCreateTeacher = function() {
        showInputPrompt("Add Teacher", "Enter new teacher username:", async (username) => {
            if(USERS.find(u => String(u.user).toLowerCase() === username.trim().toLowerCase())) { showModalMsg("Error", "Username taken."); return; }
            showInputPrompt("Password", `Enter password for teacher ${username}:`, async (password) => {
                try {
                    const newTeacher = await createAuthBackedProfile(username, password, {
                        user: username,
                        role: 'teacher',
                        createdAt: new Date().toLocaleDateString()
                    });
                    USERS.push(newTeacher);
                    showModalMsg("Success", `Teacher account '${username}' created successfully.`);
                } catch (error) {
                    console.error('Unable to create teacher account:', error);
                    showModalMsg("Error", `Could not create teacher account: ${error.message}`);
                }
            });
        });
    };

    function promptCreateStudent() {
        showInputPrompt("Add Student", "Enter new student username:", async (username) => {
            const existingStudent = USERS.find(user => String(user.user).toLowerCase() === username.trim().toLowerCase());
            if (existingStudent && (existingStudent.role !== 'student' || existingStudent.uid)) {
                showModalMsg("Error", existingStudent.role !== 'student'
                    ? "That username already belongs to another account type."
                    : "This student profile is already linked to a Firebase UID. Check Firebase Console > Authentication > Users.");
                return;
            }
            showInputPrompt(
                existingStudent ? "Set Firebase Password" : "Password",
                existingStudent
                    ? `This existing student profile is not linked to Firebase Authentication. Set a new password for ${username}:`
                    : `Enter password for ${username}:`,
                async (password) => {
                    try {
                        const profile = existingStudent || {
                            user: username,
                            role: 'student',
                            isPaid: true,
                            paymentStatus: 'paid',
                            pendingClasses: null,
                            createdAt: new Date().toLocaleDateString()
                        };
                        let newStudent = await createAuthBackedProfile(existingStudent?.user || username, password, profile, Boolean(existingStudent));
                        const referralResult = await tryEnsureStudentReferralIdentity(newStudent);
                        newStudent = referralResult.user;
                        const studentIndex = USERS.findIndex(user => String(user.user).toLowerCase() === username.trim().toLowerCase());
                        if (studentIndex === -1) USERS.push(newStudent);
                        else USERS[studentIndex] = newStudent;
                        renderStudentsList();
                        if (referralResult.error) {
                            window.showToast("Referral code unavailable", "The account was created, but its referral code could not be assigned.", "error");
                        } else {
                            showModalMsg("Success", existingStudent
                                ? `Student '${username}' is now linked to Firebase Authentication.`
                                : `Student account '${username}' was created in Firebase Authentication.`);
                        }
                    } catch (error) {
                        console.error('Unable to create student account:', error);
                        showModalMsg("Error", `Could not create student account: ${error.message}`);
                    }
                }
            );
        });
    }

    window.openBulkStudentImport = function() {
        document.getElementById('bulk-student-input').value = '';
        document.getElementById('bulk-student-import-modal').classList.remove('hidden');
    };

    window.processBulkStudentImport = async function() {
        const text = document.getElementById('bulk-student-input').value.trim();
        if (!text) {
            showModalMsg("Empty", "Please paste some data from Excel first.");
            return;
        }

        const lines = text.split('\n');
        let count = 0;
        const failures = [];
        let classUpdates = new Set();
        
        // Show loading state
        const btn = document.querySelector('button[onclick="window.processBulkStudentImport()"]');
        if (btn) { btn.textContent = "Importing..."; btn.disabled = true; }
        
        try {
            for (let line of lines) {
                const parts = line.split('\t');
                if (parts[0] && parts[0].trim() && parts[1] && parts[1].trim()) {
                    const username = parts[0].trim();
                    const password = parts[1].trim();
                    const className = parts[2] ? parts[2].trim() : null;

                    if (USERS.find(u => String(u.user).toLowerCase() === username.toLowerCase())) {
                        console.warn(`Skipping duplicate student username during import: ${username}`);
                        failures.push(`${username}: username already exists`);
                        continue;
                    }

                    try {
                        let newStudent = await createAuthBackedProfile(username, password, {
                            user: username,
                            role: 'student',
                            isPaid: true,
                            paymentStatus: 'paid',
                            pendingClasses: null,
                            createdAt: new Date().toLocaleDateString()
                        });
                        const referralResult = await tryEnsureStudentReferralIdentity(newStudent);
                        newStudent = referralResult.user;
                        USERS.push(newStudent);
                        count++;
                        if (referralResult.error) {
                            console.error(`Referral code setup failed for ${username}:`, referralResult.error);
                        }

                        if (className) {
                            const cls = CLASSES.find(c => c.name.toLowerCase() === className.toLowerCase());
                            if (cls) {
                                if (!cls.enrolledStudents) cls.enrolledStudents = [];
                                if (!cls.enrolledStudents.includes(newStudent.user)) {
                                    cls.enrolledStudents.push(newStudent.user);
                                    classUpdates.add(cls);
                                }
                            }
                        }
                    } catch (error) {
                        console.error(`Unable to create student account ${username}:`, error);
                        failures.push(`${username}: ${error.message}`);
                    }
                }
            }

            for (let cls of classUpdates) {
                try {
                    await window.fsSetDoc(window.fsDoc(window.db, window.fPath('classes'), cls.id), cls);
                } catch (error) {
                    console.error(`Unable to save enrollment changes for class ${cls.name}:`, error);
                    failures.push(`Class ${cls.name}: ${error.message}`);
                }
            }
        } finally {
            document.getElementById('bulk-student-import-modal').classList.add('hidden');
            renderStudentsList();
            renderClasses();
            if (btn) { btn.textContent = "Import Students"; btn.disabled = false; }
        }
        
        const failureMessage = failures.length
            ? ` ${failures.length} account or class update(s) failed. See the browser console for details.`
            : '';
        showModalMsg(failures.length ? "Import Completed with Errors" : "Success", `Created and imported ${count} new student accounts.${failureMessage}`);
    };

    async function togglePaymentStatus(username, status) {
        const user = USERS.find(u => u.user === username);
        if(user) {
            // ✨ FIX: Handle Gem Top-Ups vs Course Enrollments
            if (status && user.paymentStatus === 'pending' && user.pendingInfo && user.pendingInfo.includes('Top-Up')) {
                // Parse the gems from the "Top-Up 500 Gems" string
                const match = user.pendingInfo.match(/Top-Up (\d+) Gems/);
                if (match && match[1]) {
                    const gemsToAdd = parseInt(match[1], 10);
                    user.gems = (user.gems || 0) + gemsToAdd;
                }
                user.paymentStatus = 'paid';
                user.pendingInfo = null;
                // Note: We deliberately do not change user.isPaid here so we don't accidentally lock/unlock their courses!
            } else {
                // Standard Course Enrollment Logic
                const isApprovedCoursePayment = status && user.paymentStatus === 'pending' && Boolean(user.pendingInfo);
                if (status && user.pendingClasses && Array.isArray(user.pendingClasses)) {
                    const ambiguousTemplate = user.pendingClasses.find(classId => {
                        const cls = CLASSES.find(candidate => candidate.id === classId);
                        return window.isTemplateClass(cls) && CLASSES.filter(candidate => candidate.parentClassId === cls.id).length !== 1;
                    });
                    if (ambiguousTemplate) {
                        showModalMsg("Enrollment Needs Review", "This payment refers to a material template with multiple small classes. Select the correct small class before approving the enrollment.");
                        return;
                    }
                }

                user.isPaid = status;
                user.paymentStatus = status ? 'paid' : 'unpaid';
                if (!status) user.billingAccessOverride = false;
                if (status && !isApprovedCoursePayment) user.billingAccessOverride = true;
                
                // AUTOMATIC ENROLLMENT MAGIC:
                if (status && user.pendingClasses && Array.isArray(user.pendingClasses)) {
                    for (let cid of user.pendingClasses) {
                        let cls = CLASSES.find(c => c.id === cid);
                        if (window.isTemplateClass(cls)) cls = CLASSES.find(candidate => candidate.parentClassId === cls.id);
                        if (cls) {
                            if (!cls.enrolledStudents) cls.enrolledStudents = [];
                            if (!cls.enrolledStudents.includes(username)) {
                                cls.enrolledStudents.push(username);
                                await window.fsSetDoc(window.fsDoc(window.db, window.fPath('classes'), cls.id), cls);
                            }
                        }
                    }
                }

                if (status) {
                    if (isApprovedCoursePayment) {
                        const planTitle = user.pendingPlanTitle || user.pendingInfo || 'Monthly tuition';
                        const parsedMonths = Number(user.pendingPlanMonths);
                        const titleMonths = /full course|4m/i.test(planTitle) ? 4 : /3m|3 month/i.test(planTitle) ? 3 : /2 month/i.test(planTitle) ? 2 : 1;
                        const planMonths = Number.isInteger(parsedMonths) && parsedMonths > 0 ? parsedMonths : titleMonths;
                        const now = Date.now();
                        const currentExpiry = getBillingExpiryMillis(user);
                        const billingStart = currentExpiry !== null && currentExpiry > now ? currentExpiry : now;
                        const expiresAt = addBillingMonths(billingStart, planMonths);
                        const paymentId = user.pendingPaymentId || `approved_${username}_${now}`;
                        const paymentHistory = Array.isArray(user.paymentHistory) ? user.paymentHistory : [];
                        const enrolledClassNames = (user.pendingClasses || [])
                            .map(cid => CLASSES.find(c => c.id === cid)?.name)
                            .filter(Boolean);
                        const payerName = user.pendingTaxPayerName || user.taxPayerName || user.realName || user.parentName || (window.getStudentDisplayName ? window.getStudentDisplayName(user) : user.user);
                        const payerPhone = user.pendingTaxPayerPhone || user.phone || '';
                        const taxId = user.pendingTaxId || user.taxId || '';
                        const taxAddress = user.pendingTaxAddress || user.taxAddress || '';
                        const invoiceRequested = Boolean(user.pendingTaxInvoiceRequested);
                        const paymentMethod = user.pendingPaymentMethod === 'cash' ? 'Tiền mặt' : 'Chuyển khoản NH';
                        const receiptNo = window.formatHkdReceiptNumber
                            ? window.formatHkdReceiptNumber(now, paymentHistory.length + 1)
                            : `PT-${now}`;
                        const vatRate = BILLING_SETTINGS.hkdVatRate !== undefined && BILLING_SETTINGS.hkdVatRate !== null ? Number(BILLING_SETTINGS.hkdVatRate) : 0;
                        const pitRate = BILLING_SETTINGS.hkdPitRate !== undefined && BILLING_SETTINGS.hkdPitRate !== null ? Number(BILLING_SETTINGS.hkdPitRate) : 2;
                        const paidAmount = Number(user.pendingAmount) || 0;

                        if (payerName && !user.realName) user.realName = payerName;
                        if (payerName) user.taxPayerName = payerName;
                        if (payerPhone) user.phone = payerPhone;
                        if (taxId) user.taxId = taxId;
                        if (taxAddress) user.taxAddress = taxAddress;

                        user.billingPlanTitle = user.pendingPlanTitle || `${planMonths} Month Plan`;
                        user.billingPlanMonths = planMonths;
                        user.billingLastPaymentAt = now;
                        user.billingLastPaymentAmount = paidAmount;
                        user.billingExpiresAt = expiresAt;
                        user.billingAccessOverride = false;
                        if (!paymentHistory.some(payment => payment.id === paymentId)) {
                            const courseLabel = enrolledClassNames.length ? enrolledClassNames.join(', ') : (user.pendingInfo || user.billingPlanTitle);
                            paymentHistory.push({
                                id: paymentId,
                                receiptNo,
                                plan: user.billingPlanTitle,
                                months: planMonths,
                                lessons: Number(user.pendingLessons) || 0,
                                classes: enrolledClassNames,
                                courseDescription: courseLabel,
                                description: `Thu học phí ${courseLabel} (${user.billingPlanTitle}) - HV: ${payerName}`,
                                payerName,
                                payerPhone,
                                taxId,
                                taxAddress,
                                invoiceRequested,
                                paymentMethod,
                                receivingBank: BILLING_SETTINGS.bankAcc ? `${BILLING_SETTINGS.bankId || 'MB'} - ${BILLING_SETTINGS.bankAcc}` : '',
                                vatRate,
                                pitRate,
                                vatAmount: Math.round(paidAmount * (vatRate / 100)),
                                pitAmount: Math.round(paidAmount * (pitRate / 100)),
                                amount: paidAmount,
                                submittedAt: user.pendingSubmittedAt || now,
                                approvedAt: now,
                                expiresAt
                            });
                        }
                        user.paymentHistory = paymentHistory;
                        user.lastApprovedPaymentId = paymentId;
                    }
                    if (user.pendingLessons) {
                        user.totalLessonsPaid = (user.totalLessonsPaid || 0) + user.pendingLessons;
                    } else if (!user.totalLessonsPaid) {
                        user.totalLessonsPaid = BILLING_SETTINGS.lessonsPerMonth || 12; // Fallback
                    }
                    user.referralDiscountCredits = Math.max(
                        0,
                        (Number(user.referralDiscountCredits) || 0) - (Number(user.pendingReferralCreditsUsed) || 0)
                    );
                    if (user.pendingReferralBy && !user.referralDiscountUsed) {
                        const referrerRef = window.fsDoc(window.db, window.fPath('users'), user.pendingReferralBy);
                        const referrerSnap = await window.fsGetDoc(referrerRef);
                        if (referrerSnap.exists()) {
                            const referrer = referrerSnap.data();
                            const rewardedUsers = referrer.referralRewardedUsers || [];
                            if (!rewardedUsers.includes(user.user)) {
                                referrer.referralDiscountCredits = (Number(referrer.referralDiscountCredits) || 0) + 1;
                                referrer.referralRewardedUsers = [...rewardedUsers, user.user];
                                await window.fsSetDoc(referrerRef, referrer);
                                const referrerIndex = USERS.findIndex(candidate => candidate.user === referrer.user);
                                if (referrerIndex >= 0) USERS[referrerIndex] = referrer;
                            }
                        } else {
                            console.error(`Referral owner "${user.pendingReferralBy}" no longer exists; referral credit was not granted.`);
                        }
                        user.referralDiscountUsed = true;
                        user.referralRewardGranted = true;
                    }
                    user.pendingInfo = null; 
                    user.pendingClasses = null; 
                    user.pendingLessons = null;
                    user.pendingAmount = null;
                    user.pendingReferralCreditsUsed = null;
                    user.pendingReferralBy = null;
                    user.pendingReferralCode = null;
                    user.pendingPlanTitle = null;
                    user.pendingPlanMonths = null;
                    user.pendingPaymentId = null;
                    user.pendingSubmittedAt = null;
                    user.pendingPaymentMethod = null;
                    user.pendingTaxPayerName = null;
                    user.pendingTaxPayerPhone = null;
                    user.pendingTaxId = null;
                    user.pendingTaxAddress = null;
                    user.pendingTaxInvoiceRequested = null;
                }
            }

            await window.fsSetDoc(window.fsDoc(window.db, window.fPath('users'), username), user);
            await window.syncTrustedAccountAccess(user);
            renderStudentsList();
            renderPaymentAccessList();
            if (typeof window.renderHkdTaxLedger === 'function') window.renderHkdTaxLedger();
            renderClasses(); 
        }
    }

    // --- TIMETABLE & ATTENDANCE LOGIC ---
    let currentCalDate = new Date();
    window.currentCalView = 'week';
