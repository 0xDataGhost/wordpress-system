import type { Request, RequestHandler } from "express";
import { parseApiKey, verifySecret } from "../lib/api-key";
import { UnauthorizedError } from "../lib/errors";
import { getConnectionByApiKeyId } from "../modules/connections/connections.service";

const BEARER_PREFIX = "Bearer ";

export interface ConnectorContext {
  storeId: string;
  connectionId: string;
}

/** Returns the connector context attached by `authenticateConnector`, or 401. */
export function getConnector(req: Request): ConnectorContext {
  if (!req.connector) {
    throw new UnauthorizedError("Connector authentication required");
  }
  return {
    storeId: req.connector.storeId,
    connectionId: req.connector.connectionId,
  };
}

/** Reads the connector key from `Authorization: Bearer` or `X-Connector-Key`. */
function extractKey(req: Request): string | null {
  const header = req.headers.authorization;
  if (header && header.startsWith(BEARER_PREFIX)) {
    return header.slice(BEARER_PREFIX.length).trim();
  }
  const custom = req.headers["x-connector-key"];
  if (typeof custom === "string" && custom.length > 0) {
    return custom.trim();
  }
  return null;
}

/**
 * Authenticates a request from a WordPress connector using its API key. Resolves
 * the tenant by the key's public lookup id, then constant-time verifies the
 * secret against the stored hash. Attaches { storeId, connectionId } to
 * req.connector. Rejects with 401 on any failure (no detail leaked).
 */
export const authenticateConnector: RequestHandler = async (
  req,
  _res,
  next,
) => {
  try {
    const raw = extractKey(req);
    if (!raw) {
      next(new UnauthorizedError("Missing connector API key"));
      return;
    }

    const parsed = parseApiKey(raw);
    if (!parsed) {
      next(new UnauthorizedError("Invalid connector API key"));
      return;
    }

    const connection = await getConnectionByApiKeyId(parsed.keyId);
    if (
      !connection ||
      !connection.apiKeyHash ||
      !verifySecret(parsed.secret, connection.apiKeyHash)
    ) {
      next(new UnauthorizedError("Invalid connector API key"));
      return;
    }

    req.connector = {
      storeId: connection.storeId,
      connectionId: connection.id,
    };
    next();
  } catch (err) {
    next(err);
  }
};
