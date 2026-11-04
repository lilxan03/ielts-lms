const imageLightbox = document.getElementById('image-lightbox');

imageLightbox?.addEventListener('click', () => {
    imageLightbox.classList.add('hidden');
});

document.getElementById('auth-form')?.addEventListener('submit', event => {
    event.preventDefault();
    window.handleAuthSubmit();
});

document.addEventListener('click', event => {
    const button = event.target.closest('button[data-auth-action]');
    if (!button) return;

    switch (button.dataset.authAction) {
        case 'home':
            window.goToAppHome('student');
            break;
        case 'toggle-password':
            window.togglePasswordVisibility('auth-pass', button);
            break;
        case 'forgot-password':
            window.promptForgotPassword();
            break;
        case 'google-login':
            window.handleGoogleLogin();
            break;
        case 'demo-login':
            window.loginAsDemo();
            break;
        case 'toggle-mode':
            window.toggleAuthMode();
            break;
    }
});

let testModeReturnFocus = null;
const testModeModal = document.getElementById('test-mode-modal');
const focusableTestModeControls = () => Array.from(
    testModeModal?.querySelectorAll('button:not(:disabled), input:not(:disabled), [href], [tabindex]:not([tabindex="-1"])') || []
).filter(control => !control.closest('.hidden'));

window.focusTestModeDialog = opener => {
    testModeReturnFocus = opener && opener !== document.body ? opener : null;
    testModeModal?.querySelector('[data-test-action="select-mode"]')?.focus();
};

window.clearTestModeDialogFocus = () => {
    testModeReturnFocus = null;
};

window.restoreTestModeDialogFocus = () => {
    const opener = testModeReturnFocus;
    testModeReturnFocus = null;
    if (opener?.isConnected && !opener.disabled && !opener.closest?.('.hidden')) opener.focus();
};

testModeModal?.addEventListener('keydown', event => {
    if (event.key === 'Escape') {
        event.preventDefault();
        window.cancelTestRouteStart();
        return;
    }

    if (event.key !== 'Tab') return;
    const controls = focusableTestModeControls();
    if (!controls.length) {
        event.preventDefault();
        testModeModal.focus();
        return;
    }

    const first = controls[0];
    const last = controls[controls.length - 1];
    if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
    }
});

document.addEventListener('click', event => {
    const button = event.target.closest('button[data-test-action]');
    if (!button) return;

    switch (button.dataset.testAction) {
        case 'select-mode':
            window.selectTestMode(button.dataset.mode);
            break;
        case 'cancel':
            window.cancelTestRouteStart();
            break;
        case 'start':
            window.confirmStartTest();
            break;
        case 'activities':
            window.openTestActivities();
            break;
    }
});
