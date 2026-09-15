import type { Obstacle } from '../contracts/marswindnet'
/** Pure ENU geometry shared by the city renderer and separately computed surface results. */
export type OuterSurface = { positions_m: number[]; normals: number[]; triangles: number[] }
export const SURFACE_RADIAL_SEGMENTS = 64
export function buildOuterSurface(o: Obstacle): OuterSurface {
  const mesh: OuterSurface = { positions_m: [], normals: [], triangles: [] }
  const height = o.height_m ?? 0
  const vertex = (x:number,y:number,z:number,nx:number,ny:number,nz:number) => {
    mesh.positions_m.push(o.cx_m+x,o.cy_m+y,z)
    const n=Math.hypot(nx,ny,nz)||1;mesh.normals.push(nx/n,ny/n,nz/n)
  }
  const triangle=(a:number,b:number,c:number)=>{
    const p=mesh.positions_m, n=mesh.normals
    const ab=[p[b*3]-p[a*3],p[b*3+1]-p[a*3+1],p[b*3+2]-p[a*3+2]],ac=[p[c*3]-p[a*3],p[c*3+1]-p[a*3+1],p[c*3+2]-p[a*3+2]]
    const cross=[ab[1]*ac[2]-ab[2]*ac[1],ab[2]*ac[0]-ab[0]*ac[2],ab[0]*ac[1]-ab[1]*ac[0]]
    if(Math.hypot(...cross)<1e-9)return
    const dot=cross[0]*n[a*3]+cross[1]*n[a*3+1]+cross[2]*n[a*3+2]
    mesh.triangles.push(a,...(dot>=0?[b,c]:[c,b]))
  }
  if(o.kind==='box'){
    const halves=[o.width_m/2,o.depth_m/2,height/2], r=Math.min(.5,height*.06)
    const steps=(h:number)=>[...new Set([-h,-h+r*.3,-h+r,-h+2*r,-h*.5,0,h*.5,h-2*r,h-r,h-r*.3,h])].sort((a,b)=>a-b)
    for(let axis=0;axis<3;axis++)for(const sign of [-1,1]){
      const a=(axis+1)%3,b=(axis+2)%3,aa=steps(halves[a]),bb=steps(halves[b]),start=mesh.positions_m.length/3
      for(const q of bb)for(const p of aa){
        const point=[0,0,0];point[axis]=sign*halves[axis];point[a]=p;point[b]=q
        const centre=point.map((v,k)=>Math.max(-halves[k]+r,Math.min(halves[k]-r,v)))
        const normal=point.map((v,k)=>v-centre[k]),length=Math.hypot(...normal)
        const pos=centre.map((v,k)=>v+normal[k]/length*r)
        vertex(pos[0],pos[1],pos[2]+height/2,...normal as [number,number,number])
      }
      for(let j=0;j<bb.length-1;j++)for(let i=0;i<aa.length-1;i++){
        const k=start+j*aa.length+i;triangle(k,k+1,k+aa.length);triangle(k+1,k+aa.length+1,k+aa.length)
      }
    }
  }else{
    const radius=o.radius_m,segments=SURFACE_RADIAL_SEGMENTS, profile:Array<[number,number,number,number]>=[]
    if(o.kind==='cylinder'){
      profile.push([radius*.94,0,1,-.2],[radius,.18,1,0],[radius,height-.3,1,0],[radius*.95,height,1,1],[radius*.7,height,0,1],[0,height,0,1])
    }else{
      const collar=Math.min(1.6,height*.1),roof=height-collar
      profile.push([radius,0,1,0],[radius,collar,1,0])
      const heights=[...Array.from({length:20},(_,j)=>collar+roof*Math.sin((j+1)/20*Math.PI/2)),... [.20,.215,.29,.305].map(t=>t*height)].filter(z=>z>collar).sort((a,b)=>a-b)
      for(const z of heights){
        const t=Math.asin(Math.min(1,(z-collar)/roof)),f=z/height
        // A shallow inset window band, entirely inside the agreed dome envelope.
        const inset=.18*Math.max(0,Math.min(1,(f-.20)/.015,(.305-f)/.015))
        profile.push([Math.max(0,radius*Math.cos(t)-inset),z,Math.cos(t)/radius,Math.sin(t)/roof])
      }
    }
    for(const [r,z,nr,nz] of profile)for(let i=0;i<=segments;i++){
      const angle=i/segments*Math.PI*2;vertex(r*Math.cos(angle),r*Math.sin(angle),z,nr*Math.cos(angle),nr*Math.sin(angle),nz)
    }
    for(let j=0;j<profile.length-1;j++)for(let i=0;i<segments;i++){
      const k=j*(segments+1)+i;triangle(k,k+1,k+segments+1);triangle(k+1,k+segments+2,k+segments+1)
    }
  }
  return mesh
}
