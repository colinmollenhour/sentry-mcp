# @sentry/hono-oauth-provider

**OAuth 2.1 Proxy Provider** for Hono - Multi-runtime OAuth proxy that issues secure tokens mapping to upstream provider credentials.

**Key Features:**
- 🔄 **OAuth Proxy Pattern**: Your tokens → encrypted upstream tokens (Sentry, GitHub, etc.)
- 🌍 **Multi-Runtime**: Cloudflare Workers, Node.js, Deno, Bun
- 🔧 **Pluggable Storage**: In-memory, KV, Redis, database adapters
- ✅ **OAuth 2.1 Compliant**: PKCE, refresh token rotation, exact URI matching

## Quick Start

```bash
npm install @sentry/hono-oauth-provider
```

### Basic Usage

```typescript
import { Hono } from 'hono';
import { OAuthProvider, MemoryStorage } from '@sentry/hono-oauth-provider';

const app = new Hono();

// OAuth proxy middleware
app.use('*', OAuthProvider({
  storage: new MemoryStorage(),
  issuer: 'https://your-domain.com',
  scopesSupported: ['read', 'write'],
  
  // Exchange upstream tokens during authorization
  tokenExchangeCallback: async ({ grantType, context }) => {
    if (grantType === 'authorization_code') {
      // Exchange authorization code with upstream provider (e.g., Sentry)
      const response = await fetch('https://sentry.io/oauth/token/', {
        method: 'POST',
        body: new URLSearchParams({
          grant_type: 'authorization_code',
          code: context.upstreamCode,
          client_id: UPSTREAM_CLIENT_ID,
          client_secret: UPSTREAM_CLIENT_SECRET,
        }),
      });
      
      const tokens = await response.json();
      return {
        newContext: {
          upstreamToken: tokens.access_token,
          upstreamRefreshToken: tokens.refresh_token,
        },
        accessTokenTTL: tokens.expires_in,
      };
    }
    
    if (grantType === 'refresh_token') {
      // Refresh upstream tokens
      const response = await fetch('https://sentry.io/oauth/token/', {
        method: 'POST',
        body: new URLSearchParams({
          grant_type: 'refresh_token',
          refresh_token: context.upstreamRefreshToken,
          client_id: UPSTREAM_CLIENT_ID,
          client_secret: UPSTREAM_CLIENT_SECRET,
        }),
      });
      
      const tokens = await response.json();
      return {
        newContext: {
          upstreamToken: tokens.access_token,
          upstreamRefreshToken: tokens.refresh_token,
        },
        accessTokenTTL: tokens.expires_in,
      };
    }
  }
}));

// Protected routes automatically receive decrypted upstream tokens
app.get('/api/*', async (c) => {
  const oauthContext = c.get('oauthContext');
  
  if (!oauthContext?.upstreamToken) {
    return c.json({ error: 'Unauthorized' }, 401);
  }
  
  // Forward to upstream API with stored token
  return fetch(`https://sentry.io/api${c.req.path}`, {
    headers: {
      'Authorization': `Bearer ${oauthContext.upstreamToken}`,
    },
  });
});

export default app;
```

## Storage Adapters

### In-Memory (Development/Testing)

```typescript
import { MemoryStorage } from '@sentry/hono-oauth-provider';

const storage = new MemoryStorage(); // Data lost on restart
```

### Cloudflare KV (Production)

```typescript
import { KVStorage } from '@sentry/hono-oauth-provider';

export default {
  async fetch(request: Request, env: Env) {
    const app = new Hono();
    
    app.use('*', OAuthProvider({
      storage: new KVStorage(env.OAUTH_KV),
      issuer: new URL(request.url).origin,
      scopesSupported: ['read', 'write'],
      // ... tokenExchangeCallback
    }));
    
    return app.fetch(request, env);
  }
};
```

```toml
# wrangler.toml
kv_namespaces = [
  { binding = "OAUTH_KV", id = "your-kv-namespace-id" }
]
```

## OAuth Flow

1. **Client registers** → Gets client ID
2. **User authorizes** → Redirected to upstream provider (Sentry)
3. **Upstream authorization** → Returns to your proxy
4. **Token exchange** → `tokenExchangeCallback` stores upstream tokens encrypted
5. **API requests** → Clients use proxy tokens, you use upstream tokens internally

## OAuth Endpoints

- `GET/POST /oauth/authorize` - Authorization with PKCE support
- `POST /oauth/token` - Token exchange and refresh
- `POST /oauth/register` - Dynamic client registration
- `POST /oauth/revoke` - Token revocation
- `POST /oauth/introspect` - Token introspection
- `GET /.well-known/oauth-authorization-server` - Discovery metadata

## Configuration

```typescript
interface OAuth21Config {
  storage: Storage;                    // Storage adapter
  issuer: string;                      // Your OAuth server URL
  scopesSupported: string[];           // Available scopes
  strictMode?: boolean;                // OAuth 2.1 enforcement (default: true)
  maxAuthorizationLifetime?: number;   // Max auth lifetime (default: 1 year)
  tokenExchangeCallback?: (options) => Promise<result>; // Upstream token exchange
}
```

## License

MIT