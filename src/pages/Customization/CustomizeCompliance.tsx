import CustomBoard from "@/components/Customize/CustomBoard";
import { COMPLIANCE_DEFAULTS } from "@/lib/boardDefaults";

export default function CustomizeCompliance() {
  return (
    <CustomBoard
      boardKey="compliance"
      title="Customize - Social Compliance"
      subtitle="Build your own compliance dashboard from approved content and live Public Mood trends."
      defaults={COMPLIANCE_DEFAULTS}
    />
  );
}
