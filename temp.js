
        let currentUser = null;
        let supabaseClient = null;
        let realtimeChannel = null;

        let fateRewards = [];
        let currentRewardId = null;


        const assetTemplates = [
            { id: 'panel_bg', name: 'Фон панели', meta: 'Рекомендуемо: 1600x210' },
            { id: 'reward_icon', name: 'Иконка награды', meta: 'Рекомендуемо: 200x200' },
            { id: 'sound_in', name: 'Звук появления', meta: 'Длительность: 1 сек' },
            { id: 'sound_loop', name: 'Звук рандома', meta: 'Длительность: 3 сек (под цикл)' },
            { id: 'sound_win', name: 'Звук победы', meta: 'Длительность: 2 сек' },
            { id: 'sound_lose', name: 'Звук проигрыша', meta: 'Длительность: 2 сек' },
            { id: 'sound_out', name: 'Звук исчезновения', meta: 'Длительность: 1 сек' }
        ];

        function generateUUID() {
            if (window.crypto && crypto.randomUUID) {
                return crypto.randomUUID();
            }
            return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
                var r = Math.random() * 16 | 0, v = c == 'x' ? r : (r & 0x3 | 0x8);
                return v.toString(16);
            });
        }

        async function persistRewards() {
            const response = await fetch('/api/ov_settings', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    type: 'fate',
                    settings: {
                        version: 2,
                        rewards: fateRewards.map(
                            ({
                                assets,
                                _isNew,
                                _needsBinding,
                                ...reward
                            }) => reward
                        )
                    }
                })
            });

            const data = await response.json().catch(() => ({}));

            if (!response.ok) {
                throw new Error(data.error || 'Ошибка сохранения локальных настроек');
            }

            return data;
        }

        async function deleteTwitchReward() {
            if (!currentRewardId) return;
            const reward = fateRewards.find(item => item.internal_id === currentRewardId);
            const twId = reward?.reward_id;

            if (!twId) {
                showToast('Карточка ещё не создана в Twitch', true);
                return;
            }
            if (!confirm('Вы уверены, что хотите удалить эту награду ИЗ TWITCH? Это действие необратимо.')) return;

            showToast('Удаление из Twitch...');
            try {
                let deletedInTwitch = false;
                const res = await fetch('/api/ov_rewards', {
                    method: 'DELETE',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ id: twId })
                });

                if (!res.ok) {
                    const d = await res.json().catch(() => ({}));
                    if (res.status === 404 || d.error?.includes('не найдена') || d.error?.includes('уже удалена')) {
                        console.warn('Already deleted in Twitch');
                        deletedInTwitch = true;
                    } else {
                        throw new Error(d.error || 'Ошибка удаления в Twitch');
                    }
                } else {
                    deletedInTwitch = true;
                }

                if (deletedInTwitch) {
                    fateRewards = fateRewards.filter(r => r.internal_id !== currentRewardId);

                    try {
                        await persistRewards();
                        showToast('Награда удалена из Twitch и локально');
                        await loadSettings();

                        currentRewardId = fateRewards.length > 0 ? fateRewards[0].internal_id : null;
                        if (currentRewardId) {
                            selectReward(currentRewardId);
                        } else {
                            renderRewardsList();
                            hideEditor();
                        }
                    } catch (persistErr) {
                        showToast('Награда удалена из Twitch, но локальную привязку удалить не удалось.', true);
                        await loadSettings();
                    }
                }
            } catch (e) {
                showToast(e.message || 'Ошибка удаления!', true);
                console.error(e);
            }
        }

        async function init() {
            try {
                const resAuth = await fetch('/api/auth/me');
                if (!resAuth.ok) {
                    if (resAuth.status === 401) window.location.href = '/auth/twitch?source=overlays';
                    return;
                }
                const data = await resAuth.json();
                if (!data.id) {
                    window.location.href = '/auth/twitch?source=overlays';
                    return;
                }
                currentUser = data;

                document.getElementById('username').textContent = data.display_name;
                document.getElementById('user-avatar').src = data.profile_image_url;
                document.getElementById('obs-url').textContent = `${window.location.origin}/overlays/roll.html?id=${data.id}`;


                await loadSettings();
                await initSupabase();

                setupRealtime();
                ensureEventSub().catch(console.error);

            } catch (e) {
                console.error('Init error:', e);
            }
        }

        async function initSupabase() {
            const res = await fetch('/api/ov_env');
            if (!res.ok) throw new Error('Failed to fetch env variables');
            const env = await res.json();
            if(!env.supabaseUrl || !env.supabaseAnonKey) throw new Error('No Supabase Env');

            supabaseClient = window.supabase.createClient(env.supabaseUrl, env.supabaseAnonKey);
        }

        function setupRealtime() {
            if(!supabaseClient || !currentUser) return;
            const connStatus = document.getElementById('conn-status');

            realtimeChannel = supabaseClient.channel('dashboard_changes')
                .on(
                    'postgres_changes',
                    { event: '*', schema: 'public', table: 'overlay_configs', filter: `user_id=eq.${currentUser.id}` },
                    (payload) => {
                        console.log("Config changed via Realtime:", payload);
                        if (payload.new && (payload.new.overlay_type === 'fate' || !payload.new.overlay_type)) {
                           applyConfigState(payload.new);
                        }
                    }
                )
                .subscribe((status) => {
                    if (status === 'SUBSCRIBED') {
                        connStatus.style.opacity = '1';
                        connStatus.textContent = 'Подключено';
                        connStatus.style.color = 'var(--success)';
                        connStatus.style.background = 'rgba(34, 197, 94, 0.1)';
                    } else if (status === 'CLOSED' || status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
                        connStatus.style.opacity = '1';
                        connStatus.textContent = 'Связь потеряна';
                        connStatus.style.color = 'var(--error)';
                        connStatus.style.background = 'rgba(239, 68, 68, 0.1)';
                    }
                });
        }

        window.addEventListener('beforeunload', () => {
             if (realtimeChannel && supabaseClient) {
                 supabaseClient.removeChannel(realtimeChannel);
             }
        });

        async function ensureEventSub() {
            try {
                const res = await fetch('/api/ov_subscribe', { method: 'POST' });
                if (!res.ok) {
                    const subData = await res.json();
                    throw new Error(subData.error || 'Subscription failed');
                }
            } catch (e) {
                console.error('[OV_EVENTSUB] Error:', e);
            }
        }

        async function loadSettings() {
            if(!currentUser) return;
            const res = await fetch(`/api/ov_settings?userId=${currentUser.id}&type=fate`);
            if (res.ok) {
                const config = await res.json();
                applyConfigState(config);
            } else {
                console.error("Load settings error", await res.text());
            }
        }

        function applyConfigState(config) {
            const settings = config.settings || config;
            const rootAssets = config.assets || config;
            const perRewardAssets = rootAssets.fate_rewards || {};

            fateRewards = (settings.rewards || []).map(reward => ({
              ...reward,
              assets: perRewardAssets[reward.internal_id] || {}
            }));

            if (fateRewards.length === 0) {
                currentRewardId = null;
            } else {
                if (currentRewardId && !fateRewards.find(r => r.internal_id === currentRewardId)) {
                    currentRewardId = fateRewards[0].internal_id;
                } else if (!currentRewardId) {
                    currentRewardId = fateRewards[0].internal_id;
                }
            }

            renderRewardsList();
            if (currentRewardId) {
                selectReward(currentRewardId, false);
            } else {
                hideEditor();
            }
        }

        function renderRewardsList() {
            const container = document.getElementById('rewards-list-container');
            if (fateRewards.length === 0) {
                container.innerHTML = '';
                const empty = document.createElement('div');
                empty.style.cssText = 'font-size: 13px; color: var(--text-dim); text-align: center; padding: 20px;';
                empty.textContent = 'Наград нет';
                container.appendChild(empty);
                return;
            }

            container.innerHTML = '';
            for (const r of fateRewards) {
                const title = r.reward_name || 'Без названия';
                const idDisplay = r.reward_id ? r.reward_id.substring(0, 8) + '...' : 'Не привязана';

                const item = document.createElement('div');
                item.className = 'reward-item' + (r.internal_id === currentRewardId ? ' active' : '');
                item.addEventListener('click', () => {
                    const unfinished = fateRewards.find(item => item._isNew || item._needsBinding);
                    if (unfinished && unfinished.internal_id !== r.internal_id) {
                        showToast('Сначала завершите или удалите создаваемую награду', true);
                        selectReward(unfinished.internal_id);
                        return;
                    }
                    selectReward(r.internal_id);
                });

                const infoDiv = document.createElement('div');
                const titleDiv = document.createElement('div');
                titleDiv.className = 'reward-item-title';
                titleDiv.textContent = title;

                const idDiv = document.createElement('div');
                idDiv.className = 'reward-item-id';
                idDiv.textContent = idDisplay;

                infoDiv.appendChild(titleDiv);
                infoDiv.appendChild(idDiv);

                const arrowDiv = document.createElement('div');
                arrowDiv.style.cssText = 'font-size: 16px; color: var(--text-dim);';
                arrowDiv.textContent = '›';

                item.appendChild(infoDiv);
                item.appendChild(arrowDiv);

                container.appendChild(item);
            }
        }

        function hideEditor() {
            document.getElementById('no-selection-msg').classList.remove('hidden');
            document.getElementById('editor-container').classList.add('hidden');
            document.getElementById('assets-container').classList.add('hidden');
        }

        function selectReward(internal_id, scroll = true) {
            currentRewardId = internal_id;
            renderRewardsList();

            const reward = fateRewards.find(r => r.internal_id === internal_id);
            if (!reward) return;

            document.getElementById('no-selection-msg').classList.add('hidden');
            document.getElementById('editor-container').classList.remove('hidden');
            document.getElementById('assets-container').classList.remove('hidden');

            const btn = document.getElementById('save-btn');
            const testBtn = document.getElementById('test-btn');
            const removeFateBtn = document.getElementById('remove-fate-btn');
            const deleteTwitchBtn = document.getElementById('delete-twitch-btn');

            if (removeFateBtn && deleteTwitchBtn) {
                if (reward._needsBinding && reward.reward_id) {
                    removeFateBtn.disabled = true;
                    removeFateBtn.title = 'Сначала повторите привязку или удалите награду в Twitch';
                    deleteTwitchBtn.disabled = false;
                } else {
                    removeFateBtn.disabled = false;
                    removeFateBtn.title = 'Удалить только эту карточку из Fate';
                    deleteTwitchBtn.disabled = !reward.reward_id;
                }
            }

            if (reward._needsBinding && reward.reward_id) {
                document.getElementById('tw_title').value = reward.title || '';
                document.getElementById('tw_desc').value = reward.description || '';
                document.getElementById('tw_cost').value = reward.cost || 100;
                document.getElementById('min_val').value = reward.min_val !== undefined ? reward.min_val : 1;
                document.getElementById('max_val').value = reward.max_val !== undefined ? reward.max_val : 100;

                btn.textContent = 'ПОВТОРИТЬ ПРИВЯЗКУ';
                if (testBtn) testBtn.disabled = true;
            } else if (reward._isNew || !reward.reward_id) {
                document.getElementById('tw_title').value = reward.title || '';
                document.getElementById('tw_desc').value = reward.description || '';
                document.getElementById('tw_cost').value = reward.cost || 100;
                document.getElementById('min_val').value = reward.min_val !== undefined ? reward.min_val : 1;
                document.getElementById('max_val').value = reward.max_val !== undefined ? reward.max_val : 100;

                btn.textContent = 'СОЗДАТЬ НАГРАДУ';
                if (testBtn) testBtn.disabled = true;
            } else {
                document.getElementById('tw_title').value = reward.title || reward.reward_name || '';
                document.getElementById('tw_desc').value = reward.description || '';
                document.getElementById('tw_cost').value = reward.cost || 100;
                document.getElementById('min_val').value = reward.min_val !== undefined ? reward.min_val : 1;
                document.getElementById('max_val').value = reward.max_val !== undefined ? reward.max_val : 100;

                btn.textContent = 'СОХРАНИТЬ ИЗМЕНЕНИЯ';
                if (testBtn) testBtn.disabled = false;
            }

            renderAssets(reward.assets || {});
        }

        function createReward() {
            const draft = fateRewards.find(reward => reward._isNew || reward._needsBinding);
            if (draft) {
                selectReward(draft.internal_id);
                showToast('Сначала завершите создание текущей награды', true);
                return;
            }

            const newReward = {
                internal_id: generateUUID(),
                reward_id: '',
                title: '',
                reward_name: '',
                description: '',
                cost: 100,
                min_val: 1,
                max_val: 100,
                enabled: true,
                assets: {},
                _isNew: true
            };
            fateRewards.push(newReward);
            selectReward(newReward.internal_id);
            showToast('Заполните поля и нажмите "Создать награду"');
        }

        async function saveSettings(event) {
            if (event) event.preventDefault();
            if (!currentRewardId) return;

            const reward = fateRewards.find(r => r.internal_id === currentRewardId);
            if (!reward) return;

            const btn = document.getElementById('save-btn');
            const originalText = btn.textContent;
            btn.disabled = true;
            btn.textContent = 'СОХРАНЕНИЕ...';

            const testBtn = document.getElementById('test-btn');
            if (testBtn) testBtn.disabled = true;

            // disable delete buttons
            const delButtons = document.querySelectorAll('.btn-danger, .btn-outline[title*="Удалить"]');
            delButtons.forEach(b => b.disabled = true);

            try {
                const title = document.getElementById('tw_title').value.trim();
                const desc = document.getElementById('tw_desc').value.trim();
                const cost = Number(document.getElementById('tw_cost').value);
                const min = Number(document.getElementById('min_val').value);
                const max = Number(document.getElementById('max_val').value);

                if (!title) {
                    throw new Error('Введите название награды');
                }
                if (!Number.isInteger(cost) || cost <= 0) {
                    throw new Error('Стоимость должна быть положительным целым числом');
                }
                if (!Number.isInteger(min) || !Number.isInteger(max) || min >= max) {
                    throw new Error('Мин и макс должны быть целыми числами, мин меньше макс');
                }

                if (reward._needsBinding && reward.reward_id) {
                    reward.min_val = min;
                    reward.max_val = max;
                    await persistRewards();
                    await loadSettings();

                    const canonicalReward = fateRewards.find(r => r.reward_id === reward.reward_id);
                    if (!canonicalReward) throw new Error('Награда не найдена после привязки');
                    selectReward(canonicalReward.internal_id);
                    showToast('Привязка успешна!');
                } else if (reward._isNew) {
                    const res = await fetch('/api/ov_rewards', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ title, description: desc, cost })
                    });
                    const data = await res.json();
                    if (!res.ok) throw new Error(data.error || 'Ошибка создания награды в Twitch');

                    const twitchId = data.reward.id;

                    reward.reward_id = twitchId;
                    reward.title = title;
                    reward.reward_name = title;
                    reward.description = desc;
                    reward.cost = cost;
                    reward.min_val = min;
                    reward.max_val = max;

                    try {
                        await persistRewards();
                    } catch (err) {
                        let deleteResponse = null;
                        let deleteData = {};

                        try {
                            deleteResponse = await fetch('/api/ov_rewards', {
                                method: 'DELETE',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({ id: twitchId })
                            });
                            deleteData = await deleteResponse.json().catch(() => ({}));
                        } catch (deleteError) {
                            console.error('Failed to rollback Twitch reward', deleteError);
                        }

                        if (deleteResponse?.ok) {
                            reward.reward_id = '';
                            reward._isNew = true;
                            reward._needsBinding = false;

                            btn.textContent = 'СОЗДАТЬ НАГРАДУ';
                            btn.disabled = false;
                            if (testBtn) testBtn.disabled = true;

                            selectReward(reward.internal_id);

                            showToast('Награда не сохранилась в Fate и была удалена из Twitch. Повторите создание.', true);
                            return;
                        }

                        reward._isNew = false;
                        reward._needsBinding = true;

                        btn.textContent = 'ПОВТОРИТЬ ПРИВЯЗКУ';
                        btn.disabled = false;
                        if (testBtn) testBtn.disabled = true;

                        showToast(deleteData.error || 'Награда создана в Twitch, но не привязана. Нажмите “Повторить привязку”.', true);
                        return;
                    }

                    await loadSettings();

                    const canonicalReward = fateRewards.find(r => r.reward_id === twitchId);
                    if (!canonicalReward) {
                        throw new Error('Награда создана, но не найдена в сохранённой конфигурации');
                    }
                    selectReward(canonicalReward.internal_id);
                    showToast('Награда успешно создана!');
                } else {
                    const patchRes = await fetch('/api/ov_rewards', {
                        method: 'PATCH',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ id: reward.reward_id, title, description: desc, cost })
                    });
                    if (!patchRes.ok) {
                        const d = await patchRes.json().catch(()=>({}));
                        throw new Error(d.error || 'Ошибка обновления Twitch награды');
                    }

                    reward.title = title;
                    reward.reward_name = title;
                    reward.description = desc;
                    reward.cost = cost;
                    reward.min_val = min;
                    reward.max_val = max;

                    await persistRewards();
                    await loadSettings();
                    showToast('Настройки сохранены');

                    const canonicalReward = fateRewards.find(r => r.reward_id === reward.reward_id);
                    if (canonicalReward) selectReward(canonicalReward.internal_id);
                }
            } catch(e) {
                showToast(e.message || 'Ошибка!', true);
                if (btn.textContent !== 'ПОВТОРИТЬ ПРИВЯЗКУ') {
                    btn.textContent = originalText;
                }
            } finally {
                if (btn.textContent !== 'ПОВТОРИТЬ ПРИВЯЗКУ') {
                    btn.disabled = false;
                }
                if (testBtn && reward && !reward._isNew && !reward._needsBinding && reward.reward_id) {
                    testBtn.disabled = false;
                }
                const removeFateBtn = document.getElementById('remove-fate-btn');
                const deleteTwitchBtn = document.getElementById('delete-twitch-btn');
                if (removeFateBtn) {
                    removeFateBtn.disabled = !!(reward && reward._needsBinding && reward.reward_id);
                }
                if (deleteTwitchBtn) {
                    deleteTwitchBtn.disabled = !!(reward && !reward.reward_id);
                }
            }
        }

        async function deleteCurrentReward() {
            if (!currentRewardId) return;

            const reward = fateRewards.find(item => item.internal_id === currentRewardId);

            if (reward?._needsBinding && reward.reward_id) {
                showToast('Эта награда уже создана в Twitch. Сначала повторите привязку или удалите её в Twitch.', true);
                return;
            }

            if (!confirm('Удалить эту награду ИЗ FATE? Награда в самом Twitch останется нетронутой.')) return;

            fateRewards = fateRewards.filter(r => r.internal_id !== currentRewardId);
            currentRewardId = fateRewards.length > 0 ? fateRewards[0].internal_id : null;

            const btn = document.getElementById('save-btn');
            btn.disabled = true; btn.textContent = 'УДАЛЕНИЕ...';

            try {
                await persistRewards();
                showToast('Награда удалена из Fate');
            } catch (e) {
                showToast(e.message || 'Ошибка!', true);
                console.error('Delete error:', e);
                loadSettings();
            } finally {
                btn.disabled = false;
                if (currentRewardId) selectReward(currentRewardId);
                else {
                    renderRewardsList();
                    hideEditor();
                }
            }
        }

        function renderAssets(assets) {
            const container = document.getElementById('asset-list');
            if(!container) return;

            const reward = fateRewards.find(r => r.internal_id === currentRewardId);
            const isDisabled = !reward || reward._isNew || reward._needsBinding || !reward.reward_id;

            container.innerHTML = assetTemplates.map(a => {
                const isLoaded = !!assets[a.id];
                const statusHtml = isLoaded ? `<span style="color:var(--success)">✔ Загружено</span>` : `Ожидание`;
                const btnDisabled = isDisabled ? 'disabled title="Сначала сохраните награду"' : '';
                return `
                    <div class="asset-row">
                        <div class="asset-info">
                            <div class="asset-name">${a.name}</div>
                            <div class="asset-meta">${a.meta}</div>
                        </div>
                        <div id="status-${a.id}" style="font-size: 11px; margin-right: 15px; color: var(--text-dim);">
                            ${statusHtml}
                        </div>
                        <button class="btn btn-outline" ${btnDisabled} onclick="document.getElementById('file-${a.id}').click()" style="padding: 8px 16px; font-size: 12px;">ЗАГРУЗИТЬ</button>
                        <input type="file" ${btnDisabled} id="file-${a.id}" hidden accept="image/*, audio/*" onchange="uploadFile(this, '${a.id}')">
                    </div>
                `;
            }).join('');
        }

        async function uploadFile(input, key) {
            if (!currentRewardId) return;
            const file = input.files[0]; if (!file) return;
            const badge = document.getElementById(`status-${key}`);
            badge.innerHTML = `<span style="color:var(--warning)">Загрузка...</span>`;

            const reader = new FileReader();
            reader.onload = async () => {
                try {
                    const res = await fetch('/api/ov_upload', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            name: file.name,
                            type: file.type,
                            data: reader.result.split(',')[1],
                            key,
                            overlay_type: 'fate',
                            internal_id: currentRewardId
                        })
                    });
                    const d = await res.json().catch(()=>({}));
                    if (!res.ok) {
                        throw new Error(d.error || 'Upload failed');
                    }
                    showToast('Файл загружен');
                    const reward = fateRewards.find(r => r.internal_id === currentRewardId);
                    reward.assets = reward.assets || {};
                    reward.assets[key] = d.url;
                    renderAssets(reward.assets);
                } catch (e) {
                    badge.innerHTML = `<span style="color:var(--error)">Ошибка</span>`;
                    showToast(e.message || 'Ошибка загрузки', true);
                    console.error('Upload error:', e);
                }
            };
            reader.readAsDataURL(file);
        }

        function copyUrl() {
            const url = document.getElementById('obs-url').textContent;
            navigator.clipboard.writeText(url);
            showToast('Ссылка скопирована');
        }

        async function testOverlay() {
            if (!currentRewardId) return;
            const reward = fateRewards.find(r => r.internal_id === currentRewardId);
            if (!reward || reward._isNew || reward._needsBinding || !reward.reward_id) return;
            try {
                showToast('Отправка теста...');
                const btn = document.getElementById('test-btn');
                if (btn) btn.disabled = true;
                const res = await fetch('/api/ov_test', {
                    method: 'POST',
                    headers: {'Content-Type': 'application/json'},
                    body: JSON.stringify({ type: 'fate', internal_id: currentRewardId, reward_id: reward.reward_id })
                });
                if (!res.ok) {
                    const data = await res.json();
                    throw new Error(data.error || 'Test failed');
                }
                showToast('Событие теста создано');
            }
            catch (e) {
                showToast(e.message || 'Ошибка теста', true);
                console.error('Test overlay error:', e);
            } finally {
                const btn = document.getElementById('test-btn');
                if (btn && currentRewardId) {
                    const r = fateRewards.find(rew => rew.internal_id === currentRewardId);
                    if (r && !r._isNew && !r._needsBinding && Boolean(r.reward_id)) btn.disabled = false;
                }
            }
        }

        function showToast(msg, isError = false) {
            const t = document.getElementById('toast');
            if(!t) return;
            t.textContent = msg;
            t.style.background = isError ? 'var(--error)' : 'var(--success)';
            t.classList.add('show');
            setTimeout(() => t.classList.remove('show'), 4000);
        }

        // Start initialization
        init();
    