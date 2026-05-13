import { NextRequest, NextResponse } from "next/server";

const CANONICAL_HOST = "paracetamolhaze-six.vercel.app";
const CANONICAL_REDIRECT_HOSTS = new Set([
  "paracetamolhaze.ru",
  "www.paracetamolhaze.ru",
  "paracetamolhaze.online",
  "www.paracetamolhaze.online",
]);

const LOTTOMAL_URL = process.env.NEXT_PUBLIC_LOTOMAL_URL || "https://lotomal.paracetamol.workers.dev";
const LOTTOMAL_HOSTS = new Set([
  "lotomal.paracetamolhaze.ru",
  "lotomal.paracetamolhaze.online",
]);

function getHost(request: NextRequest): string {
  const hostHeader = request.headers.get("host") || "";
  return hostHeader.split(":")[0].toLowerCase();
}

export function middleware(request: NextRequest) {
  const host = getHost(request);

  if (CANONICAL_REDIRECT_HOSTS.has(host)) {
    const target = new URL(request.nextUrl);
    target.protocol = "https:";
    target.host = CANONICAL_HOST;
    return NextResponse.redirect(target, 308);
  }

  if (!LOTTOMAL_HOSTS.has(host)) return NextResponse.next();

  const target = new URL(LOTTOMAL_URL);
  target.pathname = request.nextUrl.pathname;
  target.search = request.nextUrl.search;
  return NextResponse.redirect(target, 307);
}

export const config = {
  matcher: "/:path*",
};
