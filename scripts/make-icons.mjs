// Generates the placeholder extension icons in src/icons/ (purple tile with a white list motif).
// Run once with: node scripts/make-icons.mjs  - replace the PNGs by hand if you get a proper logo.
import { writeFileSync, mkdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { deflateSync } from "node:zlib";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const outDir = join(root, "src", "icons");
mkdirSync(outDir, { recursive: true });

const crcTable = Array.from({ length: 256 }, (_, n) => {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    return c >>> 0;
});
const crc32 = buf => {
    let c = 0xffffffff;
    for (const b of buf) c = crcTable[(c ^ b) & 0xff] ^ (c >>> 8);
    return (c ^ 0xffffffff) >>> 0;
};
const chunk = (type, data) => {
    const body = Buffer.concat([Buffer.from(type), data]);
    const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
    const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(body));
    return Buffer.concat([len, body, crc]);
};

/** Returns coverage (0..1) of the design at a point in unit space. */
function shade(x, y) {
    const inRoundRect = (px, py, x0, y0, x1, y1, r) => {
        const cx = Math.min(Math.max(px, x0 + r), x1 - r);
        const cy = Math.min(Math.max(py, y0 + r), y1 - r);
        return (px - cx) ** 2 + (py - cy) ** 2 <= r * r;
    };
    if (!inRoundRect(x, y, 0, 0, 1, 1, 0.22)) return null;
    const bars = [[0.22, 0.26, 0.78, 0.36], [0.22, 0.45, 0.78, 0.55], [0.22, 0.64, 0.58, 0.74]];
    for (const [x0, y0, x1, y1] of bars) {
        if (inRoundRect(x, y, x0, y0, x1, y1, 0.05)) return [255, 255, 255];
    }
    return [95, 36, 159];
}

function png(size) {
    const samples = 4;
    const raw = Buffer.alloc(size * (size * 4 + 1));
    for (let py = 0; py < size; py++) {
        raw[py * (size * 4 + 1)] = 0;
        for (let px = 0; px < size; px++) {
            let r = 0, g = 0, b = 0, a = 0;
            for (let sy = 0; sy < samples; sy++) {
                for (let sx = 0; sx < samples; sx++) {
                    const c = shade((px + (sx + 0.5) / samples) / size, (py + (sy + 0.5) / samples) / size);
                    if (c) { r += c[0]; g += c[1]; b += c[2]; a += 1; }
                }
            }
            const o = py * (size * 4 + 1) + 1 + px * 4;
            if (a > 0) { raw[o] = r / a; raw[o + 1] = g / a; raw[o + 2] = b / a; }
            raw[o + 3] = Math.round(255 * a / (samples * samples));
        }
    }
    const ihdr = Buffer.alloc(13);
    ihdr.writeUInt32BE(size, 0); ihdr.writeUInt32BE(size, 4);
    ihdr[8] = 8; ihdr[9] = 6;
    return Buffer.concat([
        Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
        chunk("IHDR", ihdr), chunk("IDAT", deflateSync(raw)), chunk("IEND", Buffer.alloc(0))
    ]);
}

for (const size of [16, 32, 48, 128]) {
    writeFileSync(join(outDir, `icon-${size}.png`), png(size));
}
console.log("Wrote src/icons/");
