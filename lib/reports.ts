export type ReportFilters = {
  month: string;
  dateFrom: string;
  dateTo: string;
  status: string;
};

export type ReportSession = {
  session_date: string;
  status: string;
  expenses_vnd: number;
  collected_vnd: number;
  outstanding_vnd: number;
  attendee_count: number;
};

export function remainingPaymentDue(payment: { amount_due_vnd: number; amount_vnd: number; status: string }) {
  if (payment.status === "waived") return 0;
  return Math.max(payment.amount_due_vnd - (payment.status === "paid" ? payment.amount_vnd : 0), 0);
}

export function confirmedPaymentAmount(payment: { amount_vnd: number; status: string }) {
  return payment.status === "paid" ? payment.amount_vnd : 0;
}

export function filterReportSessions<T extends ReportSession>(sessions: T[], filters: ReportFilters) {
  return sessions.filter((session) => {
    if (filters.month !== "all" && !session.session_date.startsWith(filters.month)) return false;
    if (filters.dateFrom && session.session_date < filters.dateFrom) return false;
    if (filters.dateTo && session.session_date > filters.dateTo) return false;
    if (filters.status !== "all" && session.status !== filters.status) return false;
    return true;
  });
}

export function summarizeReportSessions(sessions: ReportSession[]) {
  return sessions.reduce((summary, session) => ({
    expensesVnd: summary.expensesVnd + session.expenses_vnd,
    collectedVnd: summary.collectedVnd + session.collected_vnd,
    outstandingVnd: summary.outstandingVnd + session.outstanding_vnd,
    sessionCount: summary.sessionCount + 1,
    participantCount: summary.participantCount + session.attendee_count,
  }), {
    expensesVnd: 0,
    collectedVnd: 0,
    outstandingVnd: 0,
    sessionCount: 0,
    participantCount: 0,
  });
}

export function groupReportSessionsByMonth<T extends ReportSession>(sessions: T[]) {
  const months = new Map<string, ReturnType<typeof summarizeReportSessions>>();
  for (const session of sessions) {
    const month = session.session_date.slice(0, 7);
    const current = months.get(month) ?? summarizeReportSessions([]);
    current.expensesVnd += session.expenses_vnd;
    current.collectedVnd += session.collected_vnd;
    current.outstandingVnd += session.outstanding_vnd;
    current.sessionCount += 1;
    current.participantCount += session.attendee_count;
    months.set(month, current);
  }
  return [...months].map(([month, summary]) => ({ month, ...summary })).sort((a, b) => b.month.localeCompare(a.month));
}
