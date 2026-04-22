import { createServer } from "node:http";
import { randomBytes, createHash } from "node:crypto";
import { URL } from "node:url";
import {
  AUTHING_DOMAIN,
  AUTHING_APP_ID,
  AUTHING_SCOPE,
  LOOPBACK_HOST,
  LOOPBACK_PORT,
  LOOPBACK_REDIRECT_URI,
  API_BASE,
} from "../config.js";
import { setToken } from "./keychain.js";
import { writeUser } from "./user_store.js";
import { isPretty } from "../output.js";
import type { StoredUser } from "./user_store.js";

function base64url(buf: Buffer): string {
  return buf.toString("base64url");
}

function generatePKCE() {
  const verifier = base64url(randomBytes(32));
  const challenge = base64url(createHash("sha256").update(verifier).digest());
  return { verifier, challenge };
}

function generateState(): string {
  return base64url(randomBytes(16));
}

interface TokenResponse {
  access_token: string;
  id_token: string;
  refresh_token: string;
}

interface LoginResult {
  user: StoredUser;
  accessToken: string;
}

/**
 * Full OIDC Authorization Code + PKCE login flow.
 * 1. Start loopback server
 * 2. Open browser to Authing
 * 3. Receive callback
 * 4. Exchange code for tokens
 * 5. POST id_token to backend /auth/login
 * 6. Store tokens in Keychain + user in config
 */
export async function loginFlow(): Promise<LoginResult> {
  const { verifier, challenge } = generatePKCE();
  const state = generateState();

  // Build authorization URL
  const authUrl = new URL(`${AUTHING_DOMAIN}/oidc/auth`);
  authUrl.searchParams.set("client_id", AUTHING_APP_ID);
  authUrl.searchParams.set("redirect_uri", LOOPBACK_REDIRECT_URI);
  authUrl.searchParams.set("response_type", "code");
  authUrl.searchParams.set("scope", AUTHING_SCOPE);
  authUrl.searchParams.set("state", state);
  authUrl.searchParams.set("code_challenge", challenge);
  authUrl.searchParams.set("code_challenge_method", "S256");

  // Wait for authorization code via loopback server
  const { code } = await waitForCallback(state, authUrl.toString());

  // Exchange code for tokens
  const tokens = await exchangeCode(code, verifier);

  // POST id_token to backend
  const loginResp = await fetch(`${API_BASE}/auth/login`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${tokens.access_token}`,
      "X-Curation-Client": "cli",
    },
    body: JSON.stringify({ id_token: tokens.id_token }),
  });

  if (loginResp.status === 401) {
    // New user — needs invite code activation
    const inviteResult = await handleInviteFlow(tokens);
    return inviteResult;
  }

  if (!loginResp.ok) {
    const body = await loginResp.json().catch(() => ({}));
    throw new Error((body as any).detail || `Login failed: HTTP ${loginResp.status}`);
  }

  const data = (await loginResp.json()) as {
    user_id: number;
    role: string;
    email: string | null;
    username: string | null;
  };

  // Store tokens
  await setToken("access_token", tokens.access_token);
  await setToken("refresh_token", tokens.refresh_token);

  const user: StoredUser = {
    user_id: data.user_id,
    username: data.username || "",
    email: data.email || null,
    role: data.role,
  };
  writeUser(user);

  return { user, accessToken: tokens.access_token };
}

async function handleInviteFlow(tokens: TokenResponse): Promise<LoginResult> {
  let clack: typeof import("@clack/prompts") | null = null;
  if (isPretty()) {
    clack = await import("@clack/prompts");
  }

  // Prompt for invite code
  let code: string;
  if (clack) {
    const result = await clack.text({
      message: "请输入邀请码",
      placeholder: "XXXX-XXXX-XXXX",
      validate: (v) => (v.trim().length === 0 ? "邀请码不能为空" : undefined),
    });
    if (clack.isCancel(result)) {
      process.stderr.write("已取消\n");
      process.exit(1);
    }
    code = result as string;
  } else {
    // JSON mode: read from stdin
    const { createInterface } = await import("node:readline");
    const rl = createInterface({ input: process.stdin, output: process.stderr });
    code = await new Promise<string>((resolve) => {
      process.stderr.write('{"prompt": "invite_code_required"}\n');
      rl.question("", (answer) => {
        rl.close();
        resolve(answer.trim());
      });
    });
  }

  // Validate invite
  const vResp = await fetch(`${API_BASE}/auth/validate-invite`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Curation-Client": "cli",
    },
    body: JSON.stringify({ code }),
  });
  const vData = (await vResp.json()) as any;
  if (!vResp.ok) {
    throw new Error(vData.detail || "邀请码无效");
  }

  // Register
  const rResp = await fetch(`${API_BASE}/auth/register`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Curation-Client": "cli",
    },
    body: JSON.stringify({
      id_token: tokens.id_token,
      invite_token: vData.validation_token,
    }),
  });
  const rData = (await rResp.json()) as any;
  if (!rResp.ok) {
    throw new Error(rData.detail || "激活失败");
  }

  await setToken("access_token", tokens.access_token);
  await setToken("refresh_token", tokens.refresh_token);

  const user: StoredUser = {
    user_id: rData.user_id,
    username: rData.username || "",
    email: rData.email || null,
    role: rData.role,
  };
  writeUser(user);

  return { user, accessToken: tokens.access_token };
}

function waitForCallback(
  expectedState: string,
  authUrl: string
): Promise<{ code: string }> {
  return new Promise((resolve, reject) => {
    const server = createServer((req, res) => {
      if (!req.url?.startsWith("/callback")) {
        res.writeHead(404);
        res.end("Not Found");
        return;
      }

      const url = new URL(req.url, `http://${LOOPBACK_HOST}:${LOOPBACK_PORT}`);
      const code = url.searchParams.get("code");
      const state = url.searchParams.get("state");
      const error = url.searchParams.get("error");

      if (error) {
        res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
        res.end("<h2>登录失败</h2><p>可以关闭此页面。</p>");
        server.close();
        reject(new Error(`Auth error: ${error}`));
        return;
      }

      if (state !== expectedState) {
        res.writeHead(400, { "Content-Type": "text/html; charset=utf-8" });
        res.end("<h2>状态不匹配</h2><p>请重试登录。</p>");
        server.close();
        reject(new Error("State mismatch"));
        return;
      }

      if (!code) {
        res.writeHead(400, { "Content-Type": "text/html; charset=utf-8" });
        res.end("<h2>缺少授权码</h2>");
        server.close();
        reject(new Error("Missing authorization code"));
        return;
      }

      res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
      res.end(
        "<h2>认证成功！</h2><p>可以关闭此页面，回到终端。</p>" +
        "<script>setTimeout(()=>window.close(),1000)</script>"
      );
      server.close();
      resolve({ code });
    });

    server.listen(LOOPBACK_PORT, LOOPBACK_HOST, async () => {
      // Open browser
      const openModule = await import("open");
      await openModule.default(authUrl);

      if (isPretty()) {
        process.stderr.write("  正在打开浏览器…\n");
        process.stderr.write(`  ${authUrl.slice(0, 60)}…\n\n`);
        process.stderr.write("  等待授权回调…\n");
      }
    });

    // Timeout after 120 seconds
    setTimeout(() => {
      server.close();
      reject(new Error("Login timed out (120s). Please try again."));
    }, 120_000);
  });
}

async function exchangeCode(
  code: string,
  verifier: string
): Promise<TokenResponse> {
  const resp = await fetch(`${AUTHING_DOMAIN}/oidc/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      code,
      redirect_uri: LOOPBACK_REDIRECT_URI,
      client_id: AUTHING_APP_ID,
      code_verifier: verifier,
    }),
  });

  if (!resp.ok) {
    const text = await resp.text();
    throw new Error(`Token exchange failed: ${resp.status} ${text}`);
  }

  const data = (await resp.json()) as Record<string, unknown>;
  const access_token = data.access_token as string;
  const id_token = data.id_token as string;
  const refresh_token = data.refresh_token as string;

  if (!access_token || !id_token || !refresh_token) {
    throw new Error(
      `Incomplete token response. Keys: ${Object.keys(data).join(",")}`
    );
  }

  return { access_token, id_token, refresh_token };
}
