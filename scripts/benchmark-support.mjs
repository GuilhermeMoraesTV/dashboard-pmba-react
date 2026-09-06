// Offline cost instrumentation. No network, remote writes or browser upload.
import fs from 'node:fs/promises';
import { createHash } from 'node:crypto';
import {createRequire} from 'node:module';
import {supportMemoryDb} from '../tests/fixtures/supportMemoryDb.mjs';
const require=createRequire(import.meta.url),{createSupportService}=require('../functions/support/service'),{normalizeSupportImage}=require('../functions/security/imageUpload');
const png=await fs.readFile('output/support/captura-qa.png'), results=[];
const normalized=await normalizeSupportImage({base64:png.toString('base64'),contentType:'image/png'});
await fs.writeFile('output/support/captura-otimizada.webp',normalized.image.data);await fs.writeFile('output/support/captura-miniatura.webp',normalized.thumbnail.data);
for(const count of [0,1,3]) for (const history of [0,1000]) {
  const f=supportMemoryDb(),clock=Date.now();let processing=0;
  const service=createSupportService({...f,now:()=>clock,normalize:async(data)=>{processing++;return normalizeSupportImage(data);}}),auth={uid:'bench'};
  // Unrelated historical documents must not affect the common send path.
  for(let j=0;j<history;j++)f.docs.set(`system_feedback/history/messages/m${j}`,{text:'historical'});
  const data={operationId:`${clock}_benchmark`,text:'Captura QA',type:'bug'};
  const files=Array.from({length:count},(_,index)=>({id:`a${index}`,size:png.length,contentType:'image/png',sha256:createHash('sha256').update(png).digest('hex')}));
  if(count){await service.reserve(auth,{...data,files});for(const file of files)await service.upload(auth,{...data,attachmentId:file.id,base64:png.toString('base64')});}
  await service.finalize(auth,{...data,withAttachments:!!count});
  const before={...f.stats};await service.finalize(auth,{...data,withAttachments:!!count});
  results.push({images:count,history,firestore:before,functions:count?count+2:1,processing,storage:{...f.storage,storedBytes:[...f.files.values()].reduce((sum,file)=>sum+file.data.length,0)},retry:{reads:f.stats.reads-before.reads,writes:f.stats.writes-before.writes},inputBase64Bytes:Math.ceil(png.length/3)*4*count,visibleThumbnailBytes:normalized.thumbnail.data.length*count,openedImageBytes:normalized.image.data.length*count});
}
const report={measuredAt:new Date().toISOString(),method:'Instrumented production service, offline in-memory Firestore/Storage; not a cloud billing export.',fixture:{originalBytes:png.length,imageBytes:normalized.image.data.length,thumbnailBytes:normalized.thumbnail.data.length,imageDimensions:[normalized.image.info.width,normalized.image.info.height],thumbnailDimensions:[normalized.thumbnail.info.width,normalized.thumbnail.info.height]},results};
await fs.writeFile('output/support/cost-report.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));
