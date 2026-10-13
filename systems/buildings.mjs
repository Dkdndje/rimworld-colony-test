// Conservative adapter for single-tile ThingDefs with explicit, supported construction costs.
// Unsupported material/filter/size rules are skipped rather than silently approximated.
const BUILTIN = {
  wall: { label: "Duvar", costs: { wood: 3 }, work: 5 },
  sandbags: { label: "Siper torbaları", costs: { wood: 2, stone: 2 }, work: 5 },
  bed: { label: "Yatak", costs: { wood: 2 }, work: 4 },
  stockpile: { label: "Depo", costs: { wood: 2 }, work: 4 },
  campfire: { label: "Kamp ateşi", costs: { wood: 4, stone: 1 }, work: 5 },
  farmplot: { label: "Tarla", costs: {}, work: 5, research: "agriculture" },
  "solar-panel": { label: "Güneş paneli", costs: { wood: 5, stone: 3 }, work: 8, research: "electricity" },
  battery: { label: "Pil", costs: { wood: 4, stone: 4 }, work: 7, research: "electricity" },
  lamp: { label: "Lamba", costs: { wood: 2, stone: 1 }, work: 4, research: "electricity" }
};
const MATERIALS = Object.freeze({ wood: "wood", WoodLog: "wood", Wood: "wood", stone: "stone", BlocksGranite: "stone", BlocksLimestone: "stone", BlocksSandstone: "stone" });
const names = value => typeof value === "string" ? [value] : Array.isArray(value) ? value.flatMap(v => typeof v === "string" ? [v] : v && typeof v === "object" ? names(v.li ?? v.defName) : []) : [];
const sizeIsSingle = raw => {
  const size = raw.size; if (size == null || size === "1x1") return true;
  if (typeof size === "object") return Number(size.x ?? size._attributes?.x ?? 1) === 1 && Number(size.z ?? size.y ?? size._attributes?.z ?? size._attributes?.y ?? 1) === 1;
  return false;
};
const directCosts = value => {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const costs = {};
  for (const [material, rawAmount] of Object.entries(value)) {
    const key = MATERIALS[material]; const amount = Number(rawAmount);
    if (!key || !Number.isFinite(amount) || amount < 0) return null;
    costs[key] = (costs[key] || 0) + amount;
  }
  return costs;
};
export let BUILDING_CATALOG = Object.freeze(Object.fromEntries(Object.entries(BUILTIN).map(([id, def]) => [id, Object.freeze({ ...def, costs: Object.freeze({ ...def.costs }) })])));
export function configureBuildingDefinitions(registry) {
  const merged = { ...BUILTIN }; let importedCount = 0;
  if (registry && typeof registry.all === "function") for (const rawDef of registry.all("ThingDef")) {
    let def; try { def = registry.resolve("ThingDef", rawDef.defName) || rawDef; } catch { continue; }
    const raw = def.raw && typeof def.raw === "object" ? def.raw : {};
    if (!raw.building || !def.defName || !sizeIsSingle(raw)) continue;
    const costList = directCosts(def.costList ?? raw.costList);
    if (!costList) continue;
    const prerequisites = names(def.researchPrerequisites ?? raw.researchPrerequisites);
    const workRaw = Number(raw.workToBuild ?? raw.workAmount ?? 5);
    merged[def.defName] = {
      label: typeof def.label === "string" && def.label.trim() ? def.label : def.defName,
      costs: costList, work: Number.isFinite(workRaw) && workRaw > 0 ? workRaw : 5,
      research: prerequisites[0] || null, imported: true,
      source: registry.sourceOf("ThingDef", rawDef.defName) || "local catalogue"
    };
    importedCount++;
  }
  BUILDING_CATALOG = Object.freeze(Object.fromEntries(Object.entries(merged).map(([id, def]) => [id, Object.freeze({ ...def, costs: Object.freeze({ ...def.costs }) })])));
  return { count: importedCount, total: Object.keys(BUILDING_CATALOG).length };
}
export function buildingDefinition(id) { return BUILDING_CATALOG[id] || null; }
export function builtInBuildingIds() { return Object.keys(BUILTIN); }
