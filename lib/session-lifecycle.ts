export type SessionStatus = "scheduled" | "completed" | "cancelled";

export function sessionStatusAfterSave(sessionDate: string, today: string, currentStatus?: SessionStatus): SessionStatus {
  if (currentStatus === "completed" || currentStatus === "cancelled") return currentStatus;
  return sessionDate < today ? "completed" : "scheduled";
}
