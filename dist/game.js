/* Afterhours: the local game. The optional session service adds real guests. */
(() => {
  'use strict';
  const G=AfterhoursGame, h=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const get=(id)=>document.getElementById(id),copy=G.clone;
  let loaded=null,loadError='',lastBackup=0;
  try{const raw=localStorage.getItem('afterhours-v5');if(raw)loaded=G.validate(JSON.parse(raw));}catch(e){loadError='Your game save could not be opened. The original has been kept for recovery.';}
  const game=new G.Game(loaded,{...saved,coins,decor},state=>{
    try{
      const serialized=JSON.stringify(state);
      const online=window.AfterhoursOnline?.connected();
      if(!online&&Date.now()-lastBackup>30000){const old=localStorage.getItem('afterhours-v5');if(old)localStorage.setItem('afterhours-v5-backup',old);lastBackup=Date.now();}
      localStorage.setItem(online?'afterhours-online-cache':'afterhours-v5',serialized);updateHUD();
    }catch{toast('Your browser could not save. Export a backup from your profile.');}
  });
  let activeRoomId=game.state.activeRoom,screen='',pendingUse=null,carried=null,cleanupGame=null;
  let draft=copy(game.state.draft),music=new AfterhoursMusic(),studioHistory=[],stage=null,stageTimer=null,lastHud=0;
  let interactionBounds=[],petPosition=null,petWalker=null,lastPetPath=0,petPoseUntil=0,petPose='';
  let newArt=new Image();newArt.src=(window.AfterhoursBase||'')+'assets/game-objects.webp';
  // The atlas geometry is finalized by the asset packaging pass.
  const newCrops=[[108,12,325,460],[514,17,317,463],[940,11,332,482],[1364,93,326,391],[80,446,363,415],[525,573,333,228],[926,490,338,356],[1374,519,332,335]];
  const room=()=>window.AfterhoursOnline?.remoteRoom()||game.state.rooms.find(r=>r.id===activeRoomId)||game.state.rooms[0];
  const roomKey=()=>window.AfterhoursOnline?.remoteRoom()?'shared:'+room().key:personal?'my:'+activeRoomId:'public:'+roomIndex;
  const legacyPersist=persist,legacyEnter=enterRoom,legacyWalk=walkTo,legacySeat=useSeat,legacyLook=look,legacyStand=standUp;
  function sync(){
    coins=game.state.coins;player.name=game.state.profile.name;player.chatColor=game.state.profile.chatColor;outfit=game.state.profile.outfit||null;paintPortrait($('.profile-art'));
    decor=window.AfterhoursOnline?.remoteRoom()?.items||game.state.items.filter(i=>i.placed===false||i.roomId===activeRoomId);
    updateHUD();
  }
  // Outfit wearers get a painted portrait; everyone else keeps the classic sprite strip.
  function paintPortrait(el){
    if(!el)return;const look=game.state.profile.outfit;el.classList.toggle('custom-avatar',!!look);
    let canvas=el.querySelector('canvas');if(!look){canvas?.remove();return;}
    if(!canvas){canvas=document.createElement('canvas');canvas.width=140;canvas.height=160;el.append(canvas);}
    AfterhoursAvatar.load().then(()=>AfterhoursAvatar.preview(canvas,look,'front',true));
  }
  function saveWorld(){
    if(window.AfterhoursOnline?.remoteRoom())return;
    const s=game.state,map=new Map(decor.map(i=>[i.id,i]));
    s.items=s.items.map(i=>map.has(i.id)?{...map.get(i.id),roomId:map.get(i.id).placed===false?null:activeRoomId}:i);
    for(const item of decor)if(!s.items.some(i=>i.id===item.id))s.items.push({...item,roomId:item.placed===false?null:activeRoomId});
    s.coins=coins;s.activeRoom=activeRoomId;s.profile.avatar=spriteIndex;
  }
  persist=function(){if(window.AfterhoursOnline?.remoteRoom()){toast('Only the room owner can move these pieces.');return;}saveWorld();legacyPersist();game.save();window.AfterhoursOnline?.saveLayout();};
  // Asks the hosting app to open one of its own panels (the Uno app draws these in XAML). The game's own
  // dialog closes first: it sits in the browser's top layer and would cover the app's panel.
  const openPanel=(route,data={})=>{close();window.AfterhoursHost?.open(route,data);};
  function act(type,payload={},success){
    if((type==='buy'||type==='room')&&!payload.id)payload.id=G.uid();
    try{saveWorld();const result=game.dispatch(type,payload);sync();if(success)toast(typeof success==='function'?success(result):success);return {ok:true,result};}
    catch(e){notifyError(e.message);return {ok:false,error:e.message};}
  }
  function notifyError(text){
    const el=get('panelError');if(el){el.textContent=text;el.hidden=false;}else toast(text);
  }
  function panel(title,kicker,body,wide=false){
    screen=title;get('modal').classList.remove('catalog-modal');get('modal').classList.toggle('wide',wide);
    modal(`<div class="eyebrow">${h(kicker)}</div><h2>${h(title)}</h2><p id="panelError" class="panel-error" role="alert" hidden></p>${body}`);
  }
  function close(){get('modal').close();}
  get('modal').addEventListener('close',()=>{screen='';get('modal').classList.remove('wide');if(cleanupGame){cleanupGame();cleanupGame=null;}});
  function button(id,fn){const b=get(id);if(b)b.onclick=fn;}
  function buttons(selector,fn){get('modalBody').querySelectorAll(selector).forEach(b=>b.onclick=()=>fn(b));}
  const credit=amount=>`${amount} <span class="credit-symbol">✦</span>`;
  function updateHUD(){
    if(!get('profileName'))return;
    const s=game.state,l=G.level(s);get('coins').textContent=s.coins;get('profileName').textContent=s.profile.name;get('profileLevel').textContent='LEVEL '+String(l).padStart(2,'0');
    get('residentLevel').textContent='LEVEL '+String(l).padStart(2,'0');get('residentXp').textContent=s.profile.xp+' XP';
    const lower=(l-1)**2*100,upper=l*l*100;get('xpFill').style.width=((s.profile.xp-lower)/(upper-lower)*100)+'%';
    const available=G.quests.filter(q=>!s.claimed.includes(q.id)&&G.progress(s,q)>=q.target).length;
    get('questCount').textContent=available||'';get('questCount').hidden=!available;
    const next=G.quests.find(q=>!s.claimed.includes(q.id));get('nextQuest').textContent=next?next.name:'The night is yours';
    get('nextQuestDetail').textContent=next?`${Math.min(next.target,G.progress(s,next))} / ${next.target} · ${next.reward} credits`:'Make a track. Build a room. Meet someone.';
    get('dailyClaim').textContent=s.lastCheckin===G.day()?'Checked in ✓':'Daily gift · 35 ✦';
    get('dailyClaim').disabled=s.lastCheckin===G.day();
  }
  // Keep the room visible while tools live in focused, accessible panels.
  get('profile').innerHTML='<span class="profile-art"></span><span><b id="profileName"></b><small id="profileLevel"></small></span><span class="chevron">⌄</span>';
  $('.profile-art').style.backgroundPosition=(-spriteIndex*35)+'px -4px';
  $('.prototype-label').innerHTML='<i></i> <span id="connectionLabel">SOLO WORLD</span>';
  $('.brand sup').textContent='PLAY';
  $('footer>span').textContent='Saved on this device · Resident characters are NPCs';
  $('.chat-fineprint>span').textContent='RESIDENT CHAT';
  $('.club-pass').innerHTML='<div class="resident-stats"><b id="residentLevel"></b><span id="residentXp"></span></div><div class="xp-meter"><i id="xpFill"></i></div><b id="nextQuest"></b><small id="nextQuestDetail"></small><button id="dailyClaim"></button>';
  const nav=document.querySelector('.rail nav');
  const questNav=document.createElement('button');questNav.className='nav';questNav.id='questsOpen';questNav.innerHTML='<svg><use href="#i-grid"/></svg>Journal <span id="questCount" class="reward-count" hidden></span>';nav.append(questNav);
  const arcadeNav=document.createElement('button');arcadeNav.className='nav';arcadeNav.id='arcadeOpen';arcadeNav.innerHTML='<svg><use href="#i-world"/></svg>Arcade';nav.append(arcadeNav);
  const dock=document.createElement('div');dock.className='game-dock';dock.innerHTML='<button id="stageOpen"><span>♫</span>Stage</button><button id="catalogOpen"><span>▧</span>Catalog</button><button id="myRoomsOpen"><span>⌂</span>My rooms</button><button id="petOpen"><span>♧</span>Companion</button><button id="roomTools"><span>⚙</span>Room tools</button>';
  $('.action-bar').append(dock);
  const quickShop=document.createElement('button');quickShop.className='top-tool';quickShop.id='quickCatalog';quickShop.textContent='▧ Furniture shop';$('.topbar .account').before(quickShop);button('quickCatalog',()=>catalog());
  const musicToggle=document.createElement('button');musicToggle.className='top-tool';musicToggle.textContent='♫ Music';musicToggle.setAttribute('aria-expanded','false');quickShop.before(musicToggle);musicToggle.onclick=()=>{const open=document.body.classList.toggle('music-panel-open');musicToggle.setAttribute('aria-expanded',String(open));};
  const activity=document.createElement('div');activity.id='activityCard';activity.className='activity-card';activity.hidden=true;$('.scene-card').before(activity);
  button('dailyClaim',()=>{if(act('checkin',{},'35 credits and 15 XP. Welcome back.').ok)journal();});
  button('questsOpen',()=>journal());button('arcadeOpen',arcade);button('stageOpen',stagePanel);button('catalogOpen',()=>catalog());button('myRoomsOpen',()=>directory('mine'));button('petOpen',petPanel);button('roomTools',roomTools);
  button('profile',profile);button('allRooms',()=>openNavigator());button('saveRoom',()=>{
    act('favorite',{id:roomKey()});syncFavorite();
  });
  function openNavigator(){directory('all');}
  const journey=document.createElement('nav');journey.className='room-journey';journey.setAttribute('aria-label','Travel to another space');
  journey.innerHTML=rooms.map((r,i)=>`<button class="travel-stop" data-travel="${i}"><span>${r.icon}</span><b>${h(r.title)}</b><small>${i===0?'Listening lounge':i===1?'Cafe & conversation':i===2?'Quiet company':'Above the city'}</small></button>`).join('')+'<button class="travel-home" id="travelHome"><span>⌂</span><b>My room</b></button><button class="travel-more" id="travelMore" aria-label="Explore all rooms">All rooms ↗</button>';
  $('.scene-card').before(journey);
  journey.querySelectorAll('[data-travel]').forEach(b=>b.onclick=()=>enterRoom(+b.dataset.travel));
  button('travelHome',()=>window.AfterhoursOnline?.connected()?window.AfterhoursOnline.visitOwnRoom(activeRoomId):visitRoom(activeRoomId));button('travelMore',openNavigator);
  const chatToggle=document.createElement('button');chatToggle.id='chatHistory';chatToggle.className='soft-button';chatToggle.textContent='Chat history';chatToggle.setAttribute('aria-expanded','false');
  $('.action-bar').append(chatToggle);chatToggle.onclick=()=>{const open=document.body.classList.toggle('chat-history-open');chatToggle.setAttribute('aria-expanded',String(open));chatToggle.textContent=open?'Close history':'Chat history';};
  const composer=$('.chat-footer');composer.classList.add('room-composer');$('.action-bar').before(composer);
  $('.rail').querySelectorAll('button').forEach(b=>{if(!b.title)b.title=b.textContent.trim();if(!b.getAttribute('aria-label'))b.setAttribute('aria-label',b.title);});
  let lastJourney='';
  function updateJourney(){const key=roomKey();if(key===lastJourney)return;lastJourney=key;journey.querySelectorAll('[data-travel]').forEach(b=>{const active=!personal&&+b.dataset.travel===roomIndex;b.classList.toggle('selected',active);b.disabled=active;b.setAttribute('aria-current',active?'location':'false');});get('travelHome').classList.toggle('selected',personal&&!window.AfterhoursOnline?.remoteRoom());}
  function syncFavorite(){liked=game.state.favorites.includes(roomKey());get('likes').textContent=liked?'Saved':'Save';get('saveRoom').classList.toggle('is-saved',liked);}
  enterRoom=function(index,mine=false){
    pendingUse=null;if(personal)saveWorld();
    sync();legacyEnter(index,mine);
    if(mine){get('roomTitle').textContent=room().name;get('roomMeta').textContent=`by ${player.name} · ${room().description||'Your personal room'}`;}
    else{
      game.event('visited',index);$('.people-strip small').textContent=(rooms[index].count-1)+' residents + you';
      get('roomMeta').textContent=`${rooms[index].mood} · resident hangout`;
    }
    const key=roomKey();game.state.history=[key,...game.state.history.filter(k=>k!==key)].slice(0,20);game.save();syncFavorite();runRules('enter');resetPet();
  };
  function visitRoom(id){if(personal)saveWorld();activeRoomId=id;game.state.activeRoom=id;sync();enterRoom(0,true);close();}
  document.querySelectorAll('[data-view]').forEach(b=>b.onclick=()=>{
    if(b.dataset.view==='look')look();else if(b.dataset.view==='studio')studio();else if(b.dataset.view==='room')visitRoom(activeRoomId);else enterRoom(0,false);
  });
  document.querySelectorAll('[data-room]').forEach(b=>b.onclick=()=>enterRoom(+b.dataset.room));
  walkTo=function(point){pendingUse=null;return legacyWalk(point);};
  useSeat=function(offers){pendingUse=null;return legacySeat(offers);};
  standUp=function(animate=true){return legacyStand(animate);};
  const legacyPlace=placeGhost;
  placeGhost=function(){const success=legacyPlace();if(success)game.event('builds');return success;};
  function journal(tab='quests'){openPanel('Journal',{tab});}
  // The journal as data for the hosting app, from the game's own progress rules.
  function journalState(){
    const s=game.state;
    return {
      quests:G.quests.map(q=>{const value=Math.min(q.target,G.progress(s,q));return {id:q.id,name:q.name,description:q.description,value,target:q.target,xp:q.xp,reward:q.reward,claimed:s.claimed.includes(q.id)};}),
      badges:G.achievements.map(a=>({id:a.id,name:a.name,description:a.description,icon:a.icon,value:Math.min(a.target,G.progress(s,a)),target:a.target,unlocked:s.profile.badges.includes(a.id)})),
      coins:s.coins,ledger:s.ledger.map(e=>({reason:e.reason,date:new Date(e.date).toLocaleDateString(),amount:e.amount}))};
  }
  function claimQuest(id){const out=act('quest',{id},'Reward collected.');return {ok:out.ok,error:out.error,result:journalState()};}
  function profile(){openPanel('Profile');}
  // The profile as data for the hosting app; restoring a save is inspected first and confirmed after.
  let pendingRestore=null;
  const colourNames=['Cherry','Rose','Violet','Cobalt','Teal','Moss','Ember','Ink'];
  function profileState(){
    const s=game.state;
    return {name:s.profile.name,motto:s.profile.motto,chatColor:s.profile.chatColor,level:G.level(s),xp:s.profile.xp,joined:new Date(s.profile.joined).toLocaleDateString(),
      badges:s.profile.badges.map(id=>{const a=G.achievements.find(x=>x.id===id);return {icon:a?.icon||'★',name:a?.name||id};}),
      colors:G.chatColors.map((hex,i)=>({hex,name:colourNames[i]}))};
  }
  function saveProfile(name,motto,chatColor){
    const out=act('profile',{name,motto,chatColor},'Profile saved.');
    if(out.ok){player.name=game.state.profile.name;player.chatColor=game.state.profile.chatColor;}
    return {ok:out.ok,error:out.error,result:profileState()};
  }
  function exportSave(){saveWorld();download(new Blob([JSON.stringify(game.state,null,2)],{type:'application/json'}),'afterhours-save.json');return {ok:true};}
  function inspectSave(text){
    try{if(text.length>5000000)throw Error('Choose an Afterhours save smaller than 5 MB.');pendingRestore=G.validate(JSON.parse(text));
      return {ok:true,result:{title:'Restore this world?',message:`This save belongs to ${pendingRestore.profile.name} and contains ${pendingRestore.rooms.length} rooms, ${pendingRestore.items.length} furniture pieces, and ${pendingRestore.songs.length} songs. Your current world will be kept as a backup.`,action:'Restore saved world'}};}
    catch(e){pendingRestore=null;return {ok:false,error:e instanceof SyntaxError?'This is not a valid Afterhours save.':e.message};}
  }
  function inspectBackup(){
    try{const backup=localStorage.getItem('afterhours-v5-backup');if(!backup)throw Error('No previous backup is available yet.');pendingRestore=G.validate(JSON.parse(backup));
      return {ok:true,result:{title:'Recover your last backup',message:`Restore ${pendingRestore.profile.name}’s previous world with ${pendingRestore.coins} credits and ${pendingRestore.songs.length} songs?`,action:'Restore backup'}};}
    catch(e){pendingRestore=null;return {ok:false,error:e.message};}
  }
  function confirmRestore(){if(!pendingRestore)return {ok:false,error:'Choose a save first.'};const next=pendingRestore;pendingRestore=null;restoreSave(next);return {ok:true};}
  function restoreSave(next){localStorage.setItem('afterhours-v5-backup',JSON.stringify(game.state));game.state=next;activeRoomId=next.activeRoom;spriteIndex=next.profile.avatar||0;game.save();sync();draft=copy(next.draft);resetPet();visitRoom(activeRoomId);toast('Your world is restored.');}
  function download(blob,name){const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),5000);}
    function classicLook(){
    legacyLook();get('modal').classList.remove('wide');
    get('lookDone').onclick=()=>{if(game.state.profile.outfit)act('outfit',{outfit:null});game.state.profile.avatar=spriteIndex;game.save();sync();close();toast('Look saved.');};
  }
  // The wardrobe: start from one of the six classic looks, then change hair, top, bottoms, colours and skin.
  look=function(){openPanel('Wardrobe');};
  // The wardrobe as data for the hosting app: the options, the current outfit and a rendered preview.
  function wardrobeState(){
    const W=AfterhoursWardrobe,pairs=list=>list.map(([id,name,hex])=>({id,name,hex:hex||''}));
    return {presets:['Daydream','Soul','Violet','Static','Peach','Echo'],hair:pairs(W.hair),tops:pairs(W.tops),bottoms:pairs(W.bottoms),
      colors:pairs(W.colors),hairColors:pairs(W.hairColors),skinColors:pairs(W.skinColors),
      outfit:W.normalize(game.state.profile.outfit)||W.fromLegacy(spriteIndex),preset:spriteIndex};
  }
  const presetOutfit=i=>AfterhoursWardrobe.fromLegacy(i);
  async function outfitPreview(outfit,pose,portrait=false){
    await AfterhoursAvatar.load();const canvas=document.createElement('canvas');canvas.width=portrait?140:250;canvas.height=portrait?160:340;
    AfterhoursAvatar.preview(canvas,AfterhoursWardrobe.normalize(outfit)||AfterhoursWardrobe.fromLegacy(spriteIndex),pose,portrait);return canvas.toDataURL('image/png');
  }
  function saveLook(outfit,preset){
    const out=act('outfit',{outfit},'Look saved.');
    if(out.ok){spriteIndex=preset;game.state.profile.avatar=preset;game.save();sync();}
    return {ok:out.ok,error:out.error};
  }
  function directory(filter='all'){openPanel('Rooms',{filter});}
  // Rooms as data for the hosting app: public hangouts and your rooms, or the shared navigator when connected.
  function roomsState(){
    if(window.AfterhoursOnline?.connected())return window.AfterhoursOnline.roomsState();
    const s=game.state;
    return {shared:false,favorites:s.favorites,history:s.history,
      entries:rooms.map((r,i)=>({key:'public:'+i,name:r.title,description:r.mood,kind:'public'})).concat(s.rooms.map(r=>({key:'my:'+r.id,name:r.name,description:r.description,kind:'mine'})))};
  }
  async function goToRoom(key){
    if(window.AfterhoursOnline?.connected())return window.AfterhoursOnline.joinRoomKey(key);
    if(key.startsWith('my:'))visitRoom(key.slice(3));else enterRoom(+key.slice(7));
    return {ok:true};
  }
  function createRoom(name,description,tags){const out=act('room',{name,description,tags});if(out.ok)visitRoom(out.result.id);return {ok:out.ok,error:out.error};}
  function artCard(type){
    const {crop,image:art}=furnitureArt(type),cv=document.createElement('canvas');cv.width=320;cv.height=250;cv.setAttribute('aria-hidden','true');
    const paint=()=>{const scale=Math.min(288/crop[2],222/crop[3]);cv.getContext('2d').drawImage(art,...crop,(320-crop[2]*scale)/2,238-crop[3]*scale,crop[2]*scale,crop[3]*scale);};
    if(art.complete&&art.naturalWidth)paint();else art.addEventListener('load',paint,{once:true});return cv;
  }
  const category=type=>Furniture.catalog[type].category||(['sofa','seat','table'].includes(type)?'lounge':['decks','speaker','records','jukebox'].includes(type)?'music':['vending','portal','dice','notice','bowl','gift'].includes(type)?'interactive':'decor');
  const collections=[['all','All collections','A room that feels like you'],['loft','Soft loft','Warm wood. Soft edges. Slow evenings.'],['diner','Midnight diner','Coffee and company, all night long.'],['studio','Sound studio','Find your sound. Make some noise.'],['arcade','Arcade nights','One more game before we go.'],['garden','Secret garden','Make a little room to breathe.'],['fantasy','Starlit fantasy','Moonlight, crystal, and a little magic.'],['den','After-hours den','Leather, chrome, and the good speakers.'],['originals','Afterhours originals','The pieces that started the night.']];
  // The furniture shop, inventory and records are XAML panels in the Uno app.
  function catalog(tab='shop'){openPanel('Catalog',{tab});}
  const descriptions={
    sofa:'Two seats for long conversations.',seat:'A little corner for a quiet moment.',table:'A warm glow and a place to gather.',decks:'Open the studio, make a track, and take it to the stage.',
    speaker:'Play a song from your library in your room.',records:'Your collection of original music discs.',plant:'A little green. Water it and watch it glow.',lamp:'Switch the light on or off. Set the mood.',
    jukebox:'Build a room playlist from your own songs.',vending:'Walk over, grab a soda, and enjoy it. Refills cost 2 credits.',portal:'Link this portal to one of your rooms.',dice:'Roll a six-sided die for your own room games.',notice:'Leave a note for your room.',bowl:'Feed and care for your companion.',gift:'Wrap an owned piece with a personal note, then open it to reveal the surprise.'
  };
  // Takes an owned piece to its room (or your room) and selects it for placement.
  async function placeItem(id){
    const owned=game.state.items.find(i=>i.id===id);if(!owned)return false;
    const destination=owned.placed!==false?owned.roomId:activeRoomId;
    if(window.AfterhoursOnline?.connected()){
      if(!await window.AfterhoursOnline.visitOwnRoom(destination))return false;
    }else if(owned.placed!==false&&owned.roomId!==activeRoomId)visitRoom(owned.roomId);else if(!personal)visitRoom(activeRoomId);
    sync();startEditing();close();selectFurniture(owned.id);toast('Choose a clear tile. R rotates; Esc cancels.');return true;
  }
  // Interacts with an owned piece where it stands.
  function useItem(id){
    const item=game.state.items.find(i=>i.id===id);if(!item)return {ok:false,error:'That piece is no longer in your collection.'};
    if(item.placed===false)return {ok:false,error:'Place this piece in a room first.'};
    if(item.roomId!==activeRoomId||!personal)visitRoom(item.roomId);openObject(game.state.items.find(i=>i.id===id));return {ok:true};
  }
  showInventory=()=>catalog('owned');button('openInventory',showInventory);
  function roomTools(){
    if(window.AfterhoursOnline?.remoteRoom()){toast('Only the owner can change this room.');return;}
    openPanel('RoomTools');
  }
  // The current room as data for its tools (settings, notes, rules, event) and portals.
  function roomState(){
    const r=room();
    return {personal,id:r.id,name:r.name,description:r.description||'',tags:r.tags||'',lighting:r.lighting||'amber',door:r.door||'open',
      notes:(r.notes||[]).map(n=>({id:n.id,text:n.text,name:n.name})),rules:(r.rules||[]).map(x=>({id:x.id,trigger:x.trigger,effect:x.effect,phrase:x.phrase||'',message:x.message||''})),
      event:r.event?{name:r.event.name,start:r.event.start}:null,
      otherRooms:game.state.rooms.filter(x=>x.id!==activeRoomId).map(x=>({id:x.id,name:x.name}))};
  }
  const roomPanels={blueprints:()=>blueprints(),rules:()=>rulesPanel(),notes:()=>notesPanel(),playlist:()=>playlistPanel(),event:()=>eventPanel(),home:()=>visitRoom(activeRoomId)};
  function saveRoomSettings(name,description,tags,lighting,door){
    const out=act('roomSettings',{id:room().id,name,description,tags,lighting,door},'Room settings saved.');
    if(out.ok)get('roomTitle').textContent=room().name;return {ok:out.ok,error:out.error};
  }
  function blueprints(){openPanel('Blueprints');}
  function saveBlueprint(){return act('blueprint',{room:activeRoomId,name:room().name},'Blueprint saved.');}
  function restoreBlueprint(id){
    const bp=game.state.blueprints.find(x=>x.id===id),out=act('restoreBlueprint',{id},'Layout restored.');
    if(out.ok&&bp)visitRoom(bp.room);return out;
  }
  function notesPanel(){openPanel('MessageBoard');}
  function addNote(text){return act('note',{room:activeRoomId,text});}
  function deleteNote(id){return act('deleteNote',{room:activeRoomId,id});}
  function rulesPanel(){openPanel('RoomLogic');}
  function addRule(trigger,effect,phrase,message){
    const r=room();r.rules||=[];
    if(r.rules.length>=10)return {ok:false,error:'This room can have ten rules.'};
    if(!['enter','say','sit','dice'].includes(trigger)||!['lights','message','music'].includes(effect))return {ok:false,error:'Choose a trigger and an effect.'};
    r.rules.push({id:G.uid(),trigger,effect,phrase:String(phrase).toLowerCase().trim(),message:String(message).slice(0,120)});game.save();return {ok:true};
  }
  function deleteRule(id){const r=room();r.rules=(r.rules||[]).filter(x=>x.id!==id);game.save();return {ok:true};}
  function runRules(trigger,value=''){
    if(!personal)return;
    for(const rule of room().rules||[]){
      if(rule.trigger!==trigger||trigger==='say'&&rule.phrase!==value.toLowerCase().trim())continue;
      if(rule.effect==='lights'){room().lighting=room().lighting==='moonlight'?'amber':'moonlight';game.save();}
      if(rule.effect==='message')message('system',rule.message||'Welcome to '+room().name);
      if(rule.effect==='music')startPlaylist();
    }
  }
  function eventPanel(){openPanel('RoomEvent');}
  function hostEvent(name,delay){
    const r=room();r.event={name:String(name).trim().slice(0,60)||'Listening party',start:Date.now()+Number(delay)*60000};game.save();
    message('system',player.name+' is hosting '+r.event.name);return {ok:true};
  }
  function endEvent(){room().event=null;game.save();return {ok:true};}
  function playlistPanel(){openPanel('Jukebox');}
  function savePlaylist(ids){const r=room(),known=new Set(game.state.songs.map(t=>t.id));r.playlist=ids.filter(id=>known.has(id));game.save();return {ok:true};}
  let playlistTimer=null;
  function startPlaylist(){
    const list=room().playlist.map(id=>game.state.songs.find(s=>s.id===id)).filter(Boolean);
    if(!list.length){toast('Add a song to this room’s playlist first.');return;}
    let index=0;clearTimeout(playlistTimer);
    const next=()=>{playSong(list[index%list.length]);const duration=list[index%list.length].length*60/list[index%list.length].bpm/4*4*1000;index++;playlistTimer=setTimeout(next,duration);};next();toast('Room playlist is playing.');
  }
  function rememberStudio(){studioHistory.push(copy(draft));if(studioHistory.length>40)studioHistory.shift();}
  function saveDraft(){game.state.draft=copy(draft);game.save();if(music.running&&!stage)music.update(draft);}
  studio=function(tab='editor'){openPanel('Studio',{tab});};
  // The studio as edits for the hosting app's studio: each changes the draft the way the old buttons did and
  // replies with the whole draft, so the app never waits on a save echo.
  const lane=r=>{if(!(r>=0&&r<4))throw Error('Unknown lane.');return r;};
  const studioOps={
    get:()=>{},
    step:(r,c)=>{lane(r);if(!(c>=0&&c<draft.length))throw Error('Unknown step.');rememberStudio();draft.pattern[r][c]=1-draft.pattern[r][c];},
    mute:r=>{lane(r);rememberStudio();draft.muted[r]=!draft.muted[r];},
    solo:r=>{lane(r);rememberStudio();const solo=draft.muted.every((v,i)=>v===(i!==r));draft.muted=draft.muted.map((_,i)=>solo?false:i!==r);},
    volume:(r,v)=>{draft.volumes[lane(r)]=Math.max(0,Math.min(1,+v||0));},
    tempo:bpm=>{draft.bpm=Math.max(60,Math.min(160,Math.round(+bpm)||draft.bpm));},
    length:n=>{if(n!==16&&n!==32)throw Error('Choose 16 or 32 steps.');rememberStudio();draft.length=n;draft.pattern=G.pattern(draft.pattern,n);},
    pack:p=>{if(!['velvet','club','arcade'].includes(p))throw Error('Unknown sound pack.');rememberStudio();draft.pack=p;},
    title:t=>{draft.title=String(t).slice(0,48);},
    undo:()=>{if(studioHistory.length)draft=studioHistory.pop();},
    clear:()=>{rememberStudio();draft.pattern=Array.from({length:4},()=>Array(draft.length).fill(0));},
    new:()=>{rememberStudio();draft=G.song({pattern:G.starterPattern,title:'Untitled afterhours'});},
    edit:id=>{const track=game.state.songs.find(t=>t.id===id);if(!track)throw Error('This track is no longer in your library.');draft=copy(track);studioHistory=[];},
    save:title=>{if(title!=null)draft.title=String(title).slice(0,48);const out=act('song',draft,'Track saved to your library.');if(!out.ok)throw Error(out.error);draft=copy(out.result);}
  };
  function studioEdit(op,a,b){
    const reply=(ok,error)=>({ok,error,result:{draft:copy(draft),canUndo:studioHistory.length>0}});
    try{if(!studioOps[op])throw Error('Unknown studio edit.');studioOps[op](a,b);if(op!=='get')saveDraft();return reply(true,null);}
    catch(e){return reply(false,e.message);}
  }
  function playTrack(id){const track=id?game.state.songs.find(t=>t.id===id):draft;if(!track)return false;if(music.running&&!id)stopMusic();else playSong(track);return true;}
  async function exportWav(){
    try{const blob=await music.wav(draft);download(blob,(draft.title||'afterhours').replace(/[^a-z0-9 -]/gi,'').slice(0,48)+'.wav');toast('Your original track is ready.');return {ok:true};}
    catch{notifyError('Audio export is unavailable in this browser.');return {ok:false,error:'Audio export is unavailable in this browser.'};}
  }
  async function playSong(track){
    if(stage&&stage.song.id!==track.id){toast('Leave the stage before changing the track.');return;}
    try{
      clearInterval(timer);audio=false;
      await music.play(track,index=>{
        playback(track,index);
        $('.progress i').style.width=((index+1)/track.length*100)+'%';
        const elapsed=Math.floor((Date.now()-music.started)/1000);get('playTime').textContent=Math.floor(elapsed/60)+':'+String(elapsed%60).padStart(2,'0');
      });
      get('trackTitle').textContent=track.title;$('.track p').textContent=game.state.profile.name+' · '+track.pack;document.body.classList.add('is-playing');syncAudioControls();
    }catch{toast('Your browser could not start audio. Try the Play button again.');}
  }
  function stopMusic(){music.stop();clearTimeout(playlistTimer);document.body.classList.remove('is-playing');syncAudioControls();}
  // Tells the hosting app what is playing and which step sounds (it draws the studio playhead).
  function playback(track,step){window.AfterhoursHost?.notify?.('playback',{running:music.running,title:track?.title||'',step});}
  function syncAudioControls(){get('sound').textContent=music.running?'♫ Sound on':'♫ Sound off';get('play').textContent=music.running?'Ⅱ':'▶';playback(music.song,-1);}
  toggleSound=()=>music.running?stopMusic():playSong(draft);
  button('sound',toggleSound);button('play',toggleSound);button('studioOpen',()=>studio());
  function stagePanel(){openPanel('Stage');}
  // The stage as data for the hosting app: solo here, shared from the online client. lastSet is the finished set
  // the stage shows until you queue again or go back to the stage.
  let lastSet=null,stageWatched=false;
  function stageState(){
    if(window.AfterhoursOnline?.connected())return window.AfterhoursOnline.stageState();
    const now=Date.now(),songs=game.state.songs.map(t=>({id:t.id,title:t.title,detail:t.bpm+' BPM · '+t.pack}));
    const current=stage&&{title:stage.song.title,artist:player.name,phase:stage.started?'ON STAGE':'YOU’RE NEXT',
      remaining:Math.max(0,Math.ceil((stage.end-now)/1000)),progress:stage.started?Math.min(1,Math.round((now-stage.started)/200)/100):0,applause:stage.applause,started:!!stage.started};
    return {mode:'solo',current,queue:[],own:!!stage,performing:!!stage?.started,canApplaud:false,applauded:false,listening:false,songs,chart:null,complete:stage?null:lastSet,
      note:'Solo world: the audience is made up of resident characters. Shared sessions show real players separately.'};
  }
  const stageOps={
    queue:id=>queueSong(id,false),leave:()=>window.AfterhoursOnline?.connected()?window.AfterhoursOnline.leaveStage():cancelStage(),
    applaud:()=>window.AfterhoursOnline?.applaud(),listen:()=>window.AfterhoursOnline?.toggleListen(),dismiss:()=>{lastSet=null;},
    chart:()=>window.AfterhoursOnline?.chartPanel(),open:()=>stagePanel(),
    watch:on=>{stageWatched=!!on;}
  };
  function queueSong(id,show=true){
    if(window.AfterhoursOnline?.connected())return window.AfterhoursOnline.queueSong(id,show);
    if(stage){toast('You are already in the stage queue.');if(show)stagePanel();return;}
    const song=game.state.songs.find(t=>t.id===id);if(!song)return;
    if(personal||roomIndex!==0)enterRoom(0,false);
    stage={id:G.uid(),song:copy(song),queued:Date.now(),started:0,end:Date.now()+4000,applause:0};music.ensure().catch(()=>{});
    lastSet=null;stopMusic();message('system',player.name+' joined the stage queue with “'+song.title+'”.');if(show)stagePanel();
    stageTimer=setInterval(tickStage,200);
  }
  function tickStage(){
    if(!stage)return;
    const now=Date.now();
    if(!stage.started&&now>=stage.end){
      stage.started=now;stage.end=now+20000;
      playSong(stage.song);message('system',player.name+' is now performing “'+stage.song.title+'”.');
    }
    if(stage.started){
      const elapsed=now-stage.started,count=Math.min(4,Math.floor(elapsed/4200));
      if(count>stage.applause){stage.applause=count;const p=people[count-1];message(p.name,['this groove has a home here ♡','love the space in this one','saved you a spot on the dancefloor','play that again sometime'][count-1]);}
      if(now>=stage.end){
        const completed=stage;stage=null;clearInterval(stageTimer);stopMusic();
        const out=act('performance',{id:completed.id,songId:completed.song.id,elapsed:now-completed.started});
        message('system','Set complete. '+(out.ok&&out.result?'You earned '+out.result+' credits.':'Thanks for playing.'));
        lastSet={credits:out.ok&&out.result?out.result:0,title:completed.song.title,applause:completed.applause};
        if(!stageWatched)stagePanel();return;
      }
    }
  }
  function cancelStage(){if(!stage)return;clearInterval(stageTimer);stage=null;stopMusic();toast('You left the stage. Your song is still saved.');}
  function stageAct(op,id){if(!stageOps[op])return {ok:false,error:'Unknown stage action.'};stageOps[op](id);return {ok:true};}
  // The arcade picker is a XAML panel; a round and its results stay game panels (they draw into the page).
  const arcadeCards=[['tiles','Tile Rush','Claim the floor. Keep more tiles than your rival.','45 seconds · keyboard or tap','▦'],['snow','Snow Jam','Dodge, aim, and land five snowball hits.','45 seconds · move + click','✧'],['quiz','Pop Quiz','Eight music questions. How well do you know your sound?','60 seconds · choose an answer','?']];
  function arcade(){openPanel('Arcade');}
  function arcadeState(){return {games:arcadeCards.map(([id,title,description,instructions,icon])=>({id,title,description,instructions,icon,best:game.state.best[id]||0}))};}
  function startArcade(kind){
    const titles={tiles:'Tile Rush',snow:'Snow Jam',quiz:'Pop Quiz'},id=G.uid();
    window.AfterhoursOnline?.arcadeStart(kind,id);
    panel(titles[kind],'AFTERHOURS ARCADE','<div id="arcadeHost"></div>',true);
    cleanupGame=AfterhoursArcade.start(kind,get('arcadeHost'),result=>{
      cleanupGame=null;
      const out=act('game',{...result,id});
      panel(result.won?'That’s your game.':'One more round?','ARCADE RESULTS',`<div class="reward-hero"><span>${result.won?'★':'◇'}</span><h3>${h(result.detail)}</h3><p>${out.ok&&out.result?'+'+out.result+' credits · +20 XP':'Personal best saved. Daily rewards may be complete.'}</p></div><div class="button-row"><button class="primary" id="replayArcade">Play again</button><button class="soft-button" id="returnArcade">Back to arcade</button><button class="soft-button" id="arcadeJournal">Journal</button></div>`);
      button('replayArcade',()=>startArcade(kind));button('returnArcade',arcade);button('arcadeJournal',()=>journal());
    });
  }
  function resetPet(){
    if(!game.state.pet){petPosition=null;petWalker=null;return;}
    const nav=navigationOptions(),spawn=AfterhoursMovement.route(player,{x:player.x+1,y:player.y},nav)?.goal||{x:player.x,y:player.y};
    petPosition={...spawn,name:game.state.pet.name};petWalker=new AfterhoursMovement.Walker(petPosition,navigationOptions);petWalker.maxSpeed=2.2;
  }
  function petPanel(){openPanel('Companion');}
  // The companion as data: none yet (adopt), or its needs, training and tricks.
  function petState(){
    const p=game.state.pet;if(!p)return {pet:null};
    const n=G.needs(p);
    return {pet:{name:p.name,hunger:Math.round(n.hunger),happiness:Math.round(n.happiness),energy:Math.round(n.energy),following:!!p.following,xp:p.xp,tricks:p.tricks.slice()}};
  }
  function adoptPet(name){const out=act('adopt',{name},'Your new companion is here.');if(out.ok)resetPet();return {ok:out.ok,error:out.error};}
  function petAction(action){
    const p=game.state.pet;if(!p)return {ok:false,error:'Adopt a companion first.'};
    if(action==='follow'){p.following=!p.following;game.save();return {ok:true};}
    if(action==='sit'||action==='spin'){if(!p.tricks.includes(action))return {ok:false,error:'Train a little more first.'};petPose=action;petPoseUntil=performance.now()+3500;toast(p.name+' does '+action+'.');return {ok:true};}
    const out=act('pet',{action},p.name+' enjoyed that.');
    if(out.ok){petPose=action==='play'?'spin':'sit';petPoseUntil=performance.now()+2200;}return {ok:out.ok,error:out.error};
  }
  function petPortrait(){
    const cv=document.createElement('canvas');cv.width=230;cv.height=160;
    if(newArt.complete&&newArt.naturalWidth){const c=newCrops[6],scale=Math.min(140/c[2],145/c[3]);cv.getContext('2d').drawImage(newArt,...c,(230-c[2]*scale)/2,150-c[3]*scale,c[2]*scale,c[3]*scale);}
    return cv.toDataURL('image/png');
  }
  function approach(item,action){
    close();standUp();const {w,d}=Furniture.footprint(item),options=navigationOptions(),targets=[];
    for(let x=item.x-1;x<=item.x+w;x++)for(let y=item.y-1;y<=item.y+d;y++){
      if(x>=item.x&&x<item.x+w&&y>=item.y&&y<item.y+d)continue;
      const point={x:x+.5,y:y+.5};if(options.blocked.has(AfterhoursMovement.key(point)))continue;
      const route=AfterhoursMovement.route(player,point,options);
      if(route&&Math.hypot(route.goal.x-point.x,route.goal.y-point.y)<.01)targets.push({point,length:route.nodes.length});
    }
    targets.sort((a,b)=>a.length-b.length);
    if(!targets.length){toast('Clear a tile beside this object so you can reach it.');return;}
    heldKeys.clear();walker.goTo(targets[0].point);pendingUse={itemId:item.id,room:activeRoomId,action};toast('Walking to '+Furniture.catalog[item.type].name+'…');
  }
  function openObject(item){
    if(!item)return;select('item',item.id);
    const c=Furniture.catalog[item.type],actions=[];
    if(c.seats?.length){useSeat(roomSeats().filter(s=>s.itemId===item.id));close();return;}
    const use=(label,fn)=>actions.push({label,fn});
    if(item.type==='lamp'||item.type==='table'||c.use==='light')use(item.state===false?'Turn light on':'Turn light off',()=>{const out=act('itemAction',{id:item.id,action:'toggle'});if(out.ok)toast(out.result?'A warmer kind of night.':'Lights down.');});
    if(item.type==='decks'||c.use==='studio')use('Make a track',()=>studio());
    if(item.type==='speaker'||item.type==='jukebox'||c.use==='playlist'){use('Choose room playlist',playlistPanel);use(music.running?'Stop music':'Play music',()=>music.running?stopMusic():startPlaylist());}
    if(c.use==='look')use('Choose my look',look);
    if(c.use==='stage')use('Go to the stage',()=>window.AfterhoursOnline?.connected()?window.AfterhoursOnline.stagePanel():stagePanel());
    if(c.use==='arcade')use('Play arcade games',arcade);
    if(item.type==='records')use('Browse your records',()=>catalog('discs'));
    if(item.type==='vending')use('Get a soda · 2 ✦',()=>{
      if(!act('itemAction',{id:item.id,action:'soda'}).ok)return;
      carried={kind:'soda',until:Date.now()+60000};toast('A cold soda. Click Drink to enjoy it.');get('drinkButton').hidden=false;
    });
    if(item.type==='plant'||c.use==='water')use('Water the plant',()=>{act('itemAction',{id:item.id,action:'water'},'A little care goes a long way.');});
    if(item.type==='dice')use('Roll the dice',async()=>{
      let value;
      if(window.AfterhoursOnline?.connected()){
        try{value=await window.AfterhoursOnline.rollDice(item.id);}catch{return;}
      }else{
        const out=act('itemAction',{id:item.id,action:'roll'});if(!out.ok)return;
        value=out.result;message('system',player.name+' rolled '+value);
      }
      player.bubble='Rolled a '+value;player.until=Date.now()+5000;runRules('dice',String(value));
    });
    if(item.type==='notice')use('Read / leave a note',notesPanel);
    if(item.type==='bowl')use('Care for companion',petPanel);
    if(item.type==='portal'){
      if(item.destination)use('Step through portal',()=>{const dest=game.state.rooms.find(r=>r.id===item.destination);if(!dest){toast('Choose a destination first.');return;}visitRoom(dest.id);const exit=decor.find(d=>d.type==='portal'&&d.placed!==false);if(exit){const p=AfterhoursMovement.route(player,{x:exit.x+.5,y:exit.y+1.5},navigationOptions())?.goal;if(p)walker.reset(p.x,p.y);}toast('Arrived in '+dest.name);});
      actions.push({label:'Link to a room',direct:true,fn:()=>openPanel('Portal',{itemId:item.id})});
    }
    if(item.type==='gift'){
      if(item.contents)use('Open your gift',()=>{act('itemAction',{id:item.id,action:'unwrap'},'Your gift is in the inventory.');});
      else actions.push({label:'Wrap a piece',direct:true,fn:()=>openPanel('WrapGift',{itemId:item.id})});
    }
    objectPanel={item,actions,text:item.contents?item.note:c.description||descriptions[item.type]};
    openPanel('RoomObject',{itemId:item.id});
  }
  // The open room object as data; its actions run here (most walk you over to the piece first).
  let objectPanel=null;
  function objectState(){
    if(!objectPanel)return null;const {item,actions,text}=objectPanel;
    return {itemId:item.id,type:item.type,name:Furniture.catalog[item.type].name,text:text||'',actions:actions.map(a=>a.label)};
  }
  function objectAction(index){
    const a=objectPanel?.actions[index];if(!a)return {ok:false,error:'That action is no longer available.'};
    if(a.direct)a.fn();else approach(objectPanel.item,a.fn);return {ok:true};
  }
  function objectMove(){if(!objectPanel)return {ok:false};startEditing();selectFurniture(objectPanel.item.id);return {ok:true};}
  function linkPortal(itemId,roomId){return act('itemAction',{id:itemId,action:'link',destination:roomId},'Portal linked.');}
  const drinkButton=document.createElement('button');drinkButton.id='drinkButton';drinkButton.hidden=true;drinkButton.textContent='Drink soda';$('.action-bar>div').append(drinkButton);
  drinkButton.onclick=()=>{if(carried){carried=null;drinkButton.hidden=true;player.bubble='cheers ♡';player.until=Date.now()+3500;toast('Refreshing.');}};
  const chatModes=document.createElement('div');chatModes.className='chat-modes';chatModes.innerHTML='<select id="chatMode" aria-label="Chat mode"><option value="say">Say</option><option value="shout">Shout</option><option value="whisper">Whisper</option></select><select id="whisperTarget" aria-label="Whisper to" hidden></select><button id="socialSettings" aria-label="Chat preferences">⚙</button>';
  get('chatForm').before(chatModes);
  get('chatMode').onchange=()=>{get('whisperTarget').hidden=get('chatMode').value!=='whisper';refreshWhispers();};
  function refreshWhispers(){
    const targets=(window.AfterhoursOnline?.peers()||[]).map(p=>({id:p.id,name:p.name})).concat(personal?[]:people.slice(0,rooms[roomIndex].count-1).map(p=>({id:p.name,name:p.name+' · resident'})));
    get('whisperTarget').innerHTML=targets.map(p=>`<option value="${h(p.id)}">${h(p.name)}</option>`).join('');
  }
  const residentReplies={
    miso:['That one belongs in a late-night set.','I’m always up for hearing something new.','There’s a stage slot with your name on it.'],
    olive:['A plant, a record, a good chair. That’s a room.','The Greenhouse is my quiet corner.','Your room should feel like you.'],
    tomo:['Try muting a lane. Sometimes less is the whole groove.','I’m working on a chiptune loop tonight.','Save that track. Press a disc. Make it yours.'],
    'peach.wav':['Meet me at the diner after your set.','Have you tried the snowball game yet?','A little soda and a little conversation.'],
    sunny:['There’s always another room to discover.','Cloud Nine is beautiful this time of night.','Good to see you around.']
  };
  let chatLog={},replyCount=0;
  populateChat=function(){
    get('messages').replaceChildren();message('system',personal?'Welcome to '+room().name+'.':'You stepped into '+rooms[roomIndex].title+'.');
    (chatLog[roomKey()]||[]).forEach(m=>message(m.name,m.text));
    if(!personal&&!chatLog[roomKey()]?.length){message('system','Resident characters are here to keep you company.');message(people[roomIndex%people.length].name,['The stage is open. Got something to play?','Coffee, records, conversation. Come on in.','Take a breath. Find a seat.','A little closer to the stars.'][roomIndex]);}
  };
  function logMessage(name,text){
    const key=roomKey();chatLog[key]||=[];chatLog[key].push({name,text});chatLog[key]=chatLog[key].slice(-80);message(name,text);
  }
  get('chatForm').addEventListener('submit',e=>{
    e.preventDefault();e.stopImmediatePropagation();
    const input=get('chatInput'),value=input.value.trim();if(!value)return;input.value='';
    const command=value.toLowerCase();
    if(command===':wave'){get('wave').click();return;}if(command===':dance'){get('dance').click();return;}if(command===':stand'){standUp();return;}
    let mode=get('chatMode').value,body=value;
    if(value.startsWith(':shout ')){mode='shout';body=value.slice(7);}
    if(mode==='whisper'&&!get('whisperTarget').value){toast('There is nobody here to whisper to yet.');return;}
    game.event('chats');runRules('say',body);
    const target=get('whisperTarget').value;
    logMessage(player.name,(mode==='whisper'?'→ '+(get('whisperTarget').selectedOptions[0]?.textContent||target)+' · ':mode==='shout'?'SHOUT · ':'')+body);
    if(mode!=='whisper'){player.bubble=body;player.bubbleMode=mode;player.until=Date.now()+9000;}
    window.AfterhoursOnline?.chat(body,mode,target);
    if(!personal&&!game.state.settings.muteGuests&&mode!=='whisper'){
      const key=roomKey(),speaker=people[replyCount++%(rooms[roomIndex].count-1)];
      if(!game.state.blocked.includes(speaker.name))setTimeout(()=>{
        if(roomKey()!==key)return;const replies=residentReplies[speaker.name];const response=replies[replyCount%replies.length];
        logMessage(speaker.name,response);speaker.bubble=response;speaker.bubbleMode='say';speaker.until=Date.now()+8000;
      },1500);
    }
  },true);
  button('socialSettings',()=>{
    panel('Make space for yourself','CHAT PREFERENCES',`<label class="setting-toggle"><input id="muteResidents" type="checkbox" ${game.state.settings.muteGuests?'checked':''}>Mute resident replies</label><p>Resident characters are part of the solo world. Real connected guests appear with a live indicator.</p><button id="saveChatPreferences" class="primary">Save preferences</button><div class="panel-section"><h3>Blocked residents</h3>${game.state.blocked.map(name=>`<button class="soft-button" data-unblock="${h(name)}">Unblock ${h(name)}</button>`).join('')||'<p>Nobody is blocked.</p>'}</div>`);
    button('saveChatPreferences',()=>{game.state.settings.muteGuests=get('muteResidents').checked;game.save();close();});
    buttons('[data-unblock]',b=>{game.state.blocked=game.state.blocked.filter(n=>n!==b.dataset.unblock);game.save();close();});
  });
  function residentProfile(person){select('resident',person.name);
    const friend=game.state.friends.includes(person.name),blocked=game.state.blocked.includes(person.name);
    panel(person.name,'RESIDENT CHARACTER',`<p>${h(residentReplies[person.name][0])}</p><p>This resident is part of the solo world.</p><div class="button-row"><button class="primary" id="residentFriend">${friend?'Remove from circle':'Add to my circle'}</button><button class="soft-button" id="residentWhisper">Whisper</button><button class="soft-button" id="residentBlock">${blocked?'Unblock':'Block replies'}</button></div>`);
    button('residentFriend',()=>{game.state.friends=friend?game.state.friends.filter(n=>n!==person.name):[...game.state.friends,person.name];game.save();residentProfile(person);});
    button('residentWhisper',()=>{get('chatMode').value='whisper';refreshWhispers();get('whisperTarget').hidden=false;get('whisperTarget').value=person.name;close();get('chatInput').focus();});
    button('residentBlock',()=>{game.state.blocked=blocked?game.state.blocked.filter(n=>n!==person.name):[...game.state.blocked,person.name];game.save();close();});
  }
  button('friendsTab',()=>{
    panel('Good company','YOUR CIRCLE',`<p>Your resident circle lives on this device. Connected players appear below when you join a shared session.</p><div class="directory-list">${game.state.friends.map(name=>`<button class="directory-room" data-friend="${h(name)}"><span class="room-symbol">♡</span><span><b>${h(name)}</b><small>Resident character</small></span><em>View ↗</em></button>`).join('')||'<p>Click a resident in a room to add them to your circle.</p>'}</div><div id="onlineFriends"></div><button id="openSharedSession" class="primary">Shared sessions</button>`);
    buttons('[data-friend]',b=>residentProfile(people.find(p=>p.name===b.dataset.friend)));
    button('openSharedSession',()=>window.AfterhoursOnline?.panel());
    window.AfterhoursOnline?.renderFriends(get('onlineFriends'));
  });
  button('roomTab',()=>populateChat());
  canvas.addEventListener('pointerup',e=>{
    if(editor.active||e.button!==0)return;
    const p=scenePoint(e);
    if(petPosition){const [x,y]=iso(petPosition.x,petPosition.y);if(Math.abs(p.x-x)<37&&p.y>y-65&&p.y<y+10){e.stopImmediatePropagation();petPanel();return;}}
    if(personal){const hit=furnitureAt(e),item=hit&&decor.find(d=>d.id===hit.id);if(item&&!Furniture.catalog[item.type].seats?.length){e.stopImmediatePropagation();openObject(item);return;}}
    if(!personal){const hit=people.slice(0,rooms[roomIndex].count-1).find(person=>{const [x,y]=iso(person.x,person.y);return Math.abs(p.x-x)<22&&p.y>y-115&&p.y<y;});if(hit){e.stopImmediatePropagation();residentProfile(hit);return;}}
  },true);
  const legacyDrawFurniture=drawFurniture;
  drawFurniture=function(item,preview=false){
    const c=Furniture.catalog[item.type];
    ctx.save();if(item.state===false&&(['lamp','table'].includes(item.type)||c.use==='light'))ctx.filter='brightness(.4)';legacyDrawFurniture(item,preview);ctx.restore();
    if(!preview&&item.state!==false&&(['lamp','table'].includes(item.type)||c.use==='light')){const g=furnitureGeometry(item),pool=AfterhoursView.lightPool();ctx.save();ctx.globalCompositeOperation='screen';ctx.imageSmoothingEnabled=false;ctx.globalAlpha=.3;ctx.drawImage(pool,g.x-100,g.y-50,200,100);ctx.globalAlpha=.36;ctx.drawImage(pool,g.x-70,g.y-g.h*.6-70,140,140);ctx.restore();}
    if(!preview){const g=furnitureGeometry(item);if(item.type==='dice'&&item.value)label(String(item.value),g.x,g.y-g.h-9,18,'#f5edce');if(item.type==='portal'&&item.destination)label('LINKED',g.x,g.y-g.h-10,10,'#dcb1ff');}
  };

  function drawPet(t){
    if(!petPosition||!game.state.pet||!newArt.complete||!newArt.naturalWidth)return;
    const [x,y]=iso(petPosition.x,petPosition.y),c=newCrops[6],w=66,height=c[3]/c[2]*w;
    ellipse(x,y,25,8,'#06060977');ctx.save();ctx.translate(x,y);
    if(petPoseUntil>t&&petPose==='spin')ctx.scale(Math.cos((petPoseUntil-t)/180),1);
    else if(petWalker.flip)ctx.scale(-1,1);
    const bounce=petWalker.moving&&!reducedMotion?Math.sin(petWalker.phase)*2:0;
    ctx.drawImage(newArt,...c,-w/2,-height+bounce,w,height);ctx.restore();label(game.state.pet.name,x,y+17,11,'#e5d3ae');
    if(petPoseUntil>t&&petPose==='sit')label('♡',x,y-height-4,15,'#e2eda7');
  }
  let previousSeatMode=seating.mode;
  window.GameHooks={
    update(dt,t){
      updateJourney();
      if(pendingUse&&!walker.moving&&!walker.path.length){
        const pending=pendingUse;pendingUse=null;const item=decor.find(d=>d.id===pending.itemId&&d.placed!==false);
        if(personal&&pending.room===activeRoomId&&item)pending.action();
      }
      if(previousSeatMode!==seating.mode){previousSeatMode=seating.mode;if(seating.mode==='sitting')runRules('sit');}
      if(petWalker&&petPosition&&game.state.pet){
        if(game.state.pet.following&&t>lastPetPath&&Math.hypot(player.x-petPosition.x,player.y-petPosition.y)>1.7){lastPetPath=t+800;petWalker.goTo({x:player.x+(player.x<7?1:-1),y:player.y});}
        if(!editor.active)petWalker.update(dt);
      }
      if(carried&&Date.now()>carried.until){carried=null;drinkButton.hidden=true;}
      if(t-lastHud>600){lastHud=t;
        const event=personal?room().event:null,card=get('activityCard');
        card.hidden=!stage&&!event;
        if(stage)card.innerHTML=`<span class="live-dot"></span><b>${stage.started?'ON STAGE':'UP NEXT'}</b><span>${h(stage.song.title)}</span><em>${Math.max(0,Math.ceil((stage.end-Date.now())/1000))}s</em>`;
        else if(event){const mins=Math.ceil((event.start-Date.now())/60000);card.innerHTML=`<span class="live-dot"></span><b>${mins>0?'STARTS IN '+mins+' MIN':'HAPPENING NOW'}</b><span>${h(event.name)}</span>`;}
      }
      window.AfterhoursOnline?.update(dt,t);
    },
    background(){
      if(personal){
        const color={moonlight:'#312b8544',rose:'#7f28542b',daylight:'#ffe4aa13',club:'#7b248b30'}[room().lighting];
        if(color){ctx.fillStyle=color;ctx.fillRect(0,0,1500,1000);}
      }
    },
    layers(layers,t){if(petPosition)layers.push({depth:petPosition.x+petPosition.y,draw:()=>drawPet(t)});window.AfterhoursOnline?.layers(layers,t);},
    foreground(){
      if(carried){const [x,y]=seating.mode==='sitting'?seating.target.offer.point:iso(player.x,player.y-0.0);ctx.save();ctx.translate(x+18,y-(seating.mode==='sitting'?22:65));ctx.fillStyle='#b8d4d0';ctx.fillRect(-4,-7,8,14);ctx.fillStyle='#e5e1bd';ctx.fillRect(-4,-8,8,3);ctx.restore();}
    }
  };
  button('help',()=>openPanel('Help'));
  sync();resetPet();populateChat();syncFavorite();updateHUD();game.save();showRoomIntro();
  if(loadError)toast(loadError);
  // A narrow bridge for the optional multiplayer client, never for UI automation.
  window.AfterhoursWorld={
    game,saveWorld,sync,toast,panel,close,h,button,buttons,room,roomKey,visitRoom,enterRoom,player,walker,canvas,ctx,
    getScene:()=>({personal,roomIndex,activeRoomId,decor,spriteIndex,seating,iso,roomSeats:roomSeats()}),
    setRemoteChat:(name,text)=>logMessage(name,text),
    spriteImage,backImage,seatedImage,seatedCrops,drawAvatarLabels,drawWalker,avatarDepth,markArrival,drawArrival,
    setSeat:offers=>useSeat(offers),stand:()=>standUp(),navigationOptions,refreshWhispers,
    openJournal:journal,download,stagePanel,playSong,stopMusic,
    openCatalog:catalog,openNavigator,act,placeItem,useItem,saveBlueprint,restoreBlueprint,
    wrapGift:(id,content,note)=>act('itemAction',{id,action:'wrap',content,note},'A little surprise, wrapped and ready.'),
    playDisc:id=>{const disc=game.state.discs.find(d=>d.id===id);if(disc)playSong(disc.song);return !!disc;},
    // The shop as data: collections, categories and every piece with its atlas crop.
    shopData:()=>({collections:collections.map(([key,name,tagline])=>({key,name,tagline})),
      categories:[['all','Every kind'],['lounge','Seats & tables'],['music','Music'],['interactive','Interactive'],['decor','Decor']].map(([key,name])=>({key,name})),
      entries:Object.entries(Furniture.catalog).map(([type,c])=>{const {crop,image}=furnitureArt(type);return {type,name:c.name,description:c.description||descriptions[type]||'',price:c.price,w:c.w,d:c.d,seats:c.seats?.length||0,
        collection:c.collection||'originals',category:category(type),featured:!!c.atlas,
        atlas:{url:new URL(image.getAttribute('src'),location.href).href,width:image.naturalWidth,height:image.naturalHeight},crop};})}),
    shopImages:()=>[...new Set(Object.keys(Furniture.catalog).map(type=>furnitureArt(type).image))],
    updateHUD,showStudio:studio,roomsState,goToRoom,createRoom,roomState,roomPanels,saveRoomSettings,addNote,deleteNote,addRule,deleteRule,hostEvent,endEvent,
    arcadeState,playArcade:kind=>startArcade(kind),petState,adoptPet,petAction,petPortrait,objectState,objectAction,objectMove,linkPortal,journalState,claimQuest,profileState,saveProfile,exportSave,inspectSave,inspectBackup,confirmRestore,
    wardrobeState,presetOutfit,outfitPreview,saveLook,classicLook:()=>classicLook(),studioEdit,playTrack,exportWav,savePlaylist,startPlaylist,
    pressDisc:id=>act('disc',{id},'Pressed onto a collectible disc.'),deleteSong:id=>act('deleteSong',{id}),perform:id=>queueSong(id),
    stageState,stageAct,openPanel,showJournal:()=>journal(),
    setActiveRoom:id=>{activeRoomId=id;game.state.activeRoom=id;},
    applyState:state=>{game.state=state;activeRoomId=state.activeRoom||state.rooms[0].id;spriteIndex=state.profile.avatar||0;sync();draft=copy(state.draft);$('.profile-art').style.backgroundPosition=(-spriteIndex*35)+'px -4px';resetPet();}
  };
})();
