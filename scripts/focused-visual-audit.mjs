import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { chromium } from "playwright";

const baseUrl = process.env.AUDIT_BASE_URL ?? "http://127.0.0.1:5173";
const outputRoot = process.env.AUDIT_OUTPUT_DIR ?? path.resolve("docs", "qa-screenshots", "focused-scroll");
const chromePath = process.env.CHROME_PATH ?? "C:/Program Files/Google/Chrome/Application/chrome.exe";

await mkdir(outputRoot, { recursive: true });

const browser = await chromium.launch({
  executablePath: chromePath,
  headless: true
});
const page = await browser.newPage({ viewport: { width: 1440, height: 960 }, deviceScaleFactor: 1 });
const screenshots = [];

async function waitForPageTitle(expectedTitle) {
  await page.waitForFunction(
    (title) => document.querySelector(".page-head h1")?.textContent?.trim() === title,
    expectedTitle,
    { timeout: 30000 }
  );
  await page.waitForTimeout(450);
}

async function setTheme(theme) {
  await page.evaluate((nextTheme) => {
    const raw = localStorage.getItem("niuniu-electron-preferences");
    const parsed = raw ? JSON.parse(raw) : { state: {}, version: 0 };
    parsed.state = { ...(parsed.state ?? {}), theme: nextTheme };
    localStorage.setItem("niuniu-electron-preferences", JSON.stringify(parsed));
  }, theme);
}

async function capture({ path: routePath, scrollY = 0, slug, theme, title }) {
  await page.goto(`${baseUrl}/#${routePath}`, { waitUntil: "domcontentloaded" });
  await waitForPageTitle(title);
  if (theme) {
    await setTheme(theme);
    await page.reload({ waitUntil: "domcontentloaded" });
    await waitForPageTitle(title);
  }
  if (scrollY) {
    await page.evaluate((y) => document.querySelector(".page-scroll")?.scrollTo(0, y), scrollY);
    await page.waitForTimeout(350);
  }
  const screenshot = path.join(outputRoot, `${slug}.png`);
  await page.screenshot({ path: screenshot, fullPage: false });
  screenshots.push({ route: routePath, screenshot, scrollY, theme });
}

for (const item of [
  { path: "/ask-ai", scrollY: 980, slug: "dark-ask-history", theme: "dark", title: "问 AI" },
  { path: "/board-height", scrollY: 1020, slug: "dark-height-lower", theme: "dark", title: "连板高度" },
  { path: "/limit-review", scrollY: 900, slug: "dark-review-lower", theme: "dark", title: "涨停复盘" },
  { path: "/node", slug: "light-node", theme: "light", title: "牛牛节点" },
  { path: "/plate-rotation", slug: "light-rotation", theme: "light", title: "板块轮动" },
  { path: "/ask-ai", scrollY: 980, slug: "light-ask-history", theme: "light", title: "问 AI" }
]) {
  await capture(item);
}

await writeFile(path.join(outputRoot, "focused-audit.json"), JSON.stringify(screenshots, null, 2), "utf8");
await browser.close();

console.log(JSON.stringify({ outputRoot, screenshots: screenshots.length }, null, 2));
