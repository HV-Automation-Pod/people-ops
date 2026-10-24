import { ImageResponse } from "next/og";

export const alt = "People Ops - HR Automation Platform";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          padding: 96,
          background: "#1c1917",
          color: "#fafaf9",
        }}
      >
        <div style={{ fontSize: 120, fontWeight: 700 }}>People Ops</div>
        <div style={{ fontSize: 48, marginTop: 24, color: "#a8a29e" }}>HR Automation Platform</div>
      </div>
    ),
    size,
  );
}
