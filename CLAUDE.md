# CLAUDE.md

## Project Overview

TypeScript CLI for reading curated cards from the terminal. JSON-first output (for AI agents), human-only commands (login, logout, status, help) force pretty output. Auth via Authing OIDC PKCE flow with OS keychain storage. Installed globally via `npm install -g` from GitHub repo.

## Key Files

| File | Description |
|------|-------------|
| `src/cli.ts` | Main entry point — Commander setup, command registration, parseAsync + auto-update |
| `src/config.ts` | All hardcoded config: API_BASE, Authing domain/APP_ID, keychain service name, loopback port |
| `src/http.ts` | Authenticated fetch wrapper with auto 401 refresh retry and X-Curation-Client header |
| `src/output.ts` | Pretty/JSON mode toggle; outputJSON writes to stdout, outputError writes to stderr |
| `src/errors.ts` | CurationError class with typed exit codes; factory functions for auth/notFound/usage/server errors |
| `src/auto_update.ts` | Background auto-update: checks GitHub releases API, spawns detached npm install, 24h throttle |
| `src/auth/login.ts` | Full OIDC Authorization Code + PKCE flow: loopback server, browser open, token exchange, invite code handling |
| `src/auth/logout.ts` | Clears keychain tokens and deletes user config file |
| `src/auth/keychain.ts` | @napi-rs/keyring wrapper for get/set/delete access_token and refresh_token |
| `src/auth/refresh.ts` | Refresh access_token using refresh_token via Authing OIDC token endpoint |
| `src/auth/user_store.ts` | Read/write/delete user profile JSON at ~/.config/curation/user.json |
| `src/commands/card_list.ts` | `card list` command — date range resolution, server-side filtering, table or JSON output |
| `src/commands/card_show.ts` | `card show <card_id>` command — single card detail with markdown rendering in pretty mode |
| `src/commands/status.ts` | `status` command — CLI version, login state, token expiry, update availability |
| `src/commands/self_update.ts` | `self-update` command — check GitHub latest release, run npm install -g from tag |
| `package.json` | Node >=20, bin entry `curation`, type: module, dependencies include commander/keyring/marked |

## Commands

```bash
npm install
npm run build                  # tsc -> dist/
npm run dev                    # tsc --watch
node --test dist/tests/        # Run tests
npm install -g .               # Install globally for local dev
git tag v0.1.X && git push origin v0.1.X  # Trigger release
```

## Key Conventions

- `dist/` is committed to git (npm git installs don't run build scripts reliably)
- All config hardcoded in `src/config.ts` -- no env vars needed (except optional CURATION_AUTO_UPDATE=0)
- Human-only commands (login, logout, status, help) force `setPretty(true)`
- JSON output to stdout; human messages to stderr
- Auth tokens in OS keychain via `@napi-rs/keyring` (service: `com.zhuhuifeng.curation`)
- User profile stored at `~/.config/curation/user.json`
- Auto-update runs background after each command (24h throttle), detached child process
- Exit codes: 0=success, 1=business error, 2=usage error, 4=auth required, 5=server/network error
- Uses `--install-links` for npm git installs (avoids broken symlinks)
- Server endpoints: `/cli/cards` and `/cli/cards/{card_id}` (separate from app endpoints)
- All HTTP requests include `X-Curation-Client: cli` header

## Gotchas

- Must use `program.parseAsync()` not `program.parse()` -- async actions need await
- Auto-update spawn must use fd-based stdio (`openSync` fd), not pipe streams, to allow parent exit
- `@napi-rs/keyring` is a native module -- different binary per platform
- Authing APP_ID and domain are hardcoded in `src/config.ts`, not configurable per-deployment
- Login flow has 120s timeout on the loopback callback server
- Token refresh on 401 is automatic (single retry) -- if refresh also fails, throws auth error
- `card list` requires either `--range` or both `--since`/`--until` -- omitting both is a usage error
