# Cross-cutting requirements

These requirements apply to all pages unless explicitly scoped otherwise.

## Accessibility

- Semantic landmarks (`header`, `nav`, `main`, `footer`).
- Keyboard navigation for all interactive controls.
- Visible focus states.
- Color contrast suitable for WCAG AA targets.

## Legitimacy-first (future backend)

- Do not imply signatures are private.
- Clearly communicate what information is public by law.
- Design for auditability (event logs, immutable records) even if not implemented in the mock UI.

## Privacy and safety

- Treat addresses and emails as sensitive.
- Avoid showing personal data in public views.

## Security (future backend)

- Authentication and authorization must be enforced server-side.
- Signing should incorporate eligibility checks and anti-fraud measures.

## SEO / public discovery

- Initiative details should be on a public route.
- Page titles should be meaningful.
