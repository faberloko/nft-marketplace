import { useEffect, useRef, useState, type FormEvent } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ImageIcon } from 'lucide-react'
import { ApiError } from '@/api/client'
import { api } from '@/api/endpoints'
import { keys } from '@/api/queries'
import type { User } from '@/api/types'
import { Alert, Button, Field, Input, PasswordInput, Skeleton } from '@/components/ui'
import { AccountLayout } from '@/components/AccountLayout'
import { useSession } from '@/lib/auth'
import { sessionStore } from '@/lib/session-store'
import { announce } from '@/lib/announcer'

/** Redimensiona para 256px (WebP) antes do envio: payload pequeno e previsível. */
async function resizeImage(file: File): Promise<string> {
  const bmp = await createImageBitmap(file)
  const size = 256
  const canvas = document.createElement('canvas')
  canvas.width = size; canvas.height = size
  const ctx = canvas.getContext('2d')!
  const s = Math.min(bmp.width, bmp.height)
  ctx.drawImage(bmp, (bmp.width - s) / 2, (bmp.height - s) / 2, s, s, 0, 0, size, size)
  return canvas.toDataURL('image/webp', 0.85)
}

export function ProfilePage() {
  const session = useSession()!
  const qc = useQueryClient()
  const profile = useQuery({ queryKey: keys.profile(session.user.id), queryFn: ({ signal }) => api.profile(signal) })
  useEffect(() => { document.title = 'Perfil do colecionador — Kurio' }, [])
  const onUser = (u: User) => {
    qc.setQueryData(keys.profile(u.id), u)
    const s = sessionStore.get(); if (s && s.user.id === u.id) sessionStore.set({ ...s, user: u })
  }
  return (
    <AccountLayout>
      <h1 className="mb-6 text-base">Perfil do colecionador</h1>
      {profile.isError ? <Alert tone="error" title="Falha ao carregar o perfil" action={<Button size="sm" className="w-fit" onClick={() => profile.refetch()}>Tentar novamente</Button>} />
        : !profile.data ? <Skeleton className="h-96 w-full" /> : <ProfileForm user={profile.data} onUser={onUser} />}
    </AccountLayout>
  )
}

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const strong = (p: string) => p.length >= 8 && /[A-Z]/.test(p) && /\d/.test(p)

function ProfileForm({ user, onUser }: { user: User; onUser: (u: User) => void }) {
  const [form, setForm] = useState({ name: user.name, username: user.username, email: user.email, ensName: user.ensName, walletNickname: user.walletNickname })
  const [pw, setPw] = useState({ currentPassword: '', newPassword: '', confirm: '' })
  const [errors, setErrors] = useState<Record<string, string | undefined>>({})
  const [saved, setSaved] = useState('')
  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) => setForm({ ...form, [k]: e.target.value })
  const setP = (k: keyof typeof pw) => (e: React.ChangeEvent<HTMLInputElement>) => setPw({ ...pw, [k]: e.target.value })
  const wantsPassword = !!(pw.currentPassword || pw.newPassword || pw.confirm)

  const save = useMutation({
    mutationFn: async () => {
      const u = await api.updateProfile(form)
      onUser(u)
      if (wantsPassword) await api.changePassword({ currentPassword: pw.currentPassword, newPassword: pw.newPassword })
      return wantsPassword
    },
    onSuccess: (pwChanged) => {
      setErrors({}); setPw({ currentPassword: '', newPassword: '', confirm: '' })
      const msg = pwChanged ? 'Perfil e senha atualizados.' : 'Alterações salvas.'
      setSaved(msg); announce(msg)
    },
    onError: (e) => {
      setSaved('')
      if (e instanceof ApiError && e.fields) {
        const map: Record<string, string> = { name: 'p-name', username: 'p-username', email: 'p-email', ensName: 'p-ensName', walletNickname: 'p-walletNickname', currentPassword: 'pw-currentPassword', newPassword: 'pw-newPassword' }
        const errs = Object.fromEntries(Object.entries(e.fields).map(([k, v]) => [map[k] ?? k, v]))
        setErrors(errs); const first = Object.keys(errs)[0]; if (first) document.getElementById(first)?.focus()
      }
      announce((e as Error).message, 'assertive')
    },
  })
  const submit = (e: FormEvent) => {
    e.preventDefault()
    const errs: Record<string, string | undefined> = {
      'p-name': form.name.trim() ? undefined : 'Informe o nome de exibição.',
      'p-username': /^[a-z0-9_]{3,20}$/.test(form.username) ? undefined : 'Use 3–20 letras minúsculas, números ou _.',
      'p-email': EMAIL.test(form.email) ? undefined : 'E-mail inválido.',
      'p-ensName': /^[a-z0-9-]{3,30}$/.test(form.ensName) ? undefined : 'Use 3–30 letras minúsculas, números ou hífen.',
      'p-walletNickname': form.walletNickname.trim() ? undefined : 'Informe um apelido para a carteira.',
    }
    if (wantsPassword) {
      errs['pw-currentPassword'] = pw.currentPassword ? undefined : 'Informe a senha atual.'
      errs['pw-newPassword'] = strong(pw.newPassword) ? undefined : 'Mínimo 8 caracteres, com maiúscula e número.'
      errs['pw-confirm'] = pw.confirm === pw.newPassword ? undefined : 'As senhas não conferem.'
    }
    setErrors(errs)
    const first = Object.keys(errs).find((k) => errs[k]); if (first) { setSaved(''); return document.getElementById(first)?.focus() }
    save.mutate()
  }
  return (
    <form noValidate onSubmit={submit} className="flex flex-col gap-8" aria-label="Perfil do colecionador">
      <div className="grid gap-x-7 gap-y-6 lg:grid-cols-2">
        <Field id="p-name" label="Nome de exibição" required error={errors['p-name']}>{(a) => <Input {...a} autoComplete="name" value={form.name} onChange={set('name')} />}</Field>
        <Field id="p-username" label="Nome de usuário" required error={errors['p-username']}>{(a) => <Input {...a} autoComplete="username" value={form.username} onChange={set('username')} />}</Field>
        <Field id="p-email" label="E-mail" required error={errors['p-email']}>{(a) => <Input {...a} type="email" autoComplete="email" value={form.email} onChange={set('email')} />}</Field>
        <Field id="p-ensName" label="Nome ENS" required error={errors['p-ensName']}>{(a) => (
          <div className="flex gap-2"><span className="flex h-10 items-center border border-field px-3 text-sm" aria-hidden>.eth</span><Input {...a} value={form.ensName} onChange={(e) => setForm({ ...form, ensName: e.target.value.toLowerCase() })} /></div>)}
        </Field>
        <Field id="p-walletNickname" label="Apelido da carteira" required error={errors['p-walletNickname']}>{(a) => <Input {...a} value={form.walletNickname} onChange={set('walletNickname')} />}</Field>
        <AvatarField user={user} onUser={onUser} />
      </div>
      <fieldset className="flex max-w-[417px] flex-col gap-5">
        <legend className="mb-5 text-base font-bold">Alterar senha</legend>
        <Field id="pw-currentPassword" label="Senha atual" error={errors['pw-currentPassword']}>{(a) => <PasswordInput {...a} autoComplete="current-password" value={pw.currentPassword} onChange={setP('currentPassword')} />}</Field>
        <Field id="pw-newPassword" label="Nova senha" error={errors['pw-newPassword']} hint="Mínimo 8 caracteres, com maiúscula e número.">{(a) => <PasswordInput {...a} autoComplete="new-password" value={pw.newPassword} onChange={setP('newPassword')} />}</Field>
        <Field id="pw-confirm" label="Confirmar nova senha" error={errors['pw-confirm']}>{(a) => <PasswordInput {...a} autoComplete="new-password" value={pw.confirm} onChange={setP('confirm')} />}</Field>
      </fieldset>
      {save.isError && !(save.error instanceof ApiError && save.error.fields) && <Alert tone="error" title="Não foi possível salvar">{save.error.message}</Alert>}
      {saved && <p role="status" className="text-sm text-success">✓ {saved}</p>}
      <Button type="submit" className="h-10 w-[131px]" disabled={save.isPending}>{save.isPending ? 'Salvando…' : 'Salvar'}</Button>
    </form>
  )
}

function AvatarField({ user, onUser }: { user: User; onUser: (u: User) => void }) {
  const input = useRef<HTMLInputElement>(null)
  const [error, setError] = useState<string>()
  const upload = useMutation({
    mutationFn: async (file: File) => api.uploadAvatar(await resizeImage(file)),
    onSuccess: (u) => { onUser(u); setError(undefined); announce('Avatar atualizado.') },
    onError: (e) => setError((e as ApiError).fields?.avatar ?? (e as Error).message),
  })
  const remove = useMutation({ mutationFn: api.removeAvatar, onSuccess: (u) => { onUser(u); announce('Avatar removido.') } })
  return (
    <div className="flex flex-col gap-2">
      <span id="avatar-label" className="text-sm">Avatar</span>
      <div className="flex items-center gap-6">
        {user.avatarUrl ? <img src={user.avatarUrl} alt={`Avatar de ${user.name}`} width={50} height={50} className="h-[50px] w-[50px] rounded-full border border-field object-cover" data-testid="avatar" />
          : <span role="img" aria-label="Sem avatar" className="flex h-[50px] w-[50px] items-center justify-center rounded-full border border-field bg-surface text-price"><ImageIcon aria-hidden className="h-5 w-5" /></span>}
        <input ref={input} id="avatar-input" type="file" accept="image/png,image/jpeg,image/webp" className="sr-only" aria-labelledby="avatar-label"
          aria-describedby={error ? 'avatar-error' : 'avatar-hint'} aria-invalid={!!error}
          onChange={(e) => {
            const f = e.target.files?.[0]; e.target.value = ''; if (!f) return
            if (!['image/png', 'image/jpeg', 'image/webp'].includes(f.type)) { setError('Formato não suportado.'); return }
            if (f.size > 5 * 1024 * 1024) { setError('Arquivo maior que 5 MB.'); return }
            upload.mutate(f)
          }} />
        <Button type="button" className="h-10 w-[98px]" disabled={upload.isPending} onClick={() => input.current?.click()}>{upload.isPending ? 'Enviando…' : 'Alterar'}</Button>
        <button type="button" className="text-sm hover:text-price disabled:opacity-50" disabled={!user.avatarUrl || remove.isPending} onClick={() => remove.mutate()}>Remover</button>
      </div>
      <p id="avatar-hint" className="text-xs text-muted">PNG, JPG ou WebP, até 5 MB.</p>
      {error && <p id="avatar-error" role="alert" className="text-xs text-danger">⚠ {error}</p>}
    </div>
  )
}
