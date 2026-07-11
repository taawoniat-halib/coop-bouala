---
name: Firebase-backed react-vite artifact
description: Pattern used when a user explicitly requires Firebase (not our native Postgres/api-server stack) for a full-stack app.
---

When a user explicitly insists on Firebase as the backend (even after being offered the native Postgres/Clerk stack), build it as a `react-vite` artifact that talks to Firebase directly from the client — no OpenAPI spec, no codegen, no `api-server` routes.

**Why:** Firebase Firestore/Auth/Storage already are the backend; adding our own api-server would duplicate persistence and contradict the user's explicit choice. The react-vite artifact skill's "frontend-only" path (skip OpenAPI/codegen, go straight to the design subagent) fits this naturally — the "backend" work becomes writing hooks/helpers instead of DB schema + routes.

**How to apply:**
- Get Firebase project config (apiKey, authDomain, projectId, storageBucket, messagingSenderId, appId) via `requestSecrets` (not plain chat) — these are commonly called "keys" even though Firebase treats them as public client config; treat the request as sensitive-input flow regardless.
- Inject them into the Vite client bundle via `define` in `vite.config.ts` reading `process.env.FIREBASE_*` at build/dev time (they aren't `VITE_`-prefixed), exposed as a single `__FIREBASE_CONFIG__` global with an ambient `.d.ts` declaration.
- Build the data-access layer yourself (generic `useCollection<T>` Firestore hook + per-collection wrappers, `useAuth` with Firebase Auth, calculation/report helpers, export helpers) before launching the design subagent — this replaces the generated API-client-hooks role in the brief.
- No public sign-up when the spec says "accounts created by admin only": client SDK auto-signs-in as whichever user was just created, so admin-created accounts need a throwaway secondary `initializeApp` instance to call `createUserWithEmailAndPassword` without disturbing the admin's session.
- A bootstrap-admin-by-email pattern (first login with a designated email auto-gets the admin role in Firestore) still needs that first account to exist in Firebase Auth already — since there's no in-app sign-up, tell the user to create that one user manually in the Firebase console. Document this plus enabling Auth/Firestore/Storage and publishing `firestore.rules` in a `SETUP_FIREBASE.md` in the artifact, since none of that is automatable from the agent sandbox (no service-account/admin credentials available).
