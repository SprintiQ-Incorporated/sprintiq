import { ImageResponse } from "next/og";
import type { NextRequest } from "next/server";

export const runtime = "edge";

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const title = searchParams.get("title") ?? "AI Coding Agent Orchestration";
  const subtitle = searchParams.get("subtitle") ?? "";

  // Fetch logo images from public directory
  const origin = request.nextUrl.origin;
  const [sprintiqLogoData, turboLogoData] = await Promise.all([
    fetch(new URL("/images/sprintiq-logo.png", origin)).then((res) =>
      res.arrayBuffer()
    ),
    fetch(new URL("/images/turbo/Turbo_logo_128.png", origin)).then((res) =>
      res.arrayBuffer()
    ),
  ]);

  const sprintiqLogoSrc = `data:image/png;base64,${Buffer.from(sprintiqLogoData).toString("base64")}`;
  const turboLogoSrc = `data:image/png;base64,${Buffer.from(turboLogoData).toString("base64")}`;

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          backgroundColor: "#0a0a0a",
          padding: "50px 70px",
          position: "relative",
          overflow: "hidden",
        }}
      >
        {/* Background glow effect */}
        <div
          style={{
            position: "absolute",
            top: "-200px",
            right: "-100px",
            width: "600px",
            height: "600px",
            borderRadius: "50%",
            background:
              "radial-gradient(circle, rgba(230,57,70,0.12) 0%, rgba(255,107,53,0.06) 40%, transparent 70%)",
            display: "flex",
          }}
        />
        <div
          style={{
            position: "absolute",
            bottom: "-150px",
            left: "-80px",
            width: "500px",
            height: "500px",
            borderRadius: "50%",
            background:
              "radial-gradient(circle, rgba(16,185,129,0.08) 0%, transparent 60%)",
            display: "flex",
          }}
        />

        {/* Top: SprintIQ logo + Turbo mascot */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          {/* SprintIQ logo */}
          <img
            src={sprintiqLogoSrc}
            alt="SprintiQ"
            width={220}
            height={56}
            style={{ objectFit: "contain" }}
          />

          {/* Turbo mascot */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "12px",
            }}
          >
            <img
              src={turboLogoSrc}
              alt="Turbo"
              width={52}
              height={52}
              style={{ borderRadius: "50%" }}
            />
            <span
              style={{
                fontSize: 22,
                fontWeight: 600,
                color: "#94a3b8",
                letterSpacing: "0.02em",
              }}
            >
              Turbo
            </span>
          </div>
        </div>

        {/* Center: Title + Subtitle */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: "16px",
            flex: 1,
            justifyContent: "center",
            paddingTop: "20px",
            paddingBottom: "20px",
          }}
        >
          <div
            style={{
              fontSize: title.length > 40 ? 46 : 58,
              fontWeight: 700,
              color: "#ffffff",
              lineHeight: 1.15,
              letterSpacing: "-0.02em",
            }}
          >
            {title}
          </div>
          {subtitle && (
            <div
              style={{
                fontSize: 26,
                color: "#a1a1aa",
                lineHeight: 1.4,
              }}
            >
              {subtitle}
            </div>
          )}
        </div>

        {/* Bottom: Accent line + domain */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: "18px",
          }}
        >
          <div
            style={{
              width: "100%",
              height: "4px",
              background:
                "linear-gradient(90deg, #10b981, #E63946, #FF6B35, #FFB563)",
              borderRadius: "2px",
            }}
          />
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
            }}
          >
            <span
              style={{
                fontSize: 18,
                color: "#52525b",
                fontWeight: 500,
              }}
            >
              AI Coding Agent Orchestration
            </span>
            <span
              style={{
                fontSize: 22,
                color: "#71717a",
                fontWeight: 600,
              }}
            >
              sprintiq.ai
            </span>
          </div>
        </div>
      </div>
    ),
    {
      width: 1200,
      height: 630,
      headers: {
        "Cache-Control": "public, max-age=31536000, immutable",
      },
    },
  );
}
