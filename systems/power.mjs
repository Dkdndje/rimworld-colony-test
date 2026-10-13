// Original lightweight power simulation for the browser colony prototype.
const distance = (a, b) => Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
export function updatePowerGrid(world) {
  const tiles = world.tiles.flat();
  const completed = tiles.filter(t => t.progress >= 1);
  const panels = completed.filter(t => t.building === "solar-panel");
  const batteries = completed.filter(t => t.building === "battery");
  const lamps = completed.filter(t => t.building === "lamp");
  world.power ??= { stored: 0, generated: 0, consumed: 0, poweredLamps: 0 };
  let generated = 0;
  // Solar panels only produce during the daylight window.
  if (world.minute >= 360 && world.minute < 1080) generated = panels.length * 2;
  const reachable = tile => panels.some(p => distance(p, tile) <= 8) || batteries.some(b => distance(b, tile) <= 8);
  // Batteries are a shared colony reserve; capacity scales with built batteries.
  const capacity = batteries.length * 100;
  world.power.stored = Math.max(0, Math.min(capacity, world.power.stored || 0));
  const localDemand = lamps.filter(reachable).length;
  const available = generated + world.power.stored;
  const supplied = Math.min(localDemand, available);
  const batteryDraw = Math.max(0, supplied - generated);
  world.power.stored = Math.max(0, world.power.stored - batteryDraw);
  const surplus = Math.max(0, generated - supplied);
  world.power.stored = Math.min(capacity, world.power.stored + surplus);
  for (const lamp of lamps) lamp.powered = reachable(lamp) && supplied > 0;
  // Mark lamps in stable tile order to avoid power-state flicker.
  let remaining = supplied;
  for (const lamp of lamps) {
    lamp.powered = reachable(lamp) && remaining > 0;
    if (lamp.powered) remaining--;
  }
  world.power.generated = generated;
  world.power.consumed = supplied;
  world.power.poweredLamps = lamps.filter(l => l.powered).length;
  return world.power;
}
