/** Current single-host Compose only. Input comes from an explicit secret-manager environment value. */
export function preparePoolerAuth(directUrl, adminPassword) {
  const url = new URL(directUrl);
  if (!['postgres:', 'postgresql:'].includes(url.protocol) || url.hostname !== 'db' ||
      (url.port && url.port !== '5432') || url.pathname !== '/tluscholar' || url.search || url.hash) {
    throw new Error('Expected the direct URL of the existing single-host Compose database');
  }
  const user = decodeURIComponent(url.username), password = decodeURIComponent(url.password);
  if (!user || !password || user === 'pooler_admin' || /[\x00-\x1f\x7f]/.test(user + password) ||
      /^md5[a-f0-9]{32}$/.test(password) || password.startsWith('SCRAM-SHA-256$') ||
      !/^[a-f0-9]{64}$/.test(adminPassword)) throw new Error('Invalid or ambiguous database credentials or console role collision');
  // Canonical percent encoding also keeps apostrophes/dollars out of dotenv values.
  const encode = value => encodeURIComponent(value).replace(/[!'()*]/g, character => `%${character.charCodeAt(0).toString(16).toUpperCase()}`);
  url.username = encode(user); url.password = encode(password);
  const quote = value => `"${value.replaceAll('"', '""')}"`;
  const users = `${quote(user)} ${quote(password)}\n"pooler_admin" "${adminPassword}"\n`;
  const pooled = new URL(url); pooled.hostname = 'pgbouncer'; pooled.port = '6432';
  return { users, directUrl: url.toString(), pooledUrl: pooled.toString() };
}
