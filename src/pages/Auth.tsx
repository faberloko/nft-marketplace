import { useEffect, useState, type FormEvent } from 'react'
import { getRouteApi, Link, useNavigate, useRouter } from '@tanstack/react-router'
import { ApiError } from '@/api/client'
import { Alert, Button, Dialog, DialogContent, Field, Input, PasswordInput } from '@/components/ui'
import { Soon } from '@/components/Soon'
import { HomeContent } from './Home'
import { useLogin, useSignup } from '@/lib/auth'
import { cn } from '@/lib/utils'

const loginRoute = getRouteApi('/login')
const signupRoute = getRouteApi('/signup')
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
type Mode = 'login' | 'signup'

function focusFirst(errs: Record<string, string | undefined>) {
  const first = Object.keys(errs).find((k) => errs[k]); if (first) document.getElementById(first)?.focus()
}

function GoogleIcon() {
  return (
    <svg aria-hidden viewBox="0 0 24 24" className="h-4 w-4">
      <path fill="#EA4335" d="M12 10.2v3.9h5.5c-.2 1.3-1.6 3.8-5.5 3.8-3.3 0-6-2.7-6-6.1s2.7-6.1 6-6.1c1.9 0 3.1.8 3.8 1.5l2.6-2.5C16.8 3.2 14.6 2.2 12 2.2 6.6 2.2 2.2 6.6 2.2 12s4.4 9.8 9.8 9.8c5.7 0 9.4-4 9.4-9.6 0-.6-.1-1.1-.2-1.6H12z" />
      <path fill="#34A853" d="M3.3 7.4l3.2 2.3C7.4 7.6 9.5 6 12 6c1.9 0 3.1.8 3.8 1.5l2.6-2.5C16.8 3.2 14.6 2.2 12 2.2 8.2 2.2 4.9 4.3 3.3 7.4z" opacity=".9" />
    </svg>
  )
}

/** Painel “Entrar | Criar conta” (mesmo conteúdo no modal desktop e na tela cheia mobile). */
function AuthPanel({ mode, redirect, reason }: { mode: Mode; redirect?: string; reason?: 'expired' }) {
  const router = useRouter()
  const login = useLogin()
  const signup = useSignup()
  const [form, setForm] = useState({ username: '', email: '', password: '', confirm: '' })
  const [errors, setErrors] = useState<Record<string, string | undefined>>({})
  useEffect(() => { setErrors({}); document.title = mode === 'login' ? 'Entrar — Kurio' : 'Criar conta — Kurio' }, [mode])
  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) => setForm({ ...form, [k]: e.target.value })
  const done = () => router.history.push(redirect ?? '/')
  const onApiError = (err: unknown) => {
    if (err instanceof ApiError && err.fields) {
      const mapped = Object.fromEntries(Object.entries(err.fields).map(([k, v]) => [k === 'password' ? 'password' : k, v]))
      setErrors(mapped); focusFirst(mapped)
    }
  }
  const submit = (e: FormEvent) => {
    e.preventDefault()
    if (mode === 'login') {
      const errs = { email: EMAIL.test(form.email) ? undefined : 'Informe um e-mail válido.', password: form.password ? undefined : 'Informe a senha.' }
      setErrors(errs); if (errs.email || errs.password) return focusFirst(errs)
      login.mutate({ email: form.email, password: form.password }, { onSuccess: done, onError: onApiError })
    } else {
      const errs: Record<string, string | undefined> = {
        username: /^[a-z0-9_]{3,20}$/.test(form.username) ? undefined : 'Use 3–20 letras minúsculas, números ou _.',
        email: EMAIL.test(form.email) ? undefined : 'Informe um e-mail válido.',
        password: form.password.length >= 8 && /[A-Z]/.test(form.password) && /\d/.test(form.password) ? undefined : 'Mínimo 8 caracteres, com maiúscula e número.',
        confirm: form.confirm === form.password ? undefined : 'As senhas não conferem.',
      }
      setErrors(errs); if (Object.values(errs).some(Boolean)) return focusFirst(errs)
      signup.mutate({ username: form.username, email: form.email, password: form.password }, { onSuccess: done, onError: onApiError })
    }
  }
  const m = mode === 'login' ? login : signup
  const tab = (to: Mode, label: string) => (
    <Link to={to === 'login' ? '/login' : '/signup'} search={{ redirect, reason: undefined }} aria-current={mode === to ? 'page' : undefined}
      className={cn('hover:text-price', mode === to ? 'text-price' : 'text-ink')}>{label}</Link>
  )
  return (
    <div className="flex flex-col gap-5">
      <p className="text-center text-3xl font-bold tracking-[0.15em] md:hidden" aria-hidden>KURIO</p>
      <nav aria-label="Entrar ou criar conta" className="hidden items-center justify-center gap-2 text-lg font-bold md:flex">
        {tab('login', 'Entrar')}<span aria-hidden className="h-5 w-px bg-accent" />{tab('signup', 'Criar conta')}
      </nav>
      <h2 className="text-center text-lg font-bold md:sr-only">{mode === 'login' ? 'Entrar' : <><span className="md:hidden">Criar perfil de colecionador</span><span className="hidden md:inline">Criar conta</span></>}</h2>
      <p className="hidden text-center text-xs leading-relaxed md:block">
        {mode === 'login' ? 'Entre para gerenciar sua carteira, coleção e perfil de criador.' : 'Crie seu perfil de colecionador e conecte uma carteira quando quiser.'}
      </p>
      {reason === 'expired' && <Alert tone="warn" title="Sua sessão expirou">Entre novamente para continuar de onde parou.</Alert>}
      {m.isError && !(m.error instanceof ApiError && m.error.fields) && (
        <Alert tone="error" title={m.error instanceof ApiError && m.error.code === 'CONFLICT' ? 'Conta já existente' : mode === 'login' ? 'Não foi possível entrar' : 'Não foi possível criar a conta'}>{m.error.message}</Alert>
      )}
      <form noValidate onSubmit={submit} className="flex flex-col gap-3">
        {mode === 'signup' && <Field id="username" label="Nome de usuário" hideLabel error={errors.username}>{(a) => <Input {...a} autoComplete="username" placeholder="Nome de usuário" value={form.username} onChange={set('username')} className="max-md:h-12 max-md:rounded-[12px]" />}</Field>}
        <Field id="email" label="E-mail" hideLabel error={errors.email}>{(a) => <Input {...a} type="email" autoComplete="email" placeholder={mode === 'login' ? 'contato@email.com' : 'Digite seu e-mail'} value={form.email} onChange={set('email')} className="max-md:h-12 max-md:rounded-[12px]" />}</Field>
        <Field id="password" label="Senha" hideLabel error={errors.password}>{(a) => <PasswordInput {...a} autoComplete={mode === 'login' ? 'current-password' : 'new-password'} placeholder="Senha" value={form.password} onChange={set('password')} className="max-md:h-12 max-md:rounded-[12px]" />}</Field>
        {mode === 'signup' && <Field id="confirm" label="Confirmar senha" hideLabel error={errors.confirm}>{(a) => <PasswordInput {...a} autoComplete="new-password" placeholder="Confirmar senha" value={form.confirm} onChange={set('confirm')} className="max-md:h-12 max-md:rounded-[12px]" />}</Field>}
        {mode === 'login' && <Soon label="Recuperação de senha" className="self-end text-xs text-price hover:underline">Esqueceu a senha?</Soon>}
        <Button type="submit" className="mt-3 h-11 w-full text-base max-md:h-14 max-md:rounded-[12px]" disabled={m.isPending}>
          {m.isPending ? (mode === 'login' ? 'Entrando…' : 'Criando…') : mode === 'login' ? 'Entrar' : <><span className="md:hidden">Criar perfil</span><span className="hidden md:inline">Criar conta</span></>}
        </Button>
      </form>
      <div className="flex items-center gap-3 text-xs" aria-hidden><span className="h-px flex-1 bg-line" />Ou continue com<span className="h-px flex-1 bg-line" /></div>
      <div className="flex flex-col gap-3">
        <Soon label="Login com Google" className="flex h-10 items-center justify-center gap-3 border border-field text-xs font-bold text-muted">
          <GoogleIcon /> Continuar com Google
        </Soon>
        <Soon label="Login com Facebook" className="flex h-10 items-center justify-center gap-3 border border-field text-xs font-bold text-muted">
          <span aria-hidden className="text-base font-bold text-[#4267B2]">f</span> Continuar com Facebook
        </Soon>
      </div>
      <p className="text-center text-sm text-muted md:hidden">
        {mode === 'login'
          ? <>Novo na Kurio? <Link to="/signup" search={{ redirect, reason: undefined }} className="text-price">Crie uma conta</Link></>
          : <>Já tem uma conta? <Link to="/login" search={{ redirect, reason: undefined }} className="text-price">Entre</Link></>}
      </p>
    </div>
  )
}

/** No desktop o Figma mostra o modal sobre o Início; no mobile, tela cheia. */
function AuthScreen({ mode, redirect, reason }: { mode: Mode; redirect?: string; reason?: 'expired' }) {
  const navigate = useNavigate()
  return (
    <>
      <div className="hidden md:block" aria-hidden><HomeContent search={{}} onSearch={() => undefined} /></div>
      <Dialog open onOpenChange={(open) => { if (!open) navigate({ to: '/' }) }}>
        <DialogContent title={mode === 'login' ? 'Entrar' : 'Criar conta'} hideTitle
          className="[&>button:first-child]:max-md:hidden max-md:inset-0 max-md:left-0 max-md:top-0 max-md:h-full max-md:max-h-none max-md:w-full max-md:translate-x-0 max-md:translate-y-0 max-md:justify-center max-md:border-0 max-md:bg-bg max-md:px-7">
          <AuthPanel mode={mode} redirect={redirect} reason={reason} />
        </DialogContent>
      </Dialog>
    </>
  )
}

export function LoginPage() {
  const { redirect, reason } = loginRoute.useSearch()
  return <AuthScreen mode="login" redirect={redirect} reason={reason} />
}
export function SignupPage() {
  const { redirect } = signupRoute.useSearch()
  return <AuthScreen mode="signup" redirect={redirect} />
}
