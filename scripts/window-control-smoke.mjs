import { _electron as electron } from "playwright";
import electronExecutable from "electron";
import { createServer } from "vite";

const baseUrl = "http://127.0.0.1:5173";
const root = process.cwd();
const packagedExecutable = process.env.SMOKE_ELECTRON_EXECUTABLE;

let viteServer = null;
let electronApp = null;

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function canReachDevServer() {
  try {
    const response = await fetch(baseUrl, { signal: AbortSignal.timeout(1500) });
    return response.ok;
  } catch {
    return false;
  }
}

async function ensureDevServer() {
  if (await canReachDevServer()) {
    return { reused: true };
  }

  viteServer = await createServer({
    root,
    server: {
      host: "127.0.0.1",
      port: 5173,
      strictPort: true
    }
  });
  await viteServer.listen();

  for (let attempt = 0; attempt < 80; attempt += 1) {
    if (await canReachDevServer()) {
      return { reused: false };
    }
    await sleep(250);
  }

  throw new Error("Vite dev server did not become reachable on http://127.0.0.1:5173");
}

async function readWindowState() {
  return electronApp.evaluate(({ BrowserWindow }) => {
    const win = BrowserWindow.getAllWindows()[0];
    if (!win) {
      return null;
    }
    return {
      bounds: win.getBounds(),
      isFocused: win.isFocused(),
      isFullScreen: win.isFullScreen(),
      isMaximized: win.isMaximized(),
      isMinimized: win.isMinimized(),
      isVisible: win.isVisible()
    };
  });
}

async function waitForWindowState(label, predicate, timeoutMs = 10000) {
  const startedAt = Date.now();
  let lastState = null;

  while (Date.now() - startedAt < timeoutMs) {
    lastState = await readWindowState();
    if (lastState && predicate(lastState)) {
      return lastState;
    }
    await sleep(100);
  }

  throw new Error(`${label} timed out. Last state: ${JSON.stringify(lastState)}`);
}

async function restoreWindow() {
  await electronApp.evaluate(({ BrowserWindow }) => {
    const win = BrowserWindow.getAllWindows()[0];
    if (win) {
      win.restore();
      win.focus();
    }
  });
  return waitForWindowState("restore window", (state) => !state.isMinimized && !state.isMaximized);
}

try {
  const devServer = packagedExecutable ? { skipped: true } : await ensureDevServer();

  electronApp = await electron.launch({
    args: packagedExecutable ? [] : [root],
    cwd: root,
    executablePath: packagedExecutable ?? electronExecutable,
    env: {
      ...process.env,
      ELECTRON_DISABLE_SECURITY_WARNINGS: "true"
    }
  });

  const page = await electronApp.firstWindow({ timeout: 30000 });
  await page.waitForLoadState("domcontentloaded", { timeout: 30000 });
  await page.locator(".titlebar").waitFor({ timeout: 30000 });

  const bridge = await page.evaluate(() => ({
    canGetState: typeof window.niuniu?.getWindowState === "function",
    canControlWindow: typeof window.niuniu?.windowControl === "function"
  }));
  if (!bridge.canGetState || !bridge.canControlWindow) {
    throw new Error(`Electron preload bridge is incomplete: ${JSON.stringify(bridge)}`);
  }

  const initial = await waitForWindowState("initial visible window", (state) => state.isVisible && !state.isMinimized);

  await page.locator(".light-max").click();
  const maximized = await waitForWindowState("maximize button", (state) => state.isMaximized);

  await page.locator(".light-max").click();
  const unmaximized = await waitForWindowState("restore from maximize button", (state) => !state.isMaximized && !state.isMinimized);

  await page.locator(".light-min").click();
  const minimized = await waitForWindowState("minimize button", (state) => state.isMinimized);

  const restored = await restoreWindow();

  console.log(JSON.stringify({
    bridge,
    devServer,
    initial,
    maximized,
    unmaximized,
    minimized,
    restored
  }, null, 2));
} finally {
  if (electronApp) {
    await electronApp.close().catch(() => undefined);
  }
  if (viteServer) {
    await viteServer.close().catch(() => undefined);
  }
}
