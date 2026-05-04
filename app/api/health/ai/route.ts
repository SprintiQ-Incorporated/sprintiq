import { NextResponse } from "next/server";
import { getHealthStatus, type CircuitState } from "@/lib/circuit-breaker";
import { getRateLimitUtilization } from "@/lib/rate-limit-v2";

export async function GET() {
  const [circuits, rateLimits] = await Promise.all([
    getHealthStatus(),
    getRateLimitUtilization(),
  ]);

  const isClosed = (s: CircuitState) => s === "CLOSED";
  const bothClosed = isClosed(circuits.claude) && isClosed(circuits.deepseek);
  const bothOpen = circuits.claude === "OPEN" && circuits.deepseek === "OPEN";

  const status = bothClosed ? "healthy" : bothOpen ? "unhealthy" : "degraded";

  return NextResponse.json({
    status,
    providers: {
      claude: {
        circuit: circuits.claude,
        configured: !!process.env.ANTHROPIC_API_KEY,
      },
      deepseek: {
        circuit: circuits.deepseek,
        configured: !!process.env.DEEPSEEK_API_KEY,
      },
    },
    rate_limits: rateLimits,
    timestamp: new Date().toISOString(),
  });
}
