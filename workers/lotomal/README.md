# Lotomal Cloudflare Worker

Standalone Cloudflare Workers + Durable Objects deployment for Lotomal.

Deploy:

```powershell
npx wrangler deploy --config workers\lotomal\wrangler.jsonc
```

Local smoke test:

```powershell
npx wrangler dev --config workers\lotomal\wrangler.jsonc --local --port 8789 --ip 127.0.0.1
```

Required Cloudflare permissions for the API token:

- Account: Workers Scripts Edit
- Account: Workers Routes Edit, if binding a custom route from CLI
- Account: Durable Objects Edit
- Zone: DNS Edit, if creating `lotomal.paracetamolhaze.ru`

Use `lotomal.paracetamolhaze.ru` as the final public URL. Until DNS is bound,
the Worker can also run on its `*.workers.dev` URL.
