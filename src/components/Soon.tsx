import type { ReactNode } from 'react'
import { announce } from '@/lib/announcer'
import { cn } from '@/lib/utils'

/**
 * Item do layout fora do escopo do desafio (Criadores, Aprenda, Atividade, Ofertas…).
 * Mantém a fidelidade visual, mas avisa que não está disponível — nunca aparenta sucesso.
 */
export function Soon({ children, className, label }: { children: ReactNode; className?: string; label?: string }) {
  const name = label ?? (typeof children === 'string' ? children : 'Esta seção')
  return (
    <button type="button" aria-disabled="true" title="Disponível em breve"
      onClick={() => announce(`${name}: disponível em breve. Esta seção não faz parte da demonstração.`)}
      className={cn('cursor-not-allowed text-left', className)}>
      {children}<span className="sr-only"> (em breve)</span>
    </button>
  )
}
