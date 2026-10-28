import { useEffect, useState, type FormEvent } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ApiError } from '@/api/client'
import { api } from '@/api/endpoints'
import { keys } from '@/api/queries'
import { NETWORKS, WALLET_PROVIDERS, type Wallet, type WalletInput, type WalletKind } from '@/api/types'
import { Alert, Button, Field, Input, NativeSelect, Skeleton } from '@/components/ui'
import { AccountLayout } from '@/components/AccountLayout'
import { useSession } from '@/lib/auth'
import { announce } from '@/lib/announcer'

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const ADDRESS = /^0x[a-fA-F0-9]{40}$/

export function WalletsPage() {
  const session = useSession()!
  const wallets = useQuery({ queryKey: keys.wallets(session.user.id), queryFn: ({ signal }) => api.wallets(signal) })
  useEffect(() => { document.title = 'Carteiras — Kurio' }, [])
  const primary = wallets.data?.find((w) => w.kind === 'primary')
  const secondary = wallets.data?.find((w) => w.kind === 'secondary')
  return (
    <AccountLayout>
      <h1 className="sr-only">Carteiras</h1>
      {wallets.isError ? <Alert tone="error" title="Falha ao carregar carteiras" action={<Button size="sm" className="w-fit" onClick={() => wallets.refetch()}>Tentar novamente</Button>} />
        : !wallets.data ? <Skeleton className="h-[480px] w-full" /> : (
          <div className="flex flex-col gap-12">
            <WalletSection kind="primary" title="Carteira principal" wallet={primary} startOpen
              subtitle="Estas carteiras ficam disponíveis no pagamento e para receber NFTs comprados." />
            <WalletSection kind="secondary" title="Carteira secundária" wallet={secondary} primary={primary} startOpen={!!secondary}
              subtitle={secondary ? 'Usada como alternativa no pagamento.' : 'Você ainda não adicionou uma carteira secundária.'} />
          </div>
        )}
    </AccountLayout>
  )
}

const empty = (kind: WalletKind, email: string): WalletInput => ({
  kind, displayName: '', nickname: '', network: '' as WalletInput['network'], profileName: '', address: '', secondaryAddress: '',
  provider: '' as WalletInput['provider'], referralCode: '', email, ensName: '',
})

function WalletSection({ kind, title, subtitle, wallet, primary, startOpen }: { kind: WalletKind; title: string; subtitle: string; wallet?: Wallet; primary?: Wallet; startOpen?: boolean }) {
  const session = useSession()!
  const qc = useQueryClient()
  const [open, setOpen] = useState(!!startOpen)
  const [same, setSame] = useState(false)
  const [form, setForm] = useState<WalletInput>(() => (wallet ? { ...wallet } : empty(kind, session.user.email)))
  const [errors, setErrors] = useState<Record<string, string | undefined>>({})
  const p = `w-${kind}`
  const set = <K extends keyof WalletInput>(k: K, v: WalletInput[K]) => setForm((f) => ({ ...f, [k]: v }))
  const save = useMutation({
    mutationFn: () => (wallet ? api.updateWallet(wallet.id, form) : api.createWallet(form)),
    onSuccess: () => { setErrors({}); qc.invalidateQueries({ queryKey: keys.wallets(session.user.id) }); announce(`${title} salva.`) },
    onError: (e) => { if (e instanceof ApiError && e.fields) { setErrors(Object.fromEntries(Object.entries(e.fields).map(([k, v]) => [`${p}-${k}`, v]))); document.getElementById(`${p}-${Object.keys(e.fields)[0]}`)?.focus() } },
  })
  // “Igual à carteira principal”: copia os dados da principal (exceto o endereço, que precisa ser diferente).
  const copyPrimary = (on: boolean) => {
    setSame(on); setOpen(true)
    if (on && primary) setForm((f) => ({ ...primary, kind, address: f.address, secondaryAddress: f.secondaryAddress, nickname: f.nickname || 'Reserva' }))
  }
  const submit = (e: FormEvent) => {
    e.preventDefault()
    const errs: Record<string, string | undefined> = {
      [`${p}-displayName`]: form.displayName.trim() ? undefined : 'Informe o nome de exibição.',
      [`${p}-nickname`]: form.nickname.trim() ? undefined : 'Informe um apelido para a carteira.',
      [`${p}-network`]: form.network ? undefined : 'Selecione uma rede.',
      [`${p}-profileName`]: form.profileName.trim() ? undefined : 'Informe o nome do perfil.',
      [`${p}-address`]: ADDRESS.test(form.address) ? undefined : 'Endereço deve ter 0x seguido de 40 caracteres hexadecimais.',
      [`${p}-provider`]: form.provider ? undefined : 'Selecione uma carteira.',
      [`${p}-referralCode`]: form.referralCode.trim() ? undefined : 'Informe o código de indicação.',
      [`${p}-email`]: EMAIL.test(form.email) ? undefined : 'E-mail inválido.',
      [`${p}-ensName`]: /^[a-z0-9-]{3,30}$/.test(form.ensName) ? undefined : 'Use 3–30 letras minúsculas, números ou hífen.',
    }
    setErrors(errs)
    const first = Object.keys(errs).find((k) => errs[k]); if (first) return document.getElementById(first)?.focus()
    save.mutate()
  }
  return (
    <section aria-labelledby={`${p}-title`} data-testid={`wallet-${kind}`} className="flex flex-col gap-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex flex-col gap-1">
          <h2 id={`${p}-title`} className="text-base">{title}</h2>
          <p className="text-xs text-muted">{subtitle}</p>
        </div>
        <div className="flex items-center gap-4 text-sm">
          {kind === 'secondary' && primary && (
            <label className="flex cursor-pointer items-center gap-2">
              <input type="checkbox" className="h-4 w-4 accent-[#D28A4C]" checked={same} onChange={(e) => copyPrimary(e.target.checked)} />Igual à carteira principal
            </label>
          )}
          {!wallet && !open && <button type="button" className="font-bold text-price hover:underline" onClick={() => setOpen(true)}>Adicionar</button>}
        </div>
      </div>
      {open && (
        <form noValidate onSubmit={submit} className="flex flex-col gap-6" aria-labelledby={`${p}-title`}>
          <div className="grid gap-x-7 gap-y-5 lg:grid-cols-2">
            <Field id={`${p}-displayName`} label="Nome de exibição" required error={errors[`${p}-displayName`]}>{(a) => <Input {...a} value={form.displayName} onChange={(e) => set('displayName', e.target.value)} />}</Field>
            <Field id={`${p}-nickname`} label="Apelido da carteira" required error={errors[`${p}-nickname`]}>{(a) => <Input {...a} value={form.nickname} onChange={(e) => set('nickname', e.target.value)} />}</Field>
            <Field id={`${p}-network`} label="Rede" required error={errors[`${p}-network`]}>{(a) => (
              <NativeSelect {...a} value={form.network} onChange={(e) => set('network', e.target.value as WalletInput['network'])}>
                <option value="" disabled>Selecione uma rede</option>{NETWORKS.map((n) => <option key={n.value} value={n.value}>{n.label}</option>)}
              </NativeSelect>)}
            </Field>
            <Field id={`${p}-profileName`} label="Nome do perfil" required error={errors[`${p}-profileName`]}>{(a) => <Input {...a} value={form.profileName} onChange={(e) => set('profileName', e.target.value)} />}</Field>
            <Field id={`${p}-address`} label="Endereço da carteira" required error={errors[`${p}-address`]} hint="0x seguido de 40 caracteres hexadecimais.">{(a) => <Input {...a} spellCheck={false} placeholder="Endereço 0x da carteira" value={form.address} onChange={(e) => set('address', e.target.value.trim())} />}</Field>
            <Field id={`${p}-secondaryAddress`} label="ENS ou carteira secundária (opcional)" hideLabel error={errors[`${p}-secondaryAddress`]}>{(a) => <div className="lg:pt-7"><Input {...a} spellCheck={false} placeholder="ENS ou carteira secundária (opcional)" value={form.secondaryAddress} onChange={(e) => set('secondaryAddress', e.target.value.trim())} /></div>}</Field>
            <Field id={`${p}-provider`} label="Tipo de carteira" required error={errors[`${p}-provider`]}>{(a) => (
              <NativeSelect {...a} value={form.provider} onChange={(e) => set('provider', e.target.value as WalletInput['provider'])}>
                <option value="" disabled>Selecione uma carteira</option>{WALLET_PROVIDERS.map((w) => <option key={w.value} value={w.value}>{w.label}</option>)}
              </NativeSelect>)}
            </Field>
            <Field id={`${p}-referralCode`} label="Código de indicação" required error={errors[`${p}-referralCode`]}>{(a) => <Input {...a} value={form.referralCode} onChange={(e) => set('referralCode', e.target.value)} />}</Field>
            <Field id={`${p}-email`} label="E-mail" required error={errors[`${p}-email`]}>{(a) => <Input {...a} type="email" value={form.email} onChange={(e) => set('email', e.target.value)} />}</Field>
            <Field id={`${p}-ensName`} label="Nome ENS" required error={errors[`${p}-ensName`]}>{(a) => (
              <div className="flex gap-2"><span className="flex h-10 items-center border border-field px-3 text-sm" aria-hidden>.eth</span><Input {...a} value={form.ensName} onChange={(e) => set('ensName', e.target.value.toLowerCase())} /></div>)}
            </Field>
          </div>
          {errors[`${p}-kind`] && <p role="alert" className="text-xs text-danger">⚠ {errors[`${p}-kind`]}</p>}
          {save.isError && !(save.error instanceof ApiError && save.error.fields) && <Alert tone="error" title="Não foi possível salvar">{save.error.message}</Alert>}
          {save.isSuccess && <p role="status" className="text-sm text-success">✓ Carteira salva.</p>}
          <Button type="submit" className="h-10 w-fit px-1.5" disabled={save.isPending}>{save.isPending ? 'Salvando…' : 'Salvar carteira'}</Button>
        </form>
      )}
    </section>
  )
}
