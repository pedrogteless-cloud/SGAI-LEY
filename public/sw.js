/**
 * Service worker do SGAI.
 *
 * O objetivo aqui é bem estreito: o app abrir rápido e não virar tela
 * branca quando o sinal cai no meio do galpão. NÃO é funcionar offline de
 * verdade.
 *
 * A regra que manda em tudo: dado do Supabase nunca é guardado. Num
 * sistema de manutenção, mostrar um número velho achando que é o de agora
 * é pior do que mostrar erro — alguém decide em cima dele. Como o Supabase
 * é outro domínio, basta este worker ignorar tudo que não é do mesmo
 * endereço, e é o que ele faz logo na primeira linha do fetch.
 *
 * Fica guardado só o que é do próprio app: o HTML da casca e os arquivos
 * de /assets/, que já vêm com hash no nome (mudou o conteúdo, mudou o
 * nome) e por isso podem ser servidos do cache sem risco de ficar velho.
 */

const VERSAO = 'sgai-v1'
const CASCA = `${VERSAO}-casca`
const ARQUIVOS = `${VERSAO}-arquivos`

const PRECARGA = [
  '/',
  '/manifest.webmanifest',
  '/favicon.svg',
  '/icone-192.png',
  '/icone-512.png',
  '/icone-maskable-512.png',
  '/apple-touch-icon.png',
]

self.addEventListener('install', (evento) => {
  evento.waitUntil(
    caches.open(CASCA).then((cache) =>
      // addAll é tudo-ou-nada: um ícone que falhe derrubaria a instalação
      // inteira e o app ficaria sem worker nenhum.
      Promise.all(PRECARGA.map((url) => cache.add(url).catch(() => null)))
    )
  )
})

self.addEventListener('activate', (evento) => {
  evento.waitUntil(
    (async () => {
      const nomes = await caches.keys()
      await Promise.all(nomes.filter((n) => !n.startsWith(VERSAO)).map((n) => caches.delete(n)))
      await self.clients.claim()
    })()
  )
})

// A tela pede a troca quando a pessoa toca em "atualizar" — nunca por
// conta própria no meio de um formulário preenchido pela metade.
self.addEventListener('message', (evento) => {
  if (evento.data === 'ASSUMIR_AGORA') self.skipWaiting()
})

self.addEventListener('fetch', (evento) => {
  const req = evento.request
  if (req.method !== 'GET') return

  const url = new URL(req.url)
  // Supabase, fontes, qualquer outro domínio: passa direto, sem cache.
  if (url.origin !== self.location.origin) return

  // Navegação: rede primeiro, pra pegar deploy novo. Se não tem rede,
  // serve a casca guardada — o app abre e avisa que está sem conexão.
  if (req.mode === 'navigate') {
    evento.respondWith(
      (async () => {
        try {
          const resposta = await fetch(req)
          const cache = await caches.open(CASCA)
          cache.put('/', resposta.clone())
          return resposta
        } catch {
          return (await caches.match('/')) || Response.error()
        }
      })()
    )
    return
  }

  // Arquivos com hash no nome: cache primeiro, que é instantâneo e nunca
  // fica velho (nome novo a cada build).
  if (url.pathname.startsWith('/assets/')) {
    evento.respondWith(
      (async () => {
        const guardado = await caches.match(req)
        if (guardado) return guardado
        const resposta = await fetch(req)
        if (resposta.ok) (await caches.open(ARQUIVOS)).put(req, resposta.clone())
        return resposta
      })()
    )
    return
  }

  // Resto do próprio app (ícones, manifest): rede, e o cache só socorre.
  evento.respondWith(fetch(req).catch(async () => (await caches.match(req)) || Response.error()))
})
