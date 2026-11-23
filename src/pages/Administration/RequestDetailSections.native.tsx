import { View, Text, StyleSheet } from "react-native";
import { getPoSummary, getRequestDescription, getRequestTitle, isUrgentRequest } from "./requestDetailHelpers";

export function UrgentNativeBadge({ request }: { request: any }) {
  if (!isUrgentRequest(request)) return null;
  return (
    <View style={styles.urgentBadge}>
      <Text style={styles.urgentBadgeText}>URGENT</Text>
    </View>
  );
}

export function RequestOverviewAndPoNativeSection({ request }: { request: any }) {
  const title = getRequestTitle(request);
  const description = getRequestDescription(request);
  const po = getPoSummary(request);

  return (
    <>
      <View style={styles.section}>
        <Text style={styles.heading}>TITLE</Text>
        <Text style={styles.titleText}>{title}</Text>
        <Text style={[styles.heading, styles.subHeading]}>DESCRIPTION</Text>
        <Text style={styles.bodyText}>{description || "No description provided."}</Text>
      </View>

      <View style={styles.section}>
        <Text style={styles.heading}>PURCHASE ORDER (PO)</Text>
        <View style={styles.row}>
          <Text style={styles.rowLabel}>PO #:</Text>
          <Text style={styles.rowVal}>{po.poNumber}</Text>
        </View>
        {po.quoteRef && (
          <View style={styles.row}>
            <Text style={styles.rowLabel}>Quote / PO Ref:</Text>
            <Text style={styles.rowVal}>{po.quoteRef}</Text>
          </View>
        )}
        {po.vendor && (
          <View style={styles.row}>
            <Text style={styles.rowLabel}>Vendor:</Text>
            <Text style={styles.rowVal}>{po.vendor}</Text>
          </View>
        )}
        {po.status && (
          <View style={styles.row}>
            <Text style={styles.rowLabel}>PO Status:</Text>
            <Text style={styles.rowVal}>{po.status.toUpperCase()}</Text>
          </View>
        )}
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  urgentBadge: {
    alignSelf: "flex-start",
    backgroundColor: "#fef2f2",
    borderColor: "#fca5a5",
    borderWidth: 1,
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
    marginTop: 4,
  },
  urgentBadgeText: {
    fontSize: 10,
    fontWeight: "700",
    color: "#b91c1c",
  },
  section: {
    marginBottom: 16,
    padding: 12,
    borderRadius: 10,
    backgroundColor: "#f8fafc",
    borderWidth: 1,
    borderColor: "#e2e8f0",
  },
  heading: {
    fontSize: 11,
    fontWeight: "700",
    color: "#64748b",
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  subHeading: {
    marginTop: 10,
  },
  titleText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#0f172a",
  },
  bodyText: {
    fontSize: 13,
    color: "#334155",
    lineHeight: 19,
  },
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 6,
  },
  rowLabel: {
    fontSize: 12,
    color: "#64748b",
  },
  rowVal: {
    fontSize: 12,
    fontWeight: "600",
    color: "#0f172a",
  },
});
