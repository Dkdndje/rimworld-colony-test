(() => {
  const map = document.querySelector('#map');
  const foodEl = document.querySelector('#food');
  const woodEl = document.querySelector('#wood');
  const stoneEl = document.querySelector('#stone');
  const dayEl = document.querySelector('#day');
  const clockEl = document.querySelector('#clock');
  const logList = document.querySelector('#logList');
  const icons = {empty:'',path:'⌁',garden:'♣',bed:'▰',wall:'▦'};
  const names = {path:'path',garden:'garden',bed:'bed',wall:'wall'};
  const costs = {path:{wood:1},garden:{wood:3},bed:{wood:2},wall:{stone:2}};
  let food=24,wood=18,stone=12,day=1,hour=8,selected=20;
  const tiles = Array.from({length:63},(_,i)=>({kind:'empty',i}));
  tiles[20].kind='bed'; tiles[21].kind='bed'; tiles[29].kind='garden';
  function addLog(message){const li=document.createElement('li');const time=String(hour).padStart(2,'0')+':00';const stamp=document.createElement('span');stamp.textContent=time;li.append(stamp,document.createTextNode(' '+message));logList.prepend(li);while(logList.children.length>8)logList.lastElementChild.remove();}
  function render(){map.replaceChildren();tiles.forEach((tile,i)=>{const b=document.createElement('button');b.className='tile'+(i===selected?' selected':'');b.type='button';b.setAttribute('role','gridcell');b.setAttribute('aria-label',tile.kind==='empty'?'Empty tile '+(i+1):tile.kind+' tile '+(i+1));b.dataset.kind=tile.kind;b.textContent=icons[tile.kind];b.addEventListener('click',()=>{selected=i;render();});map.append(b);});foodEl.textContent=food;woodEl.textContent=wood;stoneEl.textContent=stone;dayEl.textContent=day;clockEl.textContent=String(hour).padStart(2,'0')+':00';}
  document.querySelector('#buildBtn').addEventListener('click',()=>{const kind=document.querySelector('#building').value;const cost=costs[kind];if(tiles[selected].kind!=='empty'){addLog('That tile is already occupied.');return;}if((cost.wood||0)>wood||(cost.stone||0)>stone){addLog('Not enough resources for a '+names[kind]+'.');return;}wood-=cost.wood||0;stone-=cost.stone||0;tiles[selected].kind=kind;addLog('Placed '+names[kind]+' on tile '+(selected+1)+'.');render();});
  document.querySelector('#endDayBtn').addEventListener('click',()=>{day++;hour=8;food=Math.max(0,food-3);if(day%2===0)wood+=2;if(day%3===0)stone+=1;addLog('Day '+day+' begins. Settlers used 3 food and gathered supplies.');if(food===0)addLog('Warning: food stores are empty.');render();});
  document.querySelector('#clearLog').addEventListener('click',()=>{logList.replaceChildren();});
  render();
})();
