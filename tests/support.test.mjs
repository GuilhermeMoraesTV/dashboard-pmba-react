import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { createHash } from 'node:crypto';
import { supportMemoryDb } from './fixtures/supportMemoryDb.mjs';
import { createSupportAttempt, createPrivateImageCache, validateSupportFiles, shouldSendOnEnter, attachmentsExpired, SUPPORT_LIMITS, createTypingTransitions } from '../src/services/support/supportCore.js';
const require=createRequire(import.meta.url);
const { createSupportService, manifest }=require('../functions/support/service');
const { normalizeSupportImage }=require('../functions/security/imageUpload');
const sharp=require('../functions/node_modules/sharp');
const { Timestamp }=require('firebase-admin/firestore');
const owner={uid:'support-owner'}, admin={uid:'support-admin'}, third={uid:'stranger'};
const png=await sharp({create:{width:1200,height:800,channels:3,background:'#fafafa'}}).png().toBuffer();
const file=(i=0,buffer=png) => ({id:`a${i}`,size:buffer.length,contentType:'image/png',sha256:createHash('sha256').update(buffer).digest('hex')});
function fixture() {
  const memory=supportMemoryDb(); let clock=Date.now(), counter=0, processing=0;
  memory.docs.set('users/support-admin',{access:{adminRole:'admin'}});
  const svc=createSupportService({...memory,now:() => clock,normalize:async (data) => { processing++; return normalizeSupportImage(data); }});
  const request=(extra={}) => ({operationId:`${clock}_${++counter}`,text:'  A  B\n\nC\n',type:'bug',...extra});
  return {...memory,svc,request,advance:(ms) => {clock+=ms;},processing:() => processing,clock:() => clock};
}
async function send(f,count=0,auth=owner,extra={}) {
  const data=f.request(extra); const files=Array.from({length:count},(_,i) => file(i));
  if (count) { await f.svc.reserve(auth,{...data,files}); for (const image of files) await f.svc.upload(auth,{...data,attachmentId:image.id,base64:png.toString('base64')}); }
  const result=await f.svc.finalize(auth,{...data,withAttachments:!!count}); return {...result,data};
}
test('support 0/1/3 images: bounded measured reads/writes, exactly two versions, retries never process twice',async () => {
  for (const n of [0,1,3]) {
    const f=fixture(); const result=await send(f,n);
    const expected={0:[3,2],1:[13,7],3:[21,11]}[n];
    assert.deepEqual([f.stats.reads,f.stats.writes],expected);
    assert.equal(f.processing(),n); assert.equal(f.files.size,n*2);
    assert.equal(f.docs.get(`system_feedback/${result.ticketId}/messages/${result.messageId}`).text,result.data.text);
    assert.equal([...f.docs.keys()].filter((key) => key.startsWith('support_quotas/')).length,n?1:0);
    const before={...f.stats}, processBefore=f.processing();
    await f.svc.finalize(owner,{...result.data,withAttachments:!!n});
    assert.equal(f.stats.writes,before.writes); assert.equal(f.stats.reads-before.reads,3); assert.equal(f.processing(),processBefore);
  }
});
test('support concurrent reservation and uploads charge once, bind immutable content and refuse premature commit',async () => {
  const f=fixture(),data=f.request(),files=[file(0),file(1)];
  const [a,b]=await Promise.all([f.svc.reserve(owner,{...data,files}),f.svc.reserve(owner,{...data,files})]); assert.equal(a.key,b.key);
  assert.equal(f.docs.get('support_quotas/support-owner').images,2);
  await assert.rejects(f.svc.finalize(owner,{...data,withAttachments:true}),{code:'failed-precondition'});
  await assert.rejects(f.svc.reserve(owner,{...data,text:'changed',files}),{code:'failed-precondition'});
  const upload={...data,attachmentId:'a0',base64:png.toString('base64')};
  const results=await Promise.allSettled([f.svc.upload(owner,upload),f.svc.upload(owner,upload)]);
  assert.equal(results.filter((r) => r.status === 'fulfilled').length,1); assert.equal(f.processing(),1);
  await f.svc.upload(owner,upload); assert.equal(f.processing(),1);
  await assert.rejects(f.svc.upload(third,upload));
  await assert.rejects(f.svc.upload(owner,{...upload,attachmentId:'other'}),{code:'invalid-argument'});
});
test('support owner/admin text, image-only reply, edit preserving attachments, resolved/deleted race and authorization',async () => {
  const f=fixture(),ticket=await send(f,1);
  const response=await send(f,1,admin,{ticketId:ticket.ticketId,text:''});
  const ref=`system_feedback/${ticket.ticketId}/messages/${response.messageId}`;
  const attachment=f.docs.get(ref).attachments[0];
  assert.equal(f.docs.get(ref).sender,'admin');
  await f.svc.manage(admin,{action:'edit',ticketId:ticket.ticketId,messageId:response.messageId,text:'  edited\n\n  spaces  '});
  assert.deepEqual(f.docs.get(ref).attachments,[attachment]);
  const read={ticketId:ticket.ticketId,messageId:response.messageId,attachmentId:'a0',variant:'thumbnail'};
  assert.ok((await f.svc.read(owner,read)).length); assert.ok((await f.svc.read(admin,read)).length);
  await assert.rejects(f.svc.read(third,read),{code:'permission-denied'}); await assert.rejects(f.svc.read(null,read),{code:'unauthenticated'});
  await assert.rejects(f.svc.read(owner,{...read,messageId:ticket.messageId,attachmentId:'foreign'}),{code:'not-found'});
  const pending=f.request({ticketId:ticket.ticketId,text:'pending'}); await f.svc.reserve(owner,{...pending,files:[file()]});
  await f.svc.upload(owner,{...pending,attachmentId:'a0',base64:png.toString('base64')});
  await f.svc.manage(admin,{action:'status',ticketId:ticket.ticketId,status:'resolvido'});
  await assert.rejects(f.svc.finalize(owner,{...pending,withAttachments:true}),{code:'failed-precondition'});
  await assert.rejects(send(f,0,admin,{ticketId:ticket.ticketId}),{code:'failed-precondition'});
  await f.svc.manage(admin,{action:'deleteMessage',ticketId:ticket.ticketId,messageId:response.messageId});
  await assert.rejects(f.svc.read(owner,read),{code:'not-found'});
  await f.svc.manage(admin,{action:'deleteTicket',ticketId:ticket.ticketId});
  await assert.rejects(f.svc.finalize(owner,{...pending,withAttachments:true}),{code:'not-found'});
  await f.svc.manage(admin,{action:'deleteTicket',ticketId:ticket.ticketId});
});
test('support expiry/reopen never resurrects expired images; maintenance is repeatable and preserves text',async () => {
  const f=fixture(),ticket=await send(f,1),read={ticketId:ticket.ticketId,messageId:ticket.messageId,attachmentId:'a0',variant:'image'};
  await f.svc.manage(admin,{action:'status',ticketId:ticket.ticketId,status:'resolvido'}); f.advance(86400000);
  await f.svc.manage(admin,{action:'status',ticketId:ticket.ticketId,status:'pendente'}); assert.ok(await f.svc.read(owner,read));
  await f.svc.manage(admin,{action:'status',ticketId:ticket.ticketId,status:'resolvido'}); f.advance(SUPPORT_LIMITS.retentionMs+1);
  await assert.rejects(f.svc.read(owner,read),{code:'not-found'});
  await f.svc.manage(admin,{action:'status',ticketId:ticket.ticketId,status:'pendente'});
  await assert.rejects(f.svc.read(owner,read),{code:'not-found'});
  const one=await f.svc.maintenance(); assert.ok(Object.values(one).every((n) => typeof n === 'number'),JSON.stringify(one));
  await f.svc.maintenance(); assert.equal(f.files.size,0);
  assert.equal(f.docs.get(`system_feedback/${ticket.ticketId}/messages/${ticket.messageId}`).text,ticket.data.text);
  assert.equal([...f.docs.keys()].filter((key) => /^support_(operations|quotas)\//.test(key)).length,0);
  const next=await send(f,1,owner,{ticketId:ticket.ticketId}); assert.ok(await f.svc.read(owner,{...read,messageId:next.messageId}));
});
test('support partial and orphan cleanup uses deterministic paths and drops auxiliary records after 24h',async () => {
  const f=fixture(),data=f.request(); await f.svc.reserve(owner,{...data,files:[file()]});
  await f.svc.upload(owner,{...data,attachmentId:'a0',base64:png.toString('base64')});
  f.advance(SUPPORT_LIMITS.operationTtlMs+1); await f.svc.maintenance(); await f.svc.maintenance();
  assert.equal(f.files.size,0); assert.equal([...f.docs.keys()].filter((p) => p.startsWith('support_operations')).length,0);
  await assert.rejects(f.svc.finalize(owner,{...data,withAttachments:true}),{code:'failed-precondition'});
});
test('support image restrictions: dimensions, format spoof, corruption, animation and orientation metadata',async () => {
  const output=await normalizeSupportImage({base64:png.toString('base64'),contentType:'image/png'});
  assert.equal(output.image.info.width,1200); assert.equal(output.thumbnail.info.width,480);
  const metadata=await sharp(output.image.data).metadata(); assert.equal(metadata.format,'webp'); assert.equal(metadata.exif,undefined);
  for (const [buffer,type] of [[png,'image/jpeg'],[Buffer.from('<svg/>'),'image/png'],[png.subarray(0,50),'image/png'],[Buffer.from('GIF89a'),'image/gif']]) {
    await assert.rejects(normalizeSupportImage({base64:buffer.toString('base64'),contentType:type}),{code:'invalid-argument'});
  }
  const animated=await sharp({create:{width:8,height:16,channels:3,background:'#fff'}}).raw().toBuffer();
  animated.fill(0,animated.length/2);
  const animatedWebp=await sharp(animated,{raw:{width:8,height:16,channels:3,pageHeight:8}}).webp({loop:0,delay:[100,100]}).toBuffer();
  await assert.rejects(normalizeSupportImage({base64:animatedWebp.toString('base64'),contentType:'image/webp'}),{code:'invalid-argument'});
  const large=await sharp({create:{width:5001,height:5000,channels:3,background:'#fff'}}).png().toBuffer();
  await assert.rejects(normalizeSupportImage({base64:large.toString('base64'),contentType:'image/png'}),{code:'invalid-argument'});
  assert.throws(() => manifest([file(),file(1),file(2),file(3)])); assert.throws(() => manifest([{...file(),size:5*1024*1024+1}]));
});
test('support quotas are per sender: 3 starts/minute, 30 user and 200 admin/day; duplicate reservation is free',async () => {
  const f=fixture();
  for (let i=0;i<3;i++) await f.svc.reserve(owner,{...f.request(),files:[file()]});
  await assert.rejects(f.svc.reserve(owner,{...f.request(),files:[file()]}),{code:'resource-exhausted'});
  for (const [auth,maximum] of [[owner,30],[admin,200]]) {
    const day=new Date(f.clock()).toISOString().slice(0,10); f.docs.set(`support_quotas/${auth.uid}`,{day,images:maximum-1,starts:[]});
    const data={...f.request(),files:[file()]}; await f.svc.reserve(auth,data); await f.svc.reserve(auth,data);
    assert.equal(f.docs.get(`support_quotas/${auth.uid}`).images,maximum);
    await assert.rejects(f.svc.reserve(auth,{...f.request(),files:[file()]}),{code:'resource-exhausted'});
  }
});
test('support client retry resumes only pending uploads and guards simultaneous submits',async () => {
  let reserve=0,finalize=0,uploads=[],fail=true;
  const attempt=createSupportAttempt({clock:() => 123,uuid:() => 'uuid',prepare:async () => [{...file(0),base64:'x'},{...file(1),base64:'y'}],
    reserve:async () => {reserve++;return {};},upload:async (data) => {uploads.push(data.attachmentId); if(data.attachmentId === 'a1' && fail) {fail=false;throw new Error('offline');}},finalize:async () => {finalize++;return {};}});
  const draft={text:'test',files:[{type:'image/png',size:10},{type:'image/png',size:10}]};
  const first=attempt.send(draft),second=attempt.send(draft); assert.equal(first,second); await assert.rejects(first);
  await attempt.send(draft); assert.equal(reserve,1); assert.equal(finalize,1); assert.deepEqual(uploads,['a0','a1','a1']);
});
test('support private cache shares in-flight blobs, never persists and revokes on close or expiry',async () => {
  let downloads=0,revoked=0,created=0;
  const cache=createPrivateImageCache(async () => {downloads++;return new Blob(['x']);},{createObjectURL:() => `blob:${++created}`,revokeObjectURL:() => revoked++});
  assert.equal(await cache.get('m/a/thumb',{}),await cache.get('m/a/thumb',{})); assert.equal(downloads,1);
  await cache.get('m/a/image',{}); assert.equal(downloads,2); cache.invalidate('m/'); assert.equal(revoked,2);
  cache.dispose(); await assert.rejects(cache.get('m/a/image',{})); assert.equal(downloads,2);
  assert.equal(attachmentsExpired({attachmentsExpireAt:Timestamp.fromMillis(10)},{},11),true);
});
test('support client validates before transmission and desktop/mobile Enter preserves intended whitespace',() => {
  assert.throws(() => validateSupportFiles([{type:'image/gif',size:100}]));
  assert.throws(() => validateSupportFiles([{type:'image/png',size:5*1024*1024+1}]));
  assert.doesNotThrow(() => validateSupportFiles([{type:'image/png',size:5*1024*1024}]));
  assert.equal(shouldSendOnEnter({key:'Enter'},false),true); assert.equal(shouldSendOnEnter({key:'Enter',shiftKey:true},false),false);
  assert.equal(shouldSendOnEnter({key:'Enter'},true),false); assert.equal(shouldSendOnEnter({key:'Enter',isComposing:true},false),false);
});
test('support typing writes are ordered state transitions, not writes per key',async () => {
  const writes=[]; let release;
  const transition=createTypingTransitions(async (next) => { writes.push(next); if(next) await new Promise((resolve) => {release=resolve;}); });
  const first=transition(true); transition(true); transition(true); const last=transition(false);
  await Promise.resolve();await Promise.resolve();assert.deepEqual(writes,[true]);release();await first;await last;
  assert.deepEqual(writes,[true,false]);
});
