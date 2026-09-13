/** Header checks stop renamed HTML/scripts. They are not a malware scanner. */
export function matchesEvidenceSignature(bytes: Uint8Array, extension: string): boolean {
  const starts = (...prefix: number[]) => prefix.every((value, i) => bytes[i] === value);
  const ascii = (start: number, end: number) => String.fromCharCode(...bytes.subarray(start, end));
  switch (extension) {
    case "jpg": case "jpeg": return starts(0xff, 0xd8, 0xff);
    case "png": return starts(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a);
    case "webp": return ascii(0, 4) === "RIFF" && ascii(8, 12) === "WEBP";
    case "pdf": return ascii(0, 5) === "%PDF-";
    case "doc": return starts(0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1);
    case "docx": {
      if (!starts(0x50, 0x4b, 0x03, 0x04)) return false;
      const text = new TextDecoder("latin1").decode(bytes);
      return text.includes("[Content_Types].xml") && text.includes("word/document.xml");
    }
    case "heic": case "heif":
      return ascii(4, 8) === "ftyp" && /^(heic|heix|hevc|hevx|mif1|msf1)$/.test(ascii(8, 12));
    default: return false;
  }
}
