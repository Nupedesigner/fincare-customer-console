# Managed Identity for the Qorebank FinCare Portal

## Recommendation

FinCare should use **managed identity with SSO** as the primary authentication boundary for Qorebank staff. In this model, Qorebox/FinCare Admin provisions the Qorebank tenant, while Qorebank’s own identity provider manages staff credentials, MFA, recovery, joiner/mover/leaver events, and assurance policies. FinCare becomes a relying application: it accepts a verified identity assertion, resolves the person to a Qorebank tenant membership, then enforces portal role permissions.

> The FinCare portal should never be the system that asks for or stores a staff member’s banking password, PIN, OTP, CVV, or a duplicate corporate password.

## 1. SSO Activation and Recovery Experience

### Activation: invitation to first successful SSO sign-in

The activation link should be a **short-lived, single-use invitation** issued by Qorebox/FinCare Admin or an authorized Qorebank Organization Admin. It contains only an opaque token and a return path; it must not carry credentials, roles, or customer data. The invitation page identifies the tenant, masks the invited email where appropriate, explains that the account is already provisioned, and uses a single primary action: **Continue with Qorebank sign-in**.

| Step | User experience | System behaviour |
|---|---|---|
| 1. Invitation received | “You have been invited to Qorebank FinCare Portal.” | Validate token status, expiry, single-use condition, and intended tenant before displaying organization context. |
| 2. Continue with SSO | User is sent to Qorebank’s identity provider. | Include a signed state value with the requested FinCare destination and an anti-forgery binding. |
| 3. First authenticated return | “Your Qorebank FinCare access is ready.” | Match the verified corporate email or immutable IdP subject to the invited membership; mark the invitation accepted and record the event. |
| 4. Role landing | User reaches their originally requested permitted page, or the dashboard. | Resolve tenant and role server-side; do not trust role claims from the browser alone. |

The activation page should **not** ask the user to select an organization or create a FinCare workspace. If the email is authenticated but lacks an approved Qorebank membership, show an “Access is being prepared” state with the organization administrator contact path. This preserves the intended distinction: Qorebox/FinCare Admin onboards the bank, while Qorebank users operate only Qorebank’s FinCare deployment.

### Normal login

The login page should use a concise enterprise layout: FinCare/Qorebank branding, a statement that access is restricted to authorized bank users, and **Continue with Qorebank sign-in** as the primary action. An optional work-email field may be used only for routing users to the correct enterprise IdP or showing tenant-specific help; it should not be presented as a password credential verifier.

On every login, the portal should retain a validated intended destination. For example, a permitted user who opens an API Log details URL while signed out should authenticate and return to that exact page. A user who is not permitted should instead land on a clear restricted-access page that identifies the required role and points them to their Organization Admin.

### Recovery, account disablement, and session states

In an SSO design, “Forgot password” is a route to the organization’s managed recovery experience, not an in-portal password reset. FinCare should display a generic confirmation such as “If your account is eligible, continue with Qorebank account recovery,” then hand off to the identity provider. Generic messages help avoid confirming whether a particular person has a portal account.[1]

| State | FinCare message | Primary next action |
|---|---|---|
| Session expired | “Your secure session ended after inactivity.” | Sign in again with Qorebank SSO. |
| Unauthorized | “Your account is authenticated but does not have access to this resource.” | Return to permitted area; contact Organization Admin. |
| Disabled membership | “Portal access has been disabled for this Qorebank environment.” | Contact Organization Admin; do not reveal tenant details beyond the authenticated user’s own account. |
| Invitation expired or invalid | “This invitation cannot be used.” | Request a new invitation. |
| IdP recovery completed | “Your Qorebank sign-in is ready.” | Continue to SSO; FinCare does not collect a new password. |
| High-risk event | “Please verify your identity again to continue.” | Step up using the IdP’s approved MFA or phishing-resistant authenticator. |

The IdP should control session revocation, device enrollment, authenticator recovery, account locking, and MFA policy. FinCare should maintain its own short-lived application session after SSO, enforce idle and absolute timeouts, rotate its session after successful authentication, and require fresh SSO or step-up verification for sensitive actions such as production deployment, privileged role changes, webhook changes, or system-prompt publication.[1] [2]

## 2. Security and Compliance Benefits

| Benefit | Why it matters for FinCare | Implementation implication |
|---|---|---|
| Reduced password attack surface | FinCare does not become an additional password verifier, password-reset target, or credential database for bank staff. | Remove portal password storage and password-reset token handling from the product scope. |
| Central MFA and phishing resistance | The organization can apply a consistent MFA policy, including a phishing-resistant option where its risk model requires it. NIST’s current guidance describes higher assurance levels and recommends phishing-resistant authentication options at AAL2.[3] | Use OIDC or SAML with the approved IdP; request step-up authentication for privileged portal actions. |
| Faster joiner/mover/leaver control | Staff membership and corporate directory lifecycle can be reflected in the FinCare tenant without manual password remediation. | Reconcile immutable IdP subject, email, tenant membership, role, and membership status; disable access immediately on offboarding. |
| Better auditability | Authentication events come from the IdP; FinCare records authorization decisions, tenant selection, privileged actions, and access denials. | Correlate IdP event ID, FinCare user ID, bank ID, role, timestamp, request ID, and action in immutable audit trails. |
| Fewer recovery weaknesses | Password recovery is an alternative authentication path and should not be weaker than normal authentication. OWASP highlights weak recovery and ineffective session invalidation as authentication risks.[2] | Route recovery to the IdP and invalidate FinCare sessions after recovery, deprovisioning, or material role changes. |
| Clearer compliance ownership | Qorebank’s identity team governs authentication controls, while FinCare governs tenant-scoped authorization and application auditability. | Document the shared-responsibility boundary in the security architecture and vendor agreement. |

Managed identity does not remove FinCare’s responsibilities. FinCare still must validate issuer, audience, signature, nonce/state, expiry, and subject binding; protect its own sessions; enforce bank and role authorization server-side; log privileged actions; and ensure that an SSO token for one bank cannot be used to access another bank’s tenant.

## 3. Migration from Separate Portal Passwords

The migration should be **staged, reversible, and measured**. Do not bulk-disable password sign-in until the identity provider, membership mappings, support model, and emergency-access process have been proven with real Qorebank cohorts.

### Phase 0: Prepare the identity and authorization model

Inventory every existing portal account, tenant membership, role, current status, last sign-in, MFA status, and service account. Establish a canonical immutable identifier from the identity provider; email address is useful for matching, but it should not be the sole durable identity key because addresses can change. Define a role map such as Organization Admin, AI Manager, Integration Manager, Support Manager, Analyst, and Support Agent. Remove or separately govern non-human service accounts.

Before migration, agree the access policies in a change-control record: MFA and phishing-resistant requirements, idle and absolute session timeouts, administrator step-up actions, emergency/break-glass rules, logging retention, and support escalation.

### Phase 1: Build and test federation in a non-production environment

Configure the SSO application with exact redirect URIs, issuer/audience validation, signed assertions, anti-forgery state/nonce controls, and a tenant-safe return URL allowlist. Test positive and negative cases: unknown user, disabled membership, expired invitation, email change, role change, revoked session, invalid state, replayed callback, and cross-tenant access attempt.

Success criterion: a test user signs in through the IdP, reaches only their Qorebank tenant, and cannot use an altered destination or a stale assertion to reach another protected page.

### Phase 2: Pilot with administrators and a small operational cohort

Invite Qorebank Organization Admins, Integration Managers, and a small set of support users. Offer SSO alongside the old password method during the pilot, but record the method used, errors, account-matching outcomes, step-up outcomes, and support tickets. Do not force a password reset merely because an SSO account has been linked.

The pilot exit criteria should include a high successful SSO completion rate, no unresolved tenant-mapping errors, verified role enforcement, tested deprovisioning, and an approved support runbook.

### Phase 3: Broad migration with communications and fallback

Migrate users in groups by department or role. Send a plain-language message that gives the go-live date, the new **Continue with Qorebank sign-in** action, where recovery occurs, and a support contact. Do not send passwords or password-reset links as part of the SSO migration. During a short coexistence window, allow the legacy path only for explicitly enrolled exception users and monitor every use.

| Control | Migration rule |
|---|---|
| Role match | Preserve current least-privilege role; require Organization Admin approval for elevation. |
| Account match | Prefer immutable IdP subject; flag ambiguous email matches for manual review. |
| Legacy password | Do not copy, re-hash, or export it. Retain only what is necessary for the approved rollback window. |
| Exception access | Time-boxed, named owner, MFA enforced, separately audited, and reviewed daily. |
| Sensitive actions | Require fresh SSO/MFA for deployment, integration credential changes, role changes, and prompt publication. |

### Phase 4: Enforce SSO and retire legacy credentials

When success criteria are met, disable legacy password login by policy rather than simply hiding its UI. Invalidate legacy password-reset links and sessions, remove unused password-verifier code and reset-token paths, and keep only the minimum evidence required for audit, security investigation, and approved retention. Confirm that account recovery points to Qorebank’s identity provider and that offboarding at the IdP disables FinCare access on the required schedule.

### Phase 5: Post-migration assurance

For at least one reporting cycle, review SSO failures, disabled-user attempts, cross-tenant denials, emergency access, privileged-action step-ups, and support volume. Run a targeted access-control test and verify that login, recovery, logout, inactivity timeout, and role removal produce the expected audit events. Roll back only by re-enabling the time-boxed, controlled legacy mechanism for named users; do not reintroduce a broad password path after retirement.

## Decision Checklist

Before implementation, Qorebank should approve the identity provider, protocol (normally OIDC, or SAML where required), identity attribute contract, immutable subject mapping, role model, tenant-mapping logic, MFA/step-up policy, session policy, support ownership, audit-retention requirements, and emergency-access governance. The FinCare portal can then turn its new activation and recovery screens into thin, reliable guided entry points to that approved identity service.

## References

[1]: https://cheatsheetseries.owasp.org/cheatsheets/Authentication_Cheat_Sheet.html "OWASP Authentication Cheat Sheet"
[2]: https://owasp.org/Top10/2021/A07_2021-Identification_and_Authentication_Failures/ "OWASP Top 10 A07:2021 – Identification and Authentication Failures"
[3]: https://pages.nist.gov/800-63-4/sp800-63b.html "NIST SP 800-63B: Authentication and Authenticator Management"
