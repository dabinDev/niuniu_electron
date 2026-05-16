import { writeFile } from "node:fs/promises";
import pngToIco from "png-to-ico";

const iconFiles = [16, 24, 32, 48, 64, 128, 256].map((size) => `build/icon-${size}.png`);
const iconBuffer = await pngToIco(iconFiles);
await writeFile("build/icon.ico", iconBuffer);

console.log(`Generated build/icon.ico (${iconBuffer.length} bytes)`);
