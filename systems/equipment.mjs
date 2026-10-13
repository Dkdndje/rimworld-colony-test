// Basic equipment rules for the browser colony simulation.
export const EQUIPMENT_DEFS=Object.freeze({
  wooden_club:Object.freeze({label:"Tahta sopa",slot:"weapon",damage:4,defense:0,coldProtection:0}),
  stone_armor:Object.freeze({label:"Taş zırh",slot:"armor",damage:0,defense:2,coldProtection:0}),
  fiber_cloak:Object.freeze({label:"Lif pelerini",slot:"clothing",damage:0,defense:0,coldProtection:12})
});
export function equipmentDefinition(id){return EQUIPMENT_DEFS[id]||null;}
export function equipmentStats(pawn){
  const stats={damage:0,defense:0,coldProtection:0};
  for(const id of Object.values(pawn?.equipment||{})){const def=equipmentDefinition(id);if(!def)continue;stats.damage+=def.damage;stats.defense+=def.defense;stats.coldProtection+=def.coldProtection;}
  return stats;
}
export function equipItem(world,pawnId,item){
  const def=equipmentDefinition(item);if(!def)return {ok:false,error:"Bilinmeyen ekipman."};
  const pawn=world.pawns.find(p=>p.id===pawnId&&p.health>0);if(!pawn)return {ok:false,error:"Kolonist bulunamadı."};
  if((world.stock[item]||0)<1)return {ok:false,error:"Bu ekipman stokta yok; önce üret."};
  pawn.equipment||={weapon:null,armor:null,clothing:null};
  const old=pawn.equipment[def.slot];if(old===item)return {ok:false,error:"Bu ekipman zaten takılı."};
  world.stock[item]--;if(old)world.stock[old]=(world.stock[old]||0)+1;pawn.equipment[def.slot]=item;
  return {ok:true,slot:def.slot,item,removed:old||null};
}
export function unequipItem(world,pawnId,slot){
  if(!["weapon","armor","clothing"].includes(slot))return {ok:false,error:"Ekipman yuvası geçersiz."};
  const pawn=world.pawns.find(p=>p.id===pawnId);if(!pawn)return {ok:false,error:"Kolonist bulunamadı."};
  pawn.equipment||={weapon:null,armor:null,clothing:null};const old=pawn.equipment[slot];
  if(!old)return {ok:false,error:"Bu yuvada ekipman yok."};
  pawn.equipment[slot]=null;world.stock[old]=(world.stock[old]||0)+1;return {ok:true,item:old};
}
