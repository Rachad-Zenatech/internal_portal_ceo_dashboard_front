import CustomBoard from "@/components/Customize/CustomBoard";
import { REAL_ESTATE_DEFAULTS } from "@/lib/boardDefaults";

export default function CustomizeRealEstate() {
  return (
    <CustomBoard
      boardKey="real_estate"
      title="Customize - Real Estate"
      subtitle="Build your own Real Estate portfolio dashboard from live property, location, and unit data."
      defaults={REAL_ESTATE_DEFAULTS}
    />
  );
}
