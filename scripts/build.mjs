// Builds dist/<browser>/ from src/ + manifests/<browser>.json, optionally zipping each.
// Zero dependencies: needs only Node 18+.
import { readFileSync, writeFileSync, mkdirSync, rmSync, cpSync, readdirSync, statSync } from "node:fs";
import { join, dirname, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { deflateRawSync } from "node:zlib";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const browsers = ["chrome", "edge", "firefox"];
const { version } = JSON.parse(readFileSync(join(root, "package.json"), "utf8"));
const zip = process.argv.includes("--zip");

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

function listFiles(dir) {
    return readdirSync(dir).flatMap(name => {
        const full = join(dir, name);
        return statSync(full).isDirectory() ? listFiles(full) : [full];
    });
}

/** Minimal ZIP writer (deflate) so no archiver dependency is needed. */
function writeZip(dir, outFile) {
    const parts = [];
    const central = [];
    let offset = 0;
    for (const file of listFiles(dir)) {
        const name = Buffer.from(relative(dir, file).split("\\").join("/"));
        const data = readFileSync(file);
        const packed = deflateRawSync(data);
        const crc = crc32(data);
        const local = Buffer.alloc(30);
        local.writeUInt32LE(0x04034b50, 0);
        local.writeUInt16LE(20, 4);
        local.writeUInt16LE(0x0800, 6); // UTF-8 names
        local.writeUInt16LE(8, 8);
        local.writeUInt32LE(0x21, 10);  // fixed 1980-01-01 date for reproducible output
        local.writeUInt32LE(crc, 14);
        local.writeUInt32LE(packed.length, 18);
        local.writeUInt32LE(data.length, 22);
        local.writeUInt16LE(name.length, 26);
        parts.push(local, name, packed);

        const entry = Buffer.alloc(46);
        entry.writeUInt32LE(0x02014b50, 0);
        entry.writeUInt16LE(20, 4);
        entry.writeUInt16LE(20, 6);
        entry.writeUInt16LE(0x0800, 8);
        entry.writeUInt16LE(8, 10);
        entry.writeUInt32LE(0x21, 12);
        entry.writeUInt32LE(crc, 16);
        entry.writeUInt32LE(packed.length, 20);
        entry.writeUInt32LE(data.length, 24);
        entry.writeUInt16LE(name.length, 28);
        entry.writeUInt32LE(offset, 42);
        central.push(entry, name);
        offset += 30 + name.length + packed.length;
    }
    const centralBuf = Buffer.concat(central);
    const end = Buffer.alloc(22);
    end.writeUInt32LE(0x06054b50, 0);
    end.writeUInt16LE(central.length / 2, 8);
    end.writeUInt16LE(central.length / 2, 10);
    end.writeUInt32LE(centralBuf.length, 12);
    end.writeUInt32LE(offset, 16);
    writeFileSync(outFile, Buffer.concat([...parts, centralBuf, end]));
}

rmSync(join(root, "dist"), { recursive: true, force: true });
for (const browser of browsers) {
    const out = join(root, "dist", browser);
    mkdirSync(out, { recursive: true });
    cpSync(join(root, "src"), out, { recursive: true });

    const template = readFileSync(join(root, "manifests", `${browser}.json`), "utf8").replace(/^\uFEFF/, "");
    const manifest = JSON.parse(template.replace("__VERSION__", version));
    writeFileSync(join(out, "manifest.json"), JSON.stringify(manifest, null, 2) + "\n");

    if (zip) {
        writeZip(out, join(root, "dist", `mahi-tahi-helper-${browser}-${version}.zip`));
    }
    console.log(`Built ${browser} ${version}${zip ? " (zipped)" : ""}`);
}
