/**
 * Cache cho trạng thái revoke của JWT theo `jti`.
 *
 * - `undefined` (cache miss): chưa biết, cần check DB.
 * - `'valid'`: vừa verify gần đây, chưa revoke (TTL ngắn — mặc định 60s).
 * - `'revoked'`: đã bị revoke; KHÔNG cần đụng DB nữa cho tới khi entry expire.
 *
 * Cache giảm round trip DB ở hot path `app.auth.verify`. Logout sẽ
 * invalidate entry tương ứng ngay lập tức để tránh race với revoke.
 */
export type TokenRevocationStatus = 'valid' | 'revoked';

export interface TokenRevocationCachePort {
  /** Đọc trạng thái cached cho jti. Trả undefined nếu miss. */
  get(jti: string): TokenRevocationStatus | undefined;
  /** Ghi trạng thái vào cache. TTL được quyết định bởi adapter. */
  set(jti: string, status: TokenRevocationStatus): void;
  /** Xoá entry — gọi khi logout để bảo đảm consistency tức thì. */
  delete(jti: string): void;
}
