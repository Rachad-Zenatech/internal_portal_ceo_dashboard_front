export interface ChartOfAccount {
    id?: number;
    account_number: string;
    account_type: string;
    detail_type: string;
    account_name: string;
    is_active: boolean;
}

export interface ChartOfAccounts {
    chart_of_accounts: ChartOfAccount[];
}
