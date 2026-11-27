import { createClient } from "@supabase/supabase-js";

export type ZenVentoraSession = {
  user: {
    id: string;
    email?: string | null;
    user_metadata?: Record<string, unknown>;
  };
  access_token?: string;
  refresh_token?: string;
} | null;

export type ZenVentoraAccountClient = {
  getSession(): Promise<ZenVentoraSession>;
  onSessionChange(callback: (session: ZenVentoraSession) => void): () => void;
  signIn(product?: string, returnTo?: string): void;
  signUp(product?: string, returnTo?: string): void;
  openAccount(): void;
  signOut(): void;
  getAccessToken(): string | null;
};

declare global {
  interface Window {
    ZenVentoraAccount?: ZenVentoraAccountClient;
  }
}

const ACCOUNT_ORIGIN = "https://accounts.zenventora.in";
const ACCOUNT_SUPABASE_URL = "https://flwzqlywdlwatycxexmk.supabase.co";
const ACCOUNT_SUPABASE_KEY = "sb_publishable_QN1aNd7wxjkb6ktD6L8GOQ_nsfV1_bY";
const BRIDGE_URL = ACCOUNT_ORIGIN + "/session-bridge.html";
const SESSION_WAIT_MS = 5000;

const accountSupabase = createClient(ACCOUNT_SUPABASE_URL, ACCOUNT_SUPABASE_KEY, {
  auth: {
    autoRefreshToken: true,
    persistSession: false,
    detectSessionInUrl: false
  }
});

let cachedSession: any = null;
let bridgeFrame: HTMLIFrameElement | null = null;
let bridgeStarted = false;
let handoffPending = false;
let initialSessionResolved = false;
let resolveInitialSession: (() => void) | null = null;

const initialSession = new Promise<void>(resolve => {
  resolveInitialSession = resolve;
});

function finishInitialSession() {
  if (initialSessionResolved) return;
  initialSessionResolved = true;
  resolveInitialSession?.();
  resolveInitialSession = null;
}

function cleanHandoffHash() {
  const params = new URLSearchParams(window.location.hash.slice(1));
  if (params.get("type") !== "account_handoff") return false;

  const access_token = params.get("access_token");
  const refresh_token = params.get("refresh_token");
  if (!access_token || !refresh_token) return false;

  handoffPending = true;
  void accountSupabase.auth.setSession({ access_token, refresh_token }).then(({ data, error }) => {
    cachedSession = error ? null : data.session;
    handoffPending = false;
    finishInitialSession();
  }).catch(() => {
    cachedSession = null;
    handoffPending = false;
    finishInitialSession();
  });

  window.history.replaceState({}, document.title, window.location.pathname + window.location.search);
  return true;
}

function requestBridgeSession() {
  bridgeFrame?.contentWindow?.postMessage(
    { type: "zenventora:request-session" },
    ACCOUNT_ORIGIN
  );
}

function startBridge() {
  if (bridgeStarted || typeof window === "undefined") return;
  bridgeStarted = true;

  window.addEventListener("message", async event => {
    if (event.origin !== ACCOUNT_ORIGIN || event.source !== bridgeFrame?.contentWindow) return;
    if (event.data?.type !== "zenventora:account-session") return;

    const session = event.data.session;
    if (!session?.access_token || !session?.refresh_token) {
      // The account iframe may return an empty session in a partitioned browser
      // context while a top-level login handoff is still being applied.
      // Never let that empty iframe response erase the pending product session.
      if (!cachedSession && !handoffPending) {
        await accountSupabase.auth.signOut({ scope: "local" });
        finishInitialSession();
      }
      return;
    }

    const { data, error } = await accountSupabase.auth.setSession({
      access_token: session.access_token,
      refresh_token: session.refresh_token
    });
    cachedSession = error ? null : data.session;
    finishInitialSession();
  });

  if (cleanHandoffHash()) {
    // The handoff token is exchanged directly with the common account project.
  }

  bridgeFrame = document.createElement("iframe");
  bridgeFrame.src = BRIDGE_URL;
  bridgeFrame.title = "ZenVentora account session";
  bridgeFrame.tabIndex = -1;
  bridgeFrame.setAttribute("aria-hidden", "true");
  bridgeFrame.style.cssText = "position:fixed;width:1px;height:1px;left:-9999px;top:-9999px;border:0;opacity:0;pointer-events:none;";
  bridgeFrame.addEventListener("load", requestBridgeSession, { once: true });
  bridgeFrame.addEventListener("error", finishInitialSession, { once: true });
  document.body.appendChild(bridgeFrame);

  window.setTimeout(requestBridgeSession, 500);
  window.setTimeout(requestBridgeSession, 1500);
}

accountSupabase.auth.onAuthStateChange((_event, session) => {
  cachedSession = session;
  finishInitialSession();
});

const client: ZenVentoraAccountClient = {
  async getSession() {
    startBridge();
    await Promise.race([
      initialSession,
      new Promise<void>(resolve => window.setTimeout(resolve, SESSION_WAIT_MS))
    ]);
    const { data } = await accountSupabase.auth.getSession();
    cachedSession = data.session;
    return data.session as ZenVentoraSession;
  },

  onSessionChange(callback) {
    const { data } = accountSupabase.auth.onAuthStateChange((_event, session) => {
      cachedSession = session;
      callback(session as ZenVentoraSession);
    });
    return () => data.subscription.unsubscribe();
  },

  signIn(product, returnTo) {
    const target = returnTo || window.location.origin + "/";
    const url = new URL("/login", ACCOUNT_ORIGIN);
    url.searchParams.set("view", "signin");
    url.searchParams.set("returnTo", target);
    if (product) url.searchParams.set("product", product);
    window.location.assign(url.toString());
  },

  signUp(product, returnTo) {
    const target = returnTo || window.location.origin + "/";
    const url = new URL("/", ACCOUNT_ORIGIN);
    url.searchParams.set("view", "signup");
    url.searchParams.set("returnTo", target);
    if (product) {
      url.searchParams.set("product", product);
      url.searchParams.set("productFlow", "signup");
    }
    window.location.assign(url.toString());
  },

  openAccount() {
    window.open(ACCOUNT_ORIGIN + "/", "_blank", "noopener,noreferrer");
  },

  signOut() {
    void accountSupabase.auth.signOut({ scope: "global" }).then(() => {
      cachedSession = null;
      bridgeFrame?.contentWindow?.postMessage({ type: "zenventora:signout" }, ACCOUNT_ORIGIN);
    });
  },

  getAccessToken() {
    return cachedSession?.access_token || null;
  }
};

window.ZenVentoraAccount = client;

export async function getZenVentoraAccount() {
  return client;
}

export async function requireZenVentoraAccount() {
  return client.getSession();
}
