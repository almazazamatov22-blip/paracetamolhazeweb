const { chromium } = require('playwright');
const http = require('http');
const path = require('path');
const fs = require('fs');

const server = http.createServer((req, res) => {
    if (req.url === '/overlays/dashboard.html' || req.url === '/') {
        res.writeHead(200, { 'Content-Type': 'text/html' });
        res.end(fs.readFileSync(path.join(__dirname, 'public/overlays/dashboard.html')));
    } else {
        res.writeHead(404);
        res.end('Not Found');
    }
});

server.listen(3000, async () => {
    const browser = await chromium.launch();
    const context = await browser.newContext();
    const page = await context.newPage();
    let pageErrors = 0;
    
    page.on('pageerror', err => {
        console.error('PAGE ERROR:', err);
        pageErrors++;
    });
    
    let apiCalls = {
        auth: 0,
        settingsGet: 0,
        settingsPost: 0,
        rewardsPost: 0,
        rewardsPatch: 0,
        rewardsDelete: 0,
        test: 0,
        env: 0,
        subscribe: 0
    };

    let fakeDbSettings = {
        version: 2,
        rewards: [
            { internal_id: 'legacy-reward', title: 'ролл', reward_name: 'ролл', cost: 100, reward_id: 'twitch-1' },
            { internal_id: '14b21ef-4e59-43df-876a-6a3223785d4b', title: 'fateroll 2', reward_name: 'fateroll 2', cost: 200, reward_id: 'twitch-2' }
        ]
    };

    let forceDeleteFail = false;
    let forcePersistFail = false;

    await page.route('**/api/auth/me', route => {
        apiCalls.auth++;
        route.fulfill({ json: { id: '577812180', login: 'r1ch_crazy', display_name: 'R1CH_CRAZY', profile_image_url: '' } });
    });
    await page.route('**/api/ov_env', route => {
        apiCalls.env++;
        route.fulfill({ json: { supabaseUrl: 'http://localhost', supabaseAnonKey: 'fake' } });
    });
    await page.route('**/api/ov_subscribe', route => {
        apiCalls.subscribe++;
        route.fulfill({ json: { success: true } });
    });

    await page.route('**/api/ov_settings*', route => {
        if (route.request().method() === 'GET') {
            apiCalls.settingsGet++;
            route.fulfill({ json: { type: 'fate', settings: fakeDbSettings, assets: {} } });
        } else if (route.request().method() === 'POST') {
            apiCalls.settingsPost++;
            if (forcePersistFail) {
                route.fulfill({ status: 500, json: { error: 'Mock Persist Fail' } });
            } else {
                const body = JSON.parse(route.request().postData());
                fakeDbSettings = body.settings;
                route.fulfill({ json: { success: true } });
            }
        }
    });

    await page.route('**/api/ov_rewards*', async route => {
        const method = route.request().method();
        if (method === 'POST') {
            apiCalls.rewardsPost++;
            route.fulfill({ json: { reward: { id: 'new-twitch-id-' + Math.random() } } });
        } else if (method === 'PATCH') {
            apiCalls.rewardsPatch++;
            route.fulfill({ json: { success: true } });
        } else if (method === 'DELETE') {
            apiCalls.rewardsDelete++;
            if (forceDeleteFail) {
                route.fulfill({ status: 500, json: { error: 'Mock Delete Fail' } });
            } else {
                route.fulfill({ json: { success: true } });
            }
        } else {
            route.continue();
        }
    });

    await page.route('**/api/ov_test*', route => {
        apiCalls.test++;
        route.fulfill({ json: { success: true } });
    });

    console.log('--- STARTING TESTS ---');
    await page.goto('http://localhost:3000/');
    await page.waitForTimeout(1000);

    const rewards = await page.locator('.reward-item').allTextContents();
    console.log('1-2. Cards loaded:', rewards.length === 2 ? 'OK' : 'FAIL', rewards.length);
    
    await page.locator('.reward-item').first().click();
    await page.waitForTimeout(200);
    const titleValue = await page.locator('#tw_title').inputValue();
    console.log('3. Click card fills title:', titleValue === 'ролл' ? 'OK' : 'FAIL', titleValue);

    await page.locator('#test-btn').click();
    await page.waitForTimeout(500);
    console.log('4. Test works (called ' + apiCalls.test + ' times):', apiCalls.test === 1 ? 'OK' : 'FAIL');

    await page.locator('button', { hasText: '+ ДОБАВИТЬ НАГРАДУ' }).click();
    await page.waitForTimeout(200);
    console.log('5. Added draft. Save button says:', await page.locator('#save-btn').textContent());

    await page.locator('.reward-item').first().click();
    await page.waitForTimeout(200);
    const toastText = await page.locator('#toast.show').textContent();
    console.log('6. Cannot switch from draft:', toastText.includes('завершите') ? 'OK' : 'FAIL', toastText);

    await page.locator('button', { hasText: '+ ДОБАВИТЬ НАГРАДУ' }).click();
    await page.waitForTimeout(200);
    console.log('7. Cannot create second draft. Toast:', await page.locator('#toast.show').textContent());

    await page.fill('#tw_title', 'Valid New Title');
    await page.fill('#tw_cost', '-5');
    await page.locator('#save-btn').click();
    await page.waitForTimeout(200);
    console.log('8. Invalid cost prevents POST:', apiCalls.rewardsPost === 0 ? 'OK' : 'FAIL');

    await page.fill('#tw_cost', '300');
    await page.locator('#save-btn').click();
    await page.waitForTimeout(1000);
    console.log('9. Valid save triggers POSTs:', apiCalls.rewardsPost === 1 && apiCalls.settingsPost === 1 ? 'OK' : 'FAIL');
    
    await page.screenshot({ path: 'dashboard-preview.png' });
    console.log('Screenshot saved: dashboard-preview.png');

    // Test rollback logic
    await page.locator('button', { hasText: '+ ДОБАВИТЬ НАГРАДУ' }).click();
    await page.waitForTimeout(200);
    await page.fill('#tw_title', 'Rollback Test Title');
    forcePersistFail = true;
    await page.locator('#save-btn').click();
    await page.waitForTimeout(1000);
    console.log('10. Rollback Success logic (persist fail, delete ok): Button is', await page.locator('#save-btn').textContent());

    // Test rollback fail logic
    await page.locator('button', { hasText: '+ ДОБАВИТЬ НАГРАДУ' }).click();
    await page.waitForTimeout(200);
    await page.fill('#tw_title', 'Needs Binding Test');
    forcePersistFail = true;
    forceDeleteFail = true;
    await page.locator('#save-btn').click();
    await page.waitForTimeout(1000);
    console.log('11. Rollback Fail logic (persist fail, delete fail): Button is', await page.locator('#save-btn').textContent());
    console.log('   NeedsBinding state blocks Test button:', await page.locator('#test-btn').isDisabled() ? 'OK' : 'FAIL');
    console.log('   NeedsBinding state blocks Remove Fate button:', await page.locator('#remove-fate-btn').isDisabled() ? 'OK' : 'FAIL');
    
    await page.route('**/api/ov_rewards*', async route => {
        if (route.request().method() === 'DELETE') {
            apiCalls.rewardsDelete++;
            route.fulfill({ status: 404, json: { error: 'Not found' } });
        } else {
            route.continue();
        }
    });

    forcePersistFail = false;
    // try delete 404
    page.on('dialog', dialog => dialog.accept());
    await page.locator('#delete-twitch-btn').click();
    await page.waitForTimeout(1000);
    console.log('12. Delete 404 works as success. Cards left:', await page.locator('.reward-item').count());
    
    console.log('13. Page Errors:', pageErrors === 0 ? 'OK' : 'FAIL', pageErrors);
    console.log('API Calls Summary:', apiCalls);
    
    await browser.close();
    server.close();
});
