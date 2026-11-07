# Deployment

```text
Deploy:  push to main → GitHub Actions (checks, build) → GitHub Pages: https://cjhines.github.io/swahili/
Serve:   https://cjhin.es/swahili/ → nginx on Chris's server (reverse proxy) → https://cjhines.github.io/swahili/
```

Deploys never touch the server. If the server is down, `cjhines.github.io/swahili/` still works, and
an installed copy of the app keeps working from its service worker cache (from milestone 5).

## GitHub settings

- **Settings → Pages → Build and deployment → Source: GitHub Actions.** There's no `gh-pages`
  branch.
- **Custom domain: empty.** Setting one would make Pages redirect away from `cjhines.github.io`
  and break the proxy.
- **The `cjhines.github.io` user site must never have a custom domain either.** GitHub applies a
  user site's custom domain to every project site on the account
  ([docs](https://docs.github.com/en/pages/configuring-a-custom-domain-for-your-github-pages-site/about-custom-domains-and-github-pages)).
  As of 2026-11-06 that repo has no Pages site at all.

## Workflows

| File | Runs on | Does |
| --- | --- | --- |
| `checks.yml` | called by the other two | lint, typecheck, unit tests, build, Playwright smoke test of the build under `/swahili/`, plus the Pages artifact when asked |
| `ci.yml` | pull requests, pushes to other branches | `checks.yml` |
| `deploy.yml` | push to `main`, manual dispatch | `checks.yml`, then `actions/deploy-pages`, then a non-blocking check that both URLs serve the new commit |

The build stamps the commit into `<meta name="swahili-version" content="<sha>">`. To see which
build a URL is serving:

```sh
curl -s https://cjhin.es/swahili/ | grep swahili-version
```

## The nginx proxy

This lives on the server in `/etc/nginx/sites-available/cjhin.es`, in the HTTPS server block. It was
added on 2026-11-06 and is recorded in the `infra` repo's `CHANGELOG.md`, which is the source of
truth. Any server change goes through that repo's process. This copy is here for reference.

```nginx
# Without this exact-match redirect, /swahili falls through to `location /` and the
# SPA fallback renders the cjhin.es homepage.
location = /swahili {
    return 301 /swahili/;
}

# ^~ so no regex location can ever capture /swahili/ requests.
location ^~ /swahili/ {
    resolver 127.0.0.53 valid=300s;              # re-resolve GitHub's IPs; don't pin them at startup
    set $swahili_upstream cjhines.github.io;
    proxy_pass https://$swahili_upstream;        # variable + no URI → the /swahili/... path is passed on unchanged
    proxy_http_version 1.1;
    proxy_set_header Host cjhines.github.io;
    proxy_ssl_server_name on;
    proxy_ssl_name cjhines.github.io;
    proxy_ssl_verify on;                         # nginx doesn't verify upstream certs by default
    proxy_ssl_verify_depth 3;                    # the default depth of 1 is too shallow for a real chain
    proxy_ssl_trusted_certificate /etc/ssl/certs/ca-certificates.crt;
    proxy_redirect https://cjhines.github.io/swahili/ /swahili/;
}
```

The block has no `add_header`, so the vhost's server-level security headers (HSTS,
`X-Frame-Options`, `nosniff`, `Referrer-Policy`) still apply. GitHub adds
`Access-Control-Allow-Origin: *` and `Cache-Control: max-age=600`.

## The service worker

`vite-plugin-pwa` (Workbox) generates `/swahili/sw.js` with scope `/swahili/`. It precaches the
whole build, including the lazily loaded FSRS model chunk, so the installed app works offline.

**How a deploy reaches users:**

1. On launch, and hourly while the app stays open, the browser checks for a new `sw.js`. GitHub
   Pages serves it with `max-age=600`, but browsers bypass the HTTP cache for these checks.
2. A new version installs in the background and **waits**. Nothing reloads by itself.
3. The setup screen shows **"A new version is ready · Update now"**, never a session screen.
   Otherwise the new version takes over the next time the app is fully closed and reopened.

So a fix can take a while to reach a phone that keeps the app open. Tapping "Update now" is
instant.

### Kill switch

If a service worker ever ships broken and keeps serving a bad build, a fixed deploy alone won't
reach users, because the broken worker is what serves the app. To remove it everywhere:

1. In `vite.config.ts`, add `selfDestroying: true` to the `VitePWA({...})` options and deploy.
   Each browser's next update check installs a worker that unregisters itself and deletes its
   caches.
2. Once things are fixed, remove the option and deploy again.

Progress lives in IndexedDB, not in the service worker's caches, so neither step touches it.

## Constraints this setup imposes on the app

- **Base path:** `vite.config.ts` sets `base: '/swahili/'`. The Playwright smoke test fails if
  any same-origin request falls outside it.
- **No server-side routing:** Pages can't rewrite URLs, so the app has no router. Screens are held
  as app state.
- **Shared origin with cjhin.es:** the IndexedDB database is named `swahili`, and localStorage
  keys start with `swahili:`. The service worker is served from `/swahili/sw.js` with
  `scope: '/swahili/'`, and the manifest's `start_url` and `scope` are `/swahili/`. The app sets
  no cookies.
- **Canonical URL:** `index.html` declares `https://cjhin.es/swahili/`, because the app is
  reachable at both URLs.
