import type { Metadata } from "next";
import DetectiveClient from "./DetectiveClient";

export const metadata: Metadata = {
  title: "Детектив // закрытый архив",
  description: "Закрытый архив браузерных ARG-расследований.",
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
