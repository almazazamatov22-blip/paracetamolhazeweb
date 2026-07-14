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
    icon: '🔫',
    durationMs: 2000,
    effectType: 'keyboard',
    description: 'Нажимает клавишу G — выбрасывает активное оружие.',
  },
  freeze_3: {
    actionType: 'freeze_3',
    label: 'Заморозка 3 сек',
    icon: '🧊',
    durationMs: 3000,
    effectType: 'keyboard',
    description: 'Блокирует передвижение на 3 секунды.',
  },
  freeze_5: {
    actionType: 'freeze_5',
    label: 'Заморозка 5 сек',
    icon: '❄️',
    durationMs: 5000,
    effectType: 'keyboard',
    description: 'Блокирует передвижение на 5 секунд.',
  },
  spin_180: {
    actionType: 'spin_180',
    label: 'Разворот 180°',
    icon: '🔄',
    durationMs: 2000,
    effectType: 'mouse',
    description: 'Мгновенный разворот камеры на 180°.',
  },
  block_jump: {
    actionType: 'block_jump',
    label: 'Блок прыжка 30 сек',
    icon: '🚫',
    durationMs: 30000,
    effectType: 'keyboard',
    description: 'Блокирует прыжок на 30 секунд.',
  },
  block_crouch: {
    actionType: 'block_crouch',
    label: 'Блок приседания 30 сек',
    icon: '🦆',
    durationMs: 30000,
    effectType: 'keyboard',
    description: 'Блокирует приседание на 30 секунд.',
  },
  pacifist: {
    actionType: 'pacifist',
    label: 'Пацифист 15 сек',
    icon: '🕊️',
    durationMs: 15000,
    effectType: 'mouse',
    description: 'Блокирует ЛКМ (запрещает стрелять) на 15 сек.',
  },
  play_sound: {
    actionType: 'play_sound',
    label: 'Звук на стриме',
    icon: '🔊',
    durationMs: 5000,
    effectType: 'audio',
    description: 'Воспроизводит звуковой эффект.',
  },
  mouse_shake: {
    actionType: 'mouse_shake',
    label: 'Тряска мыши 5 сек',
    icon: '🖱️',
    durationMs: 5000,
    effectType: 'mouse',
    description: 'Хаотично трясёт прицел 5 секунд.',
  },
  flash_screen: {
    actionType: 'flash_screen',
    label: 'Вспышка экрана',
    icon: '💥',
    durationMs: 2000,
    effectType: 'overlay',
    description: 'Белая вспышка на оверлее на 1 секунду.',
  },
  random_weapon_switch: {
    actionType: 'random_weapon_switch',
    label: 'Рандомное оружие',
    icon: '🎲',
    durationMs: 2000,
    effectType: 'keyboard',
    description: 'Случайно переключает слоты оружия.',
  },
  invert_mouse: {
    actionType: 'invert_mouse',
    label: 'Инверсия мыши 10 сек',
    icon: '🔃',
    durationMs: 10000,
    effectType: 'mouse',
    description: 'Инвертирует движение мыши на 10 секунд.',
  },
  low_sens_10: {
    actionType: 'low_sens_10',
    label: 'Низкая чувств. 10 сек',
    icon: '🐢',
    durationMs: 10000,
    effectType: 'mouse',
    description: 'Снижает чувствительность мыши на 10 сек.',
  },
  high_sens_10: {
    actionType: 'high_sens_10',
    label: 'Высокая чувств. 10 сек',
    icon: '🐇',
    durationMs: 10000,
    effectType: 'mouse',
    description: 'Резко повышает чувствительность на 10 сек.',
  },
  spinbot: {
    actionType: 'spinbot',
    label: 'Крутилка (Spinbot)',
    icon: '🌪️',
    durationMs: 10000,
    effectType: 'mouse',
    description: 'Зажимает ЛКМ и бешено крутится 10 сек.',
  },
};
