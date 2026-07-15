# cs2haze API contract

The launcher uses the existing website account. It does not contain a separate
email/password form. The canonical API and agent origin is
`https://paracetamolhaze.ru`.

## GET `/api/cs2/launcher/manifest`

Returns launcher/runtime versions and the authentication feature flags.

When `launcherVersion` is newer than the running version, `launcherUrl` must
point to `cs2haze-launcher.zip` and `launcherSha256` must contain the lowercase
SHA-256 of that archive. The launcher downloads and verifies the archive,
starts `cs2haze-updater.exe` from a temporary location, and exits. The updater
keeps `launcher-config.json` and the runtime, swaps the installation directory,
waits for a versioned ready signal, rolls back if replacement or relaunch
fails, and then starts the new launcher. Before replacement, the launcher adds
a per-user Windows `RunOnce` recovery command; after an interrupted update or
power loss it restores the saved installation before starting cs2haze.

For safety, `launcherUrl` is accepted only when it points to
`https://github.com/almazazamatov22-blip/paracetamolhazeweb/releases/` and the
asset name is exactly `cs2haze-launcher.zip`. Redirects from that GitHub URL are
handled by `HttpClient`; arbitrary manifest hosts are rejected.

The launcher archive contains `launcher-update.json`:

```json
{
  "launcherVersion": "1.0.4",
  "entryPoint": "cs2haze.exe"
}
```

Both launcher artifacts are produced by `scripts/build-cs2haze.ps1`:

```text
cs2haze-launcher.zip
cs2haze-launcher.sha256
```

Production currently requires authentication and does not require a paid
subscription:

```json
{
  "requireAuthentication": true,
  "requireSubscription": false
}
```

## Browser handoff

1. The launcher opens `GET /cs2haze/connect` in the default browser.
2. The page uses the site's existing `twitch_token` cookie. If it is missing,
   the user signs in through `/auth/twitch?source=cs2haze` and returns to the
   same page.
3. The user confirms the connection.
4. The page requests a short-lived connect token and opens the registered
   `cs2haze://` protocol.

## POST `/api/cs2/launcher/connect-token`

Requires the authenticated site's `twitch_token` cookie. Returns a signed
connect token that expires after five minutes:

```json
{
  "token": "signed-connect-token"
}
```

The browser passes it to Windows as:

```text
cs2haze://connect?token=<url-encoded-token>
```

The installer registers the protocol for the current Windows user. A secondary
launcher process atomically hands the token to the already-running primary
process.

## POST `/api/cs2/launcher/auth/claim`

Request:

```json
{
  "token": "signed-connect-token"
}
```

Returns the launcher session and a protected-at-rest refresh token:

```json
{
  "access": true,
  "subscriptionActive": true,
  "plan": "free",
  "streamerId": "123456",
  "displayName": "Streamer",
  "refreshToken": "signed-refresh-token"
}
```

## POST `/api/cs2/launcher/auth/refresh`

Request:

```json
{
  "refreshToken": "signed-refresh-token"
}
```

Returns the current launcher session. The launcher stores this token encrypted
with Windows DPAPI for the current user.

## Removed endpoints

The previous `/api/cs2/launcher/auth/start`,
`/api/cs2/launcher/auth/poll`, and `/api/cs2/launcher/session` device-code flow
is no longer part of the launcher contract.
