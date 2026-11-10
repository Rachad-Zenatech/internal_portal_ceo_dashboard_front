import { useEffect, useState } from "react";
import {
  ArrowDown,
  ArrowUp,
  ChartArea,
  ChartBar,
  ChartColumn,
  ChartLine,
  ChartPie,
  Gauge,
  Hash,
  ListOrdered,
  Search,
  StickyNote,
  Table,
  X,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from "@/components/ui/select";
import WidgetRenderer from "@/components/Customize/WidgetRenderer";
import { useWidgetDraft } from "@/hooks/useWidgetDraft";
import { DATA_SOURCES, MODULE_LABELS } from "@/lib/dataSources";
import { KIND_INFO, KIND_ORDER, decodeMeasure, encodeMeasure, firstExample, friendlyType } from "@/lib/widgetLogic";
import { cn } from "@/lib/utils";
import type { WidgetConfig, WidgetKind } from "@/types/customize";

const KIND_ICONS: Record<WidgetKind, LucideIcon> = {
  table: Table,
  kpi: Hash,
  bar: ChartColumn,
  hbar: ChartBar,
  line: ChartLine,
  area: ChartArea,
  pie: ChartPie,
  ranking: ListOrdered,
  gauge: Gauge,
  note: StickyNote,
};

const ITEM_WORD: Partial<Record<WidgetKind, string>> = { bar: "bar", hbar: "bar", line: "point", area: "point", pie: "slice", ranking: "row" };
const ANY = "__any__";

function Step({ n, title, hint, children }: { n: number; title: string; hint?: string; children: React.ReactNode }) {
  return (
    <section className="space-y-3">
      <div className="flex items-start gap-3">
        <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-indigo-600 text-xs font-semibold text-white">{n}</span>
        <div>
          <h3 className="text-sm font-semibold text-foreground">{title}</h3>
          {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
        </div>
      </div>
      <div className="space-y-3 pl-9">{children}</div>
    </section>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <label className="text-xs font-medium text-muted-foreground">{label}</label>
      {children}
    </div>
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
    changeSource, changeKind, selected, labelOf, moveColumn: move, addColumn, removeColumn, availableColumns, canSave, finished,
  } = useWidgetDraft(widget, isNew);

  useEffect(() => setColumnSearch(""), [widget]);

  if (!draft) return null;
  const available = availableColumns(columnSearch);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="flex flex-col gap-0 overflow-hidden p-0 data-[side=right]:w-full data-[side=right]:sm:max-w-xl data-[side=right]:lg:max-w-3xl">
        <SheetHeader className="border-b border-border p-4">
          <SheetTitle>{isNew ? "Add a widget" : "Edit widget"}</SheetTitle>
          <SheetDescription>Choose your data, how to show it, then fine-tune. The preview updates as you go.</SheetDescription>
        </SheetHeader>

        <div className="flex-1 space-y-7 overflow-y-auto p-4">
          <div className="h-52 overflow-hidden rounded-xl border border-border bg-card" aria-label="Preview">
            <WidgetRenderer widget={draft} />
          </div>

          <Step n={1} title="What do you want to show?" hint="Pick where the numbers come from. They are always live.">
            <Select value={draft.sourceId} onValueChange={changeSource}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Choose data…" />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(MODULE_LABELS).map(([module, label]) => {
                  const items = DATA_SOURCES.filter((s) => s.module === module);
                  if (items.length === 0) return null;
                  return (
                    <SelectGroup key={module}>
                      <SelectLabel>{label}</SelectLabel>
                      {items.map((s) => (
                        <SelectItem key={s.id} value={s.id}>{s.label}</SelectItem>
                      ))}
                    </SelectGroup>
                  );
                })}
              </SelectContent>
            </Select>
            {source?.description && <p className="text-xs text-muted-foreground">{source.description}</p>}
          </Step>

          <Step n={2} title="How should it look?">
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {KIND_ORDER.map((k) => {
                const Icon = KIND_ICONS[k];
                return (
                  <button
                    key={k}
                    type="button"
                    onClick={() => changeKind(k)}
                    aria-pressed={kind === k}
                    className={cn(
                      "flex cursor-pointer items-center gap-3 rounded-xl border p-3 text-left transition-colors",
                      kind === k ? "border-indigo-500 bg-indigo-50 dark:bg-indigo-950/40" : "border-border hover:bg-muted/60",
                    )}
                  >
                    <Icon className="h-5 w-5 shrink-0 text-indigo-600 dark:text-indigo-400" />
                    <span className="min-w-0">
                      <span className="block text-sm font-medium text-foreground">{KIND_INFO[k].label}</span>
                      <span className="block text-xs text-muted-foreground">{KIND_INFO[k].hint}</span>
                    </span>
                  </button>
                );
              })}
            </div>
          </Step>

          {kind !== "note" && (
            <Step n={3} title="Set it up">
              {info.needsGroup && source && (
                <Field label={`Show one ${ITEM_WORD[kind] ?? "item"} for each…`}>
                  <Select value={draft.dimension} onValueChange={(v) => patch({ dimension: v })}>
                    <SelectTrigger className="w-full"><SelectValue placeholder="Choose…" /></SelectTrigger>
                    <SelectContent>
                      {source.columns.map((c) => <SelectItem key={c.key} value={c.key}>{c.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </Field>
              )}

              {info.needsMeasure && (
                <Field label={kind === "kpi" || kind === "gauge" ? "What should it show?" : "How big should each one be?"}>
                  <Select value={encodeMeasure(draft)} onValueChange={(v) => patch(decodeMeasure(v))}>
                    <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {measures.map((m) => <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </Field>
              )}

              {kind === "gauge" && (
                <Field label="Your goal">
                  <Input type="number" min={1} inputMode="decimal" placeholder="e.g. 100000" value={draft.target ?? ""} onChange={(e) => patch({ target: e.target.value === "" ? undefined : Number(e.target.value) })} />
                  <p className="text-xs text-muted-foreground">The progress bar fills as the figure gets closer to this number.</p>
                </Field>
              )}

              {kind === "table" && source && (
                <div className="space-y-3">
                  <Field label={`Columns showing (${selected.length})`}>
                    {selected.length === 0 ? (
                      <p className="rounded-lg border border-dashed border-border p-3 text-xs text-muted-foreground">Nothing yet. Add at least one column below.</p>
                    ) : (
                      <ul className="divide-y divide-border rounded-xl border border-border">
                        {selected.map((key, i) => (
                          <li key={key} className="flex items-center gap-1 py-1 pl-3 pr-1">
                            <span className="min-w-0 flex-1 truncate text-sm">{labelOf(key)}</span>
                            <Button variant="ghost" size="icon" className="h-8 w-8" disabled={i === 0} onClick={() => move(i, -1)} aria-label={`Move ${labelOf(key)} up`}><ArrowUp className="h-3.5 w-3.5" /></Button>
                            <Button variant="ghost" size="icon" className="h-8 w-8" disabled={i === selected.length - 1} onClick={() => move(i, 1)} aria-label={`Move ${labelOf(key)} down`}><ArrowDown className="h-3.5 w-3.5" /></Button>
                            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => removeColumn(key)} aria-label={`Remove ${labelOf(key)}`}><X className="h-3.5 w-3.5" /></Button>
                          </li>
                        ))}
                      </ul>
                    )}
                  </Field>

                  <Field label="Add a column">
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                      <Input className="pl-9" placeholder="Search columns" value={columnSearch} onChange={(e) => setColumnSearch(e.target.value)} />
                    </div>
                    <ul className="max-h-56 divide-y divide-border overflow-y-auto rounded-xl border border-border">
                      {available.length === 0 && <li className="p-3 text-xs text-muted-foreground">No more columns match.</li>}
                      {available.map((c) => (
                        <li key={c.key}>
                          <label className="flex cursor-pointer items-center gap-3 px-3 py-2 hover:bg-muted/50">
                            <Checkbox checked={false} onCheckedChange={() => addColumn(c.key)} aria-label={`Add ${c.label}`} />
                            <span className="min-w-0 flex-1">
                              <span className="block truncate text-sm">{c.label}</span>
                              <span className="block truncate text-xs text-muted-foreground">
                                {friendlyType(c.type)}
                                {firstExample(allRows, c.key) && ` · e.g. ${firstExample(allRows, c.key)}`}
                              </span>
                            </span>
                          </label>
                        </li>
                      ))}
                    </ul>
                  </Field>
                </div>
              )}
            </Step>
          )}

          {kind === "note" && (
            <Step n={3} title="Write your note">
              <Textarea rows={5} placeholder="Type anything you want to keep on this page" value={draft.text ?? ""} onChange={(e) => patch({ text: e.target.value })} />
            </Step>
          )}

          {kind !== "note" && filterCols.length > 0 && (
            <Step n={4} title="Only some of the data? (optional)" hint="Limit what is counted, for example only one department or status.">
              <Field label="Only include rows where…">
                <Select value={draft.filter?.column ?? ANY} onValueChange={(v) => patch({ filter: v === ANY ? undefined : { column: v, value: "" } })}>
                  <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value={ANY}>Include everything</SelectItem>
                    {filterCols.map((c) => <SelectItem key={c.key} value={c.key}>{c.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </Field>
              {draft.filter?.column && (
                <Field label="…is">
                  <Select value={draft.filter.value || undefined} onValueChange={(v) => patch({ filter: { column: draft.filter!.column, value: v } })}>
                    <SelectTrigger className="w-full"><SelectValue placeholder={filterValues.length ? "Choose a value" : "No values yet"} /></SelectTrigger>
                    <SelectContent>
                      {filterValues.map((v) => <SelectItem key={v} value={v}>{v}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </Field>
              )}
            </Step>
          )}

          <Step n={kind === "note" || filterCols.length === 0 ? 4 : 5} title="Name it">
            <Input
              value={draft.title}
              maxLength={120}
              onChange={(e) => setTitle(e.target.value)}
              aria-label="Widget name"
            />
          </Step>
        </div>

        <SheetFooter className="flex-row justify-end gap-2 border-t border-border p-4">
          <Button variant="outline" onClick={() => onOpenChange(false)} className="cursor-pointer">Cancel</Button>
          <Button
            onClick={() => {
              const done = finished();
              if (done) onSave(done);
              onOpenChange(false);
            }}
            disabled={!canSave}
            className="cursor-pointer bg-indigo-600 text-white hover:bg-indigo-700"
          >
            {isNew ? "Add to page" : "Save changes"}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
