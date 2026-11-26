import CustomBoard from "@/components/Customize/CustomBoard";
import { FINANCE_DEFAULTS } from "@/lib/boardDefaults";

export default function CustomizeFinance() {
  return (
    <CustomBoard
      boardKey="finance"
      title="Customize - Finance"
      subtitle="Build your own financial dashboard from live ledger, treasury, and enterprise finance data."
      defaults={FINANCE_DEFAULTS}
    />
  );
}
