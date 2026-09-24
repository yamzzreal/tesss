// EMVCo/QRIS-style TLV helpers. This converts a static QR payload into a
// nominal/dynamic payload by changing Point of Initiation Method (01) and
// inserting Amount (54), then recalculating CRC (63).
// IMPORTANT: QRIS acceptance depends on the merchant/acquirer rules. A generic
// EMV payload transformation is not a guarantee that every acquirer accepts it.
export type TLV={tag:string,value:string};
export function parseTLV(s:string):TLV[]{const out:TLV[]=[];let i=0;while(i<s.length){if(i+4>s.length)throw new Error('Payload QRIS tidak valid: TLV terpotong');const tag=s.slice(i,i+2);const len=Number(s.slice(i+2,i+4));if(!Number.isInteger(len)||i+4+len>s.length)throw new Error('Payload QRIS tidak valid: panjang field');out.push({tag,value:s.slice(i+4,i+4+len)});i+=4+len}return out}
export function buildTLV(items:TLV[]){return items.map(x=>`${x.tag}${String(x.value.length).padStart(2,'0')}${x.value}`).join('')}
export function crc16ccitt(input:string){let crc=0xffff;for(let i=0;i<input.length;i++){crc^=input.charCodeAt(i)<<8;for(let j=0;j<8;j++)crc=(crc&0x8000)?((crc<<1)^0x1021)&0xffff:(crc<<1)&0xffff}return crc.toString(16).toUpperCase().padStart(4,'0')}
export function normalizePayload(raw:string){return raw.trim().replace(/^\\s+|\\s+$/g,'')}
export function staticToNominal(raw:string,nominal:number){
 const payload=normalizePayload(raw);const items=parseTLV(payload);const withoutCrc=items.filter(x=>x.tag!=='63');
 let hasPim=false, hasAmount=false;
 const result:TLV[]=[];
 for(const x of withoutCrc){
  if(x.tag==='01'){result.push({tag:'01',value:'12'});hasPim=true}
  else if(x.tag==='54'){result.push({tag:'54',value:String(nominal)});hasAmount=true}
  else result.push(x)
 }
 if(!hasPim) throw new Error('QRIS tidak memiliki Point of Initiation Method (tag 01)');
 if(!hasAmount){const idx=result.findIndex(x=>x.tag==='53');result.splice(idx>=0?idx+1:result.length,0,{tag:'54',value:String(nominal)})}
 const body=buildTLV(result)+'6304';return body+crc16ccitt(body);
}
export function inspectPayload(raw:string){const items=parseTLV(normalizePayload(raw));return {format:items.find(x=>x.tag==='00')?.value||null,pointOfInitiation:items.find(x=>x.tag==='01')?.value||null,currency:items.find(x=>x.tag==='53')?.value||null,amount:items.find(x=>x.tag==='54')?.value||null,merchantName:items.find(x=>x.tag==='59')?.value||null,merchantCity:items.find(x=>x.tag==='60')?.value||null,hasCRC:items.some(x=>x.tag==='63')};}
