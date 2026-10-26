const MAX_SAFE_VND = BigInt(Number.MAX_SAFE_INTEGER);

export type CostShare = {
  participantId: string;
  amountVnd: number;
};

export type CostShareResult = {
  totalVnd: number;
  allocatedVnd: number;
  unallocatedVnd: number;
  allocations: CostShare[];
};

export function calculateEqualCostShares(
  expenseAmountsVnd: readonly number[],
  participantIds: readonly string[],
): CostShareResult {
  let total = BigInt(0);
  for (const amount of expenseAmountsVnd) {
    if (!Number.isSafeInteger(amount) || amount < 0) {
      throw new RangeError("Expense amounts must be non-negative safe integer VND values.");
    }
    total += BigInt(amount);
    if (total > MAX_SAFE_VND) {
      throw new RangeError("Total expenses exceed the safe integer VND limit.");
    }
  }

  const seen = new Set<string>();
  for (const participantId of participantIds) {
    if (!participantId.trim()) {
      throw new TypeError("Participant IDs must not be empty.");
    }
    if (seen.has(participantId)) {
      throw new TypeError(`Duplicate participant ID: ${participantId}`);
    }
    seen.add(participantId);
  }

  const sortedIds = [...participantIds].sort();
  if (sortedIds.length === 0) {
    return {
      totalVnd: Number(total),
      allocatedVnd: 0,
      unallocatedVnd: Number(total),
      allocations: [],
    };
  }

  const count = BigInt(sortedIds.length);
  const baseShare = total / count;
  const remainder = total % count;
  const allocations = sortedIds.map((participantId, index) => ({
    participantId,
    amountVnd: Number(baseShare + (BigInt(index) < remainder ? BigInt(1) : BigInt(0))),
  }));
  const allocated = allocations.reduce((sum, allocation) => sum + BigInt(allocation.amountVnd), BigInt(0));

  return {
    totalVnd: Number(total),
    allocatedVnd: Number(allocated),
    unallocatedVnd: Number(total - allocated),
    allocations,
  };
}
