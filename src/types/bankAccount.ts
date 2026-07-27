export interface BankAccount {
    id: number;
    bank_id: number;
    company_id: number;
    last_4: string;
    notes: string;
}

export interface BankAccounts {
    bankAccounts: BankAccount[];
}