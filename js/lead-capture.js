/**
 * Shared client-side helper to submit consultation leads from
 * index.html and placement-test.html to /api/lead-webhook.
 */
(function (global) {
  async function submitLeadConsultation(payload) {
    const response = await fetch('/api/lead-webhook', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload || {})
    });
    let data = {};
    try {
      data = await response.json();
    } catch (_) {
      data = {};
    }
    if (!response.ok || !data.ok) {
      throw new Error(data.error || 'Không thể gửi thông tin lúc này. Bạn vui lòng nhắn Zalo trực tiếp giúp thầy/cô nhé.');
    }
    return data;
  }

  async function handlePublicLeadFormSubmit(event) {
    event.preventDefault();
    const form = event.target;
    const nameEl = form.querySelector('#public-lead-name');
    const phoneEl = form.querySelector('#public-lead-phone');
    const targetEl = form.querySelector('#public-lead-target');
    const btn = form.querySelector('button[type="submit"]');
    const msg = document.getElementById('public-lead-msg');

    const name = (nameEl?.value || '').trim();
    const phone = (phoneEl?.value || '').trim();
    const targetBand = (targetEl?.value || '').trim();

    if (btn) {
      btn.disabled = true;
      btn.dataset.originalText = btn.textContent;
      btn.textContent = 'Đang gửi...';
    }
    if (msg) {
      msg.className = 'text-xs font-semibold text-blue-700 mt-1';
      msg.textContent = '';
      msg.classList.add('hidden');
    }

    try {
      await submitLeadConsultation({
        name,
        phone,
        targetBand,
        source: 'homepage'
      });
      form.reset();
      if (msg) {
        msg.className = 'text-xs font-bold text-emerald-700 mt-1';
        msg.textContent = 'Đã gửi thông tin thành công! Bộ phận tư vấn sẽ liên hệ bạn qua Zalo/SĐT trong ít phút.';
        msg.classList.remove('hidden');
      }
    } catch (err) {
      if (msg) {
        msg.className = 'text-xs font-bold text-rose-700 mt-1';
        msg.textContent = err.message || 'Gửi thất bại, vui lòng liên hệ Zalo 0913 980 712.';
        msg.classList.remove('hidden');
      }
    } finally {
      if (btn) {
        btn.disabled = false;
        btn.textContent = btn.dataset.originalText || 'Đăng ký tư vấn';
      }
    }
  }

  global.submitLeadConsultation = submitLeadConsultation;
  global.handlePublicLeadFormSubmit = handlePublicLeadFormSubmit;
})(typeof window !== 'undefined' ? window : globalThis);
