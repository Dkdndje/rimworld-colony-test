// Grid room/temperature utilities for the original web simulation.
export function findEnclosedRooms(world) {
  const seen = new Set(), rooms = [];
  const at = (x,y) => world.tiles[y]?.[x];
  const key = (x,y) => `${x},${y}`;
  const blocked = t => !t || (t.building === "wall" && t.progress >= 1);
  for (let sy=0; sy<world.height; sy++) for (let sx=0; sx<world.width; sx++) {
    const first=at(sx,sy), k0=key(sx,sy);
    if (seen.has(k0)||blocked(first)) continue;
    const q=[{x:sx,y:sy}], cells=[]; seen.add(k0); let open=false;
    for(let h=0;h<q.length;h++){ const p=q[h]; cells.push(p);
      if(p.x===0||p.y===0||p.x===world.width-1||p.y===world.height-1) open=true;
      for(const [dx,dy] of [[1,0],[-1,0],[0,1],[0,-1]]) { const x=p.x+dx,y=p.y+dy,t=at(x,y),k=key(x,y); if(x<0||y<0||x>=world.width||y>=world.height||seen.has(k)||blocked(t)) continue; seen.add(k);q.push({x,y}); }
    }
    if(!open && cells.length>=2 && cells.every(p=>at(p.x,p.y)?.roofed)) rooms.push({id:rooms.length+1,cells,area:cells.length});
  }
  return rooms;
}
export function updateRoomTemperatures(world) {
  const rooms=findEnclosedRooms(world); world.rooms=rooms;
  const outside=world.weather?.outsideTemperature ?? 21;
  const indoors=new Set();
  for(const room of rooms){ const fire=room.cells.some(p=>{const t=world.tiles[p.y][p.x];return t.building==="campfire";});
    const target=outside+(fire?18:0);
    for(const p of room.cells){ const t=world.tiles[p.y][p.x]; indoors.add(`${p.x},${p.y}`); t.temperature=Math.max(-40,Math.min(60,(t.temperature ?? outside)+(target-(t.temperature ?? outside))*0.08)); }
  }
  for(const row of world.tiles) for(const t of row) if(!indoors.has(`${t.x},${t.y}`)) t.temperature=outside;
  return rooms;
}
