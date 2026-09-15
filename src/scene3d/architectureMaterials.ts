import * as THREE from 'three'
let cache: { shell:THREE.MeshStandardMaterial; facade:THREE.MeshStandardMaterial; roof:THREE.MeshStandardMaterial; tank:THREE.MeshStandardMaterial; neutral:THREE.MeshStandardMaterial } | null = null
function texture(width:number,height:number,paint:(ctx:CanvasRenderingContext2D)=>void){
 const canvas=document.createElement('canvas');canvas.width=width;canvas.height=height
 const ctx=canvas.getContext('2d')!;paint(ctx)
 const t=new THREE.CanvasTexture(canvas);t.colorSpace=THREE.SRGBColorSpace;t.anisotropy=4;return t
}
/** Purposeful architectural panel textures; these are visual materials, not physical analysis inputs. */
export function architectureMaterials(){
 if(cache)return cache
 let seed=1049;const random=()=>{seed=(seed*1664525+1013904223)>>>0;return seed/4294967296}
 const grain=(ctx:CanvasRenderingContext2D,w:number,h:number)=>{for(let k=0;k<16000;k++){const a=random()*.065;ctx.fillStyle=`rgba(82,50,33,${a})`;ctx.fillRect(random()*w,random()*h,.6+random()*2,.6+random()*3)}}
 const shell=texture(2048,1024,ctx=>{
  ctx.fillStyle='#ddd9c8';ctx.fillRect(0,0,2048,1024)
  const cols=24,rows=10
  for(let j=0;j<rows;j++)for(let i=0;i<cols;i++){
   const x=i*2048/cols,y=j*1024/rows,w=2048/cols,h=1024/rows
   ctx.fillStyle=['#d8d5c7','#d9d6c8','#d6d3c5','#dbd8ca'][(i+j*3)%4];ctx.fillRect(x+2,y+2,w-4,h-4)
   ctx.strokeStyle='#a4a293';ctx.lineWidth=1.8;ctx.strokeRect(x+3,y+3,w-6,h-6)
   if(j===7&&i%3!==0){ctx.fillStyle='#263d42';ctx.fillRect(x+8,y+10,w-16,h-20);ctx.fillStyle='#466775';ctx.fillRect(x+11,y+13,w-22,6);ctx.strokeStyle='#8c9d93';ctx.strokeRect(x+8,y+10,w-16,h-20)}
   ctx.fillStyle='#8a8d80';for(const dx of [6,w-7])for(const dy of [6,h-7])ctx.fillRect(x+dx,y+dy,2,2)
  }
  ctx.fillStyle='#424940';ctx.fillRect(0,954,2048,70);ctx.fillStyle='#92978a';ctx.fillRect(0,950,2048,4)
  ctx.fillStyle='#958e70';ctx.fillRect(0,12,2048,5);grain(ctx,2048,1024)
 })
 const shellRelief=texture(2048,1024,ctx=>{
  ctx.fillStyle='#bebebe';ctx.fillRect(0,0,2048,1024)
  for(let j=0;j<10;j++)for(let i=0;i<24;i++){
   const x=i*2048/24,y=j*1024/10,w=2048/24,h=1024/10
   ctx.strokeStyle='#545454';ctx.lineWidth=4;ctx.strokeRect(x+2,y+2,w-4,h-4)
   if(j===7&&i%3!==0){ctx.fillStyle='#424242';ctx.fillRect(x+8,y+10,w-16,h-20)}
  }
 })
 shellRelief.colorSpace=THREE.NoColorSpace
 const facade=texture(1024,512,ctx=>{
  ctx.fillStyle='#cccbbc';ctx.fillRect(0,0,1024,512)
  for(let i=0;i<8;i++){const x=i*128;ctx.fillStyle=i%3===0?'#b3b8ab':'#d3d3c2';ctx.fillRect(x+3,3,122,506);ctx.fillStyle='#787d70';ctx.fillRect(x,0,3,512)
   if(i<5){ctx.fillStyle='#23373c';ctx.fillRect(x+16,118,96,94);ctx.fillStyle='#6a8690';ctx.fillRect(x+18,120,92,5);ctx.fillStyle='#1c2929';ctx.fillRect(x+61,118,3,94)}
   if(i===6){ctx.fillStyle='#737b70';ctx.fillRect(x+10,185,109,270);ctx.fillStyle='#34423f';ctx.fillRect(x+22,200,85,245);ctx.fillStyle='#b8b8a1';ctx.fillRect(x+91,317,5,28)}
   if(i===7)for(let y=330;y<420;y+=9){ctx.fillStyle='#6b7168';ctx.fillRect(x+18,y,91,4)}
  }
  ctx.fillStyle='#626b60';ctx.fillRect(0,452,1024,60);ctx.fillStyle='#aa6740';ctx.fillRect(0,434,1024,8);grain(ctx,1024,512)
 })
 const roof=texture(512,512,ctx=>{
  ctx.fillStyle='#999d8c';ctx.fillRect(0,0,512,512)
  for(let x=12;x<512;x+=30){ctx.fillStyle='#697565';ctx.fillRect(x,0,2,512);ctx.fillStyle='#c5c7b4';ctx.fillRect(x+3,0,2,512)}
  ctx.fillStyle='#45544c';ctx.fillRect(95,115,185,200);ctx.strokeStyle='#c4c7b3';ctx.lineWidth=6;ctx.strokeRect(95,115,185,200)
  for(let y=129;y<300;y+=12){ctx.fillStyle='#929d89';ctx.fillRect(108,y,156,5)}
  ctx.fillStyle='#c3c4ad';ctx.fillRect(347,70,100,95);ctx.fillStyle='#717d6b';ctx.fillRect(356,79,82,77);grain(ctx,512,512)
 })
 const tank=texture(1024,512,ctx=>{
  ctx.fillStyle='#a6ac9e';ctx.fillRect(0,0,1024,512)
  for(let y=26;y<512;y+=95){ctx.fillStyle='#737e72';ctx.fillRect(0,y,1024,5);ctx.fillStyle='#d2d5c1';ctx.fillRect(0,y+5,1024,2)}
  for(let x=20;x<1024;x+=170){ctx.fillStyle='#8e998b';ctx.fillRect(x,0,2,512)}grain(ctx,1024,512)
 })
 cache={
  shell:new THREE.MeshStandardMaterial({map:shell,bumpMap:shellRelief,bumpScale:.045,color:'#fffbee',roughness:.6,metalness:.15}),
  facade:new THREE.MeshStandardMaterial({map:facade,color:'#eee9d9',roughness:.77,metalness:.18}),
  roof:new THREE.MeshStandardMaterial({map:roof,roughness:.82,metalness:.26}),
  tank:new THREE.MeshStandardMaterial({map:tank,roughness:.37,metalness:.65}),
  neutral:new THREE.MeshStandardMaterial({color:'#868782',roughness:.85,metalness:.1}),
 }
 return cache
}
