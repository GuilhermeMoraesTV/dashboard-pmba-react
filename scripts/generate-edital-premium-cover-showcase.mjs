import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

import { createPremiumCoverShowcasePdf } from '../src/pages/EditalVerticalizadoPdf.js';

const asDataUrl = async (path) => {
  const bytes = await readFile(resolve(path));
  return `data:image/png;base64,${bytes.toString('base64')}`;
};

const outputDir = resolve('output/pdf');
await mkdir(outputDir, { recursive: true });

const doc = await createPremiumCoverShowcasePdf({
  edital: { nome: 'Soldado PMAL', cargo: 'Soldado da Policia Militar de Alagoas' },
  logos: {
    edital: await asDataUrl('public/logosEditais/logo-pmal.png'),
    system: await asDataUrl('public/logoModoQAP.png'),
  },
});

const outputPath = resolve(outputDir, 'cinco-novas-capas-premium-soldado-pmal.pdf');
await writeFile(outputPath, Buffer.from(doc.output('arraybuffer')));
console.log(outputPath);
