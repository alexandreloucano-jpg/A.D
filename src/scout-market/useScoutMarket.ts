import { useCallback, useEffect, useState } from "react";
import type { Finding, MarketAction, ScanRun } from "./schema";
import { marketRequest } from "./client";
export interface RadarSource {
  id: string;
  name: string;
  url: string;
  purpose: "commercial" | "strategic";
  enabled: boolean;
  connected: boolean;
  accessStatus: string;
  accessNote: string;
  lastIngestedAt: string | null;
}
export interface MarketStatus {
  enabled: boolean;
  sourceCount: number;
  lastRun: ScanRun | null;
  stale: boolean;
}
export function useScoutMarket(query = "", view = "") {
  const [sources, setSources] = useState<RadarSource[]>([]);
  const [items, setItems] = useState<Finding[]>([]),
    [status, setStatus] = useState<MarketStatus | null>(null),
    [actions, setActions] = useState<MarketAction[]>([]),
    [observations, setObservations] = useState<Finding[]>([]),
    [error, setError] = useState(""),
    [loading, setLoading] = useState(true),
    [busy, setBusy] = useState(false);
  const refresh = useCallback(async () => {
    try {
      const st = await marketRequest<MarketStatus>("/status");
      setStatus(st);
      if (st.enabled) {
        const [list, brief, registry] = await Promise.all([
          marketRequest<{ items: Finding[] }>(
            "/opportunities?q=" + encodeURIComponent(query),
          ),
          marketRequest<{
            acceptedNowActions: MarketAction[];
            observations?: Finding[];
          }>("/brief/today"),
          marketRequest<{ items: RadarSource[] }>("/sources").catch(() => ({
            items: [],
          })),
        ]);
        setSources(registry.items || []);
        setItems(list.items);
        setActions(brief.acceptedNowActions);
        setObservations(brief.observations || []);
      }
      setError("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Radar indisponible.");
    } finally {
      setLoading(false);
    }
  }, [query]);
  useEffect(() => {
    void refresh();
    const update = () => void refresh();
    window.addEventListener("ad-market-update", update);
    return () => window.removeEventListener("ad-market-update", update);
  }, [refresh, view]);
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
  };
}
