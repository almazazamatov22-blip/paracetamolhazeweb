const { chromium } = require('playwright');
const http = require('http');
const path = require('path');
const fs = require('fs');

const server = http.createServer((req, res) => {
    if (req.url === '/overlays/roll.html' || req.url === '/') {
        res.writeHead(200, { 'Content-Type': 'text/html' });
        res.end(fs.readFileSync(path.join(__dirname, 'public/overlays/roll.html')));
    } else {
        res.writeHead(404);
        res.end('Not Found');
    }
});

server.listen(3001, async () => {
    const browser = await chromium.launch();
    const context = await browser.newContext({ viewport: { width: 1600, height: 900 } });
    const page = await context.newPage();

    await page.goto('http://localhost:3001/');
    await page.waitForTimeout(500);

    const tests = [
        { id: 'A', user: 'R1CH_CRAZY', title: 'ролл' },
        { id: 'B', user: 'R1CH_CRAZY', title: 'FATEROLL 2' },
        { id: 'C', user: 'R1CH_CRAZY', title: 'FATE FINAL TEST' },
        { id: 'D', user: 'VERY_LONG_VIEWER_NAME_123456789', title: 'VERY LONG TWITCH REWARD TITLE WITH MANY WORDS' }
    ];

    for (const t of tests) {
        console.log('\n=== TEST ' + t.id + ' ===');
        await page.evaluate(({ u, t }) => {
            const userEl = document.getElementById('user');
            const wrap = document.getElementById('wrap');
            const avatarEl = document.getElementById('avatar');
            
            userEl.textContent = u;
            // Also call updateRewardTitle since it's global
            window.updateRewardTitle(t);
            
            // Dummy avatar just to take space
            avatarEl.style.display = 'block';
            avatarEl.style.background = 'red';

            // Show it
            wrap.className = 'show';
            wrap.style.top = '40px';
            wrap.style.opacity = '1';
        }, { u: t.user, t: t.title });

        await page.waitForTimeout(200);
        await page.screenshot({ path: 'roll-screenshot-' + t.id + '.png' });
        console.log('Screenshot saved: roll-screenshot-' + t.id + '.png');

        const bounds = await page.evaluate(() => {
            const getB = id => document.getElementById(id).getBoundingClientRect();
            return {
                user: getB('user'),
                avatar: getB('avatar'),
                center: getB('center-side'),
                rewardTitle: getB('rewardTitle'),
                rewardImg: getB('rewardImg'),
                wrap: getB('wrap'),
                userScrollWidth: document.getElementById('user').scrollWidth,
                userClientWidth: document.getElementById('user').clientWidth
            };
        });

        console.log('Bounding boxes:');
        console.log('  Wrap: left=' + bounds.wrap.left + ', right=' + bounds.wrap.right + ', width=' + bounds.wrap.width);
        console.log('  User: right=' + bounds.user.right);
        console.log('  Avatar: left=' + bounds.avatar.left + ', right=' + bounds.avatar.right);
        console.log('  Center: left=' + bounds.center.left + ', right=' + bounds.center.right);
        console.log('  Title: left=' + bounds.rewardTitle.left + ', right=' + bounds.rewardTitle.right);
        console.log('  Img: left=' + bounds.rewardImg.left);

        const check1 = bounds.user.right <= bounds.avatar.left - 16;
        const check2 = bounds.avatar.right <= bounds.center.left;
        const check3 = bounds.center.right <= bounds.rewardTitle.left;
        const check4 = bounds.rewardTitle.right <= bounds.rewardImg.left - 16;
        const check5 = bounds.wrap.left >= 0 && bounds.wrap.right <= 1600;

        console.log('Checks:');
        console.log('  user.right <= avatar.left - 16: ' + check1 + ' (' + bounds.user.right + ' <= ' + (bounds.avatar.left - 16) + ')');
        console.log('  avatar.right <= center.left: ' + check2 + ' (' + bounds.avatar.right + ' <= ' + bounds.center.left + ')');
        console.log('  center.right <= rewardTitle.left: ' + check3 + ' (' + bounds.center.right + ' <= ' + bounds.rewardTitle.left + ')');
        console.log('  rewardTitle.right <= rewardImg.left - 16: ' + check4 + ' (' + bounds.rewardTitle.right + ' <= ' + (bounds.rewardImg.left - 16) + ')');
        console.log('  wrap bounds: ' + check5);

        if (t.user === 'R1CH_CRAZY') {
            const notCut = bounds.userScrollWidth <= bounds.userClientWidth;
            console.log('  R1CH_CRAZY not cut visually: ' + notCut + ' (scrollWidth ' + bounds.userScrollWidth + ' <= clientWidth ' + bounds.userClientWidth + ')');
        }
    }

    await browser.close();
    server.close();
});
