import { chromium } from "playwright";
import { checkReform } from "./reform-checks.mjs";
const browser = await chromium.launch();
const page = await browser.newPage({ reducedMotion: "reduce" });
const errors = [];
page.on("pageerror", (error) => errors.push(error.message));
try {
  console.log(
    await checkReform(
      page,
      (size) => page.setViewportSize(size),
      process.env.IKUSEI_TEST_URL ?? "http://127.0.0.1:5174/",
    ),
  );
  if (errors.length) throw new Error(errors.join("\n"));
  console.log(
    "PASS reform UI: all jobs, settlement, resume, responsive novel, first-read protection",
  );
} finally {
  await browser.close();
}
