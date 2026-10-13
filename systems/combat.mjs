import { applyInjury } from "./health.mjs";
import { equipmentStats } from "./equipment.mjs";
// Original browser-simulation combat and raid subsystem. No proprietary game code/assets.
export function startRaid(world, count = 2) {
  world.raiders ||= [];
  const n = Math.max(1, Math.min(12, Math.floor(count)));
  for (let i = 0; i < n; i++) {
    const edge = i % 4;
    const x = edge === 0 ? 0 : edge === 1 ? world.width - 1 : Math.floor((i + 1) * world.width / (n + 1));
    const y = edge === 2 ? 0 : edge === 3 ? world.height - 1 : Math.floor((i + 1) * world.height / (n + 1));
    world.raiders.push({ id: (world.nextRaiderId ||= 1), name: `Akıncı ${world.nextRaiderId}`, x, y, health: 60, damage: 5, cooldown: 0 });
    world.nextRaiderId++;
  }
  world.messages.unshift(`${n} düşman koloniye baskın yaptı!`);
  return n;
}
function coverBonus(world,pawn){const tile=world.tiles[pawn.y]?.[pawn.x];let bonus=tile&&(tile.kind==="tree"||tile.kind==="rock")?1:0;for(const [dx,dy] of [[1,0],[-1,0],[0,1],[0,-1]]){const t=world.tiles[pawn.y+dy]?.[pawn.x+dx];if(t?.building==="sandbags"&&t.progress>=1)bonus=Math.max(bonus,2);else if(t?.building==="wall"&&t.progress>=1)bonus=Math.max(bonus,1);}return bonus;}
function nextAttackStep(world,raider,target,walkable){const goals=[[1,0],[-1,0],[0,1],[0,-1]].map(([dx,dy])=>({x:target.x+dx,y:target.y+dy})).filter(p=>walkable(world,p.x,p.y,null));if(!goals.length)return null;const goalKeys=new Set(goals.map(p=>p.y+":"+p.x));const start=raider.y+":"+raider.x,queue=[{x:raider.x,y:raider.y}],previous=new Map([[start,null]]);let found=null;for(let head=0;head<queue.length;head++){const cur=queue[head],k=cur.y+":"+cur.x;if(goalKeys.has(k)){found=k;break;}for(const [dx,dy] of [[1,0],[-1,0],[0,1],[0,-1]]){const x=cur.x+dx,y=cur.y+dy,nk=y+":"+x;if(previous.has(nk)||!walkable(world,x,y,null))continue;previous.set(nk,k);queue.push({x,y});}}if(!found)return null;let k=found;while(previous.get(k)!==start&&previous.get(k)!==null)k=previous.get(k);const [y,x]=k.split(":").map(Number);return {x,y};}
export function advanceCombat(world, walkable) {
  if (!world.raiders?.length) return;
  for (const r of [...world.raiders]) {
    if (r.health <= 0) continue;
    r.cooldown = Math.max(0, (r.cooldown || 0) - 1);
    const alive = world.pawns.filter(p => p.health > 0);
    if (!alive.length) break;
    alive.sort((a,b) => Math.abs(a.x-r.x)+Math.abs(a.y-r.y) - (Math.abs(b.x-r.x)+Math.abs(b.y-r.y)));
    const target = alive[0];
    let dist = Math.abs(target.x-r.x)+Math.abs(target.y-r.y);
    if (target.health<=35 && dist<=2) {
      const threats=world.raiders.filter(enemy=>enemy.health>0);
      const currentSafety=Math.min(...threats.map(enemy=>Math.abs(target.x-enemy.x)+Math.abs(target.y-enemy.y)));
      const escape=[[1,0],[-1,0],[0,1],[0,-1]].map(([dx,dy])=>({x:target.x+dx,y:target.y+dy}))
        .filter(pos=>walkable(world,pos.x,pos.y,target.id))
        .filter(pos=>!alive.some(p=>p.id!==target.id&&p.x===pos.x&&p.y===pos.y))
        .filter(pos=>!threats.some(enemy=>enemy.x===pos.x&&enemy.y===pos.y))
        .map(pos=>({...pos,safety:Math.min(...threats.map(enemy=>Math.abs(pos.x-enemy.x)+Math.abs(pos.y-enemy.y)))}))
        .sort((a,b)=>b.safety-a.safety);
      if(escape[0]&&escape[0].safety>currentSafety) {
        const job=world.jobs.find(item=>item.id===target.jobId&&item.state==="active");
        if(job){job.state="queued";job.assignedPawn=null;}
        target.jobId=null;target.path=[];target.x=escape[0].x;target.y=escape[0].y;
        world.messages.unshift(`${target.name} yaralandığı için düşmandan uzaklaştı.`);
        dist=Math.abs(target.x-r.x)+Math.abs(target.y-r.y);
      }
    }
    if (dist <= 1) {
      if (r.cooldown === 0) { const damage=Math.max(1,r.damage-equipmentStats(target).defense-coverBonus(world,target)); target.health = Math.max(0, target.health - damage); applyInjury(target,damage,world.tick); r.cooldown = 3; world.messages.unshift(`${r.name}, ${target.name} adlı koloniste saldırdı.`); }
    } else if (world.tick % 3 === 0) {
      const step=nextAttackStep(world,r,target,walkable);
      if(step){r.x=step.x;r.y=step.y;}
    }
    // Nearby colonists defend themselves; higher plants-independent crafting skill is a temporary combat proxy.
    for (const p of alive) if (Math.abs(p.x-r.x)+Math.abs(p.y-r.y)<=1 && world.tick%2===0) {
      const damage = 2 + Math.floor((p.combatSkill || 0) / 5) + equipmentStats(p).damage; r.health -= damage;
    }
  }
  const dead = world.raiders.filter(r=>r.health<=0);
  world.stats ||= { raidersDefeated: 0 }; world.stats.raidersDefeated = (world.stats.raidersDefeated || 0) + dead.length;
  if (dead.length) world.messages.unshift(`${dead.length} düşman etkisiz hâle getirildi.`);
  world.raiders = world.raiders.filter(r=>r.health>0);
}
