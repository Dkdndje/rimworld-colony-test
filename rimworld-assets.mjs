const IMAGE_EXTENSIONS = ['.png','.jpg','.jpeg','.webp','.gif'];
let manifestPromise;
const imageCache = new Map();

export function createTextureResolver(data) {
  if (data?.format !== 'rimworld-local-texture-catalogue' || !data.textures) throw new Error('Unsupported local texture manifest');
  const byLower = new Map();
  const byBasename = new Map();
  for (const [key, item] of Object.entries(data.textures)) {
    const url = typeof item === 'string' ? item : item?.url;
    if (!url) continue;
    const normalized = key.replace(/\\/g, '/').replace(/^\/+/, '').replace(/\.(png|jpe?g|webp|gif)$/i, '').toLocaleLowerCase();
    byLower.set(normalized, url);
    const base = normalized.split('/').at(-1);
    if (!byBasename.has(base)) byBasename.set(base, new Set());
    byBasename.get(base).add(url);
  }
  function resolveTexture(pathOrDef) {
    let raw = typeof pathOrDef === 'string' ? pathOrDef : pathOrDef?.graphicData?.texPath ?? pathOrDef?.raw?.graphicData?.texPath;
    if (!raw) return null;
    raw = String(raw).replace(/\\/g, '/').replace(/^\/+/, '').replace(/\.(png|jpe?g|webp|gif)$/i, '');
    const stripped = raw.replace(/^(?:Core\/)?Textures\//i, '').replace(/^Core\//i, '');
    const variants = new Set([raw, stripped, `Core/${stripped}`, `Core/Textures/${stripped}`, `Textures/${stripped}`]);
    for (const candidate of variants) {
      const found = byLower.get(candidate.toLocaleLowerCase());
      if (found) return found;
    }
    // Suffix matching handles XML texPaths that omit DLC/root prefixes, but only when unique.
    const suffix = stripped.toLocaleLowerCase();
    const suffixMatches = [...byLower.entries()].filter(([key]) => key.endsWith(`/${suffix}`)).map(([, url]) => url);
    const uniqueSuffixes = [...new Set(suffixMatches)];
    if (uniqueSuffixes.length === 1) return uniqueSuffixes[0];
    const basename = stripped.split('/').at(-1)?.toLocaleLowerCase();
    const matches = basename ? [...(byBasename.get(basename) ?? [])] : [];
    return matches.length === 1 ? matches[0] : null;
  }
  return { ...data, resolveTexture };
}

export async function loadRimWorldAssets(manifestUrl = './assets/rimworld-original/manifest.json') {
  if (!manifestPromise) manifestPromise = fetch(manifestUrl).then(r => {
    if (!r.ok) throw new Error(`Texture manifest unavailable (${r.status})`);
    return r.json();
  }).then(createTextureResolver).catch(error => { manifestPromise = null; throw error; });
  return manifestPromise;
}

export function getTextureImage(url) {
  if (!url) return null;
  if (!imageCache.has(url)) {
    const image = new Image();
    image.decoding = 'async';
    image.onload = () => window.dispatchEvent(new Event('rimworld-texture-loaded'));
    image.src = url;
    imageCache.set(url, image);
  }
  const image = imageCache.get(url);
  return image.complete && image.naturalWidth > 0 ? image : null;
}

export function drawTexture(ctx, url, x, y, width, height, { alpha = 1 } = {}) {
  const image = getTextureImage(url);
  if (!image) return false;
  ctx.save(); ctx.globalAlpha *= alpha;
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(image, x, y, width, height);
  ctx.restore();
  return true;
}

export function firstAvailableTexture(manifest, candidates = []) {
  for (const candidate of candidates) {
    const url = manifest?.resolveTexture(candidate);
    if (url) return url;
  }
  return null;
}

const definitionTextureCache = new WeakMap();
export function definitionTexture(manifest, registry, defName, type = 'ThingDef') {
  if (!manifest?.resolveTexture || !registry || typeof defName !== 'string' || !defName) return null;
  let registryCache = definitionTextureCache.get(manifest);
  if (!registryCache) { registryCache = new WeakMap(); definitionTextureCache.set(manifest, registryCache); }
  let entries = registryCache.get(registry);
  if (!entries) { entries = new Map(); registryCache.set(registry, entries); }
  const cacheKey = `${type}:${defName}`;
  if (entries.has(cacheKey)) return entries.get(cacheKey);
  const direct = registry.resolve?.(type, defName) ?? registry.get?.(type, defName);
  if (direct) {
    const url = manifest.resolveTexture(direct);
    if (url) { entries.set(cacheKey, url); return url; }
  }
  const normalized = value => String(value ?? '').toLocaleLowerCase().replace(/[^a-z0-9]/g, '');
  const wanted = normalized(defName);
  const matches = (registry.all?.(type) ?? []).filter(def => normalized(def.defName) === wanted);
  if (matches.length !== 1) { entries.set(cacheKey, null); return null; }
  const resolved = registry.resolve?.(type, matches[0].defName) ?? matches[0];
  const url = manifest.resolveTexture(resolved) ?? null;
  entries.set(cacheKey, url);
  return url;
}
