# CLAUDE.md - Hono OAuth Provider

## Package Purpose
OAuth 2.1 proxy provider for Hono. Issues proxy tokens that map to encrypted upstream tokens (Sentry, GitHub). Multi-runtime support (Workers, Node.js, Deno, Bun).

## Critical Rules
1. **ALWAYS reference OAuth spec URLs in code/docs when implementing OAuth features**
2. **Modular handlers**: Each endpoint is self-contained, well-documented, independently testable
3. **OAuth 2.1 compliance**: Follow [draft-ietf-oauth-v2-1-10](https://datatracker.ietf.org/doc/html/draft-ietf-oauth-v2-1-10)
4. **No test duplication**: Each handler/feature has dedicated tests in appropriate module

## Architecture
- `src/handlers/` - OAuth endpoints (authorize, token, register, revoke, introspect, discovery)
- `src/lib/` - Utilities (crypto, validation, errors)
- `src/core/` - Business logic (consent management)
- Middleware pattern: `OAuthProvider(config)` returns Hono middleware function

## Key Features
- **OAuth Proxy**: `tokenExchangeCallback` exchanges upstream tokens during auth flows
- **Context Injection**: Decrypted upstream tokens available as `c.get('oauthContext')`
- **Storage Adapters**: `MemoryStorage`, `KVStorage` classes implement `Storage` interface
- **Multi-Runtime**: Runtime-agnostic with pluggable storage

## Test Organization
- `src/__tests__/endpoints/` - Handler-specific tests (token.test.ts, register.test.ts, etc.)
- `src/__tests__/security/` - OAuth 2.1 compliance tests with spec references
- `__tests__/` - Integration tests
- No duplicate tests between locations

## OAuth 2.1 Requirements
Per [spec](https://datatracker.ietf.org/doc/html/draft-ietf-oauth-v2-1-10):
- PKCE required for public clients ([§7.1](https://datatracker.ietf.org/doc/html/draft-ietf-oauth-v2-1-10#section-7.1))
- No implicit flow ([§7.2](https://datatracker.ietf.org/doc/html/draft-ietf-oauth-v2-1-10#section-7.2))
- Exact redirect URI matching ([§7.3](https://datatracker.ietf.org/doc/html/draft-ietf-oauth-v2-1-10#section-7.3))
- Refresh token rotation ([§7.4](https://datatracker.ietf.org/doc/html/draft-ietf-oauth-v2-1-10#section-7.4))

## Public API
Export only essentials:
- `OAuthProvider` (middleware function)
- `MemoryStorage`, `KVStorage` (adapter classes)
- Core types (`Storage`, `OAuth21Config`, etc.)
- Review other exports - most internals should be private