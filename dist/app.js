const $=s=>document.querySelector(s),canvas=$('#room'),ctx=canvas.getContext('2d');
// When hosted beside other UI, room keys only apply while the room (or nothing) has focus.
const forRoom=e=>!document.querySelector('.ah-root')||e.target===document.body&&!window.AfterhoursHost?.xamlFocus||!!e.target.closest?.('.ah-root');
const rooms=[{title:'Side B',owner:'afterhours',mood:'underground sounds',count:6,icon:'◉',color:'#c7cbb6',tag:'A soft place to land'},{title:'Midnight Diner',owner:'peach.wav',mood:'late-night jazz',count:4,icon:'☕',color:'#cfb4a3',tag:'Coffee & conversations'},{title:'The Greenhouse',owner:'fern',mood:'ambient & slow mornings',count:3,icon:'✳',color:'#b6c8ab',tag:'Grow at your own pace'},{title:'Cloud Nine',owner:'moonchild',mood:'dream pop & new friends',count:5,icon:'☁',color:'#bdbcd3',tag:'Somewhere above it all'}];
let saved={};try{saved=JSON.parse(localStorage.getItem('afterhours')||'{}')}catch{}let shirt=saved.shirt||'#8d9b65',coins=saved.coins??240,decor=AfterhoursFurniture.normalize(saved.decor||[]),roomIndex=0,personal=false,dancing=false,waving=0,liked=false;
const player={x:5.5,y:5.5,tx:5.5,ty:5.5,name:'daydream',shirt};const people=[{x:3.7,y:4.2,name:'miso',chatColor:'#0f7a6c',shirt:'#d89574',hair:'#4d3931'},{x:5.8,y:3.3,name:'olive',chatColor:'#7a3fc9',shirt:'#84986e',hair:'#7b523a'},{x:7.2,y:5.7,name:'tomo',chatColor:'#1f5fbf',shirt:'#7c8eab',hair:'#373736'},{x:4.1,y:6.6,name:'peach.wav',chatColor:'#d6246e',shirt:'#b18e9e',hair:'#7d493a'},{x:5.7,y:7.3,name:'sunny',chatColor:'#b8520a',shirt:'#d4af68',hair:'#b98242'}];
if(!saved.editorVersion){decor.forEach(d=>d.placed=false);decor=[...AfterhoursFurniture.starter(),...decor]}
function persist(){try{localStorage.setItem('afterhours',JSON.stringify({...JSON.parse(localStorage.getItem('afterhours')||'{}'),shirt:player.shirt,coins,decor,editorVersion:1}))}catch{}$('#coins').textContent=coins}
persist();function toast(s){$('#toast').textContent=s;$('#toast').style.opacity=1;clearTimeout(toast.t);toast.t=setTimeout(()=>$('#toast').style.opacity=0,2800)}
const sceneImage=new Image();sceneImage.src=(window.AfterhoursBase||'')+'assets/side-b.webp';
const roomAtlas=new Image();roomAtlas.src=(window.AfterhoursBase||'')+'assets/room-atlas.webp';
const spriteImage=new Image();spriteImage.src=(window.AfterhoursBase||'')+'assets/avatars.webp';
const roomView=AfterhoursView.mount(canvas);
let zoom=roomView.camera.zoom,hover=null,last=performance.now();
const reducedMotion=matchMedia('(prefers-reduced-motion: reduce)').matches;
let spriteIndex=Number.isInteger(saved.avatar)?saved.avatar:0,outfit=null;$('.profile-art').style.backgroundPosition=(-spriteIndex*35)+'px -4px';
const personalImage=new Image();personalImage.src=(window.AfterhoursBase||'')+'assets/my-room.webp';
const furnitureImage=new Image();furnitureImage.src=(window.AfterhoursBase||'')+'assets/furniture.webp';
const backImage=new Image();backImage.src=(window.AfterhoursBase||'')+'assets/avatars-back.webp';
const seatedImage=new Image();seatedImage.src=(window.AfterhoursBase||'')+'assets/avatars-seated.webp';
const furnitureCrops=[[15, 45, 428, 379], [473, 80, 478, 376], [1005, 27, 276, 421], [1366, 16, 391, 409], [121, 428, 179, 425], [466, 527, 382, 297], [909, 470, 403, 388], [1371, 474, 373, 359]];
const furnitureAtlases={classic:furnitureImage};
for(const [name,file] of Object.entries({objects:'game-objects.webp',loft:'furniture-loft-v1.webp',culture:'furniture-culture-v1.webp',fantasyA:'furniture-fantasy-a-v1.webp',fantasyB:'furniture-fantasy-b-v1.webp',denA:'furniture-man-cave-a-v1.webp',denB:'furniture-man-cave-b-v1.webp'})){const art=new Image();art.src=(window.AfterhoursBase||'')+'assets/'+file;furnitureAtlases[name]=art;}
const objectCrops=[[108,12,325,460],[514,17,317,463],[940,11,332,482],[1364,93,326,391],[80,446,363,415],[525,573,333,228],[926,490,338,356],[1374,519,332,335]];
function furnitureArt(type){const c=AfterhoursFurniture.catalog[type];return{image:furnitureAtlases[c.atlas||(c.cell<8?'classic':'objects')],crop:c.crop||(c.cell<8?furnitureCrops[c.cell]:objectCrops[c.cell-8])};}
function iso(x,y,z=0){if(personal)return[750+(x-y)*75,270+(x+y)*35-z];return roomIndex===0?[750+(x-y)*75,200+(x+y)*42-z]:[750+(x-y)*82,325+(x+y)*30-z]}
function ellipse(x,y,rx,ry,c){ctx.beginPath();ctx.ellipse(x,y,rx,ry,0,0,Math.PI*2);ctx.fillStyle=c;ctx.fill()}
function label(text,x,y,size,color){ctx.font=`500 ${size}px 'DM Sans', sans-serif`;ctx.textAlign='center';ctx.fillStyle=color;ctx.fillText(text,x,y)}
function polygon(points,fill,stroke){ctx.beginPath();points.forEach(([x,y],i)=>i?ctx.lineTo(x,y):ctx.moveTo(x,y));ctx.closePath();ctx.fillStyle=fill;ctx.fill();if(stroke){ctx.strokeStyle=stroke;ctx.lineWidth=1.3;ctx.stroke()}}
const Furniture=AfterhoursFurniture;
const editor={active:false,selected:null,ghost:null,history:[],down:null};
let furnitureBounds=[];
function currentItem(){return decor.find(d=>d.id===editor.selected)}
function navigationOptions(){const blocked=new Set();if(personal){decor.filter(d=>d.placed!==false).forEach(d=>Furniture.tiles(d).forEach(k=>blocked.add(k)))}else{
 for(let x=0;x<10;x++)for(let y=0;y<10;y++)if(!isRoomFloor(x+.5,y+.5))blocked.add(x+','+y);
 people.slice(0,rooms[roomIndex].count-1).forEach(p=>blocked.add(AfterhoursMovement.key(p)));
 }return{min:personal?1:0,max:personal?8:9,blocked}}
const walker=new AfterhoursMovement.Walker(player,navigationOptions);
const heldKeys=new Set();let nextKeyboardStep=0;
const seating = new AfterhoursSeating.Controller(walker, navigationOptions, offer =>
  offer.publicRoom !== undefined ? !personal && roomIndex === offer.publicRoom :
    personal && decor.some(d => d.id === offer.itemId && d.placed !== false));
let seatHover = null, rise = null, seatAnnouncement = '', lastSeatMode = 'standing';
const seatedCrops = [[55,9,360,699],[415,12,345,695],[758,19,373,689],[1142,17,367,691],[1502,21,353,687],[1856,22,314,690]];
function furnitureGeometry(item) {
  const c=Furniture.catalog[item.type],{crop}=furnitureArt(item.type),s=Furniture.footprint(item);
  const [x]=iso(item.x+s.w/2,item.y+s.d/2),[,y]=iso(item.x+s.w,item.y+s.d);
  return {x,y,w:c.width,h:crop[3]/crop[2]*c.width};
}
function floorAtPoint(x,y) {
  const sx=personal||roomIndex===0?75:82,sy=personal?35:roomIndex===0?42:30,oy=personal?270:roomIndex===0?200:325;
  return {x:((x-750)/sx+(y-oy)/sy)/2,y:((y-oy)/sy-(x-750)/sx)/2};
}
function isRoomFloor(x,y) {
  if(personal)return x>=1&&y>=1&&x<9&&y<9;
  return x>=0&&y>=0&&x<10&&y<10&&x+y>=6&&x+y<=19;
}
// Seat anchors are authored against the room artwork, then projected into the scene.
const loungeSeats = [
  [
    ['Blue sofa',250,449,false],['Blue sofa',302,432,false],['Blue sofa',363,421,false],['Blue sofa',405,431,true],
    ['Orange booth',1187,431,false],['Orange booth',1240,414,false],['Orange booth',1324,432,true],['Orange booth',1373,456,true],
    ['Leather stool',1217,475,false],['Leather stool',1320,485,true]
  ],
  [
    ['Diner booth',117,321,false],['Diner booth',217,304,true],
    ['Diner booth',274,263,false],['Diner booth',324,248,true],
    ['Counter stool',525,219,true],['Counter stool',579,240,true],['Counter stool',637,260,true],['Counter stool',696,280,true],
    ['Diner booth',819,305,false],['Diner booth',905,322,true]
  ],
  [['Rattan sofa',204,274,false],['Rattan sofa',271,254,false],['Rattan sofa',310,248,true]],
  [['Cloud sofa',195,258,false],['Cloud sofa',265,236,false],['Cloud sofa',322,222,false],
   ['Cloud sofa',694,249,true],['Cloud sofa',766,266,true],['Cloud sofa',832,282,true]]
];
function roomSeats() {
  if(personal)return decor.flatMap(item=>AfterhoursSeating.slots(item).map(slot=>{
    const g=furnitureGeometry(item),u=Furniture.mirrored(item)?1-slot.anchor[0]:slot.anchor[0];
    return {...slot,name:Furniture.catalog[item.type].name,point:[g.x-g.w/2+u*g.w,g.y-g.h+slot.anchor[1]*g.h]};
  }));
  return loungeSeats[roomIndex].map(([name,x,y,flip],index)=>{
    const point=roomIndex===0?[x*1500/1536,y*1000/1024]:[x*1500/1024,125+y*728/497];
    const desired=floorAtPoint(point[0]+(flip?-22:22),point[1]+65),base=AfterhoursMovement.center(desired);
    const approaches=[];
    for(let dx=-1;dx<=1;dx++)for(let dy=-1;dy<=1;dy++){
      const p={x:base.x+dx,y:base.y+dy};
      if(isRoomFloor(p.x,p.y))approaches.push(p);
    }
    approaches.sort((a,b)=>Math.hypot(a.x-desired.x,a.y-desired.y)-Math.hypot(b.x-desired.x,b.y-desired.y));
    return {id:`lounge-${roomIndex}-${index}`,itemId:`lounge-${roomIndex}-${index}`,index,publicRoom:roomIndex,name,point,flip,approaches:approaches.slice(0,4)};
  });
}
function seatAt(e) {
  const point=scenePoint(e),offers=roomSeats();
  if(personal){const hit=furnitureAt(e);if(!hit)return null;const group=offers.filter(s=>s.itemId===hit.id);group.sort((a,b)=>Math.hypot(a.point[0]-point.x,a.point[1]-point.y)-Math.hypot(b.point[0]-point.x,b.point[1]-point.y));return group.length?group:null;}
  const nearby=offers.filter(s=>Math.abs(s.point[0]-point.x)<52&&point.y>s.point[1]-48&&point.y<s.point[1]+43);
  nearby.sort((a,b)=>Math.hypot(a.point[0]-point.x,a.point[1]-point.y)-Math.hypot(b.point[0]-point.x,b.point[1]-point.y));
  return nearby.length?nearby:null;
}
function syncSeatControls() {
  const active=seating.mode!=='standing';
  $('#standUp').hidden=!active;$('#standUp').textContent=seating.mode==='approaching'?'Cancel seating':'Stand up';
  const status=seating.mode==='sitting'?`Seated · ${seatAnnouncement}`:seating.mode==='approaching'?`Walking to ${seatAnnouncement}`:'';
  if($('#seatStatus').textContent!==status)$('#seatStatus').textContent=status;
  $('#seatStatus').hidden=!active;
}
function standUp(animate=true) {
  if(animate&&seating.mode==='sitting'&&seating.target)rise={from:[...seating.target.offer.point],progress:0};
  else rise=null;
  if(seating.mode==='approaching')walker.stop();
  seating.stand();syncSeatControls();
}
function useSeat(offers) {
  if(!offers)return false;
  const previousHip=seating.mode==='sitting'?[...seating.target.offer.point]:null;
  heldKeys.clear();rise=null;seatHover=null;
  if(!seating.request(offers)){toast('The front of that seat is blocked. Clear a tile to reach it.');return true;}
  if(previousHip)rise={from:previousHip,progress:0};
  dancing=false;$('#dance').textContent='✧ Dance';seatAnnouncement=seating.target.offer.name;
  toast('On your way. Click the floor to cancel.');syncSeatControls();return true;
}
function walkTo(point) {selection=null;
  standUp();heldKeys.clear();
  if(walker.goTo(point)){dancing=false;$('#dance').textContent='✧ Dance';}
  else toast('No clear route to that tile.');
}
function updateSeating(dt) {
  seating.update(dt);
  if(rise){rise.progress=Math.min(1,rise.progress+dt/.18);if(rise.progress===1)rise=null;}
  if(lastSeatMode!==seating.mode){lastSeatMode=seating.mode;syncSeatControls();}
}
function drawSeatedAvatar() {
  const target=seating.target,offer=target.offer;
  const floor=iso(player.x,player.y),amount=reducedMotion?1:1-Math.pow(1-seating.settle,3);
  const x=floor[0]+(offer.point[0]-floor[0])*amount;
  const hip=floor[1]-54+(offer.point[1]-(floor[1]-54))*amount;
  const crop=seatedCrops[spriteIndex],h=118,w=crop[2]/crop[3]*h,feet=hip+h*.38;
  ctx.save();ctx.translate(x,hip);if(offer.flip)ctx.scale(-1,1);
  ctx.imageSmoothingEnabled=true;
  if(outfit&&AfterhoursAvatar.draw(ctx,outfit,{seated:true})){}else if(seatedImage.complete&&seatedImage.naturalWidth)ctx.drawImage(seatedImage,...crop,-w*.28,-h*.62,w,h);
  ctx.restore();
  drawAvatarLabels(player,x,feet,true);
}
function drawAvatarLabels(p,x,y,isPlayer) {
  ctx.font="500 13px 'DM Sans', sans-serif";const width=ctx.measureText(p.name).width+20;
  ctx.fillStyle=isPlayer?'#e4efaa':'#1a1729ec';ctx.beginPath();ctx.roundRect(x-width/2,y+15,width,23,5);ctx.fill();
  label(p.name,x,y+31,13,isPlayer?'#343929':'#d7cddd');
  if(isPlayer){label('YOU',x,y-138,10,'#e3edae');polygon([[x-5,y-131],[x+5,y-131],[x,y-125]],'#deec94');}
  if(isPlayer&&waving>Date.now()){ctx.save();ctx.translate(x+44,y-99);if(!reducedMotion)ctx.rotate(AfterhoursView.wavePose(performance.now()));label('✋',0,9,27,'#f4dfc2');ctx.restore()}
  roomView.note(p,x,y,isPlayer);
}
function drawSeatHover() {
  if(!seatHover||editor.active||seating.mode!=='standing')return;
  const [x,y]=seatHover[0].point;
  ctx.strokeStyle='#deee93aa';ctx.lineWidth=2;ctx.beginPath();ctx.ellipse(x,y+5,28,11,0,0,Math.PI*2);ctx.stroke();
  ctx.fillStyle='#1b2024ee';ctx.beginPath();ctx.roundRect(x-32,y-32,64,25,6);ctx.fill();
  label('Sit here',x,y-15,12,'#e4efaa');
}
$('#standUp').onclick=()=>{standUp();canvas.focus();};

function keyboardStep(t){if(editor.active||!heldKeys.size||t<nextKeyboardStep||walker.path.length>1)return;let dx=0,dy=0;const vectors={ArrowUp:[-1,-1],ArrowDown:[1,1],ArrowLeft:[-1,1],ArrowRight:[1,-1],w:[-1,-1],s:[1,1],a:[-1,1],d:[1,-1]};heldKeys.forEach(k=>{dx+=vectors[k][0];dy+=vectors[k][1]});if(dx||dy){if(seating.mode!=='standing')standUp();const goal=walker.path.at(-1)||player;walker.goTo({x:goal.x+Math.sign(dx),y:goal.y+Math.sign(dy)})}nextKeyboardStep=t+150}
function stopEditing(){editor.active=false;editor.selected=null;editor.ghost=null;editor.down=null;editor.history=[];$('#roomEditor').hidden=true;$('.scene-bottom>span').innerHTML='<span class="key">↖</span> CLICK FLOOR TO WALK · CLICK A SEAT TO SIT';canvas.style.cursor='crosshair'}
function startEditing(){standUp(false);seatHover=null;if(!personal)enterRoom(0,true);walker.stop();heldKeys.clear();editor.active=true;$('#roomEditor').hidden=false;$('.scene-bottom>span').innerHTML='<span class="key">↖</span> PICK UP · MOVE · ROTATE';updateEditor();toast('Pick up a piece, then click a free tile. R rotates. Esc cancels.')}
function updateEditor(){const item=currentItem();$('#selectedFurniture').textContent=item?Furniture.catalog[item.type].name:'Choose a piece to move';$('#editorHint').textContent=item?'Click a green tile to place · R rotates · Esc cancels':'Click or drag furniture · Your layout saves automatically';$('#rotateFurniture').disabled=!item;$('#storeFurniture').disabled=!item;$('#undoFurniture').disabled=!editor.history.length;$('#roomEditor').classList.toggle('has-selection',!!item)}
function remember(item){editor.history.push({id:item.id,before:{...item}});if(editor.history.length>30)editor.history.shift()}
function selectFurniture(id){editor.selected=id;const item=currentItem();editor.ghost={...item};updateEditor()}
function moveGhost(point){const item=currentItem();if(!item)return;editor.ghost={...(editor.ghost||item),x:Math.floor(point.x-(editor.down?.dragged?editor.down.offsetX:0)),y:Math.floor(point.y-(editor.down?.dragged?editor.down.offsetY:0))}}
function placeGhost(){const item=currentItem(),ghost=editor.ghost;if(!item||!ghost)return false;if(!Furniture.canPlace(ghost,decor,player)){toast('That spot is occupied. Choose a clear tile.');return false}remember(item);if(item.placed===false){unboxed.set(item.id,performance.now());AfterhoursView.cue('pop')}Object.assign(item,ghost,{placed:true});persist();editor.selected=null;editor.ghost=null;updateEditor();toast('Placed. Room saved.');return true}
function rotateFurniture(){const item=currentItem();if(!item)return;if(!editor.ghost)editor.ghost={...item};editor.ghost.rot=editor.ghost.rot?0:1;updateEditor()}
function storeFurniture(){const item=currentItem();if(!item)return;remember(item);item.placed=false;persist();editor.selected=null;editor.ghost=null;updateEditor();toast('Back in your inventory. You still own it.')}
function undoFurniture(){const entry=editor.history.pop();if(!entry)return;const item=decor.find(d=>d.id===entry.id);if(item)Object.assign(item,entry.before);persist();editor.selected=null;editor.ghost=null;updateEditor();toast('Last layout change undone.')}
function drawFurniture(item,preview=false){const c=Furniture.catalog[item.type],{image:art,crop}=furnitureArt(item.type);if(!art.complete||!art.naturalWidth)return;const g=furnitureGeometry(item),size=Furniture.footprint(item);ctx.save();if(preview)ctx.globalAlpha=.62;ctx.translate(g.x,g.y);const opened=!preview&&unboxScale(item.id);if(opened)ctx.scale(opened,opened);if(Furniture.mirrored(item))ctx.scale(-1,1);ctx.imageSmoothingEnabled=true;ctx.drawImage(art,...crop,-g.w/2,-g.h,g.w,g.h);ctx.restore();if(!preview)furnitureBounds.push({id:item.id,x:g.x-g.w/2,y:g.y-g.h,w:g.w,h:g.h,depth:item.x+item.y+size.w+size.d});}
function furnitureDiamond(item,fill,stroke){const {w,d}=Furniture.footprint(item);polygon([iso(item.x,item.y),iso(item.x+w,item.y),iso(item.x+w,item.y+d),iso(item.x,item.y+d)],fill,stroke)}
function drawEditGrid(){for(let x=1;x<=8;x++)for(let y=1;y<=8;y++)polygon([iso(x,y),iso(x+1,y),iso(x+1,y+1),iso(x,y+1)],'#eeeebd03','#eeeebd22');const item=currentItem();if(item&&item.placed!==false)furnitureDiamond(item,'#e3ee9a25','#e3ee9a99');if(editor.ghost){const valid=Furniture.canPlace(editor.ghost,decor,player);furnitureDiamond(editor.ghost,valid?'#dff48a44':'#ff697744',valid?'#e5f7a5':'#ff6980')}}
function scenePoint(e){const r=canvas.getBoundingClientRect();return roomView.camera.unproject(e.clientX-r.left,e.clientY-r.top);}
function furnitureAt(e){const p=scenePoint(e);return [...furnitureBounds].reverse().find(b=>p.x>=b.x&&p.x<=b.x+b.w&&p.y>=b.y&&p.y<=b.y+b.h)}
function showInventory(){if(!editor.active)startEditing();modal('<div class="eyebrow">YOUR ROOM, YOUR RULES</div><h2>Furniture & inventory</h2><p>Choose an owned piece to place it, or pick up something new. Everything saves on this device.</p><div id="ownedFurniture" class="furniture-grid"></div><div class="field-label">ADD TO YOUR COLLECTION</div><div id="furnitureShop" class="furniture-grid"></div>');
 function card(type,sub,click){const b=document.createElement('button');b.className='furniture-card';const art=document.createElement('canvas');art.width=130;art.height=105;const crop=furnitureCrops[Furniture.catalog[type].cell];if(furnitureImage.complete){const scale=Math.min(120/crop[2],98/crop[3]);art.getContext('2d').drawImage(furnitureImage,...crop,(130-crop[2]*scale)/2,102-crop[3]*scale,crop[2]*scale,crop[3]*scale)}const name=document.createElement('b');name.textContent=Furniture.catalog[type].name;const detail=document.createElement('small');detail.textContent=sub;b.append(art,name,detail);b.onclick=click;return b}
 decor.forEach(item=>$('#ownedFurniture').append(card(item.type,item.placed===false?'In inventory · Place':'In room · Move',()=>{$('#modal').close();selectFurniture(item.id);toast('Click a clear tile to place it.')})));
 Object.entries(Furniture.catalog).forEach(([type,c])=>$('#furnitureShop').append(card(type,c.price+' ✦',()=>{if(coins<c.price){const note=$('#modalBody>p');note.textContent='You need '+c.price+' ✦ for this piece. Your balance is '+coins+' ✦.';return}const item={id:crypto.randomUUID?crypto.randomUUID():'item-'+Date.now(),type,x:4,y:6,rot:0,placed:false};decor.push(item);coins-=c.price;persist();$('#modal').close();selectFurniture(item.id);toast('Added to your inventory. Choose where it goes.')})))}
$('#rotateFurniture').onclick=rotateFurniture;$('#storeFurniture').onclick=storeFurniture;$('#undoFurniture').onclick=undoFurniture;$('#openInventory').onclick=showInventory;$('#finishEditing').onclick=()=>{stopEditing();toast('Room saved. Make yourself at home.')};
canvas.addEventListener('pointermove',e=>{const p=tileAt(e);if(editor.active){if(editor.down&&Math.hypot(e.clientX-editor.down.x,e.clientY-editor.down.y)>6)editor.down.dragged=true;if(editor.selected)moveGhost(p);canvas.style.cursor=editor.selected?'crosshair':furnitureAt(e)?'grab':'default'}else{seatHover=seatAt(e);hover=!seatHover&&walkable(p)?{x:Math.floor(p.x),y:Math.floor(p.y)}:null;canvas.style.cursor=seatHover?'pointer':'crosshair'}});
canvas.addEventListener('pointerleave',()=>{hover=null;seatHover=null;if(!editor.down)editor.ghost=null});
canvas.addEventListener('pointerdown',e=>{if(e.button!==0)return;canvas.focus();if(!editor.active)return;const hit=editor.selected?null:furnitureAt(e),point=tileAt(e);if(hit)selectFurniture(hit.id);const item=currentItem();editor.down={x:e.clientX,y:e.clientY,hit:hit?.id,dragged:false,offsetX:hit?point.x-item.x:0,offsetY:hit?point.y-item.y:0};canvas.setPointerCapture(e.pointerId)});
canvas.addEventListener('pointerup',e=>{if(e.button!==0)return;const p=tileAt(e);if(editor.active){const down=editor.down;if(down?.dragged||(!down?.hit&&editor.selected)){moveGhost(p);placeGhost()}editor.down=null;if(canvas.hasPointerCapture(e.pointerId))canvas.releasePointerCapture(e.pointerId)}else{const offers=seatAt(e);if(offers){useSeat(offers);return}if(walkable(p))walkTo(p)}});
canvas.addEventListener('pointercancel',()=>{editor.down=null;editor.ghost=null;editor.selected=null;updateEditor()});
canvas.addEventListener('keydown',e=>{if(!forRoom(e))return;const movement=['ArrowUp','ArrowDown','ArrowLeft','ArrowRight','w','a','s','d'];if(movement.includes(e.key)&&!editor.active){e.preventDefault();heldKeys.add(e.key);dancing=false;$('#dance').textContent='✧ Dance';if(!e.repeat){nextKeyboardStep=0;keyboardStep(performance.now())}}});
window.addEventListener('keyup',e=>heldKeys.delete(e.key));window.addEventListener('blur',()=>heldKeys.clear());canvas.addEventListener('blur',()=>heldKeys.clear());
document.addEventListener('keydown',e=>{if(!forRoom(e))return;if(!editor.active||$('#modal').open||e.target.matches('input'))return;if(e.key.toLowerCase()==='r'){e.preventDefault();rotateFurniture()}if(e.key==='Escape'){editor.selected=null;editor.ghost=null;updateEditor()}if((e.ctrlKey||e.metaKey)&&e.key==='z'){e.preventDefault();undoFurniture()}});

const arrivals=new Map(),unboxed=new Map();let selection=null,introTimers=[];
// The chevron marks whoever or whatever you last clicked, until you walk or change rooms.
function select(kind,id){selection={kind,id}}
function selectionPoint(){if(!selection)return null;const {kind,id}=selection;
 if(kind==='resident'){const p=personal?null:people.find(x=>x.name===id);if(!p)return null;const [x,y]=iso(p.x,p.y);return [x,y-150]}
 if(kind==='item'){const d=decor.find(i=>i.id===id&&i.placed!==false);if(!d)return null;const g=furnitureGeometry(d);return [g.x,g.y-g.h-12]}
 return window.AfterhoursOnline?.peerPoint(id)||null}
function drawSelection(t){const point=selectionPoint();if(!point){selection=null;return}const [x,y]=point,lift=reducedMotion?0:Math.floor(t/125)%2?-3:0;
 ctx.save();ctx.translate(x,y+lift);ctx.beginPath();ctx.moveTo(-8,-10);ctx.lineTo(8,-10);ctx.lineTo(0,0);ctx.closePath();ctx.lineJoin='round';ctx.lineWidth=3;ctx.strokeStyle='#14141b';ctx.stroke();ctx.fillStyle='#deec94';ctx.fill();ctx.restore()}
// A Coke Music style studio card: who owns the room, who is here, what is playing.
function showRoomIntro(){introTimers.forEach(clearTimeout);const card=$('#roomIntro');if(!card)return;card.classList.remove('shown');
 introTimers=[setTimeout(()=>{const meta=$('#roomMeta').textContent.split(' · '),playing=document.body.classList.contains('is-playing');
  card.querySelector('b').textContent=$('#roomTitle').textContent.replace(/\.$/,'');card.querySelector('span').textContent=meta[0]+' · '+$('#guestCount').textContent+' here';
  const now=card.querySelector('em');now.hidden=!playing;now.textContent=playing?'Now playing · '+$('#trackTitle').textContent:'';card.classList.add('shown')},250),
  setTimeout(()=>card.classList.remove('shown'),4250)]}
function markArrival(id){arrivals.set(id,performance.now())}
function drawArrival(id,x,y){const at=arrivals.get(id);if(at===undefined)return;const k=(performance.now()-at)/650;if(k>=1){arrivals.delete(id);return}if(reducedMotion)return;const e=1-Math.pow(1-k,3);ctx.save();ctx.globalAlpha=1-k;ctx.strokeStyle='#deee93';ctx.lineWidth=2;ctx.beginPath();ctx.ellipse(x,y+2,14+30*e,5+11*e,0,0,Math.PI*2);ctx.stroke();ctx.restore()}
// Back-out over 300 ms: the piece overshoots to about 104% and settles.
function unboxScale(id){const at=unboxed.get(id);if(at===undefined)return 0;const k=(performance.now()-at)/300;if(k>=1||reducedMotion){unboxed.delete(id);return 0}const s=1.70158,u=k-1;return .6+.4*(1+(s+1)*u*u*u+s*u*u)}
function drawWalker(p,t,gait=walker,index=spriteIndex){
 const back=gait.back&&backImage.complete&&backImage.naturalWidth;
 const art=back?backImage:spriteImage;
 const sw=art.naturalWidth/6,sh=art.naturalHeight,h=118,w=sw/sh*h;
 const sx=index*sw,sy=0;
 const split=.54,hipY=-h+h*split,stride=gait.moving?Math.sin(gait.phase):0;
 const lift=gait.moving&&!reducedMotion?Math.abs(Math.sin(gait.phase))*1.6:0;
 ctx.save();if(gait.flip)ctx.scale(-1,1);ctx.imageSmoothingEnabled=true;
 // Swing each leg from the hip. Gait follows traveled distance, including braking.
 for(const side of [-1,1]){const swing=stride*side,half=w/2,pivotX=side*w*.12;
  ctx.save();ctx.translate(pivotX,hipY);ctx.rotate(swing*.23);ctx.translate(swing*1.5,-Math.max(0,swing)*5);
  ctx.drawImage(art,sx+(side<0?0:sw/2),sy+sh*split,sw/2,sh*(1-split),side<0?-half-pivotX:-pivotX,-2,half,h*(1-split)+2);ctx.restore();
 }
 ctx.translate(0,-lift);ctx.rotate(stride*.015);ctx.drawImage(art,sx,sy,sw,sh*(split+.04),-w/2,-h,w,h*(split+.04));ctx.restore();
}
function avatarDepth(actor,seat){
 if(personal)return Furniture.actorDepth(actor,seat?.id,decor);
 if(seat?.point){const p=floorAtPoint(seat.point[0],seat.point[1]+45);return p.x+p.y;}
 return actor.x+actor.y;
}
function drawAvatar(p,t,isPlayer){if(isPlayer&&seating.mode==='sitting'){drawSeatedAvatar();return}let[x,y]=iso(p.x,p.y);if(isPlayer&&rise&&!reducedMotion){const k=1-Math.pow(1-rise.progress,3);x=rise.from[0]+(x-rise.from[0])*k;y=rise.from[1]+54+(y-rise.from[1]-54)*k;}const pose=dancing&&isPlayer&&!reducedMotion?AfterhoursView.dancePose(t):{bob:0,tilt:0},bob=pose.bob;drawArrival(isPlayer?'self':p.id,x,y);ellipse(x,y+1,isPlayer&&walker.moving?27:29,10,'#05050a99');if(isPlayer){ctx.strokeStyle='#deee9380';ctx.lineWidth=1.3;ctx.beginPath();ctx.ellipse(x,y+2,33,12,0,0,Math.PI*2);ctx.stroke()}
 const idx=isPlayer?spriteIndex:people.indexOf(p)+1;ctx.save();ctx.translate(x,y+bob);if(pose.tilt)ctx.rotate(pose.tilt);
 if(isPlayer&&outfit&&AfterhoursAvatar.draw(ctx,outfit,{back:walker.back,flip:walker.flip,moving:walker.moving,phase:walker.phase,reducedMotion})){}else if(isPlayer&&spriteImage.complete&&spriteImage.naturalWidth){drawWalker(p,t)}else if(spriteImage.complete&&spriteImage.naturalWidth){const sw=spriteImage.naturalWidth/6,sh=spriteImage.naturalHeight,h=118,w=sw/sh*h;if(isPlayer&&walker.flip)ctx.scale(-1,1);ctx.drawImage(spriteImage,idx*sw,0,sw,sh,-w/2,-h,w,h)}ctx.restore();
 drawAvatarLabels(p,x,y,isPlayer);
}

function draw(t){const dt=Math.min((t-last)/1000,.1);last=t;keyboardStep(t);if(!editor.active){walker.update(dt);updateSeating(dt)}window.GameHooks?.update(dt,t);ctx.save();roomView.begin(ctx,...iso(player.x,player.y),dt,reducedMotion);
 if(personal&&personalImage.complete&&personalImage.naturalWidth)ctx.drawImage(personalImage,0,0,1500,1000);else if(roomIndex>0&&roomAtlas.complete&&roomAtlas.naturalWidth){const sh=roomAtlas.naturalHeight/3;ctx.drawImage(roomAtlas,0,(roomIndex-1)*sh,roomAtlas.naturalWidth,sh-15,0,125,1500,728)}else if(sceneImage.complete&&sceneImage.naturalWidth)ctx.drawImage(sceneImage,0,0,1500,1000);
 window.GameHooks?.background();if(editor.active)drawEditGrid();else if(hover)polygon([iso(hover.x,hover.y),iso(hover.x+1,hover.y),iso(hover.x+1,hover.y+1),iso(hover.x,hover.y+1)],personal?'#f1cf6038':'#e4efa535',personal?'#ffe37a':'#e4efa5');
 if(walker.moving&&!editor.active){const goal=walker.goal,gx=Math.floor(goal.x),gy=Math.floor(goal.y);polygon([iso(gx,gy),iso(gx+1,gy),iso(gx+1,gy+1),iso(gx,gy+1)],personal?'#f1cf6040':'#e4efa536',personal?'#ffe37a':'#e4efa5');walker.path.forEach((p,i)=>{let[a,b]=iso(p.x,p.y);ellipse(a,b,i===walker.path.length-1?10:3,i===walker.path.length-1?4:1.5,i===walker.path.length-1?'#e4ef9c88':'#e4ef9c44')})}
 furnitureBounds=[];const guests=personal?[]:people.slice(0,rooms[roomIndex].count-1);const layers=[...guests,player].map(p=>({depth:avatarDepth(p,p===player&&seating.mode==='sitting'?seating.target.offer:null),draw:()=>drawAvatar(p,t,p===player)}));if(personal)decor.filter(d=>d.placed!==false).forEach(d=>{layers.push({depth:Furniture.depth(d),draw:()=>drawFurniture(d)})});window.GameHooks?.layers(layers,t);layers.sort((a,b)=>a.depth-b.depth).forEach(x=>x.draw());if(editor.active&&editor.ghost)drawFurniture(editor.ghost,true);drawSeatHover();drawSelection(t);window.GameHooks?.foreground();ctx.restore();roomView.end();requestAnimationFrame(draw)}
requestAnimationFrame(draw);

function tileAt(e){const {x,y}=scenePoint(e);return floorAtPoint(x,y);}
function walkable(p){return isRoomFloor(p.x,p.y)}
function changeZoom(delta){zoom=Math.max(.8,Math.min(2.4,+(zoom+delta).toFixed(1)));roomView.camera.zoom=zoom;roomView.camera.constrain();$('#zoomLabel').textContent=Math.round(zoom*100)+'%';}
$('#zoomIn').onclick=()=>changeZoom(.2);$('#zoomOut').onclick=()=>changeZoom(-.2);changeZoom(0);
$('#fitRoom').onclick=()=>{zoom=1;roomView.camera.x=750;roomView.camera.y=500;roomView.camera.follow=false;changeZoom(0);};
$('#followPlayer').onclick=()=>{zoom=Math.max(zoom,1.6);roomView.camera.follow=true;[roomView.camera.x,roomView.camera.y]=iso(player.x,player.y-1);changeZoom(0);};
let cameraDrag=null,spaceHeld=false;
document.addEventListener('keydown',e=>{if(!forRoom(e))return;if(e.code==='Space'&&!e.target.matches('input,textarea,select,button')&&!$('#modal').open){spaceHeld=true;e.preventDefault();}});
document.addEventListener('keyup',e=>{if(e.code==='Space')spaceHeld=false;});
window.addEventListener('blur',()=>{spaceHeld=false;cameraDrag=null;});
canvas.addEventListener('pointerdown',e=>{const touch=e.pointerType==='touch'&&!editor.active;if(!touch&&e.button!==1&&!(e.button===0&&spaceHeld))return;e.preventDefault();e.stopImmediatePropagation();cameraDrag={x:e.clientX,y:e.clientY,cx:roomView.camera.x,cy:roomView.camera.y,touch,moved:!touch};roomView.camera.follow=false;canvas.setPointerCapture(e.pointerId);canvas.style.cursor='grabbing';},true);
canvas.addEventListener('pointermove',e=>{if(!cameraDrag)return;e.stopImmediatePropagation();if(!cameraDrag.moved&&Math.hypot(e.clientX-cameraDrag.x,e.clientY-cameraDrag.y)<8)return;cameraDrag.moved=true;roomView.camera.x=cameraDrag.cx-(e.clientX-cameraDrag.x)/roomView.camera.scale;roomView.camera.y=cameraDrag.cy-(e.clientY-cameraDrag.y)/roomView.camera.scale;roomView.camera.constrain();},true);
for(const event of ['pointerup','pointercancel'])canvas.addEventListener(event,e=>{if(!cameraDrag)return;if(cameraDrag.moved||event==='pointercancel')e.stopImmediatePropagation();cameraDrag=null;if(canvas.hasPointerCapture(e.pointerId))canvas.releasePointerCapture(e.pointerId);canvas.style.cursor='crosshair';},true);


function message(name,text,color='#d6c2b6'){const el=document.createElement('div');el.className=name==='system'?'message system':'message';if(name==='system'){el.textContent=text}else{const avatar=document.createElement('div');avatar.className='msg-avatar';avatar.style.backgroundColor='#34303f';avatar.style.backgroundPosition=([-35,-70,-105,-140,-175][people.findIndex(p=>p.name===name)]||0)+'px -3px';const content=document.createElement('div'),b=document.createElement('b'),time=document.createElement('time'),p=document.createElement('p');b.textContent=name;time.textContent='now';p.textContent=text;content.append(b,time,p);el.append(avatar,content)}$('#messages').append(el);$('#messages').scrollTop=$('#messages').scrollHeight}
function populateChat(){ $('#messages').replaceChildren();message('system',personal?'Your room. Your little universe.':'You stepped into '+rooms[roomIndex].title);if(!personal){message('miso','ok this bassline is ridiculous');message('olive','wait who made this track??','#bec9aa');message('tomo','made it in the beat studio. your turn ↗','#c5ccda');message('peach.wav','daydream! come through, we saved you a spot','#d7bfca')}}populateChat();
$('#chatForm').addEventListener('submit',e=>{e.preventDefault();let v=$('#chatInput').value.trim();if(!v)return;message('daydream',v,'#d1dabb');player.bubble=v.length>36?v.slice(0,33)+'…':v;player.until=Date.now()+5000;$('#chatInput').value='';if(!personal)setTimeout(()=>{message('miso','glad you’re here. make yourself at home ♡');people[0].bubble='make yourself at home ♡';people[0].until=Date.now()+4500},1800)});
function enterRoom(i,mine=false){roomView.reset();for(const p of [player,...people]){p.bubble=null;p.until=0;}standUp(false);seatHover=null;stopEditing();heldKeys.clear();dancing=false;$('#dance').textContent='✧ Dance';roomIndex=i;personal=mine;$('#roomTitle').textContent=mine?'Your afterhours':rooms[i].title;$('.room-live>span:last-child').textContent=String(i+1).padStart(2,'0')+' / 04';$('.current-room small').innerHTML=i===0&&!mine?'<i></i> YOU’RE HERE':'<i></i> PUBLIC ROOM';$('.room-heading .eyebrow>span').textContent=mine?'PERSONAL ROOM':'PUBLIC ROOM';$('.people-strip small').textContent=mine?'Just you, for now':(rooms[i].count-1)+' guests + you';$('#roomMeta').textContent=mine?'by daydream · saved on this device':`by ${rooms[i].owner} · ${rooms[i].count} people · ${rooms[i].mood}`;$('#guestCount').textContent=mine?'1':rooms[i].count;let spawn={x:mine?4.5:5.5,y:mine?4.5:5.5};if(mine&&navigationOptions().blocked.has(AfterhoursMovement.key(spawn))){const free=[];for(let x=1;x<=8;x++)for(let y=1;y<=8;y++)if(!navigationOptions().blocked.has(x+','+y))free.push({x:x+.5,y:y+.5});free.sort((a,b)=>Math.hypot(a.x-4.5,a.y-4.5)-Math.hypot(b.x-4.5,b.y-4.5));spawn=free[0]||spawn}walker.reset(spawn.x,spawn.y);selection=null;showRoomIntro();markArrival('self');AfterhoursView.cue('arrive');populateChat();toast(mine?'Welcome home. Make it yours.':'You entered '+rooms[i].title);document.querySelectorAll('.nav').forEach(n=>n.classList.toggle('active',n.dataset.view===(mine?'room':'explore')))}
$('#roomCards').innerHTML=rooms.slice(1).map((r,i)=>`<button class="room-card" data-room="${i+1}"><div class="room-art"><span>${r.icon}</span></div><div class="room-info"><b>${r.title}</b><p>${r.mood.split(' & ')[0]}<em>● ${r.count}</em></p></div></button>`).join('');document.querySelectorAll('[data-room]').forEach(b=>b.onclick=()=>enterRoom(+b.dataset.room));
$('#wave').onclick=()=>{waving=Date.now()+3000;toast('You waved hello');if(!personal)message('system','daydream waved to the room 👋')};$('#dance').onclick=()=>{dancing=!dancing;if(dancing){standUp();walker.stop();heldKeys.clear()}$('#dance').textContent=dancing?'✧ Stop dancing':'✧ Dance';toast(dancing?'Finding your groove…':'Taking a breather')};$('#saveRoom').onclick=()=>{liked=!liked;$('#likes').textContent=liked?25:24;toast(liked?'Room added to your favorites':'Room removed from favorites')};
function modal(html){heldKeys.clear();$('#modalBody').innerHTML=html;$('#modal').showModal()}$('#closeModal').onclick=()=>$('#modal').close();$('#modal').onclick=e=>{if(e.target===$('#modal'))$('#modal').close()};
function look(){modal('<div class="eyebrow">DRESS FOR YOUR FREQUENCY</div><h2>Who’s showing up tonight?</h2><p>Six looks. Find your favorite. Your avatar stays with you in every room.</p><div class="avatar-choices"></div><button class="primary" id="lookDone">That’s me ↗</button>');['Daydream','Soul','Violet','Static','Peach','Echo'].forEach((name,i)=>{let b=document.createElement('button');b.className='avatar-choice'+(spriteIndex===i?' chosen':'');b.setAttribute('aria-label','Choose '+name);b.innerHTML='<span class="avatar-option" style="background-position:'+(-i*70)+'px 0"></span><span>'+name+'</span>';b.onclick=()=>{spriteIndex=i;try{let data=JSON.parse(localStorage.getItem('afterhours')||'{}');data.avatar=i;localStorage.setItem('afterhours',JSON.stringify(data))}catch{}document.querySelectorAll('.avatar-choice').forEach(x=>x.classList.remove('chosen'));b.classList.add('chosen');$('.profile-art').style.backgroundPosition=(-i*35)+'px -4px'};$('.avatar-choices').append(b)});$('#lookDone').onclick=()=>{$('#modal').close();toast('Your look, your night.')}}
$('#profile').onclick=look;
$('#decorate').onclick=startEditing;
$('#help').onclick=()=>modal('<div class="eyebrow">WELCOME TO AFTERHOURS</div><h2>A slower corner of the internet.</h2><p>Click the floor to walk, or focus the room and use arrow keys. Click a chair or sofa to walk over and sit. Click the floor, use arrow keys, or choose Stand up to get up. Say hello using the chat bar. Wave, dance, visit a room, or make a beat in the Studio.</p><p style="margin-top:16px">In My room, choose Decorate to move furniture. Click or drag a piece to a green tile. R rotates, Esc cancels, and Undo restores the last change. Furniture opens your inventory and the shop. My look changes your avatar. Your wardrobe, room, and coins save in this browser.</p><p style="margin-top:16px">This is a single-player concept prototype with simulated guests and replies. Music is generated live in your browser. There are no purchases or real chat messages.</p>');
$('#friendsTab').onclick=()=>{$('#friendsTab').classList.add('selected');$('#roomTab').classList.remove('selected');$('#messages').replaceChildren();message('system','Your circle starts with a hello.');message('olive','Simulated guest · usually in the Greenhouse','#bec9aa');message('tomo','Simulated guest · making beats in the studio','#c5ccda')};$('#roomTab').onclick=()=>{$('#roomTab').classList.add('selected');$('#friendsTab').classList.remove('selected');populateChat()};
$('#allRooms').onclick=()=>{modal('<div class="eyebrow">FOLLOW YOUR CURIOSITY</div><h2>Somewhere to belong.</h2><p>Four rooms. Four different kinds of good company.</p><div id="directory"></div>');rooms.forEach((r,i)=>{let b=document.createElement('button');b.className='outline';b.textContent=`${r.icon} ${r.title} · ${r.count} people ↗`;b.onclick=()=>{enterRoom(i);$('#modal').close()};$('#directory').append(b)})};
// Original procedural music: no streaming dependencies or copyrighted tracks.
let ac,audio=false,timer=null,tick=0,startTime=0;const patterns=saved.patterns||[[1,0,0,0,1,0,0,0],[0,0,1,0,0,0,1,0],[1,0,1,1,1,0,1,0],[1,0,0,1,0,1,0,0]];let bpm=88;
function tone(f,type,dur,vol,when){let osc=ac.createOscillator(),g=ac.createGain();osc.type=type;osc.frequency.setValueAtTime(f,when);g.gain.setValueAtTime(vol,when);g.gain.exponentialRampToValueAtTime(.001,when+dur);osc.connect(g).connect(ac.destination);osc.start(when);osc.stop(when+dur)}
function drum(row,when){if(row===0){let o=ac.createOscillator(),g=ac.createGain();o.frequency.setValueAtTime(120,when);o.frequency.exponentialRampToValueAtTime(38,when+.15);g.gain.setValueAtTime(.20,when);g.gain.exponentialRampToValueAtTime(.001,when+.25);o.connect(g).connect(ac.destination);o.start(when);o.stop(when+.26)}else if(row<3){const len=ac.sampleRate*(row===1?.12:.035),buf=ac.createBuffer(1,len,ac.sampleRate),data=buf.getChannelData(0);for(let i=0;i<len;i++)data[i]=(Math.random()*2-1)*(1-i/len);let src=ac.createBufferSource(),g=ac.createGain(),filter=ac.createBiquadFilter();src.buffer=buf;filter.type='highpass';filter.frequency.value=row===1?1200:6500;g.gain.value=row===1?.10:.055;src.connect(filter).connect(g).connect(ac.destination);src.start(when)}else tone([220,261.63,329.63,392,329.63,261.63,293.66,246.94][tick%8],'sine',.5,.065,when)}
function schedule(){let step=tick%8,when=ac.currentTime+.015;patterns.forEach((p,row)=>{if(p[step])drum(row,when)});if(step===0){[130.81,164.81,196].forEach(f=>tone(f,'sine',1.8,.025,when))}document.querySelectorAll('.step').forEach(b=>b.classList.toggle('current',+b.dataset.col===step));tick++;let elapsed=Math.floor((Date.now()-startTime)/1000);$('#playTime').textContent=`${Math.floor(elapsed/60)}:${String(elapsed%60).padStart(2,'0')}`;$('.progress i').style.width=((tick%64)/64*100)+'%'}
async function toggleSound(){try{if(!ac)ac=new(window.AudioContext||window.webkitAudioContext)();await ac.resume();audio=!audio;document.body.classList.toggle('is-playing',audio);if(audio){startTime=Date.now();schedule();timer=setInterval(schedule,60000/bpm/2)}else{clearInterval(timer);document.querySelectorAll('.step').forEach(b=>b.classList.remove('current'))}$('#sound').textContent=audio?'♫ Sound on':'♫ Sound off';$('#play').textContent=audio?'Ⅱ':'▶';if($('#studioPlay'))$('#studioPlay').textContent=audio?'Ⅱ Pause loop':'▶ Play loop'}catch{toast('Audio is unavailable in this browser.')}}$('#sound').onclick=toggleSound;$('#play').onclick=toggleSound;
function studio(){modal('<div class="eyebrow">THE AFTERHOURS STUDIO</div><h2>Make something together.</h2><p>A tiny beat, a whole mood. Tap the steps, then play your original loop.</p><div id="sequencer"></div><div class="field-label"><label for="tempo">TEMPO <span id="bpmValue">88</span> BPM</label></div><input id="tempo" type="range" min="65" max="125" value="'+bpm+'" style="width:100%;margin-top:12px"><button class="primary" id="studioPlay">'+(audio?'Ⅱ Pause loop':'▶ Play loop')+'</button> <button class="primary" id="saveBeat">Save my beat</button><p style="margin-top:14px;font-size:10px">Synthesized in your browser · Saved locally · No streaming service required</p>');['KICK','SNARE','HI-HAT','MELODY'].forEach((name,row)=>{let l=document.createElement('div');l.className='field-label';l.textContent=name;let grid=document.createElement('div');grid.className='steps';patterns[row].forEach((v,col)=>{let b=document.createElement('button');b.className='step'+(v?' on':'');b.dataset.col=col;b.setAttribute('aria-label',`${name} step ${col+1}`);b.setAttribute('aria-pressed',!!v);b.onclick=()=>{patterns[row][col]=1-patterns[row][col];b.classList.toggle('on',!!patterns[row][col]);b.setAttribute('aria-pressed',!!patterns[row][col])};grid.append(b)});$('#sequencer').append(l,grid)});$('#bpmValue').textContent=bpm;$('#tempo').oninput=e=>{bpm=+e.target.value;$('#bpmValue').textContent=bpm;if(audio){clearInterval(timer);timer=setInterval(schedule,60000/bpm/2)}};$('#studioPlay').onclick=toggleSound;$('#saveBeat').onclick=()=>{try{let data=JSON.parse(localStorage.getItem('afterhours')||'{}');data.patterns=patterns;localStorage.setItem('afterhours',JSON.stringify(data))}catch{}$('#trackTitle').textContent='daydream’s B-side';$('#modal').close();toast('Your beat is saved. A little piece of you.')}}
$('#studioOpen').onclick=studio;document.querySelectorAll('[data-view]').forEach(b=>b.onclick=()=>{if(b.dataset.view==='look')look();else if(b.dataset.view==='studio')studio();else enterRoom(0,b.dataset.view==='room')});

document.addEventListener('keydown',e=>{if(!forRoom(e))return;if(e.target.matches('input,textarea')||$('#modal').open||editor.active)return;if(e.key==='Escape'&&seating.mode!=='standing'){standUp();return}if(e.key==='1')$('#wave').click();if(e.key==='2')$('#dance').click()});
