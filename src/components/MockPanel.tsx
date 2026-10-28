import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { FlaskConical } from 'lucide-react'
import { Button, Dialog, DialogContent, DialogTrigger } from '@/components/ui'
import { api } from '@/api/endpoints'
import { cartQuery } from '@/api/queries'
import { announce } from '@/lib/announcer'
import Decimal from 'decimal.js'

/**
 * Painel de cenários da demonstração. Todas as ações passam por REST → handlers MSW;
 * os eventos resultantes chegam ao app pelo socket.io-client (nunca direto no cache).
 */
export default function MockPanel() {
  const qc = useQueryClient()
  const [open, setOpen] = useState(false)
  const scenarios = useQuery({ queryKey: ['mock', 'scenarios'], queryFn: api.mock.scenarios, enabled: open, retry: false })
  const cart = useQuery(cartQuery())
  const [selected, setSelected] = useState<string[] | null>(null)
  const active = selected ?? scenarios.data?.active ?? []
  const first = cart.data?.items[0]

  const run = async (label: string, fn: () => Promise<unknown>) => {
    try { await fn(); announce(`Cenário: ${label}.`) } catch (e) { announce(`Falha no cenário: ${(e as Error).message}`, 'assertive') }
  }
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="secondary" size="sm" className="fixed right-3 top-3 z-30 h-7 px-2 text-xs opacity-80 shadow-lg hover:opacity-100 md:bottom-4 md:right-4 md:top-auto md:h-8 md:px-3 md:text-sm" aria-label="Abrir painel de cenários simulados">
          <FlaskConical aria-hidden className="h-4 w-4" /> Cenários
        </Button>
      </DialogTrigger>
      <DialogContent title="Cenários simulados (MSW)" description="Combine condições de rede e falhas. Persistem até o reset.">
        <fieldset className="grid gap-2 sm:grid-cols-2">
          <legend className="mb-2 font-semibold">Condições ativas</legend>
          {Object.entries(scenarios.data?.available ?? {}).map(([name, desc]) => (
            <label key={name} className="flex items-start gap-2 text-sm">
              <input type="checkbox" className="mt-1 h-4 w-4 accent-accent" checked={active.includes(name)}
                onChange={(e) => setSelected(e.target.checked ? [...active.filter((x) => x !== 'default'), name] : active.filter((x) => x !== name))} />
              <span><code className="font-mono">{name}</code> — {desc}</span>
            </label>
          ))}
        </fieldset>
        <div className="flex flex-wrap gap-2">
          <Button size="sm" onClick={() => run('aplicado', async () => { await api.mock.setScenarios(active); window.location.reload() })}>Aplicar e recarregar</Button>
          <Button size="sm" variant="danger" onClick={() => run('reset', async () => { await api.mock.reset(); localStorage.removeItem('nft-session'); window.location.assign('/') })}>Resetar tudo</Button>
        </div>
        <h3 className="font-semibold">Eventos e sessão</h3>
        <div className="flex flex-wrap gap-2">
          <Button size="sm" variant="secondary" disabled={!first} onClick={() => first && run('preço alterado', () => api.mock.nftUpdate({ nftId: first.nftId, editionId: first.editionId, priceEth: new Decimal(first.unitPriceEth).mul('1.1').toFixed(4) }))}>Alterar preço (1º item do carrinho)</Button>
          <Button size="sm" variant="secondary" disabled={!first} onClick={() => first && run('esgotado', () => api.mock.nftUpdate({ nftId: first.nftId, editionId: first.editionId, available: 0 }))}>Esgotar edição (1º item)</Button>
          <Button size="sm" variant="secondary" onClick={() => run('evento duplicado', () => api.mock.replay('duplicate'))}>Reenviar evento duplicado</Button>
          <Button size="sm" variant="secondary" onClick={() => run('evento antigo', () => api.mock.replay('stale'))}>Enviar evento antigo</Button>
          <Button size="sm" variant="secondary" onClick={() => run('socket desconectado', () => api.mock.disconnect())}>Derrubar socket</Button>
          <Button size="sm" variant="secondary" onClick={() => run('pedidos liquidados', () => api.mock.settle())}>Liquidar pedidos pendentes</Button>
          <Button size="sm" variant="secondary" onClick={() => run('sessão expirada', async () => { await api.mock.expireSessions(); await qc.invalidateQueries({ queryKey: ['user'] }) })}>Expirar sessão</Button>
        </div>
        <p className="text-xs text-[#cccccc]">Usuários: ana@nft.test e bruno@nft.test — senha Senha@123. Cupons: WELCOME10, FLAT005, EXPIRED20.</p>
      </DialogContent>
    </Dialog>
  )
}
