// Colonist state helpers independent from the canvas UI.
export function livingColonists(world){return (world.pawns||[]).filter(p=>p.health>0);}
export function nearestColonist(world,point){return livingColonists(world).slice().sort((a,b)=>(Math.abs(a.x-point.x)+Math.abs(a.y-point.y))-(Math.abs(b.x-point.x)+Math.abs(b.y-point.y)))[0]||null;}
export function assignWorkPriority(pawn,workType,priority){if(!pawn||!workType||!Number.isInteger(priority)||priority<1||priority>9)return false;pawn.priorities||={};pawn.priorities[workType]=priority;return true;}
