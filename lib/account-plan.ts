export const BILLING_ENABLED = false;
export const SUBSCRIPTION_PLANS_VISIBLE = BILLING_ENABLED;

export const ACCOUNT_PLANS = {
  free: {
    id: "free",
    name: "免費方案",
    childLimit: 1,
    billingPeriod: null,
    priceTwd: 0,
  },
  family_monthly: {
    id: "family_monthly",
    name: "家庭方案（月繳）",
    childLimit: 3,
    billingPeriod: "month",
    priceTwd: 49,
  },
  family_yearly: {
    id: "family_yearly",
    name: "家庭方案（年繳）",
    childLimit: 3,
    billingPeriod: "year",
    priceTwd: 490,
  },
} as const;

export type AccountPlanId = keyof typeof ACCOUNT_PLANS;

export function normalizeAccountPlan(value: string | null | undefined): AccountPlanId {
  return value === "family_monthly" || value === "family_yearly" ? value : "free";
}

export function accountPlanDetails(value: string | null | undefined) {
  return ACCOUNT_PLANS[normalizeAccountPlan(value)];
}
