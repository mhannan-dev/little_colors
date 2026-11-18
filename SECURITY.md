# Security policy

## Reporting a vulnerability

Use **Security → Report a vulnerability** on the source repository when private vulnerability reporting is enabled. Include the affected commit or version, reproduction steps, expected impact, and a minimal redacted example.

If that option is unavailable, contact a maintainer through their published GitHub contact method to request a private channel. A public issue may request that private reporting be enabled, without including exploit details. Never upload credentials, signing keys, child data, or unredacted recordings.

Maintainers assess fixes against the current default branch. The project is under active development and has no defined long-term support branches or guaranteed response time.

## Sensitive configuration

Keep Azure Speech keys in local environment files and release tokens and signing keys in GitHub Actions secrets. The updater public key is public configuration. Release signatures must be configured and verified before distributing automatic updates. Rotate exposed credentials and examine Git history if a real secret was ever committed.

The development recording studio writes local audio assets and should run on a trusted local development machine. Follow the existing loopback origin and path validation when extending it.

See [the repository audit](docs/repository-audit.md) for the reviewed scope and release-readiness work.
