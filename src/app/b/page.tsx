import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "b",
  robots: {
    index: false,
    follow: false,
    nocache: true,
  },
};

const ITEMS = Array.from({ length: 1200 }, (_, index) => index);

export default function BPage() {
  return (
    <main className="b-page" aria-label="b">
      <div className="b-grid" aria-hidden="true">
        {ITEMS.map((item) => (
          <span key={item}>b</span>
        ))}
      </div>

      <style>{`
        html,
        body {
          overflow: hidden;
        }

        .b-page {
          position: fixed;
          inset: 0;
          width: 100vw;
          height: 100dvh;
          overflow: hidden;
          background: #fff;
          color: #000;
        }

        .b-grid {
          position: absolute;
          inset: -16px;
          display: flex;
          flex-wrap: wrap;
          align-content: flex-start;
          gap: 8px 13px;
          font-family: Arial, Helvetica, sans-serif;
          font-size: clamp(16px, 2.8vw, 42px);
          font-weight: 700;
          line-height: 1;
          letter-spacing: 0;
        }
      `}</style>
    </main>
  );
}
