/**
 * Vercel Serverless Function: Receive consultation lead submissions from
 * placement-test.html and index.html, then forward instant notifications to
 * Telegram and/or a generic webhook (e.g., Google Sheets Apps Script / Zalo OA).
 *
 * Environment Variables (configure in Vercel Project Settings):
 * - TELEGRAM_BOT_TOKEN : Bot token from @BotFather
 * - TELEGRAM_CHAT_ID   : Target chat/group ID for admissions notifications
 * - LEAD_WEBHOOK_URL   : Optional webhook URL (Google Apps Script, Make, Zapier, etc.)
 */

function cleanText(value, maxLen = 200) {
  return String(value == null ? '' : value)
    .replace(/[\r\n\t]+/g, ' ')
    .trim()
    .slice(0, maxLen);
}

function escapeTelegramHtml(text) {
  return String(text || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

async function parseJsonBody(req) {
  if (req.body && typeof req.body === 'object') return req.body;
  if (typeof req.body === 'string' && req.body.trim()) {
    return JSON.parse(req.body);
  }
  const chunks = [];
  for await (const chunk of req) {
    chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : chunk);
  }
  const raw = Buffer.concat(chunks).toString('utf8').trim();
  return raw ? JSON.parse(raw) : {};
}

function formatTelegramMessage(lead) {
  const lines = [
    '🔥 <b>LEAD TƯ VẤN MỚI — IELTS W KHANH</b>',
    `👤 <b>Họ tên:</b> ${escapeTelegramHtml(lead.name)}`,
    `📞 <b>SĐT / Zalo:</b> <code>${escapeTelegramHtml(lead.phone)}</code>`,
    `🎯 <b>Band mục tiêu:</b> ${escapeTelegramHtml(lead.targetBand || 'Chưa nhập')}`,
    `📍 <b>Nguồn:</b> ${escapeTelegramHtml(lead.source)}`
  ];
  if (lead.placementBand) {
    lines.push(`📝 <b>Mini Test:</b> ${escapeTelegramHtml(lead.placementBand)} (${escapeTelegramHtml(lead.placementScore)})`);
  }
  if (lead.recommendedClass) {
    lines.push(`🏫 <b>Gợi ý lớp:</b> ${escapeTelegramHtml(lead.recommendedClass)}`);
  }
  if (lead.note) {
    lines.push(`💬 <b>Ghi chú:</b> ${escapeTelegramHtml(lead.note)}`);
  }
  lines.push(`⏰ <b>Thời gian:</b> ${escapeTelegramHtml(lead.createdAtVi)}`);
  return lines.join('\n');
}

async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }
  if (req.method !== 'POST') {
    return res.status(405).json({ ok: false, error: 'Method not allowed' });
  }

  let body;
  try {
    body = await parseJsonBody(req);
  } catch {
    return res.status(400).json({ ok: false, error: 'Invalid JSON body' });
  }

  const name = cleanText(body.name, 120);
  const phone = cleanText(body.phone, 40);
  if (!name || !phone || phone.replace(/\D/g, '').length < 8) {
    return res.status(400).json({
      ok: false,
      error: 'Vui lòng nhập đầy đủ họ tên và số điện thoại/Zalo hợp lệ.'
    });
  }

  const now = new Date();
  const lead = {
    name,
    phone,
    targetBand: cleanText(body.targetBand, 40),
    source: cleanText(body.source || 'website', 60),
    placementScore: cleanText(body.placementScore, 30),
    placementBand: cleanText(body.placementBand, 30),
    recommendedClass: cleanText(body.recommendedClass, 80),
    note: cleanText(body.note, 300),
    createdAt: now.toISOString(),
    createdAtVi: now.toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' })
  };

  const botToken = cleanText(process.env.TELEGRAM_BOT_TOKEN, 200);
  const chatId = cleanText(process.env.TELEGRAM_CHAT_ID, 100);
  const webhookUrl = cleanText(process.env.LEAD_WEBHOOK_URL, 500);

  const tasks = [];
  const channels = [];

  if (botToken && chatId) {
    channels.push('telegram');
    tasks.push(
      fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: chatId,
          text: formatTelegramMessage(lead),
          parse_mode: 'HTML',
          disable_web_page_preview: true
        })
      }).then(async (r) => {
        if (!r.ok) {
          throw new Error(`Telegram HTTP ${r.status}`);
        }
        return 'telegram';
      })
    );
  }

  if (webhookUrl) {
    channels.push('webhook');
    tasks.push(
      fetch(webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(lead)
      }).then(async (r) => {
        if (!r.ok) {
          throw new Error(`Webhook HTTP ${r.status}`);
        }
        return 'webhook';
      })
    );
  }

  if (tasks.length === 0) {
    return res.status(200).json({
      ok: true,
      configured: false,
      delivered: [],
      lead
    });
  }

  const results = await Promise.allSettled(tasks);
  const delivered = results
    .filter((r) => r.status === 'fulfilled')
    .map((r) => r.value);
  const errors = results
    .filter((r) => r.status === 'rejected')
    .map((r) => r.reason?.message || 'Delivery failed');

  if (delivered.length === 0) {
    return res.status(502).json({
      ok: false,
      configured: true,
      delivered: [],
      errors
    });
  }

  return res.status(200).json({
    ok: true,
    configured: true,
    delivered,
    errors: errors.length ? errors : undefined
  });
}

module.exports = handler;
module.exports.formatTelegramMessage = formatTelegramMessage;
