// Use dynamic, guarded import for Tauri `invoke` so the module doesn't break
// when running in a regular browser/dev server without Tauri available.
type TauriInvoke = <T = any>(cmd: string, args?: any) => Promise<T>

async function getTauriInvoke(): Promise<TauriInvoke | null> {
  try {
    // Detect Tauri runtime presence; fallback to trying import anyway
    if (typeof window !== 'undefined' && (((window as any).__TAURI__) || (import.meta as any).env?.TAURI)) {
      const mod = await import('@tauri-apps/api/core')
      return mod.invoke as TauriInvoke
    }
    // Still attempt to import in case env flags aren't present
    const mod = await import('@tauri-apps/api/core')
    return mod.invoke as TauriInvoke
  } catch (e) {
    console.warn('Tauri `invoke` not available in this environment:', e)
    return null
  }
}

export async function getMacAddresses(): Promise<string[]> {
  const invoke = await getTauriInvoke()
  if (!invoke) {
    console.warn('getMacAddresses: tauri invoke not available; returning empty list')
    return []
  }
  try {
    const macs = await invoke('get_mac_addresses')
    return macs
  } catch (e) {
    console.error('Failed to get MAC addresses', e)
    return []
  }
}

export async function getPrimaryMac(): Promise<string | null> {
  const macs = await getMacAddresses()
  return macs.length > 0 ? macs[0] : null
}

async function computeHmacHex(secret: string, message: string): Promise<string> {
  const enc = new TextEncoder()
  const keyData = enc.encode(secret)
  const msgData = enc.encode(message)

  const cryptoKey = await window.crypto.subtle.importKey(
    'raw',
    keyData,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  )

  const sig = await window.crypto.subtle.sign('HMAC', cryptoKey, msgData)
  const bytes = new Uint8Array(sig)
  return Array.from(bytes).map((b) => b.toString(16).padStart(2, '0')).join('')
}

export async function sendMacToPi(piHost: string, mac: string, sharedSecret?: string): Promise<Response> {
  const url = `${piHost.replace(/\/+$/, '')}/verify-mac`
  const ts = Math.floor(Date.now() / 1000)
  let hmac = undefined
  if (sharedSecret) {
    const msg = `${mac}|${ts}`
    hmac = await computeHmacHex(sharedSecret, msg)
  }

  const body: any = { mac, ts }
  if (hmac) body.hmac = hmac

  return fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

export default { getMacAddresses, getPrimaryMac, sendMacToPi }
