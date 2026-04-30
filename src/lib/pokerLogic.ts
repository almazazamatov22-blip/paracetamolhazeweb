/**
 * ПОКЕРНЫЙ ДВИЖОК (Texas Hold'em) — ИСПРАВЛЕННАЯ ВЕРСИЯ
 * Фиксы: hasActed флаг, BB-опция, check-логика, корректное завершение круга
 */

export type Suit = 'H' | 'D' | 'C' | 'S';
export type Value = '2' | '3' | '4' | '5' | '6' | '7' | '8' | '9' | 'T' | 'J' | 'Q' | 'K' | 'A';

export interface Card {
    suit: Suit;
    value: Value;
}

export interface PokerPlayer {
    id: string;
    name: string;
    chips: number;
    bet: number;         // Ставка в текущем раунде
    totalBet: number;    // Общая ставка за всю раздачу (для side-потов)
    cards: Card[];
    folded: boolean;
    allIn: boolean;
    hasActed: boolean;   // FIX: действовал ли игрок в текущем круге ставок
    isDealer: boolean;
    isSmallBlind: boolean;
    isBigBlind: boolean;
}

export interface SidePot {
    amount: number;
    eligiblePlayerIds: string[];
}

export interface PokerGameState {
    players: PokerPlayer[];
    pot: number;
    sidePots: SidePot[];
    currentBet: number;
    dealerIndex: number;
    activePlayerIndex: number;
    phase: 'waiting' | 'preflop' | 'flop' | 'turn' | 'river' | 'showdown';
    communityCards: Card[];
    lastRaiserId: string | null;
    deck: Card[];
    winners?: { id: string; handName: string }[];
}

const VALUE_RANKS: Record<Value, number> = {
    '2': 2, '3': 3, '4': 4, '5': 5, '6': 6, '7': 7, '8': 8, '9': 9,
    'T': 10, 'J': 11, 'Q': 12, 'K': 13, 'A': 14
};

const HAND_RANKS = {
    HIGH_CARD: 0, PAIR: 1, TWO_PAIR: 2, THREE_KIND: 3, STRAIGHT: 4,
    FLUSH: 5, FULL_HOUSE: 6, FOUR_KIND: 7, STRAIGHT_FLUSH: 8, ROYAL_FLUSH: 9
};

export const PokerLogic = {

    /** Создание и тасовка колоды (Fisher-Yates) */
    createDeck(): Card[] {
        const suits: Suit[] = ['H', 'D', 'C', 'S'];
        const values: Value[] = ['2', '3', '4', '5', '6', '7', '8', '9', 'T', 'J', 'Q', 'K', 'A'];
        const deck: Card[] = [];
        for (const s of suits) {
            for (const v of values) {
                deck.push({ suit: s, value: v });
            }
        }
        // Fisher-Yates shuffle
        for (let i = deck.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [deck[i], deck[j]] = [deck[j], deck[i]];
        }
        return deck;
    },

    /** Подготовка новой раздачи */
    prepareNewHand(players: any[], dealerIndex: number, blindValue: number, buyIn: number, anteValue: number = 0): PokerGameState {
        if (players.length < 2) {
            throw new Error('Нужно минимум 2 игрока');
        }

        const deck = this.createDeck();
        const n = players.length;
        const dIdx = dealerIndex % n;

        // Heads-up (2 игрока): дилер = SB, другой = BB
        // Обычная игра: SB = следующий после дилера, BB = следующий после SB
        const sbIdx = n === 2 ? dIdx : (dIdx + 1) % n;
        const bbIdx = n === 2 ? (dIdx + 1) % n : (dIdx + 2) % n;

        const sbAmount = blindValue;
        const bbAmount = blindValue * 2;

        let initialPot = 0;

        const pokerPlayers: PokerPlayer[] = players.map((p, i) => {
            // Берём фишки из предыдущей раздачи или из buyIn
            let chips = (typeof p.chips === 'number' && p.chips > 0) ? p.chips : buyIn;
            let bet = 0;
            let isAllIn = false;

            // Анте собирается со всех игроков
            if (anteValue > 0 && chips > 0) {
                const actualAnte = Math.min(chips, anteValue);
                chips -= actualAnte;
                initialPot += actualAnte;
                if (chips === 0) isAllIn = true;
            }

            if (i === sbIdx && chips > 0) {
                const actual = Math.min(chips, sbAmount);
                chips -= actual;
                bet = actual;
                if (chips === 0) isAllIn = true;
            } else if (i === bbIdx && chips > 0) {
                const actual = Math.min(chips, bbAmount);
                chips -= actual;
                bet = actual;
                if (chips === 0) isAllIn = true;
            }

            // Раздаём по 2 карты каждому
            const card1 = deck.pop()!;
            const card2 = deck.pop()!;

            return {
                id: String(p.id),
                name: p.display_name || p.name || `Player ${i + 1}`,
                chips,
                allIn: isAllIn,
                bet,
                totalBet: bet,
                cards: [card1, card2],
                folded: false,
                hasActed: false, // FIX: никто не действовал в начале круга
                isDealer: i === dIdx,
                isSmallBlind: i === sbIdx,
                isBigBlind: i === bbIdx,
            };
        });

        // Pre-flop: первый ход у игрока слева от BB (или BB в heads-up)
        const firstToActPreflop = n === 2 ? sbIdx : (bbIdx + 1) % n;
        // Пропускаем all-in игроков
        let activeStart = firstToActPreflop;
        let loops = 0;
        while (pokerPlayers[activeStart].allIn && loops < n) {
            activeStart = (activeStart + 1) % n;
            loops++;
        }

        return {
            players: pokerPlayers,
            pot: pokerPlayers.reduce((sum, p) => sum + p.bet, 0) + initialPot,
            sidePots: [],
            currentBet: bbAmount,
            dealerIndex: dIdx,
            activePlayerIndex: activeStart,
            phase: 'preflop',
            communityCards: [],
            lastRaiserId: pokerPlayers[bbIdx].id, // BB — последний "рейзер" в pre-flop
            deck,
        };
    },

    /** Обработка действия игрока */
    handleAction(
        state: PokerGameState,
        playerId: string,
        action: 'fold' | 'call' | 'raise' | 'check' | 'allIn',
        amount?: number
    ): PokerGameState {
        // Глубокое копирование состояния
        const newState: PokerGameState = JSON.parse(JSON.stringify(state));
        const pIdx = newState.players.findIndex(p => p.id === playerId);

        if (pIdx === -1 || newState.phase === 'showdown' || newState.phase === 'waiting') {
            return state;
        }

        const player = newState.players[pIdx];

        // Помечаем что игрок действовал
        player.hasActed = true;

        if (action === 'fold') {
            player.folded = true;

        } else if (action === 'check') {
            // Check возможен только если нет ставки или ставка игрока уже равна currentBet
            if (player.bet < newState.currentBet) {
                // Нельзя чекнуть — делаем колл
                return this.handleAction(state, playerId, 'call');
            }
            // Иначе просто check (ничего не меняем в ставках, hasActed = true уже)

        } else if (action === 'call') {
            const needed = newState.currentBet - player.bet;
            if (needed <= 0) {
                // Ставка уже равна currentBet — это фактически check
                // hasActed уже true, просто продолжаем
            } else {
                const actual = Math.min(player.chips, needed);
                player.chips -= actual;
                player.bet += actual;
                player.totalBet += actual;
                newState.pot += actual;
                if (player.chips === 0) player.allIn = true;
            }

        } else if (action === 'raise' || action === 'allIn') {
            const isAllIn = action === 'allIn' || (amount !== undefined && amount >= player.chips + player.bet);
            const raiseTo = isAllIn ? (player.chips + player.bet) : (amount || newState.currentBet * 2);
            const needed = raiseTo - player.bet;
            const actual = Math.min(player.chips, needed);

            player.chips -= actual;
            player.bet += actual;
            player.totalBet += actual;
            newState.pot += actual;

            if (player.chips === 0) player.allIn = true;

            // Рейз сбрасывает hasActed у всех остальных активных игроков
            if (player.bet > newState.currentBet) {
                newState.currentBet = player.bet;
                newState.lastRaiserId = player.id;

                // FIX: все кроме текущего игрока должны ответить на рейз
                newState.players.forEach((p, i) => {
                    if (i !== pIdx && !p.folded && !p.allIn) {
                        p.hasActed = false;
                    }
                });
                // Текущий игрок уже действовал (рейзнул)
                player.hasActed = true;
            }
        }

        // Проверка: остался ли только один активный игрок
        const activePlayers = newState.players.filter(p => !p.folded);
        if (activePlayers.length === 1) {
            return this.resolveOneWinner(newState, activePlayers[0]);
        }

        // FIX: Проверяем завершение круга ставок через hasActed
        const roundComplete = this.isRoundComplete(newState);

        if (roundComplete) {
            return this.nextPhase(newState);
        }

        // Находим следующего игрока который должен действовать
        newState.activePlayerIndex = this.findNextActivePlayer(newState, pIdx);
        return newState;
    },

    /**
     * FIX: Круг завершён если все активные (не сфолдившие, не all-in) игроки:
     * 1. Действовали (hasActed = true)
     * 2. Их ставка равна currentBet
     */
    isRoundComplete(state: PokerGameState): boolean {
        const playersWhoNeedToAct = state.players.filter(p =>
            !p.folded && !p.allIn && (!p.hasActed || p.bet < state.currentBet)
        );
        return playersWhoNeedToAct.length === 0;
    },

    /** Находим следующего игрока которому нужно действовать */
    findNextActivePlayer(state: PokerGameState, fromIdx: number): number {
        const n = state.players.length;
        let nextIdx = (fromIdx + 1) % n;
        let loops = 0;
        while (loops < n) {
            const p = state.players[nextIdx];
            const needsToAct = !p.folded && !p.allIn && (!p.hasActed || p.bet < state.currentBet);
            if (needsToAct) return nextIdx;
            nextIdx = (nextIdx + 1) % n;
            loops++;
        }
        // Все уже действовали — вернуть любого не-сфолдившего
        return fromIdx;
    },

    /** Переход к следующей фазе */
    nextPhase(state: PokerGameState): PokerGameState {
        if (state.phase === 'showdown' || state.phase === 'waiting') return state;

        // Сброс ставок и флагов действий
        state.players.forEach(p => {
            p.bet = 0;
            p.hasActed = false;
        });
        state.currentBet = 0;
        state.lastRaiserId = null;

        const drawCard = () => {
            const card = state.deck.pop();
            if (!card) return { suit: 'S', value: '2' } as Card; // Fallback
            return card;
        };

        // Выкладываем карты на стол
        if (state.phase === 'preflop') {
            state.phase = 'flop';
            // Флоп: 3 карты
            state.communityCards.push(drawCard(), drawCard(), drawCard());
        } else if (state.phase === 'flop') {
            state.phase = 'turn';
            state.communityCards.push(drawCard());
        } else if (state.phase === 'turn') {
            state.phase = 'river';
            state.communityCards.push(drawCard());
        } else if (state.phase === 'river') {
            state.phase = 'showdown';
            return this.resolveShowdown(state);
        }

        // После флопа: ход с первого активного игрока слева от дилера
        const n = state.players.length;
        let nextIdx = (state.dealerIndex + 1) % n;
        let loops = 0;
        while (loops < n) {
            const p = state.players[nextIdx];
            if (!p.folded && !p.allIn) break;
            nextIdx = (nextIdx + 1) % n;
            loops++;
        }
        state.activePlayerIndex = nextIdx;
        state.lastRaiserId = state.players[nextIdx].id;

        // Если все остальные all-in (или сфолдили) — переходим сразу
        // Раньше тут была рекурсия, убрали её чтобы UI успевал показывать карты
        return state;
    },

    /** Один победитель (все сфолдили) */
    resolveOneWinner(state: PokerGameState, winner: PokerPlayer): PokerGameState {
        const wIdx = state.players.findIndex(p => p.id === winner.id);
        if (wIdx !== -1) {
            state.players[wIdx].chips += state.pot;
        }
        state.pot = 0;
        state.phase = 'showdown';
        state.winners = [{ id: winner.id, handName: 'Все сфолдили' }];
        return state;
    },

    /** Оценка силы руки (7 карт → лучшая 5-карточная) */
    evaluateHand(cards: Card[]): number {
        if (cards.length < 5) return 0;

        const ranks = cards.map(c => VALUE_RANKS[c.value]).sort((a, b) => b - a);
        const suits = cards.map(c => c.suit);

        const counts: Record<number, number> = {};
        ranks.forEach(r => counts[r] = (counts[r] || 0) + 1);
        const freq = Object.entries(counts)
            .map(([r, c]) => ({ r: parseInt(r), c }))
            .sort((a, b) => b.c - a.c || b.r - a.r);

        // Флеш
        const suitCounts: Record<string, number> = {};
        suits.forEach(s => suitCounts[s] = (suitCounts[s] || 0) + 1);
        const flushSuit = Object.keys(suitCounts).find(s => suitCounts[s] >= 5);
        const isFlush = !!flushSuit;

        // Стрит
        const uniqueRanks = Array.from(new Set(ranks)).sort((a, b) => b - a);
        if (uniqueRanks.includes(14)) uniqueRanks.push(1); // A-2-3-4-5
        let straightHigh = -1;
        for (let i = 0; i <= uniqueRanks.length - 5; i++) {
            if (uniqueRanks[i] - uniqueRanks[i + 4] === 4) {
                straightHigh = uniqueRanks[i];
                break;
            }
        }
        const isStraight = straightHigh !== -1;

        // Стрит-флеш / Роял-флеш
        if (isFlush && isStraight) {
            const flushCards = cards
                .filter(c => c.suit === flushSuit)
                .map(c => VALUE_RANKS[c.value]);
            const fUnique = Array.from(new Set(flushCards)).sort((a, b) => b - a);
            if (fUnique.includes(14)) fUnique.push(1);
            for (let i = 0; i <= fUnique.length - 5; i++) {
                if (fUnique[i] - fUnique[i + 4] === 4) {
                    const isRoyal = fUnique[i] === 14;
                    return (isRoyal ? HAND_RANKS.ROYAL_FLUSH : HAND_RANKS.STRAIGHT_FLUSH) * 1e10 + fUnique[i];
                }
            }
        }

        if (freq[0].c === 4)
            return HAND_RANKS.FOUR_KIND * 1e10 + freq[0].r * 1e2 + freq[1].r;

        if (freq[0].c === 3 && freq.length > 1 && freq[1].c >= 2)
            return HAND_RANKS.FULL_HOUSE * 1e10 + freq[0].r * 1e2 + freq[1].r;

        if (isFlush) {
            const flushCards = cards
                .filter(c => c.suit === flushSuit)
                .map(c => VALUE_RANKS[c.value])
                .sort((a, b) => b - a);
            return HAND_RANKS.FLUSH * 1e10 +
                flushCards.slice(0, 5).reduce((acc, r, i) => acc + r * Math.pow(15, 4 - i), 0);
        }

        if (isStraight)
            return HAND_RANKS.STRAIGHT * 1e10 + straightHigh;

        if (freq[0].c === 3)
            return HAND_RANKS.THREE_KIND * 1e10 + freq[0].r * 1e4 + (freq[1]?.r || 0) * 1e2 + (freq[2]?.r || 0);

        if (freq[0].c === 2 && freq.length > 1 && freq[1].c === 2)
            return HAND_RANKS.TWO_PAIR * 1e10 + freq[0].r * 1e4 + freq[1].r * 1e2 + (freq[2]?.r || 0);

        if (freq[0].c === 2)
            return HAND_RANKS.PAIR * 1e10 + freq[0].r * 1e8 +
                ranks.filter(r => r !== freq[0].r).slice(0, 3)
                    .reduce((acc, r, i) => acc + r * Math.pow(15, 2 - i), 0);

        return HAND_RANKS.HIGH_CARD * 1e10 +
            ranks.slice(0, 5).reduce((acc, r, i) => acc + r * Math.pow(15, 4 - i), 0);
    },

    getHandName(score: number): string {
        const rank = Math.floor(score / 1e10);
        const subScore = score % 1e10;
        
        const names = [
            'Старшая карта', 'Пара', 'Две пары', 'Сет',
            'Стрит', 'Флеш', 'Фулл-Хаус', 'Каре',
            'Стрит-Флеш', 'Рояль-Флеш'
        ];

        const rankToName = (r: number) => {
            const valNames: Record<number, string> = {
                2: '2', 3: '3', 4: '4', 5: '5', 6: '6', 7: '7', 8: '8', 9: '9',
                10: '10', 11: 'Валетов', 12: 'Дам', 13: 'Королей', 14: 'Тузов'
            };
            return valNames[r] || '';
        };

        if (rank === 1) { // Пара
            const r = Math.floor(subScore / 1e8);
            return `Пара ${rankToName(r)}`;
        }
        if (rank === 2) { // Две пары
            const r1 = Math.floor(subScore / 1e4);
            return `Две пары (${rankToName(r1)})`;
        }
        if (rank === 3) { // Сет
            const r = Math.floor(subScore / 1e4);
            return `Сет ${rankToName(r)}`;
        }
        if (rank === 7) { // Каре
             const r = Math.floor(subScore / 1e2);
             return `Каре ${rankToName(r)}`;
        }

        return names[rank] || 'Неизвестно';
    },

    findWinners(players: PokerPlayer[], communityCards: Card[]): { id: string; score: number; handName: string }[] {
        const scores = players.map(p => {
            if (p.folded) return { id: p.id, score: -1, handName: 'Folded' };
            const score = this.evaluateHand([...p.cards, ...communityCards]);
            return { id: p.id, score, handName: this.getHandName(score) };
        });
        const maxScore = Math.max(...scores.map(s => s.score));
        return scores.filter(s => s.score === maxScore);
    },

    resolveShowdown(state: PokerGameState): PokerGameState {
        // Основной пот
        const activePlayers = state.players.filter(p => !p.folded);
        const winners = this.findWinners(activePlayers, state.communityCards);
        const winAmount = Math.floor(state.pot / winners.length);

        winners.forEach(w => {
            const pIdx = state.players.findIndex(p => p.id === w.id);
            if (pIdx !== -1) state.players[pIdx].chips += winAmount;
        });

        state.pot = 0;
        state.phase = 'showdown';
        state.winners = winners.map(w => ({ id: w.id, handName: w.handName }));
        return state;
    }
};
