import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { VideoHero } from './VideoHero'

let intersect: (entries: { isIntersecting: boolean; intersectionRatio: number }[]) => void
let reduced = false
let visibilityChange: (() => void) | undefined

beforeEach(() => {
  reduced = false
  vi.stubGlobal('matchMedia', () => ({
    get matches() { return reduced },
    addEventListener: (_: string, callback: () => void) => { visibilityChange = callback },
    removeEventListener: vi.fn(),
  }))
  vi.stubGlobal('IntersectionObserver', class {
    constructor(callback: typeof intersect) { intersect = callback }
    observe() {}
    disconnect() {}
  })
  vi.spyOn(HTMLMediaElement.prototype, 'play').mockImplementation(function (this: HTMLMediaElement) {
    this.dispatchEvent(new Event('play'))
    return Promise.resolve()
  })
  vi.spyOn(HTMLMediaElement.prototype, 'pause').mockImplementation(function (this: HTMLMediaElement) {
    this.dispatchEvent(new Event('pause'))
  })
})

afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.unstubAllGlobals() })

it('opens with the supplied muted film and two destination links', () => {
  const { container } = render(<VideoHero />)
  expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('MarsWindNet')
  expect(screen.getByRole('link', { name: 'Try demo' })).toHaveAttribute('href', '#demo')
  expect(screen.getByRole('link', { name: 'Meet the sensor' })).toHaveAttribute('href', '/sensor/')
  expect(screen.getByRole('link', { name: 'Meet the sensor' })).not.toHaveAttribute('target')
  const video = container.querySelector('video')!
  expect(video.muted).toBe(true)
  expect(video.loop).toBe(true)
  expect(video).toHaveAttribute('src', '/assets/mars/marsvid.mp4')
})

it('pauses offscreen and supports explicit pause and resume', () => {
  render(<VideoHero />)
  act(() => intersect([{ isIntersecting: true, intersectionRatio: 0.02 }]))
  expect(HTMLMediaElement.prototype.pause).toHaveBeenCalled()
  act(() => intersect([{ isIntersecting: true, intersectionRatio: 1 }]))
  fireEvent.click(screen.getByRole('button', { name: 'Pause background video' }))
  expect(screen.getByRole('button', { name: 'Play background video' })).toBeInTheDocument()
  fireEvent.click(screen.getByRole('button', { name: 'Play background video' }))
  expect(screen.getByRole('button', { name: 'Pause background video' })).toBeInTheDocument()
})

it('does not autoplay with reduced motion, including preference changes', () => {
  reduced = true
  render(<VideoHero />)
  expect(HTMLMediaElement.prototype.play).not.toHaveBeenCalled()
  act(() => { reduced = false; visibilityChange?.() })
  expect(HTMLMediaElement.prototype.play).toHaveBeenCalled()
})

it('retains navigation and the poster when the video fails', () => {
  const { container } = render(<VideoHero />)
  fireEvent.error(container.querySelector('video')!)
  expect(screen.queryByRole('button')).not.toBeInTheDocument()
  expect(screen.getByRole('link', { name: 'Try demo' })).toBeInTheDocument()
  expect(container.querySelector('video')).toHaveAttribute('poster', '/assets/mars/mars-video-poster.jpg')
})
