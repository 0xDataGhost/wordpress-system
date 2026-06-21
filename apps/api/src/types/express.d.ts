/**
 * Augments Express' Request with the authenticated tenant context attached by
 * the `authenticate` middleware. `permissionKeys` is memoised by `authorize`
 * so multiple permission checks in one request hit the database only once.
 */
declare global {
  namespace Express {
    interface Request {
      auth?: {
        userId: string;
        storeId: string;
        permissionKeys?: Set<string>;
      };
      // Tenant context resolved from a WordPress connector API key by the
      // `authenticateConnector` middleware (distinct from JWT-based `auth`).
      connector?: {
        storeId: string;
        connectionId: string;
      };
    }
  }
}

export {};
