    const startupBrandingCacheKey = 'ielts_lms_startup_branding';
    window.applyStartupBranding = function(profile = {}) {
        const appName = String(profile.appName || '').trim() || 'Khanh LMS';
        const openingTitle = String(profile.openingTitle || '').trim() || 'Connecting to Cloud...';
        const openingMessage = String(profile.openingMessage || '').trim();
        const logoUrl = profile.appLogo || '';

        document.title = `${appName} | Khóa học IELTS`;
        const appNameElement = document.getElementById('startup-app-name');
        if (appNameElement) appNameElement.textContent = appName;
        const openingTitleElement = document.getElementById('startup-opening-title');
        if (openingTitleElement) openingTitleElement.textContent = openingTitle;
        const openingMessageElement = document.getElementById('startup-opening-message');
        if (openingMessageElement) {
            openingMessageElement.textContent = openingMessage;
            openingMessageElement.classList.toggle('hidden', !openingMessage);
        }
        const startupLogo = document.getElementById('startup-app-logo');
        if (startupLogo) {
            startupLogo.src = logoUrl;
            startupLogo.classList.toggle('hidden', !logoUrl);
        }
        const authText = document.getElementById('app-logo-auth-text');
        if (authText) authText.textContent = appName;

    };
    window.cacheStartupBranding = function(profile) {
        const branding = {
            appName: profile.appName || '',
            openingTitle: profile.openingTitle || '',
            openingMessage: profile.openingMessage || '',
            appLogo: profile.appLogo || null
        };
        try {
            localStorage.setItem(startupBrandingCacheKey, JSON.stringify(branding));
        } catch (error) {
            console.warn('Could not cache startup branding locally.', error);
        }
        window.applyStartupBranding(branding);
    };
    let cachedStartupBranding = {};
    try {
        const savedBranding = JSON.parse(localStorage.getItem(startupBrandingCacheKey) || '{}');
        if (savedBranding && typeof savedBranding === 'object' && !Array.isArray(savedBranding)) {
            cachedStartupBranding = savedBranding;
        }
    } catch (error) {
        console.warn('Could not read cached startup branding.', error);
    }
    let deferredInstallPrompt = null;
    const isIosDevice = () => /iPad|iPhone|iPod/.test(navigator.userAgent) ||
        (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
    const isAndroidDevice = () => /android/i.test(navigator.userAgent);
    const isAppInstalled = () => window.matchMedia('(display-mode: standalone)').matches ||
        navigator.standalone === true;
    const isFullScreenActivityOpen = () => ['exam-ui', 'review-ui'].some(id => {
        const element = document.getElementById(id);
        return element && !element.classList.contains('hidden');
    });
    const updateInstallButton = () => {
        const banner = document.getElementById('pwa-install-banner');
        const button = document.getElementById('pwa-install-button');
        const apkLink = document.getElementById('android-apk-download');
        apkLink?.classList.toggle('hidden', !isAndroidDevice() || isFullScreenActivityOpen());
        if (!banner || !button || isAppInstalled() || isFullScreenActivityOpen()) {
            banner?.classList.add('hidden');
            return;
        }
        if (deferredInstallPrompt || isIosDevice()) {
            banner.classList.remove('hidden');
            button.textContent = isIosDevice() ? 'Cách cài ứng dụng' : 'Cài ứng dụng';
        } else {
            banner.classList.add('hidden');
        }
    };

    window.addEventListener('beforeinstallprompt', event => {
        event.preventDefault();
        deferredInstallPrompt = event;
        updateInstallButton();
    });
    window.addEventListener('appinstalled', () => {
        deferredInstallPrompt = null;
        updateInstallButton();
    });

    document.addEventListener('DOMContentLoaded', () => {
        window.applyStartupBranding(cachedStartupBranding);
        updateInstallButton();
        const installButtonObserver = new MutationObserver(updateInstallButton);
        ['exam-ui', 'review-ui'].forEach(id => {
            const element = document.getElementById(id);
            if (element) installButtonObserver.observe(element, { attributes: true, attributeFilter: ['class'] });
        });
        document.getElementById('pwa-install-button')?.addEventListener('click', async () => {
            if (deferredInstallPrompt) {
                deferredInstallPrompt.prompt();
                await deferredInstallPrompt.userChoice;
                deferredInstallPrompt = null;
                updateInstallButton();
            } else if (isIosDevice()) {
                window.alert('Để cài ứng dụng trên iPhone/iPad: nhấn nút Chia sẻ trong Safari, sau đó chọn “Thêm vào màn hình chính”.');
            }
        });
    });
    window.addEventListener('beforeunload', function (e) {
        if (document.getElementById('exam-ui') && !document.getElementById('exam-ui').classList.contains('hidden')) {
            if (!isPreviewMode && !isTimeFree) {
                e.preventDefault();
                e.returnValue = 'Are you sure you want to reload? Your exam progress will be lost.';
            }
        }
    });
