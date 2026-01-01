# Architecture recommendations (ballot-sign)

This document captures the current architectural recommendations for ballot-sign. It is intended to be **updated alongside major design decisions**.

## Current state (2026-01-01)

- The repository contains a **frontend-first** implementation using mock data.
- Backend is not implemented yet.

## Goals

1. **Replaceability**: allow swapping frameworks/libraries without rewriting core business logic.
2. **Cloud-native readiness**: deployable to AWS with clear seams for services.
3. **Legitimacy-first**: be compatible with future legal/compliance/security requirements.

## Recommended architectural style

### Frontend: Clean Architecture (Ports & Adapters)

Use a layered architecture so UI does not own domain rules:

- **Domain**: types + invariants (no UI, no IO).
- **Application**: use cases; depends on domain + ports.
- **Ports**: interfaces that describe IO (repositories/services).
- **Adapters**: concrete implementations (mock, HTTP API, storage).
- **Composition root**: chooses adapters and wires them into the app.

This pattern lets you:

- keep use cases stable while changing UI framework
- start with mock adapters and later swap in API adapters

### Replaceability: Factory Method at the composition root

Factory methods choose implementations (mock vs API) without impacting callers.

Example seam:

- `createInitiativeRepository()` returns the `InitiativeRepository` port implemented by either a mock repository or API repository.

## Microservices?

**Not at the start.** Recommended approach:

- Start with a **modular monolith** (or a small number of “macroservices”), using strong boundaries that *could* become services later.
- Extract microservices only once requirements stabilize and you have operational capacity.

Reasons:

- early legal/validation constraints are still evolving
- microservices add operational overhead (deployment, observability, security, data consistency)

## Suggested future bounded contexts (service seams)

These can start as modules (monolith) and later become services if needed:

1. Identity & Access
2. Initiative Catalog & Discovery
3. Signature Capture, Verification & Audit
4. Notifications & Subscriptions
5. Messaging (campaigns ↔ constituents)
6. Moderation & Reporting

## AWS deployment posture (future backend)

For early phases (including the demo):

- Static frontend on **S3 + CloudFront**

For later phases:

- API: API Gateway + Lambda (or ECS/Fargate) behind CloudFront
- Auth: Cognito (or an OIDC provider)
- Data: DynamoDB (audit/event store considerations), RDS if relational needs emerge
- Observability: CloudWatch + X-Ray (or OpenTelemetry)

## Update log

- 2026-01-01: Initial architecture recommendation document created.
