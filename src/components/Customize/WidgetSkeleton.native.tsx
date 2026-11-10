import { useEffect, useState } from "react";
import { Animated, View, StyleSheet } from "react-native";
import type { DimensionValue, StyleProp, ViewStyle } from "react-native";
import type { WidgetKind } from "@/types/customize";

function Block({ width, height, radius = 8, style }: { width?: DimensionValue; height: number; radius?: number; style?: StyleProp<ViewStyle> }) {
  const [opacity] = useState(() => new Animated.Value(0.45));
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, { toValue: 1, duration: 700, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 0.45, duration: 700, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [opacity]);
  return <Animated.View style={[{ width, height, borderRadius: radius, backgroundColor: "#e2e8f0", opacity }, style]} />;
}

const BAR_HEIGHTS = [60, 110, 80, 130, 55, 95, 75];
const ROW_WIDTHS: DimensionValue[] = ["90%", "72%", "58%", "44%", "32%"];

/** Placeholder shaped like the widget that is loading. */
export default function WidgetSkeleton({ kind }: { kind: WidgetKind }) {
  switch (kind) {
    case "kpi":
      return (
        <View style={[s.pad, { gap: 12 }]} accessibilityLabel="Loading">
          <Block width={120} height={32} radius={10} />
          <Block width={170} height={13} radius={6} />
        </View>
      );
    case "gauge":
      return (
        <View style={[s.pad, s.center, { gap: 12 }]} accessibilityLabel="Loading">
          <Block width={170} height={85} radius={85} />
          <Block width={110} height={13} radius={6} />
        </View>
      );
    case "pie":
      return (
        <View style={[s.pad, s.center]} accessibilityLabel="Loading">
          <Block width={130} height={130} radius={65} />
        </View>
      );
    case "table":
      return (
        <View style={[s.pad, { gap: 8 }]} accessibilityLabel="Loading">
          <Block height={26} radius={6} />
          {[0, 1, 2, 3, 4].map((i) => <Block key={i} height={18} radius={5} />)}
        </View>
      );
    case "ranking":
    case "hbar":
      return (
        <View style={[s.pad, { gap: 14 }]} accessibilityLabel="Loading">
          {ROW_WIDTHS.map((w, i) => (
            <View key={i} style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
              <Block width={56} height={12} radius={5} />
              <Block width={w} height={14} radius={6} style={{ flexShrink: 1 }} />
            </View>
          ))}
        </View>
      );
    case "note":
      return (
        <View style={[s.pad, { gap: 8 }]} accessibilityLabel="Loading">
          <Block height={14} radius={5} />
          <Block width="90%" height={14} radius={5} />
          <Block width="60%" height={14} radius={5} />
        </View>
      );
    default:
      return (
        <View style={[s.pad, { flexDirection: "row", alignItems: "flex-end", gap: 8, height: 170 }]} accessibilityLabel="Loading">
          {BAR_HEIGHTS.map((h, i) => <Block key={i} height={h} radius={6} style={{ flex: 1 }} />)}
        </View>
      );
  }
}

const s = StyleSheet.create({
  pad: { padding: 16 },
  center: { alignItems: "center", justifyContent: "center" },
});
