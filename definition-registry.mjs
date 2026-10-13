// Runtime registry for converted definition data; does not load executable game code/assets.
const CATALOG_FORMAT="rimworld-web-definition-catalog";
const MANIFEST_FORMAT="rimworld-web-batch-conversion-manifest";
function validDefinition(def){return !!def&&typeof def.type==="string"&&def.type.length>0&&typeof def.defName==="string"&&def.defName.length>0;}
function mergeInherited(parent,child){
 const out={...parent,...child};
 if(parent?.raw&&child?.raw&&typeof parent.raw==="object"&&typeof child.raw==="object")out.raw=mergeObjects(parent.raw,child.raw);
 for(const key of ["label","description","category","graphicData","statBases","costList","costStuffCount","ingredients","products","researchPrerequisites","researchViewX","researchViewY","workAmount","skillRequirements","workSkill","requiredResearchBuilding"]){if(child[key]===null||child[key]===undefined)out[key]=parent[key]??null;else if(child[key]&&parent[key]&&typeof child[key]==="object"&&typeof parent[key]==="object"&&!Array.isArray(child[key])&&!Array.isArray(parent[key]))out[key]=mergeObjects(parent[key],child[key]);}
 return out;
}
function mergeObjects(parent,child){const out={...parent};for(const [key,value] of Object.entries(child)){out[key]=value&&typeof value==="object"&&!Array.isArray(value)&&parent[key]&&typeof parent[key]==="object"&&!Array.isArray(parent[key])?mergeObjects(parent[key],value):value;}return out;}
export function createDefinitionRegistry(catalogues=[]){
 const definitions=new Map(),byType=new Map(),sources=new Map();let loadedFiles=0,skippedDefinitions=0;
 for(const entry of catalogues){
  const catalogue=entry?.catalogue??entry;const source=entry?.source??catalogue?.sourceFile??`catalogue-${loadedFiles+1}`;
  if(catalogue?.format!==CATALOG_FORMAT||catalogue?.formatVersion!==1||!Array.isArray(catalogue.definitions))throw new Error(`Unsupported definition catalogue: ${source}`);
  loadedFiles++;
  for(const def of catalogue.definitions){if(!validDefinition(def)){skippedDefinitions++;continue;}const key=`${def.type}:${def.defName}`;definitions.set(key,def);sources.set(key,source);}
 }
 for(const [key,def] of definitions){if(!byType.has(def.type))byType.set(def.type,new Map());byType.get(def.type).set(def.defName,def);}
 function resolve(type,defName,trail=new Set()){
  const key=`${type}:${defName}`,def=definitions.get(key);if(!def)return null;
  if(trail.has(key))throw new Error(`Definition inheritance cycle: ${[...trail,key].join(" -> ")}`);
  if(!def.parentName)return def;
  const next=new Set(trail);next.add(key);const parent=resolve(type,def.parentName,next);
  if(!parent)return {...def,inheritanceWarning:`Missing parent definition: ${def.parentName}`};
  const merged=mergeInherited(parent,def);merged.parentName=def.parentName;return merged;
 }
 return Object.freeze({
  get(type,defName){return definitions.get(`${type}:${defName}`)??null;},
  resolve(type,defName){return resolve(type,defName);},
  has(type,defName){return definitions.has(`${type}:${defName}`);},
  all(type=null){return type===null?[...definitions.values()]:[...(byType.get(type)?.values()??[])];},
  sourceOf(type,defName){return sources.get(`${type}:${defName}`)??null;},
  types(){return [...byType.keys()].sort();},
  stats(){return {loadedFiles,definitionCount:definitions.size,skippedDefinitions,countsByType:Object.fromEntries([...byType].map(([type,items])=>[type,items.size]).sort(([a],[b])=>a.localeCompare(b)))};}
 });
}
export async function fetchDefinitionRegistry(baseUrl,fetchImpl=globalThis.fetch){
 if(typeof fetchImpl!=="function")throw new Error("Fetch API is unavailable");
 const base=new URL(baseUrl,typeof location!=="undefined"?location.href:"http://localhost/");
 const indexUrl=new URL("catalogue-index.json",base.href.endsWith("/")?base.href:base.href+"/");
 const indexResponse=await fetchImpl(indexUrl);if(!indexResponse.ok)throw new Error(`Catalogue manifest request failed (${indexResponse.status})`);
 const manifest=await indexResponse.json();
 if(manifest?.format!==MANIFEST_FORMAT||manifest.formatVersion!==1||!Array.isArray(manifest.files))throw new Error("Invalid batch-conversion manifest");
 const catalogues=[];
 for(const file of manifest.files){
  if(typeof file?.output!=="string"||file.output.startsWith("/")||file.output.split("/").some(part=>part===".."))throw new Error("Unsafe catalogue output path in manifest");
  const url=new URL(file.output,indexUrl);if(url.origin!==indexUrl.origin||!url.pathname.startsWith(indexUrl.pathname.slice(0,indexUrl.pathname.lastIndexOf("/")+1)))throw new Error("Catalogue URL escaped its base directory");
  const response=await fetchImpl(url);if(!response.ok)throw new Error(`Catalogue request failed (${response.status}): ${file.output}`);
  catalogues.push({source:file.source??file.output,catalogue:await response.json()});
 }
 return createDefinitionRegistry(catalogues);
}
