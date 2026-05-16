import { _electron as electron } from "playwright";

const executablePath = process.env.SMOKE_ELECTRON_EXECUTABLE;

if (!executablePath) {
  throw new Error("SMOKE_ELECTRON_EXECUTABLE is required.");
}

let electronApp = null;

try {
  electronApp = await electron.launch({
    executablePath,
    env: {
      ...process.env,
      ELECTRON_DISABLE_SECURITY_WARNINGS: "true"
    }
  });

  const page = await electronApp.firstWindow({ timeout: 45000 });
  await page.waitForLoadState("domcontentloaded", { timeout: 45000 });
  await page.waitForFunction(
    () =>
      document.body.innerText.includes("牛牛开盘 · 复盘工作室") ||
      document.body.innerText.includes("To run a local app, execute the following on the command line"),
    { timeout: 45000 }
  );

  const snapshot = await page.evaluate(() => ({
    bodyText: document.body.innerText,
    title: document.title
  }));

  if (snapshot.bodyText.includes("To run a local app, execute the following on the command line")) {
    throw new Error("Packaged app opened Electron default app instead of NiuNiu client.");
  }

  if (!snapshot.bodyText.includes("牛牛开盘 · 复盘工作室")) {
    throw new Error(`Packaged app did not render the NiuNiu workspace. title=${snapshot.title}`);
  }

  console.log(JSON.stringify({ ok: true, title: snapshot.title }, null, 2));
} finally {
  if (electronApp) {
    await electronApp.close().catch(() => undefined);
  }
}
