# Contributing to BlurzProxyV2

Thanks for your interest in improving BlurzProxyV2.

## Before opening a change

1. Open an issue first for substantial features or behavior changes.
2. Keep pull requests focused and explain the user-facing impact.
3. Never include passwords, tokens, cookies, private keys, production URLs containing credentials, or real user data.
4. Do not weaken authentication, origin checks, rate limits, or outbound network restrictions to make a test pass.
5. Update tests and documentation when behavior or configuration changes.

## Development setup

Requirements:
- Node.js version supported by the project CI
- npm
- Playwright Chromium for browser tests

From the repository root:

```bash
cd BlurzProxy
npm ci
npx playwright install chromium
npm run check
```

On Linux, install browser system dependencies with:

```bash
npx playwright install-deps chromium
```

## Pull requests

Include:
- A clear description of the problem and solution.
- Tests run and their results.
- Screenshots for meaningful visual changes, when useful.
- Any security, compatibility, configuration, or deployment implications.

Do not claim a security property is verified solely because a unit test passes. Network and deployment changes may require integration tests and host-level validation.

## Scope and responsible use

BlurzProxyV2 is software for independently operated instances. Contributors must not add features intended to bypass access controls, evade provider enforcement, or expose an unauthenticated shared proxy. Operators are responsible for complying with their host's acceptable-use rules and applicable law.
