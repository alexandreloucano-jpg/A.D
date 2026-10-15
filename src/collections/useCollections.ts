import { useEffect, useRef, useState } from "react";
import {
  COLLECTIONS_KEY,
  collectionsSchema,
  emptyCollections,
  type Collections,
} from "./model";
import type { RemoteSaver } from "../remote-saver";
export function useCollections(remote: RemoteSaver) {
  const [value, setValue] = useState<Collections>(emptyCollections),
    [error, setError] = useState(""),
    [ready, setReady] = useState(false),
    [busy, setBusy] = useState(false);
  const generation = useRef(0),
    saving = useRef(false);
  async function load() {
    const epoch = ++generation.current;
    setReady(false);
    setError("");
    try {
      const next = remote.connected
        ? collectionsSchema.parse(
            (await remote.reader<{ collections: unknown }>("/api/collections"))
              .collections,
          )
        : collectionsSchema.parse(
            JSON.parse(
              localStorage.getItem(COLLECTIONS_KEY) ||
                JSON.stringify(emptyCollections()),
            ),
          );
      if (epoch === generation.current) {
        setValue(next);
        setReady(true);
      }
    } catch {
      if (epoch === generation.current)
        setError(
          "Collections indisponibles. Rechargez-les avant toute modification.",
        );
    }
  }
  useEffect(() => {
    void load();
    const change = (e: StorageEvent) => {
      if (e.key === COLLECTIONS_KEY && !remote.connected) void load();
    };
    window.addEventListener("storage", change);
    return () => {
      generation.current++;
      window.removeEventListener("storage", change);
    };
  }, [remote.connected]);
  async function save(groups: Collections["groups"]) {
    if (!ready || saving.current) return false;
    saving.current = true;
    setBusy(true);
    setError("");
    const epoch = generation.current;
    try {
      let next: Collections;
      if (remote.connected) {
        const result = await remote.reader<{
          collections: unknown;
          verified: boolean;
        }>("/api/collections", "PUT", { ...value, groups });
        if (!result.verified) throw Error("readback");
        next = collectionsSchema.parse(result.collections);
      } else {
        const existing = collectionsSchema.parse(
          JSON.parse(
            localStorage.getItem(COLLECTIONS_KEY) ||
              JSON.stringify(emptyCollections()),
          ),
        );
        if (existing.revision !== value.revision) throw Error("conflict");
        next = collectionsSchema.parse({
          ...value,
          groups,
          revision: value.revision + 1,
        });
        localStorage.setItem(COLLECTIONS_KEY, JSON.stringify(next));
        if (localStorage.getItem(COLLECTIONS_KEY) !== JSON.stringify(next))
          throw Error("readback");
      }
      if (epoch !== generation.current) throw Error("session changed");
      setValue(next);
      return true;
    } catch {
      setError(
        "Enregistrement non confirmé. Votre saisie est conservée ; rechargez les collections avant de réessayer.",
      );
      return false;
    } finally {
      saving.current = false;
      setBusy(false);
    }
  }
  return { value, error, ready, busy, save, reload: load };
}
