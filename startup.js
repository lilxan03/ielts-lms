    const manifestJSON = {
      "name": "Khanh LMS",
      "short_name": "IELTS App",
      "start_url": window.location.href.split('?')[0],
      "display": "standalone",
      "background_color": "#f4f7fb",
      "theme_color": "#1e3a8a",
      "icons": [{
        "src": "data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAxMDAgMTAwIj48cmVjdCB3aWR0aD0iMTAwIiBoZWlnaHQ9IjEwMCIgZmlsbD0iIzFlM2E4YSIvPjx0ZXh0IHg9IjUwIiB5PSI2NSIgZm9udC1mYW1pbHk9IkFyaWFsIiBmb250LXNpemU9IjUwIiBmb250LXdlaWdodD0iYm9sZCIgZmlsbD0id2hpdGUiIHRleHQtYW5jaG9yPSJtaWRkbGUiPkk8L3RleHQ+PC9zdmc+",
        "sizes": "512x512",
        "type": "image/svg+xml"
      }]
    };
    const startupBrandingCacheKey = 'ielts_lms_startup_branding';
    let manifestObjectUrl = null;
    window.applyStartupBranding = function(profile = {}) {
        const appName = String(profile.appName || '').trim() || 'Khanh LMS';
        const openingTitle = String(profile.openingTitle || '').trim() || 'Connecting to Cloud...';
        const openingMessage = String(profile.openingMessage || '').trim();
        const logoUrl = profile.appLogo || '';

        document.title = `${appName} - Cloud Connected`;
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

        manifestJSON.name = appName;
        manifestJSON.short_name = appName.slice(0, 20);
        const manifestLink = document.getElementById('pwa-manifest');
        if (manifestLink) {
            if (manifestObjectUrl) URL.revokeObjectURL(manifestObjectUrl);
            manifestObjectUrl = URL.createObjectURL(new Blob([JSON.stringify(manifestJSON)], {type: 'application/json'}));
            manifestLink.href = manifestObjectUrl;
        }
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
    document.addEventListener('DOMContentLoaded', () => {
        window.applyStartupBranding(cachedStartupBranding);
    });
    window.addEventListener('beforeunload', function (e) {
        if (document.getElementById('exam-ui') && !document.getElementById('exam-ui').classList.contains('hidden')) {
            if (!isPreviewMode && !isTimeFree) {
                e.preventDefault();
                e.returnValue = 'Are you sure you want to reload? Your exam progress will be lost.';
            }
        }
    });
