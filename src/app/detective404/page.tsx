import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "404",
  robots: {
    index: false,
    follow: false,
    nocache: true,
  },
};

const MESSAGE = "ПОЧТИ) ИЩИ ДАЛЬШЕ";
const ITEMS = Array.from({ length: 220 }, (_, index) => index);

export default function Detective404Page() {
  return (
    <main className="detective404-page" aria-label="detective404">
      <div className="detective404-text" aria-hidden="true">
        {ITEMS.map((item) => (
          <span key={item}>{MESSAGE}</span>
        ))}
      </div>

      <style>{`
        html,
        body {
          overflow: hidden;
        }

        .detective404-page {
          position: fixed;
          inset: 0;
          width: 100vw;
          height: 100dvh;
          overflow: hidden;
          background: #000;
          color: #000;
          user-select: text;
          cursor: text;
        }

        .detective404-page ::selection {
          color: #fff;
          background: rgba(255, 255, 255, 0.18);
        }

        .detective404-text {
          position: absolute;
          inset: -24px;
          display: flex;
          flex-wrap: wrap;
          align-content: flex-start;
          gap: 18px 28px;
          font-family: Arial, Helvetica, sans-serif;
          font-size: clamp(22px, 4.2vw, 72px);
          font-weight: 900;
          line-height: 0.92;
          letter-spacing: 0;
          text-transform: uppercase;
        }

        .detective404-text span {
          display: inline-block;
          white-space: nowrap;
        }
      `}</style>
    </main>
  );
}
