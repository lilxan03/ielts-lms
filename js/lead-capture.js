/**
 * Shared client-side helper to submit consultation leads from
 * index.html, placement-test.html, and SEO demo pages to /api/lead-webhook,
 * while also persisting leads locally & to Firestore for the Teacher Mini CRM.
 */
(function (global) {
  const STORAGE_KEY = 'ielts_consultation_leads_v1';

  function escapeHtml(value) {
    return String(value == null ? '' : value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function readLocalLeads() {
    try {
      const raw = global.localStorage ? global.localStorage.getItem(STORAGE_KEY) : null;
      const parsed = raw ? JSON.parse(raw) : [];
      return Array.isArray(parsed) ? parsed : [];
    } catch (_) {
      return [];
    }
  }

  function writeLocalLeads(leads) {
    try {
      if (global.localStorage) {
        global.localStorage.setItem(STORAGE_KEY, JSON.stringify(leads.slice(0, 500)));
      }
    } catch (_) {
      // ignore storage quota errors
    }
  }

  function saveLeadBackup(payload) {
    const now = new Date();
    const record = {
      id: 'lead_' + now.getTime() + '_' + Math.random().toString(36).slice(2, 7),
      name: String(payload?.name || '').trim(),
      phone: String(payload?.phone || '').trim(),
      targetBand: String(payload?.targetBand || '').trim(),
      source: String(payload?.source || 'website').trim(),
      placementScore: String(payload?.placementScore || '').trim(),
      placementBand: String(payload?.placementBand || '').trim(),
      recommendedClass: String(payload?.recommendedClass || '').trim(),
      status: 'new',
      createdAt: now.toISOString(),
      createdAtVi: now.toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' })
    };
    const leads = readLocalLeads();
    leads.unshift(record);
    writeLocalLeads(leads);

    try {
      if (global.db && typeof global.db.collection === 'function') {
        global.db.collection('consultation_leads').doc(record.id).set(record).catch(() => {});
      }
    } catch (_) {
      // best-effort cloud persistence
    }

    if (typeof global.renderConsultationLeadsCRM === 'function') {
      global.renderConsultationLeadsCRM();
    }
    if (typeof global.updateTeacherBadges === 'function') {
      global.updateTeacherBadges();
    }
    return record;
  }

  async function submitLeadConsultation(payload) {
    const name = String(payload?.name || '').trim();
    const phone = String(payload?.phone || '').trim();
    if (!name || phone.replace(/\D/g, '').length < 8) {
      throw new Error('Vui lòng nhập đầy đủ họ tên và số điện thoại/Zalo hợp lệ.');
    }

    const record = saveLeadBackup(payload);

    const response = await fetch('/api/lead-webhook', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...(payload || {}), id: record.id })
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

  function updateConsultationLeadStatus(leadId, status) {
    const leads = readLocalLeads().map((item) =>
      item.id === leadId ? { ...item, status: String(status || 'new') } : item
    );
    writeLocalLeads(leads);
    try {
      if (global.db && typeof global.db.collection === 'function') {
        global.db.collection('consultation_leads').doc(leadId).update({ status }).catch(() => {});
      }
    } catch (_) {}
    renderConsultationLeadsCRM();
    if (typeof global.updateTeacherBadges === 'function') global.updateTeacherBadges();
  }

  function deleteConsultationLead(leadId) {
    const leads = readLocalLeads().filter((item) => item.id !== leadId);
    writeLocalLeads(leads);
    try {
      if (global.db && typeof global.db.collection === 'function') {
        global.db.collection('consultation_leads').doc(leadId).delete().catch(() => {});
      }
    } catch (_) {}
    renderConsultationLeadsCRM();
    if (typeof global.updateTeacherBadges === 'function') global.updateTeacherBadges();
  }

  function exportConsultationLeadsCSV() {
    const leads = readLocalLeads();
    const header = ['ThoiGian', 'HoTen', 'SDT_Zalo', 'BandMucTieu', 'Nguon', 'KetQuaMiniTest', 'LopGoiY', 'TrangThai'];
    const rows = leads.map((l) => [
      l.createdAtVi || l.createdAt || '',
      l.name || '',
      l.phone || '',
      l.targetBand || '',
      l.source || '',
      l.placementBand ? `${l.placementBand} (${l.placementScore || ''})` : '',
      l.recommendedClass || '',
      l.status || 'new'
    ]);
    const csv = [header, ...rows]
      .map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(','))
      .join('\n');
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `consultation-leads-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  function renderConsultationLeadsCRM() {
    if (typeof document === 'undefined') return;
    const container = document.getElementById('consultation-leads-tbody');
    const badge = document.getElementById('consultation-leads-count');
    if (!container) return;

    const leads = readLocalLeads();
    if (badge) badge.textContent = String(leads.length);

    if (!leads.length) {
      container.innerHTML = `
        <tr>
          <td colspan="6" class="px-4 py-8 text-center text-sm text-slate-400 font-medium">
            Chưa có học viên nào gửi form tư vấn trên thiết bị này. Khi khách điền form ở Trang chủ, Mini Placement Test hoặc các trang SEO, dữ liệu sẽ hiển thị tại đây và bắn về Telegram/Webhook.
          </td>
        </tr>`;
      return;
    }

    container.innerHTML = leads
      .map((lead) => {
        const status = lead.status || 'new';
        const badgeColor =
          status === 'enrolled'
            ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
            : status === 'contacted'
            ? 'bg-amber-50 text-amber-700 border-amber-200'
            : 'bg-blue-50 text-blue-700 border-blue-200';
        const placementInfo = lead.placementBand
          ? `<span class="inline-block rounded-md bg-indigo-50 px-2 py-0.5 text-xs font-bold text-indigo-700">${escapeHtml(lead.placementBand)} (${escapeHtml(lead.placementScore)})</span>`
          : '<span class="text-xs text-slate-400">—</span>';

        return `
          <tr class="border-b border-slate-100 hover:bg-slate-50/70">
            <td class="px-4 py-3 text-xs text-slate-500 whitespace-nowrap">${escapeHtml(lead.createdAtVi || lead.createdAt)}</td>
            <td class="px-4 py-3 text-sm font-bold text-slate-900">${escapeHtml(lead.name)}</td>
            <td class="px-4 py-3 text-sm font-semibold text-blue-700">
              <a href="https://zalo.me/${encodeURIComponent(String(lead.phone || '').replace(/\D/g, ''))}" target="_blank" rel="noopener noreferrer" class="hover:underline">${escapeHtml(lead.phone)}</a>
            </td>
            <td class="px-4 py-3 text-xs text-slate-700">
              <div>Mục tiêu: <strong>${escapeHtml(lead.targetBand || '—')}</strong></div>
              <div class="text-[11px] text-slate-400">Nguồn: ${escapeHtml(lead.source || 'website')}</div>
            </td>
            <td class="px-4 py-3 text-xs">${placementInfo}</td>
            <td class="px-4 py-3 text-xs whitespace-nowrap">
              <select onchange="window.updateConsultationLeadStatus('${escapeHtml(lead.id)}', this.value)" class="rounded-lg border px-2 py-1 text-xs font-bold ${badgeColor}">
                <option value="new" ${status === 'new' ? 'selected' : ''}>🔵 Mới</option>
                <option value="contacted" ${status === 'contacted' ? 'selected' : ''}>🟡 Đã liên hệ</option>
                <option value="enrolled" ${status === 'enrolled' ? 'selected' : ''}>🟢 Đã xếp lớp</option>
              </select>
              <button type="button" onclick="window.deleteConsultationLead('${escapeHtml(lead.id)}')" class="ml-2 text-rose-500 hover:text-rose-700 font-bold" title="Xóa">✕</button>
            </td>
          </tr>`;
      })
      .join('');
  }

  if (typeof document !== 'undefined') {
    document.addEventListener('DOMContentLoaded', () => {
      renderConsultationLeadsCRM();
    });
  }

  global.getConsultationLeads = readLocalLeads;
  global.saveLeadBackup = saveLeadBackup;
  global.submitLeadConsultation = submitLeadConsultation;
  global.handlePublicLeadFormSubmit = handlePublicLeadFormSubmit;
  global.updateConsultationLeadStatus = updateConsultationLeadStatus;
  global.deleteConsultationLead = deleteConsultationLead;
  global.exportConsultationLeadsCSV = exportConsultationLeadsCSV;
  global.renderConsultationLeadsCRM = renderConsultationLeadsCRM;
})(typeof window !== 'undefined' ? window : globalThis);
