# Security Policy

## Supported versions

| Version | Supported |
|---------|-----------|
| Latest stable (Gumroad) | Yes |
| Dev builds from `main` | Best effort |
| Older tagged releases | No |

## Reporting a vulnerability

**Do not open a public issue or discussion for security vulnerabilities.**

If you find something, report it privately:

1. Go to the [Security tab](../../security/advisories/new) on this repo and open a private advisory, or
2. Contact directly via GitHub — send a private message to [@KazAndTheCompiler](https://github.com/KazAndTheCompiler)

Include:
- What the vulnerability is and where it lives
- Steps to reproduce
- What impact it could have
- Your suggested fix if you have one (not required)

## What to expect

This is a one-person project. I will acknowledge the report within a few days and aim to patch and release within 14 days depending on severity. You will be credited in the release notes unless you ask not to be.

## Scope

DopaFlow is offline-first with no mandatory cloud component. The attack surface is limited to:

- The local FastAPI backend (localhost only by default)
- Optional Google Calendar OAuth flow
- Electron shell (desktop build)
- Any data stored in the local SQLite database

Out of scope: issues with third-party dependencies that have their own upstream security processes.
