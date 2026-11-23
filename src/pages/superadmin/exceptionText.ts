// AGF EX-F (register §91): wording for billing exceptions in the Super Admin console.

const CODES: Record<string, string> = {
  UNATTRIBUTED_PAYMENT: 'Payment not matched to a restaurant',
  PAYMENT_OUTCOME_PENDING_REVIEW: 'Payment outcome unresolved',
};

/** A readable name for an exception code; unknown codes are shown in words ("STATE_CHANGED" → "State changed"). */
export function codeLabel(code: string): string {
  if (CODES[code]) return CODES[code];
  const words = code.toLowerCase().split('_').join(' ');
  return words.charAt(0).toUpperCase() + words.slice(1);
}

export const STATUS_LABELS: Record<string, string> = {
  OPEN: 'Open', IN_REVIEW: 'In review', ESCALATED: 'Escalated', AUTO_HANDLING: 'Automatic handling', RESOLVED: 'Resolved',
};
export const statusLabel = (s: string) => STATUS_LABELS[s] ?? s;

export const RESOLUTION_LABELS: Record<string, string> = {
  FUNDS_HANDLED_EXTERNALLY: 'Funds handled outside Agafari', NO_ACTION_REQUIRED: 'No action required', REFUNDED_AUTOMATICALLY: 'Refunded automatically',
};

const ACTIONS: Record<string, string> = {
  BILLING_EXCEPTION_OPENED: 'Opened', BILLING_EXCEPTION_CLAIMED: 'Claimed', BILLING_EXCEPTION_NOTE_ADDED: 'Note added', BILLING_EXCEPTION_ESCALATED: 'Escalated',
  BILLING_EXCEPTION_RESOLVED: 'Resolved', BILLING_EXCEPTION_REPLAYED: 'Replayed', BILLING_EXCEPTION_OVERDUE: 'Overdue', BILLING_EXCEPTION_HANDED_BACK: 'Handed back',
  BILLING_EXCEPTION_ACTION_REJECTED: 'Action refused', BILLING_EXCEPTION_DUE_RECOMPUTED: 'Deadline moved',
};
export const actionLabel = (a: string) => ACTIONS[a] ?? a;

export const NO_RESTAURANT = 'No restaurant';

export function money(minor: number | null | undefined, currency: string | null | undefined): string {
  if (minor == null || !currency) return '—';
  try {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(minor / 100);
  } catch {
    return `${(minor / 100).toFixed(2)} ${currency}`;
  }
}

export const when = (iso: string | null | undefined) => (iso ? new Date(iso).toLocaleString() : '—');
