import { mkdir } from "node:fs/promises";
import { chromium, expect } from "@playwright/test";
import { spawn } from "node:child_process";
import assert from "node:assert/strict";
if (process.env.JOURNAL_V2_ARTIFACT_DIR)
  await mkdir(process.env.JOURNAL_V2_ARTIFACT_DIR, { recursive: true });
const base = "http://127.0.0.1:5201";
const server = spawn(
  process.execPath,
  ["node_modules/vite/bin/vite.js", "--host", "127.0.0.1", "--port", "5201"],
  { stdio: "ignore" },
);
const png = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/p9sAAAAASUVORK5CYII=",
  "base64",
);
let browser;
try {
  browser = await chromium.launch({
    executablePath:
      process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH || undefined,
    args: ["--no-sandbox"],
  });
  const page = await browser.newPage({
      viewport: { width: 1500, height: 1050 },
    }),
    errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  for (let i = 0; i < 60; i++) {
    try {
      await page.goto(base);
      break;
    } catch {
      await new Promise((r) => setTimeout(r, 100));
    }
  }
  await expect(page.getByLabel("View account")).toBeVisible();
  await expect(
    page
      .getByText(
        "No realised trades yet. Your recorded results will appear here.",
      )
      .first(),
  ).toBeVisible();
  await page.evaluate(async () => {
    const j = await import("/src/localJournal.js"),
      { RULES } = await import("/src/discipline.js");
    const accounts = [
        { id: "a", name: "Synthetic A" },
        { id: "b", name: "Synthetic B" },
      ],
      answers = Object.fromEntries(RULES.map(([id]) => [id, "yes"]));
    const shot = {
      id: "seed-shot",
      name: "context.png",
      kind: "context",
      explanation: "Weekly context\n\nDetailed explanation.",
      dataUrl:
        "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/p9sAAAAASUVORK5CYII=",
    };
    let s = j.normalizeStore({
      accounts,
      entries: [
        {
          id: "old-entry",
          date: "2026-11-06",
          text: "Preserved historical daily entry",
        },
      ],
      playbooks: [
        {
          id: "old-plan",
          name: "Original plan",
          setupRules: ["Original setup rule"],
          entryChecklist: ["Original entry rule"],
          invalidationRules: ["No confirmation"],
          managementRules: ["Risk management"],
          exampleNotes: "Original example\nSecond line",
        },
      ],
      discipline: [
        {
          id: "old-a",
          accountId: "a",
          date: "2026-11-06",
          answers,
          notes: "First account reflection",
        },
        {
          id: "old-b",
          accountId: "b",
          date: "2026-11-06",
          answers: { ...answers, deskBefore: "no" },
          notes: "Second account reflection",
        },
      ],
    });
    for (const [id, accountId, pnl, date] of [
      ["win", "a", "100", "2026-11-06"],
      ["loss", "b", "-50", "2026-11-05"],
      ["flat", "a", "0", "2026-11-07"],
    ])
      s = j.prepareLocalTrade(s, {
        id,
        accountId,
        pnl,
        date,
        asset: pnl === "-50" ? "MES" : "MNQ",
        direction: "Long",
        strategy: pnl === "-50" ? "NY AM Model" : "London Draw",
        setupName: "Liquidity sweep",
        entryTime: "08:00",
        exitTime: "08:20",
        rr: "2",
        note: "  Raw original\n\n\nwith paragraphs  ",
        screenshots: [
          shot,
          {
            ...shot,
            id: "execution-shot",
            name: "execution.png",
            kind: "execution",
            explanation: "Execution explanation",
          },
        ],
        primaryScreenshotId: "seed-shot",
      });
    s.trades.push({
      id: "unclassified",
      accountId: "a",
      date: "2026-11-07",
      asset: "MNQ",
      pnl: "",
      outcome: "",
      realised: true,
    });
    await j.writeLocalStore(s);
  });
  await page.reload();
  await expect(page.locator(".outcome-card svg")).toHaveAttribute(
    "aria-label",
    "1 wins, 1 losses, 1 breakevens",
  );
  await expect(page.locator(".outcome-card strong")).toHaveText("50.0%");
  if (process.env.JOURNAL_V2_ARTIFACT_DIR)
    await page.screenshot({
      path: `${process.env.JOURNAL_V2_ARTIFACT_DIR}/v2-dashboard.png`,
      fullPage: true,
    });
  const cumulative = page.locator(
    'svg[aria-label="Cumulative realised P&L by date"]',
  );
  assert.deepEqual(await cumulative.locator("circle title").allTextContents(), [
    "2026-11-05: -$50",
    "2026-11-06: $50",
    "2026-11-07: $50",
  ]);
  await expect(
    page.locator('svg[aria-label="Daily realised P&L by date"] .blue'),
  ).toHaveCount(1);
  await expect(page.locator(".week-total").first()).toHaveAttribute(
    "title",
    /2026-11-01 – 2026-11-07/,
  );
  await page.getByLabel("View account").selectOption("a");
  await expect(page.locator(".outcome-card svg")).toHaveAttribute(
    "aria-label",
    "1 wins, 0 losses, 1 breakevens",
  );
  await page
    .getByRole("button", { name: "Add Trade", exact: true })
    .first()
    .click();
  await expect(
    page.getByRole("combobox", { name: "Session", exact: true }),
  ).toHaveValue("London");
  await expect(page.getByLabel("Strategy", { exact: true })).toHaveValue(
    "London Draw",
  );
  await expect(page.getByText("Smart Review", { exact: true })).toHaveCount(0);
  await expect(
    page.getByRole("checkbox", { name: /Realised result/ }),
  ).toHaveCount(0);
  await expect(
    page.getByText("Execution Time & P&L Guidance", { exact: true }),
  ).toBeVisible();
  await page.getByLabel("Trade playbook").selectOption("old-plan");
  await page.getByLabel("P&L", { exact: true }).fill("120");
  await page
    .getByRole("checkbox", { name: "Synthetic B", exact: true })
    .check();
  await page.getByLabel("Net P&L Synthetic B", { exact: true }).fill("-20");
  await page.getByRole("button", { name: /Screenshots Chart images/ }).click();
  await page
    .locator("input[type=file]")
    .first()
    .setInputFiles([
      { name: "first.png", mimeType: "image/png", buffer: png },
      { name: "second.png", mimeType: "image/png", buffer: png },
    ]);
  await page
    .getByLabel("Screenshot explanation", { exact: true })
    .fill("First explanation\n\nParagraph two with spaces.");
  await page.locator(".shot").nth(1).click();
  await page
    .getByLabel("Screenshot explanation", { exact: true })
    .fill("Second explanation");
  await page.getByRole("button", { name: "Move earlier", exact: true }).click();
  await expect(
    page.getByLabel("Screenshot explanation", { exact: true }),
  ).toHaveValue("Second explanation");
  await page.getByRole("button", { name: /Notes Tags and context/ }).click();
  await page
    .getByLabel("Raw Trade Notes", { exact: true })
    .fill("Original raw notes\n\nDetailed multi-account decision.");
  await page.getByRole("button", { name: /Review Check and save/ }).click();
  await page.getByRole("button", { name: "Save Trade", exact: true }).click();
  await expect(page.getByText("Trade saved.", { exact: true })).toBeVisible();
  const saved = await page.evaluate(async () => {
    const j = await import("/src/localJournal.js");
    return (await j.loadLocalStore()).trades.filter((t) => t.submissionId);
  });
  assert.equal(saved.length, 2);
  assert.equal(saved[0].realised, true);
  assert.equal(saved[0].playbookId, "old-plan");
  assert.equal(saved[1].playbookId, "old-plan");
  assert.equal(saved[0].screenshots[0].explanation, "Second explanation");
  assert.equal(
    saved[1].screenshots[1].explanation,
    "First explanation\n\nParagraph two with spaces.",
  );
  await page.goto(`${base}/app/trade/${saved[0].id}`);
  await expect(page.locator(".screenshot-explanation p")).toHaveText(
    "Second explanation",
  );
  await page.locator(".zella-shot-strip button").nth(1).click();
  await expect(page.locator(".screenshot-explanation p")).toHaveText(
    "First explanation\n\nParagraph two with spaces.",
  );
  if (process.env.JOURNAL_V2_ARTIFACT_DIR)
    await page.screenshot({
      path: `${process.env.JOURNAL_V2_ARTIFACT_DIR}/v2-review.png`,
      fullPage: true,
    });
  assert.equal(
    await page.locator(".zella-coach-card").getAttribute("open"),
    null,
  );
  assert.equal(
    await page.locator(".zella-journal-card").getAttribute("open"),
    null,
  );
  assert.equal(
    await page
      .locator(".zella-main-column")
      .evaluate(
        (el) =>
          el
            .querySelector(".zella-raw-card")
            .compareDocumentPosition(el.querySelector(".zella-coach-card")) &
          Node.DOCUMENT_POSITION_FOLLOWING,
      ),
    4,
  );
  await page.getByRole("button", { name: "Edit Trade", exact: true }).click();
  await page.getByRole("button", { name: /Screenshots Chart images/ }).click();
  await page
    .getByLabel("Screenshot explanation", { exact: true })
    .fill("Edited independently\nLine two");
  const previousId = await page.evaluate(async (id) => {
    const j = await import("/src/localJournal.js");
    return (await j.loadLocalStore()).trades.find((t) => t.id === id)
      .primaryScreenshotId;
  }, saved[0].id);
  await page.getByLabel("Replace selected image").setInputFiles({
    name: "replacement.png",
    mimeType: "image/png",
    buffer: png,
  });
  await page.locator(".shot").nth(1).getByTitle("Remove screenshot").click();
  await page.getByRole("button", { name: /Review Check and save/ }).click();
  await page.getByRole("button", { name: "Save Trade", exact: true }).click();
  await expect(page.getByText("Trade saved.", { exact: true })).toBeVisible();
  await page.evaluate(
    async ({ id, other, previousId }) => {
      const j = await import("/src/localJournal.js"),
        s = await j.loadLocalStore(),
        t = s.trades.find((t) => t.id === id),
        b = s.trades.find((t) => t.id === other);
      if (
        t.primaryScreenshotId !== previousId ||
        t.screenshots.length !== 1 ||
        b.screenshots.length !== 2 ||
        t.screenshots[0].explanation !== "Edited independently\nLine two" ||
        b.screenshots[0].explanation !== "Second explanation"
      )
        throw Error("Image replacement or independent edit failed");
    },
    { id: saved[0].id, other: saved[1].id, previousId },
  );
  await page.getByRole("button", { name: "Discipline", exact: true }).click();
  await page.getByLabel("Discipline trading day").fill("2026-11-06");
  await expect(
    page.getByText("Conflicting historical checklists — review before saving", {
      exact: true,
    }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Save Daily Checklist" }).click();
  await expect(
    page.getByText(
      "Resolve each conflicting answer before saving the global checklist. Original records are preserved.",
      { exact: true },
    ),
  ).toBeVisible();
  await page
    .getByRole("group", { name: "Am I trading from my desk?", exact: true })
    .getByRole("button", { name: "Yes", exact: true })
    .click();
  await page
    .getByLabel("Daily reflection")
    .fill("Resolved personal reflection");
  await page.getByRole("button", { name: "Save Daily Checklist" }).click();
  await expect(
    page.getByText("Checklist and reflection saved.", { exact: true }),
  ).toBeVisible();
  await page.getByLabel("View account").selectOption("b");
  await expect(page.getByLabel("Daily reflection")).toHaveValue(
    "Resolved personal reflection",
  );
  await page.getByLabel("View account").selectOption("");
  await expect(page.getByLabel("Daily reflection")).toHaveValue(
    "Resolved personal reflection",
  );
  await page.evaluate(async () => {
    const j = await import("/src/localJournal.js"),
      s = await j.loadLocalStore();
    if (
      s.discipline.length !== 3 ||
      s.discipline.filter((r) => !r.accountId).length !== 1
    )
      throw Error("Global checklist lost originals or duplicated days");
  });
  await page.getByRole("button", { name: "Playbooks", exact: true }).click();
  await expect(page.getByLabel("Description").first()).toHaveValue(
    "Original setup rule",
  );
  const description = page.getByLabel("Description").first();
  await description.fill("");
  await description.pressSequentially("Words with spaces");
  await description.press("Enter");
  await description.press("Enter");
  await description.pressSequentially("A second paragraphx");
  await description.press("Backspace");
  for (let i = 0; i < 2; i++)
    await page.getByRole("button", { name: "Add step", exact: true }).click();
  await page.getByLabel("Step name").nth(5).fill("Entry");
  await page.getByLabel("Step name").nth(6).fill("Stop");
  await page
    .getByRole("combobox", { name: "Type", exact: true })
    .nth(0)
    .selectOption("decision");
  const nodeIds = await page
    .locator(".flow-node")
    .evaluateAll((nodes) => nodes.map((n) => n.id.replace("node-", "")));
  await page
    .locator(".flow-node")
    .first()
    .getByRole("combobox", { name: "yes →", exact: true })
    .selectOption(nodeIds[5]);
  await page
    .locator(".flow-node")
    .first()
    .getByRole("combobox", { name: "no →", exact: true })
    .selectOption(nodeIds[6]);
  await page
    .getByRole("button", { name: "Save Playbooks", exact: true })
    .click();
  await expect(
    page.getByText("Playbooks saved.", { exact: true }),
  ).toBeVisible();
  await page.reload();
  await expect(page.getByLabel("Description").first()).toHaveValue(
    "Words with spaces\n\nA second paragraph",
  );
  await page
    .locator(".flow-node")
    .nth(5)
    .getByRole("button", { name: "Move up", exact: true })
    .click();
  await page.getByRole("button", { name: "Add step", exact: true }).click();
  await page
    .locator(".flow-node")
    .last()
    .getByRole("button", { name: "Remove step", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Save Playbooks", exact: true })
    .click();
  await expect(
    page.getByText("Playbooks saved.", { exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Review mode", exact: true }).click();
  await expect(
    page
      .locator(".flow-node")
      .first()
      .getByRole("link", { name: "yes ───→ Entry" }),
  ).toBeVisible();
  await expect(
    page
      .locator(".flow-node")
      .first()
      .getByRole("link", { name: "no ───→ Stop" }),
  ).toBeVisible();
  if (process.env.JOURNAL_V2_ARTIFACT_DIR)
    await page.screenshot({
      path: `${process.env.JOURNAL_V2_ARTIFACT_DIR}/v2-flow.png`,
      fullPage: true,
    });
  await page.getByRole("button", { name: "Reports", exact: true }).click();
  const metric = (label) =>
    page
      .locator(".report-stats>div")
      .filter({
        has: page.locator("span", { hasText: new RegExp("^" + label + "$") }),
      })
      .locator("strong");
  await expect(metric("Total realised net P&L")).toHaveText("$150");
  await expect(metric("Executed trades")).toHaveText("5");
  await page.getByLabel("View account").selectOption("b");
  await expect(metric("Total realised net P&L")).toHaveText("-$70");
  await page.getByLabel("View account").selectOption("");
  await page.getByLabel("From", { exact: true }).fill("2026-11-06");
  await expect(metric("Total realised net P&L")).toHaveText("$200");
  await page.getByLabel("To", { exact: true }).fill("2026-11-07");
  await expect(metric("Total realised net P&L")).toHaveText("$100");
  await page.getByLabel("From", { exact: true }).fill("");
  await page.getByLabel("To", { exact: true }).fill("");
  await page
    .getByRole("combobox", { name: "Instrument", exact: true })
    .selectOption("MNQ");
  await expect(metric("Total realised net P&L")).toHaveText("$200");
  await page
    .getByRole("combobox", { name: "Instrument", exact: true })
    .selectOption("");
  await page
    .getByRole("combobox", { name: "Strategy", exact: true })
    .selectOption("London Draw");
  await expect(metric("Total realised net P&L")).toHaveText("$200");
  await page
    .getByRole("combobox", { name: "Strategy", exact: true })
    .selectOption("");
  await page
    .getByRole("combobox", { name: "Setup", exact: true })
    .selectOption("Liquidity sweep");
  await expect(metric("Total realised net P&L")).toHaveText("$50");
  await page
    .getByRole("combobox", { name: "Setup", exact: true })
    .selectOption("");
  await page.getByRole("button", { name: "Days", exact: true }).click();
  await expect(page.getByRole("table")).toContainText("Friday");
  await expect(page.getByRole("table")).toContainText("$100");
  assert.equal(await page.locator("tbody tr").count(), 7);
  if (process.env.JOURNAL_V2_ARTIFACT_DIR)
    await page.screenshot({
      path: `${process.env.JOURNAL_V2_ARTIFACT_DIR}/v2-reports.png`,
      fullPage: true,
    });
  await page.getByRole("button", { name: "Months", exact: true }).click();
  await expect(page.getByRole("table")).toContainText("2026-11");
  await page
    .getByRole("button", { name: "Trading Discipline", exact: true })
    .click();
  await expect(
    page.getByText("Compliant: 1 days ·", { exact: false }),
  ).toBeVisible();
  await page
    .getByText("Historical Daily Journal archive", { exact: true })
    .click();
  await expect(
    page.getByText("Preserved historical daily entry", { exact: true }),
  ).toBeVisible();
  await page.evaluate(async () => {
    const j = await import("/src/localJournal.js"),
      s = await j.loadLocalStore(),
      r = await j.importLocalBackup(await j.exportLocalBackup(s));
    for (let i = 0; i < s.trades.length; i++)
      if (
        JSON.stringify(
          (s.trades[i].screenshots || []).map((x) => [
            x.id,
            x.explanation,
            x.dataUrl,
          ]),
        ) !==
        JSON.stringify(
          (r.trades[i].screenshots || []).map((x) => [
            x.id,
            x.explanation,
            x.dataUrl,
          ]),
        )
      )
        throw Error("ZIP lost annotation association");
    if (
      JSON.stringify(r.playbooks) !== JSON.stringify(s.playbooks) ||
      JSON.stringify(r.discipline) !== JSON.stringify(s.discipline) ||
      r.entries[0].text !== s.entries[0].text
    )
      throw Error("ZIP lost collections");
    const merged = await j.mergeImportedStore(
      await j.mergeImportedStore(s, r),
      r,
    );
    if (
      merged.trades.length !== s.trades.length ||
      merged.discipline.length !== s.discipline.length ||
      merged.playbooks[0].nodes[0].yes !== s.playbooks[0].nodes[0].yes
    )
      throw Error("Repeated ZIP import duplicated or lost new data");
    await j.createLocalAutoBackup(s, "v2-browser");
    const snap = (await j.listLocalAutoBackups())[0];
    await j.saveLocalPlaybooks(s, []);
    const restored = await j.restoreLocalAutoBackup(snap.id);
    if (
      restored.playbooks[0].nodes[0].description !==
        s.playbooks[0].nodes[0].description ||
      restored.trades.find((t) => t.submissionId).screenshots[0].explanation !==
        "Edited independently\nLine two"
    )
      throw Error("Recovery lost v2 fields");
  });
  for (const width of [1024, 768, 390, 320]) {
    await page.setViewportSize({ width, height: 900 });
    for (const tab of [
      "Dashboard",
      "Reports",
      "Playbooks",
      "Trade Log",
      "Discipline",
      "Add Trade",
    ]) {
      await page
        .getByRole("button", { name: tab, exact: true })
        .first()
        .click();
      assert.equal(
        await page.evaluate(
          () => document.documentElement.scrollWidth > innerWidth + 2,
        ),
        false,
        `${tab}: overflow at ${width}`,
      );
    }
  }
  assert.deepEqual(errors, []);
  console.log(
    "Version 2 browser checks passed: chart axes/outcomes/account scope, annotations/reorder/replace/edit, atomic multi-account copy, review layout, global conflicts, flowcharts, reports, archive, ZIP/recovery and responsive screens.",
  );
} finally {
  await browser?.close();
  server.kill("SIGTERM");
}
