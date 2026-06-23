/**
 * @fileoverview Vitest global setup — registers the jest-dom matchers
 * (`toBeInTheDocument`, `toHaveTextContent`, …) and jsdom polyfills that
 * browser-only APIs (used by Radix UI and TanStack Query) expect but jsdom does
 * not implement: `ResizeObserver`, `IntersectionObserver`, `matchMedia`,
 * `scrollIntoView`, and non-zero element dimensions so virtualized components
 * mount their children under test.
 *
 * @module vitest.setup
 */
import '@testing-library/jest-dom/vitest'

/** Fixed 800×400 box used as the reported entry size for ResizeObserver stubs. */
const STUB_INLINE_SIZE = 800
const STUB_BLOCK_SIZE = 400

/**
 * A typed ResizeObserverEntry with the fixed 800×400 dimensions required by
 * jsdom polyfills. All fields satisfy the `ResizeObserverEntry` contract so no
 * `as unknown` cast is needed.
 */
function makeResizeEntry(target: Element): ResizeObserverEntry {
  const size: ResizeObserverSize = { inlineSize: STUB_INLINE_SIZE, blockSize: STUB_BLOCK_SIZE }
  const rect: DOMRectReadOnly = {
    x: 0,
    y: 0,
    width: STUB_INLINE_SIZE,
    height: STUB_BLOCK_SIZE,
    top: 0,
    left: 0,
    right: STUB_INLINE_SIZE,
    bottom: STUB_BLOCK_SIZE,
    toJSON: () => ({}),
  }
  return {
    target,
    contentRect: rect,
    borderBoxSize: [size],
    contentBoxSize: [size],
    devicePixelContentBoxSize: [size],
  }
}

/** Minimal ResizeObserver that reports a fixed 800×400 box on observe. */
class ResizeObserverStub implements ResizeObserver {
  constructor(private readonly cb: ResizeObserverCallback) {}
  observe(target: Element): void {
    this.cb([makeResizeEntry(target)], this)
  }
  unobserve(): void {}
  disconnect(): void {}
}

/**
 * No-op IntersectionObserver for components that lazy-mount on visibility.
 *
 * Implements all interface members so the class can be assigned directly to
 * `globalThis.IntersectionObserver` without an `as unknown as` cast.
 */
class IntersectionObserverStub implements IntersectionObserver {
  readonly root: Element | Document | null = null
  readonly rootMargin = '0px'
  readonly thresholds: ReadonlyArray<number> = []
  observe(): void {}
  unobserve(): void {}
  disconnect(): void {}
  takeRecords(): IntersectionObserverEntry[] {
    return []
  }
}

globalThis.ResizeObserver = ResizeObserverStub
globalThis.IntersectionObserver = IntersectionObserverStub

if (!window.matchMedia) {
  window.matchMedia = (query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addEventListener: () => {},
    removeEventListener: () => {},
    addListener: () => {},
    removeListener: () => {},
    dispatchEvent: () => false,
  })
}

if (!Element.prototype.scrollIntoView) {
  Element.prototype.scrollIntoView = () => {}
}

// Radix UI and layout components read element size; jsdom reports 0, which can
// prevent certain render branches. Report a fixed non-zero box so relevant code
// paths are exercised.
Object.defineProperty(HTMLElement.prototype, 'offsetWidth', {
  configurable: true,
  value: STUB_INLINE_SIZE,
})
Object.defineProperty(HTMLElement.prototype, 'offsetHeight', {
  configurable: true,
  value: STUB_BLOCK_SIZE,
})
Element.prototype.getBoundingClientRect = (): DOMRect => ({
  width: STUB_INLINE_SIZE,
  height: STUB_BLOCK_SIZE,
  top: 0,
  left: 0,
  right: STUB_INLINE_SIZE,
  bottom: STUB_BLOCK_SIZE,
  x: 0,
  y: 0,
  toJSON: () => {},
})
