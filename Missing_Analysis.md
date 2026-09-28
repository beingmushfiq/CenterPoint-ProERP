# CODEBASE KNOWLEDGE GAP AUDITOR

You have been given an existing Codebase Knowledge Base / AI Documentation System.

Your job is **NOT to simply follow the existing documentation structure**.

Your job is to determine whether that documentation is actually sufficient for another highly capable AI agent to understand, modify, debug, extend, test, deploy, and maintain this codebase **without performing another full audit from scratch**.

## PRIMARY OBJECTIVE

Perform a **gap analysis between the actual codebase and the existing AI knowledge base**.

Find everything that:

* was completely missed
* was only partially documented
* was documented incorrectly
* was documented too vaguely
* was documented without implementation references
* is outdated
* contradicts the actual code
* is important but does not have a dedicated documentation section
* a future AI agent would have to rediscover by inspecting the repository

Then **fill those gaps**.

Do not assume the existing documentation is complete merely because it has many sections.

The codebase is the authority.

---

# 1. THINK LIKE A FUTURE AI AGENT

Imagine you are a new AI agent entering this repository tomorrow.

You have never seen this project before.

You read the existing `/docs/ai/` knowledge base.

Ask:

> "What questions would I still need to inspect the codebase to answer?"

Every such question is a documentation gap.

Examples:

* Where exactly is this feature implemented?
* Which API consumes this component?
* Which components depend on this service?
* What happens after this database record changes?
* What side effects does this action trigger?
* Which permissions control this operation?
* Which seemingly unrelated modules depend on this table?
* Which UI behavior is intentional?
* Which business rules are hidden inside services/helpers/controllers?
* Which values are configurable?
* Which behavior is hardcoded?
* Which behavior comes from environment variables?
* Which external systems depend on this endpoint?
* Which jobs/events/listeners are triggered?
* What breaks if this module changes?
* Which files are dead code?
* Which code is legacy?
* Which behavior is undocumented?
* Which assumptions are embedded in the implementation?

If you cannot answer those questions from the knowledge base, identify and document the missing information.

---

# 2. DO NOT TRUST THE EXISTING DOCUMENTATION

Treat existing documentation as **unverified input**.

For every major documented claim:

1. Locate the corresponding implementation.
2. Verify it against the repository.
3. Mark it as:

```text
[VERIFIED]
[PARTIAL]
[OUTDATED]
[CONFLICT]
[INFERRED]
[UNKNOWN]
```

If documentation and implementation disagree:

DO NOT silently choose one.

Record the discrepancy.

---

# 3. FIND CATEGORIES WE DID NOT THINK OF

Do not limit yourself to the existing documentation categories.

Actively search for undocumented dimensions of the system.

Consider whether the repository contains concepts involving:

### Architecture

* Runtime architecture
* Process boundaries
* Module boundaries
* Internal contracts
* Shared infrastructure
* Dependency inversion
* Coupling
* Circular dependencies
* Architectural constraints
* Legacy architecture
* Transitional architecture
* Feature flags
* Plugin systems
* Extension points

### Code behavior

* Hidden side effects
* Implicit behavior
* Global state
* Static state
* Magic values
* Configuration-driven behavior
* Environment-dependent behavior
* Runtime-generated behavior
* Reflection
* Dynamic imports
* Dynamic routes
* Dynamic permissions
* Dynamic queries

### Data

* Data lifecycle
* Data ownership
* Data retention
* Data normalization
* Derived data
* Cached data
* Denormalized data
* Soft deletion
* Archiving
* Data migration strategy
* Referential integrity
* Historical records
* Audit trails
* Data synchronization
* Import/export behavior

### Business logic

* Hidden business rules
* Edge cases
* State machines
* Approval chains
* Calculations
* Rounding rules
* Time/date behavior
* Currency behavior
* Localization
* Tax behavior
* Status transitions
* Exceptional workflows
* Reversal/cancellation logic

### UI/UX

* Component composition rules
* Interaction conventions
* Accessibility
* Keyboard behavior
* Focus management
* Mobile-specific behavior
* Responsive exceptions
* Loading transitions
* Optimistic updates
* Error recovery
* Unsaved state
* Permission-dependent UI
* Empty-state behavior
* URL/state synchronization
* Browser persistence

### Security

* Trust boundaries
* Authorization inheritance
* Tenant isolation
* Privilege escalation risks
* Sensitive operations
* Sensitive fields
* File access
* Signed URLs
* Webhook verification
* Token lifecycle
* Session lifecycle
* Auditability

### Operations

* Startup sequence
* Shutdown behavior
* Queue workers
* Cron jobs
* Scheduled tasks
* Background processing
* Retry mechanisms
* Failure recovery
* Observability
* Log structure
* Monitoring
* Health checks
* Backup/restore
* Disaster recovery

### External systems

* Webhooks
* Callback URLs
* API contracts
* Retry behavior
* Idempotency
* Rate limits
* Failure modes
* Synchronization
* Third-party assumptions

### Development workflow

* Required setup steps
* Local development assumptions
* Required services
* Build dependencies
* Generated files
* Code generation
* Formatting
* Linting
* Static analysis
* Git conventions
* Branch assumptions
* Release process

### Testing

* Test architecture
* Missing coverage
* Critical untested workflows
* Test-only behavior
* Fixtures
* Mocking strategy
* Integration dependencies
* Environment-specific tests
* E2E prerequisites

---

# 4. SEARCH FOR IMPLICIT KNOWLEDGE

Some of the most important knowledge may not be explicitly documented anywhere.

Look for behavior encoded in:

* conditionals
* validation rules
* database constraints
* middleware
* policies
* event listeners
* observers
* model hooks
* service classes
* helper functions
* query scopes
* frontend guards
* route guards
* state stores
* constants
* configuration files
* environment variables
* migrations
* scheduled commands
* queue jobs
* webhooks
* error handlers

Ask:

> "Would another AI agent know this behavior exists without reading this code?"

If the answer is NO, document it.

---

# 5. SEARCH FOR CROSS-MODULE KNOWLEDGE

Do not document modules only in isolation.

Find relationships such as:

```text
Module A
→ depends on Module B
→ modifies Entity C
→ triggers Event D
→ starts Job E
→ updates UI F
→ calls Integration G
```

Document these relationships.

Pay particular attention to **hidden dependencies**.

A future agent should know when changing one subsystem can affect another subsystem.

---

# 6. SEARCH FOR NEGATIVE KNOWLEDGE

Document not only what the system does.

Document what it **must NOT do**.

Examples:

```text
Do not bypass service X.
Do not directly modify table Y.
Do not use component Z for this workflow.
Do not call API A without permission B.
Do not modify status C directly.
Do not reuse tenant-scoped query globally.
```

Only document these rules when supported by architecture, implementation, tests, or explicit project decisions.

---

# 7. SEARCH FOR "WHY"

A codebase may explain **what** it does but not **why**.

Find important places where future developers could accidentally break an intentional behavior.

For example:

```text
Why does this validation exist?
Why is this query structured this way?
Why is this component duplicated?
Why does this API use this response shape?
Why is this field nullable?
Why is this status transition restricted?
Why is this calculation performed here?
Why is this dependency intentionally isolated?
```

If the reason is known, document it.

If it cannot be established:

```text
Reason: UNKNOWN
```

Do not invent rationale.

---

# 8. SEARCH FOR TEMPORARY VS PERMANENT CODE

Identify:

* Temporary workarounds
* Migration code
* Compatibility layers
* Deprecated implementations
* Legacy modules
* Feature flags
* Transitional architecture
* TODOs
* FIXME markers
* Experimental code
* Dead code
* Unused components
* Unused APIs
* Unused database fields

Document their status and purpose.

---

# 9. SEARCH FOR CONFIGURATION KNOWLEDGE

Find behavior controlled by:

* `.env`
* config files
* feature flags
* database settings
* admin settings
* runtime configuration
* environment-specific values

Document:

```text
Configuration
→ Location
→ Purpose
→ Valid values
→ Default
→ Required/Optional
→ Affected behavior
→ Environment differences
```

Never document secret values.

---

# 10. SEARCH FOR MISSING OPERATIONAL KNOWLEDGE

Determine whether the existing documentation explains:

```text
How to start the system
How to build the system
How to test the system
How to migrate the database
How to seed data
How to clear caches
How to run workers
How scheduled jobs execute
How deployment works
How rollback works
How backups work
How logs are inspected
How failures are diagnosed
```

If not, fill the gap where the information can be verified.

---

# 11. SEARCH FOR AI-SPECIFIC GAPS

Ask specifically:

> "What information would reduce unnecessary AI exploration?"

Look for opportunities to create:

* File maps
* Symbol maps
* Feature → file maps
* API → consumer maps
* Database → model maps
* Component → usage maps
* Permission → feature maps
* Integration → workflow maps
* Error → source maps
* Configuration → behavior maps

The goal is to make future AI navigation **directed rather than exploratory**.

---

# 12. MEASURE DOCUMENTATION COVERAGE

Create a coverage assessment.

Estimate coverage across:

| Area           | Coverage | Missing |
| -------------- | -------: | ------- |
| Architecture   |        % | ...     |
| Backend        |        % | ...     |
| Frontend       |        % | ...     |
| Database       |        % | ...     |
| API            |        % | ...     |
| Business Logic |        % | ...     |
| UI/UX          |        % | ...     |
| Security       |        % | ...     |
| Integrations   |        % | ...     |
| Deployment     |        % | ...     |
| Testing        |        % | ...     |
| Operations     |        % | ...     |
| AI Navigation  |        % | ...     |

Do not fabricate precise percentages.

If quantitative measurement is impossible, use:

```text
HIGH
MEDIUM
LOW
UNKNOWN
```

---

# 13. CREATE A KNOWLEDGE GAP REGISTER

Every missing piece must be recorded.

Use:

```text
GAP-ID:
Category:
Missing Knowledge:
Why It Matters:
Affected Area:
Evidence:
Required Documentation:
Priority:
Status:
```

Priority:

```text
CRITICAL
HIGH
MEDIUM
LOW
```

A gap is CRITICAL when its absence could cause an AI agent to:

* break functionality
* violate architecture
* corrupt data
* bypass security
* break tenant isolation
* break production deployment
* misunderstand critical business logic
* introduce a major regression

---

# 14. FILL THE GAPS

Do not merely produce a list of missing documentation.

**Actually update the knowledge base.**

For every valid gap:

1. Determine where the information belongs.
2. Add it to the appropriate documentation.
3. Create a new documentation file only if necessary.
4. Add source references.
5. Mark verification status.
6. Cross-reference related documentation.
7. Update the master index.

---

# 15. DISCOVER MISSING DOCUMENTATION TYPES

If the existing `/docs/ai/` structure does not have a place for important knowledge, create one.

You are explicitly authorized to add documentation categories that were not anticipated by the original documentation architecture.

Examples might include:

```text
EVENT_SYSTEM.md
STATE_MACHINES.md
CONFIGURATION_REFERENCE.md
BACKGROUND_JOBS.md
DATA_LIFECYCLE.md
OBSERVABILITY.md
COMPATIBILITY.md
FILE_UPLOAD_ARCHITECTURE.md
SEARCH_ARCHITECTURE.md
CACHING_ARCHITECTURE.md
NOTIFICATION_SYSTEM.md
IMPORT_EXPORT.md
AUDIT_TRAIL.md
LOCAL_DEVELOPMENT.md
RELEASE_PROCESS.md
```

Only create documents that the actual codebase justifies.

---

# 16. CHECK FOR REDUNDANCY

While filling gaps, identify documentation that:

* repeats the same information
* contradicts another document
* has become obsolete
* should be consolidated
* belongs somewhere else

Improve the documentation architecture where necessary.

The goal is not maximum documentation volume.

The goal is **maximum useful knowledge density**.

---

# 17. FINAL AI-READINESS TEST

After filling the gaps, perform a second mental audit:

Imagine a new AI agent receives only:

```text
The repository
+
/docs/ai/
```

Ask whether it can answer:

### Architecture

"How is this system structured?"

### Navigation

"Where is feature X implemented?"

### Dependencies

"What else will be affected if I change X?"

### Data

"What happens to the data when X executes?"

### API

"Which endpoints are involved?"

### UI

"How should this feature behave visually and interactively?"

### Business

"What business rules must I preserve?"

### Security

"What permissions and security constraints apply?"

### Operations

"What happens asynchronously?"

### Deployment

"How does this reach production?"

### Testing

"How do I verify my change?"

### History

"Why is the system designed this way?"

### Constraints

"What must I not break?"

If any answer requires a full repository audit, identify that as a remaining documentation gap.

---

# 18. FINAL GAP REPORT

At the end produce:

```text
CODEBASE KNOWLEDGE GAP AUDIT

Repository:
Audit Date:
Current Commit:

DOCUMENTATION STATUS:
[summary]

MAJOR GAPS FOUND:
[count]

CRITICAL GAPS:
[list]

HIGH-PRIORITY GAPS:
[list]

MEDIUM/LOW GAPS:
[list]

OUTDATED DOCUMENTATION:
[list]

CONFLICTING DOCUMENTATION:
[list]

UNDOCUMENTED ARCHITECTURE:
[list]

UNDOCUMENTED BUSINESS LOGIC:
[list]

UNDOCUMENTED DATA FLOWS:
[list]

UNDOCUMENTED UI/UX:
[list]

UNDOCUMENTED INTEGRATIONS:
[list]

UNDOCUMENTED OPERATIONS:
[list]

UNDOCUMENTED AI NAVIGATION KNOWLEDGE:
[list]

NEW DOCUMENTATION CREATED:
[list]

DOCUMENTATION UPDATED:
[list]

REMAINING UNKNOWN AREAS:
[list]

REMAINING HUMAN QUESTIONS:
[list]

FINAL AI-READINESS:
READY / NOT READY

REASON:
[explain]
```

---

# FINAL DIRECTIVE

Do not treat the existing documentation checklist as the boundary of your investigation.

It is only the **starting hypothesis**.

Your real responsibility is:

> **Discover what the previous documentation system failed to anticipate.**

Look beyond the obvious.

Look for implicit behavior.

Look for cross-module dependencies.

Look for hidden business rules.

Look for operational assumptions.

Look for undocumented constraints.

Look for "why".

Look for things that only become visible when tracing code across multiple layers.

Look for information that a future AI agent would otherwise have to rediscover.

Then document it.

**Do not merely audit the documentation. Improve the knowledge system itself.**

The final result must be a knowledge base that is substantially more complete than the one you started with.

**Find the gaps → verify the gaps → fill the gaps → cross-reference the gaps → re-audit the gaps → leave the repository with persistent institutional memory.**
