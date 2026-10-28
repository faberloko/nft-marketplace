import { Link } from '@tanstack/react-router'
import { Button } from '@/components/ui'

export function NotFound({ title = 'Página não encontrada', message = 'O endereço acessado não existe ou foi removido.' }: { title?: string; message?: string }) {
  return (
    <section className="container-page flex flex-col items-start gap-5 py-20">
      <p className="text-sm font-bold text-price">Erro 404</p>
      <h1 className="text-2xl uppercase tracking-[0.06em] md:text-[40px] md:leading-tight">{title}</h1>
      <p className="text-sm text-muted">{message}</p>
      <Button asChild size="lg" className="h-10 uppercase"><Link to="/">Voltar ao início</Link></Button>
    </section>
  )
}
