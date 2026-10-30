import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { writeDicom, grayElements, TS, rleFrame16, writeTiff } from "./helpers/dicomWriter.js";
import { decodeDicom, dicomCalibration, ImageImportError } from "../imaging/dicom.js";
import { decodeTiff, looksLikeTiff } from "../imaging/tiff.js";
import { buildLut, renderGray, autoWindow, defaultChoice, windowPresets } from "../imaging/voi.js";
import { tickPeriod, detectRulerScale } from "../imaging/ruler.js";
import { decodeWithWasm } from "../imaging/codecs.js";

// ═════════════════════════════════════════════════════════════════
// DICOM / TIFF import, display windowing and ruler calibration
// (Phase 2, item 15). DICOM files are written by a test helper; the
// JPEG-LS and JPEG 2000 ones are encoded with the codecs' own
// encoders, and one real JPEG Lossless file comes from the decoder's
// test data.
// ═════════════════════════════════════════════════════════════════

const W = 64, H = 48;
function ramp(bits = 12) {
  const px = new Uint16Array(W * H);
  for (let i = 0; i < px.length; i++) px[i] = (i * 13) % (1 << bits);
  return px;
}
const max = (a) => a.reduce((m, v) => (v > m ? v : m), -Infinity);
const min = (a) => a.reduce((m, v) => (v < m ? v : m), Infinity);

// DICOM PS3.3 C.11.2.1.2 LINEAR, written out independently of voi.js.
function dicomLinear(x, c, w) {
  if (x <= c - 0.5 - (w - 1) / 2) return 0;
  if (x > c - 0.5 + (w - 1) / 2) return 255;
  return Math.round(((x - (c - 0.5)) / (w - 1) + 0.5) * 255);
}

describe("DICOM decoding", () => {
  it("reads 12-bit grayscale with its windows and a magnification-corrected calibration", async () => {
    const px = ramp();
    const buf = writeDicom({
      elements: grayElements({ rows: H, cols: W, extra: [
        ["0028,1050", "DS", ["2000", "1000"]], ["0028,1051", "DS", ["4000", "500"]], ["0028,1055", "LO", ["FULL", "BONE"]],
        ["0018,1164", "DS", ["0.1", "0.1"]], ["0018,1114", "DS", "1.1"],
      ] }),
      pixels: px,
    });
    const d = await decodeDicom(buf);
    expect(d.rgba).toBeNull();
    expect(d.gray.meta).toMatchObject({ width: W, height: H, dtype: "uint16", bitsStored: 12, smin: min(px), smax: max(px), invert: false, slope: 1, intercept: 0 });
    expect(Array.from(d.gray.pixels)).toEqual(Array.from(px));
    expect(d.gray.meta.windows).toEqual([{ name: "FULL", center: 2000, width: 4000 }, { name: "BONE", center: 1000, width: 500 }]);
    const unnamed = await decodeDicom(writeDicom({ elements: grayElements({ rows: H, cols: W, extra: [["0028,1050", "DS", "2000"], ["0028,1051", "DS", "4000"]] }), pixels: px }));
    expect(unnamed.gray.meta.windows).toEqual([{ name: "File", center: 2000, width: 4000 }]);
    expect(defaultChoice(unnamed.gray.pixels, unnamed.gray.meta).name).toBe("File");
    expect(d.calibration).toMatchObject({ done: true, method: "dicom", magnificationCorrected: true });
    expect(d.calibration.pxPerMm).toBeCloseTo(11, 6); // 0.1 mm at the detector ÷ 1.1
    expect(d.source).toMatchObject({ format: "DICOM", modality: "DX", manufacturer: "Test Vendor", bitsStored: 12, lossy: false });
  });

  it("keeps only the stored bits and sign-extends signed pixels", async () => {
    const overlay = Uint16Array.from([0xf123, 0x0fff, 0x8001, 0x0000]);
    const u = await decodeDicom(writeDicom({ elements: grayElements({ rows: 2, cols: 2 }), pixels: overlay }));
    expect(Array.from(u.gray.pixels)).toEqual([0x123, 0xfff, 0x001, 0]);

    const neg = Uint16Array.from([0xffb, 0x005, 0x800, 0x7ff]); // 12-bit two's complement
    const s = await decodeDicom(writeDicom({ elements: grayElements({ rows: 2, cols: 2, signed: true }), pixels: neg }));
    expect(s.gray.meta.dtype).toBe("int16");
    expect(Array.from(s.gray.pixels)).toEqual([-5, 5, -2048, 2047]);
  });

  it("MONOCHROME1 shows inverted unless the presentation LUT shape says otherwise", async () => {
    const px = ramp();
    const m1 = await decodeDicom(writeDicom({ elements: grayElements({ rows: H, cols: W, photometric: "MONOCHROME1" }), pixels: px }));
    expect(m1.gray.meta.invert).toBe(true);
    const ident = await decodeDicom(writeDicom({ elements: grayElements({ rows: H, cols: W, photometric: "MONOCHROME1", extra: [["2050,0020", "CS", "IDENTITY"]] }), pixels: px }));
    expect(ident.gray.meta.invert).toBe(false);
    const inv = await decodeDicom(writeDicom({ elements: grayElements({ rows: H, cols: W, extra: [["2050,0020", "CS", "INVERSE"]] }), pixels: px }));
    expect(inv.gray.meta.invert).toBe(true);
  });

  it("implicit VR, big endian and files without a preamble read the same pixels", async () => {
    const px = ramp();
    for (const opts of [{ ts: TS.implicit }, { ts: TS.bigEndian }, { ts: TS.implicit, preamble: false }]) {
      const d = await decodeDicom(writeDicom({ ...opts, elements: grayElements({ rows: H, cols: W }), pixels: px }));
      expect(Array.from(d.gray.pixels)).toEqual(Array.from(px));
    }
  });

  it("decodes RLE Lossless", async () => {
    const px = ramp();
    const d = await decodeDicom(writeDicom({ ts: TS.rle, elements: grayElements({ rows: H, cols: W }), fragments: [rleFrame16(px)] }));
    expect(Array.from(d.gray.pixels)).toEqual(Array.from(px));
  });

  it("decodes JPEG-LS and JPEG 2000 through the WASM codecs", async () => {
    const require = createRequire(import.meta.url);
    const dist = (pkg, f) => path.join(path.dirname(require.resolve(`@cornerstonejs/${pkg}`)), f);
    const quiet = { print: () => {}, printErr: () => {} };
    const charls = await require(dist("codec-charls", "charlswasm.js"))({ ...quiet, wasmBinary: fs.readFileSync(dist("codec-charls", "charlswasm.wasm")) });
    const ojpeg = await require(dist("codec-openjpeg", "openjpegwasm.js"))({ ...quiet, wasmBinary: fs.readFileSync(dist("codec-openjpeg", "openjpegwasm.wasm")) });
    const px = ramp();
    const encode = (mod, Enc) => {
      const enc = new mod[Enc]();
      enc.getDecodedBuffer({ width: W, height: H, bitsPerSample: 12, componentCount: 1, isSigned: false, isUsingColorTransform: false }).set(new Uint8Array(px.buffer));
      enc.encode();
      const out = new Uint8Array(enc.getEncodedBuffer());
      enc.delete();
      return out;
    };
    const codecs = {
      decodeJpegLS: async (b) => decodeWithWasm(charls, "JpegLSDecoder", b),
      decodeJpeg2000: async (b) => decodeWithWasm(ojpeg, "J2KDecoder", b),
    };
    const ls = await decodeDicom(writeDicom({ ts: TS.jpegLS, elements: grayElements({ rows: H, cols: W }), fragments: [encode(charls, "JpegLSEncoder")] }), { codecs });
    expect(Array.from(ls.gray.pixels)).toEqual(Array.from(px));
    const j2k = await decodeDicom(writeDicom({ ts: TS.j2k, elements: grayElements({ rows: H, cols: W }), fragments: [encode(ojpeg, "J2KEncoder")] }), { codecs });
    expect(Array.from(j2k.gray.pixels)).toEqual(Array.from(px));
    expect(j2k.source.transferSyntax).toBe("JPEG 2000 Lossless");
  });

  it("decodes a real JPEG Lossless file the same as the decoder does directly", async () => {
    const require = createRequire(import.meta.url);
    const root = path.dirname(path.dirname(require.resolve("jpeg-lossless-decoder-js")));
    const file = fs.readFileSync(path.join(root, "..", "tests", "data", "jpeg_lossless_sel1.dcm"));
    const buf = file.buffer.slice(file.byteOffset, file.byteOffset + file.byteLength);
    const d = await decodeDicom(buf);
    expect(d.width).toBe(256);
    expect(d.height).toBe(256);
    const { Decoder } = await import("jpeg-lossless-decoder-js");
    const direct = new Uint16Array(new Decoder().decompress(buf, 1848, 50675 - 1848));
    const pixels = d.gray.pixels;
    let same = pixels.length === direct.length;
    for (let i = 0; same && i < direct.length; i++) if ((pixels[i] & 0xffff) !== direct[i]) same = false;
    expect(same).toBe(true);
  });

  it("gives clear errors for files without an image and unsupported compression", async () => {
    await expect(decodeDicom(writeDicom({ elements: [["0008,0060", "CS", "SR"]] }))).rejects.toThrow(/no image/);
    await expect(decodeDicom(writeDicom({ ts: TS.deflate, elements: grayElements({ rows: 2, cols: 2 }), pixels: new Uint16Array(4) }))).rejects.toBeInstanceOf(ImageImportError);
    await expect(decodeDicom(new Uint8Array(200).buffer)).rejects.toBeInstanceOf(ImageImportError);
  });
});

describe("DICOM calibration rules", () => {
  const get = (tags) => ({
    str: (t) => tags[t],
    float: (t, i) => { const v = tags[t]; if (v == null) return undefined; const p = String(v).split("\\")[i]; return p == null ? undefined : parseFloat(p); },
  });
  const PS = "x00280030", IPS = "x00181164", ERMF = "x00181114", TYPE = "x00280a02", NSPS = "x00182010";

  it("prefers spacing in the patient", () => {
    expect(dicomCalibration(get({ [PS]: "0.09\\0.09", [TYPE]: "GEOMETRY", [IPS]: "0.1\\0.1" })).calibration).toMatchObject({ magnificationCorrected: true, source: expect.stringMatching(/geometry/) });
    const c = dicomCalibration(get({ [IPS]: "0.1\\0.1", [ERMF]: "1.08" })).calibration;
    expect(c.pxPerMm).toBeCloseTo(10.8, 6);
    expect(c.magnificationCorrected).toBe(true);
    expect(dicomCalibration(get({ [PS]: "0.091\\0.091", [IPS]: "0.1\\0.1" })).calibration).toMatchObject({ pxPerMm: 1 / 0.091, magnificationCorrected: true });
  });

  it("falls back to detector or film spacing, flagged as including magnification", () => {
    for (const tags of [{ [PS]: "0.1\\0.1", [IPS]: "0.1\\0.1" }, { [IPS]: "0.1\\0.1" }, { [NSPS]: "0.1\\0.1" }, { [PS]: "0.1" }]) {
      const r = dicomCalibration(get(tags));
      expect(r.calibration.pxPerMm).toBeCloseTo(10, 6);
      expect(r.calibration.magnificationCorrected).toBe(false);
      expect(r.note).toMatch(/magnification/);
    }
  });

  it("doesn't calibrate from missing, non-square or implausible spacing", () => {
    expect(dicomCalibration(get({})).calibration).toBeNull();
    expect(dicomCalibration(get({ [PS]: "0.1\\0.12" })).calibration).toBeNull();
    expect(dicomCalibration(get({ [PS]: "40\\40" })).calibration).toBeNull();
  });
});

describe("display windowing (VOI)", () => {
  const meta = { width: 4, height: 1, dtype: "uint16", bitsStored: 12, smin: 0, smax: 4095, slope: 1, intercept: 0, invert: false, voiFunction: "LINEAR", windows: [], voiLut: null };

  it("follows the DICOM LINEAR window function, inverted for MONOCHROME1", () => {
    const lut = buildLut(meta, { center: 2048, width: 1000 });
    for (const x of [0, 1500, 1548, 1600, 2048, 2500, 2547, 2548, 4095]) expect(lut[x]).toBe(dicomLinear(x, 2048, 1000));
    const inv = buildLut({ ...meta, invert: true }, { center: 2048, width: 1000 });
    expect(inv[0]).toBe(255);
    expect(inv[4095]).toBe(0);
  });

  it("applies the modality rescale before the window", () => {
    const m = { ...meta, slope: 2, intercept: -1000 };
    const lut = buildLut(m, { center: 1000, width: 500 }); // stored 1000 → modality 1000
    expect(lut[1000]).toBe(dicomLinear(1000, 1000, 500));
    expect(lut[700]).toBe(0); // modality 400
  });

  it("uses the file's VOI LUT when there is one", () => {
    const m = { ...meta, smax: 3, voiLut: { first: 0, data: [0, 100, 200, 400] } };
    expect(Array.from(buildLut(m, { lut: true }))).toEqual([0, 64, 128, 255]);
    expect(defaultChoice(new Uint16Array(4), m)).toMatchObject({ lut: true });
    expect(windowPresets(new Uint16Array(4), m).map(p => p.name)).toEqual(["File LUT", "Auto", "Full range"]);
  });

  it("the automatic window ignores outliers such as collimator edges", () => {
    const px = new Uint16Array(10000);
    for (let i = 0; i < px.length; i++) px[i] = 1000 + (i % 1001);
    px[0] = 0; px[1] = 4095; px[2] = 4095;
    const w = autoWindow(px, { ...meta, smin: 0, smax: 4095 });
    expect(w.center - w.width / 2).toBeGreaterThan(990);
    expect(w.center + w.width / 2).toBeLessThan(2010);
  });

  it("renders gray RGBA through the LUT", () => {
    const lut = buildLut(meta, { center: 2048, width: 4096 });
    const rgba = renderGray(Uint16Array.from([0, 1024, 2048, 4095]), meta, lut);
    expect(Array.from(rgba.slice(8, 12))).toEqual([lut[2048], lut[2048], lut[2048], 255]);
  });
});

describe("TIFF decoding", () => {
  it("keeps 16-bit grayscale values; WhiteIsZero is shown inverted", () => {
    const px = ramp(16);
    const buf = writeTiff({ width: W, height: H, samples: px });
    expect(looksLikeTiff(new Uint8Array(buf, 0, 4))).toBe(true);
    const d = decodeTiff(buf);
    expect(d.gray.meta).toMatchObject({ width: W, height: H, dtype: "uint16", invert: false });
    expect(Array.from(d.gray.pixels)).toEqual(Array.from(px));
    expect(decodeTiff(writeTiff({ width: W, height: H, samples: px, photometric: 0 })).gray.meta.invert).toBe(true);
  });

  it("converts 8-bit RGB to RGBA", () => {
    const rgb = new Uint8Array(2 * 2 * 3).map((_, i) => i * 10);
    const d = decodeTiff(writeTiff({ width: 2, height: 2, samples: rgb, bits: 8, spp: 3, photometric: 2 }));
    expect(d.gray).toBeNull();
    expect(Array.from(d.rgba.slice(0, 8))).toEqual([0, 10, 20, 255, 30, 40, 50, 255]);
  });
});

describe("ruler tick detection", () => {
  // Dark ticks on a bright ruler every `period` px along a direction at
  // `angle`, longer ticks every 5, plus noise.
  function rulerImage(period, angle = 0, w = 420, h = 240, seed = 1) {
    const data = new Uint8ClampedArray(w * h * 4);
    const c = Math.cos(angle), s = Math.sin(angle);
    let r = seed;
    const rnd = () => ((r = (r * 1103515245 + 12345) % 2147483648) / 2147483648 - 0.5);
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const u = (x - 20) * c + (y - 20) * s, v = -(x - 20) * s + (y - 20) * c;
        const k = Math.round(u / period), d = u - k * period;
        const len = k % 5 === 0 ? 14 : 8;
        const tick = v >= 0 && v <= len ? Math.exp(-(d * d) / (2 * 0.7 * 0.7)) : 0;
        const val = 200 - 150 * tick + 18 * rnd();
        const i = (y * w + x) * 4;
        data[i] = data[i + 1] = data[i + 2] = val;
        data[i + 3] = 255;
      }
    }
    return { width: w, height: h, data };
  }

  it("finds the tick spacing to a small fraction of a pixel", () => {
    const img = rulerImage(7.3);
    const r = detectRulerScale(img, { x: 25, y: 24 }, { x: 395, y: 24 }, 1);
    expect(r.error).toBeUndefined();
    expect(r.pxPerMm).toBeCloseTo(7.3, 1);
    expect(Math.abs(r.pxPerMm - 7.3)).toBeLessThan(0.02);
    expect(r.ticks).toBeGreaterThan(40);
    expect(detectRulerScale(img, { x: 25, y: 24 }, { x: 395, y: 24 }, 0.5).pxPerMm).toBeCloseTo(14.6, 1);
  });

  it("works along a slanted ruler", () => {
    const a = (25 * Math.PI) / 180, img = rulerImage(11.6, a);
    const along = (u, v) => ({ x: 20 + u * Math.cos(a) - v * Math.sin(a), y: 20 + u * Math.sin(a) + v * Math.cos(a) });
    const r = detectRulerScale(img, along(4, 4), along(300, 4), 1);
    expect(Math.abs(r.pxPerMm - 11.6)).toBeLessThan(0.05);
  });

  it("refuses a short line, a blank strip, or no image", () => {
    const img = rulerImage(7.3);
    expect(detectRulerScale(img, { x: 25, y: 24 }, { x: 50, y: 24 }).error).toMatch(/too short|Too few/);
    expect(detectRulerScale(img, { x: 25, y: 200 }, { x: 395, y: 200 }).error).toBeTruthy();
    expect(detectRulerScale(null, { x: 0, y: 0 }, { x: 1, y: 1 }).error).toMatch(/pixels/);
    expect(tickPeriod(new Float64Array(10)).error).toBeTruthy();
  });
});
