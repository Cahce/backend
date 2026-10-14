import { isIP } from 'node:net';

/** Literal addresses only: never accept trust-all, hop counts or DNS-based trust. */
export function parseTrustedProxies(value: string): string[] | false {
    if (!value.trim()) return false;
    const entries = value.split(',').map(entry => entry.trim());
    if (entries.length > 32) throw new Error('At most 32 trusted proxy addresses are allowed');
    for (const entry of entries) {
        const [address, prefix, ...extra] = entry.split('/');
        const version = isIP(address);
        if (!version || extra.length || (prefix !== undefined &&
            (!/^\d{1,3}$/.test(prefix) || Number(prefix) < 1 || Number(prefix) > (version === 4 ? 32 : 128)))) {
            throw new Error('TRUST_PROXY_CIDRS requires literal IP addresses or nonzero CIDR prefixes');
        }
    }
    return [...new Set(entries)];
}
