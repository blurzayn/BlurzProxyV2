# BlurzProxyV2 Production Operations Runbook

This is a host-neutral runbook for the Docker Compose deployment in `BlurzProxy/`. It is preparation, not proof that a production host has been provisioned or that a restore has been tested. Keep the service private until every release blocker in `DEPLOYMENT_READINESS.md` is cleared.

## 1. Host and network prerequisites

- Use an always-on Linux host with Docker Engine and the Docker Compose plugin.
- Point the deployment domain's DNS records to the host.
- Allow inbound TCP 80 and 443 only. Allow UDP 443 only if HTTP/3 is intentionally enabled.
- Do not expose the app's port 3000 publicly. The app container must remain reachable only through the private Compose backend network and Caddy.
- Configure host-level outbound restrictions in addition to Wisp's application policy where feasible.
- Use a dedicated unprivileged deployment account and keep the OS, Docker, and host firewall patched.

## 2. Secrets and first deployment

Prefer the hosting provider's secret manager and inject values into the Compose environment. If a local environment file is necessary, keep it outside Git, restrict it to the deployment account, and encrypt any backup.

Required Compose variables:
- `DOMAIN`: the exact HTTPS hostname used by clients.
- `ADMIN_PASSWORD`: a unique, randomly generated production secret; never reuse a development password.

Before starting:
1. Confirm the secret is not present in source control or build arguments.
2. Confirm the repository's required secret-history scan is green.
3. Set `ADMIN_PASSWORD` and `DOMAIN` in the host secret manager or protected environment.
4. Run `docker compose config --quiet` from `BlurzProxy/`.
5. Build and start with `docker compose up -d --build`.
6. Verify the public HTTPS endpoint and Caddy certificate.
7. Verify the app backend is not reachable directly from the public internet.
8. Verify the app port is not exposed by the host firewall or container port publishing.

Do not use a Codespaces forwarded port as the production endpoint.

## 3. Health and monitoring

- Use the container health check against `/readyz` for readiness.
- Use `/healthz` for basic external uptime checks; it must not be treated as proof that authenticated proxy transport is functioning.
- Keep detailed runtime metrics behind authenticated `/api/status`.
- Alert on repeated container restarts, readiness failures, sustained memory pressure, disk exhaustion, certificate renewal failures, and unexpected traffic spikes.
- Keep monitoring credentials in the host's secret manager. Do not place them in repository files or issue comments.

The external monitoring destination and alert routing must be selected and configured for the chosen host before production release.

## 4. Backup

The app currently keeps sessions and live WebSocket state in memory; these are not durable application records. The Compose deployment does persist Caddy data and configuration in named volumes. Back up those volumes and the deployment secrets separately.

1. Create a restricted backup directory outside the repository.
2. Record the actual Compose volume names with `docker volume ls`.
3. Back up the Caddy `/data` and `/config` volumes using a temporary container or a controlled host backup tool.
4. Back up the deployment secret set separately using the host's encrypted backup facility.
5. Encrypt backups before copying them off-host.
6. Restrict access to backups and retain a documented recovery key outside the host.
7. Record the backup timestamp, host, application commit, and restore-test status without recording secret values.

Do not commit backups, TLS private keys, or production environment files.

## 5. Restore test

A restore is not considered verified until it has been performed on a separate staging host or isolated test environment.

1. Provision a clean host with the same supported Docker/Compose versions.
2. Restore the encrypted Caddy volumes and deployment secrets.
3. Check file ownership and permissions.
4. Start the stack and confirm the Caddy certificate state, `/healthz`, and `/readyz`.
5. Verify login, authenticated API access, WebSocket origin/session enforcement, and proxy egress restrictions.
6. Confirm the backend port remains private.
7. Record the tested backup ID, source commit, restored commit, results, and any differences.

Do not overwrite the only production copy during a restore test.

## 6. Rollback

- Keep the last known-good source commit and corresponding image available.
- Deploy only a commit whose CI, CodeQL, and full-history secret scan checks pass.
- If a release fails, stop rollout, restore the previous known-good image or rebuild from its exact source commit, then restart the Compose stack.
- Verify readiness, login, API access, Wisp WebSocket restrictions, and public HTTPS after rollback.
- If a credential may have been exposed, rotate it; rolling back code does not revoke a leaked credential.
- Record the failed commit, rollback commit, symptoms, and verification results.

A tested rollback is still outstanding until exercised on the selected host.

## 7. GitHub repository protections and optional deployment automation

The active `Protect main` ruleset applies to the default branch (`main`). It requires pull requests, an up-to-date branch, and all five of these successful status checks:

- `Smoke, security, and browser tests`
- `npm dependency security audit`
- `Production container build and Compose validation`
- `Analyze JavaScript` (CodeQL)
- `Scan full Git history for exposed secrets` (Gitleaks)

The ruleset also blocks force pushes and branch deletion. It does not require a separate approval, which is appropriate for the current solo-maintainer workflow.

A GitHub Environment named `production` can be used if an automated deployment workflow is introduced later. Do not add deployment credentials or a deployment workflow merely to publish this open-source project. Any future deployment automation should be reviewed separately for permissions, target restrictions, secret handling, and rollback behavior.

This runbook documents operator procedures. It does not claim that a production host, monitoring destination, backup, restore, or rollback has been provisioned or tested.
