// Maps imported plant definitions onto the prototype's generated vegetation tiles.
// The browser consumes converted data only; textures are resolved by the separate local asset manifest.
export function configurePlantDefinitions(registry, world) {
  if (!registry || typeof registry.all !== "function" || !world?.tiles) return { count: 0, assigned: 0 };
  const trees = [];
  for (const rawDef of registry.all("PlantDef")) {
    let def; try { def = registry.resolve("PlantDef", rawDef.defName) || rawDef; } catch { continue; }
    const raw = def.raw && typeof def.raw === "object" ? def.raw : {};
    const treeFlag = raw.tree ?? raw.isTree ?? raw.plant?.tree;
    const looksLikeTree = /^Tree[A-Z_]/.test(def.defName || "") || treeFlag === true || String(treeFlag).toLowerCase() === "true";
    const texture = def.graphicData?.texPath ?? raw.graphicData?.texPath;
    if (!looksLikeTree || !texture) continue;
    trees.push(def.defName);
  }
  trees.sort();
  if (!trees.length) return { count: 0, assigned: 0 };
  let assigned = 0;
  for (const row of world.tiles) for (const tile of row) {
    if (tile.kind !== "tree") continue;
    if (!tile.plantDefName || !trees.includes(tile.plantDefName)) tile.plantDefName = trees[(tile.x * 31 + tile.y * 17 + (world.seed >>> 0)) % trees.length];
    assigned++;
  }
  return { count: trees.length, assigned };
}
