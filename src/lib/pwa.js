/**
 * Registro do service worker e aviso de versão nova.
 *
 * O app fica aberto dias seguidos no celular do encarregado e na TV do
 * chão de fábrica. Sem isso, um deploy só chega quando alguém lembra de
 * recarregar — e a pessoa continua usando uma versão com defeito que já
 * foi corrigido. Com isso, a versão nova é baixada em silêncio e a troca
 * acontece quando a pessoa toca em "atualizar", nunca no meio de um
 * formulário preenchido pela metade.
 */
export function registrarServiceWorker(aoTerAtualizacao) {
  if (!('serviceWorker' in navigator)) return

  navigator.serviceWorker.register('/sw.js').then((registro) => {
    // Já tem uma versão nova esperando de uma visita anterior.
    if (registro.waiting) aoTerAtualizacao(() => trocar(registro))

    registro.addEventListener('updatefound', () => {
      const novo = registro.installing
      if (!novo) return
      novo.addEventListener('statechange', () => {
        // `controller` nulo = primeira instalação: não há o que avisar,
        // a pessoa acabou de abrir a versão mais nova que existe.
        if (novo.state === 'installed' && navigator.serviceWorker.controller) {
          aoTerAtualizacao(() => trocar(registro))
        }
      })
    })

    // A cada volta pro app, confere se saiu versão nova.
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') registro.update().catch(() => {})
    })
  }).catch(() => {
    // Sem service worker o app funciona igual, só não abre offline.
  })

  let recarregando = false
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (recarregando) return
    recarregando = true
    window.location.reload()
  })
}

function trocar(registro) {
  registro.waiting?.postMessage('ASSUMIR_AGORA')
}
