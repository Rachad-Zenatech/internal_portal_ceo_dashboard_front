import { useMemo, useState } from "react";
import { Responsive, WidthProvider } from "react-grid-layout";
import type { Layout } from "react-grid-layout";
import "react-grid-layout/css/styles.css";
import "react-resizable/css/styles.css";
import { Check, GripVertical, LayoutGrid, Pencil, Plus, RefreshCw, RotateCcw, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import WidgetRenderer from "@/components/Customize/WidgetRenderer";
import WidgetPanel from "@/components/Customize/WidgetPanel";
import WidgetSkeleton from "@/components/Customize/WidgetSkeleton";
import { useBoardState, newWidgetId } from "@/hooks/useBoardState";
import { useCeoRealtimeStream } from "@/hooks/useCeoRealtimeStream";
import { getDataSource } from "@/lib/dataSources";
import { blankWidget } from "@/lib/widgetLogic";
import type { BoardState, WidgetConfig } from "@/types/customize";

const GridLayout = WidthProvider(Responsive);
const BREAKPOINTS = { lg: 1200, md: 996, sm: 768, xs: 480, xxs: 0 };
// Phones get a single column, so widgets stack full-width.
const COLUMNS = { lg: 12, md: 12, sm: 6, xs: 1, xxs: 1 };

interface Props {
  boardKey: string;
  title: string;
  subtitle: string;
  defaults: BoardState;
}

function filterTag(w: WidgetConfig): string | null {
  if (!w.filter?.value) return null;
  const col = getDataSource(w.sourceId)?.columns.find((c) => c.key === w.filter!.column);
  return `${col?.label ?? w.filter.column}: ${w.filter.value}`;
}

export default function CustomBoard({ boardKey, title, subtitle, defaults }: Props) {
  const { state, status, loadFailed, retrySave, setLayout, addWidget, updateWidget, removeWidget, reset } = useBoardState(boardKey, defaults);
  const { triggerManualSync, lastSyncedAt } = useCeoRealtimeStream();

  const [editMode, setEditMode] = useState(false);
  const [breakpoint, setBreakpoint] = useState("lg");
  const [panelWidget, setPanelWidget] = useState<WidgetConfig | null>(null);
  const [panelIsNew, setPanelIsNew] = useState(false);
  const [panelOpen, setPanelOpen] = useState(false);

  const canArrange = editMode && (breakpoint === "lg" || breakpoint === "md" || breakpoint === "sm");
  const layouts = useMemo(() => ({ lg: state?.layout ?? [], md: state?.layout ?? [], sm: state?.layout ?? [] }), [state?.layout]);

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
  const handleSave = (w: WidgetConfig) => (panelIsNew ? addWidget(w) : updateWidget(w));

  const handleLayoutChange = (_current: Layout[], all: Partial<Record<string, Layout[]>>) => {
    // Only the desktop layout is stored; smaller screens re-flow from it.
    if (all.lg && canArrange) setLayout(all.lg);
  };

  const saveLabel =
    status === "saving" ? "Saving…" : status === "saved" ? "Saved to your account" : status === "error" ? "Couldn't save your changes" : loadFailed ? "Showing defaults" : "";

  return (
    <div className="mx-auto flex min-h-screen w-full max-w-[1600px] flex-col gap-4 bg-background p-4 sm:gap-6 sm:p-6 lg:p-8">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0 space-y-1">
          <h1 className="flex items-center gap-2 text-2xl font-semibold tracking-tight text-foreground">
            <LayoutGrid className="h-6 w-6 text-indigo-600 dark:text-indigo-400" />
            {title}
          </h1>
          <p className="text-sm text-muted-foreground">{subtitle}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {saveLabel && (
            <span role="status" className={`mr-1 text-xs ${status === "error" ? "text-rose-600" : "text-muted-foreground"}`}>
              {saveLabel}
              {status === "error" && (
                <button type="button" onClick={retrySave} className="ml-1 cursor-pointer underline">Retry</button>
              )}
            </span>
          )}
          {editMode && (
            <>
              <Button size="sm" onClick={openNew} className="h-10 cursor-pointer gap-2 rounded-xl bg-indigo-600 text-white hover:bg-indigo-700 sm:h-9">
                <Plus className="h-4 w-4" /> Add widget
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => { if (window.confirm("Reset this page to its default layout? Your changes will be removed.")) void reset(); }}
                className="h-10 cursor-pointer gap-2 rounded-xl sm:h-9"
              >
                <RotateCcw className="h-3.5 w-3.5" /> Reset
              </Button>
            </>
          )}
          <Button size="sm" variant="outline" onClick={triggerManualSync} className="h-10 cursor-pointer gap-2 rounded-xl sm:h-9" title={`Last synced: ${lastSyncedAt.toLocaleTimeString()}`}>
            <RefreshCw className="h-3.5 w-3.5" /> Refresh
          </Button>
          <Button size="sm" variant={editMode ? "default" : "outline"} onClick={() => setEditMode((v) => !v)} className="h-10 cursor-pointer gap-2 rounded-xl sm:h-9" disabled={!state}>
            {editMode ? <Check className="h-3.5 w-3.5" /> : <Pencil className="h-3.5 w-3.5" />}
            {editMode ? "Done" : "Customize"}
          </Button>
        </div>
      </header>

      {editMode && (
        <p className="rounded-xl border border-indigo-200 bg-indigo-50 px-3 py-2 text-xs text-indigo-800 dark:border-indigo-900/60 dark:bg-indigo-950/30 dark:text-indigo-200">
          {canArrange
            ? "Drag a widget by its handle to move it, or pull its bottom-right corner to resize. Use the pencil to change what it shows."
            : "Add, edit and delete widgets here. Moving and resizing are available on larger screens."}
        </p>
      )}

      {!state ? (
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4" aria-busy="true" aria-label="Loading your layout">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="h-28 overflow-hidden rounded-2xl border border-border bg-card"><WidgetSkeleton kind="kpi" /></div>
          ))}
          <div className="col-span-2 h-72 overflow-hidden rounded-2xl border border-border bg-card"><WidgetSkeleton kind="bar" /></div>
          <div className="col-span-2 h-72 overflow-hidden rounded-2xl border border-border bg-card"><WidgetSkeleton kind="pie" /></div>
          <div className="col-span-2 h-64 overflow-hidden rounded-2xl border border-border bg-card lg:col-span-4"><WidgetSkeleton kind="table" /></div>
        </div>
      ) : state.widgets.length === 0 ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-border p-12 text-center">
          <p className="text-sm text-muted-foreground">This page is empty. Add your first widget to get started.</p>
          <Button onClick={() => { setEditMode(true); openNew(); }} className="cursor-pointer gap-2"><Plus className="h-4 w-4" /> Add widget</Button>
        </div>
      ) : (
        <GridLayout
          className="layout"
          layouts={layouts}
          breakpoints={BREAKPOINTS}
          cols={COLUMNS}
          rowHeight={40}
          margin={[16, 16]}
          isDraggable={canArrange}
          isResizable={canArrange}
          draggableHandle=".widget-drag-handle"
          onBreakpointChange={(bp: string) => setBreakpoint(bp)}
          onLayoutChange={handleLayoutChange}
        >
          {state.widgets.map((w) => {
            const tag = filterTag(w);
            return (
              <div key={w.id} className="flex flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-2xs">
                <div className="flex items-center gap-2 border-b border-border px-3 py-2">
                  {canArrange && <GripVertical className="widget-drag-handle h-4 w-4 shrink-0 cursor-grab text-muted-foreground active:cursor-grabbing" aria-label="Drag to move" />}
                  <h2 className="min-w-0 flex-1 truncate text-sm font-medium text-foreground">{w.title}</h2>
                  {tag && <span className="hidden max-w-[40%] shrink-0 truncate rounded-full bg-muted px-2 py-0.5 text-[11px] text-muted-foreground sm:inline">{tag}</span>}
                  {editMode && (
                    <div className="flex shrink-0 items-center">
                      <Button variant="ghost" size="icon" className="h-8 w-8 cursor-pointer" onClick={() => openEdit(w)} aria-label={`Edit ${w.title}`}><Pencil className="h-3.5 w-3.5" /></Button>
                      <Button variant="ghost" size="icon" className="h-8 w-8 cursor-pointer text-rose-600" onClick={() => removeWidget(w.id)} aria-label={`Delete ${w.title}`}><Trash2 className="h-3.5 w-3.5" /></Button>
                    </div>
                  )}
                </div>
                <div className="min-h-0 flex-1"><WidgetRenderer widget={w} /></div>
              </div>
            );
          })}
        </GridLayout>
      )}

      <WidgetPanel open={panelOpen} onOpenChange={setPanelOpen} widget={panelWidget} isNew={panelIsNew} onSave={handleSave} />
    </div>
  );
}
