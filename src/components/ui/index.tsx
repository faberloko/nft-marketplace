/* Componentes no padrão shadcn/ui (Radix + CVA + Tailwind), adaptados aos tokens do Figma Kurio. */
import * as React from 'react'
import { Slot } from '@radix-ui/react-slot'
import * as LabelPrimitive from '@radix-ui/react-label'
import * as DialogPrimitive from '@radix-ui/react-dialog'
import { cva, type VariantProps } from 'class-variance-authority'
import { ChevronDown, Eye, EyeOff, Minus, Plus, X } from 'lucide-react'
import { cn } from '@/lib/utils'

export const buttonVariants = cva(
  'inline-flex items-center justify-center gap-2 whitespace-nowrap font-bold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-price focus-visible:ring-offset-2 focus-visible:ring-offset-bg disabled:cursor-not-allowed disabled:opacity-50',
  {
    variants: {
      variant: {
        primary: 'rounded-[4px] bg-accent text-bg hover:bg-price',
        outline: 'rounded-[4px] border border-accent text-price hover:bg-accent/10',
        ghost: 'rounded-[4px] text-ink hover:bg-white/5',
        secondary: 'rounded-[4px] bg-surface text-ink hover:bg-line',
        danger: 'rounded-[4px] bg-danger text-bg hover:opacity-90',
        link: 'text-price underline-offset-4 hover:underline',
        pill: 'rounded-full bg-gradient-to-r from-accent to-[#A86A3A] text-bg hover:brightness-110',
      },
      size: { lg: 'h-11 px-8 text-base', md: 'h-10 px-5 text-sm', sm: 'h-8 px-3 text-sm', icon: 'h-10 w-10', none: '' },
    },
    defaultVariants: { variant: 'primary', size: 'md' },
  },
)
export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement>, VariantProps<typeof buttonVariants> { asChild?: boolean }
export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(({ className, variant, size, asChild, ...props }, ref) => {
  const Comp = asChild ? Slot : 'button'
  return <Comp ref={ref} className={cn(buttonVariants({ variant, size }), className)} {...props} />
})
Button.displayName = 'Button'

const fieldBase = 'w-full rounded-[2px] border border-field bg-bg px-3 text-sm text-ink placeholder:text-hint focus-visible:border-accent focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-accent aria-[invalid=true]:border-danger disabled:opacity-60'
export const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(({ className, ...props }, ref) => (
  <input ref={ref} className={cn(fieldBase, 'h-10', className)} {...props} />
))
Input.displayName = 'Input'

/** Campo de senha com o ícone de olho do Figma (mostrar/ocultar). */
export const PasswordInput = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(({ className, ...props }, ref) => {
  const [show, setShow] = React.useState(false)
  return (
    <div className="relative">
      <input ref={ref} type={show ? 'text' : 'password'} className={cn(fieldBase, 'h-10 pr-11', className)} {...props} />
      <button type="button" onClick={() => setShow((v) => !v)} aria-label={show ? 'Ocultar senha' : 'Mostrar senha'} aria-pressed={show}
        className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-hint hover:text-price">
        {show ? <Eye aria-hidden className="h-4 w-4" /> : <EyeOff aria-hidden className="h-4 w-4" />}
      </button>
    </div>
  )
})
PasswordInput.displayName = 'PasswordInput'

export const Textarea = React.forwardRef<HTMLTextAreaElement, React.TextareaHTMLAttributes<HTMLTextAreaElement>>(({ className, ...props }, ref) => (
  <textarea ref={ref} className={cn(fieldBase, 'min-h-36 py-2', className)} {...props} />
))
Textarea.displayName = 'Textarea'

export const NativeSelect = React.forwardRef<HTMLSelectElement, React.SelectHTMLAttributes<HTMLSelectElement>>(({ className, ...props }, ref) => (
  <div className="relative">
    <select ref={ref} className={cn(fieldBase, 'h-10 appearance-none pr-9', className)} {...props} />
    <ChevronDown aria-hidden className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink" />
  </div>
))
NativeSelect.displayName = 'NativeSelect'

export const Label = React.forwardRef<React.ElementRef<typeof LabelPrimitive.Root>, React.ComponentPropsWithoutRef<typeof LabelPrimitive.Root>>(({ className, ...props }, ref) => (
  <LabelPrimitive.Root ref={ref} className={cn('text-sm text-ink', className)} {...props} />
))
Label.displayName = 'Label'

/** Campo com label (asterisco do Figma quando obrigatório), dica e erro associados via aria-describedby. */
export function Field({ id, label, error, hint, required, hideLabel, children }: {
  id: string; label: string; error?: string; hint?: string; required?: boolean; hideLabel?: boolean
  children: (aria: { id: string; 'aria-invalid': boolean; 'aria-describedby'?: string; 'aria-required'?: boolean }) => React.ReactNode
}) {
  const describedBy = [hint && `${id}-hint`, error && `${id}-error`].filter(Boolean).join(' ') || undefined
  return (
    <div className="flex flex-col gap-2">
      <Label htmlFor={id} className={cn(hideLabel && 'sr-only')}>
        {label}{required && <span aria-hidden className="ml-0.5 text-required">*</span>}
      </Label>
      {children({ id, 'aria-invalid': !!error, 'aria-describedby': describedBy, 'aria-required': required || undefined })}
      {hint && <p id={`${id}-hint`} className="text-xs text-muted">{hint}</p>}
      {error && <p id={`${id}-error`} className="text-xs text-danger" role="alert"><span aria-hidden>⚠ </span>{error}</p>}
    </div>
  )
}

export function Skeleton({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div aria-hidden className={cn('relative overflow-hidden rounded-[4px] bg-surface', className)} {...props}>
      <div className="absolute inset-0 -translate-x-full animate-shimmer bg-gradient-to-r from-transparent via-white/[0.06] to-transparent motion-reduce:hidden" />
    </div>
  )
}

export function Badge({ className, ...props }: React.HTMLAttributes<HTMLSpanElement>) {
  return <span className={cn('inline-flex items-center bg-accent px-3 py-1 text-xs font-bold uppercase text-bg', className)} {...props} />
}

/** Selo “METAMASK · WALLETCONNECT · COINBASE” do Figma. */
export function WalletsBadge({ className }: { className?: string }) {
  return (
    <span className={cn('inline-flex items-center gap-2 rounded-[4px] border border-accent bg-band px-3 py-1 text-[10px] font-bold uppercase tracking-wide text-price', className)}>
      MetaMask <span aria-hidden>·</span> WalletConnect <span aria-hidden>·</span> Coinbase
    </span>
  )
}

export function Alert({ tone = 'info', title, children, action, className }: { tone?: 'info' | 'error' | 'warn' | 'success'; title: string; children?: React.ReactNode; action?: React.ReactNode; className?: string }) {
  const tones = { info: 'border-accent', error: 'border-danger', warn: 'border-warn', success: 'border-success' }
  const icon = { info: 'ℹ', error: '✕', warn: '!', success: '✓' }
  return (
    <div role={tone === 'error' ? 'alert' : 'status'} className={cn('flex flex-col gap-2 border-l-4 bg-surface p-4', tones[tone], className)}>
      <p className="text-sm font-bold"><span aria-hidden className="mr-2">{icon[tone]}</span>{title}</p>
      {children && <div className="text-sm text-muted">{children}</div>}
      {action}
    </div>
  )
}

/** Controle −/+ do Figma (botões circulares laranja). */
export function QuantityStepper({ value, min = 1, max, onChange, disabled, label, size = 'md' }: {
  value: number; min?: number; max: number; onChange: (v: number) => void; disabled?: boolean; label: string; size?: 'sm' | 'md'
}) {
  const btn = cn('inline-flex items-center justify-center rounded-full bg-accent text-bg hover:bg-price disabled:cursor-not-allowed disabled:opacity-40', size === 'sm' ? 'h-6 w-6' : 'h-8 w-8')
  return (
    <div role="group" aria-label={label} className="inline-flex items-center gap-3">
      <button type="button" className={btn} aria-label="Diminuir quantidade" disabled={disabled || value <= min} onClick={() => onChange(value - 1)}><Minus aria-hidden className="h-4 w-4" /></button>
      <output aria-live="polite" className="min-w-5 text-center text-base" data-testid="qty">{value}</output>
      <button type="button" className={btn} aria-label="Aumentar quantidade" disabled={disabled || value >= max} onClick={() => onChange(value + 1)}><Plus aria-hidden className="h-4 w-4" /></button>
    </div>
  )
}

export function Breadcrumb({ items }: { items: { label: string; to?: React.ReactNode }[] }) {
  return (
    <nav aria-label="Trilha de navegação" className="text-sm font-bold text-ink">
      <ol className="flex flex-wrap items-center gap-2">
        {items.map((it, i) => (
          <li key={it.label} className="flex items-center gap-2">
            {i > 0 && <span aria-hidden>/</span>}
            {it.to ?? <span aria-current="page">{it.label}</span>}
          </li>
        ))}
      </ol>
    </nav>
  )
}

export const Dialog = DialogPrimitive.Root
export const DialogTrigger = DialogPrimitive.Trigger
export const DialogClose = DialogPrimitive.Close
/** Modal do Figma: superfície marrom, X laranja e barra inferior laranja. `side="right"` vira gaveta (menu/filtros no mobile). */
export function DialogContent({ title, description, side, children, className, hideTitle, onClose }: {
  title: string; description?: string; side?: 'right'; children: React.ReactNode; className?: string; hideTitle?: boolean; onClose?: () => void
}) {
  return (
    <DialogPrimitive.Portal>
      <DialogPrimitive.Overlay className="fixed inset-0 z-40 bg-black/60" />
      <DialogPrimitive.Content
        onCloseAutoFocus={onClose ? () => onClose() : undefined}
        className={cn('fixed z-50 flex flex-col gap-4 overflow-y-auto bg-surface text-ink shadow-2xl focus:outline-none',
          side === 'right' ? 'inset-y-0 right-0 w-[min(88vw,360px)] p-6' : 'left-1/2 top-1/2 max-h-[92vh] w-[min(94vw,500px)] -translate-x-1/2 -translate-y-1/2 border-b-[10px] border-accent px-6 pb-8 pt-6 sm:px-20', className)}
        {...(description ? {} : { 'aria-describedby': undefined })}
      >
        <DialogPrimitive.Close className="absolute right-5 top-5 rounded p-1 text-price hover:bg-white/5" aria-label="Fechar">
          <X aria-hidden className="h-5 w-5" />
        </DialogPrimitive.Close>
        <DialogPrimitive.Title className={cn('text-lg font-bold', hideTitle && 'sr-only')}>{title}</DialogPrimitive.Title>
        {description && <DialogPrimitive.Description className="text-sm text-muted">{description}</DialogPrimitive.Description>}
        {children}
      </DialogPrimitive.Content>
    </DialogPrimitive.Portal>
  )
}
