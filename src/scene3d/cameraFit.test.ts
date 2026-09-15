import { expect, it } from 'vitest'
import { PerspectiveCamera, Vector3 } from 'three'
import { readFileSync } from 'node:fs'
import type { CityLayout } from '../contracts/marswindnet'
import { fitNetworkCamera } from './cameraFit'
const city: CityLayout = JSON.parse(readFileSync('public/data/city/marswindnet-layout-v2.json','utf8'))
for (const [width,height] of [[1380,576],[366,540]]) for (const radius of [0,1000,5000,10000]) {
  it(`fits every station in the ${radius || 'city'} view at ${width}×${height}`, () => {
    const fit=fitNetworkCamera(city,width,height,radius),camera=new PerspectiveCamera(40,width/height,2,180000)
    camera.position.copy(fit.position);camera.lookAt(fit.target);camera.updateMatrixWorld()
    const sensors=radius?city.regional_sensors.filter(s=>s.radius_m<=radius):city.sensors
    for(const s of sensors){const p=new Vector3(s.x_m,150,-s.y_m).project(camera);expect(Math.abs(p.x)).toBeLessThan(.9);expect(Math.abs(p.y)).toBeLessThan(.9);expect(p.z).toBeGreaterThan(-1);expect(p.z).toBeLessThan(1)}
  })
}
