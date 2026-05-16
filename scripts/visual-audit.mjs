import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { chromium } from "playwright";

const baseUrl = process.env.AUDIT_BASE_URL ?? "http://127.0.0.1:5173";
const outputRoot = process.env.AUDIT_OUTPUT_DIR ?? path.resolve("designs", "visual-audit");
const chromePath = process.env.CHROME_PATH ?? "C:/Program Files/Google/Chrome/Application/chrome.exe";

const routes = [
  { path: "/overview", title: "总览", slug: "01-overview" },
  { path: "/auction", title: "牛牛竞价", slug: "02-auction" },
  { path: "/node", title: "牛牛节点", slug: "03-node" },
  { path: "/market-center", title: "行情中心", slug: "04-market-center" },
  { path: "/yesterday-stats", title: "空头数据", slug: "05-yesterday-stats" },
  { path: "/board-tier", title: "连板天梯", slug: "06-board-tier" },
  { path: "/board-height", title: "连板高度", slug: "07-board-height" },
  { path: "/limit-review", title: "涨停复盘", slug: "08-limit-review" },
  { path: "/plate-rotation", title: "板块轮动", slug: "09-plate-rotation" },
  { path: "/news", title: "牛牛资讯", slug: "10-news" },
  { path: "/ask-ai", title: "问 AI", slug: "11-ask-ai" },
  { path: "/jobs", title: "任务中心", slug: "12-jobs" }
];

const internalTabs = [
  { route: "/auction", slug: "02-auction-rank-tab", selector: ".segmented button", index: 1, waitTitle: "牛牛竞价" },
  { route: "/yesterday-stats", slug: "05-yesterday-stats-second-tab", selector: ".segmented button", index: 1, waitTitle: "空头数据" },
  { route: "/limit-review", slug: "08-limit-review-second-tab", selector: ".segmented button", index: 1, waitTitle: "涨停复盘" },
  { route: "/news", slug: "10-news-7x24-tab", selector: ".segmented button", text: "7x24", waitTitle: "牛牛资讯" }
];

await mkdir(outputRoot, { recursive: true });

const browser = await chromium.launch({
  executablePath: chromePath,
  headless: true
});
const page = await browser.newPage({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1 });

const audit = [];

async function waitForPageTitle(expectedTitle) {
  await page.waitForFunction(
    (title) => document.querySelector(".page-head h1")?.textContent?.trim() === title,
    expectedTitle,
    { timeout: 30000 }
  );
  await page.locator(".app-splash").waitFor({ state: "hidden", timeout: 30000 }).catch(() => undefined);
  await page.waitForTimeout(150);
}

async function setFullscreenPreferences(theme) {
  await page.evaluate((nextTheme) => {
    const raw = localStorage.getItem("niuniu-electron-preferences");
    const parsed = raw ? JSON.parse(raw) : { state: {}, version: 0 };
    parsed.state = { ...(parsed.state ?? {}), motionEnabled: true, sidebarCollapsed: true, theme: nextTheme };
    localStorage.setItem("niuniu-electron-preferences", JSON.stringify(parsed));
  }, theme);
}

async function capture(route, slug, expectedTitle) {
  await page.goto(`${baseUrl}/#${route}`, { waitUntil: "domcontentloaded" });
  await setFullscreenPreferences(slug.includes("light") ? "light" : "dark");
  await page.reload({ waitUntil: "domcontentloaded" });
  await waitForPageTitle(expectedTitle);
  const screenshot = path.join(outputRoot, `${slug}.png`);
  await page.screenshot({ path: screenshot, fullPage: false });
  const state = await page.evaluate(() => ({
    activeNav: document.querySelector(".nav-list a.active .nav-icon-mark span")?.textContent?.trim() ?? "",
    collapsed: document.querySelector(".app-root")?.classList.contains("sidebar-collapsed") ?? false,
    cards: document.querySelectorAll(".glass-card").length,
    chartCount: document.querySelectorAll(".kline-chart, .height-trend-chart, .trend-line-chart").length,
    englishLeaks: Array.from(document.querySelectorAll("body *"))
      .map((node) => node.childNodes.length === 1 ? node.textContent?.trim() ?? "" : "")
      .filter((text) => /^(sealed|broken|stock_limit|trade_date|latest_strength)$/i.test(text))
      .slice(0, 8),
    iconMarks: Array.from(document.querySelectorAll(".nav-icon-mark span")).map((node) => node.textContent?.trim() ?? ""),
    rootTheme: document.querySelector(".app-root")?.getAttribute("data-theme") ?? "",
    rows: document.querySelectorAll(".data-row").length,
    metrics: document.querySelectorAll(".metric-card").length,
    stateBlocks: Array.from(document.querySelectorAll(".state-block")).map((node) => node.textContent?.trim() ?? ""),
    title: document.querySelector(".page-head h1")?.textContent?.trim() ?? "",
    url: location.href,
    visibleButtons: Array.from(document.querySelectorAll("button")).slice(0, 20).map((node) => node.textContent?.trim() ?? "")
  }));
  audit.push({ route, screenshot, ...state });
}

for (const route of routes) {
  await capture(route.path, `${route.slug}-dark-collapsed`, route.title);
  await capture(route.path, `${route.slug}-light-collapsed`, route.title);
}

for (const item of internalTabs) {
  await page.goto(`${baseUrl}/#${item.route}`, { waitUntil: "domcontentloaded" });
  await setFullscreenPreferences("dark");
  await page.reload({ waitUntil: "domcontentloaded" });
  await waitForPageTitle(item.waitTitle);
  const handles = await page.$$(item.selector);
  let target = null;
  if (item.text) {
    for (const handle of handles) {
      const text = (await handle.textContent())?.trim();
      if (text === item.text) {
        target = handle;
        break;
      }
    }
  } else {
    target = handles[item.index];
  }
  if (target) {
    await target.click();
    await page.waitForTimeout(700);
    const screenshot = path.join(outputRoot, `${item.slug}.png`);
    await page.screenshot({ path: screenshot, fullPage: false });
    audit.push({
      route: `${item.route} internal`,
      screenshot,
      title: await page.locator(".page-head h1").textContent(),
      activeSegment: await page.locator(".segmented .on").first().textContent().catch(() => ""),
      cards: await page.locator(".glass-card").count(),
      rows: await page.locator(".data-row").count()
    });
  }
}

await writeFile(path.join(outputRoot, "audit.json"), JSON.stringify(audit, null, 2), "utf8");
await browser.close();

console.log(JSON.stringify({ outputRoot, screenshots: audit.length }, null, 2));
