import CustomBoard from "@/components/Customize/CustomBoard";
import { MA_DEFAULTS } from "@/lib/boardDefaults";

export default function CustomizeMA() {
  return (
    <CustomBoard
      boardKey="ma"
      title="Customize - M&A"
      subtitle="Arrange the M&A pipeline your way: pick columns, charts and data sources."
      defaults={MA_DEFAULTS}
    />
  );
}
