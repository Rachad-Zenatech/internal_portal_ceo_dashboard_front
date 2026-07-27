// ─── Query key factory ────────────────────────────────────────────────────────
//
// All React Query cache keys live here so that invalidation calls in
// useBank.ts always reference the same key shapes as the queries.
//
// Usage:
//   queryKey: queryKeys.statement(id)
//   qc.invalidateQueries({ queryKey: queryKeys.statements() })

export const queryKeys = {
  companies:         ():                                                    unknown[] => ["companies"],
  companyEntities:   ():                                                    unknown[] => ["companies", "entities"],
  company:           (id: number):                                          unknown[] => ["companies", id],
  banks:             ():                                                    unknown[] => ["banks"],
  bank:              (id: number):                                          unknown[] => ["banks", id],
  bankAccounts:      (companyId?: number | null):                           unknown[] => ["bank-accounts", { companyId }],
  bankAccount:       (id: number):                                          unknown[] => ["bank-accounts", id],
  statements:        (accountId?: number | null):                           unknown[] => ["statements", { accountId }],
  statement:         (id: string):                                          unknown[] => ["statements", id],
  statementChecks:   (stmtId: string, section?: string | null):             unknown[] => ["statements", stmtId, "checks",   { section }],
  statementDeposits: (stmtId: string, section?: string | null):             unknown[] => ["statements", stmtId, "deposits", { section }],
  byQuarter:         (year: number, quarter: number, acctId?: number | null): unknown[] => ["statements", "by-quarter", { year, quarter, acctId }],
  quarterlySummary:  (year: number, companyId?: number | null, acctId?: number | null): unknown[] => ["statements", "quarterly", { year, companyId, acctId }],
  summary:           (period: string, year: number, companyId?: number | null, acctId?: number | null): unknown[] => ["statements", "summary", { period, year, companyId, acctId }],
};
