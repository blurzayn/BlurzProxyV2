# Security Policy

## Supported version

Security fixes are prioritized for the latest code on the default branch. Older forks and independently deployed copies may differ; operators should keep their instances updated and review changes before deploying.

## Reporting a vulnerability

Please do not publish exploit details, credentials, private URLs, or sensitive logs in a public issue.

Use GitHub's **Report a vulnerability** option on this repository if private vulnerability reporting is enabled. If it is unavailable, contact the repository maintainer privately through a verified contact method listed on the maintainer's GitHub profile and ask for a secure reporting channel.

Include:
- A concise description of the affected component.
- The impact and conditions needed to reproduce the issue.
- A minimal proof of concept that does not access other people's data or disrupt a service.
- The affected commit or release, if known.

Do not test against instances you do not own or have explicit permission to assess.

## Operator responsibilities

Each self-hosted operator is responsible for:
- Keeping dependencies and the host operating system updated.
- Using unique, high-entropy credentials and protecting environment files.
- Keeping the application backend private behind the intended reverse proxy.
- Enforcing host-level outbound network restrictions.
- Monitoring abuse and complying with the hosting provider's acceptable-use policy.

A passing automated test suite is not a guarantee that an internet-facing deployment is secure.
