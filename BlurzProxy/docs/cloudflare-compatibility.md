# Cloudflare and site-security compatibility

BlurzProxy does not bypass Cloudflare, CAPTCHA, Turnstile, bot-management, or Cloudflare Access controls. A destination site decides whether it accepts a request and which browser contexts it supports.

## What to expect

- Ordinary pages may load when the destination site permits the browser and transport.
- A site may display its own security challenge. Complete it only when the destination presents a supported, normal user-facing flow.
- Some challenges cannot work in an embedded or proxied browsing context. If the challenge does not render or the site refuses the session, open the official website in a normal browser or contact the site owner.
- Cloudflare Access requires an account and authorization granted by the organization that owns the site. BlurzProxy does not supply or circumvent that authorization.

## Troubleshooting

1. Reload once and check that the destination address is correct.
2. If a security check is displayed, use only the site's own supported completion flow. Do not use challenge-solving services, injected scripts, altered fingerprints, or automated retries.
3. If the site reports that cookies are disabled or unavailable, check the browser's ordinary cookie settings. Do not weaken BlurzProxy's own authentication cookie settings to fix a destination site's policy.
4. If the page times out or the challenge is incompatible with the embedded browser, use the official site in a standard browser. This is a site-side compatibility limitation, not proof that Cloudflare is broken.

## Session and cookie security

BlurzProxy's own sign-in cookie remains HttpOnly, Secure when served over HTTPS, SameSite=Strict, and scoped to the application path. These settings protect the BlurzProxy session and must not be relaxed as a workaround for destination-site challenges. Destination-site cookies are separate and remain subject to the destination site's policy and the browser engine's compatibility.

## Testing

The automated smoke test checks that the browser presents a clear, non-evasive explanation when a page load times out. It does not claim to pass Cloudflare challenges or establish compatibility with every Cloudflare configuration. Test only against sites and accounts you are authorized to use.
