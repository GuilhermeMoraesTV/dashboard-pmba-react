import fs from 'node:fs/promises';
import {createRequire} from 'node:module';
const require=createRequire(new URL('../functions/package.json',import.meta.url));
const admin=require('firebase-admin'),sharp=require('sharp');
process.env.FIRESTORE_EMULATOR_HOST='127.0.0.1:8085';process.env.FIREBASE_AUTH_EMULATOR_HOST='127.0.0.1:9099';
admin.initializeApp({projectId:'demo-dashboard-pmba-local'});
for (const role of ['user','admin']) {
 const uid=`support-qa-${role}`,email=`support-${role}@example.test`;
 try {await admin.auth().createUser({uid,email,password:'SupportLocalQA123!',displayName:`Suporte QA ${role}`});} catch(e) {if(e.code!=='auth/uid-already-exists') throw e;}
 await admin.firestore().collection('users').doc(uid).set({displayName:`Suporte QA ${role}`,access:role==='admin'?{adminRole:'admin'}:{role:'user'}});
}
await fs.mkdir('output/support',{recursive:true});
const svg=`<svg width="3000" height="1900" xmlns="http://www.w3.org/2000/svg"><rect width="3000" height="1900" fill="#f8fafc"/><rect width="3000" height="160" fill="#dc2626"/><text x="100" y="105" fill="white" font-family="Arial" font-size="56">ModoQAP - Captura de teste do suporte</text><text x="100" y="270" font-family="Arial" font-size="44">Planejamento de estudos</text>${Array.from({length:15},(_,i)=>`<text x="100" y="${380+i*80}" font-family="Arial" font-size="32">${i+1}. Questão de teste: Direito constitucional - revisão dos artigos 5º e 37.</text>`).join('')}<text x="100" y="1770" font-family="Arial" font-size="24">Texto pequeno para validar a legibilidade após otimização WebP (2560 px, qualidade 80).</text></svg>`;
await sharp(Buffer.from(svg)).png().toFile('output/support/captura-qa.png');
console.log('Seed local e captura de teste prontos.');
await admin.app().delete();
