import { ensureHealthState, advanceInjuries, treatInjuries } from "./systems/health.mjs";
import { acceptsItem, freeCapacity } from "./systems/storage.mjs";
import { startRaid as createRaid, advanceCombat } from "./systems/combat.mjs";
import { updateRoomTemperatures } from "./systems/rooms.mjs";
import { updateWeather } from "./systems/weather.mjs";
import { skillForWork, workSpeedMultiplier, awardSkillExperience } from "./systems/skills.mjs";
import { hasResearch, researchAvailability, researchCost } from "./systems/research.mjs";
import { spawnWildlife, animalAt, huntingReward, updateWildlife, wildlifeDefinitions } from "./systems/animals.mjs";
import { updatePowerGrid } from "./systems/power.mjs";
import { updateTrader, tradeWithTrader } from "./systems/trade.mjs";
import { recipeDefinition } from "./systems/recipes.mjs";
import { buildingDefinition } from "./systems/buildings.mjs";
import { equipmentStats } from "./systems/equipment.mjs";
import { updateSocialRelationships } from "./systems/social.mjs";
import { initializeWorldEvents, advanceWorldEvents } from "./systems/world-events.mjs";
// Frontier Colony deterministic simulation core (original web implementation).
// Rendering/UI are intentionally kept separate from simulation rules.
export const TILE = Object.freeze({ GRASS: "grass", WATER: "water", TREE: "tree", ROCK: "rock", BERRIES: "berries" });
export const JOB = Object.freeze({ IDLE: "idle", MOVE: "move", HARVEST: "harvest", BUILD: "build", HAUL: "haul", REST: "rest", CRAFT: "craft", RESEARCH: "research" });
const DIRECTIONS = [[1,0],[-1,0],[0,1],[0,-1]];
const clamp = (n, lo, hi) => Math.max(lo, Math.min(hi, n));
const key = (x,y) => y + ":" + x;

export function makeRng(seed = 20261012) {
  let state = (seed >>> 0) || 1;
  return () => { state = (Math.imul(state, 1664525) + 1013904223) >>> 0; return state / 4294967296; };
}
export function createWorld({ width = 32, height = 22, seed = 20261012, colonists = 3 } = {}) {
  const random = makeRng(seed);
  const tiles = Array.from({length: height}, (_, y) => Array.from({length: width}, (_, x) => {
    const r = random();
    const kind = r < .055 ? TILE.WATER : r < .19 ? TILE.TREE : r < .25 ? TILE.ROCK : r < .31 ? TILE.BERRIES : TILE.GRASS;
    return { x, y, kind, building: null, progress: 0, temperature: 21, roofed: false, items: [], crop: null };
  }));
  const pawns = Array.from({length: colonists}, (_, i) => ({
    id: i + 1, name: ["Ada", "Deniz", "Mira", "Atlas", "Ekin"][i % 5], injuries: [], treatedInjuries: 0,
    x: Math.floor(width/2) + i, y: Math.floor(height/2), health: 100,
    hunger: 15 + i*4, rest: 85 - i*3, mood: 80, jobId: null, path: [],
    work: 0, inventory: {}, equipment: { weapon: null, armor: null, clothing: null },
    personality: ["optimist","stoic","sociable","loner"][Math.floor(random()*4)], relationships: {},
    skills: { construction: Math.floor(random()*8), plants: Math.floor(random()*8), mining: Math.floor(random()*8), crafting: Math.floor(random()*8), intellectual: Math.floor(random()*8) },
    skillXp: { construction: 0, plants: 0, mining: 0, crafting: 0, intellectual: 0 },
    priorities: { rest: 1, haul: 2, harvest: 3, build: 4, craft: 5, research: 6 }
  }));
  for (const p of pawns) tiles[p.y][p.x].kind = TILE.GRASS;
  const world = {
    version: 1, width, height, seed, tick: 0, day: 1, minute: 480,
    tiles, pawns, jobs: [], nextJobId: 1, stock: { food: 24, wood: 12, stone: 8, meals: 0, silver: 30 },
    research: { points: 0, unlocked: ["basic_shelter"], projects: { agriculture: 0, medicine: 0, electricity: 0 } },
    power: { stored: 0, generated: 0, consumed: 0, poweredLamps: 0 }, trader: null, weather: { type: "clear", outsideTemperature: 21 }, raiders: [], nextRaiderId: 1, animals: [], nextAnimalId: 1, rooms: [], stats: { raidersDefeated: 0 }, messages: ["Koloni kuruldu."], rngState: (seed >>> 0) || 1
  };
  const wildlifeRng = makeRng(seed ^ 0xA11A1); world.rng = wildlifeRng; spawnWildlife(world, Math.min(5, Math.floor(width*height/30))); delete world.rng;
  initializeWorldEvents(world);
  return world;
}
export function startRaid(w, count = 2) { return createRaid(w, count); }
export { tradeWithTrader };
export function inBounds(w, x, y) { return x >= 0 && y >= 0 && x < w.width && y < w.height; }
export function tileAt(w, x, y) { return inBounds(w,x,y) ? w.tiles[y][x] : null; }
export function isWalkable(w, x, y, ignorePawn = null) {
  const t = tileAt(w,x,y);
  if (!t || t.kind === TILE.WATER || (t.building === "wall" && t.progress >= 1)) return false;
  return !w.pawns.some(p => p.id !== ignorePawn && p.x === x && p.y === y && p.health > 0);
}
export function findPath(w, start, goal, pawnId = null) {
  if (!inBounds(w, goal.x, goal.y)) return [];
  const queue = [{x:start.x,y:start.y}], previous = new Map([[key(start.x,start.y), null]]);
  for (let head=0; head<queue.length; head++) {
    const cur = queue[head];
    if (cur.x === goal.x && cur.y === goal.y) break;
    for (const [dx,dy] of DIRECTIONS) {
      const x=cur.x+dx, y=cur.y+dy, k=key(x,y);
      if (!isWalkable(w,x,y,pawnId) || previous.has(k)) continue;
      previous.set(k,key(cur.x,cur.y)); queue.push({x,y});
    }
  }
  let k=key(goal.x,goal.y);
  if (!previous.has(k)) return [];
  const path=[];
  while (k !== key(start.x,start.y)) {
    const [y,x]=k.split(":").map(Number); path.unshift({x,y}); k=previous.get(k);
    if (k == null) return [];
  }
  return path;
}
export function enqueueJob(w, spec) {
  const job = { id: w.nextJobId++, type: spec.type, target: spec.target ?? null, destination: spec.destination ?? null, item: spec.item ?? null,
    amount: spec.amount ?? 1, targetPawnId: spec.targetPawnId ?? null, priority: clamp(spec.priority ?? 3, 1, 9), state: "queued",
    assignedPawn: null, progress: 0, createdAt: w.tick };
  w.jobs.push(job); return job.id;
}
export function cancelJob(w, jobId) {
  const job=w.jobs.find(j=>j.id===jobId);
  if (!job || !["queued","active"].includes(job.state)) return false;
  if ((job.type==="craft" || job.type==="build") && job.inputsConsumed && job.reservedInputs) {
    for (const [item,amount] of Object.entries(job.reservedInputs)) {
      w.stock[item]=(w.stock[item]||0)+amount;
    }
    job.inputsConsumed=false;
    job.refundedInputs=true;
    if (job.type==="build") {
      const tile=job.target&&tileAt(w,job.target.x,job.target.y);
      if (tile && tile.building===job.item && tile.progress<1) { tile.building=null; tile.progress=0; }
    }
    w.messages.unshift(job.type==="craft" ? "Üretim iptal edildi; malzemeler geri verildi." : "İnşaat iptal edildi; malzemeler geri verildi.");
  }
  job.state="cancelled";
  for (const p of w.pawns) if (p.jobId===jobId) { p.jobId=null; p.path=[]; }
  return true;
}
function queuedJobStillValid(w, job) {
  if (job.type === "treat") {
    const patient=w.pawns.find(p=>p.id===job.targetPawnId && p.health>0);
    return !!patient && (patient.injuries||[]).some(i=>!i.treated) && (w.stock.medicine||0)>0;
  }
  if (job.type === "hunt") return (w.animals||[]).some(a=>a.id===job.targetAnimalId);
  if (job.type === "harvest") {
    const t=job.target && tileAt(w,job.target.x,job.target.y);
    if (!t) return false;
    if (job.item === "crop") return t.building === "farmplot" && t.progress >= 1 && !!t.crop?.ripe;
    return t.kind === job.item && [TILE.TREE,TILE.ROCK,TILE.BERRIES].includes(job.item);
  }
  return true;
}
export function assignJobs(w) {
  for (const job of w.jobs) {
    if (job.state === "queued" && !queuedJobStillValid(w,job)) {
      job.state="failed"; job.assignedPawn=null;
    }
  }
  const queued=w.jobs.filter(j=>j.state==="queued").sort((a,b)=>a.priority-b.priority || a.createdAt-b.createdAt || a.id-b.id);
  for (const job of queued) {
    const candidates=w.pawns.filter(p=>p.health>0 && p.jobId===null).sort((a,b)=>{
      const priorityDelta=(a.priorities[job.type]??9)-(b.priorities[job.type]??9);
      if(priorityDelta!==0)return priorityDelta;
      const skill=skillForWork(job.type,job.item,TILE.ROCK);
      if(skill){const skillDelta=(b.skills?.[skill]||0)-(a.skills?.[skill]||0);if(skillDelta!==0)return skillDelta;}
      let target=job.type==="haul"&&job.haulPhase==="dropoff"?job.destination:job.target;
      if(job.type==="treat"){const patient=w.pawns.find(p=>p.id===job.targetPawnId);target=patient||target;}
      const distance=p=>target&&Number.isFinite(target.x)&&Number.isFinite(target.y)?Math.abs(target.x-p.x)+Math.abs(target.y-p.y):0;
      return distance(a)-distance(b);
    });
    for (const pawn of candidates) {
      // A haul job in dropoff phase already has cargo; reassign it toward storage, never back to source.
      let goal=job.type==="haul" && job.haulPhase==="dropoff" ? job.destination : job.target;
      if ((job.type==="harvest" || job.type==="hunt") && goal) {
        const neighbors=DIRECTIONS.map(([dx,dy])=>({x:goal.x+dx,y:goal.y+dy})).filter(t=>isWalkable(w,t.x,t.y,pawn.id));
        goal=neighbors.sort((a,b)=>Math.abs(a.x-pawn.x)+Math.abs(a.y-pawn.y)-(Math.abs(b.x-pawn.x)+Math.abs(b.y-pawn.y)))[0];
      }
      if (job.type==="treat" && goal) {
        const patient=w.pawns.find(p=>p.id===job.targetPawnId);
        if(!patient || patient.health<=0) continue;
        const neighbors=DIRECTIONS.map(([dx,dy])=>({x:patient.x+dx,y:patient.y+dy})).filter(t=>isWalkable(w,t.x,t.y,pawn.id));
        goal=neighbors.sort((a,b)=>Math.abs(a.x-pawn.x)+Math.abs(a.y-pawn.y)-(Math.abs(b.x-pawn.x)+Math.abs(b.y-pawn.y)))[0];
      }
      if (job.type==="haul" && job.haulPhase!=="dropoff" && goal) {
        const neighbors=DIRECTIONS.map(([dx,dy])=>({x:goal.x+dx,y:goal.y+dy})).filter(t=>isWalkable(w,t.x,t.y,pawn.id));
        goal=neighbors.sort((a,b)=>Math.abs(a.x-pawn.x)+Math.abs(a.y-pawn.y)-(Math.abs(b.x-pawn.x)+Math.abs(b.y-pawn.y)))[0];
      }
      const requiresGoal=["harvest","hunt","build","haul","treat"].includes(job.type);
      if (requiresGoal && !goal) continue;
      if (goal) {
        const path=findPath(w,pawn,goal,pawn.id);
        if (path.length===0 && (pawn.x!==goal.x || pawn.y!==goal.y)) continue;
        pawn.path=path;
      }
      pawn.jobId=job.id; job.assignedPawn=pawn.id; job.state="active"; break;
    }
  }
}
export function startHarvest(w, x, y, priority=3) {
  const t=tileAt(w,x,y);
  const ripeCrop=t?.building==="farmplot" && t.progress>=1 && t.crop?.ripe;
  if (!t || (!ripeCrop && ![TILE.TREE,TILE.ROCK,TILE.BERRIES].includes(t.kind))) return {ok:false,error:"No harvestable resource at target"};
  return {ok:true,jobId:enqueueJob(w,{type:"harvest",target:{x,y},item:ripeCrop?"crop":t.kind,priority})};
}
export function dropItemStack(w, x, y, type, amount=1) {
  const t=tileAt(w,x,y);
  if (!t || typeof type!=="string" || !type.trim() || !Number.isFinite(amount) || amount<=0) return {ok:false,error:"Invalid item stack"};
  const n=Math.floor(amount);
  if (n<1) return {ok:false,error:"Item amount must be at least one"};
  const stack=t.items.find(item=>item.type===type);
  if (stack) stack.amount+=n; else t.items.push({type,amount:n});
  return {ok:true,amount:n};
}
export function startHaul(w, x, y, priority=2) {
  const source=tileAt(w,x,y);
  if (!source || !source.items.some(item=>item.amount>0)) return {ok:false,error:"No items at source tile"};
  const stockpiles=w.tiles.flat().filter(t=>t.building==="stockpile" && t.progress>=1);
  if (!stockpiles.length) return {ok:false,error:"Build a completed stockpile first"};
  const stack=source.items.find(item=>item.amount>0);
  const candidates=stockpiles.filter(t=>acceptsItem(t,stack.type)&&freeCapacity(t)>0).sort((a,b)=>Math.abs(a.x-x)+Math.abs(a.y-y)-Math.abs(b.x-x)-Math.abs(b.y-y));
  const destination=candidates[0];if(!destination)return {ok:false,error:"No stockpile accepts this item or has free capacity"};
  const jobId=enqueueJob(w,{type:"haul",target:{x,y},destination:{x:destination.x,y:destination.y},item:stack.type,amount:Math.min(stack.amount,freeCapacity(destination)),priority});
  return {ok:true,jobId};
}
export function queueAvailableHauls(w) {
  const stockpiles=w.tiles.flat().filter(t=>t.building==="stockpile" && t.progress>=1);
  if (!stockpiles.length) return 0;
  let queued=0;
  const reservedOn=(tile)=>w.jobs.filter(j=>j.type==="haul" && ["queued","active"].includes(j.state) && j.destination?.x===tile.x && j.destination?.y===tile.y).reduce((sum,j)=>sum+Math.max(0,j.amount||0),0);
  for (const row of w.tiles) for (const source of row) {
    if (!source.items.some(item=>item.amount>0) || source.building==="stockpile") continue;
    const seenTypes=new Set();
    for (const stack of source.items) {
      if (!(stack.amount>0) || seenTypes.has(stack.type)) continue;
      seenTypes.add(stack.type);
      const alreadyQueued=w.jobs.some(j=>j.type==="haul" && ["queued","active"].includes(j.state) && j.target?.x===source.x && j.target?.y===source.y && j.item===stack.type);
      if (alreadyQueued) continue;
      const candidates=stockpiles.filter(t=>acceptsItem(t,stack.type)&&freeCapacity(t)-reservedOn(t)>0).sort((a,b)=>Math.abs(a.x-source.x)+Math.abs(a.y-source.y)-Math.abs(b.x-source.x)-Math.abs(b.y-source.y));
      const destination=candidates[0];if(!destination)continue;
      const availableCapacity=Math.max(0,freeCapacity(destination)-reservedOn(destination));
      const amount=Math.min(stack.amount,availableCapacity);
      if(amount<1)continue;
      enqueueJob(w,{type:"haul",target:{x:source.x,y:source.y},destination:{x:destination.x,y:destination.y},item:stack.type,amount,priority:2});
      queued++;
    }
  }
  return queued;
}

export function startHunt(w, x, y, priority=3) {
  const animal=animalAt(w,x,y); if(!animal) return {ok:false,error:"Bu karede avlanacak hayvan yok."};
  const duplicate=(w.jobs||[]).some(j=>j.type==="hunt" && j.target?.x===x && j.target?.y===y && ["queued","active"].includes(j.state));
  if(duplicate) return {ok:false,error:"Bu hayvan için zaten av emri var."};
  const jobId=enqueueJob(w,{type:"hunt",item:animal.kind,target:{x,y},priority}); const job=w.jobs.find(j=>j.id===jobId); if(job) job.targetAnimalId=animal.id; return {ok:true,jobId};
}
export function startBuild(w, x, y, building, priority=4) {
  const t=tileAt(w,x,y);
  if (!t || t.kind!==TILE.GRASS || t.building) return {ok:false,error:"Tile is not buildable"};
  const definition=buildingDefinition(building); const cost=definition?.costs; if (!cost) return {ok:false,error:"Unknown building"};
  if (definition.research && !hasResearch(w, definition.research)) return {ok:false,error:`Bu yapıyı kurmak için ${definition.research} araştırmasını tamamla.`};
  if (building === "farmplot" && !hasResearch(w, "agriculture")) return {ok:false,error:"Tarla kurmak için Tarım araştırmasını tamamla."};
  if (["solar-panel","battery","lamp"].includes(building) && !hasResearch(w, "electricity")) return {ok:false,error:"Elektrikli yapılar için Elektrik araştırmasını tamamla."};
  for (const [item,n] of Object.entries(cost)) if ((w.stock[item]||0)<n) return {ok:false,error:"Not enough "+item};
  for (const [item,n] of Object.entries(cost)) w.stock[item]-=n;
  t.building=building; t.progress=0;
  const jobId=enqueueJob(w,{type:"build",item:building,target:{x,y},amount:definition.work ?? 5,priority});
  const job=w.jobs.find(j=>j.id===jobId);
  job.reservedInputs={...cost};
  job.inputsConsumed=true;
  return {ok:true,jobId};
}
export function startRoof(w, x, y, priority=4) {
  const t=tileAt(w,x,y);
  if(!t || t.kind===TILE.WATER || t.building==="wall") return {ok:false,error:"Roof cannot be built on this tile"};
  if(t.roofed) return {ok:false,error:"Tile is already roofed"};
  const pending=w.jobs.some(j=>j.type==="build" && j.item==="roof" && j.target?.x===x && j.target?.y===y && ["queued","active"].includes(j.state));
  if(pending) return {ok:false,error:"Roof construction already queued"};
  return {ok:true,jobId:enqueueJob(w,{type:"build",item:"roof",target:{x,y},priority})};
}
export function startCraft(w, recipe, priority=5) {
  const r=recipeDefinition(recipe); if (!r) return {ok:false,error:"Unknown recipe"};
  if (r.research && !hasResearch(w, r.research)) return {ok:false,error:`Üretim için ${r.research} araştırmasını tamamla.`};
  const duplicate=w.jobs.some(j=>j.type==="craft" && j.item===recipe && ["queued","active"].includes(j.state));
  if (duplicate) return {ok:false,error:"Bu tarif için üretim zaten sırada."};
  for (const [item,n] of Object.entries(r.inputs)) if ((w.stock[item]||0)<n) return {ok:false,error:"Not enough "+item};
  for (const [item,n] of Object.entries(r.inputs)) w.stock[item]-=n;
  const jobId=enqueueJob(w,{type:"craft",item:recipe,amount:r.work,priority});
  const job=w.jobs.find(j=>j.id===jobId);
  job.reservedInputs={...r.inputs};
  job.inputsConsumed=true;
  return {ok:true,jobId};
}
export function startTreatment(w, pawnId, priority=1) {
  const patient=w.pawns.find(p=>p.id===pawnId && p.health>0);
  if(!patient) return {ok:false,error:"Kolonist bulunamadı."};
  if(!(w.stock.medicine>0)) return {ok:false,error:"Tedavi için ilaç gerekiyor."};
  if(!(patient.injuries||[]).some(i=>!i.treated)) return {ok:false,error:"Tedavi edilecek yara yok."};
  if(w.jobs.some(j=>j.type==="treat" && j.targetPawnId===pawnId && ["queued","active"].includes(j.state))) return {ok:false,error:"Bu kolonist için tedavi zaten planlandı."};
  return {ok:true,jobId:enqueueJob(w,{type:"treat",target:{x:patient.x,y:patient.y},targetPawnId:pawnId,priority})};
}
export function startResearch(w, project, priority=6) {
  const availability=researchAvailability(w,project);
  if (!availability.ok) return {ok:false,error:availability.reason};
  return {ok:true,jobId:enqueueJob(w,{type:"research",item:project,priority})};
}
function releaseJob(w,p,j){if(j){j.state="queued";j.assignedPawn=null;}p.jobId=null;p.path=[];}
function completeJob(w,p,j) {
  const trainedSkill = skillForWork(j.type, j.item, TILE.ROCK);
  if (trainedSkill && awardSkillExperience(p, trainedSkill)) w.messages.unshift(`${p.name} ${trainedSkill} becerisinde ilerledi.`);
  if (j.type==="harvest") {
    const t=tileAt(w,j.target.x,j.target.y);
    if(j.item==="crop") {
      if(!t || t.building!=="farmplot" || !t.crop?.ripe) { j.state="failed"; p.jobId=null; return; }
      w.stock.food+=10; t.crop={growth:0,ripe:false}; j.state="complete"; w.messages.unshift(p.name+" olgun mahsulü topladı (+10 yiyecek).");
    } else {
      if (!t || t.kind!==j.item) { j.state="failed"; p.jobId=null; return; }
      if (t.kind===TILE.TREE) w.stock.wood+=4;
      else if (t.kind===TILE.ROCK) w.stock.stone+=3;
      else if (t.kind===TILE.BERRIES) { w.stock.food+=6; w.stock.berries=(w.stock.berries||0)+3; }
      t.kind=TILE.GRASS; j.state="complete"; w.messages.unshift(p.name+" kaynak topladı.");
    }
  } else if (j.type==="hunt") {
    const index=(w.animals||[]).findIndex(a=>a.id===j.targetAnimalId);
    if(index<0){j.state="failed";p.jobId=null;return;}
    const animal=w.animals[index], meat=huntingReward(animal); w.animals.splice(index,1); w.stock.food=(w.stock.food||0)+meat; w.stock.meat=(w.stock.meat||0)+meat; j.state="complete"; w.messages.unshift(`${p.name}, ${wildlifeDefinitions()[animal.kind]?.label || animal.kind} avladı; ${meat} et elde edildi.`);
  } else if (j.type==="build") {
    const t=tileAt(w,j.target.x,j.target.y); if (t) { if(j.item==="roof") t.roofed=true; else {t.progress=1; if(t.building==="farmplot") t.crop={growth:0,ripe:false};} j.inputsConsumed=false; j.state="complete"; w.messages.unshift(j.item==="roof"?p.name+" çatı inşa etti.":p.name+" inşaatı tamamladı."); }
  } else if (j.type==="treat") {
    const patient=w.pawns.find(p=>p.id===j.targetPawnId);
    if(!patient || patient.health<=0 || !(w.stock.medicine>0)) {j.state="failed";p.jobId=null;return;}
    const result=treatInjuries(patient);
    if(!result.ok){j.state="failed";p.jobId=null;return;}
    w.stock.medicine--; j.state="complete"; w.messages.unshift(`${p.name}, ${patient.name} adlı kolonistin ${result.count} yarasını tedavi etti.`);
  } else if (j.type==="craft") {
    const recipe=recipeDefinition(j.item);
    if (!recipe) { j.state="failed"; p.jobId=null; return; }
    for (const [item,amount] of Object.entries(recipe.outputs)) w.stock[item]=(w.stock[item]||0)+amount;
    j.inputsConsumed=false;
    j.state="complete";
  } else if (j.type==="research") {
    const name=j.item; w.research.projects[name]=Math.min(researchCost(name), (w.research.projects[name]||0)+10);
    if (w.research.projects[name]>=researchCost(name)) { if(!w.research.unlocked.includes(name)) w.research.unlocked.push(name); j.state="complete"; w.messages.unshift("Araştırma tamamlandı: "+name); }
    else { j.state="queued"; j.assignedPawn=null; j.progress=0; }
  } else if (j.type==="haul") {
    if (j.haulPhase!=="dropoff") {
      const source=tileAt(w,j.target.x,j.target.y);
      const index=source?.items.findIndex(item=>item.type===j.item && item.amount>0) ?? -1;
      if (index<0 || !j.destination) { j.state="failed"; p.jobId=null; p.path=[]; return; }
      const stack=source.items[index], amount=Math.min(stack.amount,j.amount||stack.amount);
      stack.amount-=amount; if (stack.amount<=0) source.items.splice(index,1);
      p.inventory[j.item]=(p.inventory[j.item]||0)+amount;
      j.amount=amount; j.haulPhase="dropoff"; j.progress=0;
      const destination=tileAt(w,j.destination.x,j.destination.y);
      if (!destination || destination.building!=="stockpile" || destination.progress<1) {
        source.items.push({type:j.item,amount}); p.inventory[j.item]-=amount; j.state="failed"; p.jobId=null; p.path=[]; return;
      }
      const path=findPath(w,p,destination,p.id);
      if (!path.length && (p.x!==destination.x || p.y!==destination.y)) {
        source.items.push({type:j.item,amount}); p.inventory[j.item]-=amount; j.state="failed"; p.jobId=null; p.path=[]; return;
      }
      p.path=path; p.work=0; return;
    }
    const destination=tileAt(w,j.destination.x,j.destination.y);
    const amount=p.inventory[j.item]||0;
    if (!destination || destination.building!=="stockpile" || destination.progress<1 || amount<=0 || !acceptsItem(destination,j.item) || freeCapacity(destination)<amount) {
      const source=tileAt(w,j.target.x,j.target.y);if(source){const old=source.items.find(item=>item.type===j.item);if(old)old.amount+=amount;else source.items.push({type:j.item,amount});}
      p.inventory[j.item]=0;j.state="failed";p.jobId=null;p.path=[];return;
    }
    destination.items.push({type:j.item,amount});
    w.stock[j.item]=(w.stock[j.item]||0)+amount;
    p.inventory[j.item]=0; j.state="complete";
    w.messages.unshift(`${p.name} ${amount} ${j.item} depoya taşıdı.`);
  } else { j.state="complete"; }
  p.jobId=null; p.path=[]; p.work=0;
}
function recoverDeadPawnJob(w,p) {
  if (p.jobId===null || p.jobId===undefined) return;
  const job=w.jobs.find(j=>j.id===p.jobId);
  if (job && job.state==="active") {
    if (job.type==="haul" && job.haulPhase==="dropoff") {
      const tile=tileAt(w,p.x,p.y);
      for (const [type,amount] of Object.entries(p.inventory||{})) {
        if (!Number.isFinite(amount) || amount<=0) continue;
        if (tile) tile.items.push({type,amount});
      }
      p.inventory={};
      job.state="failed";
      job.assignedPawn=null;
    } else {
      job.state="queued";
      job.assignedPawn=null;
    }
  }
  p.jobId=null;
  p.path=[];
}

function queueEmergencyFood(w) {
  const foodReserve=(w.stock.food||0)+(w.stock.meals||0);
  if(foodReserve>=8) return 0;
  const pending=w.jobs.filter(j=>["queued","active"].includes(j.state) && ((j.type==="harvest" && ["crop",TILE.BERRIES].includes(j.item)) || j.type==="hunt"));
  const targetJobs=Math.min(3,Math.max(1,Math.ceil((8-foodReserve)/6)));
  let added=0;
  const already=new Set(pending.map(j=>`${j.type}:${j.target?.x}:${j.target?.y}`));
  const foodTiles=w.tiles.flat().filter(t=>(t.kind===TILE.BERRIES || (t.building==="farmplot" && t.progress>=1 && t.crop?.ripe)) && !already.has(`harvest:${t.x}:${t.y}`)).sort((a,b)=>Math.abs(a.x-w.width/2)+Math.abs(a.y-w.height/2)-Math.abs(b.x-w.width/2)-Math.abs(b.y-w.height/2));
  for(const t of foodTiles) {
    if(pending.length+added>=targetJobs) break;
    enqueueJob(w,{type:"harvest",target:{x:t.x,y:t.y},item:t.kind===TILE.BERRIES?TILE.BERRIES:"crop",priority:1}); added++;
  }
  if(pending.length+added<targetJobs) {
    const animals=(w.animals||[]).filter(a=>!already.has(`hunt:${a.x}:${a.y}`)).sort((a,b)=>Math.abs(a.x-w.width/2)+Math.abs(a.y-w.height/2)-Math.abs(b.x-w.width/2)-Math.abs(b.y-w.height/2));
    for(const animal of animals) {
      if(pending.length+added>=targetJobs) break;
      const jobId=enqueueJob(w,{type:"hunt",item:animal.kind,target:{x:animal.x,y:animal.y},priority:1});
      const job=w.jobs.find(j=>j.id===jobId); if(job) job.targetAnimalId=animal.id;
      already.add(`hunt:${animal.x}:${animal.y}`); added++;
    }
  }
  return added;
}

function queueEmergencyTreatment(w) {
  if(!(w.stock.medicine>0))return 0;
  let added=0;
  for(const patient of w.pawns) {
    if(patient.health<=0||patient.health>55||!(patient.injuries||[]).some(injury=>!injury.treated))continue;
    const result=startTreatment(w,patient.id,1);
    if(result.ok)added++;
  }
  return added;
}

export function tickWorld(w) {
  w.tick++; w.minute++;
  if (w.minute>=1440) { w.minute=0; w.day++; }
  updateWeather(w, makeRng(w.seed+w.tick));
  updateTrader(w);
  for (const tile of w.tiles.flat()) if(tile.building==="farmplot" && tile.progress>=1 && tile.crop && !tile.crop.ripe) {
    tile.crop.growth=Math.min(1,(tile.crop.growth||0)+0.001);
    if(tile.crop.growth>=1) { tile.crop.ripe=true; w.messages.unshift("Bir tarladaki mahsul olgunlaştı."); }
  }
  updatePowerGrid(w);
  if (w.tick % 5 === 0) updateWildlife(w, makeRng(w.seed ^ Math.imul(w.tick + 1, 0x9e3779b1)));
  for (const p of w.pawns) {
    ensureHealthState(p);
    if (p.health<=0) { recoverDeadPawnJob(w,p); continue; }
    advanceInjuries(p);
    if (p.health<=0) { recoverDeadPawnJob(w,p); if (!p.deadNotified) { p.deadNotified=true; w.messages.unshift(p.name+" hayatını kaybetti."); } continue; }
    p.hunger=clamp(p.hunger+.06,0,100); p.rest=clamp(p.rest-.025,0,100);
    if (p.hunger>80) {
      if ((w.stock.meals||0)>0) { w.stock.meals--; p.hunger=Math.max(0,p.hunger-55); }
      else if (w.stock.food>0) { w.stock.food--; p.hunger=Math.max(0,p.hunger-42); }
    }
    if (p.health<80 && (w.stock.medicine||0)>0 && !(p.injuries||[]).some(i=>!i.treated)) { w.stock.medicine--; p.health=clamp(p.health+25,0,100); w.messages.unshift(p.name+" genel iyileşme için ilaç kullandı."); }
    const nearbyBuilding=(kind,radius)=>w.tiles.some(row=>row.some(t=>t.building===kind&&Math.abs(t.x-p.x)+Math.abs(t.y-p.y)<=radius));
    if (p.hunger>95) p.health=clamp(p.health-.08,0,100);
    const ambient=tileAt(w,p.x,p.y)?.temperature ?? w.weather.outsideTemperature ?? 21;
    const gear=equipmentStats(p);
    const shelteredFromCold=nearbyBuilding("campfire",2)||gear.coldProtection>=12;
    if ((ambient<5 || w.weather.type==="cold") && !shelteredFromCold) p.mood=clamp(p.mood-.04,0,100);
    if (ambient < -8 && !shelteredFromCold && gear.coldProtection<12) p.health=clamp(p.health-.02,0,100);
    if (ambient>38) { p.mood=clamp(p.mood-.04,0,100); p.health=clamp(p.health-.01,0,100); }
    if (p.rest<8) p.mood=clamp(p.mood-.08,0,100);
    else if (p.hunger<65 && p.rest>25) p.mood=clamp(p.mood+.015,0,100);
    if (p.health===0 && !p.deadNotified) { p.deadNotified=true; w.messages.unshift(p.name+" hayatını kaybetti."); }
    if (p.rest<15) { p.rest=clamp(p.rest+(nearbyBuilding("bed",1)?2.4:1.2),0,100); continue; }
    if (p.jobId===null) continue;
    const j=w.jobs.find(x=>x.id===p.jobId);
    if (!j || j.state==="cancelled") { p.jobId=null; continue; }
    if (p.path.length) { const next=p.path[0]; if (isWalkable(w,next.x,next.y,p.id)) { p.x=next.x;p.y=next.y;p.path.shift(); } else { let goal=j.target; if (j.type==="haul" && j.haulPhase==="dropoff") goal=j.destination; const path=goal?findPath(w,p,goal,p.id):[]; if (!path.length && goal) {releaseJob(w,p,j);continue;} p.path=path; } continue; }
    const skill = skillForWork(j.type, j.item, TILE.ROCK);
    const level = skill ? (p.skills?.[skill] || 0) : 0;
    // Skilled colonists complete work faster, but never more than twice as fast.
    j.progress += workSpeedMultiplier(level);
    const needed=j.type==="research"?10:j.type==="build"?(j.item==="roof"?5:(j.amount>1?j.amount:5)):j.type==="craft"?j.amount:4;
    if (j.progress>=needed) completeJob(w,p,j);
  }
  advanceCombat(w, isWalkable);
  advanceWorldEvents(w);
  if (w.tick % 20 === 0) updateRoomTemperatures(w);
  if (w.tick % 30 === 0) updateSocialRelationships(w);
  // Hauling scans the map and stockpiles; run it every five ticks rather than on every simulation tick.
  if (w.tick % 5 === 0) queueAvailableHauls(w);
  queueEmergencyFood(w);
  queueEmergencyTreatment(w);
  assignJobs(w);
  w.messages=w.messages.slice(0,20);
  return w;
}
export function serializeWorld(w) {
  assertValidWorld(w);
  return JSON.stringify(w);
}
function assertValidWorld(w) {
  const fail = () => { throw new Error("Unsupported or invalid save format"); };
  if (!w || typeof w !== "object" || Array.isArray(w) || w.version !== 1) fail();
  if (!Number.isInteger(w.width) || !Number.isInteger(w.height) || w.width < 8 || w.height < 8 || w.width > 256 || w.height > 256) fail();
  if (!Number.isInteger(w.seed) || !Number.isFinite(w.tick) || w.tick < 0 || !Number.isFinite(w.day) || w.day < 1 || !Number.isFinite(w.minute)) fail();
  if (!Array.isArray(w.tiles) || w.tiles.length !== w.height || w.tiles.some(row => !Array.isArray(row) || row.length !== w.width)) fail();
  for (let y=0; y<w.height; y++) for (let x=0; x<w.width; x++) {
    const t=w.tiles[y][x];
    if (!t || typeof t !== "object" || t.x !== x || t.y !== y || !Object.values(TILE).includes(t.kind) || !Array.isArray(t.items)) fail();
    if (t.building !== null && typeof t.building !== "string") fail();
    if (!Number.isFinite(t.progress) || !Number.isFinite(t.temperature)) fail();
    for (const item of t.items) if (!item || typeof item.type !== "string" || !Number.isFinite(item.amount) || item.amount < 0) fail();
  }
  if (!Array.isArray(w.pawns) || w.pawns.length < 1 || w.pawns.length > 100 || !Array.isArray(w.jobs) || w.jobs.length > 10000) fail();
  const pawnIds=new Set();
  for (const p of w.pawns) {
    if (!p || !Number.isInteger(p.id) || pawnIds.has(p.id) || typeof p.name !== "string" || !Number.isFinite(p.x) || !Number.isFinite(p.y) || !inBounds(w,p.x,p.y) || !Number.isFinite(p.health) || p.health < 0 || p.health > 100 || !Array.isArray(p.path) || !p.inventory || typeof p.inventory !== "object") fail();
    pawnIds.add(p.id);
  }
  const jobIds=new Set();
  for (const j of w.jobs) {
    if (!j || !Number.isInteger(j.id) || jobIds.has(j.id) || typeof j.type !== "string" || !["queued","active","complete","cancelled","failed"].includes(j.state) || !Number.isFinite(j.priority) || j.priority < 1 || j.priority > 9 || !Number.isFinite(j.progress)) fail();
    jobIds.add(j.id);
  }
  if (!w.stock || typeof w.stock !== "object" || Object.values(w.stock).some(n => !Number.isFinite(n) || n < 0)) fail();
  return w;
}
export function deserializeWorld(json) {
  if (typeof json !== "string" || json.length > 25_000_000) throw new Error("Unsupported or invalid save format");
  let w;
  try { w=JSON.parse(json); } catch { throw new Error("Unsupported or invalid save format"); }
  return assertValidWorld(w);
}
