    function getBillingExpiryMillis(user) {
      const expiry = user?.billingExpiresAt;
      if (expiry && typeof expiry.toMillis === 'function') return expiry.toMillis();
      if (expiry && typeof expiry.toDate === 'function') return expiry.toDate().getTime();
      if (typeof expiry === 'number' && Number.isFinite(expiry)) return expiry;
      if (typeof expiry === 'string' && expiry.trim()) {
        const parsed = Date.parse(expiry);
        return Number.isFinite(parsed) ? parsed : null;
      }
      return null;
    }

    function hasActiveStudentAccess(user, now = Date.now()) {
      if (user?.uid && user.uid === window.auth?.currentUser?.uid && window.trustedAccountAccess?.uid === user.uid) {
        const access = window.trustedAccountAccess;
        if (access.role !== 'student' || access.paid !== true) return false;
        const expiry = access.billingExpiresAt;
        if (!expiry) return true;
        const expiryMillis = typeof expiry.toMillis === 'function' ? expiry.toMillis() : Number(expiry);
        return Number.isFinite(expiryMillis) && expiryMillis > now;
      }
      if (!user || user.isPaid !== true) return false;
      if (user.billingAccessOverride === true) return true;
      const expiry = getBillingExpiryMillis(user);
      return expiry === null || expiry > now;
    }

    function getStudentBillingStatus(user, now = Date.now()) {
      const expiry = getBillingExpiryMillis(user);
      const hasAccess = hasActiveStudentAccess(user, now);
      const pending = user?.paymentStatus === 'pending';
      const overridden = user?.billingAccessOverride === true && user?.isPaid === true;
      const legacy = user?.isPaid === true && expiry === null && !overridden;
      const label = pending
        ? (hasAccess ? 'Active · renewal pending' : 'Payment pending')
        : hasAccess
          ? (overridden ? 'Active · manual override' : legacy ? 'Active · no expiry recorded' : 'Active')
          : expiry !== null && expiry <= now ? 'Expired · locked' : 'Locked';
      return { hasAccess, pending, expiry, label, legacy, overridden };
    }

    function formatBillingDate(timestamp) {
      if (timestamp === null || timestamp === undefined) return '—';
      const date = new Date(timestamp);
      return Number.isNaN(date.getTime()) ? '—' : date.toLocaleString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
    }

    function formatBillingDateInput(timestamp) {
      if (timestamp === null || timestamp === undefined) return '';
      const date = new Date(timestamp);
      if (Number.isNaN(date.getTime())) return '';
      return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
    }

    function getStudentDisplayName(user = currentUser) {
      return window.LMSAuthHelpers.getStudentDisplayName(user, window.auth?.currentUser);
    }
    window.getStudentDisplayName = getStudentDisplayName;

    function parseBillingDeadlineDate(value) {
      const match = String(value || '').match(/^(\d{4})-(\d{2})-(\d{2})$/);
      if (!match) return null;
      const [, year, month, day] = match.map(Number);
      const date = new Date(year, month - 1, day, 23, 59, 59, 999);
      if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day) return null;
      return date.getTime();
    }

    function addBillingMonths(timestamp, months) {
      const date = new Date(timestamp);
      const originalDay = date.getDate();
      date.setDate(1);
      date.setMonth(date.getMonth() + months);
      const lastDay = new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
      date.setDate(Math.min(originalDay, lastDay));
      date.setHours(23, 59, 59, 999);
      return date.getTime();
    }

    function scheduleStudentBillingExpiry() {
      if (studentBillingExpiryTimer) clearTimeout(studentBillingExpiryTimer);
      studentBillingExpiryTimer = null;
      if (!currentUser || currentUser.role !== 'student' || !currentUser.isPaid || currentUser.billingAccessOverride === true) return;
      const expiry = getBillingExpiryMillis(currentUser);
      if (expiry === null) return;
      const remaining = expiry - Date.now();
      if (remaining <= 0) return;
      studentBillingExpiryTimer = setTimeout(() => {
        studentBillingExpiryTimer = null;
        if (hasActiveStudentAccess(currentUser)) {
          scheduleStudentBillingExpiry();
          return;
        }
        if (document.getElementById('exam-ui') && !document.getElementById('exam-ui').classList.contains('hidden')) {
          document.getElementById('exam-ui').classList.add('hidden');
          activeTestRoute = false;
        }
        window.initStudentDashboard();
        window.navigateAppRoute('student/dashboard', true);
      }, Math.min(remaining + 50, 2147483647));
    }

    window.hasActiveStudentAccess = hasActiveStudentAccess;
    window.getStudentBillingStatus = getStudentBillingStatus;

    window.initStudentDashboard = function initStudentDashboard(preserveCid = null) {
      document.getElementById('student-name-display').textContent = getStudentDisplayName();
      
      scheduleStudentBillingExpiry();
      const isPaid = hasActiveStudentAccess(currentUser);
      document.getElementById('start-screen')?.classList.toggle('checkout-mode', !isPaid);
      const mainContent = document.getElementById('student-main-content');
      if (mainContent) mainContent.classList.toggle('hidden', !isPaid);
      
      const warnContainer = document.getElementById('student-payment-warning');

      if(isPaid) {
          warnContainer.classList.add('hidden');
          warnContainer.innerHTML = ''; 
          
          // FIX: Safely loads classes without crashing the UI
          const myClasses = CLASSES.filter(c => !window.isTemplateClass(c) && (c.enrolledStudents || []).includes(currentUser.user));
          const sel = document.getElementById('student-class-select');
          
          const currentVal = preserveCid !== null ? preserveCid : sel.value;

          if (myClasses.length === 0) {
              sel.innerHTML = '<option value="">-- No Classes Assigned --</option>';
              sel.disabled = true;
          } else {
              sel.innerHTML = myClasses.map(c => `<option value="${c.id}">${c.name}</option>`).join('');
              sel.disabled = false;
              
              if (currentVal && myClasses.find(c => c.id === currentVal)) {
                  sel.value = currentVal;
              } else {
                  // AUTO SELECT first class to prevent blank screen!
                  sel.value = myClasses[0].id;
              }
              window.renderStudentDashboard();
          }
      } else {
          warnContainer.classList.remove('hidden');
          if (currentUser.paymentStatus === 'pending') {
              warnContainer.innerHTML = `
                 <div class="bg-blue-50 border border-blue-200 rounded-2xl p-10 text-center shadow-inner flex flex-col items-center">
                    <div class="inline-flex items-center justify-center w-20 h-20 rounded-full bg-blue-100 text-blue-500 mb-5 shadow-sm animate-pulse border-4 border-white">
                       <svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>
                    </div>
                    <h2 class="text-2xl font-black text-blue-900 mb-2">Awaiting Verification</h2>
                    <p class="text-blue-600 font-medium max-w-lg mx-auto">Your payment notification has been sent to the teacher. Once they verify the transaction, this page will automatically unlock your course materials.</p>
                 </div>
              `;
          } else {
              window.renderStudentCheckout();
          }
      }
      if (window.updateDashboardHeader) window.updateDashboardHeader();
    };

    const formatVND = (amt) => new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(amt);

    window.calculateGroupLessonFee = function(baseFee, studentCount) {
        let fee = Math.max(0, Number(baseFee) || 0);
        const count = Math.max(1, Math.floor(Number(studentCount) || 1));
        for (let student = 1; student < count; student++) {
            fee = Math.round((fee * 0.9) / 5000) * 5000;
        }
        return fee;
    };

    window.checkoutReferralState = null;
    window.applyReferralCode = async function() {
        const input = document.getElementById('checkout-referral-code');
        const status = document.getElementById('checkout-referral-status');
        if (!input || !status || !currentUser) return;

        const code = input.value.trim().toUpperCase();
        if (!code) {
            window.checkoutReferralState = null;
            currentUser.appliedReferralCode = null;
            currentUser.appliedReferralBy = null;
            await window.fsSetDoc(window.fsDoc(window.db, window.fPath('users'), currentUser.user), currentUser);
            sessionStorage.setItem('ielts_session', JSON.stringify(currentUser));
            status.textContent = 'Referral code removed.';
            window.updateCheckoutMath();
            return;
        }
        if (currentUser.referralDiscountUsed) {
            status.textContent = 'Your one-time referral discount has already been used.';
            return;
        }
        if (currentUser.isPaid || Number(currentUser.totalLessonsPaid) > 0) {
            status.textContent = 'Referral codes can only be used by a new student on their first payment.';
            return;
        }

        try {
            const referralSnap = await window.fsGetDoc(window.fsDoc(window.db, window.fPath('referral_codes'), code));
            if (!referralSnap.exists()) {
                window.checkoutReferralState = null;
                status.textContent = 'Referral code not found.';
                window.updateCheckoutMath();
                return;
            }

            const referrer = referralSnap.data().user;
            if (!referrer || referrer === currentUser.user) {
                window.checkoutReferralState = null;
                status.textContent = 'You cannot use your own referral code.';
                window.updateCheckoutMath();
                return;
            }

            currentUser.appliedReferralCode = code;
            currentUser.appliedReferralBy = referrer;
            window.checkoutReferralState = { code, referrer };
            await window.fsSetDoc(window.fsDoc(window.db, window.fPath('users'), currentUser.user), currentUser);
            sessionStorage.setItem('ielts_session', JSON.stringify(currentUser));
            status.textContent = `Code accepted. Your first payment and the referrer's next payment each receive 10% off.`;
            window.updateCheckoutMath();
        } catch (error) {
            console.error('Unable to validate referral code:', error);
            status.textContent = 'Could not verify the referral code. Please try again.';
        }
    };

    window.renderStudentCheckout = function renderStudentCheckout() {
        document.getElementById('start-screen')?.classList.add('checkout-mode');
        let classOpts = '';
        const availableClasses = CLASSES.filter(cls => !window.isTemplateClass(cls));
        
        if (PACKAGES.length > 0) {
            const availablePackages = PACKAGES.filter(pkg => (pkg.classes || []).some(classId => {
                const cls = CLASSES.find(candidate => candidate.id === classId);
                return cls && !window.isTemplateClass(cls);
            }));
            if (availablePackages.length) {
                classOpts += `<optgroup label="--- Bundled Packages ---">`;
                classOpts += availablePackages.map(p => `<option value="pkg_${p.id}">📦 ${p.name}</option>`).join('');
                classOpts += `</optgroup>`;
            }
        }
        if (availableClasses.length) {
            classOpts += `<optgroup label="--- Classes ---">`;
            classOpts += availableClasses.map(cls => `<option value="${cls.id}">${cls.parentClassId ? '👥 ' : ''}${cls.name}</option>`).join('');
            classOpts += `</optgroup>`;
        }
        
        if (!classOpts) classOpts = `<option value="">No classes or packages available</option>`;

        const lpmDefault = BILLING_SETTINGS.lessonsPerMonth || 12;
        const billingExpiry = getBillingExpiryMillis(currentUser);
        const expiredPlanNotice = billingExpiry !== null && billingExpiry <= Date.now()
            ? `<p class="text-amber-800 bg-amber-50 border border-amber-200 rounded-xl p-3 mb-5 font-semibold">Your ${currentUser.billingPlanTitle || 'tuition plan'} expired on ${formatBillingDate(billingExpiry)}. Submit your next payment and wait for teacher verification to restore course access.</p>`
            : '';

        document.getElementById('student-payment-warning').innerHTML = `
         <div class="bg-white rounded-2xl shadow-xl overflow-hidden border border-slate-200 flex flex-col lg:flex-row">
            <div class="p-6 sm:p-8 lg:p-10 lg:w-3/5 flex flex-col justify-center bg-gradient-to-br from-slate-50 to-white">
                <div class="inline-flex items-center gap-2 px-3 py-1 bg-blue-50 border border-blue-100 rounded-full text-blue-700 text-xs font-black uppercase tracking-widest mb-4 w-max">
                   <span class="flex items-center justify-center w-5 h-5 rounded-full bg-blue-600 text-white text-[10px]">1</span> Choose your course
                </div>
                <h2 class="text-2xl sm:text-3xl font-black text-slate-900 mb-2">Start your IELTS course</h2>
                ${hasActiveStudentAccess(currentUser) ? `<button type="button" onclick="window.closeStudentRenewal()" class="text-left text-sm font-bold text-blue-700 hover:text-blue-900 mb-3">← Back to my classes</button>` : ''}
                <p class="text-slate-600 mb-6 font-medium">Choose a class and study plan. Your total updates automatically before you pay.</p>
                ${expiredPlanNotice}
                
                <div class="flex flex-col sm:flex-row gap-4 mb-5">
                    <div class="flex-1">
                        <label class="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-1.5">Course or bundle</label>
                        <select id="checkout-course" class="w-full bg-white border border-slate-300 text-slate-800 p-3 rounded-xl outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 font-bold transition-colors shadow-sm" onchange="window.updateCheckoutMath()">
                            ${classOpts}
                        </select>
                    </div>
                    <div class="w-full sm:w-32 shrink-0" id="checkout-lpm-container">
                        <label class="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-1.5" title="Lessons per month">Lessons / mo</label>
                        <input type="number" id="checkout-lpm" value="${lpmDefault}" min="1" max="100" class="w-full bg-white border border-slate-300 text-slate-800 p-3 rounded-xl outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 font-bold text-center transition-colors shadow-sm" oninput="window.updateCheckoutMath()">
                    </div>
                </div>

                <div id="checkout-package-info" class="hidden bg-blue-50 border border-blue-200 rounded-xl p-4 mb-5"></div>
                <div class="mb-5 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                    <label class="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-2">Referral code <span class="normal-case tracking-normal font-medium">(optional)</span></label>
                    <div class="flex gap-2">
                        <input id="checkout-referral-code" type="text" maxlength="40" placeholder="Enter a student's code" class="min-w-0 flex-1 bg-white border border-slate-300 text-slate-800 p-2.5 rounded-lg outline-none focus:border-blue-500 font-bold uppercase">
                        <button type="button" onclick="window.applyReferralCode()" class="bg-blue-50 text-blue-800 hover:bg-blue-100 border border-blue-100 px-4 rounded-lg font-bold text-sm">Apply</button>
                    </div>
                    <div id="checkout-referral-status" class="text-xs text-slate-500 mt-2" aria-live="polite"></div>
                </div>

                <h3 class="text-sm font-black text-slate-700 uppercase tracking-wider mb-3">Choose a payment plan</h3>
                <div class="space-y-3" id="checkout-plans-container"></div>
            </div>
            <div class="bg-white p-6 sm:p-8 lg:p-10 lg:w-2/5 flex flex-col items-center justify-center border-t lg:border-t-0 lg:border-l border-slate-200 relative">
                <div class="inline-flex items-center gap-2 px-3 py-1 bg-emerald-50 border border-emerald-100 rounded-full text-emerald-700 text-xs font-black uppercase tracking-widest mb-4">
                    <span class="flex items-center justify-center w-5 h-5 rounded-full bg-emerald-600 text-white text-[10px]">2</span> Complete payment
                </div>
                <h3 class="text-xl font-black text-slate-900 mb-2 tracking-tight">Scan to pay</h3>
                <p class="text-sm text-slate-500 text-center mb-5">Use your banking app to scan this QR code.</p>
                
                <div class="p-2 bg-white rounded-2xl shadow-md border border-slate-200 mb-5 relative">
                    <img id="vietqr-image" src="" class="w-52 h-52 sm:w-56 sm:h-56 object-contain rounded-lg" alt="Bank QR Code">
                </div>

                <div class="text-center w-full mb-5">
                    <div class="text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">Total to Pay</div>
                    <div id="vietqr-amount" class="text-3xl font-black text-blue-700 tracking-tight">0 ₫</div>
                    <div class="text-left bg-slate-50 border border-slate-200 rounded-xl p-3 mt-4">
                        <div class="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">Bank transfer note</div>
                        <div id="vietqr-desc" class="font-mono text-sm font-bold text-slate-800 break-words"></div>
                    </div>
                </div>

                <button id="btn-verify-pay" onclick="notifyTeacherPayment()" class="w-full py-3.5 bg-blue-600 hover:bg-blue-700 text-white font-black rounded-xl shadow-md transition-all hover:-translate-y-0.5 flex justify-center items-center gap-2 text-base">
                    I have completed the transfer
                </button>
                <p class="text-xs text-slate-500 text-center mt-3 leading-relaxed">After transferring, select this button to notify your teacher. Your course unlocks after payment verification.</p>
            </div>
         </div>
        `;

        window.checkoutReferralState = currentUser.appliedReferralBy && !currentUser.referralDiscountUsed && !currentUser.isPaid && !Number(currentUser.totalLessonsPaid)
            ? { code: currentUser.appliedReferralCode, referrer: currentUser.appliedReferralBy }
            : null;
        const referralInput = document.getElementById('checkout-referral-code');
        if (referralInput && currentUser.appliedReferralCode && window.checkoutReferralState) referralInput.value = currentUser.appliedReferralCode;
        const referralStatus = document.getElementById('checkout-referral-status');
        if (referralStatus) {
            const credits = Math.max(0, Number(currentUser.referralDiscountCredits) || 0);
            referralStatus.textContent = window.checkoutReferralState
                ? `Code accepted. Your first payment and the referrer's next payment each receive 10% off.${credits ? ` You also have ${credits} referral discount(s) earned.` : ''}`
                : credits ? `You have ${credits} referral discount(s) earned for future payments.` : '';
        }

        window.updateCheckoutMath();
    };

    window.updateCheckoutMath = function updateCheckoutMath() {
        const courseSel = document.getElementById('checkout-course');
        const selVal = courseSel ? courseSel.value : null;

        const lpmContainer = document.getElementById('checkout-lpm-container');
        const infoContainer = document.getElementById('checkout-package-info');
        
        let fpl = BILLING_SETTINGS.feePerLesson || 100000;
        
        if (selVal && selVal.startsWith('pkg_')) {
            if (lpmContainer) lpmContainer.classList.remove('hidden');
            
            const pkgId = selVal.replace('pkg_', '');
            const pkg = PACKAGES.find(p => p.id === pkgId);
            
            if (pkg && infoContainer) {
                const classNames = (pkg.classes || []).map(cid => CLASSES.find(c => c.id === cid)).filter(cls => cls && !window.isTemplateClass(cls)).map(cls => cls.name);
                infoContainer.innerHTML = `
                    <h4 class="text-[10px] font-black text-blue-800 uppercase tracking-widest mb-2 flex items-center gap-1">📦 Bundle Includes:</h4>
                    <ul class="text-sm font-medium text-slate-700 space-y-1">
                        ${classNames.map(n => `<li class="flex items-center gap-2"><span class="w-1 h-1 rounded-full bg-emerald-400"></span> ${n}</li>`).join('')}
                    </ul>
                `;
                infoContainer.classList.remove('hidden');
                
                if (pkg.feePerLesson) fpl = pkg.feePerLesson; 
            }
        } else {
            if (lpmContainer) lpmContainer.classList.remove('hidden');
            if (infoContainer) infoContainer.classList.add('hidden');

            const cls = CLASSES.find(c => c.id === selVal);
            if (cls) fpl = getClassBaseFee(cls);
        }

        const lpmInput = document.getElementById('checkout-lpm');
        const lpm = parseInt(lpmInput ? lpmInput.value : (BILLING_SETTINGS.lessonsPerMonth || 12)) || 1;
        
        const isSingleClass = Boolean(selVal && !selVal.startsWith('pkg_'));
        const selectedClass = isSingleClass ? CLASSES.find(cls => cls.id === selVal) : null;
        const groupSize = selectedClass
            ? (selectedClass.enrolledStudents || []).length + ((selectedClass.enrolledStudents || []).includes(currentUser.user) ? 0 : 1)
            : null;
        if (selectedClass && groupSize > 1) {
            fpl = window.calculateGroupLessonFee(fpl, groupSize);
            if (infoContainer) {
                infoContainer.innerHTML = `<p class="text-sm font-bold text-slate-700">👥 ${groupSize} students in this small class · ${formatVND(fpl)} per lesson after group discount.</p>`;
                infoContainer.classList.remove('hidden');
            }
        } else if (selectedClass && infoContainer) {
            infoContainer.innerHTML = `<p class="text-sm font-bold text-slate-700">${selectedClass.parentClassId ? `Small class using shared materials · ${formatVND(fpl)} per lesson.` : `${formatVND(fpl)} per lesson.`}</p>`;
            infoContainer.classList.remove('hidden');
        }

        const referralCreditsAvailable = Math.max(0, Math.floor(Number(currentUser.referralDiscountCredits) || 0));
        const newStudentReferral = Boolean(window.checkoutReferralState && !currentUser.referralDiscountUsed && !currentUser.isPaid && !Number(currentUser.totalLessonsPaid));
        const referralDiscountCount = referralCreditsAvailable + (newStudentReferral ? 1 : 0);
        const applyReferralDiscounts = amount => {
            let discounted = amount;
            for (let credit = 0; credit < referralDiscountCount; credit++) discounted = Math.round(discounted * 0.9);
            return discounted;
        };
        const configuredComboRate = Number(BILLING_SETTINGS.discCombo);
        const configuredCourseRate = Number(BILLING_SETTINGS.discCourse);
        const comboRate = Number.isFinite(configuredComboRate) ? configuredComboRate : 10;
        const courseRate = Number.isFinite(configuredCourseRate) ? configuredCourseRate : 10;
        const p1Raw = fpl * lpm;
        const p2Raw = fpl * lpm * 2;
        const p2Disc = p2Raw * (1 - (comboRate / 100));
        const p4Raw = fpl * lpm * 4;
        const p4Disc = p4Raw * (1 - (courseRate / 100));

        window.checkoutPlans = [
            { id: 1, title: '1 Month Standard', months: 1, lessons: lpm, raw: p1Raw, final: applyReferralDiscounts(p1Raw), label: 'Pay as you go' },
            { id: 2, title: '2 Month Combo', months: 2, lessons: lpm*2, raw: p2Raw, final: applyReferralDiscounts(p2Disc), label: `Save ${comboRate}%`, pop: true },
            { id: 4, title: 'Full Course (4M)', months: 4, lessons: lpm*4, raw: p4Raw, final: applyReferralDiscounts(p4Disc), label: `Save ${courseRate}%` }
        ];
        window.checkoutPlans.forEach(plan => {
            plan.referralCreditsApplied = referralDiscountCount;
            plan.groupSize = groupSize;
        });

        const ctn = document.getElementById('checkout-plans-container');
        if (ctn) {
            ctn.innerHTML = window.checkoutPlans.map((p, idx) => `
                <div onclick="selectPaymentPackage(${idx})" id="pkg-card-${idx}" class="relative p-5 rounded-xl border-2 transition-all cursor-pointer flex justify-between items-center bg-blue-700/40 border-blue-500/50 hover:border-blue-300 group overflow-hidden">
                    ${p.pop ? `<div class="absolute top-0 right-0 bg-gradient-to-r from-emerald-400 to-teal-500 text-white text-[10px] font-black uppercase px-3 py-1 rounded-bl-lg shadow-sm z-10">Most Popular</div>` : ''}
                    <div class="absolute inset-0 bg-white/5 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none"></div>
                    <div class="z-10 flex-1">
                        <div class="flex items-center gap-3 mb-1">
                            <div id="pkg-radio-${idx}" class="w-4 h-4 rounded-full border-2 border-blue-300 flex items-center justify-center transition-colors shrink-0"></div>
                            <h4 id="pkg-title-${idx}" class="font-bold text-lg text-white transition-colors">${p.title} <span class="opacity-80 font-normal text-sm ml-1">(${p.lessons} Lessons)</span></h4>
                        </div>
                    </div>
                    <div class="text-right z-10 flex flex-col items-end justify-center shrink-0 pl-4">
                        ${p.raw > p.final ? `<div id="pkg-raw-${idx}" class="text-sm line-through mb-0.5 text-blue-300 transition-colors font-semibold">${formatVND(p.raw)}</div>` : ''}
                        <div id="pkg-price-${idx}" class="font-black text-xl text-white transition-colors">${formatVND(p.final)}</div>
                        ${p.label !== 'Pay as you go' ? `<div class="text-[10px] font-bold text-blue-900 mt-1.5 uppercase tracking-widest bg-amber-400 px-2 py-0.5 rounded inline-block shadow-sm">${p.label}</div>` : ''}
                        ${p.groupSize > 1 ? `<div class="text-[10px] font-bold text-slate-500 mt-1">${p.groupSize} students · group rate</div>` : ''}
                        ${p.referralCreditsApplied ? `<div class="text-[10px] font-bold text-emerald-200 mt-1">${p.referralCreditsApplied} × 10% referral discount included</div>` : ''}
                    </div>
                </div>
            `).join('');
        }

        selectPaymentPackage(0); 
        if(window.checkoutPlans.length > 1) selectPaymentPackage(1); 
    };

    window.selectPaymentPackage = function selectPaymentPackage(idx) {
        if (!window.checkoutPlans || !window.checkoutPlans[idx]) return;
        window.selectedCheckoutPlan = idx;
        const pkg = window.checkoutPlans[idx];
        
        window.checkoutPlans.forEach((_, i) => {
            const card = document.getElementById(`pkg-card-${i}`);
            const radio = document.getElementById(`pkg-radio-${i}`);
            const title = document.getElementById(`pkg-title-${i}`);
            const price = document.getElementById(`pkg-price-${i}`);
            const rawPrice = document.getElementById(`pkg-raw-${i}`);
            
            if(card && radio && title && price) {
                if (i === idx) {
                    card.className = "relative p-4 rounded-xl border-2 transition-all cursor-pointer flex justify-between items-center bg-blue-50 border-blue-500 shadow-sm group overflow-hidden";
                    radio.className = "w-4 h-4 rounded-full border-2 border-blue-600 flex items-center justify-center transition-colors shrink-0";
                    radio.innerHTML = `<div class="w-2 h-2 rounded-full bg-blue-600"></div>`;
                    title.className = "font-bold text-base sm:text-lg text-slate-900 transition-colors";
                    price.className = "font-black text-lg sm:text-xl text-blue-700 transition-colors";
                    if (rawPrice) rawPrice.className = "text-sm line-through mb-0.5 text-slate-400 transition-colors font-semibold";
                } else {
                    card.className = "relative p-4 rounded-xl border border-slate-200 transition-all cursor-pointer flex justify-between items-center bg-white hover:border-blue-300 hover:bg-slate-50 group overflow-hidden";
                    radio.className = "w-4 h-4 rounded-full border-2 border-slate-300 flex items-center justify-center transition-colors shrink-0";
                    radio.innerHTML = ``;
                    title.className = "font-bold text-base sm:text-lg text-slate-800 transition-colors";
                    price.className = "font-black text-lg sm:text-xl text-slate-800 transition-colors";
                    if (rawPrice) rawPrice.className = "text-sm line-through mb-0.5 text-slate-400 transition-colors font-semibold";
                }
            }
        });

        const courseSel = document.getElementById('checkout-course');
        let courseName = 'Course';
        if (courseSel && courseSel.options[courseSel.selectedIndex]) {
            courseName = courseSel.options[courseSel.selectedIndex].text.replace('📦 ', '');
        }
        const studentName = getStudentDisplayName();
        const msg = `${studentName} - ${courseName}`;
        
        if (BILLING_SETTINGS.customQR) {
            document.getElementById('vietqr-image').src = BILLING_SETTINGS.customQR;
            document.getElementById('vietqr-desc').textContent = "Use Custom QR above & ref: " + studentName;
        } else {
            const qrUrl = `https://img.vietqr.io/image/${BILLING_SETTINGS.bankId}-${BILLING_SETTINGS.bankAcc}-compact2.png?amount=${pkg.final}&addInfo=${encodeURIComponent(msg)}&accountName=${encodeURIComponent(BILLING_SETTINGS.bankName)}`;
            document.getElementById('vietqr-image').src = qrUrl;
            document.getElementById('vietqr-desc').textContent = msg;
        }
        document.getElementById('vietqr-amount').textContent = formatVND(pkg.final);
    };

    window.simulateAutoPayment = function simulateAutoPayment() { }; 

    window.notifyTeacherPayment = async function notifyTeacherPayment() {
        const courseSel = document.getElementById('checkout-course');
        if (!courseSel || !courseSel.value) {
            showModalMsg("Notice", "Please select a course to enroll in first.");
            return;
        }
        const selVal = courseSel.value;
        const courseName = courseSel.options[courseSel.selectedIndex].text;
        
        const btn = document.getElementById('btn-verify-pay');
        btn.disabled = true;
        btn.innerHTML = `<svg class="animate-spin -ml-1 mr-3 h-5 w-5 text-white inline-block" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg> Sending Notification...`;
        
        const pkg = window.checkoutPlans?.[window.selectedCheckoutPlan];
        if (!pkg) {
            showModalMsg("Notice", "Select a valid payment plan first.");
            btn.disabled = false;
            btn.textContent = "I Have Transferred the Money ✓";
            return;
        }
        const previousUser = { ...currentUser };
        currentUser.pendingRenewal = currentUser.isPaid === true;
        currentUser.paymentStatus = 'pending';
        currentUser.pendingInfo = `${courseName} (${pkg.title}) · ${formatVND(pkg.final)}`;
        currentUser.pendingLessons = pkg.lessons; 
        currentUser.pendingAmount = pkg.final;
        currentUser.pendingPlanTitle = pkg.title;
        currentUser.pendingPlanMonths = pkg.months;
        currentUser.pendingPaymentId = `pay_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
        currentUser.pendingReferralCreditsUsed = Math.min(pkg.referralCreditsApplied || 0, Number(currentUser.referralDiscountCredits) || 0);
        currentUser.pendingReferralBy = window.checkoutReferralState && !currentUser.referralDiscountUsed && !currentUser.isPaid && !Number(currentUser.totalLessonsPaid)
            ? window.checkoutReferralState.referrer
            : null;
        currentUser.pendingReferralCode = currentUser.pendingReferralBy ? window.checkoutReferralState.code : null;
        
        if (selVal.startsWith('pkg_')) {
            const packageObj = PACKAGES.find(p => p.id === selVal.replace('pkg_', ''));
            currentUser.pendingClasses = packageObj
                ? (packageObj.classes || []).filter(classId => {
                    const cls = CLASSES.find(candidate => candidate.id === classId);
                    return cls && !window.isTemplateClass(cls);
                })
                : [];
        } else {
            const cls = CLASSES.find(candidate => candidate.id === selVal);
            currentUser.pendingClasses = cls && !window.isTemplateClass(cls) ? [cls.id] : [];
        }
        if (!currentUser.pendingClasses.length) {
            showModalMsg("Notice", "Select an available small class or a bundle that includes an active class.");
            btn.disabled = false;
            btn.textContent = "I Have Transferred the Money ✓";
            currentUser.paymentStatus = 'unpaid';
            return;
        }
        
        const cloudUserIdx = USERS.findIndex(u => u.user === currentUser.user);
        if (cloudUserIdx > -1) {
            USERS[cloudUserIdx].paymentStatus = 'pending';
            USERS[cloudUserIdx].pendingInfo = currentUser.pendingInfo;
            USERS[cloudUserIdx].pendingClasses = currentUser.pendingClasses;
            USERS[cloudUserIdx].pendingLessons = currentUser.pendingLessons;
            USERS[cloudUserIdx].pendingAmount = currentUser.pendingAmount;
            USERS[cloudUserIdx].pendingPlanTitle = currentUser.pendingPlanTitle;
            USERS[cloudUserIdx].pendingPlanMonths = currentUser.pendingPlanMonths;
            USERS[cloudUserIdx].pendingPaymentId = currentUser.pendingPaymentId;
            USERS[cloudUserIdx].pendingReferralCreditsUsed = currentUser.pendingReferralCreditsUsed;
            USERS[cloudUserIdx].pendingReferralBy = currentUser.pendingReferralBy;
            USERS[cloudUserIdx].pendingReferralCode = currentUser.pendingReferralCode;
        }
        try {
            await window.fsSetDoc(window.fsDoc(window.db, window.fPath('users'), currentUser.user), currentUser);
        } catch (error) {
            console.error('Unable to submit tuition payment request:', error);
            currentUser = previousUser;
            sessionStorage.setItem('ielts_session', JSON.stringify(currentUser));
            const cloudUserIdx = USERS.findIndex(u => u.user === currentUser.user);
            if (cloudUserIdx > -1) USERS[cloudUserIdx] = currentUser;
            btn.disabled = false;
            btn.textContent = "I Have Transferred the Money ✓";
            showModalMsg("Payment Request Failed", "Could not notify the teacher. Please try again.");
            return;
        }
        
        sessionStorage.setItem('ielts_session', JSON.stringify(currentUser));
        
        if (currentUser.pendingRenewal && typeof window.showToast === 'function') {
            window.showToast("Payment Submitted", "Your renewal request was sent. Your current class access remains active during verification.");
        }
        window.initStudentDashboard(); 
    };

    window.openStudentRenewal = function() {
        if (!currentUser || currentUser.role !== 'student' || (!currentUser.isPaid && getBillingExpiryMillis(currentUser) === null)) return;
        if (currentUser.paymentStatus === 'pending') {
            showModalMsg("Payment Pending", "Please wait for the teacher to verify your current payment request.");
            return;
        }
        window.renderStudentCheckout();
        const warning = document.getElementById('student-payment-warning');
        warning.classList.remove('hidden');
        warning.scrollIntoView({ behavior: 'smooth', block: 'start' });
    };

    window.closeStudentRenewal = function() {
        const warning = document.getElementById('student-payment-warning');
        warning.classList.add('hidden');
        document.getElementById('start-screen')?.classList.remove('checkout-mode');
        window.renderStudentDashboard();
    };

    window.openStudentHistory = function() {
        if (routerReady && !appRouterApplying && currentUser?.role === 'student') {
            window.navigateAppRoute('student/history');
            return;
        }
        const modal = document.getElementById('student-history-modal');
        const content = document.getElementById('student-history-content');
        
        const mySubs = SUBMISSIONS.filter(s => s.student === currentUser.user).sort((a, b) => b.id - a.id);
        const subsHtml = mySubs.length ? mySubs.map(s => `
            <button type="button" class="w-full flex justify-between items-center text-left p-4 bg-white border border-slate-200 rounded-xl shadow-sm hover:border-blue-300 hover:shadow-md transition group" onclick="reviewPastSubmission(${s.id}); document.getElementById('student-history-modal').classList.add('hidden');">
                <div>
                    <div class="font-bold text-slate-800 text-sm group-hover:text-blue-700 transition-colors">${s.testName}</div>
                    <div class="text-[10px] text-slate-500 font-medium uppercase tracking-widest mt-0.5">${s.date} • ${s.className}</div>
                </div>
                <div class="flex items-center gap-3">
                    <span class="font-black text-blue-700 bg-blue-50 px-3 py-1.5 rounded-lg border border-blue-100">${s.score}</span>
                    <span class="text-xs font-black text-blue-700">${window.studentText('Review →', 'Xem lại →')}</span>
                </div>
            </button>
        `).join('') : `<p class="text-sm text-slate-500 italic bg-white p-4 rounded-xl border border-slate-200 text-center">${window.studentText('No tests submitted yet.', 'Bạn chưa nộp bài thi nào.')}</p>`;
        content.innerHTML = `
            <div>
                <div class="mb-4">
                    <h3 class="font-black text-sm text-slate-400 uppercase tracking-widest mb-1 ml-1">${window.studentText('📝 Your test submissions', '📝 Các bài thi đã nộp')}</h3>
                    <p class="text-sm text-slate-500 ml-1">${window.studentText('Select any submission to review your answers and results.', 'Chọn bài đã nộp để xem lại câu trả lời và kết quả.')}</p>
                </div>
                <div class="max-h-full overflow-y-auto space-y-2">${subsHtml}</div>
            </div>
        `;
        
        modal.classList.remove('hidden');
    }

    // --- PUBLIC LANDING PAGE LOGIC ---
    window.openLightbox = function(src, e) {
        if (e) { e.preventDefault(); e.stopPropagation(); }
        const lb = document.getElementById('image-lightbox');
        const img = document.getElementById('lightbox-img');
        if(lb && img) {
            img.src = src;
            lb.classList.remove('hidden');
        }
    };

    window.tempPPHero = null;
    window.tempPPTrf = null;
    window.tempPPFeatures = [];
    window.tempPPAchievements = [];
    window.tempPPPdfs = [];
    window.tempPPHallOfFame = [];
    window.tempPPBio = '';
    window.tempPPSpecialties = [];
    window.tempPPCredentials = [];
    window.tempPPPhilosophy = '';
    window.tempPPClasses = [];
    window.tempPPServices = [];
    window.tempPPHighlights = [];
    // Local working copy for the editor

    // ✨ FIX: Fast, local Base64 compressor that completely bypasses Firebase Storage!
    // Firebase Storage sometimes hangs infinitely if unconfigured. This guarantees instant uploads.
    window.compressProfileImage = function(file, maxDim, quality, callback) {
        if (!file || !file.type.startsWith('image/')) return;
        const reader = new FileReader();
        reader.onload = (e) => {
            const img = new Image();
            img.onload = () => {
                const canvas = document.createElement('canvas');
                let w = img.width, h = img.height;
                if (w > h) {
                    if (w > maxDim) { h = Math.round((h * maxDim) / w); w = maxDim; }
                } else {
                    if (h > maxDim) { w = Math.round((w * maxDim) / h); h = maxDim; }
                }
                canvas.width = w; canvas.height = h;
                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0, w, h);
                
                // Instantly return heavily compressed local image data
                callback(canvas.toDataURL('image/jpeg', quality));
            };
            img.src = e.target.result;
        };
        reader.readAsDataURL(file);
    };
