-- 20260718162111_multi_reward_fate.sql

-- 1. SAVE FATE REWARD BINDINGS (ARRAY OF REWARDS)
create or replace function public.save_fate_reward_bindings(
  p_broadcaster_id text,
  p_reward_ids text[],
  p_settings jsonb
) returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_lock_key bigint;
  v_config_id uuid;
  v_reward_id text;
  v_owner text;
  v_reward_ids text[];
  v_settings_reward_ids text[];
  v_reward jsonb;
  v_internal_id text;
  v_min numeric;
  v_max numeric;
  v_assets jsonb;
  v_legacy_assets jsonb;
  v_is_v2 boolean;
  seen_internal text[] := '{}';
  seen_reward text[] := '{}';
begin
  p_broadcaster_id := trim(p_broadcaster_id);
  if p_broadcaster_id is null or p_broadcaster_id = '' then
    raise exception 'broadcaster_id cannot be empty';
  end if;

  if jsonb_typeof(p_settings) is distinct from 'object' then
    raise exception 'p_settings must be an object';
  end if;

  v_is_v2 := coalesce(p_settings->>'version', '1') = '2';

  if v_is_v2 then
    if jsonb_typeof(p_settings->'rewards') is distinct from 'array' then
      raise exception 'p_settings->rewards must be an array';
    end if;

    -- Validate internal structures
    for v_reward in select * from jsonb_array_elements(p_settings->'rewards') loop
      v_internal_id := trim(v_reward->>'internal_id');
      v_reward_id := trim(v_reward->>'reward_id');

      if v_internal_id is null or v_internal_id = '' then
        raise exception 'internal_id cannot be empty';
      end if;
      if v_reward_id is null or v_reward_id = '' then
        raise exception 'reward_id cannot be empty';
      end if;

      if v_internal_id = any(seen_internal) then
        raise exception 'Duplicate internal_id: %', v_internal_id;
      end if;
      seen_internal := array_append(seen_internal, v_internal_id);

      if v_reward_id = any(seen_reward) then
        raise exception 'Duplicate reward_id: %', v_reward_id;
      end if;
      seen_reward := array_append(seen_reward, v_reward_id);

      v_min := (v_reward->>'min_val')::numeric;
      v_max := (v_reward->>'max_val')::numeric;
      if v_min is null or v_max is null or v_min >= v_max then
        raise exception 'Invalid min/max values for reward %', v_reward_id;
      end if;
    end loop;
  end if;

  -- Normalize p_reward_ids
  select coalesce(
    array_agg(distinct normalized_id order by normalized_id),
    '{}'::text[]
  )
  into v_reward_ids
  from (
    select nullif(trim(value), '') as normalized_id
    from unnest(
      coalesce(p_reward_ids, '{}'::text[])
    ) as t(value)
  ) s
  where normalized_id is not null;

  if v_is_v2 then
    -- Extract reward IDs from settings
    select coalesce(
      array_agg(distinct r_id order by r_id),
      '{}'::text[]
    )
    into v_settings_reward_ids
    from (
      select nullif(trim(reward->>'reward_id'), '') as r_id
      from jsonb_array_elements(
        p_settings->'rewards'
      ) reward
    ) s
    where r_id is not null;

    if v_settings_reward_ids <> v_reward_ids then
      raise exception 'reward_ids do not match settings.rewards';
    end if;
  end if;

  v_lock_key := ('x' || substr(md5(p_broadcaster_id), 1, 16))::bit(64)::bigint;
  perform pg_advisory_xact_lock(v_lock_key);

  -- Fetch existing to see if legacy assets migration is needed
  select assets into v_assets
  from public.overlay_configs
  where user_id = p_broadcaster_id and overlay_type = 'fate'
  for update;

  if v_assets is null or jsonb_typeof(v_assets) is distinct from 'object' then
    v_assets := '{}'::jsonb;
  end if;

  -- Legacy migration: If saving V2 and fate_rewards missing, copy global assets
  if v_is_v2 and jsonb_typeof(v_assets->'fate_rewards') is distinct from 'object' then
    v_legacy_assets := jsonb_build_object(
      'panel_bg', v_assets->>'panel_bg',
      'reward_icon', v_assets->>'reward_icon',
      'sound_in', v_assets->>'sound_in',
      'sound_loop', v_assets->>'sound_loop',
      'sound_win', v_assets->>'sound_win',
      'sound_lose', v_assets->>'sound_lose',
      'sound_out', v_assets->>'sound_out'
    );
    -- remove nulls
    v_legacy_assets := (select jsonb_object_agg(key, value) from jsonb_each(v_legacy_assets) where jsonb_typeof(value) is distinct from 'null');
    if v_legacy_assets is null then v_legacy_assets := '{}'::jsonb; end if;

    v_assets := jsonb_set(v_assets, '{fate_rewards}', '{}'::jsonb);

    if jsonb_array_length(p_settings->'rewards') > 0 then
      v_internal_id := trim((p_settings->'rewards'->0)->>'internal_id');
      v_assets := jsonb_set(v_assets, array['fate_rewards', v_internal_id], v_legacy_assets);
    end if;
  end if;

  insert into public.overlay_configs (user_id, overlay_type, settings, assets, updated_at)
  values (p_broadcaster_id, 'fate', p_settings, v_assets, now())
  on conflict (user_id, overlay_type) do update
  set settings = excluded.settings, assets = excluded.assets, updated_at = now()
  returning id into v_config_id;

  delete from public.twitch_reward_bindings
  where broadcaster_id = p_broadcaster_id
    and product_type = 'fate'
    and not (
      twitch_reward_id = any(v_reward_ids)
    );

  foreach v_reward_id in array v_reward_ids loop
    insert into public.twitch_reward_bindings (broadcaster_id, twitch_reward_id, product_type, resource_id)
    values (p_broadcaster_id, v_reward_id, 'fate', v_config_id::text)
    on conflict (broadcaster_id, twitch_reward_id) do nothing;

    select product_type
    into v_owner
    from public.twitch_reward_bindings
    where broadcaster_id = p_broadcaster_id
      and twitch_reward_id = v_reward_id
    for update;

    if not found then
      raise exception 'Failed to claim reward binding %', v_reward_id;
    end if;

    if v_owner is distinct from 'fate' then
      raise exception 'Награда % уже используется в %', v_reward_id, coalesce(v_owner, 'unknown');
    end if;

    update public.twitch_reward_bindings
    set resource_id = v_config_id::text,
        updated_at = now()
    where broadcaster_id = p_broadcaster_id
      and twitch_reward_id = v_reward_id
      and product_type = 'fate';

    if not found then
      raise exception 'Failed to update reward binding %', v_reward_id;
    end if;
  end loop;
end;
$$;

-- 2. SAVE FATE REWARD ASSET (ATOMIC ASSET UPDATE)
create or replace function public.save_fate_reward_asset(
  p_broadcaster_id text,
  p_internal_id text,
  p_asset_key text,
  p_asset_url text
) returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_lock_key bigint;
  v_current_assets jsonb;
  v_settings jsonb;
  v_found boolean;
  v_reward jsonb;
begin
  p_broadcaster_id := trim(p_broadcaster_id);
  p_internal_id := trim(p_internal_id);
  p_asset_key := trim(p_asset_key);
  p_asset_url := trim(p_asset_url);

  if p_broadcaster_id is null or p_broadcaster_id = '' then
    raise exception 'p_broadcaster_id is required';
  end if;
  if p_internal_id is null or p_internal_id = '' then
    raise exception 'p_internal_id is required';
  end if;
  if p_asset_key is null or p_asset_key = '' then
    raise exception 'p_asset_key is required';
  end if;
  if p_asset_url is null or p_asset_url = '' then
    raise exception 'p_asset_url is required';
  end if;

  if p_asset_key not in ('panel_bg', 'reward_icon', 'sound_in', 'sound_loop', 'sound_win', 'sound_lose', 'sound_out') then
    raise exception 'Invalid asset key: %', p_asset_key;
  end if;

  v_lock_key := ('x' || substr(md5(p_broadcaster_id), 1, 16))::bit(64)::bigint;
  perform pg_advisory_xact_lock(v_lock_key);

  select settings, assets into v_settings, v_current_assets
  from public.overlay_configs
  where user_id = p_broadcaster_id and overlay_type = 'fate'
  for update;

  if v_settings is null then
    raise exception 'Config not found';
  end if;

  v_found := false;
  if jsonb_typeof(v_settings->'rewards') = 'array' then
    for v_reward in select * from jsonb_array_elements(v_settings->'rewards') loop
      if trim(v_reward->>'internal_id') = p_internal_id then
        v_found := true;
        exit;
      end if;
    end loop;
  end if;

  if not v_found then
    raise exception 'Reward % not found in settings', p_internal_id;
  end if;

  if v_current_assets is null or jsonb_typeof(v_current_assets) is distinct from 'object' then
    v_current_assets := '{}'::jsonb;
  end if;

  if jsonb_typeof(v_current_assets->'fate_rewards') is distinct from 'object' then
    v_current_assets := jsonb_set(v_current_assets, '{fate_rewards}', '{}'::jsonb);
  end if;

  if jsonb_typeof(v_current_assets->'fate_rewards'->p_internal_id) is distinct from 'object' then
    v_current_assets := jsonb_set(v_current_assets, array['fate_rewards', p_internal_id], '{}'::jsonb);
  end if;

  v_current_assets := jsonb_set(v_current_assets, array['fate_rewards', p_internal_id, p_asset_key], to_jsonb(p_asset_url));

  update public.overlay_configs
  set assets = v_current_assets, updated_at = now()
  where user_id = p_broadcaster_id and overlay_type = 'fate';

  if not found then
    raise exception 'Failed to update overlay_configs';
  end if;

end;
$$;

-- 3. LEGACY WRAPPER WITH SECURITY DEFINER
create or replace function public.save_fate_reward_binding(
  p_broadcaster_id text,
  p_reward_id text,
  p_settings jsonb
) returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_arr text[];
begin
  if trim(p_reward_id) is not null and trim(p_reward_id) <> '' then
    v_arr := array[trim(p_reward_id)];
  else
    v_arr := array[]::text[];
  end if;
  perform public.save_fate_reward_bindings(p_broadcaster_id, v_arr, p_settings);
end;
$$;

revoke execute on function public.save_fate_reward_bindings(text, text[], jsonb) from public, anon, authenticated;
revoke execute on function public.save_fate_reward_binding(text, text, jsonb) from public, anon, authenticated;
revoke execute on function public.save_fate_reward_asset(text, text, text, text) from public, anon, authenticated;

grant execute on function public.save_fate_reward_bindings(text, text[], jsonb) to service_role;
grant execute on function public.save_fate_reward_binding(text, text, jsonb) to service_role;
grant execute on function public.save_fate_reward_asset(text, text, text, text) to service_role;

-- DIAGNOSTICS
select
  broadcaster_id,
  twitch_reward_id,
  product_type,
  resource_id
from public.twitch_reward_bindings
where product_type = 'fate'
order by broadcaster_id, twitch_reward_id;

select
  user_id,
  settings->>'version' as version,
  case
    when jsonb_typeof(settings->'rewards') = 'array'
    then jsonb_array_length(settings->'rewards')
    else 0
  end as reward_count
from public.overlay_configs
where overlay_type = 'fate';
