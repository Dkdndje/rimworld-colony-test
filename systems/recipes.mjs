// Data-only adapter for a supported subset of imported RecipeDefs.
// Complex RimWorld ingredient filters are intentionally not guessed into executable recipes.
const BUILTIN = {
  meal: { label: "Meal", inputs: { food: 5 }, outputs: { meals: 1 }, work: 4 },
  medicine: { label: "Medicine", inputs: { berries: 3 }, outputs: { medicine: 1 }, work: 6, research: "medicine" },
  component: { label: "Component", inputs: { steel: 2 }, outputs: { components: 1 }, work: 8, research: "electricity" },
  wooden_club: { label: "Tahta sopa", inputs: { wood: 4 }, outputs: { wooden_club: 1 }, work: 5 },
  stone_armor: { label: "Taş zırh", inputs: { wood: 2, stone: 3 }, outputs: { stone_armor: 1 }, work: 8 },
  fiber_cloak: { label: "Lif pelerini", inputs: { berries: 4 }, outputs: { fiber_cloak: 1 }, work: 6 }
};
export let RECIPE_CATALOG = Object.freeze(Object.fromEntries(Object.entries(BUILTIN).map(([id, def]) => [id, Object.freeze(def)])));
const directMap = value => {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const out = {};
  for (const [key, amount] of Object.entries(value)) {
    const n = Number(amount);
    if (!key || !Number.isFinite(n) || n <= 0) return null;
    out[key] = n;
  }
  return Object.keys(out).length ? out : null;
};
function simpleList(value) {
  if (typeof value === "string") return [value];
  if (!Array.isArray(value)) return [];
  return value.flatMap(item => typeof item === "string" ? [item] : item && typeof item === "object" ? simpleList(item.li ?? item.defName ?? item.thingDef) : []);
}
export function configureRecipeDefinitions(registry) {
  const merged = { ...BUILTIN }; let importedCount = 0;
  if (registry && typeof registry.all === "function") for (const rawDef of registry.all("RecipeDef")) {
    let def; try { def = registry.resolve("RecipeDef", rawDef.defName) || rawDef; } catch { continue; }
    const raw = def.raw && typeof def.raw === "object" ? def.raw : {};
    const inputs = directMap(def.inputs ?? raw.inputs);
    const outputs = directMap(def.outputs ?? raw.outputs);
    // Only consume explicit direct item/count maps; RimWorld filter-based ingredients require a real ingredient-selection engine.
    if (!inputs || !outputs) continue;
    const workRaw = Number(def.workAmount ?? raw.workAmount ?? 5);
    const researchList = simpleList(def.researchPrerequisites ?? raw.researchPrerequisites);
    merged[def.defName] = { label: typeof def.label === "string" && def.label.trim() ? def.label : def.defName, inputs, outputs, work: Number.isFinite(workRaw) && workRaw > 0 ? workRaw : 5, research: researchList[0] || null, source: registry.sourceOf("RecipeDef", rawDef.defName) || "local catalogue" };
    importedCount++;
  }
  RECIPE_CATALOG = Object.freeze(Object.fromEntries(Object.entries(merged).map(([id, def]) => [id, Object.freeze({ ...def, inputs: Object.freeze({ ...def.inputs }), outputs: Object.freeze({ ...def.outputs }) })])));
  return { count: importedCount, total: Object.keys(RECIPE_CATALOG).length };
}
export function recipeDefinition(id) { return RECIPE_CATALOG[id] || null; }
