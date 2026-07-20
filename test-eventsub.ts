import { NextRequest } from 'next/server';
import { sharedSubscribeHandler } from './src/lib/twitch-eventsub';
import assert from 'node:assert';

// We mock process.env variables needed for next/server and lib
process.env.TWITCH_CLIENT_ID = 'test_client';
process.env.TWITCH_CLIENT_SECRET = 'test_secret_long_enough123456';
process.env.SUPABASE_URL = 'https://mock.supabase.co';
process.env.SUPABASE_SERVICE_ROLE_KEY = 'mock_key';

let fetchMocks: any[] = [];
let fetchCalls: any[] = [];

global.fetch = async (url: any, options: any) => {
  const urlStr = url.toString();
  fetchCalls.push({ url: urlStr, options });
  
  if (urlStr.includes('supabase.co')) {
    const headers = new Headers({ 'content-type': 'application/json' });
    if (urlStr.includes('rpc/try_acquire_eventsub_lease')) {
       return { ok: true, status: 200, headers, json: async () => true, text: async () => 'true' } as any;
    }
    if (urlStr.includes('rpc/release_eventsub_lease')) {
       return { ok: true, status: 200, headers, json: async () => true, text: async () => 'true' } as any;
    }
    if (urlStr.includes('twitch_eventsub_subscriptions')) {
       return { ok: true, status: 200, headers, json: async () => ([{ status: 'enabled', twitch_subscription_id: 'sub-1' }]), text: async () => '[{"status":"enabled"}]' } as any;
    }
    return { ok: true, status: 200, headers, json: async () => ({}), text: async () => '{}' } as any;
  }

  const headers = new Headers({ 'content-type': 'application/json' });
  if (urlStr.includes('id.twitch.tv/oauth2/token')) {
    return { ok: true, status: 200, headers, json: async () => ({ access_token: 'app_token_123' }), text: async () => '{"access_token":"app_token_123"}' } as any;
  }

  if (urlStr.includes('api.twitch.tv/helix/users')) {
    return { ok: true, status: 200, headers, json: async () => ({ data: [{ id: 'user_123' }] }), text: async () => '{"data":[{"id":"user_123"}]}' } as any;
  }

  // Pop the next specific mock
  const mock = fetchMocks.shift();
  if (mock) {
    if (mock instanceof Error) throw mock;
    if (typeof mock === 'function') {
      const res = mock(urlStr, options);
      if (res instanceof Error) throw res;
      return res;
    }
    return {
      ok: mock.ok ?? true,
      status: mock.status ?? 200,
      headers: new Headers({ 'content-type': 'application/json' }),
      json: async () => mock.body,
      text: async () => JSON.stringify(mock.body),
    } as any;
  }

  return { ok: true, json: async () => ({}) } as any;
};

async function runTests() {
  console.log('--- Running Tests ---');
  let failedTests = 0;

  // Helper to create req
  const createReq = (mode = 'ensure') => {
    const req = new NextRequest(`https://paracetamolhaze.ru/api/cs2/subscribe?mode=${mode}`, {
      headers: new Headers({
        'cookie': 'twitch_token=user_token_123',
        'host': 'paracetamolhaze.ru',
        'x-forwarded-proto': 'https'
      })
    });
    return req;
  };

  // Test 1: 403 during POST triggers rollback
  try {
    fetchCalls = [];
    fetchMocks = [
      // GET subs
      { ok: true, body: { data: [{ id: 'old_sub_id', status: 'enabled', type: 'channel.channel_points_custom_reward_redemption.add', condition: { broadcaster_user_id: 'user_123' }, transport: { method: 'webhook', callback: 'https://paracetamolhaze-six.vercel.app/api/cs2/webhook' } }] } },
      // DELETE old sub (since we are on .ru and it's on .vercel.app)
      { ok: true, body: {} },
      // POST new sub on .ru -> FAILS WITH 403
      { ok: false, status: 403, body: { message: 'Forbidden' } },
      // ROLLBACK POST to old callback
      { ok: true, status: 202, body: { data: [{ id: 'restored_sub_id' }] } }
    ];

    const req = createReq('reconnect');
    const res = await sharedSubscribeHandler(req, '/api/cs2/webhook');
    const data = await res.json();
    console.log('DATA 1:', data);
    
    assert.strictEqual(data.success, false, 'Should be false on 403');
    assert.strictEqual(data.rollbackRestored, true, 'Rollback should be restored');
    
    const delCall = fetchCalls.find(c => c.url.includes('id=old_sub_id') && c.options?.method === 'DELETE');
    assert.ok(delCall, 'Old sub should be deleted');
    const rollbackCall = fetchCalls.find(c => c.url.includes('eventsub/subscriptions') && c.options?.method === 'POST' && JSON.parse(c.options.body).transport.callback.includes('vercel.app'));
    assert.ok(rollbackCall, 'Rollback POST should be called');
    console.log('✅ 403 triggers rollback');
  } catch (err: any) {
    console.error('❌ Test 1 failed:', err.message);
    failedTests++;
  }

  // Test 2: Network exception triggers rollback
  try {
    fetchCalls = [];
    fetchMocks = [
      { ok: true, body: { data: [{ id: 'old_sub_id', status: 'enabled', type: 'channel.channel_points_custom_reward_redemption.add', condition: { broadcaster_user_id: 'user_123' }, transport: { method: 'webhook', callback: 'https://paracetamolhaze-six.vercel.app/api/cs2/webhook' } }] } },
      { ok: true, body: {} }, // DELETE
      new Error('Network connection dropped!'), // POST new sub throws Error
      { ok: true, status: 202, body: { data: [{ id: 'restored_sub_id' }] } } // Rollback POST
    ];

    const req = createReq('reconnect');
    const res = await sharedSubscribeHandler(req, '/api/cs2/webhook');
    const data = await res.json();
    console.log('DATA 2:', data);
    
    assert.strictEqual(data.success, false);
    assert.strictEqual(data.rollbackRestored, true);
    console.log('✅ Network exception triggers rollback');
  } catch (err: any) {
    console.error('❌ Test 2 failed:', err.message);
    failedTests++;
  }

  // Test 3: Multiple subs, additional deleted, /api/ov_webhook ignored
  try {
    fetchCalls = [];
    fetchMocks = [
      { ok: true, body: { data: [
        { id: 'old_sub_active', status: 'enabled', type: 'channel.channel_points_custom_reward_redemption.add', condition: { broadcaster_user_id: 'user_123' }, transport: { method: 'webhook', callback: 'https://paracetamolhaze-six.vercel.app/api/cs2/webhook' } },
        { id: 'broken_sub_1', status: 'pending', type: 'channel.channel_points_custom_reward_redemption.add', condition: { broadcaster_user_id: 'user_123' }, transport: { method: 'webhook', callback: 'https://paracetamolhaze-six.vercel.app/api/cs2/webhook' } },
        { id: 'ov_webhook', status: 'enabled', type: 'channel.channel_points_custom_reward_redemption.add', condition: { broadcaster_user_id: 'user_123' }, transport: { method: 'webhook', callback: 'https://paracetamolhaze.ru/api/ov_webhook' } }
      ] } },
      // DELETE broken_sub_1
      { ok: true, body: {} },
      // DELETE old_sub_active
      { ok: true, body: {} },
      // POST new sub on .ru -> SUCCESS
      { ok: true, status: 202, body: { data: [{ id: 'new_sub_123' }] } }
    ];

    const req = createReq('reconnect');
    const res = await sharedSubscribeHandler(req, '/api/cs2/webhook');
    const data = await res.json();
    console.log('DATA 3:', data);
    
    assert.strictEqual(data.success, true);
    assert.strictEqual(data.subscriptionId, 'new_sub_123');

    const delActive = fetchCalls.find(c => c.url.includes('id=old_sub_active') && c.options?.method === 'DELETE');
    const delBroken = fetchCalls.find(c => c.url.includes('id=broken_sub_1') && c.options?.method === 'DELETE');
    const delOv = fetchCalls.find(c => c.url.includes('id=ov_webhook') && c.options?.method === 'DELETE');

    assert.ok(delActive, 'Active sub should be deleted before create');
    assert.ok(delBroken, 'Broken sub should be deleted');
    assert.ok(!delOv, '/api/ov_webhook MUST NOT be deleted');

    // Also check DELETE order vs POST.
    const delIndex = fetchCalls.findIndex(c => c.url.includes('id=old_sub_active') && c.options?.method === 'DELETE');
    const postIndex = fetchCalls.findIndex(c => c.url.includes('eventsub/subscriptions') && c.options?.method === 'POST');
    assert.ok(delIndex < postIndex, 'Delete must happen before POST');

    console.log('✅ ov_webhook preserved, multiple subs collected and deleted safely');
  } catch (err: any) {
    console.error('❌ Test 3 failed:', err.message);
    failedTests++;
  }

  // Test 4: 409 conflict with /api/ov_webhook
  try {
    fetchCalls = [];
    fetchMocks = [
      { ok: true, body: { data: [{ id: 'old_sub_active', status: 'enabled', type: 'channel.channel_points_custom_reward_redemption.add', condition: { broadcaster_user_id: 'user_123' }, transport: { method: 'webhook', callback: 'https://paracetamolhaze-six.vercel.app/api/cs2/webhook' } }] } },
      // DELETE old
      { ok: true, body: {} },
      // POST new sub on .ru -> FAILS WITH 409
      { ok: false, status: 409, body: { message: 'subscription already exists - id: 12345678-1234-1234-1234-123456789012', error: 'Conflict' } },
      // GET conflict details -> returns ov_webhook
      { ok: true, body: { data: [{ id: '12345678-1234-1234-1234-123456789012', status: 'enabled', type: 'channel.channel_points_custom_reward_redemption.add', condition: { broadcaster_user_id: 'user_123' }, transport: { method: 'webhook', callback: 'https://paracetamolhaze.ru/api/ov_webhook' } }] } },
      // No DELETE should happen for ov_webhook!
      // But we still need ROLLBACK!
      { ok: true, status: 202, body: { data: [{ id: 'restored_sub_id' }] } }
    ];

    const req = createReq('reconnect');
    const res = await sharedSubscribeHandler(req, '/api/cs2/webhook');
    const data = await res.json();
    console.log('DATA 4:', data);
    
    assert.strictEqual(data.success, false);
    assert.strictEqual(data.conflictWithOtherIntegration, true);

    const delConflict = fetchCalls.find(c => c.url.includes('id=12345678-1234-1234-1234-123456789012') && c.options?.method === 'DELETE');
    assert.ok(!delConflict, 'ov_webhook should NEVER be deleted');
    console.log('✅ 409 with ov_webhook preserved and returned as conflict');
  } catch (err: any) {
    console.error('❌ Test 4 failed:', err.message);
    failedTests++;
  }

  // Test 5: 500 on DELETE stops reconnect
  try {
    fetchCalls = [];
    fetchMocks = [
      { ok: true, body: { data: [
        { id: 'broken_sub', status: 'pending', type: 'channel.channel_points_custom_reward_redemption.add', condition: { broadcaster_user_id: 'user_123' }, transport: { method: 'webhook', callback: 'https://paracetamolhaze-six.vercel.app/api/cs2/webhook' } },
        { id: 'old_sub_active', status: 'enabled', type: 'channel.channel_points_custom_reward_redemption.add', condition: { broadcaster_user_id: 'user_123' }, transport: { method: 'webhook', callback: 'https://paracetamolhaze-six.vercel.app/api/cs2/webhook' } }
      ] } },
      // DELETE broken_sub -> FAILS 500
      { ok: false, status: 500, body: {} }
    ];

    const req = createReq('reconnect');
    const res = await sharedSubscribeHandler(req, '/api/cs2/webhook');
    const data = await res.json();
    console.log('DATA 5:', data);
    
    assert.strictEqual(data.success, false);
    assert.strictEqual(data.status, 500);

    const delActive = fetchCalls.find(c => c.url.includes('id=old_sub_active') && c.options?.method === 'DELETE');
    assert.ok(!delActive, 'Active sub should not be deleted if previous DELETE failed');
    console.log('✅ 500 on DELETE safely stops operation');
  } catch (err: any) {
    console.error('❌ Test 5 failed:', err.message);
    failedTests++;
  }

  if (failedTests > 0) {
    console.error(`\n❌ ${failedTests} tests failed.`);
    process.exit(1);
  } else {
    console.log(`\n✅ All tests passed!`);
  }

}

runTests();
