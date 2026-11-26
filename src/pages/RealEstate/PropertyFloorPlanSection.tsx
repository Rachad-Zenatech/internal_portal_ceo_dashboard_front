import { lazy, Suspense, useEffect, useState } from "react";
import { Box, Download, Image as ImageIcon, Layers, Loader2, Maximize2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  fetchRealEstateFloorplanBlob,
  fetchRealEstateRenderBlob,
  useRealEstateFloorMapProject,
} from "@/hooks/useRealEstate";
import type { FloorMapProject, FloorMapRender } from "@/types/realEstate";
import { isWallMesh } from "@/types/realEstate";

const InteractiveFloorPlan3D = lazy(() => import("./InteractiveFloorPlan3D"));

function useBlobUrl(loader: () => Promise<Blob>, key: string | null) {
  const [url, setUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(Boolean(key));
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (!key) {
      setUrl(null);
      setLoading(false);
      setFailed(false);
      return;
    }
    let alive = true;
    let objUrl = "";
    setLoading(true);
    setFailed(false);
    loader()
      .then((blob) => {
        if (!alive) return;
        objUrl = URL.createObjectURL(blob);
        setUrl(objUrl);
      })
      .catch(() => {
        if (alive) setFailed(true);
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
      if (objUrl) URL.revokeObjectURL(objUrl);
    };
  }, [key]);

  return { url, loading, failed };
}

function FloorPlanImagePanel({
  render,
  projectId,
  alt,
  fallbackOriginal,
}: {
  render: FloorMapRender | null;
  projectId: string;
  alt: string;
  fallbackOriginal?: boolean;
}) {
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const key = render ? `render:${render.id}` : fallbackOriginal ? `orig:${projectId}` : null;
  const { url, loading, failed } = useBlobUrl(
    () => (render ? fetchRealEstateRenderBlob(render.id, "png") : fetchRealEstateFloorplanBlob(projectId)),
    key
  );

  if (loading) {
    return (
      <div className="flex h-[460px] items-center justify-center rounded-lg border border-border bg-muted/20">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }
  if (failed || !url) {
    return (
      <div className="flex h-[280px] flex-col items-center justify-center rounded-lg border border-dashed border-border bg-muted/15 text-sm text-muted-foreground">
        <ImageIcon className="h-8 w-8 mb-2 opacity-50" />
        <p>Floor plan image is not available yet.</p>
      </div>
    );
  }

  return (
    <>
      <div className="group relative h-[460px] flex items-center justify-center overflow-hidden rounded-lg border border-border bg-slate-100 dark:bg-slate-900/40 p-2">
        <img
          src={url}
          alt={alt}
          className="max-h-full max-w-full object-contain mx-auto cursor-zoom-in"
          onClick={() => setLightboxOpen(true)}
        />
        <div className="absolute top-3 right-3 flex items-center gap-1.5">
          <Button type="button" variant="secondary" size="sm" className="h-8 gap-1.5 text-xs shadow-sm cursor-pointer" onClick={() => setLightboxOpen(true)}>
            <Maximize2 className="h-3.5 w-3.5" />
            Expand
          </Button>
          <Button variant="secondary" size="sm" asChild className="h-8 gap-1.5 text-xs shadow-sm">
            <a href={url} download={`${alt.toLowerCase().replace(/\s+/g, "-")}.png`}>
              <Download className="h-3.5 w-3.5" />
              Download
            </a>
          </Button>
        </div>
      </div>

      <Dialog open={lightboxOpen} onOpenChange={setLightboxOpen}>
        <DialogContent className="max-w-5xl p-4">
          <DialogHeader>
            <DialogTitle>{alt}</DialogTitle>
          </DialogHeader>
          <div className="flex items-center justify-center bg-muted/30 rounded-lg p-2">
            <img src={url} alt={alt} className="max-h-[78vh] w-auto object-contain rounded" />
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

interface Props {
  initialProject: FloorMapProject | null;
  projects: FloorMapProject[];
}

export function PropertyFloorPlanSection({ initialProject, projects }: Props) {
  const [selectedProjectId, setSelectedProjectId] = useState<string>(initialProject?.id ?? projects[0]?.id ?? "");
  const [tab, setTab] = useState<"2d" | "3d">("2d");
  const [modelMode, setModelMode] = useState<"interactive" | "render">("interactive");

  useEffect(() => {
    setSelectedProjectId(initialProject?.id ?? projects[0]?.id ?? "");
  }, [initialProject?.id, projects]);

  const needsProjectFetch = Boolean(selectedProjectId && selectedProjectId !== initialProject?.id);
  const { data: fetchedProjectResp, isFetching } = useRealEstateFloorMapProject(selectedProjectId, needsProjectFetch);
  const project = needsProjectFetch ? fetchedProjectResp?.data ?? initialProject : initialProject;

  const renders = Array.isArray(project?.renders) ? project.renders : [];
  const active2d = renders.find((r) => r.render_type === "2d" && r.is_active) ?? renders.find((r) => r.render_type === "2d") ?? null;
  const active3d = renders.find((r) => r.render_type === "3d" && r.is_active) ?? renders.find((r) => r.render_type === "3d") ?? null;

  const wallMeshCandidate = active3d?.scene_json ?? project?.scene_json;
  const wallMesh = isWallMesh(wallMeshCandidate) ? wallMeshCandidate : null;
  const has3d = Boolean(wallMesh || active3d);

  useEffect(() => {
    if (!active2d && has3d) setTab("3d");
    else setTab("2d");
    setModelMode(wallMesh ? "interactive" : "render");
  }, [project?.id, Boolean(active2d), has3d, Boolean(wallMesh)]);

  if (!project && projects.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Layers className="h-4 w-4 text-muted-foreground" />
            Floor Plan &amp; 3D Models
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-border bg-muted/15 py-10 text-center">
            <Layers className="h-8 w-8 text-muted-foreground/50 mb-2" />
            <p className="text-sm font-medium text-foreground">No floor plan attached to this property</p>
            <p className="text-xs text-muted-foreground mt-1">
              Floor plans and 3D models created in the Real Estate application will appear here automatically.
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="items-center">
        <div>
          <CardTitle className="flex items-center gap-2">
            <Layers className="h-4 w-4 text-muted-foreground" />
            Floor Plan &amp; 3D Models
          </CardTitle>
          <CardDescription className="text-xs mt-0.5">
            {project?.title || "Floor Plan Project"} · Status: {project?.status || "Ready"}
          </CardDescription>
        </div>
        <CardAction>
          <div className="flex flex-wrap items-center gap-2">
            {projects.length > 1 && (
              <Select value={selectedProjectId} onValueChange={setSelectedProjectId}>
                <SelectTrigger className="h-8 w-[180px] text-xs">
                  <SelectValue placeholder="Select floor plan" />
                </SelectTrigger>
                <SelectContent>
                  {projects.map((proj) => (
                    <SelectItem key={proj.id} value={proj.id}>
                      {proj.title || "Untitled Floor Plan"}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
            <Tabs value={tab} onValueChange={(v) => setTab(v as "2d" | "3d")}>
              <TabsList>
                <TabsTrigger value="2d" className="cursor-pointer px-3 text-xs gap-1.5">
                  <ImageIcon className="h-3.5 w-3.5" />
                  2D Floor Plan
                </TabsTrigger>
                <TabsTrigger value="3d" disabled={!has3d} className="cursor-pointer px-3 text-xs gap-1.5">
                  <Box className="h-3.5 w-3.5" />
                  3D Model
                </TabsTrigger>
              </TabsList>
            </Tabs>
          </div>
        </CardAction>
      </CardHeader>

      <CardContent className="space-y-3">
        {isFetching ? (
          <div className="flex h-[320px] items-center justify-center rounded-lg border border-border bg-muted/20">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : tab === "2d" && project ? (
          <FloorPlanImagePanel render={active2d} projectId={project.id} alt={`${project.title || "Property"} 2D Floor Plan`} fallbackOriginal={Boolean(project.has_floorplan_image)} />
        ) : project ? (
          <div className="space-y-3">
            {wallMesh && active3d && (
              <Tabs value={modelMode} onValueChange={(v) => setModelMode(v as "interactive" | "render")}>
                <TabsList>
                  <TabsTrigger value="interactive" className="cursor-pointer px-3 text-xs">Interactive 3D Mesh</TabsTrigger>
                  <TabsTrigger value="render" className="cursor-pointer px-3 text-xs">3D Rendered View</TabsTrigger>
                </TabsList>
              </Tabs>
            )}
            {modelMode === "interactive" && wallMesh ? (
              <Suspense fallback={<div className="h-[460px] flex items-center justify-center rounded-lg border border-border bg-slate-100 text-xs text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin mr-2" />Loading 3D model…</div>}>
                <InteractiveFloorPlan3D projectId={project.id} cacheKey={`${active3d?.id || project.id}-${project.updated_at}`} wallMesh={wallMesh} />
              </Suspense>
            ) : (
              <FloorPlanImagePanel render={active3d} projectId={project.id} alt={`${project.title || "Property"} 3D Floor Plan`} />
            )}
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
