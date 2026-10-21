// Desbloqueio por biometria (digital, Face ID, Touch ID, Windows Hello) usando WebAuthn.
// Funciona como uma trava do app neste aparelho: a conta continua sendo a do Google.
// A credencial fica só neste aparelho e nunca vai para a nuvem.

const KEY = 'sinapse:lock';

function readLock() {
  try { return JSON.parse(localStorage.getItem(KEY) || 'null'); } catch (e) { return null; }
}

function writeLock(value) {
  try {
    if (value) localStorage.setItem(KEY, JSON.stringify(value));
    else localStorage.removeItem(KEY);
  } catch (e) { /* sem armazenamento */ }
}

const b64url = (buf) => btoa(String.fromCharCode(...new Uint8Array(buf))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const fromB64url = (s) => Uint8Array.from(atob(s.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(s.length / 4) * 4, '=')), (c) => c.charCodeAt(0));
const randomBytes = (n) => crypto.getRandomValues(new Uint8Array(n));

export async function biometricAvailable() {
  try {
    return Boolean(window.PublicKeyCredential && window.isSecureContext &&
      await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable());
  } catch (e) {
    return false;
  }
}

export function biometricEnabled() {
  return Boolean(readLock());
}

// Cadastra a biometria do aparelho. O sistema mostra a própria tela (digital, rosto ou PIN).
export async function enableBiometric(userName, displayName) {
  const cred = await navigator.credentials.create({
    publicKey: {
      challenge: randomBytes(32),
      rp: { name: 'Sinapse', id: location.hostname },
      user: { id: randomBytes(16), name: userName || 'sinapse', displayName: displayName || 'Sinapse' },
      pubKeyCredParams: [{ type: 'public-key', alg: -7 }, { type: 'public-key', alg: -257 }],
      authenticatorSelection: { authenticatorAttachment: 'platform', userVerification: 'required', residentKey: 'discouraged' },
      timeout: 60000,
      attestation: 'none',
    },
  });
  writeLock({ id: b64url(cred.rawId), createdAt: Date.now() });
}

export function disableBiometric() {
  writeLock(null);
}

// Pede a biometria; resolve true se a pessoa confirmou.
export async function unlockWithBiometric() {
  const lock = readLock();
  if (!lock) return true;
  await navigator.credentials.get({
    publicKey: {
      challenge: randomBytes(32),
      rpId: location.hostname,
      allowCredentials: [{ type: 'public-key', id: fromB64url(lock.id), transports: ['internal'] }],
      userVerification: 'required',
      timeout: 60000,
    },
  });
  return true;
}
