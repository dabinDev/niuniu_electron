import { mkdir, readFile, writeFile } from "node:fs/promises";
import { PNG } from "pngjs";

const buildDir = new URL("../build/", import.meta.url);
const sourceIcon = new URL("../src/assets/brand/niuniu-client-icon.png", import.meta.url);
const sizes = [16, 24, 32, 48, 64, 128, 256];

function resizeNearest(source, size) {
  const output = new PNG({ width: size, height: size });
  const sourceSide = Math.min(source.width, source.height);
  const sourceX = Math.floor((source.width - sourceSide) / 2);
  const sourceY = Math.floor((source.height - sourceSide) / 2);

  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const srcX = sourceX + Math.min(sourceSide - 1, Math.floor((x / size) * sourceSide));
      const srcY = sourceY + Math.min(sourceSide - 1, Math.floor((y / size) * sourceSide));
      const sourceOffset = (srcY * source.width + srcX) * 4;
      const outputOffset = (y * size + x) * 4;
      source.data.copy(output.data, outputOffset, sourceOffset, sourceOffset + 4);
    }
  }
  return PNG.sync.write(output);
}

await mkdir(buildDir, { recursive: true });
const source = PNG.sync.read(await readFile(sourceIcon));
for (const size of sizes) {
  await writeFile(new URL(`icon-${size}.png`, buildDir), resizeNearest(source, size));
}
await writeFile(new URL("icon.png", buildDir), await readFile(new URL("icon-256.png", buildDir)));

console.log(`Generated NiuNiu icon PNG assets from ${sourceIcon.pathname} in ${buildDir.pathname}`);
