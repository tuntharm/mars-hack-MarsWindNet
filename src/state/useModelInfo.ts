import { useEffect, useState } from 'react'
import type { ModelInfo } from '../contracts/marswindnet'
import { validateModelInfo } from './customWind'

export function useModelInfo() {
  const [info,setInfo]=useState<ModelInfo | null>(null)
  const [error,setError]=useState<string | null>(null)
  const [attempt,setAttempt]=useState(0)
  const [checking,setChecking]=useState(true)
  useEffect(()=>{
    const controller=new AbortController()
    const timeout=setTimeout(()=>controller.abort(),10000)
    fetch('/api/model-info',{signal:controller.signal})
      .then(async response=>{
        if (!response.ok) throw new Error('Model unavailable. Check the service and retry.')
        if (!response.headers.get('content-type')?.includes('application/json')) throw new Error('Model gateway unavailable. Check the connection and retry.')
        return validateModelInfo(await response.json())
      })
      .then(value=>{if(!controller.signal.aborted){setInfo(value);setError(null)}})
      .catch(e=>{if(!cancelled){setInfo(null);setError(controller.signal.aborted?'Model status request timed out.':e.message)}})
      .finally(()=>{clearTimeout(timeout);if(!cancelled)setChecking(false)})
    let cancelled=false
    return ()=>{cancelled=true;clearTimeout(timeout);controller.abort()}
  },[attempt])
  return {info,error,checking,retry:()=>{setChecking(true);setError(null);setInfo(null);setAttempt(v=>v+1)}}
}
