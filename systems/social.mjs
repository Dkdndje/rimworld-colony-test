// Lightweight deterministic personality and relationship rules for the browser simulation.
export const PERSONALITIES=Object.freeze({
  optimist:Object.freeze({label:"İyimser",socialMood:0.15}),
  stoic:Object.freeze({label:"Metanetli",socialMood:0.05}),
  sociable:Object.freeze({label:"Sosyal",socialMood:0.3}),
  loner:Object.freeze({label:"İçe dönük",socialMood:0})
});
const clamp=(n,min,max)=>Math.max(min,Math.min(max,n));
export function personalityLabel(id){return PERSONALITIES[id]?.label||"Dengeli";}
export function updateSocialRelationships(world){
  const alive=(world.pawns||[]).filter(p=>p.health>0);let interactions=0;
  for(let i=0;i<alive.length;i++)for(let j=i+1;j<alive.length;j++){
    const a=alive[i],b=alive[j],distance=Math.abs(a.x-b.x)+Math.abs(a.y-b.y);
    if(distance>2)continue;
    a.relationships||={};b.relationships||={};
    const bothLoner=a.personality==="loner"&&b.personality==="loner";
    const mixedLoner=(a.personality==="loner")!==(b.personality==="loner");
    const delta=bothLoner?0:mixedLoner?-0.5:(a.personality==="sociable"||b.personality==="sociable"?2:1);
    a.relationships[b.id]=clamp((a.relationships[b.id]||0)+delta,-100,100);
    b.relationships[a.id]=clamp((b.relationships[a.id]||0)+delta,-100,100);
    if(PERSONALITIES[a.personality]?.socialMood)a.mood=clamp(a.mood+PERSONALITIES[a.personality].socialMood,0,100);
    if(PERSONALITIES[b.personality]?.socialMood)b.mood=clamp(b.mood+PERSONALITIES[b.personality].socialMood,0,100);
    interactions++;
  }
  return interactions;
}
