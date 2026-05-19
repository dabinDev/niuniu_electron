import { mkdir, readFile, writeFile } from "node:fs/promises";

const entries = [
  { file: "build/icon-16.png", type: "icp4" },
  { file: "build/icon-32.png", type: "icp5" },
  { file: "build/icon-128.png", type: "ic07" },
  { file: "build/icon-256.png", type: "ic08" },
  { file: "build/icon-256.png", type: "ic13" }
];

const chunks = [];
let totalLength = 8;
for (const entry of entries) {
  const data = await readFile(entry.file);
  const chunk = Buffer.alloc(8 + data.length);
  chunk.write(entry.type, 0, "ascii");
  chunk.writeUInt32BE(chunk.length, 4);
  data.copy(chunk, 8);
  chunks.push(chunk);
  totalLength += chunk.length;
}

const header = Buffer.alloc(8);
header.write("icns", 0, "ascii");
header.writeUInt32BE(totalLength, 4);
await mkdir("build", { recursive: true });
const iconBuffer = Buffer.concat([header, ...chunks], totalLength);
await writeFile("build/icon.icns", iconBuffer);

console.log(`Generated build/icon.icns (${iconBuffer.length} bytes)`);
