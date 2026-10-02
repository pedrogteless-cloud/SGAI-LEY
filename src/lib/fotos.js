import { supabase } from './supabase'

export const BUCKET_FOTOS = 'fotos'

// O bucket só aceita esses tipos (limite de 8 MB configurado lá também).
// Manter a lista aqui é o que deixa o erro aparecer antes do upload, em
// português, em vez de voltar como um 400 do storage.
const EXTENSAO_POR_TIPO = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/heic': 'heic',
  'image/heif': 'heif',
}
const TAMANHO_MAXIMO = 8 * 1024 * 1024

/**
 * Sobe uma foto e devolve tudo que o banco precisa pra guardá-la de
 * verdade — inclusive o `storage_path`.
 *
 * O caminho importa: sem ele a única pista de onde o arquivo mora é a URL
 * pública, que só funciona enquanto o bucket for público e que a gente
 * teria que desmontar com regex pra conseguir apagar a foto depois. A
 * coluna storage_path existe desde sempre no schema; era ela que nunca
 * estava sendo preenchida.
 */
export async function enviarFoto(file) {
  const tipo = file.type || 'image/jpeg'
  if (!EXTENSAO_POR_TIPO[tipo]) {
    return { erro: 'Essa foto está num formato que o sistema não aceita. Tire de novo pela câmera.' }
  }
  if (file.size > TAMANHO_MAXIMO) {
    return { erro: 'Essa foto passou de 8 MB. Tire de novo com menos qualidade.' }
  }

  const caminho = `${crypto.randomUUID()}.${EXTENSAO_POR_TIPO[tipo]}`
  const { error } = await supabase.storage
    .from(BUCKET_FOTOS)
    .upload(caminho, file, { contentType: tipo, upsert: false })
  if (error) {
    return { erro: 'A foto não subiu. Confira a internet e tente de novo.' }
  }

  const { data } = supabase.storage.from(BUCKET_FOTOS).getPublicUrl(caminho)
  return { foto: { url: data.publicUrl, storage_path: caminho, mime_type: tipo, legenda: '' } }
}

/**
 * Tira do bucket as fotos que não vão ser usadas — o caso comum é a
 * pessoa tirar a foto e fechar o modal no "Cancelar".
 *
 * De propósito não devolve erro nem interrompe nada: isto é faxina. Se
 * falhar (sem internet, foto de outra pessoa), o pior que acontece é o
 * arquivo continuar no bucket, que é exatamente o que acontecia antes —
 * e o usuário não pode ver um alerta vermelho por causa de um cancelar
 * que, pra ele, deu certo.
 */
export async function descartarFotos(fotos) {
  const caminhos = (fotos || []).map(caminhoDaFoto).filter(Boolean)
  if (!caminhos.length) return
  try {
    await supabase.storage.from(BUCKET_FOTOS).remove(caminhos)
  } catch {
    // faxina de melhor esforço — ver comentário acima
  }
}

/**
 * O caminho da foto dentro do bucket. Preferimos o que está gravado; a
 * leitura pela URL é só pras fotos antigas, salvas antes do storage_path
 * passar a ser preenchido.
 */
export function caminhoDaFoto(foto) {
  if (!foto) return null
  if (foto.storage_path) return foto.storage_path
  return caminhoDaUrlPublica(foto.url)
}

export function caminhoDaUrlPublica(url) {
  if (typeof url !== 'string') return null
  const marca = `/storage/v1/object/public/${BUCKET_FOTOS}/`
  const corte = url.indexOf(marca)
  if (corte === -1) return null
  const caminho = url.slice(corte + marca.length).split('?')[0]
  return decodeURIComponent(caminho) || null
}
