import { useEffect, useRef, useState } from 'react'

/** Decorative film; playback stops while the interactive demo is in view. */
export function VideoHero() {
  const videoRef = useRef<HTMLVideoElement>(null)
  const [playRequested, setPlayRequested] = useState<boolean | null>(null)
  const [playing, setPlaying] = useState(false)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    const video = videoRef.current
    if (!video || failed) return
    const motion = window.matchMedia('(prefers-reduced-motion: reduce)')
    let visible = true
    let disposed = false
    const update = () => {
      const shouldPlay = (playRequested ?? !motion.matches) && visible && !document.hidden
      if (shouldPlay) {
        void video.play().then(() => {
          if (!disposed && (!visible || document.hidden)) video.pause()
        }).catch(() => { /* The poster and explicit play button remain usable. */ })
      } else video.pause()
    }
    const observer = new IntersectionObserver(([entry]) => {
      visible = entry.isIntersecting && entry.intersectionRatio >= 0.1
      update()
    }, { threshold: 0.1 })
    observer.observe(video)
    motion.addEventListener('change', update)
    document.addEventListener('visibilitychange', update)
    update()
    return () => {
      disposed = true
      observer.disconnect()
      motion.removeEventListener('change', update)
      document.removeEventListener('visibilitychange', update)
      video.pause()
    }
  }, [playRequested, failed])

  return (
    <section className="video-hero" aria-labelledby="project-title">
      <video
        ref={videoRef}
        className="video-hero__film"
        src="/assets/mars/marsvid.mp4"
        poster="/assets/mars/mars-video-poster.jpg"
        muted loop playsInline preload="metadata"
        aria-hidden="true"
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onError={() => { setFailed(true); setPlaying(false) }}
      />
      <div className="video-hero__shade" aria-hidden="true" />
      <div className="video-hero__top">
        <span className="video-hero__wordmark"><span className="brand-mark" aria-hidden="true">M</span> MarsWindNet</span>
        <span className="video-hero__edition">A Martian wind observatory</span>
      </div>
      <div className="video-hero__content">
        <p className="video-hero__eyebrow">See the wind. Protect the city.</p>
        <h1 id="project-title">Mars<span>WindNet</span></h1>
        <p className="video-hero__lede">A new world. A clearer view of what’s coming.</p>
        <div className="video-hero__actions">
          <a className="hero-action hero-action--primary" href="#demo">Try demo <span aria-hidden="true">↓</span></a>
          <a className="hero-action hero-action--secondary" href="/sensor/">Meet the sensor <span aria-hidden="true">↗</span></a>
        </div>
      </div>
      <div className="video-hero__bottom">
        <a href="#demo" className="video-hero__scroll">Scroll to explore <span aria-hidden="true">↓</span></a>
        {!failed && <button className="video-hero__playback" onClick={() => setPlayRequested(!playing)} aria-label={playing ? 'Pause background video' : 'Play background video'}>
          <span aria-hidden="true">{playing ? 'Ⅱ' : '▷'}</span> {playing ? 'Pause film' : 'Play film'}
        </button>}
      </div>
    </section>
  )
}
