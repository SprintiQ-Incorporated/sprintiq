/**
 * Circuit Breaker for AI Provider Fallback Chain
 *
 * Prevents cascading failures by short-circuiting requests to known-bad providers.
 * Uses Redis for cross-instance state sharing with in-memory fallback.
 *
 * States:
 * - CLOSED: Provider is healthy, requests flow normally
 * - OPEN: Provider is failing, requests are skipped immediately (30s TTL)
 * - HALF_OPEN: Cooldown expired, allow one probe request to test recovery
 *
 * Redis keys per provider:
 * - cb:{provider}:open — exists when circuit is OPEN (TTL 30s)
 * - cb:{provider}:failures — consecutive failure count (TTL 60s, reset on success)
 */

export type CircuitState = "CLOSED" | "OPEN" | "HALF_OPEN";
export type ProviderName = "claude" | "deepseek";

const FAILURE_THRESHOLD = 5;
const OPEN_TTL_SECONDS = 30;
const FAILURES_TTL_SECONDS = 60;

// ============================================================================
// In-Memory Fallback
// ============================================================================

interface InMemoryCircuit {
  failures: number;
  openUntil: number | null; // timestamp when OPEN expires
  lastFailure: number;
}

const memoryCircuits = new Map<ProviderName, InMemoryCircuit>();

function getMemoryCircuit(provider: ProviderName): InMemoryCircuit {
  if (!memoryCircuits.has(provider)) {
    memoryCircuits.set(provider, { failures: 0, openUntil: null, lastFailure: 0 });
  }
  return memoryCircuits.get(provider)!;
}

// ============================================================================
// Redis Client (Lazy Init — same pattern as ai-cache-service.ts)
// ============================================================================

let redisClient: any = null;
let redisInitialized = false;

async function getRedis(): Promise<any | null> {
  if (redisInitialized) return redisClient;

  const hasConfig =
    process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN;

  if (!hasConfig) {
    redisInitialized = true;
    return null;
  }

  try {
    const { Redis } = await import("@upstash/redis");
    redisClient = new Redis({
      url: process.env.UPSTASH_REDIS_REST_URL!,
      token: process.env.UPSTASH_REDIS_REST_TOKEN!,
    });
    redisInitialized = true;
    return redisClient;
  } catch {
    redisInitialized = true;
    return null;
  }
}

// ============================================================================
// Core Functions
// ============================================================================

/**
 * Get the current circuit state for a provider.
 */
export async function getCircuitState(provider: ProviderName): Promise<CircuitState> {
  try {
    const redis = await getRedis();
    if (redis) {
      const [isOpen, failures] = await Promise.all([
        redis.exists(`cb:${provider}:open`),
        redis.get(`cb:${provider}:failures`),
      ]);

      if (isOpen) return "OPEN";

      const failureCount = typeof failures === "number" ? failures : parseInt(failures as string || "0", 10);
      if (failureCount >= FAILURE_THRESHOLD) return "HALF_OPEN";

      return "CLOSED";
    }
  } catch (error) {
    console.warn(`[CircuitBreaker] Redis error in getCircuitState(${provider}), using in-memory fallback:`, error);
  }

  // In-memory fallback
  const circuit = getMemoryCircuit(provider);
  const now = Date.now();

  if (circuit.openUntil && now < circuit.openUntil) return "OPEN";
  if (circuit.openUntil && now >= circuit.openUntil) {
    // Open period expired — check if failures still above threshold
    circuit.openUntil = null;
    if (circuit.failures >= FAILURE_THRESHOLD) return "HALF_OPEN";
  }
  if (circuit.failures >= FAILURE_THRESHOLD) return "HALF_OPEN";

  return "CLOSED";
}

/**
 * Record a failure for a provider. Opens circuit after threshold.
 */
export async function recordFailure(provider: ProviderName): Promise<void> {
  try {
    const redis = await getRedis();
    if (redis) {
      const newCount = await redis.incr(`cb:${provider}:failures`);
      await redis.expire(`cb:${provider}:failures`, FAILURES_TTL_SECONDS);

      if (newCount >= FAILURE_THRESHOLD) {
        await redis.set(`cb:${provider}:open`, "1", { ex: OPEN_TTL_SECONDS });
        console.warn(`[CircuitBreaker] ${provider} circuit OPENED after ${newCount} consecutive failures`);
      }
      return;
    }
  } catch (error) {
    console.warn(`[CircuitBreaker] Redis error in recordFailure(${provider}), using in-memory fallback:`, error);
  }

  // In-memory fallback
  const circuit = getMemoryCircuit(provider);
  circuit.failures++;
  circuit.lastFailure = Date.now();

  if (circuit.failures >= FAILURE_THRESHOLD) {
    circuit.openUntil = Date.now() + OPEN_TTL_SECONDS * 1000;
    console.warn(`[CircuitBreaker] ${provider} circuit OPENED after ${circuit.failures} consecutive failures (in-memory)`);
  }
}

/**
 * Record a success for a provider. Resets the circuit to CLOSED.
 */
export async function recordSuccess(provider: ProviderName): Promise<void> {
  try {
    const redis = await getRedis();
    if (redis) {
      await Promise.all([
        redis.del(`cb:${provider}:open`),
        redis.del(`cb:${provider}:failures`),
      ]);
      return;
    }
  } catch (error) {
    console.warn(`[CircuitBreaker] Redis error in recordSuccess(${provider}), using in-memory fallback:`, error);
  }

  // In-memory fallback
  const circuit = getMemoryCircuit(provider);
  circuit.failures = 0;
  circuit.openUntil = null;
}

/**
 * Get health status for both providers (used by health endpoint).
 */
export async function getHealthStatus(): Promise<{
  claude: CircuitState;
  deepseek: CircuitState;
}> {
  const [claude, deepseek] = await Promise.all([
    getCircuitState("claude"),
    getCircuitState("deepseek"),
  ]);
  return { claude, deepseek };
}
