import type { Metadata } from "next";
import DetectiveClient from "./DetectiveClient";

export const metadata: Metadata = {
  title: "Habarhub (стример)",
  description: "Энциклопедическая страница о стримере Habarhub.",
  robots: {
    index: false,
    follow: false,
    nocache: true,
    googleBot: {
      index: false,
      follow: false,
      noimageindex: true,
    },
  },
};

export default function DetectivePage() {
  return <DetectiveClient />;
}
