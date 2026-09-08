import { useEffect, useState } from 'react'
import { KeyRound } from 'lucide-react'
import { useRpc } from '../hooks/useDados'
import { useAuth } from '../hooks/useAuth'
import { Botao, Campo, Modal, Erro, useAviso } from './ui'

const soDigitos = (v) => v.replace(/\D/g, '').slice(0, 6)

/**
 * PIN de 6 números pra técnico/gestor lançar gasto direto no QR da
 * máquina, sem digitar e-mail e senha no celular. Só quem já está logado
 * de verdade pode definir o próprio — o PIN é só um atalho depois.
 */
export default function DefinirPin({ aberto, aoFechar }) {
  const { perfil } = useAuth()
  const avisar = useAviso()
  const definir = useRpc('definir_meu_pin')

  const [pin, setPin] = useState('')
  const [confirmar, setConfirmar] = useState('')
  const [erro, setErro] = useState(null)

  useEffect(() => {
    if (!aberto) return
    setPin('')
    setConfirmar('')
    setErro(null)
  }, [aberto])

  const salvar = async () => {
    setErro(null)
    if (pin.length !== 6) {
      setErro(new Error('O PIN precisa ter 6 números.'))
      return
    }
    if (pin !== confirmar) {
      setErro(new Error('Os dois PINs precisam ser iguais.'))
      return
    }
    try {
      await definir.mutateAsync({ p_pin: pin })
      avisar('PIN salvo. Agora dá pra lançar gasto pelo QR da máquina.')
      aoFechar()
    } catch (e) {
      setErro(e)
    }
  }

  return (
    <Modal
      aberto={aberto}
      aoFechar={aoFechar}
      titulo="PIN de campo"
      rodape={
        <>
          <Botao variante="secundario" onClick={aoFechar}>Cancelar</Botao>
          <Botao onClick={salvar} carregando={definir.isPending} disabled={pin.length !== 6}>
            Salvar PIN
          </Botao>
        </>
      }
    >
      <div className="space-y-4">
        <div className="flex items-start gap-2 rounded-lg bg-sky-50 px-3 py-2.5 text-sm text-sky-800 ring-1 ring-sky-200 ring-inset">
          <KeyRound size={16} className="mt-0.5 shrink-0" />
          <span>
            Com o PIN, {perfil?.nome?.split(' ')[0] || 'você'} lança gasto direto no QR da máquina, sem
            precisar entrar no sistema. É pessoal — não compartilhe.
            {perfil?.pin_hash && ' Já existe um PIN salvo; salvar de novo troca o antigo.'}
          </span>
        </div>

        <Campo rotulo="PIN (6 números)">
          <input
            type="tel"
            inputMode="numeric"
            autoComplete="off"
            value={pin}
            onChange={(e) => setPin(soDigitos(e.target.value))}
            placeholder="••••••"
            className="campo text-center font-mono text-2xl tracking-[0.5em]"
          />
        </Campo>
        <Campo rotulo="Confirme o PIN">
          <input
            type="tel"
            inputMode="numeric"
            autoComplete="off"
            value={confirmar}
            onChange={(e) => setConfirmar(soDigitos(e.target.value))}
            placeholder="••••••"
            className="campo text-center font-mono text-2xl tracking-[0.5em]"
          />
        </Campo>

        <Erro erro={erro} />
      </div>
    </Modal>
  )
}
