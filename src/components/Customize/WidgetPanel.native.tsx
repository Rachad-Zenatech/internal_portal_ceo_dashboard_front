import { useEffect, useState } from "react";
import { Modal, View, Text, ScrollView, TextInput, TouchableOpacity, Pressable, StyleSheet, KeyboardAvoidingView, Platform } from "react-native";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import WidgetRenderer from "@/components/Customize/WidgetRenderer";
import { useWidgetDraft } from "@/hooks/useWidgetDraft";
import { DATA_SOURCES, MODULE_LABELS } from "@/lib/dataSources";
import { KIND_INFO, KIND_ORDER, decodeMeasure, encodeMeasure, firstExample, friendlyType } from "@/lib/widgetLogic";
import type { WidgetConfig, WidgetKind } from "@/types/customize";

type IconName = React.ComponentProps<typeof MaterialCommunityIcons>["name"];

const KIND_ICONS: Record<WidgetKind, IconName> = {
  table: "table",
  kpi: "numeric",
  bar: "chart-bar",
  hbar: "poll",
  line: "chart-line",
  area: "chart-areaspline",
  pie: "chart-donut",
  ranking: "format-list-numbered",
  gauge: "gauge",
  note: "note-text-outline",
};

const ITEM_WORD: Partial<Record<WidgetKind, string>> = { bar: "bar", hbar: "bar", line: "point", area: "point", pie: "slice", ranking: "row" };
const ANY = "__any__";
const ACCENT = "#4f46e5";

interface Option {
  value: string;
  label: string;
}

/** A dropdown that opens a list in a sheet: easier to tap than a native <select> on a phone. */
function PickerField({ label, value, options, onSelect, placeholder }: { label: string; value?: string; options: Option[]; onSelect: (v: string) => void; placeholder?: string }) {
  const [open, setOpen] = useState(false);
  const current = options.find((o) => o.value === value);
  return (
    <View style={{ gap: 6 }}>
      <Text style={s.fieldLabel}>{label}</Text>
      <TouchableOpacity style={s.picker} onPress={() => setOpen(true)} accessibilityRole="button" accessibilityLabel={label}>
        <Text numberOfLines={1} style={[s.pickerText, !current && { color: "#94a3b8" }]}>{current?.label ?? placeholder ?? "Choose…"}</Text>
        <Ionicons name="chevron-down" size={18} color="#64748b" />
      </TouchableOpacity>
      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <Pressable style={s.backdrop} onPress={() => setOpen(false)}>
          <Pressable style={s.listSheet} onPress={() => undefined}>
            <Text style={s.listTitle}>{label}</Text>
            <ScrollView>
              {options.map((o) => (
                <TouchableOpacity key={o.value} style={s.listRow} onPress={() => { onSelect(o.value); setOpen(false); }}>
                  <Text style={[s.listRowText, o.value === value && { color: ACCENT, fontWeight: "600" }]}>{o.label}</Text>
                  {o.value === value && <Ionicons name="checkmark" size={18} color={ACCENT} />}
                </TouchableOpacity>
              ))}
              {options.length === 0 && <Text style={s.empty}>Nothing to choose from yet.</Text>}
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

function Step({ n, title, hint, children }: { n: number; title: string; hint?: string; children: React.ReactNode }) {
  return (
    <View style={{ gap: 12 }}>
      <View style={{ flexDirection: "row", gap: 10, alignItems: "flex-start" }}>
        <View style={s.stepNum}><Text style={s.stepNumText}>{n}</Text></View>
        <View style={{ flex: 1 }}>
          <Text style={s.stepTitle}>{title}</Text>
          {hint ? <Text style={s.hint}>{hint}</Text> : null}
        </View>
      </View>
      <View style={{ gap: 12 }}>{children}</View>
    </View>
  );
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  widget: WidgetConfig | null;
  isNew: boolean;
  onSave: (widget: WidgetConfig) => void;
}

export default function WidgetPanel({ open, onOpenChange, widget, isNew, onSave }: Props) {
  const [columnSearch, setColumnSearch] = useState("");
  const {
    draft, patch, setTitle, source, allRows, kind, info, measures, filterCols, filterValues,
    changeSource, changeKind, selected, labelOf, moveColumn, addColumn, removeColumn, availableColumns, canSave, finished,
  } = useWidgetDraft(widget, isNew);
  useEffect(() => setColumnSearch(""), [widget]);

  if (!draft) return null;
  const available = availableColumns(columnSearch);
  const showFilter = kind !== "note" && filterCols.length > 0;

  return (
    <Modal visible={open} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => onOpenChange(false)}>
      <KeyboardAvoidingView style={s.screen} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <View style={s.header}>
          <View style={{ flex: 1 }}>
            <Text style={s.title}>{isNew ? "Add a widget" : "Edit widget"}</Text>
            <Text style={s.hint}>Choose your data, how to show it, then fine-tune.</Text>
          </View>
          <TouchableOpacity onPress={() => onOpenChange(false)} style={s.close} accessibilityLabel="Close"><Ionicons name="close" size={22} color="#334155" /></TouchableOpacity>
        </View>

        <ScrollView contentContainerStyle={s.body} keyboardShouldPersistTaps="handled">
          <View style={s.preview}><WidgetRenderer widget={draft} /></View>

          <Step n={1} title="What do you want to show?" hint="Pick where the numbers come from. They are always live.">
            {Object.entries(MODULE_LABELS).map(([module, label]) => {
              const items = DATA_SOURCES.filter((src) => src.module === module);
              if (items.length === 0) return null;
              return (
                <View key={module} style={{ gap: 6 }}>
                  <Text style={s.group}>{label.toUpperCase()}</Text>
                  {items.map((src) => (
                    <TouchableOpacity key={src.id} onPress={() => changeSource(src.id)} style={[s.card, draft.sourceId === src.id && s.cardOn]} accessibilityState={{ selected: draft.sourceId === src.id }}>
                      <Text style={s.cardTitle}>{src.label}</Text>
                      <Text style={s.hint}>{src.description}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              );
            })}
          </Step>

          <Step n={2} title="How should it look?">
            <View style={s.grid}>
              {KIND_ORDER.map((k) => (
                <TouchableOpacity key={k} onPress={() => changeKind(k)} style={[s.kind, kind === k && s.cardOn]} accessibilityState={{ selected: kind === k }}>
                  <MaterialCommunityIcons name={KIND_ICONS[k]} size={22} color={ACCENT} />
                  <Text style={s.cardTitle}>{KIND_INFO[k].label}</Text>
                  <Text style={s.hint} numberOfLines={2}>{KIND_INFO[k].hint}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </Step>

          {kind !== "note" ? (
            <Step n={3} title="Set it up">
              {info.needsGroup && source && (
                <PickerField
                  label={`Show one ${ITEM_WORD[kind] ?? "item"} for each…`}
                  value={draft.dimension}
                  options={source.columns.map((c) => ({ value: c.key, label: c.label }))}
                  onSelect={(v) => patch({ dimension: v })}
                />
              )}
              {info.needsMeasure && (
                <PickerField
                  label={kind === "kpi" || kind === "gauge" ? "What should it show?" : "How big should each one be?"}
                  value={encodeMeasure(draft)}
                  options={measures}
                  onSelect={(v) => patch(decodeMeasure(v))}
                />
              )}
              {kind === "gauge" && (
                <View style={{ gap: 6 }}>
                  <Text style={s.fieldLabel}>Your goal</Text>
                  <TextInput style={s.input} keyboardType="numeric" placeholder="e.g. 100000" value={draft.target === undefined ? "" : String(draft.target)} onChangeText={(t) => patch({ target: t.trim() === "" || Number.isNaN(Number(t)) ? undefined : Number(t) })} />
                  <Text style={s.hint}>The bar fills as the figure gets closer to this number.</Text>
                </View>
              )}
              {kind === "table" && source && (
                <View style={{ gap: 12 }}>
                  <View style={{ gap: 6 }}>
                    <Text style={s.fieldLabel}>Columns showing ({selected.length})</Text>
                    {selected.length === 0 ? (
                      <Text style={s.emptyBox}>Nothing yet. Add at least one column below.</Text>
                    ) : (
                      <View style={s.list}>
                        {selected.map((key, i) => (
                          <View key={key} style={s.selRow}>
                            <Text style={s.selName} numberOfLines={1}>{labelOf(key)}</Text>
                            <TouchableOpacity disabled={i === 0} onPress={() => moveColumn(i, -1)} style={[s.iconBtn, i === 0 && s.disabled]} accessibilityLabel={`Move ${labelOf(key)} up`}><Ionicons name="arrow-up" size={18} color="#334155" /></TouchableOpacity>
                            <TouchableOpacity disabled={i === selected.length - 1} onPress={() => moveColumn(i, 1)} style={[s.iconBtn, i === selected.length - 1 && s.disabled]} accessibilityLabel={`Move ${labelOf(key)} down`}><Ionicons name="arrow-down" size={18} color="#334155" /></TouchableOpacity>
                            <TouchableOpacity onPress={() => removeColumn(key)} style={s.iconBtn} accessibilityLabel={`Remove ${labelOf(key)}`}><Ionicons name="close" size={18} color="#dc2626" /></TouchableOpacity>
                          </View>
                        ))}
                      </View>
                    )}
                  </View>
                  <View style={{ gap: 6 }}>
                    <Text style={s.fieldLabel}>Add a column</Text>
                    <TextInput style={s.input} placeholder="Search columns" value={columnSearch} onChangeText={setColumnSearch} />
                    <View style={s.list}>
                      {available.length === 0 && <Text style={s.empty}>No more columns match.</Text>}
                      {available.map((c) => {
                        const example = firstExample(allRows, c.key);
                        return (
                          <TouchableOpacity key={c.key} style={s.addRow} onPress={() => addColumn(c.key)} accessibilityLabel={`Add ${c.label}`}>
                            <View style={{ flex: 1 }}>
                              <Text style={s.selName} numberOfLines={1}>{c.label}</Text>
                              <Text style={s.hint} numberOfLines={1}>{friendlyType(c.type)}{example ? ` · e.g. ${example}` : ""}</Text>
                            </View>
                            <Ionicons name="add-circle-outline" size={22} color={ACCENT} />
                          </TouchableOpacity>
                        );
                      })}
                    </View>
                  </View>
                </View>
              )}
            </Step>
          ) : (
            <Step n={3} title="Write your note">
              <TextInput style={[s.input, { minHeight: 110, textAlignVertical: "top" }]} multiline placeholder="Type anything you want to keep on this page" value={draft.text ?? ""} onChangeText={(t) => patch({ text: t })} />
            </Step>
          )}

          {showFilter && (
            <Step n={4} title="Only some of the data? (optional)" hint="Limit what is counted, for example only one department or status.">
              <PickerField
                label="Only include rows where…"
                value={draft.filter?.column ?? ANY}
                options={[{ value: ANY, label: "Include everything" }, ...filterCols.map((c) => ({ value: c.key, label: c.label }))]}
                onSelect={(v) => patch({ filter: v === ANY ? undefined : { column: v, value: "" } })}
              />
              {draft.filter?.column ? (
                <PickerField
                  label="…is"
                  value={draft.filter.value || undefined}
                  options={filterValues.map((v) => ({ value: v, label: v }))}
                  placeholder={filterValues.length ? "Choose a value" : "No values yet"}
                  onSelect={(v) => patch({ filter: { column: draft.filter!.column, value: v } })}
                />
              ) : null}
            </Step>
          )}

          <Step n={showFilter ? 5 : 4} title="Name it">
            <TextInput style={s.input} value={draft.title} maxLength={120} onChangeText={setTitle} accessibilityLabel="Widget name" />
          </Step>
        </ScrollView>

        <View style={s.footer}>
          <TouchableOpacity style={[s.btn, s.btnGhost]} onPress={() => onOpenChange(false)}><Text style={s.btnGhostText}>Cancel</Text></TouchableOpacity>
          <TouchableOpacity
            style={[s.btn, s.btnPrimary, !canSave && s.disabled]}
            disabled={!canSave}
            onPress={() => {
              const done = finished();
              if (done) onSave(done);
              onOpenChange(false);
            }}
          >
            <Text style={s.btnPrimaryText}>{isNew ? "Add to page" : "Save changes"}</Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#ffffff" },
  header: { flexDirection: "row", alignItems: "center", padding: 16, borderBottomWidth: 1, borderBottomColor: "#e2e8f0", gap: 8 },
  title: { fontSize: 18, fontWeight: "700", color: "#0f172a" },
  close: { width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center", backgroundColor: "#f1f5f9" },
  body: { padding: 16, gap: 26, paddingBottom: 40 },
  preview: { borderWidth: 1, borderColor: "#e2e8f0", borderRadius: 16, overflow: "hidden", backgroundColor: "#ffffff", minHeight: 120 },
  stepNum: { width: 24, height: 24, borderRadius: 12, backgroundColor: ACCENT, alignItems: "center", justifyContent: "center", marginTop: 1 },
  stepNumText: { color: "#ffffff", fontSize: 12, fontWeight: "700" },
  stepTitle: { fontSize: 15, fontWeight: "700", color: "#0f172a" },
  hint: { fontSize: 12, color: "#64748b" },
  group: { fontSize: 11, fontWeight: "700", color: "#64748b", letterSpacing: 0.6 },
  card: { borderWidth: 1, borderColor: "#e2e8f0", borderRadius: 14, paddingHorizontal: 14, paddingVertical: 12, gap: 2 },
  cardOn: { borderColor: ACCENT, backgroundColor: "#eef2ff" },
  cardTitle: { fontSize: 14, fontWeight: "600", color: "#0f172a" },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  kind: { width: "47.5%", borderWidth: 1, borderColor: "#e2e8f0", borderRadius: 14, padding: 12, gap: 4 },
  fieldLabel: { fontSize: 12, fontWeight: "600", color: "#475569" },
  picker: { minHeight: 48, flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8, borderWidth: 1, borderColor: "#cbd5e1", borderRadius: 12, paddingHorizontal: 14 },
  pickerText: { flex: 1, fontSize: 15, color: "#0f172a" },
  input: { minHeight: 48, borderWidth: 1, borderColor: "#cbd5e1", borderRadius: 12, paddingHorizontal: 14, fontSize: 15, color: "#0f172a" },
  list: { borderWidth: 1, borderColor: "#e2e8f0", borderRadius: 14, overflow: "hidden" },
  selRow: { flexDirection: "row", alignItems: "center", paddingLeft: 14, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: "#e2e8f0" },
  selName: { flex: 1, fontSize: 14, color: "#0f172a" },
  addRow: { flexDirection: "row", alignItems: "center", paddingHorizontal: 14, paddingVertical: 10, gap: 10, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: "#e2e8f0" },
  iconBtn: { width: 44, height: 44, alignItems: "center", justifyContent: "center" },
  empty: { padding: 14, fontSize: 12, color: "#64748b" },
  emptyBox: { padding: 14, fontSize: 12, color: "#64748b", borderWidth: 1, borderStyle: "dashed", borderColor: "#cbd5e1", borderRadius: 12 },
  disabled: { opacity: 0.4 },
  backdrop: { flex: 1, backgroundColor: "rgba(15,23,42,0.45)", justifyContent: "flex-end" },
  listSheet: { backgroundColor: "#ffffff", borderTopLeftRadius: 20, borderTopRightRadius: 20, maxHeight: "70%", paddingTop: 16 },
  listTitle: { fontSize: 15, fontWeight: "700", color: "#0f172a", paddingHorizontal: 18, paddingBottom: 8 },
  listRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 18, paddingVertical: 15, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: "#e2e8f0" },
  listRowText: { fontSize: 15, color: "#0f172a", flex: 1 },
  footer: { flexDirection: "row", gap: 10, padding: 16, borderTopWidth: 1, borderTopColor: "#e2e8f0" },
  btn: { flex: 1, minHeight: 48, borderRadius: 14, alignItems: "center", justifyContent: "center" },
  btnGhost: { borderWidth: 1, borderColor: "#cbd5e1" },
  btnGhostText: { fontSize: 15, fontWeight: "600", color: "#334155" },
  btnPrimary: { backgroundColor: ACCENT },
  btnPrimaryText: { fontSize: 15, fontWeight: "700", color: "#ffffff" },
});
