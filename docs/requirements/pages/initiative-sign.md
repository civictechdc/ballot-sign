# Initiative signing page requirements

## Purpose

Allow a user to sign an initiative using a secure workflow (mocked for demo).

## Must include

- Initiative title context
- Sign button
- Anonymous signing toggle
- If user is not signed in: form fields for name, address, email
- If user is not signed in: form field for phone number
- If user is signed in: only anonymous toggle (identity assumed known)
- If the user is not signed in, show a note that they may sign without creating an account and that the platform may reach out to verify identity for signature validity.
- Save initiative (mock)
- Share initiative (mock)
- Report initiative (mock)

## Validation

- Signed-out users must provide name, address, email.

## States

- Success: confirmation UI.
- Validation errors: visible list.

## Change log

- 2026-01-01: Initial draft.
