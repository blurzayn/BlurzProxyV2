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
- [~] Keep production secrets out of source control, validate required startup settings, and use a template-only `.env.example`. The repository is public. The full-history Gitleaks workflow is configured and its required check passed on the reviewed `main` commit. Any newly detected credential must be revoked/rotated; removing it from a later commit does not revoke it.

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
- [x] Configure the active `Protect main` ruleset with pull requests, up-to-date branches, and five required CI/security checks: browser/security tests, npm audit, production container build/Compose validation, CodeQL, and full-history Gitleaks.
- [ ] If automated deployment is introduced later, review and configure an appropriate deployment gate. This is not required to publish the source code or for independent users to self-host.
- [x] Document generic backup, restore, and rollback procedures in `DEPLOYMENT_RUNBOOK.md`.\n- [ ] A restore and rollback have not been tested on a real operator-managed host; each operator must validate their own environment.

## Accessibility and interface review

- [x] Run axe WCAG 2.1 AA checks on the homepage, settings, and every selectable theme.
- [x] Test keyboard access and visible focus for settings/theme controls.
- [x] Test mobile overflow and touch-target sizing at small viewports.
- [x] Keep browser action feedback exposed through accessible status elements.

## Independent operator deployment considerations

1. Codespaces is for private development/testing. Keep forwarded port 3000 Private. This does not block publishing the source repository; anyone running a permanent instance chooses and manages their own infrastructure.
2. Confirm who is allowed to use the application: one owner, a small approved group, or organization members. The current app uses one shared admin password, not individual accounts.
3. For Codespaces, verify GitHub private-port authentication and HTTPS forwarding, and keep the port Private. For a later production host, verify the backend port is unreachable publicly and HTTPS/WSS is terminated by the approved reverse proxy.
4. Complete an SSRF/network-egress review of Wisp, including DNS rebinding, IPv4-mapped IPv6, redirects, and public-to-private resolution changes; add regression tests before treating outbound restrictions as a security boundary.
5. Configure production secrets in the host's secret manager and rotate any credential that may have been committed previously.
6. The `main` branch ruleset and required checks are configured. A manual production approval gate is intentionally not required for this solo-maintained source project.
7. Complete monitoring, backup/restore, and rollback setup and test it.

**Scope:** these are operational checks for anyone choosing to run an internet-reachable instance. They are not prerequisites for cloning, forking, contributing to, or publishing the open-source source code. Each operator must independently assess their deployment and must not expose the backend directly.
