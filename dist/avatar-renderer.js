/* Paper-doll sprites: original transparent art, independently tinted at runtime. */
(()=>{
 'use strict';
 const W=AfterhoursWardrobe, images={},parts=new Map(),bodies=new Map();
 const files={head:'wardrobe-heads-v1.webp',top:'wardrobe-tops-v1.webp',bottom:'wardrobe-bottoms-v1.webp'};
 let ready=null;
 const load=()=>ready??=Promise.all(Object.entries(files).map(([id,file])=>new Promise(resolve=>{const img=new Image();images[id]=img;img.onload=resolve;img.onerror=resolve;img.src=(window.AfterhoursBase||'')+'assets/'+file;})));
 const heads=[[[244,12,240,235],[551,10,231,234]],[[176,253,326,258],[529,252,300,258]],[[201,511,278,227],[552,517,239,220]],[[210,738,247,252],[548,742,244,248]],[[199,990,298,244],[543,990,250,241]],[[242,1236,239,279],[561,1239,229,277]]];
 const headPins=[[[328,241],[660,238]],[[330,500],[670,500]],[[333,728],[668,730]],[[339,965],[672,968]],[[330,1221],[665,1221]],[[333,1496],[670,1488]]];
 const tops=[[[55,24,267,317],[401,20,286,317],[757,46,277,264]],[[56,348,281,361],[398,349,292,358],[762,377,286,299]],[[52,709,293,351],[400,711,291,344],[753,737,296,291]],[[52,1067,286,360],[398,1065,292,351],[748,1096,310,292]]];
 const topPins=[[[196,44],[545,35],[878,72]],[[204,385],[550,381],[882,410]],[[196,752],[548,733],[872,773]],[[200,1107],[549,1094],[870,1135]]];
 const topLengths=[[250,255,220],[266,270,220],[239,246,195],[278,277,212]];
 const bottoms=[[[47,4,231,355],[389,4,243,348],[729,77,283,291]],[[31,373,272,370],[395,373,268,359],[729,445,286,303]],[[32,755,277,376],[383,758,271,356],[729,845,286,284]],[[43,1138,263,385],[392,1133,266,382],[730,1212,289,305]]];
 const bottomPins=[[[181,16],[514,17],[787,89]],[[177,386],[516,383],[793,458]],[[180,767],[512,769],[786,856]],[[184,1148],[511,1148],[790,1226]]];
 const rgb=hex=>[1,3,5].map(i=>parseInt(hex.slice(i,i+2),16));
 function remember(cache,key,value,max){cache.set(key,value);if(cache.size>max)cache.delete(cache.keys().next().value);return value;}
 function part(kind,index,pose,colour,skin){
  const key=[kind,index,pose,colour,skin].join(':');if(parts.has(key))return parts.get(key);
  const crop=({head:heads,top:tops,bottom:bottoms})[kind][index][pose],img=images[kind];if(!img){load();return null;}if(!img.complete||!img.naturalWidth)return null;
  const c=document.createElement('canvas');[c.width,c.height]=crop.slice(2);const ctx=c.getContext('2d',{willReadFrequently:true});ctx.drawImage(img,...crop,0,0,c.width,c.height);
  const pixels=ctx.getImageData(0,0,c.width,c.height),d=pixels.data,cloth=rgb(colour),flesh=rgb(skin);
  for(let i=0;i<d.length;i+=4){if(!d[i+3])continue;const r=d[i],g=d[i+1],b=d[i+2],l=(r*.3+g*.59+b*.11),warm=r-g>18&&g-b>10&&(r-Math.min(g,b))/Math.max(1,r)>.35;
   const y=Math.floor(i/4/c.width)/c.height;
   // Keep shoes, cream jacket sleeves, white eyes and near-black outlines intact.
   const neutral=Math.max(r,g,b)-Math.min(r,g,b)<35&&l<225&&l>33&&(kind!=='bottom'||y<.77);
   if(!warm&&!neutral)continue;const target=warm?flesh:cloth,base=warm?150:128;
   for(let k=0;k<3;k++)d[i+k]=Math.min(255,Math.round(target[k]*Math.min(1,l/base)+Math.max(0,l-base)*.72));
  }
  ctx.putImageData(pixels,0,0);return remember(parts,key,c,96);
 }
 function body(raw,pose='front'){
  const outfit=W.normalize(raw);if(!outfit)return null;const key=W.key(outfit)+pose;if(bodies.has(key))return bodies.get(key);
  const hi=W.hair.findIndex(x=>x[0]===outfit.hair),ti=W.tops.findIndex(x=>x[0]===outfit.top),bi=W.bottoms.findIndex(x=>x[0]===outfit.bottom),p=pose==='back'?1:pose==='seated'?2:0,hp=p===1?1:0,sit=p===2;
  const skin=W.colour('skinColors',outfit.skin),head=part('head',hi,hp,W.colour('hairColors',outfit.hairColor),skin),top=part('top',ti,p,W.colour('colors',outfit.topColor),skin),bottom=part('bottom',bi,p,W.colour('colors',outfit.bottomColor),skin);
  if(!head||!top||!bottom)return null;
  const c=document.createElement('canvas');c.width=220;c.height=340;const ctx=c.getContext('2d');ctx.scale(2,2);ctx.translate(55,130);ctx.imageSmoothingEnabled=true;
  const place=(image,crop,pin,scale,x,y)=>ctx.drawImage(image,x-(pin[0]-crop[0])*scale,y-(pin[1]-crop[1])*scale,image.width*scale,image.height*scale);
  const bottomScale=(sit?42:52)/(bottoms[bi][p][3]-(bottomPins[bi][p][1]-bottoms[bi][p][1])),topScale=43/topLengths[ti][p];
  const bottomY=sit?-4:-49,waist=bottomY-(bottomPins[bi][p][1]-bottoms[bi][p][1])*bottomScale,hem=(sit?-52:-91)-(topPins[ti][p][1]-tops[ti][p][1])*topScale+top.height*topScale;
  // Short tops on a seated body can stop above the waistband; lower the torso until they overlap by 6 px.
  const neck=(sit?-52:-91)+Math.max(0,waist+6-hem);
  place(bottom,bottoms[bi][p],bottomPins[bi][p],bottomScale,sit?-3:0,bottomY);
  place(top,tops[ti][p],topPins[ti][p],topScale,0,neck);
  place(head,heads[hi][hp],headPins[hi][hp],.15,0,neck);
  return remember(bodies,key,c,64);
 }
 function draw(ctx,outfit,{back=false,flip=false,seated=false,moving=false,phase=0,reducedMotion=false}={}){
  const art=body(outfit,seated?'seated':back?'back':'front');if(!art)return false;
  ctx.save();if(flip)ctx.scale(-1,1);ctx.imageSmoothingEnabled=true;
  if(seated||!moving){ctx.drawImage(art,-55,-130,110,170);}else{
   const stride=Math.sin(phase),hip=-49,split=(130+hip)*2;
   for(const side of [-1,1]){const swing=stride*side,pivot=side*8;ctx.save();ctx.translate(pivot,hip);ctx.rotate(swing*.21);ctx.translate(swing*1.5,-Math.max(0,swing)*4);ctx.drawImage(art,side<0?0:110,split,110,340-split,(side<0?-55:0)-pivot,0,55,(340-split)/2);ctx.restore();}
   ctx.translate(0,reducedMotion?0:-Math.abs(stride)*1.5);ctx.rotate(stride*.012);ctx.drawImage(art,0,0,220,split+4,-55,-130,110,split/2+2);
  }ctx.restore();return true;
 }
 function preview(canvas,outfit,pose='front',portrait=false){
  const ctx=canvas.getContext('2d');ctx.clearRect(0,0,canvas.width,canvas.height);const art=body(outfit,pose);if(!art)return;
  if(portrait)ctx.drawImage(art,40,0,140,160,0,0,canvas.width,canvas.height);
  else{const scale=Math.min(canvas.width/125,canvas.height/170);ctx.save();ctx.translate(canvas.width/2,canvas.height*.83);ctx.scale(scale,scale);draw(ctx,outfit,{back:pose==='back',seated:pose==='seated'});ctx.restore();}
 }
 window.AfterhoursAvatar={load,draw,preview};
})();
