// Sons de alerta gerados por osciladores — sem arquivo de áudio para
// baixar, sem licença para pagar, e toca igual em qualquer navegador.

let contexto = null
function ctx() {
  if (!contexto) contexto = new (window.AudioContext || window.webkitAudioContext)()
  if (contexto.state === 'suspended') contexto.resume()
  return contexto
}

/** Uma nota: frequência (Hz), início (s a partir de agora), duração (s), tipo de onda. */
function nota(ac, destino, freq, inicio, duracao, onda = 'sine', ganho = 0.25) {
  const osc = ac.createOscillator()
  const vol = ac.createGain()
  osc.type = onda
  osc.frequency.value = freq
  const t0 = ac.currentTime + inicio
  vol.gain.setValueAtTime(0, t0)
  vol.gain.linearRampToValueAtTime(ganho, t0 + 0.015)
  vol.gain.exponentialRampToValueAtTime(0.001, t0 + duracao)
  osc.connect(vol).connect(destino)
  osc.start(t0)
  osc.stop(t0 + duracao + 0.02)
}

/** Cada preset é uma função que agenda notas a partir de agora. */
const PRESETS = {
  sino: (ac, dest) => {
    nota(ac, dest, 880, 0, 0.5, 'sine', 0.22)
    nota(ac, dest, 1318.5, 0.08, 0.6, 'sine', 0.16)
  },
  suave: (ac, dest) => {
    nota(ac, dest, 660, 0, 0.35, 'sine', 0.18)
  },
  'alerta-triplo': (ac, dest) => {
    ;[0, 0.18, 0.36].forEach((t) => nota(ac, dest, 988, t, 0.14, 'square', 0.18))
  },
  sirene: (ac, dest) => {
    const osc = ac.createOscillator()
    const vol = ac.createGain()
    osc.type = 'sawtooth'
    const t0 = ac.currentTime
    vol.gain.setValueAtTime(0.001, t0)
    vol.gain.linearRampToValueAtTime(0.2, t0 + 0.05)
    vol.gain.exponentialRampToValueAtTime(0.001, t0 + 1.1)
    osc.frequency.setValueAtTime(500, t0)
    osc.frequency.linearRampToValueAtTime(1000, t0 + 0.35)
    osc.frequency.linearRampToValueAtTime(500, t0 + 0.7)
    osc.frequency.linearRampToValueAtTime(900, t0 + 1.05)
    osc.connect(vol).connect(dest)
    osc.start(t0)
    osc.stop(t0 + 1.15)
  },
  grave: (ac, dest) => {
    nota(ac, dest, 130, 0, 0.35, 'triangle', 0.3)
    nota(ac, dest, 110, 0.2, 0.4, 'triangle', 0.28)
  },
}

export const SONS = [
  { valor: 'sino', rotulo: 'Sino' },
  { valor: 'suave', rotulo: 'Suave' },
  { valor: 'alerta-triplo', rotulo: 'Alerta triplo' },
  { valor: 'sirene', rotulo: 'Sirene' },
  { valor: 'grave', rotulo: 'Grave' },
]

/** Toca um preset pelo nome. Silencioso se o navegador bloquear áudio sem interação prévia. */
export function tocarSom(nome) {
  const preset = PRESETS[nome] || PRESETS.sino
  try {
    const ac = ctx()
    preset(ac, ac.destination)
  } catch {
    // navegador sem suporte ou áudio ainda bloqueado — ignora
  }
}
