(() => {
  'use strict';
  const W=window.AfterhoursWorld,G=AfterhoursGame,base=window.AFTERHOURS_API||(location.protocol.startsWith('http')?location.origin:'');
  const get=id=>document.getElementById(id),h=W.h;
  let ready=false,online=false,token='',state=null,solo=null,remote=null,applying=false,joining=false,lastPose=0,lastResponse=0,polling=false,lastGameRevision=-1,managed=false,account=null,retryAfter=0;
  let requestChain=Promise.resolve(),pending=0,lastChatIds=new Set(),seenNotifications=new Set(),seenDoorRequests=new Set(),rendered=new Map(),extrasTimer=null,lastTradeStatus='',lastStage='',listen=false,networkErrors=0;
  let rosterSignature='',friendsSignature='',poseSignature='';
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
    const active=next.trades.find(t=>['pending','open'].includes(t.status));
    const status=active?active.id+':'+active.status+':'+active.confirmed.join(',')+':'+JSON.stringify(active.offers):'';
    if(get('sharedTrade')&&status!==lastTradeStatus){lastTradeStatus=status;tradePanel(active||next.trades[0]);}
    const stage=next.stage;
    if(stage?.id!==lastStage){
      lastStage=stage?.id||'';sharedMusic.stop();
      if(stage&&listen)playStage(stage);
    }
    const rosterKey=JSON.stringify([next.peers.map(p=>[p.id,p.name,p.level,p.motto]),next.doorRequests,next.trades.map(t=>[t.id,t.status])]);
    const friendsKey=JSON.stringify([next.friends,next.friendRequests]);
    if(get('onlineFriends')&&friendsKey!==friendsSignature)renderFriends(get('onlineFriends'));
    if(get('sharedGuestList')&&rosterKey!==rosterSignature)renderGuests();
    rosterSignature=rosterKey;friendsSignature=friendsKey;
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
      W.saveWorld();solo=G.clone(W.game.state);online=true;lastGameRevision=-1;apply(next);renderRoom();W.close();W.toast('You joined the shared world.');awayPanel();
    }catch(e){const error=get('panelError');if(error){error.hidden=false;error.textContent=e.message;}else W.toast(e.message);}
  }
  function disconnect(){
    if(!online)return;
    online=false;remote=null;state=null;sharedMusic.stop();listen=false;lastGameRevision=-1;rendered.clear();
    if(solo){W.applyState(solo);originalSave();solo=null;}oldEnter(0,false);
    get('connectionLabel').textContent='SOLO WORLD';$('footer>span').textContent='Saved on this device · Resident characters are NPCs';
    W.close();W.toast('Back in your solo world. Online progress is kept on the service.');
  }
  function panel(){
    if(!ready){
      W.panel('A world with real people','SHARED SESSIONS',`<p>Solo play works from this file. Shared sessions need the Afterhours game service.</p><div class="session-banner">The public Uno WebAssembly edition connects to the shared world automatically when you choose Join. For local play, launch the included Afterhours launcher, then open its address in another browser.</div><button id="retryWorld" class="primary">Check connection again</button>`);
      W.button('retryWorld',async()=>{await health();panel();});return;
    }
    if(!online){
      W.panel('See you after hours','JOIN THE SHARED WORLD',`<p>Meet real players, share a room, hear the same performance, and trade furniture. Your online character and your solo world have separate progress.</p><form id="joinWorldForm"><label class="form-field">Your name<input id="onlineName" maxlength="20" value="${h(W.game.state.profile.name)}"></label><button class="primary">${localStorage.getItem('afterhours-online-token')?'Continue online character':'Create online character'}</button></form><p class="small-note">A guest character is remembered in this browser. Keep this browser’s data to retain access. No email or password required.</p>`);
      if(managed){
        get('joinWorldForm').querySelector('button').textContent=window.AfterhoursAccount?.remembered()?'Continue my character':'Play as a guest';
        get('joinWorldForm').insertAdjacentHTML('beforeend','<div id="accountChallenge"></div>');
        get('joinWorldForm').nextElementSibling.innerHTML='Your progress saves to the shared world. Link Google after joining to recover it on another device. An unlinked guest depends on this browser.<br><button class="soft-button" id="restoreAccount">Restore account with Google</button>';
        if(window.AFTERHOURS_AUTH?.googleInviteOnly)get('restoreAccount').insertAdjacentHTML('beforebegin','<p>Google recovery is invite-only during this playtest. Ask the host to add your Google email before linking. Keep this browser’s data to return as a guest.</p>');
        W.button('restoreAccount',restorePanel);
      }
      get('joinWorldForm').onsubmit=async e=>{
        e.preventDefault();const button=get('joinWorldForm').querySelector('button');button.disabled=true;
        try{
          let captcha;
          if(managed&&!window.AfterhoursAccount?.remembered())captcha=await window.AfterhoursAccount.challenge(get('accountChallenge'));
          await connect(get('onlineName').value,captcha);
        }catch(error){W.toast(error.message);}finally{button.disabled=false;}
      };return;
    }
    W.panel('The world is better together','SHARED WORLD',`<div class="session-banner">Connected as <b>${h(state.self.name)}</b> · ${state.peers.length} other players in this room</div><div class="button-row"><button id="sharedRooms" class="primary">Shared rooms</button><button id="sharedStageOpen" class="soft-button">Music stage</button><button id="sharedFriendsOpen" class="soft-button">Friends & requests</button></div><div id="sharedGuestList"></div><div id="doorRequests"></div><div id="tradeInvites"></div><button class="soft-button" id="leaveOnline">Return to solo world</button>`);
    if(managed){
      get('sharedGuestList').insertAdjacentHTML('beforebegin',`<div class="session-banner account-status"><b>${account?.anonymous?'Keep your place.':'Your character is linked.'}</b><p>${account?.anonymous?'Link Google to bring your rooms, tracks, and furniture with you on another device.':'Sign in with the same Google account to recover your saved progress.'}</p>${account?.anonymous?'<button class="primary" id="linkAccount">Link Google account</button>':''}</div>`);
      W.button('linkAccount',()=>window.AfterhoursAccount.link().catch(error=>W.toast(error.message)));
      if(account?.anonymous&&window.AFTERHOURS_AUTH?.googleInviteOnly)get('linkAccount').insertAdjacentHTML('beforebegin','<p>Ask the host to add your Google email to the private playtest before linking.</p>');
      if(!account?.anonymous){
        get('leaveOnline').insertAdjacentHTML('afterend','<button class="soft-button" id="signOutAccount">Sign out on this device</button>');
        W.button('signOutAccount',()=>{
          W.panel('Your place is saved.','SIGN OUT','<p>Your rooms, furniture and tracks stay saved. Use Restore account with Google when you return. This signs out only this device.</p><button class="primary" id="confirmSignOut">Sign out</button><button class="soft-button" id="cancelSignOut">Stay here</button>');
          W.button('cancelSignOut',panel);
          W.button('confirmSignOut',async()=>{
            const button=get('confirmSignOut');button.disabled=true;
            try{await window.AfterhoursAccount.signOut();disconnect();token='';account=null;W.toast('Signed out. Restore with Google to continue your saved character.');}
            catch(error){button.disabled=false;W.toast(error.message);}
          });
        });
      }
    }
    W.button('sharedRooms',roomDirectory);W.button('sharedStageOpen',stagePanel);W.button('sharedFriendsOpen',friendsPanel);W.button('leaveOnline',disconnect);renderGuests();
  }
  function restorePanel(){
    W.panel('Welcome back.','RESTORE YOUR CHARACTER','<p>Sign in with the Google account you linked before. This opens that account’s saved character. Guest progress from another character is not merged.</p><button id="confirmRestore" class="primary">Continue with Google</button><button id="cancelRestore" class="soft-button">Back</button>');
    W.button('cancelRestore',panel);
    W.button('confirmRestore',()=>window.AfterhoursAccount.restore().catch(error=>W.toast(error.message)));
  }
  function renderGuests(){
    const host=get('sharedGuestList');if(!host||!state)return;
    host.innerHTML='<h3>In this room</h3><div class="directory-list">'+(state.peers.map(p=>`<button class="directory-room" data-live-user="${p.id}"><span class="room-symbol">●</span><span><b>${h(p.name)}</b><small>Level ${p.level} · ${h(p.motto)}</small></span><span class="live-pill">LIVE</span></button>`).join('')||'<p>No other players here yet. Open the game in another browser to meet in Side B.</p>')+'</div>';
    host.querySelectorAll('[data-live-user]').forEach(b=>b.onclick=()=>playerPanel(b.dataset.liveUser));
    if(get('doorRequests')){
      get('doorRequests').innerHTML=state.doorRequests.map(p=>`<div class="directory-room"><span><b>${h(p.name)} rang the doorbell</b></span><button class="soft-button" data-door="${p.id}">Let in</button><button class="soft-button" data-deny="${p.id}">Decline</button></div>`).join('');
      get('doorRequests').querySelectorAll('[data-door]').forEach(b=>b.onclick=()=>send('door',{user:b.dataset.door,allow:true}).then(panel));
      get('doorRequests').querySelectorAll('[data-deny]').forEach(b=>b.onclick=()=>send('door',{user:b.dataset.deny,allow:false}).then(panel));
    }
    if(get('tradeInvites')){
      const active=state.trades.filter(t=>['pending','open'].includes(t.status));
      get('tradeInvites').innerHTML=active.map(t=>`<button class="outline" data-open-trade="${t.id}">Furniture trade · ${h(t.people.find(p=>p.id!==state.self.id)?.name)} ↗</button>`).join('');
      get('tradeInvites').querySelectorAll('[data-open-trade]').forEach(b=>b.onclick=()=>tradePanel(state.trades.find(t=>t.id===b.dataset.openTrade)));
    }
  }
  function playerPanel(id){select('peer',id);
    const p=state.peers.concat(state.friends).find(p=>p.id===id);if(!p)return;
    W.panel(p.name,'CONNECTED PLAYER',`<p>${h(p.motto)}</p><p>Level ${p.level} · ${p.online?'Here tonight':'Offline'}</p><div class="button-row"><button class="primary" id="requestFriend">Add friend</button><button class="soft-button" id="inviteTrade">Trade furniture</button><button class="soft-button" id="whisperPlayer">Whisper</button><button class="soft-button" id="blockPlayer">Block</button><button class="soft-button" id="reportPlayer">Report</button>${state.room.startsWith('home:'+state.self.id+':')?'<button class="soft-button" id="kickPlayer">Remove from room</button><button class="soft-button" id="banPlayer">Ban from room</button>':''}</div>`);
    W.button('requestFriend',()=>send('friend',{user:id}).then(()=>W.toast('Friend request sent.')));
    W.button('inviteTrade',()=>send('trade',{user:id}).then(out=>tradePanel(out.snapshot.trades.find(t=>t.id===out.result.id))));
    W.button('whisperPlayer',()=>{get('chatMode').value='whisper';W.refreshWhispers();get('whisperTarget').hidden=false;get('whisperTarget').value=id;W.close();get('chatInput').focus();});
    W.button('blockPlayer',()=>send('block',{user:id}).then(()=>{W.close();W.toast('Player blocked.');}));
    W.button('reportPlayer',()=>{
      W.panel('Report a player','COMMUNITY',`<p>Tell us what happened. The report is stored for the world’s operator to review.</p><label class="form-field">Reason<textarea id="reportReason" maxlength="300"></textarea></label><button id="submitReport" class="primary">Submit report</button>`);
      W.button('submitReport',()=>send('report',{user:id,reason:get('reportReason').value}).then(()=>{W.close();W.toast('Report submitted.');}));
    });
    W.button('kickPlayer',()=>send('kick',{user:id}).then(panel));W.button('banPlayer',()=>send('ban',{user:id}).then(panel));
  }
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
  function renderFriends(host){
    if(!online||!host)return;
    host.innerHTML='<h3>Connected friends</h3>'+state.friendRequests.map(p=>`<div class="directory-room"><span><b>${h(p.name)}</b><small>Wants to be friends</small></span><button class="soft-button" data-accept-friend="${p.id}">Accept</button><button class="soft-button" data-decline-friend="${p.id}">Decline</button></div>`).join('')+
      state.friends.map(p=>`<div class="directory-room"><span><b>${h(p.name)}</b><small>${p.online?'Here now':p.lastSeen?'Seen '+ago(p.lastSeen):'Offline'}</small></span><button class="soft-button" data-follow-friend="${p.id}" ${p.online?'':'disabled'}>Follow</button><button class="text-button" data-remove-friend="${p.id}">Remove</button></div>`).join('');
    if(!state.friends.length&&!state.friendRequests.length)host.innerHTML+='<p>Click a connected player to send a friend request.</p>';
    host.querySelectorAll('[data-accept-friend]').forEach(b=>b.onclick=()=>send('answerFriend',{user:b.dataset.acceptFriend,accept:true}));
    host.querySelectorAll('[data-decline-friend]').forEach(b=>b.onclick=()=>send('answerFriend',{user:b.dataset.declineFriend,accept:false}));
    host.querySelectorAll('[data-follow-friend]').forEach(b=>b.onclick=()=>joinRoom(state.friends.find(p=>p.id===b.dataset.followFriend).room));
    host.querySelectorAll('[data-remove-friend]').forEach(b=>b.onclick=()=>send('unfriend',{user:b.dataset.removeFriend}));
  }
  const ago=time=>{const m=Math.round((Date.now()-time)/60000);if(m<1)return'just now';if(m<60)return m+' min ago';if(m<1440)return Math.round(m/60)+' h ago';return m<10080?new Date(time).toLocaleDateString(undefined,{weekday:'short'}):new Date(time).toLocaleDateString();};
  function awayPanel(){
    const items=state?.away||[];if(!items.length)return;const icon={visit:'⌂',friend:'♡',chart:'★'};
    W.panel('While you were away','SINCE YOUR LAST VISIT','<div class="away-list">'+items.slice(0,10).map(e=>`<div class="away-item"><span aria-hidden="true">${icon[e.kind]||'•'}</span><p>${h(e.text)}</p><small>${ago(e.time)}</small></div>`).join('')+
      (items.length>10?`<p class="small-note">and ${items.length-10} more</p>`:'')+'</div><button class="primary" id="awayDone">Got it</button>');
    W.button('awayDone',()=>{send('awaySeen').catch(()=>{});W.close();});
  }
  // The weekly chart and the shared stage are XAML panels in the Uno app; these feed them.
  function chartPanel(){W.openPanel('Chart');}
  function chartState(){
    const chart=state?.chart;if(!chart)return null;const self=state.self.id;
    const row=(e,mark)=>({mark:mark||String(e.rank),title:e.title,artist:e.artist,listeners:e.listeners,own:e.user===self});
    return {week:'WEEK '+chart.week.slice(-2)+' · RESETS MONDAY',top:chart.top.map(e=>row(e)),last:(chart.last?.top||[]).map(e=>row(e,['①','②','③'][e.rank-1]))};
  }
  function friendsPanel(){W.panel('Your people','FRIENDS & REQUESTS','<div id="onlineFriends"></div>');renderFriends(get('onlineFriends'));}
  function tradePanel(trade){
    if(!trade){panel();return;}const other=trade.people.find(p=>p.id!==state.self.id),self=state.self.id;
    lastTradeStatus=['pending','open'].includes(trade.status)?trade.id+':'+trade.status+':'+trade.confirmed.join(',')+':'+JSON.stringify(trade.offers):'';
    if(!['pending','open'].includes(trade.status)){
      W.panel(trade.status==='completed'?'A fair exchange.':'Trade closed','FURNITURE TRADING',`<p>${trade.status==='completed'?'Both players confirmed. Your furniture changed owners exactly once.':'Nothing changed hands.'}</p><button id="tradeInventory" class="primary">Open inventory</button>`);
      W.button('tradeInventory',()=>W.openCatalog('owned'));return;
    }
    let body=`<div id="sharedTrade"><p>Trading with <b>${h(other.name)}</b>. Changes to either offer clear both confirmations.</p>`;
    if(trade.status==='pending'){
      body+=trade.participants[1]===self?'<button id="acceptTrade" class="primary">Accept trade invitation</button>':'<p>Waiting for the other player to accept…</p>';
    }else{
      body+='<div class="trade-columns">'+trade.people.map(p=>`<div><h3>${h(p.name)} ${trade.confirmed.includes(p.id)?'✓':''}</h3><div class="trade-offer">${trade.items[p.id].map(i=>`<span>${h(AfterhoursFurniture.catalog[i.type].name)}</span>`).join('')||'<small>No pieces offered</small>'}</div></div>`).join('')+'</div>';
      body+='<p>Choose up to eight pieces from your inventory:</p><div class="trade-inventory">'+W.game.state.items.filter(i=>i.placed===false&&!i.wrapped&&!i.contents).map(i=>`<label><input type="checkbox" data-trade-item="${i.id}" ${trade.offers[self].includes(i.id)?'checked':''}>${h(AfterhoursFurniture.catalog[i.type].name)}</label>`).join('')+'</div>';
      body+='<div class="button-row"><button id="updateTradeOffer" class="soft-button">Update my offer</button><button id="confirmTrade" class="primary" '+(trade.confirmed.includes(self)?'disabled':'')+'>'+(trade.confirmed.includes(self)?'Confirmed · waiting':'Confirm this exchange')+'</button></div>';
    }
    body+='<button id="cancelTrade" class="text-button">Cancel trade</button></div>';
    W.panel('An exchange between friends','FURNITURE TRADING',body,true);
    W.button('acceptTrade',()=>send('tradeAccept',{id:trade.id}));W.button('cancelTrade',()=>send('tradeCancel',{id:trade.id}).then(out=>tradePanel(out.snapshot.trades.find(t=>t.id===trade.id))));
    W.button('updateTradeOffer',()=>send('tradeOffer',{id:trade.id,items:Array.from(get('modalBody').querySelectorAll('[data-trade-item]:checked')).map(i=>i.dataset.tradeItem)}));
    W.button('confirmTrade',()=>send('tradeConfirm',{id:trade.id}).then(out=>tradePanel(out.snapshot.trades.find(t=>t.id===trade.id))));
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
    directory:roomDirectory,roomsState,joinRoomKey,connected:()=>online,remoteRoom:()=>remote,peers:()=>state?.peers||[],panel,renderFriends,stagePanel,chartPanel,queueSong,stageState,toggleListen,
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
      localStorage.removeItem('afterhours-account-resume');connect(W.game.state.profile.name);
    }
  });
})();
