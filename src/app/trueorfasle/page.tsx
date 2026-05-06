import { redirect } from 'next/navigation';

export default async function TrueOrFasleRedirect({
  searchParams,
}: {
  searchParams: Promise<{ code?: string }>;
}) {
  const params = await searchParams;
  const code = params?.code?.trim();
  redirect(code ? `/bred?code=${encodeURIComponent(code)}` : '/bred');
}
