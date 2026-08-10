import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

import {
  createTacticalFontShowcasePdf,
  PDF_TACTICAL_FONT_DESIGNS,
} from '../src/pages/EditalVerticalizadoPdf.js';

const asDataUrl = async (path) => {
  const bytes = await readFile(resolve(path));
  return `data:image/png;base64,${bytes.toString('base64')}`;
};

const fontSources = {};
for (const font of PDF_TACTICAL_FONT_DESIGNS) {
  const bytes = await readFile(resolve('public/fonts/tactical', font.fileName));
  fontSources[font.id] = { base64: bytes.toString('base64') };
}

const outputDir = resolve('output/pdf');
await mkdir(outputDir, { recursive: true });
const doc = await createTacticalFontShowcasePdf({
  edital: { nome: 'Soldado PMMG', cargo: 'Soldado' },
  logos: {
    edital: await asDataUrl('public/logosEditais/logo-pmmg.png'),
    system: await asDataUrl('public/logoModoQAP.png'),
  },
  fontSources,
});

const outputPath = resolve(outputDir, 'capas-taticas-cinco-fontes-soldado-pmmg.pdf');
await writeFile(outputPath, Buffer.from(doc.output('arraybuffer')));
console.log(outputPath);
