// Authentication types
export type { AuthInfo } from "./auth.js";

// Scope validation utilities
export {
  validateScopes,
  hasScope,
  hasAnyScope,
  hasAllScopes,
} from "./scopes.js";

// Outbound token utilities  
export {
  getOutboundToken,
  createTokenManager,
  DescopeTokenManager,
  type DescopeConfig,
} from "./outbound.js";