import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

import { createPhotoBackgroundCoverPdf } from '../src/pages/EditalVerticalizadoPdf.js';

const asDataUrl = async (path) => {
  const bytes = await readFile(resolve(path));
  return `data:image/png;base64,${bytes.toString('base64')}`;
};

const outputDir = resolve('output/pdf');
await mkdir(outputDir, { recursive: true });

const doc = await createPhotoBackgroundCoverPdf({
  edital: { nome: 'Soldado PMAL', cargo: 'Soldado da Policia Militar de Alagoas' },
  logos: {
    edital: await asDataUrl('public/logosEditais/logo-pmal.png'),
    system: await asDataUrl('public/logoModoQAP.png'),
  },
  coverBackground: {
    dataUrl: await asDataUrl('public/edital-covers/operador-tatico-modoqap.png'),
    width: 1023,
    height: 1537,
    format: 'PNG',
  },
});

const outputPath = resolve(outputDir, 'capa-fotografica-edital-soldado-pmal.pdf');
await writeFile(outputPath, Buffer.from(doc.output('arraybuffer')));
console.log(outputPath);
