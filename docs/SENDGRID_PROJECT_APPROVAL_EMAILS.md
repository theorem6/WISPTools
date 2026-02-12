---
title: SendGrid Setup for Project-Approval Emails
description: Configure SendGrid so onNotificationCreated sends email when a plan is approved.
---

# SendGrid Setup for Project-Approval Emails

When a plan is approved, the Firestore trigger `onNotificationCreated` (in `functions/src/notifications.ts`) can send an email to the user via SendGrid. Emails are only sent if the following environment variables are set for the Cloud Function.

## Required (for emails to send)

- **`SENDGRID_API_KEY`** – SendGrid API key (create at [SendGrid API Keys](https://app.sendgrid.com/settings/api_keys)).

## Optional

- **`SENDGRID_FROM_EMAIL`** – From address (default: `noreply@wisptools.io`).
- SendGrid “Sender Identity” for that from-address must be verified in SendGrid.

## Setting the secret in Firebase

1. Create an API key in the SendGrid dashboard (Rest API Key, “Full Access” or at least “Mail Send”).
2. Set it as a secret for the project:
   ```bash
   firebase functions:secrets:set SENDGRID_API_KEY
   ```
   Paste the key when prompted.
3. Redeploy the function so it picks up the secret:
   ```bash
   firebase deploy --only functions:onNotificationCreated
   ```
   Or deploy all functions:
   ```bash
   firebase deploy --only functions
   ```

## Behavior

- If `SENDGRID_API_KEY` is **not** set: the function logs and skips sending; in-app notifications are still created and shown.
- If it **is** set: when a document is created in `notifications` with `type === 'project_approved'`, the function resolves the user’s email from Firebase Auth and sends one email per notification via SendGrid.

## Troubleshooting

- **“SENDGRID_API_KEY not set”** in logs – set the secret and redeploy as above.
- **SendGrid 401/403** – check the API key has “Mail Send” permission and is not revoked.
- **Bounces / spam** – ensure the From domain is verified in SendGrid and you’re not sending to invalid addresses.
