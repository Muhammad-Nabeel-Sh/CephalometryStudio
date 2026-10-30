// ─── Decoders for compressed DICOM pixel data ───────────────────────────────
//
// Loaded only when a file needs them (each is a separate chunk):
//   JPEG-LS          CharLS (WASM, ~200 KB)       @cornerstonejs/codec-charls
//   JPEG 2000        OpenJPEG (WASM, ~320 KB)     @cornerstonejs/codec-openjpeg
//   JPEG Lossless    pure JS                      jpeg-lossless-decoder-js
//   JPEG baseline    the browser's own decoder
// Each returns { width, height, bits, components, signed, samples } where
// samples is a Uint8Array (≤ 8 bits) or Uint16Array, interleaved for colour.

const quiet = { print: () => {}, printErr: () => {} };
const loaded = {};

function once(name, load) {
  if (!loaded[name]) {
    loaded[name] = load();
    loaded[name].catch(() => { loaded[name] = null; });
  }
  return loaded[name];
}

const loadCharLS = () => once("charls", async () => {
  const [{ default: factory }, { default: wasmUrl }] = await Promise.all([
    import("@cornerstonejs/codec-charls/decodewasmjs"),
    import("@cornerstonejs/codec-charls/decodewasm?url"),
  ]);
  return factory({ ...quiet, locateFile: () => wasmUrl });
});

const loadOpenJPEG = () => once("openjpeg", async () => {
  const [{ default: factory }, { default: wasmUrl }] = await Promise.all([
    import("@cornerstonejs/codec-openjpeg/decodewasmjs"),
    import("@cornerstonejs/codec-openjpeg/decodewasm?url"),
  ]);
  return factory({ ...quiet, locateFile: () => wasmUrl });
});

function samplesFrom(bytes, bits) {
  if (bits <= 8) return new Uint8Array(bytes);
  // Copy: the WASM heap view is only valid until the decoder is deleted, and
  // the copy is 2-byte aligned for the Uint16Array.
  const copy = new Uint8Array(bytes.length);
  copy.set(bytes);
  return new Uint16Array(copy.buffer, 0, copy.length >> 1);
}

// The WASM codecs share one calling convention (cornerstone builds).
export function decodeWithWasm(module, Decoder, bytes) {
  const dec = new module[Decoder]();
  try {
    dec.getEncodedBuffer(bytes.length).set(bytes);
    dec.decode();
    const info = dec.getFrameInfo();
    return {
      width: info.width, height: info.height, bits: info.bitsPerSample,
      components: info.componentCount, signed: !!info.isSigned,
      samples: samplesFrom(dec.getDecodedBuffer(), info.bitsPerSample),
    };
  } finally {
    dec.delete();
  }
}

export async function decodeJpegLS(bytes) {
  return decodeWithWasm(await loadCharLS(), "JpegLSDecoder", bytes);
}

export async function decodeJpeg2000(bytes) {
  return decodeWithWasm(await loadOpenJPEG(), "J2KDecoder", bytes);
}

export async function decodeJpegLossless(bytes, bitsAllocated) {
  const { Decoder } = await import("jpeg-lossless-decoder-js");
  const dec = new Decoder();
  const copy = bytes.slice(); // own ArrayBuffer, offset 0
  const samples = dec.decode(copy.buffer, 0, copy.length, bitsAllocated > 8 ? 2 : 1);
  return {
    width: dec.frame.dimX, height: dec.frame.dimY, bits: dec.frame.precision,
    components: dec.frame.numComp, signed: false, samples,
  };
}

// 8-bit baseline JPEG (grayscale or colour) → RGBA via the browser.
export async function decodeJpegBaseline(bytes) {
  const bmp = await createImageBitmap(new Blob([bytes], { type: "image/jpeg" }));
  const c = document.createElement("canvas");
  c.width = bmp.width;
  c.height = bmp.height;
  const ctx = c.getContext("2d", { willReadFrequently: true });
  ctx.drawImage(bmp, 0, 0);
  bmp.close?.();
  return { width: c.width, height: c.height, rgba: ctx.getImageData(0, 0, c.width, c.height).data };
}
