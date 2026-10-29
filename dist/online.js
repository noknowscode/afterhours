(() => {
  'use strict';
  const W=window.AfterhoursWorld,G=AfterhoursGame,base=window.AFTERHOURS_API||(location.protocol.startsWith('http')?location.origin:'');
  const get=id=>document.getElementById(id),h=W.h;
  let ready=false,online=false,token='',state=null,solo=null,remote=null,applying=false,joining=false,lastPose=0,lastResponse=0,polling=false,lastGameRevision=-1,managed=false,account=null,retryAfter=0;
  let requestChain=Promise.resolve(),pending=0,lastChatIds=new Set(),seenNotifications=new Set(),seenDoorRequests=new Set(),rendered=new Map(),extrasTimer=null,lastStage='',listen=false,networkErrors=0;
  let poseSignature='';
  const sharedMusic=new AfterhoursMusic(),originalDispatch=W.game.dispatch.bind(W.game),originalSave=W.game.save.bind(W.game),oldEnter=enterRoom,oldSeat=useSeat,oldStand=standUp,oldEditing=startEditing;
  async function request(path,body,auth=true){
    if(auth&&Date.now()<retryAfter)throw Error('The playtest is taking a short pause. Your saved character is safe; retry in a minute.');
    if(auth&&managed)token=await window.AfterhoursAccount.token();
    const response=await fetch(base+path,{method:body===undefined?'GET':'POST',headers:{'Content-Type':'application/json',...(auth&&token?{Authorization:'Bearer '+token}:{})},body:body===undefined?undefined:JSON.stringify(body),signal:AbortSignal.timeout(15000)});
    const json=await response.json();if(!response.ok){
      if(response.status===429||response.status===503){retryAfter=Date.now()+60000;get('connectionLabel').textContent='PLAYTEST PAUSED';}
      throw Object.assign(Error(json.error||'The shared world could not be reached.'),{status:response.status});
    }if(auth)lastResponse=performance.now();return json;
  }
  function send(type,payload={},quiet=false){
    pending++;
    const task=requestChain.then(async()=>{
      const response=await request('/api/action',{type,payload});networkErrors=0;apply(response.snapshot);return response;
    });
    requestChain=task.catch(async error=>{
      if(!quiet)W.toast(error.message);
      try{const fresh=await request('/api/state');lastGameRevision=-1;apply(fresh);}catch{}
    }).finally(()=>pending--);
    return task;
  }
  function apply(next){
    if(!online)return;const previous=state;state=next;remote=next.roomView;
    if(next.game.revision!==lastGameRevision){
      lastGameRevision=next.game.revision;applying=true;W.applyState(G.clone(next.game));applying=false;
    }
    if(!joining&&previous&&previous.room!==next.room)renderRoom();
    else if(previous&&previous.room===next.room){
      const before=new Map(previous.peers.map(p=>[p.id,p])),present=new Set(next.peers.map(p=>p.id));
      for(const p of next.peers)if(!before.has(p.id)){W.markArrival(p.id);AfterhoursView.cue('arrive');W.setRemoteChat('system',p.name+' walked in.');}
      for(const [id,p] of before)if(!present.has(id))W.setRemoteChat('system',p.name+' left.');
    }
    for(const request of next.doorRequests||[])if(!seenDoorRequests.has(request.id)){seenDoorRequests.add(request.id);AfterhoursView.cue('knock');}
    else if(remote){W.sync();get('roomTitle').textContent=remote.name;get('roomMeta').textContent='by '+remote.owner+' · shared room';}
    get('connectionLabel').textContent='SHARED WORLD';get('guestCount').textContent=next.peers.length+1;
    $('.people-strip small').textContent=next.peers.length+' connected · residents nearby';
    $('footer>span').textContent='Shared world · real guests + resident characters';
    for(const entry of next.chats){
      if(lastChatIds.has(entry.id))continue;lastChatIds.add(entry.id);
      if(entry.from===next.self.id)continue;
      W.setRemoteChat(entry.name,(entry.mode==='whisper'?'Whisper · ':entry.mode==='shout'?'SHOUT · ':'')+entry.text);
    }
    if(lastChatIds.size>500)lastChatIds=new Set(next.chats.map(m=>m.id));
    for(const notice of next.notifications){if(!seenNotifications.has(notice.id)){seenNotifications.add(notice.id);W.toast(notice.text);}}
    W.refreshWhispers();
    const stage=next.stage;
    if(stage?.id!==lastStage){
      lastStage=stage?.id||'';sharedMusic.stop();
      if(stage&&listen)playStage(stage);
    }
  }
  async function connect(name,captchaToken){
    try{
      let next;
      if(managed){
        const accounts=window.AfterhoursAccount;
        if(!accounts)throw Error('The host is still connecting account recovery. Please try again later.');
        await accounts.enter(captchaToken);
        const out=await request('/api/guest',{name,avatar:W.getScene().spriteIndex,outfit:W.game.state.profile.outfit});
        next=out.snapshot;account=out.account;
      }else{
        const out=await AfterhoursSession.resumeOrCreate(localStorage,async(path,body,saved)=>{
          token=saved;return request(path,body,!!saved);
        },name,W.getScene().spriteIndex);
        token=out.token;next=out.snapshot;
      }
      W.saveWorld();solo=G.clone(W.game.state);online=true;lastGameRevision=-1;apply(next);renderRoom();W.close();W.toast('You joined the shared world.');
      // After the join sheet has closed.
      setTimeout(awayPanel,600);return null;
    }catch(e){return e.message;}
  }
  function disconnect(){
    if(!online)return;
    online=false;remote=null;state=null;sharedMusic.stop();listen=false;lastGameRevision=-1;rendered.clear();
    if(solo){W.applyState(solo);originalSave();solo=null;}oldEnter(0,false);
    get('connectionLabel').textContent='SOLO WORLD';$('footer>span').textContent='Saved on this device · Resident characters are NPCs';
    W.close();W.toast('Back in your solo world. Online progress is kept on the service.');
  }
  // Shared sessions, joining, restoring and signing out are XAML panels in the Uno app; socialAct runs their actions.
  function panel(){W.openPanel(!ready||online?'SharedWorld':'Join');}
  function restorePanel(){W.openPanel('Restore');}
  function signOutPanel(){W.openPanel('SignOut');}
  // Joins with the name from the join panel. A managed world first shows the security check in the panel's
  // challenge element (a native element the app marks with data-account-challenge).
  async function join(name){
    let captcha;
    if(managed&&!window.AfterhoursAccount?.remembered()){
      const host=document.querySelector('[data-account-challenge]');
      if(!host)throw Error('The security check could not be shown. Please try again.');
      captcha=await window.AfterhoursAccount.challenge(host);
    }
    const error=await connect(name,captcha);
    if(error)throw Error(error);
  }
  function playerPanel(id){select('peer',id);W.openPanel('Player',{id});}
  // The shared navigator is a XAML panel; it reads roomsState and joins through joinRoomKey.
  function roomDirectory(){W.openPanel('Rooms',{filter:'all'});}
  const publicNames=['Side B','Midnight Diner','The Greenhouse','Cloud Nine'];
  function roomsState(){
    return {shared:true,favorites:[],history:[],
      entries:publicNames.map((name,i)=>({key:'public:'+i,name,description:'Public hangout',kind:'public',door:'open'}))
        .concat(state.rooms.map(r=>({key:r.key,name:r.name,description:'by '+r.owner+' · '+r.count+' guests · '+r.door,kind:'shared',door:r.door})))};
  }
  // Joined, or the doorbell rang (the toast says so): either way the navigator can close.
  async function joinRoomKey(key){
    rang=false;const joined=await joinRoom(key);
    return joined||rang?{ok:true}:{ok:false,error:'That room could not be opened right now.'};
  }
  let rang=false;
  async function joinRoom(key){
    if(joining)return false;joining=true;try{
      const out=await send('joinRoom',{key});
      if(out.result?.waiting){rang=true;AfterhoursView.cue('ring');W.toast('Doorbell rung. The host will answer shortly.');return false;}
      renderRoom();W.close();return true;
    }catch{return false;}finally{joining=false;}
  }
  function renderRoom(){
    if(!state)return;remote=state.roomView;applying=true;
    if(state.room.startsWith('public:'))oldEnter(Number(state.room.slice(7)),false);
    else{
      if(!remote){const id=state.room.slice(('home:'+state.self.id+':').length);W.setActiveRoom(id);}
      W.sync();oldEnter(0,true);
      if(remote){get('roomTitle').textContent=remote.name;get('roomMeta').textContent='by '+remote.owner+' · shared room';}
    }
    W.walker.reset(state.self.pose?.x||5.5,state.self.pose?.y||5.5);
    applying=false;lastChatIds=new Set();rendered.clear();
  }
  enterRoom=function(i,mine=false){
    if(!online||applying){if(!online)remote=null;oldEnter(i,mine);return;}
    const key=mine?'home:'+state.self.id+':'+W.getScene().activeRoomId:'public:'+i;joinRoom(key);
  };
  startEditing=function(){if(remote){W.toast('Only the room owner can move these pieces.');return;}oldEditing();};
  useSeat=function(offers){
    if(!online||applying)return oldSeat(offers);
    const offer=offers?.find(o=>!state.seats[o.id]||state.seats[o.id]===state.self.id);
    if(!offer){W.toast('Those seats are already taken.');return true;}
    send('seat',{id:offer.id,point:offer.point,flip:offer.flip}).then(()=>{const success=oldSeat([offer]);if(W.getScene().seating.mode==='standing')send('stand',{},true).catch(()=>{});return success;}).catch(()=>{});
    return true;
  };
  standUp=function(animate=true){oldStand(animate);if(online&&!applying&&state?.seats&&Object.values(state.seats).includes(state.self.id))send('stand',{},true).catch(()=>{});};
  W.game.dispatch=function(type,payload,now){
    const result=originalDispatch(type,payload,now);
    if(online&&!applying)send('command',{type,payload}).catch(()=>{});
    return result;
  };
  W.game.save=function(){
    originalSave();
    if(!online||applying)return;
    clearTimeout(extrasTimer);extrasTimer=setTimeout(()=>{
      if(!online)return;const r=W.game.state.rooms.find(r=>r.id===W.game.state.activeRoom)||W.game.state.rooms[0];
      send('extras',{room:r.id,rules:r.rules||[],playlist:r.playlist,event:r.event,draft:W.game.state.draft,avatar:W.getScene().spriteIndex},true).catch(()=>{});
    },900);
  };
  const ago=time=>{const m=Math.round((Date.now()-time)/60000);if(m<1)return'just now';if(m<60)return m+' min ago';if(m<1440)return Math.round(m/60)+' h ago';return m<10080?new Date(time).toLocaleDateString(undefined,{weekday:'short'}):new Date(time).toLocaleDateString();};
  function awayPanel(){if(state?.away?.length)W.openPanel('Away');}
  // The weekly chart and the shared stage are XAML panels in the Uno app; these feed them.
  function chartPanel(){W.openPanel('Chart');}
  function chartState(){
    const chart=state?.chart;if(!chart)return null;const self=state.self.id;
    const row=(e,mark)=>({mark:mark||String(e.rank),title:e.title,artist:e.artist,listeners:e.listeners,own:e.user===self});
    return {week:'WEEK '+chart.week.slice(-2)+' · RESETS MONDAY',top:chart.top.map(e=>row(e)),last:(chart.last?.top||[]).map(e=>row(e,['①','②','③'][e.rank-1]))};
  }
  function friendsPanel(){W.openPanel('Friends');}
  function tradePanel(trade){if(trade)W.openPanel('Trade',{id:trade.id});else panel();}
  // The shared world as data for the hosting app's social panels.
  const awayIcons={visit:'⌂',friend:'♡',chart:'★'};
  function tradeView(t){
    const self=state.self.id,open=t.status==='open',pending=t.status==='pending',piece=i=>AfterhoursFurniture.catalog[i.type].name;
    return {id:t.id,status:t.status,other:t.people.find(p=>p.id!==self)?.name||'',canAccept:pending&&t.participants[1]===self,waiting:pending&&t.participants[1]!==self,
      open,closed:!open&&!pending,completed:t.status==='completed',confirmed:t.confirmed.includes(self),
      sides:open?t.people.map(p=>({name:p.name,confirmed:t.confirmed.includes(p.id),pieces:(t.items?.[p.id]||[]).map(piece)})):[],
      inventory:open?W.game.state.items.filter(i=>i.placed===false&&!i.wrapped&&!i.contents).map(i=>({id:i.id,name:piece(i),offered:(t.offers?.[self]||[]).includes(i.id)})):[]};
  }
  function socialState(){
    if(!online)return {ready,connected:false,managed,join:{name:W.game.state.profile.name,remembered:managed?!!window.AfterhoursAccount?.remembered():!!localStorage.getItem('afterhours-online-token'),
      inviteOnly:!!window.AFTERHOURS_AUTH?.googleInviteOnly}};
    const self=state.self.id,away=state.away||[];
    const person=(p,here)=>({id:p.id,name:p.name,level:p.level||1,motto:p.motto||'',online:here||!!p.online,status:here?'Here tonight':p.online?'Here now':p.lastSeen?'Seen '+ago(p.lastSeen):'Offline'});
    return {ready,connected:true,managed,name:state.self.name,
      account:managed&&account?{anonymous:!!account.anonymous,inviteOnly:!!window.AFTERHOURS_AUTH?.googleInviteOnly}:null,
      peers:state.peers.map(p=>person(p,true)),friends:state.friends.map(p=>person(p,false)),
      requests:state.friendRequests.map(p=>({id:p.id,name:p.name})),doors:(state.doorRequests||[]).map(p=>({id:p.id,name:p.name})),
      trades:state.trades.map(tradeView),inOwnRoom:state.room.startsWith('home:'+self+':'),
      away:away.slice(0,10).map(e=>({icon:awayIcons[e.kind]||'•',text:e.text,ago:ago(e.time)})),awayMore:Math.max(0,away.length-10)};
  }
  // One social action from the hosting app; replies {ok, error, result} (a new trade's id).
  const thanks={friend:'Friend request sent.',block:'Player blocked.',report:'Report submitted.'};
  async function socialAct(op,id,text){
    switch(op){
      case 'retry':await health();return {ok:ready};
      case 'leave':disconnect();return {ok:true};
      case 'rooms':roomDirectory();return {ok:true};
      case 'stage':stagePanel();return {ok:true};
      case 'friends':friendsPanel();return {ok:true};
      case 'sessions':panel();return {ok:true};
      case 'player':playerPanel(id);return {ok:true};
      case 'openTrade':W.openPanel('Trade',{id});return {ok:true};
      case 'signOut':signOutPanel();return {ok:true};
      case 'restorePanel':restorePanel();return {ok:true};
      case 'join':try{await join(text);return {ok:true};}catch(error){return {ok:false,error:error.message};}
      case 'restore':try{await window.AfterhoursAccount.restore();return {ok:true};}catch(error){return {ok:false,error:error.message};}
      case 'confirmSignOut':
        try{await window.AfterhoursAccount.signOut();disconnect();token='';account=null;W.toast('Signed out. Restore with Google to continue your saved character.');return {ok:true};}
        catch(error){return {ok:false,error:error.message};}
      case 'link':try{await window.AfterhoursAccount.link();return {ok:true};}catch(error){return {ok:false,error:error.message};}
      case 'follow':{const friend=state?.friends.find(p=>p.id===id);return {ok:!!friend&&await joinRoom(friend.room)};}
    }
    if(!online)return {ok:false,error:'Join the shared world first.'};
    const action={friend:['friend',{user:id}],accept:['answerFriend',{user:id,accept:true}],decline:['answerFriend',{user:id,accept:false}],unfriend:['unfriend',{user:id}],
      block:['block',{user:id}],report:['report',{user:id,reason:text}],kick:['kick',{user:id}],ban:['ban',{user:id}],letIn:['door',{user:id,allow:true}],deny:['door',{user:id,allow:false}],
      trade:['trade',{user:id}],tradeAccept:['tradeAccept',{id}],tradeOffer:['tradeOffer',{id,items:JSON.parse(text||'[]')}],tradeConfirm:['tradeConfirm',{id}],tradeCancel:['tradeCancel',{id}],awaySeen:['awaySeen',{}]}[op];
    if(!action)return {ok:false,error:'That action is not available.'};
    try{const out=await send(...action);if(thanks[op])W.toast(thanks[op]);return {ok:true,result:out.result?.id??null};}
    catch(error){return {ok:false,error:error.message};}
  }
  function stagePanel(){W.stagePanel();}
  function stageState(){
    if(!state)return null;const current=state.stage,now=Date.now(),self=state.self.id;
    return {mode:'shared',
      current:current&&{title:current.song.title,artist:current.artist,phase:now<current.start?'UP NEXT':'ON STAGE',
        remaining:Math.max(0,Math.ceil((current.end-now)/1000)),progress:now<current.start?0:Math.min(1,Math.round((now-current.start)/(current.end-current.start)*100)/100),
        applause:Object.keys(current.votes).length,started:now>=current.start},
      queue:state.queue.map(q=>({title:q.song.title,artist:q.artist})),
      own:current?.user===self||state.queue.some(q=>q.user===self),performing:current?.user===self,
      canApplaud:!!current&&current.user!==self&&!current.votes[self]&&now>=current.start,applauded:!!current?.votes[self],listening:listen,
      songs:state.game.songs.map(s=>({id:s.id,title:s.title,detail:s.bpm+' BPM'})),chart:chartState(),complete:null,
      note:'Songs start from a shared clock. One applause per listener; artists cannot applaud their own set. Each listener’s applause pays the artist '+G.applause.credits+' ✦ once a day, up to '+G.applause.daily+' ✦ a day.'};
  }
  function toggleListen(){listen=!listen;if(listen&&state?.stage)playStage(state.stage);else sharedMusic.stop();}
  function queueSong(id,show=true){listen=true;sharedMusic.ensure().catch(()=>{});send('queue',{song:id}).then(()=>{if(show)stagePanel();}).catch(()=>{});}
  async function playStage(stage){
    try{W.stopMusic();await sharedMusic.play(stage.song,()=>{},stage.start);get('trackTitle').textContent=stage.song.title;$('.track p').textContent=stage.artist+' · live stage';}
    catch{listen=false;W.toast('Choose Listen to enable shared audio.');}
  }
  const oldSound=get('sound').onclick,oldPlay=get('play').onclick;
  get('sound').onclick=get('play').onclick=()=>{if(online&&state?.stage){listen=!listen;if(listen)playStage(state.stage);else sharedMusic.stop();get('sound').textContent=listen?'♫ Sound on':'♫ Sound off';get('play').textContent=listen?'Ⅱ':'▶';}else oldSound();};
  canvas.addEventListener('pointerup',e=>{
    if(!online||editor.active)return;const p=scenePoint(e);
    const peer=state.peers.find(peer=>{const draw=rendered.get(peer.id)||peer.pose;const [x,y]=W.getScene().iso(draw.x,draw.y);return Math.abs(p.x-x)<24&&p.y>y-118&&p.y<y;});
    if(peer){e.stopImmediatePropagation();playerPanel(peer.id);}
  },true);
  function drawPeer(peer,t){
    const p=rendered.get(peer.id)||peer.pose,scene=W.getScene(),pose=peer.pose,index=peer.avatar,[x,y]=scene.iso(p.x,p.y);W.drawArrival(peer.id,x,y);
    W.ctx.save();
    if(pose.seat?.sitting){
      const crop=W.seatedCrops[index],height=118,width=crop[2]/crop[3]*height;
      W.ctx.translate(...pose.seat.point);if(pose.seat.flip)W.ctx.scale(-1,1);
      if(!(peer.outfit&&AfterhoursAvatar.draw(W.ctx,peer.outfit,{seated:true})))W.ctx.drawImage(W.seatedImage,...crop,-width*.28,-height*.62,width,height);W.ctx.restore();
      W.drawAvatarLabels({id:peer.id,name:peer.name,chatColor:peer.chatColor,bubble:pose.bubble?.text,bubbleMode:pose.bubble?.mode,until:pose.bubble?.until},pose.seat.point[0],pose.seat.point[1]+height*.38,false);return;
    }
    const step=pose.dancing&&!reducedMotion?AfterhoursView.dancePose(t):{bob:0,tilt:0};W.ctx.translate(x,y+step.bob*.8);if(step.tilt)W.ctx.rotate(step.tilt);
    if(!(peer.outfit&&AfterhoursAvatar.draw(W.ctx,peer.outfit,{back:pose.back,flip:pose.flip,moving:p.moving,phase:p.phase||0,reducedMotion})))W.drawWalker(p,t,{...pose,moving:p.moving,phase:p.phase||0},index);
    W.ctx.restore();W.drawAvatarLabels({id:peer.id,name:peer.name,chatColor:peer.chatColor,bubble:pose.bubble?.text,bubbleMode:pose.bubble?.mode,until:pose.bubble?.until},x,y,false);
    W.ctx.fillStyle='#b5e8b2';W.ctx.beginPath();W.ctx.arc(x+22,y+26,3,0,Math.PI*2);W.ctx.fill();
  }
  const api={
    directory:roomDirectory,roomsState,joinRoomKey,connected:()=>online,remoteRoom:()=>remote,peers:()=>state?.peers||[],panel,socialState,socialAct,stagePanel,chartPanel,queueSong,stageState,toggleListen,
    leaveStage:()=>send('leaveQueue').catch(()=>{}),applaud:()=>send('vote').catch(()=>{}),
    visitOwnRoom:id=>joinRoom('home:'+state.self.id+':'+id),
    rollDice:id=>send('command',{type:'itemAction',payload:{id,action:'roll'}}).then(out=>out.result),
    chat:(text,mode,to)=>{if(online&&!(mode==='whisper'&&!state.peers.some(p=>p.id===to)))send('chat',{text,mode,to}).catch(()=>{});},
    saveLayout:()=>{if(online&&!applying&&!remote)send('layout',{room:W.getScene().activeRoomId,items:W.getScene().decor.map(i=>({id:i.id,x:i.x,y:i.y,rot:i.rot,placed:i.placed,state:i.state,destination:i.destination}))}).catch(()=>{});},
    peerPoint(id){const peer=state?.peers.find(p=>p.id===id);if(!online||!peer)return null;if(peer.pose.seat?.sitting){const [x,y]=peer.pose.seat.point;return [x,y-95];}const p=rendered.get(id)||peer.pose,[x,y]=W.getScene().iso(p.x,p.y);return [x,y-150];},
    arcadeStart:(game,id)=>{if(online)send('arcadeStart',{game,id}).catch(()=>{});},
    update(dt,t){
      if(!online||Date.now()<retryAfter||document.hidden)return;
      for(const peer of state?.peers||[]){let p=rendered.get(peer.id);if(!p){p={x:peer.pose.x,y:peer.pose.y};rendered.set(peer.id,p);}const k=1-Math.exp(-dt*12),dx=(peer.pose.x-p.x)*k,dy=(peer.pose.y-p.y)*k,distance=Math.hypot(dx,dy);p.x+=dx;p.y+=dy;p.moving=distance>dt*.08&&!peer.pose.seat?.sitting;p.phase=(p.phase||0)+distance*Math.PI*2/1.15;}
      const scene=W.getScene(),pose={x:W.player.x,y:W.player.y,back:W.walker.back,flip:W.walker.flip,dancing,avatar:scene.spriteIndex,seated:scene.seating.mode==='sitting'},key=JSON.stringify(pose);
      const sync=AfterhoursSession.syncKind({now:t,lastResponse,lastPose,poseChanged:key!==poseSignature,peers:state?.peers.length,busy:pending||joining||polling,hidden:document.hidden,paused:Date.now()<retryAfter});
      if(sync==='pose'){lastPose=t;poseSignature=key;send('pose',pose,true).catch(()=>{});}
      else if(sync==='state'){
        polling=true;request('/api/state').then(next=>{networkErrors=0;apply(next);}).catch(error=>{
          networkErrors++;if(![429,503].includes(error.status)){retryAfter=Date.now()+Math.min(15000,1000*2**Math.min(networkErrors,4));get('connectionLabel').textContent='RECONNECTING…';}
        }).finally(()=>polling=false);
      }
    },
    layers(layers,t){if(!online)return;for(const peer of state?.peers||[])layers.push({depth:W.avatarDepth(rendered.get(peer.id)||peer.pose,peer.pose.seat?.sitting?peer.pose.seat:null),draw:()=>drawPeer(peer,t)});}
  };
  window.AfterhoursOnline=api;
  const label=get('connectionLabel');label.style.cursor='pointer';label.setAttribute('role','button');label.tabIndex=0;label.onclick=panel;label.onkeydown=e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();panel();}};
  async function health(){if(!base)return;try{const out=await request('/api/health',undefined,false);ready=out.ok===true;managed=out.accounts==='supabase';if(ready&&!online)label.textContent='JOIN SHARED WORLD';}catch{ready=false;}}
  health().then(()=>{
    if(ready&&managed&&localStorage.getItem('afterhours-account-resume')){
      localStorage.removeItem('afterhours-account-resume');connect(W.game.state.profile.name).then(error=>{if(error)W.toast(error);});
    }
  });
})();
