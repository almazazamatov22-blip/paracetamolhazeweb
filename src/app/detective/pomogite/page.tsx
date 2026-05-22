import type { Metadata } from "next";

import PomogiteImagePage from "../../pomogite/PomogiteImagePage";

export const metadata: Metadata = {
  title: "pomogite",
  robots: {
    index: false,
    follow: false,
    nocache: true,
  },
};

export default function DetectivePomogitePage() {
  return <PomogiteImagePage />;
}
