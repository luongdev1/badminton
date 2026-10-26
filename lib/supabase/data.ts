import "server-only";

import { z } from "zod";
import type { PostgrestError } from "@supabase/supabase-js";
import { requireAdminContext } from "@/lib/supabase/admin-context";
import type { Database } from "@/lib/supabase/database.types";
import { confirmedPaymentAmount, remainingPaymentDue } from "@/lib/reports";

export type MemberRow = Database["public"]["Tables"]["members"]["Row"];
export type SessionRow = Database["public"]["Tables"]["sessions"]["Row"];
export type ExpenseRow = Database["public"]["Tables"]["session_expenses"]["Row"];
export type PaymentRow = Database["public"]["Tables"]["payments"]["Row"];

export type SessionSummary = SessionRow & {
  attendee_count: number;
  expected_vnd: number;
  collected_vnd: number;
  outstanding_vnd: number;
  expenses_vnd: number;
  expenses: {
    id: string;
    description: string;
    category: ExpenseRow["category"];
    amount_vnd: number;
    incurred_at: string;
  }[];
  payment_details: {
    payment_id: string;
    member_name: string;
    amount_due_vnd: number;
    amount_vnd: number;
    status: PaymentRow["status"];
    paid_at: string | null;
  }[];
  payment_history: {
    id: string;
    payment_id: string;
    member_name: string;
    old_status: string | null;
    new_status: string;
    old_amount_vnd: number | null;
    new_amount_vnd: number;
    actor_source: string;
    created_at: string;
  }[];
};

export async function getMembers(includeInactive = true) {
  const { supabase, team } = await requireAdminContext();
  let query = supabase.from("members").select("*").eq("team_id", team.id).order("full_name");
  if (!includeInactive) query = query.eq("is_active", true);
  const { data, error } = await query;
  if (error) throw new Error(`Could not load members: ${error.message}`);
  return data;
}

export async function getSessions(includeReportDetails = false) {
  const { supabase, team } = await requireAdminContext();
  const [sessionsResult, participantsResult, paymentsResult, expensesResult, paymentAuditResult] = await Promise.all([
    supabase.from("sessions").select("*").eq("team_id", team.id).order("session_date", { ascending: false }).order("starts_at", { ascending: false }),
    supabase.from("session_participants").select("id,session_id,member_id,member_name_snapshot,status,fee_snapshot_vnd").eq("team_id", team.id),
    supabase.from("payments").select("id,session_id,member_id,amount_vnd,amount_due_vnd,status,paid_at").eq("team_id", team.id),
    supabase.from("session_expenses").select("id,session_id,description,category,amount_vnd,incurred_at").eq("team_id", team.id),
    includeReportDetails
      ? supabase.from("payment_audit_logs").select("id,payment_id,old_status,new_status,old_amount_vnd,new_amount_vnd,actor_source,created_at").eq("team_id", team.id).order("created_at", { ascending: false })
      : Promise.resolve({ data: [], error: null }),
  ]);

  const queryErrors: { table: string; error: PostgrestError }[] = [];
  if (sessionsResult.error) queryErrors.push({ table: "sessions", error: sessionsResult.error });
  if (participantsResult.error) queryErrors.push({ table: "session_participants", error: participantsResult.error });
  if (paymentsResult.error) queryErrors.push({ table: "payments", error: paymentsResult.error });
  if (expensesResult.error) queryErrors.push({ table: "session_expenses", error: expensesResult.error });
  if (includeReportDetails && paymentAuditResult.error) queryErrors.push({ table: "payment_audit_logs", error: paymentAuditResult.error });

  if (queryErrors.length > 0) {
    const details = queryErrors.map(({ table, error }) => {
      const context = [error.details, error.hint].filter(Boolean).join(" Hint: ");
      return `${table} [${error.code}]: ${error.message}${context ? ` (${context})` : ""}`;
    }).join("; ");
    throw new Error(`Could not load session data: ${details}`);
  }

  const summaries = new Map<string, SessionSummary>();
  for (const session of sessionsResult.data ?? []) {
    summaries.set(session.id, {
      ...session,
      attendee_count: 0,
      expected_vnd: 0,
      collected_vnd: 0,
      outstanding_vnd: 0,
      expenses_vnd: 0,
      expenses: [],
      payment_details: [],
      payment_history: [],
    });
  }
  for (const participant of participantsResult.data ?? []) {
    const summary = summaries.get(participant.session_id);
    if (summary && participant.status !== "declined") {
      summary.attendee_count += 1;
    }
  }
  const participantNameByPayment = new Map<string, string>();
  const participantBySessionMember = new Map(
    (participantsResult.data ?? []).map((participant) => [`${participant.session_id}:${participant.member_id}`, participant]),
  );
  for (const payment of paymentsResult.data ?? []) {
    const summary = summaries.get(payment.session_id);
    if (!summary) continue;
    const participant = participantBySessionMember.get(`${payment.session_id}:${payment.member_id}`);
    const memberName = participant?.member_name_snapshot ?? "Thành viên đã ẩn";
    participantNameByPayment.set(payment.id, memberName);
    summary.payment_details.push({
      payment_id: payment.id,
      member_name: memberName,
      amount_due_vnd: payment.amount_due_vnd,
      amount_vnd: payment.amount_vnd,
      status: payment.status,
      paid_at: payment.paid_at,
    });
    summary.expected_vnd += payment.amount_due_vnd;
    summary.collected_vnd += confirmedPaymentAmount(payment);
    summary.outstanding_vnd += remainingPaymentDue(payment);
  }
  for (const expense of expensesResult.data ?? []) {
    const summary = summaries.get(expense.session_id);
    if (summary) {
      summary.expenses_vnd += expense.amount_vnd;
      if (includeReportDetails) {
        summary.expenses.push({
          id: expense.id,
          description: expense.description,
          category: expense.category,
          amount_vnd: expense.amount_vnd,
          incurred_at: expense.incurred_at,
        });
      }
    }
  }
  if (includeReportDetails) {
    for (const audit of paymentAuditResult.data ?? []) {
      for (const summary of summaries.values()) {
        if (summary.payment_details.some((payment) => payment.payment_id === audit.payment_id)) {
          summary.payment_history.push({
            ...audit,
            member_name: participantNameByPayment.get(audit.payment_id) ?? "Thành viên đã ẩn",
          });
          break;
        }
      }
    }
  }

  return [...summaries.values()];
}

export async function getSessionDetail(sessionId: string) {
  if (!z.string().uuid().safeParse(sessionId).success) return null;
  const { supabase, team } = await requireAdminContext();
  const { data: session, error: sessionError } = await supabase
    .from("sessions")
    .select("*")
    .eq("team_id", team.id)
    .eq("id", sessionId)
    .maybeSingle();

  if (sessionError) throw new Error(`Could not load session: ${sessionError.message}`);
  if (!session) return null;

  const [participantsResult, expensesResult, paymentsResult] = await Promise.all([
    supabase.from("session_participants").select("*").eq("team_id", team.id).eq("session_id", sessionId).order("created_at"),
    supabase.from("session_expenses").select("*").eq("team_id", team.id).eq("session_id", sessionId).order("incurred_at", { ascending: false }),
    supabase.from("payments").select("member_id,amount_vnd,amount_due_vnd,status").eq("team_id", team.id).eq("session_id", sessionId),
  ]);

  const error = participantsResult.error ?? expensesResult.error ?? paymentsResult.error;
  if (error) throw new Error(`Could not load session details: ${error.message}`);

  const payments = new Map((paymentsResult.data ?? []).map((payment) => [payment.member_id, payment]));
  const participants = (participantsResult.data ?? []).map((participant) => {
    const payment = payments.get(participant.member_id);
    return {
      ...participant,
      payment_amount_vnd: payment?.amount_vnd ?? null,
      payment_due_vnd: payment?.amount_due_vnd ?? 0,
      payment_status: payment?.status ?? null,
    };
  });

  return {
    session,
    participants,
    expenses: expensesResult.data ?? [],
    expectedVnd: [...payments.values()].reduce((total, payment) => total + payment.amount_due_vnd, 0),
    collectedVnd: [...payments.values()].reduce((total, payment) => total + confirmedPaymentAmount(payment), 0),
    outstandingVnd: [...payments.values()].reduce((total, payment) => total + remainingPaymentDue(payment), 0),
    hasConfirmedPayments: [...payments.values()].some((payment) => payment.status === "paid"),
    confirmedPaymentsCount: [...payments.values()].filter((payment) => payment.status === "paid").length,
    unallocatedVnd: Math.max(
      (expensesResult.data ?? []).reduce((total, expense) => total + expense.amount_vnd, 0)
        - [...payments.values()].reduce((total, payment) => total + payment.amount_due_vnd, 0),
      0,
    ),
    expensesVnd: (expensesResult.data ?? []).reduce((total, expense) => total + expense.amount_vnd, 0),
  };
}

export async function getDashboardData() {
  const { supabase, team } = await requireAdminContext();
  const sessionsPromise = getSessions();
  const [sessions, members, paymentsResult, expensesResult] = await Promise.all([
    sessionsPromise,
    supabase.from("members").select("id").eq("team_id", team.id).eq("is_active", true),
    supabase.from("payments").select("session_id,amount_vnd,amount_due_vnd,status").eq("team_id", team.id),
    supabase.from("session_expenses").select("session_id,amount_vnd").eq("team_id", team.id),
  ]);

  if (members.error) throw new Error(`Could not load dashboard members: ${members.error.message}`);
  if (paymentsResult.error) throw new Error(`Could not load dashboard payments: ${paymentsResult.error.message}`);
  if (expensesResult.error) throw new Error(`Could not load dashboard expenses: ${expensesResult.error.message}`);

  const today = new Date().toISOString().slice(0, 10);
  const currentMonth = today.slice(0, 7);
  const monthlySessions = sessions.filter((session) => session.session_date.startsWith(currentMonth));
  const monthlyIds = new Set(monthlySessions.map((session) => session.id));
  const expensesVnd = (expensesResult.data ?? [])
    .filter((expense) => monthlyIds.has(expense.session_id))
    .reduce((sum, expense) => sum + expense.amount_vnd, 0);
  const expectedVnd = monthlySessions.reduce((sum, session) => sum + session.expected_vnd, 0);
  const collectedVnd = (paymentsResult.data ?? [])
    .filter((payment) => monthlyIds.has(payment.session_id) && payment.status === "paid")
    .reduce((sum, payment) => sum + confirmedPaymentAmount(payment), 0);
  const outstandingVnd = (paymentsResult.data ?? [])
    .filter((payment) => monthlyIds.has(payment.session_id))
    .reduce((sum, payment) => sum + remainingPaymentDue(payment), 0);

  return {
    team,
    sessions,
    nextSession: sessions
      .filter((session) => session.status === "scheduled" && session.session_date >= today)
      .sort((first, second) => first.session_date.localeCompare(second.session_date) || first.starts_at.localeCompare(second.starts_at))[0],
    activeMembers: members.data?.length ?? 0,
    expensesVnd,
    expectedVnd,
    collectedVnd,
    outstandingVnd,
  };
}

export async function getTeamSettings() {
  const { team } = await requireAdminContext();
  return team;
}
