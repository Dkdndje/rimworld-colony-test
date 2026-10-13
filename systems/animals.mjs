// Lightweight original wildlife layer for the web colony prototype.
export const WILD_ANIMALS = Object.freeze({ hare: Object.freeze({ label: "Yabani tavşan", meat: 3, color: "#d9c6a3" }), boar: Object.freeze({ label: "Yaban domuzu", meat: 7, color: "#8f7865" }), deer: Object.freeze({ label: "Geyik", meat: 5, color: "#b98c5b" }) });

// Optional bridge to locally converted ThingDef data. This consumes definition data only;
// it does not load RimWorld assemblies or proprietary graphics.
let importedAnimals = null;
const BUILTIN_ANIMALS = WILD_ANIMALS;
export function configureWildlifeDefinitions(registry, world = null) {
  if (!registry || typeof registry.all !== "function") { importedAnimals = null; return { count: 0, source: "built-in" }; }
  const candidates = [];
  for (const def of registry.all("ThingDef")) {
    let resolved;
    try { resolved = registry.resolve("ThingDef", def.defName) || def; } catch { continue; }
    const raw = resolved.raw && typeof resolved.raw === "object" ? resolved.raw : {};
    const race = raw.race && typeof raw.race === "object" ? raw.race : null;
    if (!race || !resolved.defName || race.intelligence === "Humanlike") continue;
    // ThingDefs with race data represent pawn races; avoid accepting explicitly non-animal classes.
    const intelligence = String(race.intelligence || "").toLowerCase();
    if (!["animal", "tooluser"].includes(intelligence)) continue;
    const bodySizeRaw = race.baseBodySize ?? raw.statBases?.BodySize ?? raw.statBases?.bodySize ?? 1;
    const bodySize = Number(bodySizeRaw);
    const labelValue = resolved.label;
    const label = typeof labelValue === "string" && labelValue.trim() ? labelValue : resolved.defName;
    candidates.push({ kind: resolved.defName, label, meat: Number.isFinite(bodySize) ? Math.max(1, Math.min(30, Math.round(bodySize * 5))) : 5, color: BUILTIN_ANIMALS[resolved.defName]?.color || "#b5a17f", source: registry.sourceOf("ThingDef", def.defName) || "local catalogue" });
  }
  // Prefer the real local animal list when it exists, otherwise preserve the working prototype set.
  importedAnimals = candidates.length ? Object.fromEntries(candidates.map(a => [a.kind, Object.freeze(a)])) : null;
  if (importedAnimals && world && Array.isArray(world.animals)) {
    const kinds = Object.keys(importedAnimals);
    world.animals.forEach((animal, index) => {
      if (!importedAnimals[animal.kind]) animal.kind = kinds[index % kinds.length];
    });
  }
  return { count: candidates.length, source: candidates.length ? "local ThingDef catalogue" : "built-in fallback" };
}
export function wildlifeDefinitions() { return importedAnimals || BUILTIN_ANIMALS; }

export function spawnWildlife(world, count = 5) {
  if (!Array.isArray(world.animals)) world.animals = [];
  const random = world.rng || Math.random;
  let attempts = 0;
  while (world.animals.length < count && attempts++ < count * 30) {
    const x = Math.floor(random() * world.width), y = Math.floor(random() * world.height);
    const tile = world.tiles[y]?.[x];
    if (!tile || tile.kind === "water" || tile.building || world.pawns.some(p => p.x === x && p.y === y) || world.animals.some(a => a.x === x && a.y === y)) continue;
    const kinds = Object.keys(wildlifeDefinitions()), kind = kinds[Math.floor(random() * kinds.length)];
    world.animals.push({ id: world.nextAnimalId++, kind, x, y, health: 20 });
  }
  return world.animals;
}
export function animalAt(world, x, y) { return (world.animals || []).find(a => a.x === x && a.y === y) || null; }
export function huntingReward(animal) { return wildlifeDefinitions()[animal?.kind]?.meat || BUILTIN_ANIMALS[animal?.kind]?.meat || 3; }


// Animals take one simple movement step every few simulation ticks.
// A queued/active hunt suppresses fleeing so the existing hunting order stays targetable.
export function updateWildlife(world, random = Math.random) {
  const animals = world.animals || [];
  for (const animal of animals) {
    const hunted = (world.jobs || []).some(j => j.type === "hunt" && j.targetAnimalId === animal.id && ["queued", "active"].includes(j.state));
    if (hunted) continue;
    const threats = (world.pawns || []).filter(p => p.health > 0).map(p => ({ p, d: Math.abs(p.x - animal.x) + Math.abs(p.y - animal.y) })).filter(v => v.d <= 4).sort((a,b) => a.d-b.d);
    const flee = threats.length > 0;
    const options = [[1,0],[-1,0],[0,1],[0,-1]].map(([dx,dy]) => ({x:animal.x+dx,y:animal.y+dy}))
      .filter(t => t.x >= 0 && t.y >= 0 && t.x < world.width && t.y < world.height)
      .filter(t => { const tile=world.tiles[t.y]?.[t.x]; return tile && tile.kind !== "water" && !tile.building && !(world.pawns||[]).some(p=>p.health>0&&p.x===t.x&&p.y===t.y) && !animals.some(a=>a.id!==animal.id&&a.x===t.x&&a.y===t.y); });
    if (!options.length) continue;
    if (flee) {
      const nearest=threats[0].p;
      options.sort((a,b)=>(Math.abs(b.x-nearest.x)+Math.abs(b.y-nearest.y))-(Math.abs(a.x-nearest.x)+Math.abs(a.y-nearest.y)));
      const bestDistance=Math.abs(options[0].x-nearest.x)+Math.abs(options[0].y-nearest.y);
      const best=options.filter(t=>Math.abs(t.x-nearest.x)+Math.abs(t.y-nearest.y)===bestDistance);
      const next=best[Math.floor(random()*best.length)]; animal.x=next.x;animal.y=next.y;animal.lastBehavior="flee";
    } else if (random() < 0.35) {
      const next=options[Math.floor(random()*options.length)];animal.x=next.x;animal.y=next.y;animal.lastBehavior="wander";
    }
  }
  return animals;
}
