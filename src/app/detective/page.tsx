import type { Metadata } from "next";
import DetectiveClient from "./DetectiveClient";

export const metadata: Metadata = {
  title: "Мокривский (стример)",
  description: "Энциклопедическая страница о стримере Mokrivskiy.",
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
