# Sentry + LastLeg iOS — what you need from Daysweeper

You **don’t need any Daysweeper Vercel env vars** to ship Sentry on iOS. Those are for Next.js (`@sentry/nextjs`): browser + server errors and **build-time source maps**.

---

## What you should do (LastLeg iOS)

1. In **Sentry**, create or pick an **Apple / iOS** project (separate from the web app if you want clean separation).
2. Put that project’s **DSN** into the iOS app the way you already handle secrets (Info.plist, xcconfig, etc.).
3. Optionally set **`environment`** (e.g. `production` / `testflight`) and **`release`** = version + build so issues group well.

---

## Org / access

- **One org, two projects** (e.g. `daysweeper-web` + `lastleg-ios`) is fine — invite whoever needs access or share the org slug; the iOS app still uses the **iOS project’s DSN**, **not** the web DSN.

### When you’d need names from us

Only if you **automate symbol upload** (fastlane + `sentry-cli`) against **our** Sentry org — then you’d use **auth token + org slug + the iOS project name** in Sentry, **not** the Next.js `javascript-nextjs` project.

---

## Bottom line

- **Normal iOS SDK crash reporting:** iOS **DSN** + standard SDK setup is enough.
- **Nothing else** from Daysweeper or from our **Vercel** Sentry vars is required for you to integrate LastLeg.

---

## Do you need something else from Sentry? (Daysweeper web vs LastLeg)

| Audience | Answer |
|----------|--------|
| **LastLeg iOS** | **No** — that’s all on the iOS / Sentry iOS project. |
| **Daysweeper web only** | Optional: **`SENTRY_AUTH_TOKEN`** and aligned **`NEXT_PUBLIC_SENTRY_ORG`** / **`NEXT_PUBLIC_SENTRY_PROJECT`** for **source maps** at build time. That doesn’t block LastLeg. If an auth token was ever exposed (e.g. screenshot), **rotate** it in Sentry and update Vercel. |
