import { useMemo, useState } from "react";
import { View, Text, ScrollView, TouchableOpacity, RefreshControl, Alert, StyleSheet } from "react-native";
import { SafeAreaView } from "@/components/native";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import type { NavigationProp } from "@react-navigation/native";
import { useIsFetching, useQueryClient } from "@tanstack/react-query";
import WidgetRenderer from "@/components/Customize/WidgetRenderer";
import WidgetPanel from "@/components/Customize/WidgetPanel";
import WidgetSkeleton from "@/components/Customize/WidgetSkeleton";
import { useBoardState, newWidgetId, orderedWidgets } from "@/hooks/useBoardState";
import { getDataSource } from "@/lib/dataSources";
import { blankWidget } from "@/lib/widgetLogic";
import type { BoardState, WidgetConfig } from "@/types/customize";

interface Props {
  boardKey: string;
  title: string;
  subtitle: string;
  defaults: BoardState;
}

const ACCENT = "#4f46e5";

function filterTag(w: WidgetConfig): string | null {
  if (!w.filter?.value) return null;
  const col = getDataSource(w.sourceId)?.columns.find((c) => c.key === w.filter!.column);
  return `${col?.label ?? w.filter.column}: ${w.filter.value}`;
}

/** Phone layout: one column, in the same order as the desktop grid (top to bottom, left to right). */
export default function CustomBoard({ boardKey, title, subtitle, defaults }: Props) {
  const navigation = useNavigation<NavigationProp<Record<string, undefined>>>();
  const queryClient = useQueryClient();
  const { state, status, loadFailed, retrySave, addWidget, updateWidget, removeWidget, moveWidget, reset } = useBoardState(boardKey, defaults);

  const [editMode, setEditMode] = useState(false);
  const [panelWidget, setPanelWidget] = useState<WidgetConfig | null>(null);
  const [panelIsNew, setPanelIsNew] = useState(false);
  const [panelOpen, setPanelOpen] = useState(false);

  const widgets = useMemo(() => (state ? orderedWidgets(state) : []), [state]);
  // Data-source queries are keyed [namespace, "ds", id]: refreshing them is a pull-to-refresh on this page.
  const isRefreshing = useIsFetching({ predicate: (q) => q.queryKey[1] === "ds" }) > 0;
  const refresh = () => queryClient.invalidateQueries({ predicate: (q) => q.queryKey[1] === "ds" });

  const openNew = () => {
    setPanelWidget(blankWidget(newWidgetId()));
    setPanelIsNew(true);
    setPanelOpen(true);
  };
  const openEdit = (w: WidgetConfig) => {
    setPanelWidget(w);
    setPanelIsNew(false);
    setPanelOpen(true);
  };
  const confirmDelete = (w: WidgetConfig) =>
    Alert.alert("Delete widget?", `"${w.title}" will be removed from this page.`, [
      { text: "Cancel", style: "cancel" },
      { text: "Delete", style: "destructive", onPress: () => removeWidget(w.id) },
    ]);
  const confirmReset = () =>
    Alert.alert("Reset this page?", "It goes back to the default layout. Your changes will be removed.", [
      { text: "Cancel", style: "cancel" },
      { text: "Reset", style: "destructive", onPress: () => void reset() },
    ]);

  const saveLabel =
    status === "saving" ? "Saving…" : status === "saved" ? "Saved to your account" : status === "error" ? "Couldn't save your changes" : loadFailed ? "Showing defaults" : "";

  return (
    <SafeAreaView style={s.screen}>
      <View style={s.topBar}>
        <TouchableOpacity onPress={() => (navigation.canGoBack() ? navigation.goBack() : navigation.navigate("Dashboard"))} style={s.iconBtn} accessibilityLabel="Back">
          <Ionicons name="arrow-back" size={22} color="#0f172a" />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={s.title} numberOfLines={1}>{title}</Text>
          <Text style={s.subtitle} numberOfLines={1}>{subtitle}</Text>
        </View>
        <TouchableOpacity onPress={() => setEditMode((v) => !v)} disabled={!state} style={[s.editBtn, editMode && s.editBtnOn, !state && { opacity: 0.4 }]}>
          <Ionicons name={editMode ? "checkmark" : "create-outline"} size={16} color={editMode ? "#ffffff" : ACCENT} />
          <Text style={[s.editText, editMode && { color: "#ffffff" }]}>{editMode ? "Done" : "Customize"}</Text>
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={s.content} refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={refresh} />}>
        {saveLabel ? (
          <Text style={[s.status, status === "error" && { color: "#dc2626" }]}>
            {saveLabel}
            {status === "error" ? <Text style={s.link} onPress={retrySave}>  Retry</Text> : null}
          </Text>
        ) : null}

        {editMode && (
          <View style={s.editBar}>
            <TouchableOpacity style={s.addBtn} onPress={openNew}><Ionicons name="add" size={18} color="#ffffff" /><Text style={s.addText}>Add widget</Text></TouchableOpacity>
            <TouchableOpacity style={s.resetBtn} onPress={confirmReset}><Ionicons name="refresh" size={16} color="#334155" /><Text style={s.resetText}>Reset</Text></TouchableOpacity>
          </View>
        )}

        {!state ? (
          <View style={{ gap: 12 }} accessibilityLabel="Loading your layout">
            {(["kpi", "bar", "table"] as const).map((k) => <View key={k} style={s.card}><WidgetSkeleton kind={k} /></View>)}
          </View>
        ) : widgets.length === 0 ? (
          <View style={s.emptyBox}>
            <Text style={s.emptyText}>This page is empty. Add your first widget to get started.</Text>
            <TouchableOpacity style={s.addBtn} onPress={() => { setEditMode(true); openNew(); }}><Ionicons name="add" size={18} color="#ffffff" /><Text style={s.addText}>Add widget</Text></TouchableOpacity>
          </View>
        ) : (
          widgets.map((w, i) => {
            const tag = filterTag(w);
            return (
              <View key={w.id} style={s.card}>
                <View style={s.cardHead}>
                  <View style={{ flex: 1 }}>
                    <Text style={s.cardTitle} numberOfLines={1}>{w.title}</Text>
                    {tag ? <Text style={s.tag} numberOfLines={1}>{tag}</Text> : null}
                  </View>
                  {editMode && (
                    <View style={{ flexDirection: "row" }}>
                      <TouchableOpacity disabled={i === 0} onPress={() => moveWidget(w.id, -1)} style={[s.iconBtn, i === 0 && { opacity: 0.3 }]} accessibilityLabel={`Move ${w.title} up`}><Ionicons name="arrow-up" size={18} color="#334155" /></TouchableOpacity>
                      <TouchableOpacity disabled={i === widgets.length - 1} onPress={() => moveWidget(w.id, 1)} style={[s.iconBtn, i === widgets.length - 1 && { opacity: 0.3 }]} accessibilityLabel={`Move ${w.title} down`}><Ionicons name="arrow-down" size={18} color="#334155" /></TouchableOpacity>
                      <TouchableOpacity onPress={() => openEdit(w)} style={s.iconBtn} accessibilityLabel={`Edit ${w.title}`}><Ionicons name="create-outline" size={18} color={ACCENT} /></TouchableOpacity>
                      <TouchableOpacity onPress={() => confirmDelete(w)} style={s.iconBtn} accessibilityLabel={`Delete ${w.title}`}><Ionicons name="trash-outline" size={18} color="#dc2626" /></TouchableOpacity>
                    </View>
                  )}
                </View>
                <WidgetRenderer widget={w} />
              </View>
            );
          })
        )}
      </ScrollView>

      <WidgetPanel open={panelOpen} onOpenChange={setPanelOpen} widget={panelWidget} isNew={panelIsNew} onSave={(w) => (panelIsNew ? addWidget(w) : updateWidget(w))} />
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#f8fafc" },
  topBar: { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 8, paddingVertical: 10, backgroundColor: "#ffffff", borderBottomWidth: 1, borderBottomColor: "#e2e8f0" },
  iconBtn: { width: 44, height: 44, alignItems: "center", justifyContent: "center" },
  title: { fontSize: 18, fontWeight: "700", color: "#0f172a" },
  subtitle: { fontSize: 12, color: "#64748b" },
  editBtn: { flexDirection: "row", alignItems: "center", gap: 6, minHeight: 40, paddingHorizontal: 14, borderRadius: 12, borderWidth: 1, borderColor: ACCENT },
  editBtnOn: { backgroundColor: ACCENT },
  editText: { fontSize: 13, fontWeight: "700", color: ACCENT },
  content: { padding: 16, gap: 14, paddingBottom: 48 },
  status: { fontSize: 12, color: "#64748b" },
  link: { color: ACCENT, textDecorationLine: "underline" },
  editBar: { flexDirection: "row", gap: 10 },
  addBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, minHeight: 46, paddingHorizontal: 18, borderRadius: 14, backgroundColor: ACCENT },
  addText: { color: "#ffffff", fontWeight: "700", fontSize: 14 },
  resetBtn: { flexDirection: "row", alignItems: "center", gap: 6, minHeight: 46, paddingHorizontal: 16, borderRadius: 14, borderWidth: 1, borderColor: "#cbd5e1", backgroundColor: "#ffffff" },
  resetText: { color: "#334155", fontWeight: "600", fontSize: 14 },
  card: { backgroundColor: "#ffffff", borderRadius: 18, borderWidth: 1, borderColor: "#e2e8f0", overflow: "hidden" },
  cardHead: { flexDirection: "row", alignItems: "center", paddingLeft: 16, paddingRight: 4, paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: "#f1f5f9" },
  cardTitle: { fontSize: 14, fontWeight: "600", color: "#0f172a" },
  tag: { fontSize: 11, color: "#64748b", marginTop: 1 },
  emptyBox: { alignItems: "center", gap: 14, padding: 32, borderWidth: 1, borderStyle: "dashed", borderColor: "#cbd5e1", borderRadius: 18 },
  emptyText: { fontSize: 13, color: "#64748b", textAlign: "center" },
});
