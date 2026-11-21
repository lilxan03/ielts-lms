const test = require('node:test');
const assert = require('node:assert/strict');
const handler = require('../api/lead-webhook.js');

function createMockRes() {
  return {
    statusCode: 200,
    headers: {},
    body: null,
    setHeader(k, v) {
      this.headers[k] = v;
    },
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(payload) {
      this.body = payload;
      return this;
    },
    end() {
      return this;
    }
  };
}

test('lead-webhook rejects non-POST requests with 405', async () => {
  const res = createMockRes();
  await handler({ method: 'GET' }, res);
  assert.equal(res.statusCode, 405);
  assert.equal(res.body.ok, false);
});

test('lead-webhook validates missing name or invalid phone', async () => {
  const res = createMockRes();
  await handler({ method: 'POST', body: { name: 'Minh', phone: '123' } }, res);
  assert.equal(res.statusCode, 400);
  assert.equal(res.body.ok, false);
});

test('lead-webhook dispatches to Telegram and LEAD_WEBHOOK_URL when configured', async () => {
  const prevEnv = {
    TELEGRAM_BOT_TOKEN: process.env.TELEGRAM_BOT_TOKEN,
    TELEGRAM_CHAT_ID: process.env.TELEGRAM_CHAT_ID,
    LEAD_WEBHOOK_URL: process.env.LEAD_WEBHOOK_URL
  };
  const prevFetch = global.fetch;
  const calls = [];

  process.env.TELEGRAM_BOT_TOKEN = 'test-bot-token';
  process.env.TELEGRAM_CHAT_ID = '-100999888';
  process.env.LEAD_WEBHOOK_URL = 'https://script.google.com/macros/s/test/exec';
  global.fetch = async (url, opts) => {
    calls.push({ url, body: JSON.parse(opts.body) });
    return { ok: true, status: 200 };
  };

  try {
    const res = createMockRes();
    await handler(
      {
        method: 'POST',
        body: {
          name: 'Nguyễn Văn A',
          phone: '0913980712',
          targetBand: '7.0',
          source: 'placement-test',
          placementScore: '8/10',
          placementBand: 'Band 7.0',
          recommendedClass: 'Bands 6.5 - 7.5 (C1)'
        }
      },
      res
    );

    assert.equal(res.statusCode, 200);
    assert.equal(res.body.ok, true);
    assert.equal(res.body.configured, true);
    assert.deepEqual(res.body.delivered, ['telegram', 'webhook']);
    assert.equal(calls.length, 2);
    assert.match(calls[0].url, /api\.telegram\.org\/bottest-bot-token\/sendMessage/);
    assert.match(calls[0].body.text, /Nguyễn Văn A/);
    assert.match(calls[0].body.text, /Band 7\.0/);
    assert.equal(calls[1].url, 'https://script.google.com/macros/s/test/exec');
    assert.equal(calls[1].body.phone, '0913980712');
    assert.equal(calls[1].body.source, 'placement-test');
  } finally {
    global.fetch = prevFetch;
    for (const [k, v] of Object.entries(prevEnv)) {
      if (v === undefined) delete process.env[k];
      else process.env[k] = v;
    }
  }
});

test('lead-webhook succeeds gracefully when env vars are not configured yet', async () => {
  const prevEnv = {
    TELEGRAM_BOT_TOKEN: process.env.TELEGRAM_BOT_TOKEN,
    TELEGRAM_CHAT_ID: process.env.TELEGRAM_CHAT_ID,
    LEAD_WEBHOOK_URL: process.env.LEAD_WEBHOOK_URL
  };
  delete process.env.TELEGRAM_BOT_TOKEN;
  delete process.env.TELEGRAM_CHAT_ID;
  delete process.env.LEAD_WEBHOOK_URL;

  try {
    const res = createMockRes();
    await handler({ method: 'POST', body: { name: 'Lan', phone: '0901234567', source: 'homepage' } }, res);
    assert.equal(res.statusCode, 200);
    assert.equal(res.body.ok, true);
    assert.equal(res.body.configured, false);
    assert.deepEqual(res.body.delivered, []);
  } finally {
    for (const [k, v] of Object.entries(prevEnv)) {
      if (v === undefined) delete process.env[k];
      else process.env[k] = v;
    }
  }
});

test('lead-capture Mini CRM stores, updates status, and deletes consultation leads', () => {
  const fs = require('node:fs');
  const path = require('node:path');
  const vm = require('node:vm');

  const store = new Map();
  const context = {
    localStorage: {
      getItem: (k) => (store.has(k) ? store.get(k) : null),
      setItem: (k, v) => store.set(k, String(v))
    }
  };
  context.window = context;
  vm.createContext(context);
  const code = fs.readFileSync(path.join(__dirname, '..', 'js', 'lead-capture.js'), 'utf8');
  vm.runInContext(code, context);

  const saved = context.saveLeadBackup({
    name: 'Trần Minh',
    phone: '0987654321',
    targetBand: '6.5',
    source: 'placement-test',
    placementScore: '7/10',
    placementBand: 'Band 6.0 – 6.5'
  });

  assert.equal(context.getConsultationLeads().length, 1);
  assert.equal(context.getConsultationLeads()[0].status, 'new');

  context.updateConsultationLeadStatus(saved.id, 'contacted');
  assert.equal(context.getConsultationLeads()[0].status, 'contacted');

  context.deleteConsultationLead(saved.id);
  assert.equal(context.getConsultationLeads().length, 0);
});
