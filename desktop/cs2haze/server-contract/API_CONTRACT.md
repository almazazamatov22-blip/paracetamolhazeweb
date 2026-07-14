# cs2haze API contract

The launcher uses the existing website account. It does not contain a separate
email/password form.

## GET `/api/cs2/launcher/manifest`

Returns the mandatory update manifest.

## POST `/api/cs2/launcher/auth/start`

Request:

```json
{
  "deviceId": "sha256-device-id",
  "app": "cs2haze"
}
```

Response:

```json
{
  "deviceCode": "one-time-random-code",
  "verificationUrl": "https://paracetamolhaze.ru/cs2haze/connect?code=...",
  "expiresAt": "2026-07-15T12:00:00Z",
  "intervalSeconds": 2
}
```

The verification page must use the site's existing authenticated session.
The user only confirms linking this computer.

## POST `/api/cs2/launcher/auth/poll`

Returns `pending`, `approved`, or `denied`. On approval it returns short-lived
access and refresh tokens.

## POST `/api/cs2/launcher/auth/refresh`

Exchanges a refresh token for a current launcher session.

## GET `/api/cs2/launcher/session`

Requires `Authorization: Bearer <accessToken>`.

Response:

```json
{
  "access": true,
  "subscriptionActive": true,
  "plan": "pro",
  "expiresAt": "2026-08-15T00:00:00Z",
  "streamerId": "123456",
  "displayName": "Streamer"
}
```

## Activation safety

Keep both flags disabled until the flow is tested end-to-end:

```json
{
  "requireAuthentication": false,
  "requireSubscription": false
}
```

Then enable authentication. Enable subscription only after the payment system
and entitlement records are ready.
