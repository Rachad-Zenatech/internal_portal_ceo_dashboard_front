import { Modal, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { getAuditSourceLabel } from "./auditLogSources";

interface AuditLogDetailModalProps {
  log: {
    action?: string;
    created_at?: string;
    source_service?: string;
    actor_name?: string;
    actor_email?: string;
    entity_type?: string;
    entity_id?: string;
    target_entity?: string;
    result?: string;
    details?: any;
  } | null;
  onClose: () => void;
}

export function AuditLogDetailModal({ log, onClose }: AuditLogDetailModalProps) {
  return (
    <Modal visible={log !== null} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.modalOverlay}>
        <View style={styles.modalCard}>
          <View style={styles.modalHeader}>
            <View style={styles.modalHeaderLeft}>
              <View style={styles.modalIconBox}>
                <MaterialCommunityIcons name="code-json" size={24} color="#2563eb" />
              </View>
              <View style={styles.modalHeaderTitles}>
                <Text style={styles.modalLogAction} numberOfLines={1}>
                  {log?.action}
                </Text>
                <Text style={styles.modalSub}>
                  {log?.created_at ? new Date(log.created_at).toLocaleString() : "-"}
                </Text>
              </View>
            </View>

            <TouchableOpacity style={styles.modalCloseBtn} onPress={onClose}>
              <Ionicons name="close" size={22} color="#64748b" />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.modalBody}>
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Application:</Text>
              <Text style={styles.detailValue}>{getAuditSourceLabel(log?.source_service)}</Text>
            </View>

            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Actor:</Text>
              <Text style={styles.detailValue}>
                {log?.actor_name || "System"} ({log?.actor_email || "N/A"})
              </Text>
            </View>

            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Target Entity:</Text>
              <Text style={styles.detailValue}>
                {log?.entity_type} #{log?.entity_id || log?.target_entity || "-"}
              </Text>
            </View>

            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Result Status:</Text>
              <Text
                style={[
                  styles.detailValue,
                  { color: log?.result === "SUCCESS" ? "#16a34a" : "#2563eb" },
                ]}
              >
                {log?.result || "COMPLETED"}
              </Text>
            </View>

            <Text style={styles.payloadTitle}>Full Audit Payload & Context:</Text>
            <View style={styles.jsonCodeBox}>
              <Text style={styles.jsonCodeText}>{JSON.stringify(log?.details || log, null, 2)}</Text>
            </View>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(15, 23, 42, 0.55)",
    justifyContent: "flex-end",
  },
  modalCard: {
    backgroundColor: "#ffffff",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: "82%",
    paddingBottom: 24,
  },
  modalHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: "#e2e8f0",
  },
  modalHeaderLeft: { flexDirection: "row", alignItems: "center", gap: 12, flex: 1 },
  modalIconBox: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: "#eff6ff",
    alignItems: "center",
    justifyContent: "center",
  },
  modalHeaderTitles: { flex: 1 },
  modalLogAction: { fontSize: 16, fontWeight: "700", color: "#0f172a" },
  modalSub: { fontSize: 12, color: "#64748b", marginTop: 2 },
  modalCloseBtn: { padding: 6 },
  modalBody: { paddingHorizontal: 20, paddingTop: 16 },
  detailRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: "#f1f5f9",
    gap: 12,
  },
  detailLabel: { fontSize: 13, fontWeight: "600", color: "#64748b" },
  detailValue: { fontSize: 13, fontWeight: "500", color: "#0f172a", flex: 1, textAlign: "right" },
  payloadTitle: { fontSize: 13, fontWeight: "700", color: "#334155", marginTop: 16, marginBottom: 8 },
  jsonCodeBox: {
    backgroundColor: "#0f172a",
    borderRadius: 12,
    padding: 14,
    marginBottom: 20,
  },
  jsonCodeText: { color: "#e2e8f0", fontSize: 12, fontFamily: "monospace" },
});
