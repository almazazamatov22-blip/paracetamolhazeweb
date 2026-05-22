const IMAGE_SRC = "/detective/pomogite.png";

export default function PomogiteImagePage() {
  return (
    <main className="pomogite-page" aria-label="pomogite">
      <img src={IMAGE_SRC} alt="" aria-hidden="true" />

      <style>{`
        html,
        body {
          margin: 0;
          overflow: hidden;
          background: #000;
        }

        .pomogite-page {
          position: fixed;
          inset: 0;
          width: 100vw;
          height: 100dvh;
          overflow: hidden;
          background: #000;
        }

        .pomogite-page img {
          display: block;
          width: 100%;
          height: 100%;
          object-fit: cover;
          object-position: center;
          user-select: none;
          -webkit-user-drag: none;
        }
      `}</style>
    </main>
  );
}
