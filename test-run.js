const { chromium } = require('playwright');
const { createClient } = require('@supabase/supabase-js');
const express = require('express');
const path = require('path');
const fs = require('fs');

async function run() {
    require('dotenv').config({ path: '.env.local' });
    const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

    console.log("Fetching Supabase config...");
    const { data: config, error } = await supabase
        .from('overlay_configs')
        .select('assets')
        .eq('user_id', '577812180')
        .eq('overlay_type', 'fate')
        .single();
    
    if (error) {
        console.error("Supabase Error:", error);
        return;
    }
    
    const panelBg = config.assets.panel_bg;
    const rewardIcon = config.assets.reward_icon || config.assets.reward_img;
    const avatarUrl = "https://static-cdn.jtvnw.net/jtv_user_pictures/84687db6-e910-422d-8eec-f9afcc1b72aa-profile_image-300x300.png";
    
    console.log("Found panelBg:", !!panelBg);
    console.log("Found rewardIcon:", !!rewardIcon);

    const { data: evtData } = await supabase
        .from('overlay_events')
        .select('payload')
        .eq('user_id', '577812180')
        .eq('overlay_type', 'fate')
        .order('created_at', { ascending: false })
        .limit(1);
    
    let realAvatarUrl = avatarUrl;
    if (evtData && evtData[0] && evtData[0].payload && evtData[0].payload.viewer_avatar) {
        realAvatarUrl = evtData[0].payload.viewer_avatar;
    }
    console.log("Found real avatar:", !!realAvatarUrl);

    // Setup express servers
    const appMain = express();
    appMain.use(express.static('C:\\tmp\\fate-main\\public'));
    const serverMain = appMain.listen(4171, () => console.log('Main on 4171'));

    const appPr9 = express();
    appPr9.use(express.static('C:\\tmp\\fate-pr9\\public'));
    const serverPr9 = appPr9.listen(4172, () => console.log('PR9 on 4172'));

    const browser = await chromium.launch();
    const pageMain = await browser.newPage({ viewport: { width: 1620, height: 290 } });
    const pagePr9 = await browser.newPage({ viewport: { width: 1620, height: 290 } });

    const scenarios = [
        { id: 1, user: 'R1CH_CRAZY', pick: '03', roll: '19', title: 'ролл' },
        { id: 2, user: 'R1CH_CRAZY', pick: '38', roll: '00', title: 'FATEROLL 2' },
        { id: 3, user: 'R1CH_CRAZY', pick: '29', roll: '00', title: 'FATE FINAL TEST' },
        { id: 4, user: 'VERY_LONG_VIEWER_NAME_123456789', pick: '86', roll: '23', title: 'VERY LONG TWITCH REWARD TITLE WITH MANY WORDS' }
    ];

    async function evaluateScenario(page, scenario) {
        await page.evaluate(({ panelBg, rewardIcon, avatarUrl, scenario }) => {
            const wrap = document.getElementById('wrap');
            wrap.style.backgroundImage = `url(${panelBg})`;
            wrap.classList.add('show');
            wrap.style.top = '40px';
            wrap.style.opacity = '1';

            document.getElementById('user').textContent = scenario.user;
            document.getElementById('avatar').src = avatarUrl;
            document.getElementById('pickNum').textContent = scenario.pick;
            document.getElementById('rollNum').textContent = scenario.roll;

            const rewardImg = document.getElementById('rewardImg');
            rewardImg.innerHTML = '';
            if (rewardIcon) {
                const img = document.createElement('img');
                img.src = rewardIcon;
                rewardImg.appendChild(img);
            }

            if (typeof updateRewardTitle === 'function') {
                updateRewardTitle(scenario.title);
            } else {
                document.getElementById('rewardTitle').textContent = scenario.title;
            }
        }, { panelBg, rewardIcon, avatarUrl: realAvatarUrl, scenario });

        // wait for images
        await page.waitForTimeout(500);

        const boxes = await page.evaluate(() => {
            const getBox = id => {
                const el = document.getElementById(id);
                if(!el) return null;
                const rect = el.getBoundingClientRect();
                return { left: rect.left, right: rect.right, width: rect.width, scrollWidth: el.scrollWidth, clientWidth: el.clientWidth };
            };
            return {
                wrap: getBox('wrap'),
                user: getBox('user'),
                avatar: getBox('avatar'),
                center: getBox('center-side'),
                title: getBox('rewardTitle'),
                img: getBox('rewardImg')
            };
        });

        return boxes;
    }

    let report = "";

    for (const sc of scenarios) {
        console.log(`Running scenario ${sc.id}...`);
        
        // MAIN
        await pageMain.goto('http://127.0.0.1:4171/overlays/roll.html');
        const mainBoxes = await evaluateScenario(pageMain, sc);
        await pageMain.screenshot({ path: `main-${sc.id}.png` });

        // PR9
        await pagePr9.goto('http://127.0.0.1:4172/overlays/roll.html');
        const pr9Boxes = await evaluateScenario(pagePr9, sc);
        await pagePr9.screenshot({ path: `pr9-${sc.id}.png` });

        const checkBounds = (b) => {
            if (!b.wrap) return "failed";
            const c1 = b.user.right <= b.avatar.left - 10;
            const c2 = b.avatar.right <= b.center.left;
            const c3 = b.center.right <= b.title.left;
            const c4 = b.title.right <= b.img.left - 10;
            const c5 = b.wrap.width === 1600;
            return `user<avatar(-10): ${c1}, avatar<center: ${c2}, center<title: ${c3}, title<img(-10): ${c4}, wrap1600: ${c5}`;
        };

        report += `\n--- SCENARIO ${sc.id} ---\n`;
        report += `MAIN BOUNDS:\n  Wrap: ${mainBoxes.wrap.width} (L:${mainBoxes.wrap.left} R:${mainBoxes.wrap.right})\n  User: R:${mainBoxes.user.right} (SW:${mainBoxes.user.scrollWidth} CW:${mainBoxes.user.clientWidth})\n  Avatar: L:${mainBoxes.avatar.left} R:${mainBoxes.avatar.right}\n  Center: L:${mainBoxes.center.left} R:${mainBoxes.center.right}\n  Title: L:${mainBoxes.title.left} R:${mainBoxes.title.right}\n  Img: L:${mainBoxes.img.left}\n`;
        report += `  Checks: ${checkBounds(mainBoxes)}\n`;
        report += `PR9 BOUNDS:\n  Wrap: ${pr9Boxes.wrap.width} (L:${pr9Boxes.wrap.left} R:${pr9Boxes.wrap.right})\n  User: R:${pr9Boxes.user.right} (SW:${pr9Boxes.user.scrollWidth} CW:${pr9Boxes.user.clientWidth})\n  Avatar: L:${pr9Boxes.avatar.left} R:${pr9Boxes.avatar.right}\n  Center: L:${pr9Boxes.center.left} R:${pr9Boxes.center.right}\n  Title: L:${pr9Boxes.title.left} R:${pr9Boxes.title.right}\n  Img: L:${pr9Boxes.img.left}\n`;
        report += `  Checks: ${checkBounds(pr9Boxes)}\n`;
    }

    fs.writeFileSync('report.txt', report);

    // Create collage HTML
    const html = `
    <html><body style="background: #333; color: white; display: flex; font-family: sans-serif; margin: 0; padding: 20px; gap: 20px;">
        <div style="flex: 1;">
            <h1 style="text-align: center;">MAIN (PR #8)</h1>
            <div style="margin-bottom: 20px;"><h2>Scenario 1</h2><img src="file:///${path.resolve('main-1.png').replace(/\\/g, '/')}"></div>
            <div style="margin-bottom: 20px;"><h2>Scenario 2</h2><img src="file:///${path.resolve('main-2.png').replace(/\\/g, '/')}"></div>
            <div style="margin-bottom: 20px;"><h2>Scenario 3</h2><img src="file:///${path.resolve('main-3.png').replace(/\\/g, '/')}"></div>
            <div style="margin-bottom: 20px;"><h2>Scenario 4</h2><img src="file:///${path.resolve('main-4.png').replace(/\\/g, '/')}"></div>
        </div>
        <div style="flex: 1;">
            <h1 style="text-align: center;">PR #9 (Fixed)</h1>
            <div style="margin-bottom: 20px;"><h2>Scenario 1</h2><img src="file:///${path.resolve('pr9-1.png').replace(/\\/g, '/')}"></div>
            <div style="margin-bottom: 20px;"><h2>Scenario 2</h2><img src="file:///${path.resolve('pr9-2.png').replace(/\\/g, '/')}"></div>
            <div style="margin-bottom: 20px;"><h2>Scenario 3</h2><img src="file:///${path.resolve('pr9-3.png').replace(/\\/g, '/')}"></div>
            <div style="margin-bottom: 20px;"><h2>Scenario 4</h2><img src="file:///${path.resolve('pr9-4.png').replace(/\\/g, '/')}"></div>
        </div>
    </body></html>
    `;
    fs.writeFileSync('collage.html', html);

    const pageCollage = await browser.newPage({ viewport: { width: 3350, height: 1600 } });
    await pageCollage.goto(`file:///${path.resolve('collage.html').replace(/\\/g, '/')}`);
    await pageCollage.waitForTimeout(1000); // wait for images to load
    await pageCollage.screenshot({ path: 'comparison.png', fullPage: true });

    await browser.close();
    serverMain.close();
    serverPr9.close();
    console.log("Done.");
}

run().catch(console.error);
