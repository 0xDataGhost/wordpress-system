import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { useNavigate } from "react-router-dom";
import {
  fetchMe,
  login as loginRequest,
  logout as logoutRequest,
  register as registerRequest,
  type AuthStore,
  type AuthUser,
  type LoginInput,
  type RegisterInput,
} from "@/lib/auth-api";
import {
  clearTokens,
  getRefreshToken,
  hasTokens,
  setTokens,
} from "@/lib/auth-storage";
import { AUTH_LOGOUT_EVENT } from "@/lib/http";

type AuthStatus = "loading" | "authenticated" | "unauthenticated";

interface AuthContextValue {
  status: AuthStatus;
  user: AuthUser | null;
  store: AuthStore | null;
  /** Permission keys granted to the user in the active store (e.g. "orders.edit"). */
  permissions: string[];
  /** True when the user holds the given permission key in the active store. */
  hasPermission: (key: string) => boolean;
  signIn: (input: LoginInput) => Promise<void>;
  signUp: (input: RegisterInput) => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const navigate = useNavigate();
  const [status, setStatus] = useState<AuthStatus>("loading");
  const [user, setUser] = useState<AuthUser | null>(null);
  const [store, setStore] = useState<AuthStore | null>(null);
  const [permissions, setPermissions] = useState<string[]>([]);

  // Hydrate the session from a stored token so a refresh keeps the user in.
  useEffect(() => {
    let active = true;

    if (!hasTokens()) {
      setStatus("unauthenticated");
      return;
    }

    fetchMe()
      .then((me) => {
        if (!active) return;
        setUser(me.user);
        setStore(me.store);
        setPermissions(me.permissions);
        setStatus("authenticated");
      })
      .catch(() => {
        if (!active) return;
        clearTokens();
        setUser(null);
        setStore(null);
        setPermissions([]);
        setStatus("unauthenticated");
      });

    return () => {
      active = false;
    };
  }, []);

  // A failed token refresh in the HTTP layer broadcasts this event.
  useEffect(() => {
    function handleForcedLogout() {
      setUser(null);
      setStore(null);
      setPermissions([]);
      setStatus("unauthenticated");
      navigate("/login", { replace: true });
    }

    window.addEventListener(AUTH_LOGOUT_EVENT, handleForcedLogout);
    return () =>
      window.removeEventListener(AUTH_LOGOUT_EVENT, handleForcedLogout);
  }, [navigate]);

  // The login/register response carries the user + store but not the permission
  // set, so we load it from /auth/me right after authenticating. A failure here
  // only leaves the UI permission-gates closed — the backend still enforces.
  async function loadPermissions(): Promise<void> {
    try {
      const me = await fetchMe();
      setPermissions(me.permissions);
    } catch {
      setPermissions([]);
    }
  }

  async function signIn(input: LoginInput): Promise<void> {
    const session = await loginRequest(input);
    setTokens({
      accessToken: session.accessToken,
      refreshToken: session.refreshToken,
    });
    setUser(session.user);
    setStore(session.store);
    setStatus("authenticated");
    await loadPermissions();
  }

  async function signUp(input: RegisterInput): Promise<void> {
    const session = await registerRequest(input);
    setTokens({
      accessToken: session.accessToken,
      refreshToken: session.refreshToken,
    });
    setUser(session.user);
    setStore(session.store);
    setStatus("authenticated");
    await loadPermissions();
  }

  async function signOut(): Promise<void> {
    const refreshToken = getRefreshToken();
    if (refreshToken) {
      await logoutRequest(refreshToken).catch(() => undefined);
    }
    clearTokens();
    setUser(null);
    setStore(null);
    setPermissions([]);
    setStatus("unauthenticated");
    navigate("/login", { replace: true });
  }

  function hasPermission(key: string): boolean {
    return permissions.includes(key);
  }

  return (
    <AuthContext.Provider
      value={{
        status,
        user,
        store,
        permissions,
        hasPermission,
        signIn,
        signUp,
        signOut,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
