// Data-driven research adapter for the browser colony simulation.
// Imported catalogues contain definition data only; no game executable code is loaded.
const BUILTIN_RESEARCH = {
  agriculture: { label: "Agriculture", cost: 100, prerequisites: ["basic_shelter"], unlocks: ["farmplot"] },
  medicine: { label: "Medicine", cost: 100, prerequisites: ["agriculture"], unlocks: ["medicine_recipe"] },
  electricity: { label: "Electricity", cost: 150, prerequisites: ["medicine"], unlocks: ["components", "power_grid"] }
};
export let RESEARCH_CATALOG = Object.freeze(Object.fromEntries(Object.entries(BUILTIN_RESEARCH).map(([k,v])=>[k,Object.freeze(v)])));
const asNames = value => {
  if (typeof value === "string") return value.trim() ? [value.trim()] : [];
  if (!Array.isArray(value)) return [];
  return value.flatMap(item => typeof item === "string" ? [item] : item && typeof item === "object" ? Object.entries(item).flatMap(([k,v]) => k === "li" ? asNames(v) : typeof v === "string" ? [v] : []) : []).filter(Boolean);
};
export function configureResearchDefinitions(registry, world = null) {
  const merged = { ...BUILTIN_RESEARCH };
  let importedCount = 0;
  if (registry && typeof registry.all === "function") {
    for (const rawDef of registry.all("ResearchProjectDef")) {
      let def; try { def = registry.resolve("ResearchProjectDef", rawDef.defName) || rawDef; } catch { continue; }
      const raw = def.raw && typeof def.raw === "object" ? def.raw : {};
      const label = typeof def.label === "string" && def.label.trim() ? def.label : def.defName;
      const rawCost = raw.baseCost ?? raw.baseCostInteger ?? def.baseCost ?? def.baseCostInteger;
      const cost = Number(rawCost);
      const prerequisites = asNames(def.researchPrerequisites ?? raw.prerequisites ?? raw.researchPrerequisites);
      merged[def.defName] = { label, cost: Number.isFinite(cost) && cost > 0 ? cost : 100, prerequisites, unlocks: [], source: registry.sourceOf("ResearchProjectDef", rawDef.defName) || "local catalogue" };
      importedCount++;
    }
  }
  RESEARCH_CATALOG = Object.freeze(Object.fromEntries(Object.entries(merged).map(([k,v])=>[k,Object.freeze({ ...v, prerequisites: Object.freeze([...(v.prerequisites || [])]), unlocks: Object.freeze([...(v.unlocks || [])]) })])));
  if (world?.research) {
    world.research.projects ||= {};
    for (const id of Object.keys(RESEARCH_CATALOG)) if (!(id in world.research.projects)) world.research.projects[id] = 0;
    for (const id of Object.keys(world.research.projects)) if (!(id in RESEARCH_CATALOG)) delete world.research.projects[id];
  }
  return { count: importedCount, total: Object.keys(RESEARCH_CATALOG).length };
}
export function hasResearch(world, id) { return (world?.research?.unlocked || []).includes(id); }
export function researchAvailability(world, id) {
  const definition = RESEARCH_CATALOG[id];
  if (!definition || !world?.research?.projects || !(id in world.research.projects)) return { ok: false, reason: "Unknown research", missing: [] };
  if (hasResearch(world, id)) return { ok: false, reason: "Already researched", missing: [] };
  const missing = definition.prerequisites.filter(required => !hasResearch(world, required));
  if (missing.length) return { ok: false, reason: "Requires: " + missing.map(required => RESEARCH_CATALOG[required]?.label || required).join(", "), missing };
  const duplicate = (world.jobs || []).some(job => job.type === "research" && job.item === id && ["queued", "active"].includes(job.state));
  if (duplicate) return { ok: false, reason: "Research already queued", missing: [] };
  return { ok: true, reason: "Available", missing: [] };
}
export function researchCost(id) { return RESEARCH_CATALOG[id]?.cost ?? Infinity; }
