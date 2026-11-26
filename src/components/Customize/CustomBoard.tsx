import { useMemo, useState } from "react";
import { Responsive, WidthProvider } from "react-grid-layout";
import type { Layout } from "react-grid-layout";
import "react-grid-layout/css/styles.css";
import "react-resizable/css/styles.css";
import { Check, GripVertical, Info, LayoutGrid, Pencil, Plus, RefreshCw, RotateCcw, Trash2 } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
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
const COLUMNS = { lg: 12, md: 12, sm: 6, xs: 1, xxs: 1 };

interface Props {
  boardKey: string;
  title: string;
  subtitle: string;
  defaults: BoardState;
  embedded?: boolean;
}

function filterTag(w: WidgetConfig): string | null {
  if (!w.filter?.value) return null;
  const col = getDataSource(w.sourceId)?.columns.find((c) => c.key === w.filter!.column);
  return `${col?.label ?? w.filter.column}: ${w.filter.value}`;
}

function BoardHeader({
  title,
  subtitle,
  embedded,
  saveLabel,
  status,
  editMode,
  hasState,
  lastSyncedAt,
  onRetrySave,
  onAddWidget,
  onReset,
  onRefresh,
  onToggleEdit,
}: {
  title: string;
  subtitle: string;
  embedded: boolean;
  saveLabel: string;
  status: string;
  editMode: boolean;
  hasState: boolean;
  lastSyncedAt: Date;
  onRetrySave: () => void;
  onAddWidget: () => void;
  onReset: () => void;
  onRefresh: () => void;
  onToggleEdit: () => void;
}) {
  return (
    <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div className="min-w-0 space-y-1">
        <h1 className={`flex items-center gap-2 font-semibold tracking-tight text-foreground ${embedded ? "text-lg" : "text-2xl"}`}>
          <LayoutGrid className={`${embedded ? "h-4 w-4" : "h-5 w-5"} text-muted-foreground`} />
          {title}
        </h1>
        <p className="text-sm text-muted-foreground">{subtitle}</p>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        {saveLabel && (
          <Badge variant={status === "error" ? "destructive" : "secondary"} role="status" className="font-normal">
            {saveLabel}
            {status === "error" && (
              <button type="button" onClick={onRetrySave} className="ml-1.5 cursor-pointer underline">
                Retry
              </button>
            )}
          </Badge>
        )}
        {editMode && (
          <>
            <Button size="sm" onClick={onAddWidget} className="gap-1.5 cursor-pointer">
              <Plus className="h-4 w-4" />
              Add widget
            </Button>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button size="sm" variant="outline" className="gap-1.5 cursor-pointer">
                  <RotateCcw className="h-3.5 w-3.5" />
                  Reset
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Reset layout to defaults?</AlertDialogTitle>
                  <AlertDialogDescription>
                    This restores the default widgets and positions for this board. Your custom edits will be removed.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction onClick={onReset}>Reset board</AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </>
        )}
        <Button size="sm" variant="outline" onClick={onRefresh} className="gap-1.5 cursor-pointer" title={`Last synced: ${lastSyncedAt.toLocaleTimeString()}`}>
          <RefreshCw className="h-3.5 w-3.5" />
          Refresh
        </Button>
        <Button size="sm" variant={editMode ? "default" : "outline"} onClick={onToggleEdit} className="gap-1.5 cursor-pointer" disabled={!hasState}>
          {editMode ? <Check className="h-3.5 w-3.5" /> : <Pencil className="h-3.5 w-3.5" />}
          {editMode ? "Done" : "Customize"}
        </Button>
      </div>
    </header>
  );
}

export default function CustomBoard({ boardKey, title, subtitle, defaults, embedded = false }: Props) {
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
    if (all.lg && canArrange) setLayout(all.lg);
  };

  const saveLabel =
    status === "saving" ? "Saving…" : status === "saved" ? "Saved" : status === "error" ? "Couldn't save" : loadFailed ? "Showing defaults" : "";

  const wrapperClass = embedded
    ? "flex w-full flex-col gap-4"
    : "mx-auto flex w-full max-w-[1600px] flex-col gap-4 bg-background p-4 pb-12 sm:gap-6 sm:p-6 lg:p-8";

  return (
    <div className={wrapperClass}>
      <BoardHeader
        title={title}
        subtitle={subtitle}
        embedded={embedded}
        saveLabel={saveLabel}
        status={status}
        editMode={editMode}
        hasState={Boolean(state)}
        lastSyncedAt={lastSyncedAt}
        onRetrySave={retrySave}
        onAddWidget={openNew}
        onReset={() => void reset()}
        onRefresh={triggerManualSync}
        onToggleEdit={() => setEditMode((v) => !v)}
      />

      {editMode && (
        <Alert>
          <Info className="h-4 w-4" />
          <AlertDescription className="text-xs">
            {canArrange
              ? "Drag a widget by its grip handle to move it, pull the bottom-right corner to resize, or click the pencil to configure."
              : "Add, edit and delete widgets here. Dragging and resizing are available on larger screens."}
          </AlertDescription>
        </Alert>
      )}

      {!state ? (
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4" aria-busy="true" aria-label="Loading your layout">
          {[0, 1, 2, 3].map((i) => (
            <Card key={i} className="h-28 p-0"><WidgetSkeleton kind="kpi" /></Card>
          ))}
          <Card className="col-span-2 h-72 p-0"><WidgetSkeleton kind="bar" /></Card>
          <Card className="col-span-2 h-72 p-0"><WidgetSkeleton kind="pie" /></Card>
          <Card className="col-span-2 h-64 p-0 lg:col-span-4"><WidgetSkeleton kind="table" /></Card>
        </div>
      ) : state.widgets.length === 0 ? (
        <Card className="flex flex-1 flex-col items-center justify-center gap-3 border-dashed p-12 text-center shadow-none">
          <p className="text-sm text-muted-foreground">This board is empty. Add your first widget to get started.</p>
          <Button onClick={() => { setEditMode(true); openNew(); }} className="cursor-pointer gap-2">
            <Plus className="h-4 w-4" />
            Add widget
          </Button>
        </Card>
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
              <div key={w.id} className="h-full w-full">
                <Card className="h-full w-full flex flex-col gap-0 py-0 overflow-hidden">
                  <div className="flex items-center gap-2 border-b border-border px-3.5 py-2.5">
                    {canArrange && <GripVertical className="widget-drag-handle h-4 w-4 shrink-0 cursor-grab text-muted-foreground active:cursor-grabbing" aria-label="Drag to move" />}
                    <h2 className="min-w-0 flex-1 truncate text-sm font-medium text-foreground">{w.title}</h2>
                    {tag && <Badge variant="secondary" className="hidden max-w-[40%] shrink-0 truncate text-[11px] font-normal sm:inline-flex">{tag}</Badge>}
                    {editMode && (
                      <div className="flex shrink-0 items-center gap-0.5">
                        <Button variant="ghost" size="icon-xs" className="cursor-pointer" onClick={() => openEdit(w)} aria-label={`Edit ${w.title}`}><Pencil className="h-3.5 w-3.5" /></Button>
                        <Button variant="ghost" size="icon-xs" className="cursor-pointer text-destructive hover:text-destructive" onClick={() => removeWidget(w.id)} aria-label={`Delete ${w.title}`}><Trash2 className="h-3.5 w-3.5" /></Button>
                      </div>
                    )}
                  </div>
                  <div className="min-h-0 flex-1"><WidgetRenderer widget={w} /></div>
                </Card>
              </div>
            );
          })}
        </GridLayout>
      )}

      <WidgetPanel open={panelOpen} onOpenChange={setPanelOpen} widget={panelWidget} isNew={panelIsNew} onSave={handleSave} />
    </div>
  );
}
