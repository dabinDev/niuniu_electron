import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { _electron as electron } from "playwright";

const exePath = process.env.SMOKE_ELECTRON_EXECUTABLE;
if (!exePath) {
  throw new Error("SMOKE_ELECTRON_EXECUTABLE is required");
}

const outputRoot = process.env.AUDIT_OUTPUT_DIR ?? path.resolve("docs", "qa-screenshots", "packaged-visual-smoke");
await mkdir(outputRoot, { recursive: true });

let app = null;
try {
  app = await electron.launch({
    executablePath: exePath,
    cwd: path.dirname(exePath),
    env: {
      ...process.env,
      ELECTRON_DISABLE_SECURITY_WARNINGS: "true"
    }
  });
  const page = await app.firstWindow({ timeout: 45000 });
  await page.waitForLoadState("domcontentloaded", { timeout: 45000 });
  await page.locator(".titlebar").waitFor({ timeout: 45000 });
  await page.locator(".page-head h1").waitFor({ timeout: 45000 });
  await page.locator(".app-splash").waitFor({ state: "hidden", timeout: 45000 }).catch(() => undefined);

  await page.evaluate(() => {
    const raw = localStorage.getItem("niuniu-electron-preferences");
    const parsed = raw ? JSON.parse(raw) : { state: {}, version: 0 };
    parsed.state = { ...(parsed.state ?? {}), motionEnabled: true, sidebarCollapsed: true, theme: "dark" };
    localStorage.setItem("niuniu-electron-preferences", JSON.stringify(parsed));
  });
  await page.reload({ waitUntil: "domcontentloaded" });
  await page.locator(".page-head h1").waitFor({ timeout: 45000 });
  await page.locator(".app-splash").waitFor({ state: "hidden", timeout: 45000 }).catch(() => undefined);
  await page.waitForTimeout(150);

  const darkScreenshot = path.join(outputRoot, "packaged-dark-collapsed.png");
  await page.screenshot({ path: darkScreenshot, fullPage: false });
  const darkState = await page.evaluate(() => ({
    activeTitle: document.querySelector(".page-head h1")?.textContent?.trim() ?? "",
    blackPixelsProbe: document.body.textContent?.length ?? 0,
    collapsed: document.querySelector(".app-root")?.classList.contains("sidebar-collapsed") ?? false,
    iconMarks: Array.from(document.querySelectorAll(".nav-icon-mark span")).map((node) => node.textContent?.trim() ?? ""),
    theme: document.querySelector(".app-root")?.getAttribute("data-theme") ?? "",
    title: document.title
  }));

  await page.evaluate(() => {
    const raw = localStorage.getItem("niuniu-electron-preferences");
    const parsed = raw ? JSON.parse(raw) : { state: {}, version: 0 };
    parsed.state = { ...(parsed.state ?? {}), sidebarCollapsed: true, theme: "light" };
    localStorage.setItem("niuniu-electron-preferences", JSON.stringify(parsed));
  });
  await page.reload({ waitUntil: "domcontentloaded" });
  await page.locator(".page-head h1").waitFor({ timeout: 45000 });
  await page.locator(".app-splash").waitFor({ state: "hidden", timeout: 45000 }).catch(() => undefined);
  await page.waitForTimeout(150);
  const lightScreenshot = path.join(outputRoot, "packaged-light-collapsed.png");
  await page.screenshot({ path: lightScreenshot, fullPage: false });
  const lightState = await page.evaluate(() => ({
    activeTitle: document.querySelector(".page-head h1")?.textContent?.trim() ?? "",
    collapsed: document.querySelector(".app-root")?.classList.contains("sidebar-collapsed") ?? false,
    iconMarks: Array.from(document.querySelectorAll(".nav-icon-mark span")).map((node) => node.textContent?.trim() ?? ""),
    theme: document.querySelector(".app-root")?.getAttribute("data-theme") ?? ""
  }));

  if (!darkState.collapsed || !lightState.collapsed) {
    throw new Error(`Collapsed sidebar was not restored: ${JSON.stringify({ darkState, lightState })}`);
  }
  if (!darkState.iconMarks.includes("总") || !darkState.iconMarks.includes("竞") || !darkState.iconMarks.includes("AI")) {
    throw new Error(`Collapsed icon marks are incomplete: ${JSON.stringify(darkState.iconMarks)}`);
  }
  if (darkState.theme !== "dark" || lightState.theme !== "light") {
    throw new Error(`Theme switch failed: ${JSON.stringify({ darkState, lightState })}`);
  }
  if (darkState.blackPixelsProbe < 200) {
    throw new Error(`Packaged app appears blank: ${JSON.stringify(darkState)}`);
  }

  await writeFile(path.join(outputRoot, "state.json"), JSON.stringify({ darkScreenshot, darkState, lightScreenshot, lightState }, null, 2), "utf8");
  console.log(JSON.stringify({ darkScreenshot, darkState, lightScreenshot, lightState, outputRoot }, null, 2));
} finally {
  if (app) {
    await app.close().catch(() => undefined);
  }
}
