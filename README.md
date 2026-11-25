# Camber Giving Tree

## Run locally

Install Node.js 18 or newer, then in this folder run:

```bash
npm start
```

Open `http://localhost:3000`.

## Before publishing

Set these environment variables with your web host:

- `ADMIN_PASSWORD` — a new, private organizer password.
- `RESEND_API_KEY` and `FROM_EMAIL` — optional. Add these only if you want the organizer dashboard to directly send emails through Resend.

This website stores donor selections in `data.json`. For a public launch, use a host that supports persistent disk storage or replace the small data layer with a hosted database. Do not use static-only hosting such as GitHub Pages for this version, because it needs a server to save donor records securely.

## Included features

- Gift-tag code lookup for every child in the supplied sheet
- Multiple-child selection cart
- Donor email submission
- Password-protected organizer dashboard
- Donor + child-code tracking and CSV download
- Organizer email composer, with optional Resend delivery
