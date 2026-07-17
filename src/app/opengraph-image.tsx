import { ImageResponse } from "next/og";
import { SITE_NAME } from "@/lib/seo";

export const runtime = "edge";

export const alt = "Paracetamol Haze";
export const size = {
  width: 1200,
  height: 630,
};

export const contentType = "image/png";

export default async function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          background: "linear-gradient(to bottom right, #090a0f, #14161f)",
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          fontFamily: "sans-serif",
          padding: "40px",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: "80px",
            fontWeight: 900,
            letterSpacing: "-0.05em",
            color: "white",
            textTransform: "uppercase",
            textShadow: "0 4px 20px rgba(255,69,0,0.5)",
          }}
        >
          <span style={{ color: "white" }}>PARACETAMOL</span>
          <span
            style={{
              color: "#ff4500",
              marginLeft: "16px",
            }}
          >
            HAZE
          </span>
        </div>

        <div
          style={{
            marginTop: "20px",
            fontSize: "36px",
            color: "#a0a0a0",
            fontWeight: 500,
            letterSpacing: "0.05em",
            textAlign: "center",
          }}
        >
          Интерактивы и игры для Twitch-стримеров
        </div>

        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            gap: "20px",
            marginTop: "60px",
            justifyContent: "center",
          }}
        >
          <span style={{ fontSize: "24px", color: "#6d78ff", fontWeight: 700 }}>CS2 × Twitch</span>
          <span style={{ fontSize: "24px", color: "#4ECDC4", fontWeight: 700 }}>РОЗ</span>
          <span style={{ fontSize: "24px", color: "#f87171", fontWeight: 700 }}>КиноКадр</span>
          <span style={{ fontSize: "24px", color: "#F59E0B", fontWeight: 700 }}>Эмоджино</span>
          <span style={{ fontSize: "24px", color: "#3B82F6", fontWeight: 700 }}>Лотомаль</span>
        </div>
      </div>
    ),
    {
      ...size,
    }
  );
}
