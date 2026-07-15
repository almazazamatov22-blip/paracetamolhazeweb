export type EffectType = 'keyboard' | 'mouse' | 'audio' | 'overlay';

export interface ActionConfig {
  actionType: string;
  label: string;
  icon: string;
  durationMs: number;
  effectType: EffectType;
  description: string;
}

export const ACTION_REGISTRY: Record<string, ActionConfig> = {
  drop_weapon: {
    actionType: 'drop_weapon',
    label: 'Выбросить оружие',
    icon: '/icons/drop_weapon.png',
    durationMs: 2000,
    effectType: 'keyboard',
    description: 'Нажимает клавишу G — выбрасывает активное оружие.',
  },
  freeze_3: {
    actionType: 'freeze_3',
    label: 'Заморозка 3 сек',
    icon: '/icons/freeze_3.png',
    durationMs: 3000,
    effectType: 'keyboard',
    description: 'Блокирует передвижение на 3 секунды.',
  },
  freeze_5: {
    actionType: 'freeze_5',
    label: 'Заморозка 5 сек',
    icon: '/icons/freeze_5.png',
    durationMs: 5000,
    effectType: 'keyboard',
    description: 'Блокирует передвижение на 5 секунд.',
  },
  spin_180: {
    actionType: 'spin_180',
    label: 'Разворот 180°',
    icon: '/icons/spin_180.png',
    durationMs: 2000,
    effectType: 'mouse',
    description: 'Мгновенный разворот на 180°.',
  },
  block_jump: {
    actionType: 'block_jump',
    label: 'Блок прыжка 30 сек',
    icon: '/icons/block_jump.png',
    durationMs: 30000,
    effectType: 'keyboard',
    description: 'Блокирует прыжок на 30 секунд.',
  },
  block_crouch: {
    actionType: 'block_crouch',
    label: 'Блок приседания 30 сек',
    icon: '/icons/block_crouch.png',
    durationMs: 30000,
    effectType: 'keyboard',
    description: 'Блокирует приседание на 30 секунд.',
  },
  play_sound: {
    actionType: 'play_sound',
    label: 'Звук хедшота',
    icon: '/icons/play_sound.png',
    durationMs: 2000,
    effectType: 'audio',
    description: 'Проигрывает звук хедшота на стриме.',
  },
  mouse_shake: {
    actionType: 'mouse_shake',
    label: 'Тряска мыши 5 сек',
    icon: '/icons/mouse_shake.png',
    durationMs: 5000,
    effectType: 'mouse',
    description: 'Хаотично трясёт прицел 5 секунд.',
  },
  flash_screen: {
    actionType: 'flash_screen',
    label: 'Флешка',
    icon: '/icons/flash_screen.png',
    durationMs: 3000,
    effectType: 'overlay',
    description: 'Белая вспышка на экране стрима с плавным затуханием.',
  },
  random_weapon_switch: {
    actionType: 'random_weapon_switch',
    label: 'Случайное оружие',
    icon: '/icons/random_weapon_switch.png',
    durationMs: 2000,
    effectType: 'keyboard',
    description: 'Случайно переключает слоты оружия.',
  },
  invert_mouse: {
    actionType: 'invert_mouse',
    label: 'Инверсия мыши 10 сек',
    icon: '/icons/invert_mouse.png',
    durationMs: 10000,
    effectType: 'mouse',
    description: 'Инвертирует движение мыши на 10 секунд.',
  },
  low_sens_10: {
    actionType: 'low_sens_10',
    label: 'Низкая чувств. 10 сек',
    icon: '/icons/low_sens_10.png',
    durationMs: 10000,
    effectType: 'mouse',
    description: 'Снижает чувствительность мыши на 10 сек.',
  },
  high_sens_10: {
    actionType: 'high_sens_10',
    label: 'Высокая чувств. 10 сек',
    icon: '/icons/high_sens_10.png',
    durationMs: 10000,
    effectType: 'mouse',
    description: 'Резко повышает чувствительность на 10 сек.',
  },
  spinbot: {
    actionType: 'spinbot',
    label: 'СпинБот',
    icon: '/icons/spinbot.png',
    durationMs: 10000,
    effectType: 'mouse',
    description: 'Зажимает ЛКМ и бешено крутится 10 сек.',
  },
};
