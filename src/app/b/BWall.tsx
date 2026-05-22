const ITEMS = Array.from({ length: 1200 }, (_, index) => index);
const SECRET_LINK_INDEX = 404;
const SECRET_LINK = "https://www.youtube.com/watch?v=dQw4w9WgXcQ";

export default function BWall() {
  return (
    <main className="b-page" aria-label="b">
      <div className="b-grid">
        {ITEMS.map((item) =>
          item === SECRET_LINK_INDEX ? (
            <a key={item} href={SECRET_LINK} aria-label="b">
              b
            </a>
          ) : (
            <span key={item} aria-hidden="true">
              b
            </span>
          ),
        )}
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

        .b-grid a,
        .b-grid a:visited {
          color: inherit;
          text-decoration: none;
        }

        .b-grid a:focus-visible {
          outline: 2px solid #000;
          outline-offset: 2px;
        }
      `}</style>
    </main>
  );
}
