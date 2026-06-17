# Google SSO + roles

bravo supports Google sign-in (OIDC authorization-code flow) with role-based
permissions. Without it configured, the local **pick-user** login is used.

## Roles

| Role | Can |
|------|-----|
| **Owner** | Everything: configure the workspace, manage roles, propose, approve/merge, publish. |
| **Reviewer** | Propose changes; approve / request-changes / reject change requests they're assigned. |
| **Viewer** | Read-only. |
| *(Agent)* | Propose only, via API key — never approves. |

Reads are open (LAN-trusted); **writes and merges are gated** by role. Agents
can never approve.

## Set up the Google OAuth client

1. Google Cloud Console → **APIs & Services → Credentials → Create credentials →
   OAuth client ID**.
2. Application type: **Web application**.
3. Authorized redirect URI:
   `http://localhost:4000/api/context/auth/google/callback`
   (use your real server origin in production).
4. Copy the **Client ID** and **Client secret**.

## Configure bravo

Set these on the **server** (env / `docker-compose.yml`):

```bash
GOOGLE_CLIENT_ID="…apps.googleusercontent.com"
GOOGLE_CLIENT_SECRET="…"
GOOGLE_REDIRECT_URI="http://localhost:4000/api/context/auth/google/callback"
WEB_BASE_URL="http://localhost:3000"           # where to return after sign-in
CONTEXT_OWNER_EMAILS="you@yourco.com"          # these emails become Owners
CONTEXT_DEFAULT_ROLE="reviewer"                # role for everyone else
```

Once `GOOGLE_CLIENT_ID` + `GOOGLE_CLIENT_SECRET` are set, the login screen shows
**Continue with Google**, and the pick-user fallback is hidden (set
`CONTEXT_PICK_USER_LOGIN=true` to keep it for local testing).

## Flow

1. User clicks **Continue with Google** → `/api/context/auth/google/login`.
2. Google consent → callback `/api/context/auth/google/callback` exchanges the
   code, reads the verified email, and assigns a role (Owner if the email is in
   `CONTEXT_OWNER_EMAILS`, else the default role).
3. bravo issues a signed session token and redirects to the web app, which stores
   it. The acting user — and what they're allowed to do — is derived from that
   token on every request.
