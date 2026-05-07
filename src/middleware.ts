import { NextRequest, NextResponse } from "next/server";

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
  if (!LOTTOMAL_HOSTS.has(getHost(request))) return NextResponse.next();

  const target = new URL(LOTTOMAL_URL);
  target.pathname = request.nextUrl.pathname;
  target.search = request.nextUrl.search;
  return NextResponse.redirect(target, 307);
}

export const config = {
  matcher: "/:path*",
};
