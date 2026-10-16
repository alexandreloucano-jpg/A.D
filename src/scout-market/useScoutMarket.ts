import { useCallback, useEffect, useState } from "react";
import type { Finding, MarketAction, ScanRun } from "./schema";
import { marketRequest } from "./client";
export interface MarketStatus {
  enabled: boolean;
  sourceCount: number;
  lastRun: ScanRun | null;
  stale: boolean;
}
export function useScoutMarket(query = "", view = "") {
  const [items, setItems] = useState<Finding[]>([]),
    [status, setStatus] = useState<MarketStatus | null>(null),
    [actions, setActions] = useState<MarketAction[]>([]),
    [error, setError] = useState(""),
    [loading, setLoading] = useState(true),
    [busy, setBusy] = useState(false);
  const refresh = useCallback(async () => {
    try {
      const st = await marketRequest<MarketStatus>("/status");
      setStatus(st);
      if (st.enabled) {
        const [list, brief] = await Promise.all([
          marketRequest<{ items: Finding[] }>(
            "/opportunities?q=" + encodeURIComponent(query),
          ),
          marketRequest<{ acceptedNowActions: MarketAction[] }>("/brief/today"),
        ]);
        setItems(list.items);
        setActions(brief.acceptedNowActions);
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
  return { items, status, error, loading, busy, mutate, refresh, actions };
}
