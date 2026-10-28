/** Região aria-live global + toasts visuais para feedback de mutations e eventos em tempo real. */
export type Toast = { id: number; message: string; tone: 'polite' | 'assertive' }
type Listener = (t: Toast) => void
const listeners = new Set<Listener>()
let seq = 0
export function announce(message: string, tone: Toast['tone'] = 'polite') {
  const t = { id: ++seq, message, tone }
  listeners.forEach((l) => l(t))
}
export function onAnnounce(l: Listener) { listeners.add(l); return () => { listeners.delete(l) } }
