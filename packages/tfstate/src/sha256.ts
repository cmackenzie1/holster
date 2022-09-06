export function sha256(data: ArrayBuffer) {
  return crypto.subtle.digest('SHA-256', data);
}

export function buf2hex(buffer: ArrayBuffer): string {
  return [...new Uint8Array(buffer)].map((x) => x.toString(16).padStart(2, '0')).join('');
}
