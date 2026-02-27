import type { CanonicalWorkflowStatus } from './workflow';

export function canonicalStatusDisplayLabel(status: CanonicalWorkflowStatus): string {
    const labels: Record<CanonicalWorkflowStatus, string> = {
        SUBMITTED: 'Submitted',
        UNDER_REVIEW: 'Under Review',
        OPS_FORWARDED: 'Ops Forwarded',
        QUOTED: 'Initial Quote',
        COUNTER: 'Final Offer',
        FINAL: 'Final Offer',
        ACCEPTED_PENDING_OPS_RECHECK: 'Payment Pending',
        ACCEPTED_PAYMENT_PENDING: 'Payment Pending',
        PAYMENT_LINK_SENT: 'Payment Link Sent',
        PAID_CONFIRMED: 'Paid Confirmed',
        READY_FOR_OPS: 'Ready for Ops',
        IN_OPS_PROCESSING: 'In Ops Processing',
        CLOSED_ACCEPTED: 'Closed Won',
        CLOSED_DECLINED: 'Closed Lost',
    };
    return labels[status] || 'Status Updating';
}

export function canonicalStatusBadgeClass(status: CanonicalWorkflowStatus): string {
    const classes: Record<CanonicalWorkflowStatus, string> = {
        SUBMITTED: 'bg-amber-50 text-amber-700 ring-1 ring-amber-200',
        UNDER_REVIEW: 'bg-amber-50 text-amber-700 ring-1 ring-amber-200',
        OPS_FORWARDED: 'bg-sky-50 text-sky-700 ring-1 ring-sky-200',
        QUOTED: 'bg-indigo-50 text-indigo-700 ring-1 ring-indigo-200',
        COUNTER: 'bg-violet-50 text-violet-700 ring-1 ring-violet-200',
        FINAL: 'bg-violet-50 text-violet-700 ring-1 ring-violet-200',
        ACCEPTED_PENDING_OPS_RECHECK: 'bg-yellow-50 text-yellow-700 ring-1 ring-yellow-300',
        ACCEPTED_PAYMENT_PENDING: 'bg-yellow-50 text-yellow-700 ring-1 ring-yellow-300',
        PAYMENT_LINK_SENT: 'bg-blue-50 text-blue-700 ring-1 ring-blue-200',
        PAID_CONFIRMED: 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200',
        READY_FOR_OPS: 'bg-teal-50 text-teal-700 ring-1 ring-teal-200',
        IN_OPS_PROCESSING: 'bg-cyan-50 text-cyan-700 ring-1 ring-cyan-200',
        CLOSED_ACCEPTED: 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200',
        CLOSED_DECLINED: 'bg-rose-50 text-rose-700 ring-1 ring-rose-200',
    };
    return classes[status] || 'bg-gray-50 text-gray-600 ring-1 ring-gray-200';
}
