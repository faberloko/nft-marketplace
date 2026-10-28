import type { ReactNode } from 'react'
import { Link, useRouterState } from '@tanstack/react-router'
import { Download, Heart, LogOut, MapPin, ShoppingCart, Sparkles, TriangleAlert, User } from 'lucide-react'
import { Soon } from '@/components/Soon'
import { useLogout } from '@/lib/auth'
import { cn } from '@/lib/utils'

/** Menu lateral “Meu perfil” dos frames Perfil do Colecionador e Carteiras. */
export function AccountLayout({ children }: { children: ReactNode }) {
  const pathname = useRouterState({ select: (s) => s.location.pathname })
  const logout = useLogout()
  const item = (on: boolean) => cn('flex w-full items-center gap-3 border-l-[6px] px-4 py-2.5 text-sm text-price/90 hover:text-price whitespace-nowrap', on ? 'border-accent text-price' : 'border-transparent')
  const links: [string, string, typeof User][] = [['/account/profile', 'Dados do perfil', User], ['/account/wallets', 'Carteiras', MapPin]]
  return (
    <div className="container-page grid grid-cols-1 gap-7 pt-6 md:grid-cols-[230px_minmax(0,1fr)] md:pt-8 lg:grid-cols-[310px_minmax(0,1fr)]">
      <nav aria-label="Meu perfil" className="h-fit min-w-0 bg-surface py-4">
        <p className="px-3 pb-2 text-lg font-bold">Meu perfil</p>
        <ul className="no-scrollbar relative flex overflow-x-auto md:flex-col">
          {links.map(([to, label, Icon]) => (
            <li key={to}><Link to={to} className={item(pathname === to)} aria-current={pathname === to ? 'page' : undefined}><Icon aria-hidden className="h-4 w-4" />{label}</Link></li>
          ))}
          <li><Soon className={item(false)}><ShoppingCart aria-hidden className="h-4 w-4" />Atividade</Soon></li>
          <li><Link to="/favoritos" className={item(pathname === '/favoritos')}><Heart aria-hidden className="h-4 w-4" />Lista de interesse</Link></li>
          <li><Soon className={item(false)}><Sparkles aria-hidden className="h-4 w-4" />Ofertas</Soon></li>
          <li><Soon className={item(false)}><Download aria-hidden className="h-4 w-4" />Arquivos baixados</Soon></li>
          <li><Soon className={item(false)}><TriangleAlert aria-hidden className="h-4 w-4" />Suporte</Soon></li>
          <li className="md:mt-1 md:border-t md:border-line">
            <button type="button" className={cn(item(false), 'font-bold')} onClick={() => logout.mutate()} disabled={logout.isPending}><LogOut aria-hidden className="h-4 w-4" />Sair</button>
          </li>
        </ul>
      </nav>
      <div className="min-w-0">{children}</div>
    </div>
  )
}
