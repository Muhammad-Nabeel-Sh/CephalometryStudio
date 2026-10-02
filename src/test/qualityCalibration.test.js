import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { assessTraceQuality, DEFAULT_QUALITY_THRESHOLDS as TH } from "../lib/landmarkQuality.js";

// ═══════════════════════════════════════════════════════════════════════════════
// Calibration regression — CEPHA29 held-out `valid` split (150 images)
//
// The CSV was produced by `scripts/eval-landmark-model.py --report-ood` against
// the shipped INT8 model on the valid split (see
// docs/ai-module-improvement-plan.md §14). The gate must rate almost none of
// these known-good traces "low" — that false alarm was the reported bug. If the
// thresholds are ever tightened past the measured distribution, this fails.
// ═══════════════════════════════════════════════════════════════════════════════

const N = 29;
const dir = path.dirname(fileURLToPath(import.meta.url));
const rows = fs
  .readFileSync(path.join(dir, "fixtures", "cepha29-valid-ood.csv"), "utf8")
  .trim()
  .split(/\r?\n/)
  .slice(1)
  .map((line) => {
    const [, meanConf, minConf, lowFrac, residualRatio, mahalanobis] = line.split(",");
    return { meanConf: +meanConf, minConf: +minConf, lowFrac: +lowFrac, residualRatio: +residualRatio, mahalanobis: +mahalanobis };
  });

// Rebuild a landmark set that reproduces the per-image aggregates the gate reads
// (mean confidence and low fraction). Positions sit far from the border so the
// edge guard is inert — the CSV does not record image dimensions.
function landmarksFor(row) {
  const lowCount = Math.min(N, Math.round(row.lowFrac * N));
  const lowConf = 0.05;
  const highCount = N - lowCount;
  const highConf = highCount > 0 ? (row.meanConf * N - lowCount * lowConf) / highCount : lowConf;
  return Array.from({ length: N }, (_, i) => ({
    x: 200 + (i % 10) * 50,
    y: 200 + Math.floor(i / 10) * 50,
    confidence: i < lowCount ? lowConf : Math.max(0, highConf),
  }));
}

function verdict(row) {
  return assessTraceQuality({
    landmarks: landmarksFor(row),
    width: 4000,
    height: 4000,
    residual: { residual: row.residualRatio * 300, residualRatio: row.residualRatio, mahalanobis: row.mahalanobis },
  });
}

const verdicts = rows.map(verdict);
const lowRate = verdicts.filter((q) => q.level === "low").length / verdicts.length;
const flaggedRate = verdicts.filter((q) => q.level !== "high").length / verdicts.length;

describe("quality gate calibration (CEPHA29 valid)", () => {
  it("loads the expected calibration set", () => {
    expect(rows.length).toBe(150);
    expect(rows.every((r) => Number.isFinite(r.residualRatio) && Number.isFinite(r.meanConf))).toBe(true);
  });

  it("rates essentially no known-good trace as low (target <=5%)", () => {
    expect(lowRate).toBeLessThanOrEqual(0.05);
  });

  it("does not nag: at most ~10% of known-good traces are flagged at all", () => {
    expect(flaggedRate).toBeLessThanOrEqual(0.1);
  });

  it("sets the residual 'high' cut above every valid image, below a mirrored one", () => {
    const max = Math.max(...rows.map((r) => r.residualRatio));
    expect(TH.residualRatioHigh).toBeGreaterThan(max);
    expect(TH.residualRatioHigh).toBeLessThan(1.0); // mirrored / garbage ≈ 1.03
  });

  it("sets the confidence and weak-landmark cuts below every valid image", () => {
    expect(TH.minMeanConfidence).toBeLessThan(Math.min(...rows.map((r) => r.meanConf)));
    expect(TH.maxLowFraction).toBeGreaterThan(Math.max(...rows.map((r) => r.lowFrac)));
    expect(TH.mediumLowFraction).toBeGreaterThan(Math.max(...rows.map((r) => r.lowFrac)));
  });
});