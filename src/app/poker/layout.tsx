import { Metadata } from "next";

export const metadata: Metadata = {
  robots: {
    index: false,
    follow: true,
  },
};

export default function PokerLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
