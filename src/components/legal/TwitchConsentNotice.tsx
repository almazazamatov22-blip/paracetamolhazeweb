import Link from "next/link";

export function TwitchConsentNotice() {
  return (
    <div className="mt-4 text-center text-[10px] sm:text-xs text-white/50 leading-relaxed max-w-sm mx-auto">
      Продолжая авторизацию, вы подтверждаете, что вам исполнилось 13 лет, и соглашаетесь с{" "}
      <Link href="/privacy" className="underline decoration-white/20 hover:text-white/80 underline-offset-2">
        Политикой конфиденциальности
      </Link>{" "}
      и{" "}
      <Link href="/terms" className="underline decoration-white/20 hover:text-white/80 underline-offset-2">
        Условиями использования
      </Link>.
      <span className="opacity-70 mt-1.5 block">
        Использование допускается под надзором родителя или законного представителя.
      </span>
    </div>
  );
}
