import { describe, it, expect } from "vitest";
import {
  imageDataToGrayscale,
  resizeBilinearGray,
  preprocessGrayscale,
  decodeHeatmaps,
  decodeRegression,
  MODEL_INPUT_SIZE,
} from "../lib/landmarkModel.js";

describe("imageDataToGrayscale", () => {
  it("converts white/black pixels to 1/0", () => {
    expect(imageDataToGrayscale(new Uint8ClampedArray([255, 255, 255, 255]), 1, 1)[0]).toBeCloseTo(1);
    expect(imageDataToGrayscale(new Uint8ClampedArray([0, 0, 0, 255]), 1, 1)[0]).toBeCloseTo(0);
  });
});

describe("resizeBilinearGray", () => {
  it("is an identity copy at the same size", () => {
    const out = resizeBilinearGray(new Float32Array([0, 1, 2, 3]), 2, 2, 2, 2);
    expect([...out]).toEqual([0, 1, 2, 3]);
  });

  it("averages a 2×2 block down to a single value", () => {
    const out = resizeBilinearGray(new Float32Array([0, 1, 2, 3]), 2, 2, 1, 1);
    expect(out[0]).toBeCloseTo(1.5, 5);
  });
});

describe("preprocessGrayscale", () => {
  it("produces a size×size normalized tensor and keeps source dims", () => {
    const rgba = new Uint8ClampedArray(4 * 4 * 4).fill(255);
    const { tensor, size, srcWidth, srcHeight } = preprocessGrayscale(rgba, 4, 4, MODEL_INPUT_SIZE);
    expect(size).toBe(MODEL_INPUT_SIZE);
    expect(srcWidth).toBe(4);
    expect(srcHeight).toBe(4);
    expect(tensor).toHaveLength(MODEL_INPUT_SIZE * MODEL_INPUT_SIZE);
    expect(tensor[0]).toBeCloseTo(1);
  });

  it("replicates grayscale across RGB channels when requested", () => {
    const rgba = new Uint8ClampedArray(4 * 4 * 4).fill(255);
    const { tensor, channels } = preprocessGrayscale(rgba, 4, 4, 8, { channels: 3 });
    expect(channels).toBe(3);
    expect(tensor).toHaveLength(3 * 8 * 8);
    expect(tensor[0]).toBeCloseTo(1);
    expect(tensor[64]).toBeCloseTo(1);
    expect(tensor[128]).toBeCloseTo(1);
  });

  it("applies per-channel ImageNet normalization", () => {
    const rgba = new Uint8ClampedArray(4 * 4 * 4).fill(255);
    const { tensor } = preprocessGrayscale(rgba, 4, 4, 2, {
      channels: 3,
      mean: [0.485, 0.456, 0.406],
      std: [0.229, 0.224, 0.225],
    });
    expect(tensor[0]).toBeCloseTo((1 - 0.485) / 0.229, 5);
    expect(tensor[4]).toBeCloseTo((1 - 0.456) / 0.224, 5);
    expect(tensor[8]).toBeCloseTo((1 - 0.406) / 0.225, 5);
  });
});

describe("decodeHeatmaps", () => {
  it("maps a heatmap peak back to source pixels", () => {
    const flat = new Float32Array(4 * 4);
    flat[1 * 4 + 2] = 0.9;
    const [lm] = decodeHeatmaps(flat, { channels: 1, heatWidth: 4, heatHeight: 4, srcWidth: 8, srcHeight: 8 });
    expect(lm.x).toBeCloseTo(5, 5);
    expect(lm.y).toBeCloseTo(3, 5);
    expect(lm.confidence).toBeCloseTo(0.9, 5);
  });

  it("decodes multiple channels independently", () => {
    const flat = new Float32Array(2 * 4 * 4);
    flat[0] = 1;                 // channel 0, (0,0)
    flat[16 + 3 * 4 + 3] = 0.5;  // channel 1, (3,3)
    const out = decodeHeatmaps(flat, { channels: 2, heatWidth: 4, heatHeight: 4, srcWidth: 8, srcHeight: 8 });
    expect(out).toHaveLength(2);
    expect(out[0].x).toBeCloseTo(1, 5);
    expect(out[0].y).toBeCloseTo(1, 5);
    expect(out[1].x).toBeCloseTo(7, 5);
    expect(out[1].y).toBeCloseTo(7, 5);
  });

  it("applies a sigmoid when requested", () => {
    const flat = new Float32Array(4 * 4);
    flat[0] = 0;
    const [lm] = decodeHeatmaps(flat, { channels: 1, heatWidth: 4, heatHeight: 4, srcWidth: 4, srcHeight: 4, applySigmoid: true });
    expect(lm.confidence).toBeCloseTo(0.5, 5);
  });
});

describe("decodeRegression", () => {
  it("scales normalized coordinates to source pixels", () => {
    const [lm] = decodeRegression(new Float32Array([0.25, 0.5]), { channels: 1, srcWidth: 100, srcHeight: 200, normalize: true });
    expect(lm.x).toBeCloseTo(25, 5);
    expect(lm.y).toBeCloseTo(100, 5);
  });
});

describe("decodeHeatmaps — DARK", () => {
  function gaussianPlane(w, h, cx, cy, sigma = 1.5) {
    const p = new Float32Array(w * h);
    for (let y = 0; y < h; y++)
      for (let x = 0; x < w; x++)
        p[y * w + x] = Math.exp(-(((x - cx) ** 2 + (y - cy) ** 2) / (2 * sigma * sigma)));
    return p;
  }

  it("recovers a sub-pixel peak more accurately than raw argmax", () => {
    const w = 32, h = 32, cx = 10.3, cy = 20.6;
    const plane = gaussianPlane(w, h, cx, cy);
    const opts = { channels: 1, heatWidth: w, heatHeight: h, srcWidth: w, srcHeight: h };
    const [dark] = decodeHeatmaps(plane, { ...opts, dark: true, sigma: 2 });
    const [quad] = decodeHeatmaps(plane, { ...opts, dark: false });
    const truthX = cx + 0.5, truthY = cy + 0.5; // +0.5 pixel-centre convention
    expect(Math.abs(dark.x - truthX)).toBeLessThan(0.25);
    expect(Math.abs(dark.y - truthY)).toBeLessThan(0.25);
    expect(Math.abs(dark.x - truthX)).toBeLessThanOrEqual(Math.abs(quad.x - truthX) + 0.05);
  });

  it("decodes multiple channels and integer peaks", () => {
    const w = 16, h = 16;
    const plane = new Float32Array(2 * w * h);
    plane.set(gaussianPlane(w, h, 5, 9), 0);
    plane.set(gaussianPlane(w, h, 12, 3), w * h);
    const out = decodeHeatmaps(plane, { channels: 2, heatWidth: w, heatHeight: h, srcWidth: w, srcHeight: h, dark: true, sigma: 2 });
    expect(out).toHaveLength(2);
    expect(out[0].x).toBeCloseTo(5.5, 0);
    expect(out[0].y).toBeCloseTo(9.5, 0);
    expect(out[1].x).toBeCloseTo(12.5, 0);
    expect(out[1].y).toBeCloseTo(3.5, 0);
  });
});
