export type IngestionBudgetPolicy = {
  monthlyBudgetUsd: number;
  cadenceMinutes: number;
  postReadCostUsd: number;
  userReadCostUsd: number;
  estPostsPerAccountPerRun: number;
  estUserReadsPerAccountPerRun: number;
};

export type BudgetEstimate = {
  activeAccounts: number;
  estimatedCostPerRunUsd: number;
  projectedMonthlyCostUsd: number;
  projectedDailyCostUsd: number;
  minimumCadenceMinutes: number;
  blocked: boolean;
};

function parseNumber(value: string | undefined, fallback: number) {
  if (!value) return fallback;
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function round(value: number, digits = 4) {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

export function getBudgetPolicy(): IngestionBudgetPolicy {
  return {
    monthlyBudgetUsd: parseNumber(process.env.INGEST_MONTHLY_BUDGET_USD, 350),
    cadenceMinutes: Math.max(1, parseNumber(process.env.INGEST_CADENCE_MINUTES, 60)),
    postReadCostUsd: parseNumber(process.env.INGEST_POST_READ_COST_USD, 0.005),
    userReadCostUsd: parseNumber(process.env.INGEST_USER_READ_COST_USD, 0.01),
    estPostsPerAccountPerRun: Math.max(0, parseNumber(process.env.INGEST_EST_POSTS_PER_ACCOUNT_PER_RUN, 10)),
    estUserReadsPerAccountPerRun: Math.max(0, parseNumber(process.env.INGEST_EST_USER_READS_PER_ACCOUNT_PER_RUN, 0)),
  };
}

export function estimateBudgetForAccounts(activeAccounts: number, policy = getBudgetPolicy()): BudgetEstimate {
  const perAccountCost =
    policy.estPostsPerAccountPerRun * policy.postReadCostUsd +
    policy.estUserReadsPerAccountPerRun * policy.userReadCostUsd;

  const estimatedCostPerRunUsd = round(activeAccounts * perAccountCost, 6);

  if (estimatedCostPerRunUsd <= 0) {
    return {
      activeAccounts,
      estimatedCostPerRunUsd,
      projectedMonthlyCostUsd: 0,
      projectedDailyCostUsd: 0,
      minimumCadenceMinutes: policy.cadenceMinutes,
      blocked: false,
    };
  }

  const runsPerMonth = (30 * 24 * 60) / policy.cadenceMinutes;
  const projectedMonthlyCostUsd = round(estimatedCostPerRunUsd * runsPerMonth, 2);
  const projectedDailyCostUsd = round(projectedMonthlyCostUsd / 30, 2);
  const minimumCadenceMinutes = Math.max(
    1,
    Math.ceil((estimatedCostPerRunUsd * 30 * 24 * 60) / Math.max(policy.monthlyBudgetUsd, 0.01))
  );

  return {
    activeAccounts,
    estimatedCostPerRunUsd,
    projectedMonthlyCostUsd,
    projectedDailyCostUsd,
    minimumCadenceMinutes,
    blocked: projectedMonthlyCostUsd > policy.monthlyBudgetUsd,
  };
}

export function cadenceLabelForAccounts(activeAccounts: number, policy = getBudgetPolicy()) {
  const estimate = estimateBudgetForAccounts(activeAccounts, policy);
  return `Cadence ${policy.cadenceMinutes}m · est $${estimate.projectedMonthlyCostUsd.toFixed(
    2
  )}/mo · budget $${policy.monthlyBudgetUsd.toFixed(2)} · min cadence ${estimate.minimumCadenceMinutes}m`;
}
