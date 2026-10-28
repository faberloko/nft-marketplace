import { useEffect } from 'react'
import { Link } from '@tanstack/react-router'
import { useQueries } from '@tanstack/react-query'
import { nftQuery, useFavorites } from '@/api/queries'
import { Alert, Button } from '@/components/ui'
import { AccountLayout } from '@/components/AccountLayout'
import { NftCard, NftCardSkeleton } from '@/components/NftCard'
import { useSession } from '@/lib/auth'

/** “Lista de interesse”: favoritos persistidos para o usuário autenticado. */
export function FavoritesPage() {
  const session = useSession()!
  const favs = useFavorites(session.user.id)
  const nfts = useQueries({ queries: (favs.data ?? []).map((id) => nftQuery(id)) })
  useEffect(() => { document.title = 'Lista de interesse — Kurio' }, [])
  return (
    <AccountLayout>
      <h1 className="mb-6 text-base">Lista de interesse</h1>
      {favs.isError ? <Alert tone="error" title="Falha ao carregar favoritos" action={<Button size="sm" className="w-fit" onClick={() => favs.refetch()}>Tentar novamente</Button>} />
        : favs.data?.length === 0 ? <Alert tone="info" title="Você ainda não favoritou nenhum NFT" action={<Button asChild size="sm" className="w-fit"><Link to="/" hash="mercado">Explorar o mercado</Link></Button>} />
          : (
            <ul className="grid grid-cols-2 gap-6 lg:grid-cols-3">
              {favs.data ? nfts.map((q, i) => <li key={favs.data![i]}>{q.data ? <NftCard nft={q.data} /> : <NftCardSkeleton />}</li>)
                : [0, 1, 2].map((i) => <li key={i}><NftCardSkeleton /></li>)}
            </ul>
          )}
    </AccountLayout>
  )
}
