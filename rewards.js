    window.openGemStore = function() {
        if (!currentUser.inventory) currentUser.inventory = ['m_boy1', 'm_girl1', 'bg_def']; // Default free items
        if (!currentUser.equipped) currentUser.equipped = { mascot: 'm_boy1', clothes: null, bg: 'bg_def' };
        
        document.getElementById('shop-gem-balance').textContent = (currentUser.gems || 0).toLocaleString();
        document.getElementById('gem-store-modal').classList.remove('hidden');
        window.switchShopTab('mascots'); // Open mascots by default
    };

    // 3. Tab Navigation
    window.switchShopTab = function(tabName) {
        // Reset tabs
        document.querySelectorAll('.shop-tab-btn').forEach(btn => {
            btn.className = "shop-tab-btn text-center md:text-left px-4 py-3 rounded-xl font-bold text-sm transition-all text-slate-600 hover:bg-slate-200 whitespace-nowrap w-full";
        });
        
        // Highlight active tab
        const activeBtn = document.getElementById(`shop-tab-${tabName}`);
        if(activeBtn) {
            if(tabName === 'topup') activeBtn.className = "shop-tab-btn text-center md:text-left px-4 py-3 rounded-xl font-black text-sm transition-all text-amber-700 bg-amber-50 shadow-sm border border-amber-300 whitespace-nowrap w-full";
            else activeBtn.className = "shop-tab-btn text-center md:text-left px-4 py-3 rounded-xl font-bold text-sm transition-all bg-white shadow-sm border border-blue-500 text-blue-700 whitespace-nowrap w-full";
        }

        const content = document.getElementById('shop-content-area');
        
        // Render Top Up Screen (Legacy QR Logic)
        if (tabName === 'topup') {
            content.innerHTML = `
                <div class="max-w-2xl mx-auto">
                    <h3 class="text-xl font-black text-slate-800 mb-2">Buy Gems</h3>
                    <p class="text-sm text-slate-500 mb-6">Top up your balance instantly via QR code to buy premium mascots and themes.</p>
                    <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div onclick="window.generateGemQR(100, 10000)" class="bg-white border border-slate-200 hover:border-amber-400 p-4 rounded-xl cursor-pointer transition flex flex-col items-center group shadow-sm">
                            <div class="text-4xl mb-2 group-hover:scale-110 transition">💎</div>
                            <div class="font-black text-slate-800">100 Gems</div>
                            <div class="text-blue-600 font-bold mt-2 bg-blue-50 px-3 py-1 rounded w-full text-center">10,000 ₫</div>
                        </div>
                        <div onclick="window.generateGemQR(500, 45000)" class="bg-gradient-to-b from-white to-amber-50 border border-amber-300 hover:border-amber-500 p-4 rounded-xl cursor-pointer transition flex flex-col items-center group shadow-md relative">
                            <div class="absolute top-0 right-0 bg-amber-500 text-white text-[10px] font-black px-2 py-0.5 rounded-bl-lg">POPULAR</div>
                            <div class="text-4xl mb-2 group-hover:scale-110 transition">💰</div>
                            <div class="font-black text-slate-800">500 Gems</div>
                            <div class="text-blue-600 font-bold mt-2 bg-blue-50 px-3 py-1 rounded w-full text-center">45,000 ₫</div>
                        </div>
                    </div>
                    
                    <!-- QR Active State Container (Hidden by default) -->
                    <div id="gem-qr-active" class="hidden flex-col items-center w-full mt-8 bg-white p-6 rounded-2xl shadow-inner border border-slate-200">
                      <img id="gem-qr-img" src="" class="w-48 h-48 object-contain rounded-lg border border-slate-200 p-1 mb-4 shadow-sm">
                      <div class="font-black text-indigo-700 text-2xl mb-1" id="gem-qr-price">0 ₫</div>
                      <div class="text-xs text-slate-500 font-mono bg-slate-100 px-2 py-1 rounded text-center break-all" id="gem-qr-msg">Msg</div>
                      <button onclick="window.notifyGemPurchase()" id="btn-gem-paid" class="mt-4 w-full md:w-64 bg-emerald-500 hover:bg-emerald-600 text-white font-bold py-2.5 rounded-lg shadow-md transition">I Have Transferred ✓</button>
                    </div>
                </div>
            `;
            return;
        }

        // Render Shop Items (Mascots, Clothes, Backgrounds)
        const items = window.SHOP_DB[tabName];
        let itemsHtml = `<div class="grid grid-cols-2 lg:grid-cols-3 gap-4 pb-10">`;
        
        items.forEach(item => {
            const isOwned = currentUser.inventory.includes(item.id);
            const isEquipped = currentUser.equipped.mascot === item.id || currentUser.equipped.bg === item.id || currentUser.equipped.clothes === item.id;
            
            let btnHtml = '';
            if (isEquipped) {
                btnHtml = `<button class="w-full py-2 bg-slate-200 text-slate-500 font-bold rounded-lg cursor-not-allowed text-xs" disabled>Equipped</button>`;
            } else if (isOwned) {
                btnHtml = `<button onclick="window.equipItem('${item.id}', '${tabName}')" class="w-full py-2 bg-indigo-50 text-indigo-700 hover:bg-indigo-600 hover:text-white border border-indigo-200 font-bold rounded-lg transition shadow-sm text-xs">Equip Now</button>`;
            } else {
                btnHtml = `<button onclick="window.buyItem('${item.id}', ${item.price}, '${tabName}')" class="w-full py-2 bg-emerald-50 text-emerald-700 hover:bg-emerald-500 hover:text-white border border-emerald-200 font-bold rounded-lg transition shadow-sm text-xs flex justify-center items-center gap-1"><span class="text-[10px]">💎</span> ${item.price}</button>`;
            }

            // Display CSS block for Backgrounds, or Emojis/Images for Mascots/Clothes
            let visual = '';
            if (tabName === 'backgrounds') {
                visual = `<div class="w-16 h-16 rounded-lg ${item.css} mx-auto mb-3 shadow-inner border border-slate-200"></div>`;
            } else {
                // If it's a real image URL, render an img tag. Otherwise render the emoji.
                if (item.img.startsWith('http') || item.img.startsWith('data:')) {
                    visual = `<img src="${item.img}" class="w-16 h-16 mx-auto mb-3 object-contain drop-shadow-sm">`;
                } else {
                    visual = `<div class="text-5xl mx-auto mb-3 h-16 flex items-center justify-center">${item.img}</div>`;
                }
            }

            itemsHtml += `
            <div class="bg-white p-4 rounded-2xl border ${isEquipped ? 'border-indigo-400 shadow-md ring-2 ring-indigo-50' : 'border-slate-200 shadow-sm'} text-center flex flex-col justify-between transition-all hover:-translate-y-1">
                <div>
                    ${visual}
                    <h4 class="font-black text-slate-800 text-sm mb-1">${item.name}</h4>
                    <p class="text-[10px] text-slate-400 mb-4 h-8 overflow-hidden">${item.desc}</p>
                </div>
                ${btnHtml}
            </div>`;
        });
        
        itemsHtml += `</div>`;
        content.innerHTML = itemsHtml;
    };

    // 4. Buy Logic
    window.buyItem = function(itemId, price, tabName) {
        if ((currentUser.gems || 0) < price) {
            showModalMsg("Not Enough Gems", "You don't have enough gems to buy this! Complete more mock tests to earn gems, or click 'Get Gems' to top up.");
            return;
        }

        showConfirm("Confirm Purchase", `Spend ${price} 💎 to unlock this item?`, async () => {
            currentUser.gems -= price;
            currentUser.inventory.push(itemId);
            
            try {
                await window.fsSetDoc(window.fsDoc(window.db, window.fPath('users'), currentUser.user), currentUser);
                sessionStorage.setItem('ielts_session', JSON.stringify(currentUser));
                
                document.getElementById('shop-gem-balance').textContent = currentUser.gems.toLocaleString();
                window.updateDashboardHeader(); // Update visual balance on main screen
                window.switchShopTab(tabName); // Re-render tab to show "Equip" button
                
                window.playGemAnimation();
            } catch(e) {
                showModalMsg("Error", "Could not complete purchase. Connection failed.");
                currentUser.gems += price; // Rollback
                currentUser.inventory.pop();
            }
        });
    };

    // 5. Equip Logic
    window.equipItem = async function(itemId, tabName) {
        if (tabName === 'mascots') currentUser.equipped.mascot = itemId;
        if (tabName === 'clothes') currentUser.equipped.clothes = itemId;
        if (tabName === 'backgrounds') currentUser.equipped.bg = itemId;

        try {
            await window.fsSetDoc(window.fsDoc(window.db, window.fPath('users'), currentUser.user), currentUser);
            sessionStorage.setItem('ielts_session', JSON.stringify(currentUser));
            
            window.switchShopTab(tabName); // Re-render tab to show "Equipped" state
            window.applyStudentCustomizations(); // Apply changes visually to dashboard!
            
        } catch(e) {
            showModalMsg("Error", "Could not equip item.");
        }
    };

    // 6. Apply Customizations to Dashboard
    window.applyStudentCustomizations = function() {
        if (!currentUser || currentUser.role !== 'student') return;
        if (!currentUser.equipped) return;

        // 1. Change the top Banner Background
        const dashboardBanner = document.getElementById('student-banner-bg');
        if (dashboardBanner) {
            const bgItem = window.SHOP_DB.backgrounds.find(b => b.id === currentUser.equipped.bg);
            if (bgItem) {
                // Clear old classes and apply new
                dashboardBanner.className = `pt-8 pb-32 px-6 lg:px-8 shadow-inner relative overflow-hidden transition-all duration-1000 ${bgItem.css}`;
            }
        }

        // 2. Change the Mascot Avatar in the Header
        const avatarDisplay = document.getElementById('header-student-avatar');
        if (avatarDisplay) {
            const mascotItem = window.SHOP_DB.mascots.find(m => m.id === currentUser.equipped.mascot);
            const clothesItem = window.SHOP_DB.clothes.find(c => c.id === currentUser.equipped.clothes);
            
            if (mascotItem) {
                let visualHtml = `<div class="text-xl relative w-full h-full flex items-center justify-center">${mascotItem.img}</div>`;
                
                // Paper-doll Layering Logic!
                if (mascotItem.img.startsWith('http') || mascotItem.img.startsWith('data:')) {
                    let layeredHtml = `<img src="${mascotItem.img}" class="absolute inset-0 w-full h-full object-cover z-0">`;
                    if (clothesItem && (clothesItem.img.startsWith('http') || clothesItem.img.startsWith('data:'))) {
                        layeredHtml += `<img src="${clothesItem.img}" class="absolute inset-0 w-full h-full object-cover z-10 drop-shadow-sm">`;
                    } else if (clothesItem) {
                        // Emoji clothes fallback over image
                        layeredHtml += `<div class="absolute inset-0 w-full h-full flex items-center justify-center z-10 text-xs">${clothesItem.img}</div>`;
                    }
                    visualHtml = `<div class="relative w-full h-full">${layeredHtml}</div>`;
                } else if (clothesItem && !clothesItem.img.startsWith('http')) {
                    // Emoji on Emoji fallback
                    visualHtml = `<div class="text-2xl relative w-full h-full flex items-center justify-center">
                        <span class="z-0 absolute">${mascotItem.img}</span>
                        <span class="z-10 absolute text-sm transform translate-y-2 translate-x-2 drop-shadow">${clothesItem.img}</span>
                    </div>`;
                }

                avatarDisplay.outerHTML = `<div id="header-student-avatar" class="w-8 h-8 sm:w-9 sm:h-9 rounded-lg bg-white overflow-hidden shadow-sm border border-white/30 cursor-pointer flex-shrink-0" onclick="window.openStudentProfile()">${visualHtml}</div>`;
            }
        }
    };

    let pendingGemPurchase = null;
    window.generateGemQR = function(gems, priceVND) {
        pendingGemPurchase = { gems, price: priceVND };
        const msg = `${currentUser.user} BUY ${gems} GEMS`;
        
        if (BILLING_SETTINGS.customQR) {
            document.getElementById('gem-qr-img').src = BILLING_SETTINGS.customQR;
            document.getElementById('gem-qr-msg').textContent = "Use Custom QR above & ref: " + msg;
        } else {
            const qrUrl = `https://img.vietqr.io/image/${BILLING_SETTINGS.bankId}-${BILLING_SETTINGS.bankAcc}-compact2.png?amount=${priceVND}&addInfo=${encodeURIComponent(msg)}&accountName=${encodeURIComponent(BILLING_SETTINGS.bankName)}`;
            document.getElementById('gem-qr-img').src = qrUrl;
            document.getElementById('gem-qr-msg').textContent = msg;
        }
        
        document.getElementById('gem-qr-price').textContent = formatVND(priceVND);
        
        // Hide the packs, show the QR
        const content = document.getElementById('shop-content-area');
        content.innerHTML = `
            <div class="max-w-md mx-auto flex flex-col items-center bg-white p-6 rounded-2xl shadow-inner border border-slate-200">
              <h3 class="text-xl font-black text-slate-800 mb-4">Complete Payment</h3>
              <img id="gem-qr-img" src="${document.getElementById('gem-qr-img').src}" class="w-56 h-56 object-contain rounded-lg border border-slate-200 p-1 mb-4 shadow-sm">
              <div class="font-black text-indigo-700 text-3xl mb-1">${formatVND(priceVND)}</div>
              <div class="text-xs text-slate-500 font-mono bg-slate-100 px-3 py-1.5 rounded-lg text-center break-all mb-6 w-full shadow-inner border border-slate-200">Transfer Msg: <strong class="text-slate-800">${msg}</strong></div>
              <button onclick="window.notifyGemPurchase()" class="w-full bg-emerald-500 hover:bg-emerald-600 text-white font-bold py-3.5 rounded-xl shadow-md transition text-lg flex items-center justify-center gap-2">I Have Transferred ✓</button>
              <button onclick="window.switchShopTab('topup')" class="w-full bg-slate-100 hover:bg-slate-200 text-slate-600 font-bold py-2.5 rounded-xl shadow-sm transition mt-3 text-sm">Cancel</button>
            </div>
        `;
    };

    window.notifyGemPurchase = async function() {
        // Send a simulated request to teacher (saves to user profile pending state)
        currentUser.pendingInfo = `Top-Up ${pendingGemPurchase.gems} Gems`;
        currentUser.paymentStatus = 'pending';
        
        try {
            await window.fsSetDoc(window.fsDoc(window.db, window.fPath('users'), currentUser.user), currentUser);
            document.getElementById('gem-store-modal').classList.add('hidden');
            showModalMsg("Request Sent!", `Your request for ${pendingGemPurchase.gems} 💎 has been sent. Once the teacher verifies the transfer, your balance will update!`);
        } catch(e) {
            console.error(e);
            showModalMsg("Error", "Could not process request.");
        }
    };

    window.playGemAnimation = function() {
        const widget = document.getElementById('gem-balance-widget');
        if(!widget) return;
        widget.classList.add('scale-125', 'ring-4', 'ring-amber-400');
        setTimeout(() => {
            widget.classList.remove('scale-125', 'ring-4', 'ring-amber-400');
        }, 500);
    };

    window.unlockPremiumTest = function(tid, price, title) {
        if (!currentUser.gems) currentUser.gems = 0;
        if (!currentUser.unlockedTests) currentUser.unlockedTests = [];

        if (currentUser.gems < price) {
            showConfirm("Not Enough Gems", `You need ${price} 💎 to unlock "${title}". You currently have ${currentUser.gems} 💎. Would you like to visit the Store to get more?`, () => {
                window.openGemStore();
            });
            return;
        }

        showConfirm("Unlock Premium Content", `Spend ${price} 💎 to permanently unlock "${title}"?`, async () => {
            currentUser.gems -= price;
            currentUser.unlockedTests.push(tid);
            
            try {
                await window.fsSetDoc(window.fsDoc(window.db, window.fPath('users'), currentUser.user), currentUser);
                sessionStorage.setItem('ielts_session', JSON.stringify(currentUser));
                window.updateDashboardHeader();
                renderStudentDashboard(); // Re-render to remove lock!
                
                // Fancy animation!
                window.playGemAnimation();
            } catch(e) {
                showModalMsg("Error", "Could not unlock test due to connection issues.");
                // rollback
                currentUser.gems += price;
                currentUser.unlockedTests.pop();
            }
        });
    };

    // Replace editCurrentTestMeta to include the Price
    window.editCurrentTestMeta = function() {
      showTestMetaModal("Edit Test Settings", APP_DATA.title, (APP_DATA.topics || []).join(", "), APP_DATA.difficulty, APP_DATA.status, (title, topics, diff, status) => {
        APP_DATA.title = title;
        APP_DATA.topics = topics;
        APP_DATA.difficulty = diff;
        APP_DATA.status = status;
        APP_DATA.price = Number(document.getElementById('meta-price-input').value) || 0;
        document.getElementById('builder-test-name').textContent = title;
        triggerEditorAutosave();
      });
      // Populate the price field when opening
      document.getElementById('meta-price-input').value = APP_DATA.price || 0;
    };// Replace editCurrentTestMeta to include the Price and Bounties!
    window.editCurrentTestMeta = function() {
      showTestMetaModal("Edit Test Settings", APP_DATA.title, (APP_DATA.topics || []).join(", "), APP_DATA.difficulty, APP_DATA.status, (title, topics, diff, status) => {
        APP_DATA.title = title;
        APP_DATA.topics = topics;
        APP_DATA.difficulty = diff;
        APP_DATA.status = status;
        APP_DATA.price = Number(document.getElementById('meta-price-input').value) || 0;
        
        APP_DATA.assignee = document.getElementById('meta-assignee-input').value;
        APP_DATA.incentive = Number(document.getElementById('meta-incentive-input').value) || 0;
        
        if (status === 'approved' && !APP_DATA.approvedAt) APP_DATA.approvedAt = Date.now();

        document.getElementById('builder-test-name').textContent = title;
        triggerEditorAutosave();
      });
      
      // Populate the fields when opening
      document.getElementById('meta-price-input').value = APP_DATA.price || 0;
      
      const collabOpts = '<option value="">-- Unassigned --</option>' + USERS.filter(u => u.role === 'collaborator').map(u => `<option value="${u.user}">${u.user}</option>`).join('');
      document.getElementById('meta-assignee-input').innerHTML = collabOpts;
      document.getElementById('meta-assignee-input').value = APP_DATA.assignee || '';
      document.getElementById('meta-incentive-input').value = APP_DATA.incentive || '';
    };

    // ==========================================
    // ✨ UPCOMING CLASS REMINDER ENGINE
    // ==========================================
    window.notifiedClasses = new Set();
    
