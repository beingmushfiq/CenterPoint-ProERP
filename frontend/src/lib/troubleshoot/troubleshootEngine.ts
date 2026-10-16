// ═══════════════════════════════════════════════════════════════════════════
// TROUBLESHOOT ENGINE — The core diagnosis layer
// ───────────────────────────────────────────────────────────────────────────
// Maps every ErrorCode + log source to:
//   · A human-readable plain-English reason (what happened)
//   · An impact statement (what this means for your business)
//   · Ordered recommended fix steps
//   · A severity tier (critical / high / medium / low / info)
//   · Whether it's retryable without user intervention
//   · A suggested support escalation flag
//
// DESIGN RULES:
//   · Copy is written for a factory operator, not a developer.
//   · Never expose internal stack traces or error class names here.
//   · Fix steps must be concrete and actionable — never "contact support" alone.
//   · Every ErrorCode in errors.ts MUST have an entry here.
// ═══════════════════════════════════════════════════════════════════════════

import type { LogEntry, LogSource } from '../observability/logger';
import type { ErrorCode } from '../api/errors';

// ── Severity Tier ────────────────────────────────────────────────────────────

export type TroubleshootSeverity = 'critical' | 'high' | 'medium' | 'low' | 'info';

// ── Diagnosis Result ─────────────────────────────────────────────────────────

export interface TroubleshootDiagnosis {
  /** The specific ErrorCode or log source that produced this diagnosis. */
  code: ErrorCode | LogSource | 'UNKNOWN';
  /** Plain-English title of what went wrong. Safe for all users. */
  title: string;
  /** Short explanation of why this happened. Avoids jargon. */
  reason: string;
  /** Business impact — what the user cannot do because of this. */
  impact: string;
  /** Ordered list of actionable steps to resolve this. */
  steps: string[];
  /** Visual severity indicator. */
  severity: TroubleshootSeverity;
  /** True if a simple retry is likely to succeed. */
  selfResolvable: boolean;
  /** True if this should be escalated to support. */
  escalate: boolean;
  /** Optional: a navigation hint (e.g., go to Settings → Warehouses). */
  navigationHint?: string | undefined;
  /** The correlation/reference ID from the log entry. */
  referenceId?: string | undefined;
  /** Timestamp of when the issue was captured. */
  capturedAt: string;
  /** Originating route where the issue occurred. */
  route?: string | undefined;
}

// ── Pattern Entry (internal) ─────────────────────────────────────────────────

interface DiagnosisPattern {
  title: string;
  reason: string;
  impact: string;
  steps: string[];
  severity: TroubleshootSeverity;
  selfResolvable: boolean;
  escalate: boolean;
  navigationHint?: string;
}

// ═══════════════════════════════════════════════════════════════════════════
// THE DIAGNOSIS REGISTRY — one entry per ErrorCode
// ═══════════════════════════════════════════════════════════════════════════

const REGISTRY: Partial<Record<ErrorCode | 'boundary' | 'UNKNOWN', DiagnosisPattern>> = {

  // ── Auth ──────────────────────────────────────────────────────────────────

  UNAUTHENTICATED: {
    title: 'You are not signed in',
    reason: 'Your session could not be verified. You may not have logged in, or the session check failed.',
    impact: 'You cannot access protected pages or perform any operations until you sign back in.',
    steps: [
      'Click "Sign In" to return to the login page.',
      'Enter your credentials and sign in.',
      'If you believe you were already signed in, clear your browser cache and try again.',
    ],
    severity: 'high',
    selfResolvable: true,
    escalate: false,
  },
  TOKEN_EXPIRED: {
    title: 'Your session has expired',
    reason: 'Access tokens expire after 15 minutes for security. The system tries to refresh automatically, but this can fail if the browser tab was inactive for too long.',
    impact: 'You were temporarily unable to load data. The system will automatically retry after refreshing your session.',
    steps: [
      'Reload this page — the system will re-authenticate automatically.',
      'If the problem persists, sign out and sign back in.',
    ],
    severity: 'low',
    selfResolvable: true,
    escalate: false,
  },
  TOKEN_REVOKED: {
    title: 'Your session was revoked',
    reason: 'Your access token was explicitly invalidated. This can happen if an administrator revoked your session or if you signed in from another device.',
    impact: 'You cannot access the system until you sign in again.',
    steps: [
      'Sign out and sign back in.',
      'If you did not trigger this, contact your administrator — another user may have revoked your session.',
    ],
    severity: 'high',
    selfResolvable: true,
    escalate: false,
  },
  REFRESH_REUSED: {
    title: 'Security alert: session token reuse detected',
    reason: 'A refresh token was used more than once. This can indicate a session hijack attempt, or it can happen if the same session is open in multiple tabs.',
    impact: 'Your session has been invalidated for your security. You need to sign in again.',
    steps: [
      'Sign out and sign back in immediately.',
      'Close any duplicate browser tabs or windows you may have open.',
      'If you did not open multiple tabs, notify your administrator immediately as this could indicate unauthorized access.',
    ],
    severity: 'critical',
    selfResolvable: false,
    escalate: true,
  },
  MFA_REQUIRED: {
    title: 'Multi-factor authentication required',
    reason: 'Your account or your organization requires a second verification step before you can access certain features.',
    impact: 'Access to this section is blocked until you complete the authentication step.',
    steps: [
      'Complete the MFA challenge on your authentication app.',
      'If you do not have access to your MFA device, contact your administrator.',
    ],
    severity: 'medium',
    selfResolvable: true,
    escalate: false,
  },
  ACCOUNT_LOCKED: {
    title: 'Your account is locked',
    reason: 'Your account was locked due to multiple failed login attempts or an administrator action.',
    impact: 'You cannot sign in or access any features until the lock is lifted.',
    steps: [
      'Wait for the automatic unlock period (usually 30 minutes).',
      'Contact your administrator to manually unlock the account.',
    ],
    severity: 'high',
    selfResolvable: false,
    escalate: true,
  },
  ACCOUNT_INACTIVE: {
    title: 'Your account is inactive',
    reason: 'Your account has been deactivated by an administrator.',
    impact: 'You cannot sign in until the account is reactivated.',
    steps: [
      'Contact your administrator to reactivate your account.',
      'If you believe this is a mistake, provide your User ID to support.',
    ],
    severity: 'high',
    selfResolvable: false,
    escalate: true,
  },
  TENANT_INACTIVE: {
    title: 'Your workspace is inactive',
    reason: 'The organization account (tenant) associated with your login has been deactivated or suspended.',
    impact: 'No users in this workspace can access the system until the account is reactivated.',
    steps: [
      'Check your subscription status in Account Settings.',
      'Contact the workspace owner or billing administrator.',
      'If you believe this is a payment issue, settle the outstanding balance through your account portal.',
    ],
    severity: 'critical',
    selfResolvable: false,
    escalate: true,
    navigationHint: 'Settings → Billing & Subscription',
  },

  // ── Authorization ─────────────────────────────────────────────────────────

  FORBIDDEN: {
    title: 'You do not have permission for this action',
    reason: 'Your role does not include the permission required to perform this operation or access this resource.',
    impact: 'The operation was blocked. No data was changed.',
    steps: [
      'Verify that your role includes the required permission for this action.',
      'Ask your administrator to update your role if access is needed.',
      'Check Settings → Users & Roles to understand your current permissions.',
    ],
    severity: 'medium',
    selfResolvable: false,
    escalate: false,
    navigationHint: 'Settings → Users & Roles',
  },
  OUT_OF_SCOPE: {
    title: 'This resource belongs to a different branch or scope',
    reason: 'You are trying to access a record that belongs to a different branch than the one you are currently operating in.',
    impact: 'Access to this record is restricted to your active branch context.',
    steps: [
      'Switch to the correct branch using the Branch Selector in the top navigation bar.',
      'If you need cross-branch access, ask your administrator to adjust your scope permissions.',
    ],
    severity: 'medium',
    selfResolvable: true,
    escalate: false,
    navigationHint: 'Top Navigation → Branch Selector',
  },
  TENANT_MISMATCH: {
    title: 'Account mismatch detected',
    reason: 'The resource you are trying to access belongs to a different organization account.',
    impact: 'Access was denied. No data was exposed.',
    steps: [
      'Sign out and sign back in to the correct workspace.',
      'If you manage multiple organizations, ensure you are logged into the right account.',
    ],
    severity: 'high',
    selfResolvable: true,
    escalate: false,
  },
  PLATFORM_ONLY: {
    title: 'This feature is only available to platform administrators',
    reason: 'The feature you tried to access is reserved for the master platform admin panel, not the tenant workspace.',
    impact: 'This action cannot be performed from your current workspace.',
    steps: [
      'If you need to perform this action, contact the platform administrator.',
      'If you believe you should have access, contact support.',
    ],
    severity: 'medium',
    selfResolvable: false,
    escalate: false,
  },

  // ── Not Found ─────────────────────────────────────────────────────────────

  NOT_FOUND: {
    title: 'The record could not be found',
    reason: 'The item you are looking for does not exist, may have been deleted, or the ID is incorrect.',
    impact: 'The operation was cancelled. No changes were made.',
    steps: [
      'Refresh the list and verify the record still exists.',
      'Check if the record was moved to the Data Bin (recently deleted items).',
      'If you received a link to this record, verify the link is correct.',
    ],
    severity: 'low',
    selfResolvable: true,
    escalate: false,
    navigationHint: 'Settings → Data Bin & Recovery',
  },
  ROUTE_NOT_FOUND: {
    title: 'Page not found',
    reason: 'The URL you navigated to does not exist in this workspace.',
    impact: 'The page cannot be displayed.',
    steps: [
      'Return to the Dashboard and navigate from there.',
      'Check if the URL was typed correctly.',
      'If you followed a link in the system, report it to support.',
    ],
    severity: 'low',
    selfResolvable: true,
    escalate: false,
    navigationHint: 'Dashboard',
  },
  RESOURCE_GONE: {
    title: 'This record has been permanently removed',
    reason: 'The record was permanently deleted and cannot be recovered.',
    impact: 'The record and all associated data no longer exist.',
    steps: [
      'Check the Data Bin to confirm whether the record was recently deleted.',
      'If you need this data, contact your administrator — platform-level recovery may be possible.',
    ],
    severity: 'medium',
    selfResolvable: false,
    escalate: true,
    navigationHint: 'Settings → Data Bin & Recovery',
  },

  // ── Validation / Business Rules ───────────────────────────────────────────

  VALIDATION_FAILED: {
    title: 'Some fields contain invalid data',
    reason: 'One or more fields in the form failed the required format or value checks.',
    impact: 'The record was not saved. No data was changed.',
    steps: [
      'Check the highlighted fields in the form for error messages.',
      'Correct the invalid values and resubmit.',
      'Ensure required fields are not empty.',
    ],
    severity: 'low',
    selfResolvable: true,
    escalate: false,
  },
  BUSINESS_RULE_VIOLATED: {
    title: 'A business rule prevented this action',
    reason: 'The action you tried to perform conflicts with a configured business rule or workflow constraint.',
    impact: 'The operation was blocked to protect data integrity.',
    steps: [
      'Review the error message for the specific rule that was violated.',
      'Check the relevant settings section to understand the applicable business rules.',
      'If the rule is incorrect, your administrator can update it in Settings.',
    ],
    severity: 'medium',
    selfResolvable: false,
    escalate: false,
    navigationHint: 'Settings → Workflows & Automation',
  },
  INSUFFICIENT_STOCK: {
    title: 'Not enough stock to fulfill this request',
    reason: 'The quantity you requested exceeds the available inventory for this item.',
    impact: 'The order, transfer, or production batch could not be processed.',
    steps: [
      'Check the current stock level in Inventory.',
      'Reduce the requested quantity to match available stock.',
      'Create a Purchase Order to restock the item.',
      'Alternatively, enable partial fulfillment if your business rules allow it.',
    ],
    severity: 'medium',
    selfResolvable: true,
    escalate: false,
    navigationHint: 'Inventory → Stock Levels',
  },
  PRODUCTION_CONTEXT_INCOMPLETE: {
    title: 'Production setup is incomplete',
    reason: 'Required production context is missing — this could be an incomplete Bill of Materials, missing raw material assignments, or an unlinked factory/line.',
    impact: 'The production batch or manufacturing order cannot start.',
    steps: [
      'Review the Bill of Materials (BOM) for this product.',
      'Ensure all raw materials are linked and available.',
      'Verify that a factory and production line are assigned.',
      'Check that all required QC stages are configured.',
    ],
    severity: 'high',
    selfResolvable: true,
    escalate: false,
    navigationHint: 'Production → Bills of Materials',
  },
  QC_REQUIRED: {
    title: 'Quality control sign-off is required',
    reason: 'This workflow requires a Quality Control inspection to be completed before proceeding.',
    impact: 'The next stage cannot begin until QC approves the current stage.',
    steps: [
      'Open the QC module and complete the inspection for this batch.',
      'Ensure the inspector role is assigned to the correct team member.',
      'If QC was already completed, verify that the sign-off was submitted.',
    ],
    severity: 'medium',
    selfResolvable: true,
    escalate: false,
    navigationHint: 'QC → Pending Inspections',
  },
  CREDIT_LIMIT_EXCEEDED: {
    title: 'Credit limit exceeded for this customer',
    reason: 'The customer\'s outstanding balance plus this order amount exceeds their approved credit limit.',
    impact: 'The order cannot be confirmed without manual override or payment.',
    steps: [
      'Review the customer\'s current outstanding balance in CRM or Finance.',
      'Request a payment before proceeding with this order.',
      'Ask an administrator with appropriate permissions to override the credit limit.',
      'Update the customer\'s credit limit in their CRM profile if appropriate.',
    ],
    severity: 'medium',
    selfResolvable: true,
    escalate: false,
    navigationHint: 'CRM → Customer Profiles',
  },
  PRICE_STALE: {
    title: 'Product price has changed since this was drafted',
    reason: 'The price recorded in this draft or order is no longer current. Pricing may have been updated after this document was created.',
    impact: 'The document cannot be confirmed with the outdated price.',
    steps: [
      'Refresh or reload the document to fetch the latest pricing.',
      'Review the updated price and confirm if it is acceptable.',
      'If the original price was agreed with the customer, a price override may be required by an authorized user.',
    ],
    severity: 'low',
    selfResolvable: true,
    escalate: false,
  },
  PERIOD_CLOSED: {
    title: 'The accounting period for this transaction is closed',
    reason: 'The date of this transaction falls within a financial period that has been closed. Closed periods cannot accept new or modified transactions.',
    impact: 'The transaction cannot be posted until the period is reopened or the date is corrected.',
    steps: [
      'Change the transaction date to fall within an open accounting period.',
      'If the date must remain as-is, ask your Finance administrator to reopen the period temporarily.',
    ],
    severity: 'medium',
    selfResolvable: true,
    escalate: false,
    navigationHint: 'Finance → Accounting Periods',
  },
  SEQUENCE_EXHAUSTED: {
    title: 'Document numbering sequence is exhausted',
    reason: 'The automatic numbering sequence for this document type has reached its maximum value and needs to be reset or extended.',
    impact: 'New documents of this type cannot be created until the sequence is reset.',
    steps: [
      'Go to Settings → Document Numbering to reset or extend the sequence.',
      'Contact your administrator if you do not have access to sequence settings.',
    ],
    severity: 'high',
    selfResolvable: false,
    escalate: false,
    navigationHint: 'Settings → Document Numbering',
  },
  UNSUPPORTED_CAPABILITY: {
    title: 'This feature is not available on your plan',
    reason: 'The action you tried to perform requires a capability that is not included in your current subscription plan.',
    impact: 'This feature cannot be used until your plan is upgraded.',
    steps: [
      'Review your current plan and available features in Account Settings.',
      'Contact support or your account manager to upgrade your plan.',
    ],
    severity: 'medium',
    selfResolvable: false,
    escalate: true,
    navigationHint: 'Settings → Subscription & Plan',
  },
  INVALID_FILE: {
    title: 'The uploaded file is not valid',
    reason: 'The file you uploaded is either in an unsupported format, exceeds the size limit, or is corrupt.',
    impact: 'The file was not saved.',
    steps: [
      'Check that the file format matches the accepted types (shown in the upload area).',
      'Ensure the file size is within the allowed limit.',
      'Try re-exporting the file from its source application and uploading again.',
    ],
    severity: 'low',
    selfResolvable: true,
    escalate: false,
  },
  IMPORT_FAILED: {
    title: 'Data import encountered errors',
    reason: 'One or more rows in the imported file could not be processed due to formatting issues, missing required columns, or invalid values.',
    impact: 'The import was partially or fully rejected. No data was saved.',
    steps: [
      'Download the error report from the import screen to identify the problematic rows.',
      'Correct the issues in the source file.',
      'Re-upload the corrected file.',
      'Check that the file uses the correct template (downloadable from the import screen).',
    ],
    severity: 'medium',
    selfResolvable: true,
    escalate: false,
  },

  // ── Conflicts ─────────────────────────────────────────────────────────────

  INVALID_STATE: {
    title: 'This record is in the wrong state for this action',
    reason: 'The workflow step you are trying to perform is not valid for the current status of this record.',
    impact: 'The action was blocked to protect workflow integrity.',
    steps: [
      'Review the current status of the record.',
      'Follow the expected workflow sequence (e.g., approve before dispatching, receive before closing a PO).',
      'Check the timeline or audit log for the record\'s history.',
    ],
    severity: 'medium',
    selfResolvable: true,
    escalate: false,
  },
  DUPLICATE: {
    title: 'A duplicate record already exists',
    reason: 'A record with the same unique identifier (SKU, code, name, or number) already exists in the system.',
    impact: 'The new record was not created.',
    steps: [
      'Search for the existing record before creating a new one.',
      'Use a different unique identifier for the new entry.',
      'If the existing record is incorrect, update it instead of creating a duplicate.',
    ],
    severity: 'low',
    selfResolvable: true,
    escalate: false,
  },
  IDEMPOTENT_KEY_CONFLICT: {
    title: 'This operation was already submitted',
    reason: 'An identical request was already processed. This can happen if you submitted a form twice quickly.',
    impact: 'The duplicate submission was blocked. The original operation may already be complete.',
    steps: [
      'Refresh the page to check if the operation completed successfully.',
      'Do not submit the form again without first verifying the current state.',
    ],
    severity: 'low',
    selfResolvable: true,
    escalate: false,
  },
  VERSION_CONFLICT: {
    title: 'This record was modified by someone else',
    reason: 'Another user or session updated this record between when you opened it and when you tried to save your changes.',
    impact: 'Your changes were not saved to prevent overwriting the other user\'s updates.',
    steps: [
      'Reload the record to see the latest version.',
      'Review the changes made by the other user.',
      'Re-apply your changes on top of the current version.',
    ],
    severity: 'medium',
    selfResolvable: true,
    escalate: false,
  },
  LOCKED: {
    title: 'This record is currently locked',
    reason: 'The record is locked for editing, possibly because another user is currently editing it or because it is in an approved/locked state.',
    impact: 'You cannot modify this record while it is locked.',
    steps: [
      'Wait a few minutes and try again — the other user\'s editing session may expire.',
      'If the record is locked in a workflow state (e.g., approved), it may need to be unlocked by an authorized user.',
      'Check the audit log to see who last modified the record.',
    ],
    severity: 'medium',
    selfResolvable: true,
    escalate: false,
  },
  IN_USE: {
    title: 'This record is in use and cannot be deleted',
    reason: 'Other records in the system reference this item. Deleting it would break those relationships.',
    impact: 'The deletion was blocked to protect data integrity.',
    steps: [
      'Review which records reference this item (the error message may list them).',
      'Remove or reassign those references first.',
      'Then attempt the deletion again.',
      'Alternatively, archive this record instead of deleting it.',
    ],
    severity: 'medium',
    selfResolvable: true,
    escalate: false,
  },

  // ── Protocol ──────────────────────────────────────────────────────────────

  PAYLOAD_TOO_LARGE: {
    title: 'The data being sent is too large',
    reason: 'The file or data you are trying to upload or submit exceeds the server\'s size limit.',
    impact: 'The upload or submission was rejected.',
    steps: [
      'Reduce the size of the file (compress images, split large imports into smaller batches).',
      'Contact support if you regularly need to upload large files — the limit may be adjustable.',
    ],
    severity: 'low',
    selfResolvable: true,
    escalate: false,
  },
  IDEMPOTENCY_KEY_REQUIRED: {
    title: 'A safety key is required for this operation',
    reason: 'This is a technical issue where the client did not send the required idempotency key. This should not occur in normal use.',
    impact: 'The operation was blocked.',
    steps: [
      'Reload the page and try again.',
      'If the problem persists, report it to support with the reference ID.',
    ],
    severity: 'medium',
    selfResolvable: true,
    escalate: true,
  },
  PRECONDITION_REQUIRED: {
    title: 'A prerequisite step is missing',
    reason: 'This operation has a prerequisite that has not been completed.',
    impact: 'The operation cannot proceed until the prerequisite is satisfied.',
    steps: [
      'Review the workflow for this action and ensure all previous steps are complete.',
      'Check for any missing required configurations in Settings.',
    ],
    severity: 'medium',
    selfResolvable: true,
    escalate: false,
  },
  RATE_LIMITED: {
    title: 'Too many requests — please slow down',
    reason: 'You or your organization has sent more requests than allowed in a given time window. This is a protection against overload.',
    impact: 'Some actions are temporarily blocked.',
    steps: [
      'Wait 30–60 seconds and try again.',
      'Avoid refreshing the page rapidly or submitting forms multiple times.',
      'If you are running bulk operations, try scheduling them in smaller batches.',
    ],
    severity: 'low',
    selfResolvable: true,
    escalate: false,
  },

  // ── Server ────────────────────────────────────────────────────────────────

  INTERNAL_ERROR: {
    title: 'An unexpected server error occurred',
    reason: 'Something went wrong on the server that was not expected. This is not caused by anything you did.',
    impact: 'The operation could not be completed. Your data was not changed.',
    steps: [
      'Try again in a few minutes — temporary server errors often resolve automatically.',
      'If the error continues, copy the Reference ID and report it to support.',
    ],
    severity: 'high',
    selfResolvable: true,
    escalate: true,
  },
  NOT_IMPLEMENTED: {
    title: 'This feature is not yet available',
    reason: 'The feature you tried to use has not been fully implemented yet.',
    impact: 'The action cannot be performed at this time.',
    steps: [
      'Check for system announcements about upcoming feature releases.',
      'Contact support to request this feature or learn about the expected release date.',
    ],
    severity: 'medium',
    selfResolvable: false,
    escalate: false,
  },
  UPSTREAM_FAILED: {
    title: 'The server could not reach a required service',
    reason: 'The backend server tried to communicate with another internal service (database, queue, storage, etc.) and failed.',
    impact: 'The operation was not completed.',
    steps: [
      'Wait 1–2 minutes and try again.',
      'Check the System Status page if available.',
      'If the problem persists for more than 5 minutes, contact support.',
    ],
    severity: 'high',
    selfResolvable: true,
    escalate: true,
  },
  SERVICE_UNAVAILABLE: {
    title: 'The service is temporarily unavailable',
    reason: 'The system is undergoing maintenance or is temporarily overloaded.',
    impact: 'The system may be partially or fully unavailable.',
    steps: [
      'Wait a few minutes and try again.',
      'Check for maintenance announcements from your platform administrator.',
      'If you have urgent operational needs, contact support.',
    ],
    severity: 'critical',
    selfResolvable: true,
    escalate: true,
  },
  UPSTREAM_TIMEOUT: {
    title: 'The server took too long to respond',
    reason: 'An internal service did not respond within the expected time. This can happen during high load or slow database queries.',
    impact: 'The operation timed out. It may or may not have completed — check the record status.',
    steps: [
      'Check if the operation completed before trying again (to avoid duplicates).',
      'Try again during off-peak hours if the operation involves large data sets.',
      'Contact support if this happens regularly.',
    ],
    severity: 'high',
    selfResolvable: true,
    escalate: true,
  },

  // ── Client ────────────────────────────────────────────────────────────────

  NETWORK_OFFLINE: {
    title: 'You are offline',
    reason: 'Your device has lost its internet connection.',
    impact: 'No data can be loaded or saved until the connection is restored.',
    steps: [
      'Check your Wi-Fi or network cable connection.',
      'Try loading another website to confirm connectivity.',
      'When back online, reload this page.',
    ],
    severity: 'high',
    selfResolvable: true,
    escalate: false,
  },
  REQUEST_TIMEOUT: {
    title: 'The request timed out',
    reason: 'The request took longer than 30 seconds to receive a response. This can happen due to a slow network, large data operations, or server load.',
    impact: 'The operation was not completed.',
    steps: [
      'Check your network connection speed.',
      'Try the operation again.',
      'If it consistently times out, contact support — the operation may need optimization.',
    ],
    severity: 'medium',
    selfResolvable: true,
    escalate: false,
  },
  REQUEST_CANCELLED: {
    title: 'Request was cancelled',
    reason: 'The request was cancelled, typically because you navigated away from the page before it completed.',
    impact: 'No data was changed. This is normal behavior during navigation.',
    steps: [
      'This is usually not an error — it happens when navigating between pages.',
      'If you expected data to be saved, return to the page and check if the operation completed.',
    ],
    severity: 'info',
    selfResolvable: true,
    escalate: false,
  },
  MALFORMED_RESPONSE: {
    title: 'The server returned an unexpected response',
    reason: 'The response from the server was in an unexpected format. This may indicate a version mismatch or a server error.',
    impact: 'The data could not be displayed.',
    steps: [
      'Reload the page and try again.',
      'Clear your browser cache.',
      'If the problem persists, contact support with the Reference ID.',
    ],
    severity: 'high',
    selfResolvable: true,
    escalate: true,
  },

  // ── Boundary (render crash) ───────────────────────────────────────────────

  boundary: {
    title: 'A component crashed unexpectedly',
    reason: 'Part of the user interface encountered an unexpected error during rendering. This is a software bug.',
    impact: 'The affected section of the interface is unavailable. Your data is safe and was not changed.',
    steps: [
      'Click the Retry button to reload the crashed section.',
      'If the section keeps crashing, reload the entire page.',
      'Copy the Reference ID and report it to support so the bug can be fixed.',
    ],
    severity: 'high',
    selfResolvable: true,
    escalate: true,
  },

  UNKNOWN: {
    title: 'An unknown error occurred',
    reason: 'Something went wrong that could not be automatically identified.',
    impact: 'The affected operation may not have completed.',
    steps: [
      'Try the operation again.',
      'Reload the page.',
      'If the problem persists, copy the Reference ID and contact support.',
    ],
    severity: 'medium',
    selfResolvable: true,
    escalate: true,
  },
};

// ═══════════════════════════════════════════════════════════════════════════
// ENGINE FUNCTIONS
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Diagnose a single log entry and produce a structured TroubleshootDiagnosis.
 */
export function diagnoseEntry(entry: LogEntry): TroubleshootDiagnosis {
  const lookupKey = entry.code ?? (entry.source === 'boundary' ? 'boundary' : undefined) ?? 'UNKNOWN';
  const pattern = REGISTRY[lookupKey as keyof typeof REGISTRY] ?? REGISTRY['UNKNOWN']!;

  return {
    code: lookupKey as ErrorCode | LogSource | 'UNKNOWN',
    title: pattern.title,
    reason: pattern.reason,
    impact: pattern.impact,
    steps: pattern.steps,
    severity: pattern.severity,
    selfResolvable: pattern.selfResolvable,
    escalate: pattern.escalate,
    navigationHint: pattern.navigationHint,
    referenceId: entry.correlationId ?? entry.id,
    capturedAt: entry.timestamp,
    route: entry.route,
  };
}

/**
 * Score severity for sorting (higher = more urgent).
 */
export function severityScore(s: TroubleshootSeverity): number {
  switch (s) {
    case 'critical': return 5;
    case 'high': return 4;
    case 'medium': return 3;
    case 'low': return 2;
    case 'info': return 1;
    default: return 0;
  }
}

/**
 * Severity display metadata (label + color classes).
 */
export function severityMeta(s: TroubleshootSeverity): {
  label: string;
  badgeCls: string;
  iconCls: string;
  borderCls: string;
  bgCls: string;
} {
  switch (s) {
    case 'critical':
      return {
        label: 'Critical',
        badgeCls: 'bg-rose-500/15 text-rose-600 dark:text-rose-400 border-rose-500/30',
        iconCls: 'text-rose-500',
        borderCls: 'border-l-rose-500',
        bgCls: 'bg-rose-500/5',
      };
    case 'high':
      return {
        label: 'High',
        badgeCls: 'bg-orange-500/15 text-orange-600 dark:text-orange-400 border-orange-500/30',
        iconCls: 'text-orange-500',
        borderCls: 'border-l-orange-500',
        bgCls: 'bg-orange-500/5',
      };
    case 'medium':
      return {
        label: 'Medium',
        badgeCls: 'bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/30',
        iconCls: 'text-amber-500',
        borderCls: 'border-l-amber-500',
        bgCls: 'bg-amber-500/5',
      };
    case 'low':
      return {
        label: 'Low',
        badgeCls: 'bg-blue-500/15 text-blue-600 dark:text-blue-400 border-blue-500/30',
        iconCls: 'text-blue-500',
        borderCls: 'border-l-blue-500',
        bgCls: 'bg-blue-500/5',
      };
    case 'info':
    default:
      return {
        label: 'Info',
        badgeCls: 'bg-surface-sunken text-muted border-default',
        iconCls: 'text-muted',
        borderCls: 'border-l-muted',
        bgCls: 'bg-surface-sunken/50',
      };
  }
}

/**
 * Get the highest severity from a list of diagnoses.
 */
export function getTopSeverity(diagnoses: TroubleshootDiagnosis[]): TroubleshootSeverity | null {
  if (diagnoses.length === 0) return null;
  const top = diagnoses.reduce((highest, current) =>
    severityScore(current.severity) > severityScore(highest.severity) ? current : highest
  );
  return top.severity;
}

/**
 * Build a summary of diagnoses from the current log buffer,
 * deduplicating by code and sorting by severity (worst first).
 */
export function buildDiagnosisSummary(entries: readonly LogEntry[]): {
  diagnoses: TroubleshootDiagnosis[];
  hasErrors: boolean;
  topSeverity: TroubleshootSeverity | null;
  errorCount: number;
  criticalCount: number;
} {
  const errorEntries = entries.filter(e => e.level === 'error' || e.level === 'warn');
  const diagnoses = errorEntries
    .map(diagnoseEntry)
    .filter(d => d.code !== 'REQUEST_CANCELLED')
    .sort((a, b) => severityScore(b.severity) - severityScore(a.severity));

  const criticalCount = diagnoses.filter(d => d.severity === 'critical' || d.severity === 'high').length;

  return {
    diagnoses,
    hasErrors: diagnoses.length > 0,
    topSeverity: getTopSeverity(diagnoses),
    errorCount: diagnoses.length,
    criticalCount,
  };
}
