import { useCallback, useEffect, useRef, useState } from "react";
import type { Finding, MarketAction, ScanRun } from "./schema";
import { marketRequest } from "./client";
import { assessLookalike } from "./lookalike";
export interface RadarSource {
  id: string;
  name: string;
  url: string;
  purpose: "commercial" | "strategic" | "cultural" | "research";
  enabled: boolean;
  connected: boolean;
  accessStatus: string;
  errorCode?: string;
  accessNote: string;
  lastIngestedAt: string | null;
}
export interface MarketStatus {
  enabled: boolean;
  sourceCount: number;
  lastRun: ScanRun | null;
  stale: boolean;
}
export interface MarketFilters {
  status?: string;
  classification?: string;
  qualification?: string;
  activeOnly?: boolean;
  sector?: string;
  city?: string;
  eventType?: string;
  confidence?: string;
  stage?: string;
  minCoverage?: string;
  days?: string;
}
export interface MarketFacets {
  sectors: string[];
  cities: string[];
  eventTypes: string[];
}
export function useScoutMarket(query = "", view = "", filters: MarketFilters = {}) {
  const [sources, setSources] = useState<RadarSource[]>([]);
  const [facets, setFacets] = useState<MarketFacets>({ sectors: [], cities: [], eventTypes: [] });
  const [items, setItems] = useState<Finding[]>([]),
    [totalApprox, setTotalApprox] = useState(0),
    [nextCursor, setNextCursor] = useState<string | null>(null),
    [loadingMore, setLoadingMore] = useState(false),
    [status, setStatus] = useState<MarketStatus | null>(null),
    [actions, setActions] = useState<MarketAction[]>([]),
    [observations, setObservations] = useState<Finding[]>([]),
    [error, setError] = useState(""),
    [loading, setLoading] = useState(true),
    [busy, setBusy] = useState(false);
  const requestGeneration = useRef(0);
  const refresh = useCallback(async () => {
    const generation = ++requestGeneration.current;
    setLoading(true);
    setLoadingMore(false);
    try {
      const st = await marketRequest<MarketStatus>("/status");
      if (generation !== requestGeneration.current) return;
      setStatus(st);
      if (st.enabled) {
        const params = new URLSearchParams({ limit: "50" });
        if (query.trim()) params.set("q", query.trim());
        Object.entries(filters).forEach(([key, value]) => {
          if (value !== undefined && value !== "" && value !== false)
            params.set(key, String(value));
        });
        const [list, brief, registry] = await Promise.all([
          marketRequest<{
            items: Finding[];
            totalApprox?: number;
            nextCursor?: string | null;
            facets?: MarketFacets;
          }>("/opportunities?" + params.toString()),
          marketRequest<{
            acceptedNowActions: MarketAction[];
            observations?: Finding[];
          }>("/brief/today"),
          marketRequest<{ items: RadarSource[] }>("/sources").catch(() => ({
            items: [],
          })),
        ]);
        if (generation !== requestGeneration.current) return;
        setSources(registry.items || []);
        setItems(list.items.map((f) => ({ ...f, lookalike: f.lookalike ?? assessLookalike(f) })));
        setFacets(list.facets || { sectors: [], cities: [], eventTypes: [] });
        setTotalApprox(list.totalApprox ?? list.items.length);
        setNextCursor(list.nextCursor || null);
        setActions(brief.acceptedNowActions);
        setObservations((brief.observations || []).map((f) => ({ ...f, lookalike: f.lookalike ?? assessLookalike(f) })));
      } else {
        setSources([]);
        setItems([]);
        setFacets({ sectors: [], cities: [], eventTypes: [] });
        setTotalApprox(0);
        setNextCursor(null);
        setActions([]);
        setObservations([]);
      }
      setError("");
    } catch (e) {
      if (generation !== requestGeneration.current) return;
      setError(e instanceof Error ? e.message : "Radar indisponible.");
    } finally {
      if (generation === requestGeneration.current) setLoading(false);
    }
  }, [filters, query]);
  useEffect(() => {
    void refresh();
    const update = () => void refresh();
    window.addEventListener("ad-market-update", update);
    return () => window.removeEventListener("ad-market-update", update);
  }, [refresh, view]);
  const loadMore = useCallback(async () => {
    if (!nextCursor || loadingMore) return;
    const generation = requestGeneration.current;
    setLoadingMore(true);
    setError("");
    try {
      const params = new URLSearchParams({ limit: "50", after: nextCursor });
      if (query.trim()) params.set("q", query.trim());
      Object.entries(filters).forEach(([key, value]) => {
        if (value !== undefined && value !== "" && value !== false)
          params.set(key, String(value));
      });
      const page = await marketRequest<{
        items: Finding[];
        totalApprox?: number;
        nextCursor?: string | null;
      }>("/opportunities?" + params.toString());
      if (generation !== requestGeneration.current) return;
      const additions = page.items.map((f) => ({
        ...f,
        lookalike: f.lookalike ?? assessLookalike(f),
      }));
      setItems((current) => {
        const seen = new Set(current.map((f) => f.id));
        return [...current, ...additions.filter((f) => !seen.has(f.id))];
      });
      setTotalApprox(page.totalApprox ?? totalApprox);
      setNextCursor(page.nextCursor || null);
    } catch (e) {
      if (generation === requestGeneration.current)
        setError(e instanceof Error ? e.message : "Chargement interrompu.");
    } finally {
      if (generation === requestGeneration.current) setLoadingMore(false);
    }
  }, [filters, loadingMore, nextCursor, query, totalApprox]);
  async function runScan() {
    setBusy(true);
    setError("");
    try {
      let path = status?.lastRun?.paused
        ? "/runs/" + status.lastRun.id + "/resume"
        : "/runs";
      for (let slice = 0; slice < 24; slice++) {
        const run = await marketRequest<ScanRun>(path, { mode: "manual" });
        setStatus((previous) =>
          previous ? { ...previous, lastRun: run } : previous,
        );
        if (
          !run.paused ||
          run.status === "failed" ||
          document.visibilityState !== "visible"
        )
          break;
        path = "/runs/" + run.id + "/resume";
      }
      await refresh();
      window.dispatchEvent(new Event("ad-market-update"));
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : "Collecte interrompue. La reprise est conservée.",
      );
    } finally {
      setBusy(false);
    }
  }
  async function mutate(path: string, body: unknown) {
    setBusy(true);
    setError("");
    try {
      await marketRequest(path, body);
      await refresh();
      window.dispatchEvent(new Event("ad-market-update"));
      return true;
    } catch (e) {
      setError(e instanceof Error ? e.message : "Opération impossible.");
      return false;
    } finally {
      setBusy(false);
    }
  }
  return {
    sources,
    facets,
    items,
    status,
    error,
    loading,
    busy,
    mutate,
    refresh,
    actions,
    observations,
    runScan,
    totalApprox,
    nextCursor,
    loadingMore,
    loadMore,
  };
}
