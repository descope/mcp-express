export interface AuthInfo {
  /** The JWT token */
  token: string;
  /** The client ID associated with this token */
  clientId: string;
  /** The user ID associated with this token */
  userId: string;
  /** Scopes associated with this token */
  scopes: string[];
  /** Token expiration timestamp */
  expiresAt: number;
}
