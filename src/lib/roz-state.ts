export type LotteryAutoMode = 'manual' | 'people' | 'tickets';

export interface RozLotteryEntry {
  id: string;
  redemption_id: string;
  user_id: string;
  username: string;
  login: string;
  avatar?: string | null;
  color: string;
  number: number;
  price: number;
  reward_id: string;
  reward_name: string;
  created_at: string;
}

export interface RozAuctionBid {
  id: string;
  redemption_id: string;
  user_id: string;
  username: string;
  login: string;
  avatar?: string | null;
  color: string;
  bid: number;
  cost: number;
  reward_id: string;
  reward_name: string;
  user_input: string;
  created_at: string;
}

export interface RozState {
  lottery_reward_id: string;
  lottery_reward_name: string;
  auction_reward_id: string;
  auction_reward_name: string;
  lottery_prize: string;
  auction_prize: string;
  lottery_auto_mode: LotteryAutoMode;
  lottery_target: number;
  lottery_entries: RozLotteryEntry[];
  auction_bids: RozAuctionBid[];
  lottery_winner: RozLotteryEntry | null;
  auction_winner: RozAuctionBid | null;
  updated_at: string | null;
}

interface RedemptionInput {
  redemptionId: string;
  userId: string;
  userLogin: string;
  userName: string;
  userAvatar?: string | null;
  userInput: string;
  rewardId: string;
  rewardName: string;
  rewardCost: number;
  redeemedAt?: string;
}

const COLORS = [
  '#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FFEAA7',
  '#DDA0DD', '#98D8C8', '#F7DC6F', '#BB8FCE', '#85C1E9',
  '#F0B27A', '#82E0AA', '#F1948A', '#85929E', '#73C6B6',
  '#E74C3C', '#3498DB', '#2ECC71', '#E67E22', '#9B59B6',
];

export const DEFAULT_ROZ_STATE: RozState = {
  lottery_reward_id: '',
  lottery_reward_name: '',
  auction_reward_id: '',
  auction_reward_name: '',
  lottery_prize: 'Приз стримера',
  auction_prize: 'Приз стримера',
  lottery_auto_mode: 'manual',
  lottery_target: 20,
  lottery_entries: [],
  auction_bids: [],
  lottery_winner: null,
  auction_winner: null,
  updated_at: null,
};

function asString(value: unknown) {
  return typeof value === 'string' ? value : '';
}

function asPositiveNumber(value: unknown, fallback: number) {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? Math.floor(number) : fallback;
}

function asAutoMode(value: unknown): LotteryAutoMode {
  return value === 'people' || value === 'tickets' || value === 'manual' ? value : 'manual';
}

function isObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value));
}

function normalizeLotteryEntry(value: unknown, index: number): RozLotteryEntry | null {
  if (!isObject(value)) return null;
  const id = asString(value.id) || asString(value.redemption_id);
  const username = asString(value.username);
  if (!id || !username) return null;

  return {
    id,
    redemption_id: asString(value.redemption_id) || id,
    user_id: asString(value.user_id),
    username,
    login: asString(value.login) || username.toLowerCase(),
    avatar: asString(value.avatar) || null,
    color: asString(value.color) || colorForUser(asString(value.login) || username),
    number: asPositiveNumber(value.number, index + 1),
    price: asPositiveNumber(value.price, 1),
    reward_id: asString(value.reward_id),
    reward_name: asString(value.reward_name),
    created_at: asString(value.created_at) || new Date().toISOString(),
  };
}

function normalizeAuctionBid(value: unknown): RozAuctionBid | null {
  if (!isObject(value)) return null;
  const id = asString(value.id) || asString(value.redemption_id);
  const username = asString(value.username);
  const bid = asPositiveNumber(value.bid, 0);
  if (!id || !username || bid <= 0) return null;

  return {
    id,
    redemption_id: asString(value.redemption_id) || id,
    user_id: asString(value.user_id),
    username,
    login: asString(value.login) || username.toLowerCase(),
    avatar: asString(value.avatar) || null,
    color: asString(value.color) || colorForUser(asString(value.login) || username),
    bid,
    cost: asPositiveNumber(value.cost, bid),
    reward_id: asString(value.reward_id),
    reward_name: asString(value.reward_name),
    user_input: asString(value.user_input),
    created_at: asString(value.created_at) || new Date().toISOString(),
  };
}

export function normalizeRozState(value: unknown): RozState {
  const raw = isObject(value) ? value : {};
  const lotteryEntries = Array.isArray(raw.lottery_entries)
    ? raw.lottery_entries.map(normalizeLotteryEntry).filter((entry): entry is RozLotteryEntry => Boolean(entry))
    : [];
  const auctionBids = Array.isArray(raw.auction_bids)
    ? raw.auction_bids.map(normalizeAuctionBid).filter((bid): bid is RozAuctionBid => Boolean(bid))
    : [];

  return {
    lottery_reward_id: asString(raw.lottery_reward_id),
    lottery_reward_name: asString(raw.lottery_reward_name),
    auction_reward_id: asString(raw.auction_reward_id),
    auction_reward_name: asString(raw.auction_reward_name),
    lottery_prize: asString(raw.lottery_prize) || DEFAULT_ROZ_STATE.lottery_prize,
    auction_prize: asString(raw.auction_prize) || DEFAULT_ROZ_STATE.auction_prize,
    lottery_auto_mode: asAutoMode(raw.lottery_auto_mode),
    lottery_target: asPositiveNumber(raw.lottery_target, DEFAULT_ROZ_STATE.lottery_target),
    lottery_entries: lotteryEntries,
    auction_bids: auctionBids,
    lottery_winner: normalizeLotteryEntry(raw.lottery_winner, 0),
    auction_winner: normalizeAuctionBid(raw.auction_winner),
    updated_at: asString(raw.updated_at) || null,
  };
}

export function colorForUser(value: string) {
  const text = value.toLowerCase();
  let hash = 0;
  for (let i = 0; i < text.length; i += 1) {
    hash = ((hash << 5) - hash) + text.charCodeAt(i);
    hash |= 0;
  }
  return COLORS[Math.abs(hash) % COLORS.length];
}

export function parseBidAmount(userInput: string, fallback: number) {
  const normalized = userInput.replace(/\s+/g, '');
  const match = normalized.match(/\d+/);
  const amount = match ? Number.parseInt(match[0], 10) : fallback;
  return Number.isFinite(amount) && amount > 0 ? amount : 0;
}

export function addLotteryEntry(state: RozState, input: RedemptionInput) {
  if (state.lottery_entries.some(entry => entry.redemption_id === input.redemptionId)) {
    return { state, changed: false };
  }

  const entry: RozLotteryEntry = {
    id: input.redemptionId,
    redemption_id: input.redemptionId,
    user_id: input.userId,
    username: input.userName,
    login: input.userLogin,
    avatar: input.userAvatar || null,
    color: colorForUser(input.userLogin || input.userName),
    number: state.lottery_entries.length + 1,
    price: input.rewardCost,
    reward_id: input.rewardId,
    reward_name: input.rewardName,
    created_at: input.redeemedAt || new Date().toISOString(),
  };

  return {
    changed: true,
    state: {
      ...state,
      lottery_entries: [...state.lottery_entries, entry].slice(-1000),
      lottery_winner: null,
      updated_at: new Date().toISOString(),
    },
  };
}

export function addAuctionBid(state: RozState, input: RedemptionInput) {
  if (state.auction_bids.some(bid => bid.redemption_id === input.redemptionId)) {
    return { state, changed: false };
  }

  const bidAmount = parseBidAmount(input.userInput, input.rewardCost);
  if (bidAmount <= 0) return { state, changed: false };

  const bid: RozAuctionBid = {
    id: input.redemptionId,
    redemption_id: input.redemptionId,
    user_id: input.userId,
    username: input.userName,
    login: input.userLogin,
    avatar: input.userAvatar || null,
    color: colorForUser(input.userLogin || input.userName),
    bid: bidAmount,
    cost: input.rewardCost,
    reward_id: input.rewardId,
    reward_name: input.rewardName,
    user_input: input.userInput,
    created_at: input.redeemedAt || new Date().toISOString(),
  };

  return {
    changed: true,
    state: {
      ...state,
      auction_bids: [...state.auction_bids, bid].slice(-1000),
      auction_winner: null,
      updated_at: new Date().toISOString(),
    },
  };
}

export function getBestAuctionBid(bids: RozAuctionBid[]) {
  return bids.reduce<RozAuctionBid | null>((best, bid) => {
    if (!best) return bid;
    if (bid.bid > best.bid) return bid;
    if (bid.bid === best.bid && Date.parse(bid.created_at) < Date.parse(best.created_at)) return bid;
    return best;
  }, null);
}
