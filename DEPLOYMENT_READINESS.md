# BlurzProxyV2 Deployment Readiness Status

This checklist tracks the requirements in the deployment plan. It is intentionally conservative: a code change is not considered deployment-ready until its checks pass and the hosting environment is verified.

## P0 — Critical

- [x] Require a session before serving the application and protected API routes.
- [x] Require a valid session and exact approved origin for the `/wisp/` WebSocket upgrade.
- [x] Restrict CORS to explicitly configured exact origins.
- [x] Require an exact trusted `Origin` on all state-changing HTTP requests and reject non-exact CORS origins.
- [x] Add login and API rate limits.
- [x] Use HTTP-only, SameSite=Strict cookies; require secure cookies and HTTPS in production; cap session lifetime.
- [~] Keep the Codespaces forwarded port private. The devcontainer now declares port 3000 private with HTTPS forwarding; verify the live Ports panel still shows Private. Codespaces is for private development/testing, not always-on production hosting.
- [~] Wisp transport restrictions now include a custom DNS resolver that examines the complete system DNS answer set and rejects the hostname if any answer is not globally routable. This addresses mixed public/private answers before Wisp's single-address cache/socket flow. Direct-IP, private/loopback, UDP, and non-web-port restrictions remain enabled; DNS cache retention is 30 seconds / 1,024 entries. Unit tests cover mixed answers, IPv4-mapped IPv6, and special-use address classes. Still required before production: execute Wisp-protocol integration tests against actual denied connection attempts, verify DNS changes across cache expiry, and perform host-level egress controls.
- [~] Keep production secrets out of source control, validate required startup settings, and use a template-only `.env.example`. The repository is currently public. A full-history Gitleaks workflow has been added; its first run is pending. Any detected credential must be revoked/rotated before considering history cleanup. GitHub secret-scanning alert access was not available during this review.

## P1 — High

- [x] Pin direct npm dependencies and commit the lockfile.
- [x] Add a full dependency audit to CI, including a weekly scheduled run.
- [~] Keep the current Scramjet/transport generation pinned. A deprecated dependency remains in the legacy browser stack; a major-generation migration needs a separate compatibility and regression review.
- [x] Keep Express 5 and Node 22 compatibility under CI.
- [x] Add HTTP security headers and production-safe error responses.
- [x] Add structured server events, failed-login/rate-limit events, and authenticated uptime/memory metrics.
- [x] Make readiness fail when required packages or the restricted Wisp transport configuration are unavailable.
- [x] Close upgraded WebSocket sockets during graceful shutdown, session logout, and session expiry.
- [x] Cap concurrent Wisp WebSockets at four per session and 64 process-wide.
- [x] Validate request bodies and cap JSON/form bodies at 1 MB.
- [x] Run tests for authentication, unauthorized API access, exact trusted-origin enforcement, WebSocket origin/session enforcement and logout revocation, Wisp policy configuration and per-session WebSocket caps, malformed/oversized requests, readiness failure, HTTP headers, and shutdown/restart.
- [x] Run the app container as the unprivileged Node user.
- [x] Add Compose resource limits and a readiness-based container health check.
- [x] Keep the app service on the private Compose backend network; Caddy is the public-facing reverse proxy.
- [x] Validate Compose configuration and build the production Docker image in CI.

## P2 — Medium

- [x] Add CodeQL JavaScript/TypeScript analysis on pushes, pull requests, and a weekly schedule.
- [x] Add structured logs and authenticated runtime metrics.
- [ ] Configure operational alerts and an external uptime/memory monitoring destination after the hosting target is selected.
- [x] Pin GitHub Actions to immutable commit SHAs and cancel superseded workflow runs.
- [ ] Configure branch protection so the required CI and CodeQL checks must pass before merging. No repository rulesets were returned during this review; branch-protection settings could not be read with the available GitHub connection. Owner/admin access is required to verify and configure this.
- [ ] Configure production deployment behind a manual approval gate after the hosting target is selected.
- [ ] Document backup, restore, and rollback procedures for the selected host, then test a restore.

## Accessibility and interface review

- [x] Run axe WCAG 2.1 AA checks on the homepage, settings, and every selectable theme.
- [x] Test keyboard access and visible focus for settings/theme controls.
- [x] Test mobile overflow and touch-target sizing at small viewports.
- [x] Keep browser action feedback exposed through accessible status elements.

## Production release blockers

1. Codespaces selected for private development/testing. Verify port 3000 is Private in the live Ports panel; do not use a Public forwarded port. Select a separate always-on host before any production release.
2. Confirm who is allowed to use the application: one owner, a small approved group, or organization members. The current app uses one shared admin password, not individual accounts.
3. For Codespaces, verify GitHub private-port authentication and HTTPS forwarding, and keep the port Private. For a later production host, verify the backend port is unreachable publicly and HTTPS/WSS is terminated by the approved reverse proxy.
4. Complete an SSRF/network-egress review of Wisp, including DNS rebinding, IPv4-mapped IPv6, redirects, and public-to-private resolution changes; add regression tests before treating outbound restrictions as a security boundary.
5. Configure production secrets in the host's secret manager and rotate any credential that may have been committed previously.
6. Enable required branch protection checks and a manual production approval gate.
7. Complete monitoring, backup/restore, and rollback setup and test it.

**Release rule:** keep deployment private and controlled. Do not expose the backend directly or proceed to a public release until the critical security, network, and automated-test phases are verified in the actual hosting environment.
