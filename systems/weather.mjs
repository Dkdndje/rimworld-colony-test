// Deterministic weather progression, separate from rendering.
export function updateWeather(world, rng) {
  if(world.tick % 600 !== 0) return world.weather;
  const roll=rng(); world.weather ||= {};
  world.weather.type=roll<0.15?"rain":roll<0.24?"cold":"clear";
  world.weather.outsideTemperature=world.weather.type==="cold"?-4:world.weather.type==="rain"?13:21;
  world.weather.rainfall=world.weather.type==="rain"?1:0;
  return world.weather;
}
