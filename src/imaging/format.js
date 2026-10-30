// File-type sniffing and the import error, kept apart from the decoders so the
// DICOM/TIFF libraries load only when such a file is opened.

export class ImageImportError extends Error {}

// "DICM" after the 128-byte preamble.
export function looksLikeDicom(bytes) {
  return bytes.length >= 132 && bytes[128] === 0x44 && bytes[129] === 0x49 && bytes[130] === 0x43 && bytes[131] === 0x4d;
}

// "II*\0" (little endian) or "MM\0*" (big endian).
export function looksLikeTiff(bytes) {
  return bytes.length >= 4 &&
    ((bytes[0] === 0x49 && bytes[1] === 0x49 && bytes[2] === 42 && bytes[3] === 0) ||
     (bytes[0] === 0x4d && bytes[1] === 0x4d && bytes[2] === 0 && bytes[3] === 42));
}
