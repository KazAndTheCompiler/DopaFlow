This directory must not contain committed private keys, deploy keys, tokens, or other secret material.

Use GitHub Actions secrets, environment-scoped CI variables, or a local untracked path outside the repo tree for deployment credentials.

The repo hygiene check fails if `.deploy-keys/` contains anything other than this file.
