import CustomBoard from "@/components/Customize/CustomBoard";
import { DASHBOARD_DEFAULTS } from "@/lib/boardDefaults";

export default function Customization() {
  return (
    <CustomBoard
      boardKey="dashboard"
      title="Customization"
      subtitle="Build your own dashboard from any live data source."
      defaults={DASHBOARD_DEFAULTS}
    />
  );
}
