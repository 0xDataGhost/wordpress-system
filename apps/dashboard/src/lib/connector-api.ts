/**
 * Connector API client for the WordPress connection flow.
 *
 * Each function mirrors a backend route documented in docs/connector-api.md:
 *   fetchConnectionStatus → GET  /wp/connection-status   (JWT, settings.view)
 *   generateApiKey        → POST /stores/current/api-key  (JWT, settings.edit)
 *   connectStore          → POST /wp/connect      (connector key, run by the plugin)
 *   runHealthCheck        → POST /wp/verify        (connector key, run by the plugin)
 *   disconnectStore       → POST /wp/disconnect    (connector key, run by the plugin)
 *
 * The dashboard has no auth-token plumbing yet (login is UI-only in this phase),
 * so this module is backed by an in-memory simulation that reproduces the real
 * response contracts. Swap each body for a fetch() against
 * import.meta.env.VITE_API_URL once the auth layer lands — the page does not
 * need to change.
 */

export type ConnectionStatus = "disconnected" | "pending" | "connected";
export type HealthStatus = "ok" | "failed" | null;

export interface ConnectionStatusDto {
  storeId: string;
  status: ConnectionStatus;
  hasApiKey: boolean;
  apiKeyPrefix: string | null;
  apiKeyGeneratedAt: string | null;
  siteUrl: string | null;
  wpVersion: string | null;
  wcVersion: string | null;
  connectorVersion: string | null;
  lastConnectedAt: string | null;
  lastHealthCheckAt: string | null;
  lastHealthStatus: HealthStatus;
  updatedAt: string | null;
}

export interface GeneratedApiKey {
  /** Plaintext key — returned exactly once, never retrievable again. */
  apiKey: string;
  apiKeyPrefix: string;
  status: ConnectionStatus;
  generatedAt: string;
}

/** Thrown for user-facing connector failures so the UI can show the message. */
export class ConnectorError extends Error {}

const SIMULATED_LATENCY_MS = 600;
const MOCK_STORE_ID = "store_demo";
const CONNECTOR_VERSION = "0.1.0";

const delay = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));
const nowIso = () => new Date().toISOString();

function randomHex(byteLength: number): string {
  const bytes = new Uint8Array(byteLength);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

function randomSecret(byteLength: number): string {
  const bytes = new Uint8Array(byteLength);
  crypto.getRandomValues(bytes);
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

let state: ConnectionStatusDto = {
  storeId: MOCK_STORE_ID,
  status: "disconnected",
  hasApiKey: false,
  apiKeyPrefix: null,
  apiKeyGeneratedAt: null,
  siteUrl: null,
  wpVersion: null,
  wcVersion: null,
  connectorVersion: null,
  lastConnectedAt: null,
  lastHealthCheckAt: null,
  lastHealthStatus: null,
  updatedAt: null,
};

const snapshot = (): ConnectionStatusDto => ({ ...state });

export async function fetchConnectionStatus(): Promise<ConnectionStatusDto> {
  await delay(SIMULATED_LATENCY_MS);
  return snapshot();
}

export async function generateApiKey(): Promise<GeneratedApiKey> {
  await delay(SIMULATED_LATENCY_MS);
  const keyId = randomHex(8); // 16 lowercase hex chars
  const prefix = `wpc_${keyId}`;
  const apiKey = `${prefix}_${randomSecret(32)}`;
  const generatedAt = nowIso();
  // Regenerating invalidates the old key and returns the connection to "pending".
  state = {
    ...state,
    status: "pending",
    hasApiKey: true,
    apiKeyPrefix: prefix,
    apiKeyGeneratedAt: generatedAt,
    lastHealthStatus: null,
    updatedAt: generatedAt,
  };
  return { apiKey, apiKeyPrefix: prefix, status: "pending", generatedAt };
}

export async function connectStore(input: { siteUrl: string }): Promise<ConnectionStatusDto> {
  await delay(SIMULATED_LATENCY_MS);
  if (!state.hasApiKey) {
    throw new ConnectorError("ولّد مفتاح API أولًا قبل ربط المتجر.");
  }
  const at = nowIso();
  state = {
    ...state,
    status: "connected",
    siteUrl: input.siteUrl,
    wpVersion: "6.5.2",
    wcVersion: "8.9.1",
    connectorVersion: CONNECTOR_VERSION,
    lastConnectedAt: at,
    lastHealthCheckAt: at,
    lastHealthStatus: "ok",
    updatedAt: at,
  };
  return snapshot();
}

export async function runHealthCheck(): Promise<ConnectionStatusDto> {
  await delay(SIMULATED_LATENCY_MS);
  if (state.status !== "connected") {
    throw new ConnectorError("لا يمكن إجراء فحص الصحة قبل ربط المتجر.");
  }
  const at = nowIso();
  state = { ...state, lastHealthCheckAt: at, lastHealthStatus: "ok", updatedAt: at };
  return snapshot();
}

export async function disconnectStore(): Promise<ConnectionStatusDto> {
  await delay(SIMULATED_LATENCY_MS);
  const at = nowIso();
  state = {
    ...state,
    status: "disconnected",
    hasApiKey: false,
    apiKeyPrefix: null,
    apiKeyGeneratedAt: null,
    siteUrl: null,
    wpVersion: null,
    wcVersion: null,
    connectorVersion: null,
    lastConnectedAt: null,
    lastHealthCheckAt: null,
    lastHealthStatus: null,
    updatedAt: at,
  };
  return snapshot();
}
