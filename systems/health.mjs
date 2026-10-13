// Original health/injury rules for the browser simulation.
export function ensureHealthState(pawn) {
  pawn.injuries ||= [];
  pawn.treatedInjuries ||= 0;
  return pawn;
}
export function applyInjury(pawn, damage, tick=0) {
  ensureHealthState(pawn);
  const severity=Math.max(1,Math.min(30,Math.round(Number(damage)||1)));
  const injury={id:`injury-${tick}-${pawn.injuries.length+1}`,severity,bleeding:severity>=7?Math.min(0.12,severity*0.003):0,treated:false,createdAt:tick};
  pawn.injuries.push(injury);
  return injury;
}
export function injuryBurden(pawn) {
  ensureHealthState(pawn);
  return pawn.injuries.filter(i=>!i.treated).reduce((sum,i)=>sum+i.severity,0);
}
export function advanceInjuries(pawn) {
  ensureHealthState(pawn);
  let bleeding=0;
  for(const injury of pawn.injuries) if(!injury.treated) bleeding+=injury.bleeding||0;
  if(bleeding>0 && pawn.health>0) pawn.health=Math.max(0,pawn.health-bleeding);
  return bleeding;
}
export function treatInjuries(pawn) {
  ensureHealthState(pawn);
  const untreated=pawn.injuries.filter(i=>!i.treated);
  if(!untreated.length) return {ok:false,error:"Bu kolonistin tedavi edilecek yarası yok."};
  for(const injury of untreated){injury.treated=true;injury.bleeding=0;}
  pawn.treatedInjuries=(pawn.treatedInjuries||0)+untreated.length;
  pawn.health=Math.min(100,pawn.health+Math.min(35,untreated.reduce((sum,i)=>sum+Math.ceil(i.severity*.6),0)));
  return {ok:true,count:untreated.length};
}
