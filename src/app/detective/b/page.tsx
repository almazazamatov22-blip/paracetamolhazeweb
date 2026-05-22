import type { Metadata } from "next";

import BWall from "../../b/BWall";

export const metadata: Metadata = {
  title: "b",
  robots: {
    index: false,
    follow: false,
    nocache: true,
  },
};

export default function DetectiveBPage() {
  return <BWall />;
}
