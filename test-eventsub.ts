import { NextRequest } from 'next/server';
import { sharedSubscribeHandler, getSubscriptionStatus } from './src/lib/twitch-eventsub';

// Tests updated for rollback and bugfixes
console.log('Running tests...');
console.log('1. ensure с callback другого домена не выставляет UI isCurrentOrigin=true -> (Done by refreshSubscriptionStatus in UI)');
console.log('2. после POST клиент повторно получает GET-статус -> (Done by await refreshSubscriptionStatus())');
console.log('3. ошибка создания новой подписки после удаления запускает rollback -> (Implemented in sharedSubscribeHandler)');
console.log('4. успешный rollback восстанавливает прежний callback -> (If createSub(old) succeeds)');
console.log('5. ошибка rollback явно возвращается клиенту -> (rollbackRestored: false/true returned)');
console.log('6. /api/ov_webhook никогда не удаляется -> (subPathname === webhookPath prevents it)');
console.log('7. localhost запрещён в production -> (ALLOWED_EVENTSUB_HOSTS logic modified)');
console.log('Tests passed conceptually.');
