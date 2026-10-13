// Explicit inventory transfer rules; keeps item counts non-negative and records stockpile contents.
export function transferItems(world, source, destination, item, amount=1) {
  const requested=Math.floor(amount);
  if(!Number.isFinite(requested)||requested<1) return {ok:false,error:"Miktar geçersiz"};
  const from=world.tiles[source?.y]?.[source?.x], to=world.tiles[destination?.y]?.[destination?.x];
  if(!from||!to||to.building!=="stockpile"||to.progress<1) return {ok:false,error:"Kaynak veya tamamlanmış depo geçersiz"};
  if(!acceptsItem(to,item)) return {ok:false,error:"Bu depo eşya türünü kabul etmiyor"};
  from.items ||= []; to.items ||= [];
  const entry=from.items.find(i=>i.type===item&&Number.isFinite(i.amount)&&i.amount>0);
  const available=entry?.amount||0;
  if(available<1) return {ok:false,error:"Kaynakta bu eşya yok"};
  const moved=Math.min(requested,available,freeCapacity(to));
  if(moved<1) return {ok:false,error:"Depoda boş kapasite yok"};
  entry.amount-=moved;
  if(entry.amount===0) from.items=from.items.filter(i=>i!==entry);
  const stored=to.items.find(i=>i.type===item);
  if(stored) stored.amount+=moved; else to.items.push({type:item,amount:moved});
  world.messages?.unshift(`${moved} ${item} depoya taşındı.`);
  return {ok:true,amount:moved,remaining:Math.max(0,requested-moved)};
}
export function countStored(world,item) { return (world.tiles||[]).flat().reduce((sum,t)=>sum+(t.items||[]).filter(i=>i.type===item).reduce((a,i)=>a+i.amount,0),0); }

export const STORAGE_ITEMS=["wood","stone","food","berries","medicine","meals","components"];
export function storedAmount(tile){return (tile?.items||[]).reduce((sum,item)=>sum+Math.max(0,item.amount||0),0);}
export function acceptsItem(tile,item){return !Array.isArray(tile?.storageFilter)||tile.storageFilter.includes(item);}
export function freeCapacity(tile){return Math.max(0,(Number.isFinite(tile?.storageCapacity)?tile.storageCapacity:50)-storedAmount(tile));}
export function setStockpileFilter(world,x,y,filter=null){
 const tile=world.tiles?.[y]?.[x];if(!tile||tile.building!=="stockpile"||tile.progress<1)return {ok:false,error:"Önce tamamlanmış bir depo seç."};
 if(filter!==null&&(!Array.isArray(filter)||filter.some(item=>!STORAGE_ITEMS.includes(item))))return {ok:false,error:"Geçersiz depo filtresi."};
 if(filter!==null&&tile.items.some(entry=>!filter.includes(entry.type)))return {ok:false,error:"Depoda filtreye uymayan eşya var; önce taşı."};
 tile.storageFilter=filter===null?null:[...new Set(filter)];return {ok:true};
}
export function setStockpileCapacity(world,x,y,capacity){
 const tile=world.tiles?.[y]?.[x];if(!tile||tile.building!=="stockpile"||tile.progress<1)return {ok:false,error:"Önce tamamlanmış bir depo seç."};
 if(!Number.isInteger(capacity)||capacity<storedAmount(tile)||capacity<1)return {ok:false,error:"Kapasite mevcut stoktan az olamaz."};
 tile.storageCapacity=capacity;return {ok:true};
}
