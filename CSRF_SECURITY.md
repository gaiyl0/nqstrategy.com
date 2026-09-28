# CSRF, Origin, and CORS security

Every unsafe `/api/*` request (`POST`, `PUT`, `PATCH`, or `DELETE`) passes
through the root `proxy.js` before its Route Handler. Production requires
`APP_ORIGINS`, a comma-separated list of exact HTTPS origins without paths,
queries, credentials, or trailing slashes.

The proxy accepts an exact `Origin` match. If `Origin` is absent, it accepts an
exact origin derived from an allowed HTTP(S) `Referer`. Missing, `null`,
malformed, or unlisted sources are rejected with 403 and a signed
`security.csrf` audit event. JSON write routes require `application/json`;
uploads require `multipart/form-data`; logout and bodyless DELETE routes are
explicit exceptions.

Allowed cross-origin frontends receive credentialed CORS headers. Valid
preflights receive 204; unlisted preflight origins receive 403 and are audited.
Keep the allowlist as small as possible and never add wildcard origins when
credentials are enabled.

Non-browser automation may use `Authorization: Bearer <CSRF_AUTOMATION_SECRET>`
when that secret is configured with at least 32 characters. This bypasses only
the browser-origin check. It does not authenticate a user or grant a role, so
protected routes still require their normal Session and authorization. Store
this secret outside source control and rotate it separately from Session keys.

The reverse proxy must preserve browser `Origin` and `Referer` headers. The app
does not derive allowed public origins from `Host`, `X-Forwarded-Host`, or other
client-controlled forwarding headers. After every domain change, update
`APP_ORIGINS`, restart, and rerun the CSRF production tests.
