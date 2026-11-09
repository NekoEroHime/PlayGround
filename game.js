(() => {
  'use strict';
  const canvas = document.getElementById('game');
  const ctx = canvas.getContext('2d');
  const shell = document.querySelector('.game-shell');
  const roomLabel = document.querySelector('.room-name');
  const roomNumber = document.querySelector('.room-number');
  const berryCount = document.getElementById('berryCount');
  const progressDots = document.getElementById('progressDots');
  const introCard = document.getElementById('introCard');
  const finishCard = document.getElementById('finishCard');
  const roomTransition = document.getElementById('roomTransition');
  const toast = document.getElementById('toast');
  const controlsHint = document.getElementById('controlsHint');
  const soundButton = document.getElementById('soundButton');
  const W = 960, H = 540;
  const rooms = [
    { name:'THE FOOTHILLS', spawn:[58,468], berry:[407,311], platforms:[[0,510,960,40],[142,426,132,18],[302,350,125,18],[460,279,128,18],[620,207,120,18],[759,134,145,18]], spikes:[[276,510,52],[575,510,58],[741,510,42]], goal:[866,83] },
    { name:'THE WINDING PATH', spawn:[55,468], berry:[615,238], platforms:[[0,510,960,40],[82,428,138,18],[279,353,115,18],[442,288,130,18],[625,218,122,18],[778,142,125,18]], spikes:[[232,510,58],[411,510,48],[580,510,55],[746,510,45],[317,353,33]], goal:[851,91] },
    { name:'THE BLUE HOLLOW', spawn:[55,468], berry:[465,227], platforms:[[0,510,960,40],[82,427,112,18],[244,357,140,18],[442,286,118,18],[594,214,119,18],[768,142,130,18],[368,438,110,16]], spikes:[[209,510,53],[398,510,65],[562,510,61],[731,510,50],[282,357,34]], goal:[865,91], checkpoint:[422,252] },
    { name:'ABOVE THE CLOUDS', spawn:[55,468], berry:[681,177], platforms:[[0,510,960,40],[90,433,120,18],[270,363,122,18],[448,291,115,18],[604,220,123,18],[773,146,130,18]], spikes:[[228,510,58],[421,510,54],[579,510,51],[742,510,54],[321,363,33],[644,220,31]], goal:[862,95] },
    { name:'THE SUMMIT', spawn:[55,468], berry:[492,197], platforms:[[0,510,960,40],[79,433,126,18],[247,363,125,18],[420,292,126,18],[594,220,128,18],[768,147,130,18],[674,75,120,16]], spikes:[[225,510,56],[397,510,55],[571,510,55],[741,510,55],[300,363,32]], goal:[727,28] }
  ];
  const palettes = [
    ['#182a42','#35536b','#71909a','#e8c79c'],
    ['#18263d','#344966','#657d8d','#e9c292'],
    ['#19263e','#334765','#66818c','#e8c58f'],
    ['#1b2b45','#394e68','#77909a','#f0c99b'],
    ['#24324c','#465c72','#91a3a2','#ffdaa5']
  ];
  const keys = Object.create(null), pressed = Object.create(null);
  let roomIndex = 0, mode = 'intro', lastTime = 0, time = 0, audioCtx = null, soundOn = true;
  let collected = new Set(), deaths = 0, particles = [], clouds = [], checkpoint = null, checkpointReached = false, toastTimer = 0, transitionTimer = 0;
  const player = { x:58,y:468,w:19,h:27,vx:0,vy:0,face:1,onGround:false,wall:0,dashReady:true,dashTime:0,trail:[],landSquash:0 };
  for(let i=0;i<36;i++) clouds.push({x:(i*173)%1100-70,y:50+(i*83)%390,s:.45+(i%5)*.11,a:.04+(i%4)*.018});
  for(let i=0;i<5;i++){const dot=document.createElement('span');progressDots.appendChild(dot)}
  function resize(){const dpr=Math.min(window.devicePixelRatio||1,2);const r=shell.getBoundingClientRect();canvas.width=Math.round(r.width*dpr);canvas.height=Math.round(r.height*dpr);ctx.setTransform(canvas.width/W,0,0,canvas.height/H,0,0)}
  window.addEventListener('resize',resize); resize();
  function audio(type='jump'){if(!soundOn)return;try{audioCtx ||= new (window.AudioContext||window.webkitAudioContext)();if(audioCtx.state==='suspended')audioCtx.resume();const o=audioCtx.createOscillator(),g=audioCtx.createGain();o.connect(g);g.connect(audioCtx.destination);const now=audioCtx.currentTime;const cfg=type==='dash'?[380,180,.12,'sawtooth']:type==='death'?[190,65,.23,'triangle']:type==='berry'?[600,1040,.22,'sine']:type==='win'?[440,990,.5,'sine']:type==='land'?[120,80,.06,'triangle']:[260,420,.11,'sine'];o.type=cfg[3];o.frequency.setValueAtTime(cfg[0],now);o.frequency.exponentialRampToValueAtTime(cfg[1],now+cfg[2]);g.gain.setValueAtTime(.055,now);g.gain.exponentialRampToValueAtTime(.001,now+cfg[2]);o.start(now);o.stop(now+cfg[2]+.01)}catch(e){}}
  soundButton.addEventListener('click',()=>{soundOn=!soundOn;soundButton.innerHTML=soundOn?'♫ <span>SOUND ON</span>':'♫ <span>SOUND OFF</span>';if(soundOn)audio('berry')});
  function setMode(next){mode=next;shell.classList.toggle('intro',next==='intro');shell.classList.toggle('playing',next==='playing');shell.classList.toggle('finished',next==='finished');introCard.classList.toggle('hidden',next!=='intro');finishCard.classList.toggle('hidden',next!=='finished');controlsHint.style.display=next==='playing'?'':'none'}
  document.getElementById('startButton').addEventListener('click',startGame);
  document.getElementById('againButton').addEventListener('click',()=>{collected.clear();deaths=0;roomIndex=0;checkpoint=null;updateHUD();startGame()});
  function startGame(){setMode('playing');loadRoom(0);audio('jump');lastTime=performance.now()}
  function loadRoom(n){roomIndex=n;const r=rooms[n];player.x=r.spawn[0];player.y=483;player.vx=0;player.vy=0;player.face=1;player.dashReady=true;player.dashTime=0;player.trail=[];player.onGround=true;player.wall=0;checkpoint=null;checkpointReached=false;updateHUD()}
  function updateHUD(){const r=rooms[roomIndex];roomLabel.textContent=r.name;roomNumber.textContent=String(roomIndex+1).padStart(2,'0');berryCount.textContent=collected.size;Array.from(progressDots.children).forEach((d,i)=>{d.className=i<roomIndex?'done':i===roomIndex?'active':''})}
  function showToast(text){toast.textContent=text;toast.classList.add('show');toastTimer=1.7}
  const keyMap={ArrowLeft:'left',KeyA:'left',ArrowRight:'right',KeyD:'right',Space:'jump',ArrowUp:'jump',KeyW:'jump',KeyZ:'jump',KeyX:'dash',ShiftLeft:'dash',ShiftRight:'dash'};
  window.addEventListener('keydown',e=>{const action=keyMap[e.code];if(action){e.preventDefault();if(!keys[action])pressed[action]=true;keys[action]=true}if(e.code==='Enter'&&mode==='intro')startGame();if(e.code==='KeyR'&&mode==='playing')loadRoom(roomIndex)});
  window.addEventListener('keyup',e=>{const action=keyMap[e.code];if(action){keys[action]=false}});
  window.addEventListener('blur',()=>{for(const k in keys)keys[k]=false});
  document.querySelectorAll('.touch-controls button').forEach(button=>{const a=button.dataset.control;const down=e=>{e.preventDefault();button.classList.add('pressed');if(a==='left'||a==='right')keys[a]=true;else{pressed[a]=true;keys[a]=true}};const up=e=>{e.preventDefault();button.classList.remove('pressed');keys[a]=false};button.addEventListener('pointerdown',down);button.addEventListener('pointerup',up);button.addEventListener('pointercancel',up);button.addEventListener('pointerleave',up)});
  document.addEventListener('contextmenu',e=>e.preventDefault());
  function movePlayer(dt){const r=rooms[roomIndex], oldX=player.x,oldY=player.y,wasGround=player.onGround;const axis=(keys.right?1:0)-(keys.left?1:0);if(axis)player.face=axis;
    if(player.dashTime>0){player.dashTime-=dt;player.vx=player.dashVX;player.vy=player.dashVY;if(player.dashTime<=0){player.dashTime=0;player.vy=Math.max(player.vy,100)}}else{
      const accel=player.onGround?2700:1780, max=player.onGround?230:218;player.vx+=axis*accel*dt;if(!axis)player.vx*=Math.pow(player.onGround?.001:.19,dt);player.vx=Math.max(-max,Math.min(max,player.vx));player.vy=Math.min(800,player.vy+1450*dt);
      if(pressed.jump){if(player.onGround){player.vy=-515;player.onGround=false;player.landSquash=.12;audio('jump')}else if(player.wall){player.vx=-player.wall*340;player.vy=-485;player.face=-player.wall;player.wall=0;audio('jump');burst(player.x+player.w/2,player.y+player.h*.7,'#c4e4de',6)}}
      if(pressed.dash&&player.dashReady){let dx=(keys.right?1:0)-(keys.left?1:0),dy=(keys.jump?1:0)-(keys.down?1:0);if(!dx&&!dy)dx=player.face;if(dx&&dy){dx*=.707;dy*=.707}player.dashVX=dx*610;player.dashVY=dy*610;player.vx=player.dashVX;player.vy=player.dashVY;player.dashTime=.145;player.dashReady=false;audio('dash');burst(player.x+player.w/2,player.y+player.h/2,'#9bd8d2',8)}
    }
    player.x+=player.vx*dt;player.y+=player.vy*dt;player.wall=0;
    if(player.x<0){player.x=0;player.vx=0;player.wall=1}if(player.x+player.w>W){player.x=W-player.w;player.vx=0;player.wall=-1}
    player.onGround=false;
    for(const p of r.platforms){const [x,y,w,h]=p;if(player.x+player.w<=x||player.x>=x+w||player.y+player.h<=y||player.y>=y+h)continue;
      if(oldY+player.h<=y+3&&player.vy>=0){player.y=y-player.h;player.vy=0;player.onGround=true;player.dashReady=true;player.landSquash=.1}
      else if(oldY>=y+h-2&&player.vy<0){player.y=y+h;player.vy=0}
      else if(oldX+player.w<=x+4&&player.vx>0){player.x=x-player.w;player.vx=0;player.wall=1}
      else if(oldX>=x+w-4&&player.vx<0){player.x=x+w;player.vx=0;player.wall=-1}
    }
    if(!player.onGround&&player.wall&&player.vy>115)player.vy=115;
    if(!wasGround&&player.onGround&&Math.abs(player.vx)>80)audio('land');
    if(player.y>H+30){die()}
    if(player.dashTime===0&&Math.abs(player.vx)>30&&Math.random()<.35)player.trail.push({x:player.x,y:player.y,a:.35});player.trail=player.trail.filter(t=>{t.a-=dt*1.6;return t.a>0});
    if(player.landSquash>0)player.landSquash=Math.max(0,player.landSquash-dt);
  }
  function die(){deaths++;audio('death');burst(player.x+player.w/2,player.y+player.h/2,'#f2a58d',15);if(checkpoint){player.x=checkpoint.x;player.y=checkpoint.y;player.vx=0;player.vy=0;player.dashReady=true}else{const s=rooms[roomIndex].spawn;player.x=s[0];player.y=483;player.vx=0;player.vy=0;player.dashReady=true;player.onGround=true}showToast('THE MOUNTAIN CAN WAIT. TRY AGAIN.');}
  function overlap(a,b){return a.x<b.x+b.w&&a.x+a.w>b.x&&a.y<b.y+b.h&&a.y+a.h>b.y}
  function burst(x,y,color,count){for(let i=0;i<count;i++){const ang=Math.random()*Math.PI*2,spd=45+Math.random()*180;particles.push({x,y,vx:Math.cos(ang)*spd,vy:Math.sin(ang)*spd,a:.55+Math.random()*.35,color,size:1.5+Math.random()*3})}}
  function update(dt){time+=dt;if(mode!=='playing'){updateParticles(dt);return}movePlayer(dt);const r=rooms[roomIndex];const pr={x:player.x+3,y:player.y+3,w:player.w-6,h:player.h-5};
    for(const s of r.spikes){const box={x:s[0]+4,y:s[1]-13,w:s[2]-8,h:16};if(overlap(pr,box)){die();break}}
    if(r.berry&&!collected.has(roomIndex)){const [bx,by]=r.berry;if(Math.hypot(player.x+player.w/2-bx,player.y+player.h/2-by)<24){collected.add(roomIndex);updateHUD();audio('berry');burst(bx,by,'#ffd08d',15);showToast('A LITTLE LIGHT TO CARRY.') }}
    if(r.checkpoint&&!checkpointReached){const [cx,cy]=r.checkpoint;if(Math.hypot(player.x+player.w/2-cx,player.y+player.h/2-cy)<29){checkpoint={x:cx-10,y:cy-31};checkpointReached=true;showToast('A MOMENT TO CATCH YOUR BREATH.');burst(cx,cy,'#9bd8d2',12)}}
    if(Math.hypot(player.x+player.w/2-r.goal[0],player.y+player.h/2-r.goal[1])<35){if(roomIndex<rooms.length-1){transitionRoom()}else{mode='finished';setMode('finished');audio('win');document.getElementById('finishSummary').textContent=`${collected.size} little lights found. ${deaths?`${deaths} falls, and you kept going.`:'Not a single fall. Quite the climb.'}`;burst(r.goal[0],r.goal[1],'#ffda9d',34)}}
    updateParticles(dt);if(toastTimer>0){toastTimer-=dt;if(toastTimer<=0)toast.classList.remove('show')}
  }
  function transitionRoom(){roomIndex++;transitionTimer=.8;roomTransition.classList.remove('show');void roomTransition.offsetWidth;roomTransition.classList.add('show');audio('berry');loadRoom(roomIndex);}
  function updateParticles(dt){particles=particles.filter(p=>p.a>0);for(const p of particles){p.x+=p.vx*dt;p.y+=p.vy*dt;p.vy+=250*dt;p.a-=dt}}
  function drawBackground(){const pal=palettes[roomIndex];const g=ctx.createLinearGradient(0,0,0,H);g.addColorStop(0,pal[0]);g.addColorStop(.63,pal[1]);g.addColorStop(1,'#789395');ctx.fillStyle=g;ctx.fillRect(0,0,W,H);
    // dusk glow and stars
    const glow=ctx.createRadialGradient(690,125,4,690,125,390);glow.addColorStop(0,roomIndex===4?'#ffe5b644':'#c6e1d414');glow.addColorStop(1,'#c6e1d400');ctx.fillStyle=glow;ctx.fillRect(250,0,710,440);
    for(let i=0;i<78;i++){let x=(i*173+31)%W,y=(i*97+22)%390;const tw=.35+.35*Math.sin(time*1.5+i);ctx.globalAlpha=(i%3===0?.52:.22)*tw;ctx.fillStyle=i%8===0?'#ffe3bd':'#eaf4e9';ctx.fillRect(x,y, i%8===0?2:1, i%8===0?2:1)}ctx.globalAlpha=1;
    for(const c of clouds){const x=(c.x-time*(4+c.s*4)+1250)%1100-70;ctx.globalAlpha=c.a;ctx.fillStyle='#d5e0dc';ctx.beginPath();ctx.ellipse(x,c.y,c.s*75,c.s*11,0,0,Math.PI*2);ctx.fill();ctx.ellipse(x-30*c.s,c.y+3,c.s*43,c.s*8,0,0,Math.PI*2);ctx.fill()}ctx.globalAlpha=1;
    mountainLayer(370,0.12,'#263d55');mountainLayer(420,0.24,'#304b60');mountainLayer(464,0.38,'#3f5e70');
    // far floating snow haze
    const haze=ctx.createLinearGradient(0,380,0,510);haze.addColorStop(0,'#a8c0bc00');haze.addColorStop(1,'#d3dfd52a');ctx.fillStyle=haze;ctx.fillRect(0,370,W,140);
  }
  function mountainLayer(base,seed,color){ctx.fillStyle=color;ctx.beginPath();ctx.moveTo(0,H);for(let x=0;x<=W;x+=40){const y=base-Math.sin(x*.008+seed*9)*30-Math.sin(x*.019+seed*3)*20;ctx.lineTo(x,y)}ctx.lineTo(W,H);ctx.closePath();ctx.fill();ctx.globalAlpha=.22;ctx.strokeStyle='#d4e4dc';ctx.lineWidth=1;ctx.beginPath();for(let x=0;x<=W;x+=40){const y=base-Math.sin(x*.008+seed*9)*30-Math.sin(x*.019+seed*3)*20; if(x===0)ctx.moveTo(x,y);else ctx.lineTo(x,y)}ctx.stroke();ctx.globalAlpha=1}
  function drawPlatforms(){const pal=palettes[roomIndex];for(const [x,y,w,h] of rooms[roomIndex].platforms){ctx.fillStyle='#19283b';ctx.fillRect(x,y,w,h);ctx.fillStyle=pal[2];ctx.fillRect(x,y,w,4);ctx.fillStyle='#c8d8ca26';ctx.fillRect(x,y+5,w,1);for(let xx=x+9;xx<x+w;xx+=24){ctx.fillStyle='#d6dfd111';ctx.fillRect(xx,y+9,8,1)}
      // Snow lip and tiny icicle edges
      ctx.fillStyle='#dbe4d7';ctx.fillRect(x,y-2,w,3);ctx.globalAlpha=.62;ctx.fillStyle='#afc7c3';for(let xx=x+13;xx<x+w-7;xx+=31){ctx.beginPath();ctx.moveTo(xx,y+4);ctx.lineTo(xx+3,y+10+(xx%3));ctx.lineTo(xx+6,y+4);ctx.fill()}ctx.globalAlpha=1;
    }}
  function drawSpikes(){for(const [x,y,w] of rooms[roomIndex].spikes){ctx.fillStyle='#c68f83';ctx.globalAlpha=.91;for(let xx=x;xx<x+w;xx+=17){ctx.beginPath();ctx.moveTo(xx,y);ctx.lineTo(xx+8,y-15);ctx.lineTo(xx+16,y);ctx.closePath();ctx.fill();ctx.fillStyle='#e8b8a0';ctx.fillRect(xx+7,y-6,2,5);ctx.fillStyle='#c68f83'}ctx.globalAlpha=1}}
  function drawBerry(){const b=rooms[roomIndex].berry;if(!b||collected.has(roomIndex))return;const bob=Math.sin(time*3.2)*4;ctx.save();ctx.translate(b[0],b[1]+bob);ctx.shadowColor='#ffd18d';ctx.shadowBlur=20;ctx.fillStyle='#ffd28e';ctx.beginPath();ctx.arc(0,0,8+Math.sin(time*4)*1.2,0,Math.PI*2);ctx.fill();ctx.shadowBlur=0;ctx.fillStyle='#fff0c7';ctx.beginPath();ctx.arc(-2,-2,2.4,0,Math.PI*2);ctx.fill();ctx.strokeStyle='#bee1c3';ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(0,-7);ctx.quadraticCurveTo(1,-13,6,-12);ctx.stroke();ctx.restore()}
  function drawGoal(){const [x,y]=rooms[roomIndex].goal;const pulse=.5+.5*Math.sin(time*3);ctx.save();ctx.translate(x,y);ctx.globalAlpha=.22+pulse*.12;ctx.fillStyle='#ffe2a6';ctx.beginPath();ctx.arc(0,0,24+pulse*5,0,Math.PI*2);ctx.fill();ctx.globalAlpha=1;ctx.strokeStyle='#ffe4b2';ctx.lineWidth=2;ctx.beginPath();ctx.arc(0,0,12+pulse*2,0,Math.PI*2);ctx.stroke();ctx.fillStyle='#ffe7bd';ctx.font='16px serif';ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText('✦',0,0);ctx.restore()}
  function drawCheckpoint(){const p=rooms[roomIndex].checkpoint;if(!p)return;const [x,y]=p;ctx.save();ctx.translate(x,y);ctx.strokeStyle='#a8ded0';ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(0,17);ctx.lineTo(0,-12);ctx.stroke();ctx.fillStyle='#9dd8c9';ctx.beginPath();ctx.moveTo(1,-12);ctx.lineTo(15,-7);ctx.lineTo(1,-1);ctx.closePath();ctx.fill();ctx.globalAlpha=.25+.18*Math.sin(time*3);ctx.fillStyle='#a8e3d4';ctx.beginPath();ctx.arc(0,0,23,0,Math.PI*2);ctx.fill();ctx.restore()}
  function drawPlayer(){for(const t of player.trail){ctx.globalAlpha=Math.max(0,t.a*.5);ctx.fillStyle='#9bd8d2';ctx.fillRect(t.x,t.y,player.w,player.h)}ctx.globalAlpha=1;const squash=player.landSquash>0?Math.sin(player.landSquash/.12*Math.PI)*.14:0;const px=player.x,py=player.y;ctx.save();ctx.translate(px+player.w/2,py+player.h);ctx.scale(1+squash,1-squash);ctx.translate(-player.w/2,-player.h);const dashing=player.dashTime>0;
    // soft little shadow
    ctx.globalAlpha=.2;ctx.fillStyle='#09152a';ctx.beginPath();ctx.ellipse(player.w/2,player.h+2,10,3,0,0,Math.PI*2);ctx.fill();ctx.globalAlpha=1;
    // scarf flying behind the runner
    ctx.fillStyle=dashing?'#fff0ce':'#db7771';ctx.beginPath();ctx.moveTo(player.w/2-2,11);ctx.lineTo(player.w/2-player.face*8,13);ctx.lineTo(player.w/2-player.face*(15+(dashing?10:Math.sin(time*16)*3)),17);ctx.lineTo(player.w/2-player.face*5,16);ctx.closePath();ctx.fill();
    ctx.fillStyle=dashing?'#d8f4e9':'#4c343d';ctx.fillRect(4,16,5,9);ctx.fillRect(11,16,5,9);ctx.fillStyle='#25364a';ctx.fillRect(3,23,7,3);ctx.fillRect(10,23,7,3);
    ctx.fillStyle=dashing?'#b9eee0':'#d87670';ctx.fillRect(3,8,14,11);ctx.fillStyle='#efb39a';ctx.fillRect(5,1,12,11);ctx.fillStyle='#7d5254';ctx.fillRect(4,0,12,4);ctx.fillRect(3,3,4,5);ctx.fillStyle='#4b3b44';ctx.fillRect(player.face>0?13:7,5,2,2);ctx.fillStyle='#ffe3be';ctx.fillRect(player.face>0?14:7,5,1,1);
    if(dashing){ctx.globalAlpha=.6;ctx.strokeStyle='#def5db';ctx.lineWidth=2;ctx.beginPath();ctx.arc(10,13,18+Math.random()*2,0,Math.PI*2);ctx.stroke()}ctx.restore();}
  function drawParticles(){for(const p of particles){ctx.globalAlpha=Math.max(0,p.a);ctx.fillStyle=p.color;ctx.fillRect(p.x,p.y,p.size,p.size)}ctx.globalAlpha=1}
  function render(){ctx.clearRect(0,0,W,H);drawBackground();drawPlatforms();drawSpikes();drawCheckpoint();drawBerry();drawGoal();drawParticles();drawPlayer();
    // very subtle climbing glow at the top
    const v=ctx.createLinearGradient(0,0,0,95);v.addColorStop(0,'#fce5b90b');v.addColorStop(1,'#fce5b900');ctx.fillStyle=v;ctx.fillRect(0,0,W,95);
  }
  function frame(now){const dt=Math.min(.033,(now-lastTime)/1000||0);lastTime=now;update(dt);render();for(const k in pressed)pressed[k]=false;requestAnimationFrame(frame)}
  updateHUD();setMode('intro');requestAnimationFrame(frame);
})();
