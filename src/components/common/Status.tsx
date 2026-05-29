import type { EventStatus } from '../../domain/types';
import type { CheckSummary, Severity } from '../../domain/validation';

export const SEVERITY_ICON: Record<Severity, string> = {
  error: '⛔',
  warning: 'ℹ️',
  info: '✓',
};

export const SEVERITY_LABEL: Record<Severity, string> = {
  error: 'Error',
  warning: 'Review',
  info: 'Info',
};

export function StatusChip({ status }: { status: EventStatus }) {
  if (status === 'draft') return <span className="chip chip-amber"><span className="dot" />Draft</span>;
  if (status === 'sent') return <span className="chip chip-ok"><span className="dot" />Sent</span>;
  return <span className="chip chip-muted"><span className="dot" />Ready</span>;
}

/** Value-check chip from a validation summary (red / blue / green). */
export function CheckChip({ summary, sent }: { summary: CheckSummary; sent?: boolean }) {
  if (sent) return <span className="chip chip-ok"><span className="dot" />Sent</span>;
  if (summary.errors > 0)
    return <span className="chip chip-err"><span className="dot" />{summary.errors} error{summary.errors > 1 ? 's' : ''}</span>;
  if (summary.warnings > 0)
    return <span className="chip chip-warn"><span className="dot" />{summary.warnings} to review</span>;
  return <span className="chip chip-ok"><span className="dot" />OK</span>;
}

export function StateChip({ state }: { state: string }) {
  return <span className="chip chip-state"><span className="dot" />{state}</span>;
}
