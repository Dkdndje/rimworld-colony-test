// Shared survival need primitives for testing and future systems.
export const clampNeed = value => Math.max(0,Math.min(100,value));
export function applyNeedDelta(pawn,{hunger=0,rest=0,mood=0}={}) {
  pawn.hunger=clampNeed((pawn.hunger||0)+hunger); pawn.rest=clampNeed((pawn.rest||0)+rest); pawn.mood=clampNeed((pawn.mood||0)+mood); return pawn;
}
export function survivalState(pawn) {
  if(pawn.health<=0) return "dead"; if(pawn.hunger>=95) return "starving"; if(pawn.rest<=10) return "exhausted"; if(pawn.mood<=15) return "breaking"; return "stable";
}
