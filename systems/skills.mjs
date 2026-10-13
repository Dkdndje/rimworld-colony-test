// Colonist skill catalog and progression rules.
export const SKILLS=Object.freeze(["construction","plants","mining","crafting","intellectual"]);
export function skillForWork(type,item=null,rock="rock") { if(type==="build")return "construction";if(type==="harvest")return item===rock?"mining":"plants";if(type==="craft")return "crafting";if(type==="research")return "intellectual";return null; }
export function workSpeedMultiplier(level=0) { return 1+Math.min(20,Math.max(0,level))*0.025; }
export function awardSkillExperience(pawn,skill,amount=1) { if(!SKILLS.includes(skill))return false;pawn.skills||={};pawn.skillXp||={};const level=pawn.skills[skill]||0;pawn.skillXp[skill]=(pawn.skillXp[skill]||0)+amount;if(pawn.skillXp[skill]>=(level+1)*5&&level<20){pawn.skills[skill]=level+1;pawn.skillXp[skill]=0;return true;}return false; }
