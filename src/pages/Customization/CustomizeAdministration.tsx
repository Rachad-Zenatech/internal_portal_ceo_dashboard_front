import CustomBoard from "@/components/Customize/CustomBoard";
import { ADMIN_DEFAULTS } from "@/lib/boardDefaults";

export default function CustomizeAdministration() {
  return (
    <CustomBoard
      boardKey="admin"
      title="Customize Administration"
      subtitle="Arrange approvals and delegation data your way: pick columns, charts and data sources."
      defaults={ADMIN_DEFAULTS}
    />
  );
}
