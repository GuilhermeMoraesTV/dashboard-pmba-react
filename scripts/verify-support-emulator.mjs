// Run only with local Firestore/Storage Emulators; never addresses production.
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { createRequire } from 'node:module';
import { createHash } from 'node:crypto';
import { initializeTestEnvironment, assertFails, assertSucceeds } from '@firebase/rules-unit-testing';
import { doc, getDoc, setDoc, getDocs, collection, query, where, orderBy, limit } from 'firebase/firestore';
import { ref, uploadBytes, getBytes } from 'firebase/storage';
const require=createRequire(import.meta.url), admin=createRequire(new URL('../functions/package.json',import.meta.url))('firebase-admin');
const {createSupportService}=require('../functions/support/service');
const sharp=require('../functions/node_modules/sharp');
if (!process.env.FIRESTORE_EMULATOR_HOST || !process.env.FIREBASE_STORAGE_EMULATOR_HOST) throw new Error('Local Emulators required.');
const projectId='demo-support-security';
const [fh,fp]=process.env.FIRESTORE_EMULATOR_HOST.split(':'),[sh,sp]=process.env.FIREBASE_STORAGE_EMULATOR_HOST.split(':');
const env=await initializeTestEnvironment({projectId,firestore:{host:fh,port:Number(fp),rules:await fs.readFile('firestore.rules','utf8')},storage:{host:sh,port:Number(sp),rules:await fs.readFile('storage.rules','utf8')}});
const app=admin.initializeApp({projectId,storageBucket:`${projectId}.appspot.com`},'support-security');
const db=app.firestore(),bucket=app.storage().bucket(); let clock=Date.now(),i=0;
const svc=createSupportService({db,bucket,now:() => clock}),owner={uid:'owner'},staff={uid:'staff'},third={uid:'third'};
const request=(extra={}) => ({operationId:`${clock}_${++i}`,text:'  início  com espaços\n\nsegundo parágrafo\n',type:'bug',...extra});
const checks=[];
try {
  await db.collection('users').doc('staff').set({access:{adminRole:'admin'}});
  const png=await sharp({create:{width:1200,height:800,channels:3,background:'#fff'}}).png().toBuffer();
  const file={id:'a0',size:png.length,contentType:'image/png',sha256:createHash('sha256').update(png).digest('hex')};
  const data=request(),reserved=await svc.reserve(owner,{...data,files:[file]});
  await assert.rejects(svc.finalize(owner,{...data,withAttachments:true}));
  const uploaded=await svc.upload(owner,{...data,attachmentId:'a0',base64:png.toString('base64')});
  await Promise.all([svc.finalize(owner,{...data,withAttachments:true}),svc.finalize(owner,{...data,withAttachments:true})]);
  const t=reserved.ticketId,m=reserved.messageId;
  assert.equal((await db.collection('system_feedback').doc(t).collection('messages').get()).size,1);
  assert.equal((await db.collection('support_quotas').doc('owner').get()).data().images,1);
  const input={ticketId:t,messageId:m,attachmentId:'a0',variant:'image'};
  assert.ok((await svc.read(owner,input)).length);assert.ok((await svc.read(staff,input)).length);
  await assert.rejects(svc.read(third,input),{code:'permission-denied'});await assert.rejects(svc.read(null,input),{code:'unauthenticated'});
  checks.push('Atomic creation, concurrent finalization, owner/admin bytes, third-party and anonymous denial');
  const ownerDb=env.authenticatedContext('owner').firestore(),staffDb=env.authenticatedContext('staff').firestore(),thirdDb=env.authenticatedContext('third').firestore();
  await assertSucceeds(getDoc(doc(ownerDb,'system_feedback',t))); await assertSucceeds(getDoc(doc(staffDb,'system_feedback',t)));
  await assertFails(getDoc(doc(thirdDb,'system_feedback',t)));await assertFails(getDoc(doc(env.unauthenticatedContext().firestore(),'system_feedback',t)));
  for (const client of [ownerDb,staffDb]) {
    await assertFails(setDoc(doc(client,'system_feedback',t,'messages','forged'),{text:'fake',sender:'admin',attachments:[uploaded]}));
    await assertFails(setDoc(doc(client,'support_operations','forged'),{uid:'owner'}));
    await assertFails(getDocs(query(collection(client,'system_feedback',t,'messages'),orderBy('timestamp','desc'))));
    await assertSucceeds(getDocs(query(collection(client,'system_feedback',t,'messages'),orderBy('timestamp','desc'),limit(50))));
  }
  await assertSucceeds(getDocs(query(collection(ownerDb,'system_feedback'),where('uid','==','owner'),orderBy('timestamp','desc'),limit(100))));
  await assertFails(getDocs(query(collection(ownerDb,'system_feedback'),where('uid','==','owner'))));
  for (const context of [env.authenticatedContext('owner'),env.authenticatedContext('staff'),env.authenticatedContext('third'),env.unauthenticatedContext()]) {
    const object=ref(context.storage(),uploaded.image.path);
    await assertFails(uploadBytes(object,png)); await assertFails(getBytes(object));
  }
  checks.push('Firestore and Storage Rules: direct writes denied including admin, private reads only via authenticated endpoint; queries bounded');
  const foreign=await svc.finalize(third,request());
  await assert.rejects(svc.read(owner,{...input,ticketId:foreign.ticketId}),{code:'permission-denied'});
  const response=request({ticketId:t,text:''}); await svc.reserve(staff,{...response,files:[file]}); await svc.upload(staff,{...response,attachmentId:'a0',base64:png.toString('base64')});
  const answer=await svc.finalize(staff,{...response,withAttachments:true});
  await svc.manage(staff,{ticketId:t,action:'edit',messageId:answer.messageId,text:'  edited\n\n   retained '});
  assert.equal((await db.collection('system_feedback').doc(t).collection('messages').doc(answer.messageId).get()).data().attachments.length,1);
  await svc.manage(staff,{ticketId:t,action:'status',status:'resolvido'});
  await assert.rejects(svc.finalize(owner,request({ticketId:t})),{code:'failed-precondition'});
  clock+=86400000; await svc.manage(staff,{ticketId:t,action:'status',status:'pendente'}); assert.ok(await svc.read(owner,input));
  await svc.manage(staff,{ticketId:t,action:'status',status:'resolvido'});clock+=15*86400000+1;
  await assert.rejects(svc.read(owner,input),{code:'not-found'});await svc.manage(staff,{ticketId:t,action:'status',status:'pendente'});
  await assert.rejects(svc.read(owner,input),{code:'not-found'});
  const maintenance=await svc.maintenance();assert.ok(Object.values(maintenance).every((n) => typeof n === 'number'),JSON.stringify(maintenance));await svc.maintenance();
  assert.equal((await bucket.getFiles({prefix:`support_attachments/${t}/`}))[0].length,0);
  assert.equal((await db.collection('system_feedback').doc(t).collection('messages').doc(m).get()).data().text,data.text);
  checks.push('Admin image-only reply, edit preserves metadata, resolve denies sends, reopen before/after expiry, repeated cleanup preserves text');
  await svc.manage(staff,{ticketId:t,action:'deleteTicket'});
  await assertRejectAccess();
  clock+=86400001;await svc.maintenance();await svc.maintenance();
  assert.equal((await db.collection('system_feedback').doc(t).get()).exists,false);
  assert.equal((await db.collection('system_feedback').doc(t).collection('messages').get()).size,0);
  checks.push('Ticket deletion revokes immediately and repeated bounded maintenance removes subcollection');
  async function assertRejectAccess() { await assert.rejects(svc.read(owner,input),{code:'not-found'}); await assertFails(getDocs(query(collection(ownerDb,'system_feedback',t,'messages'),limit(50)))); }
  await fs.mkdir('output/support',{recursive:true});await fs.writeFile('output/support/emulator-results.json',JSON.stringify({projectId,passed:true,checks,maintenance,bytes:{original:png.length,image:uploaded.image.bytes,thumbnail:uploaded.thumbnail.bytes}},null,2));
  console.log(JSON.stringify({passed:true,checks,maintenance},null,2));
} finally { await env.cleanup();await app.delete(); }
