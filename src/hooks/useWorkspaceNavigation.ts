import { useEffect, useRef, useState } from "react";
import type { Route } from "../display";
type NavigationState = {
  route: Route;
  query: string;
  projectId: string | null;
  expanded: string | null;
  archive: boolean;
  filter: "all" | "links" | "notes";
};
const initial = (route: Route): NavigationState => ({
  route,
  query: "",
  projectId: null,
  expanded: null,
  archive: false,
  filter: "all",
});
function readLocation(): NavigationState {
  const [path, search = ""] = location.hash.replace(/^#\//, "").split("?");
  const route: Route = ["accueil", "explorer", "saver", "projets"].includes(
    path,
  )
    ? (path as Route)
    : "accueil";
  const params = new URLSearchParams(search);
  const filter = params.get("filter");
  return {
    ...initial(route),
    query: params.get("q") || "",
    projectId: params.get("project"),
    expanded: params.get("reference"),
    archive: params.get("archive") === "1",
    filter: filter === "links" || filter === "notes" ? filter : "all",
  };
}
function toHash(state: NavigationState) {
  const p = new URLSearchParams();
  if (state.query) p.set("q", state.query);
  if (state.projectId) p.set("project", state.projectId);
  if (state.expanded) p.set("reference", state.expanded);
  if (state.archive) p.set("archive", "1");
  if (state.filter !== "all") p.set("filter", state.filter);
  return "#/" + state.route + (p.size ? "?" + p.toString() : "");
}
export function useWorkspaceNavigation() {
  const [state, setState] = useState(readLocation);
  const memory = useRef<Partial<Record<Route, NavigationState>>>({});
  useEffect(() => {
    const read = () => {
      const next = readLocation();
      memory.current[next.route] = next;
      setState(next);
    };
    window.addEventListener("hashchange", read);
    window.addEventListener("popstate", read);
    return () => {
      window.removeEventListener("hashchange", read);
      window.removeEventListener("popstate", read);
    };
  }, []);
  function write(next: NavigationState, replace = false) {
    memory.current[next.route] = next;
    const hash = toHash(next);
    if (hash !== location.hash)
      window.history[replace ? "replaceState" : "pushState"](null, "", hash);
    setState(next);
  }
  function update(patch: Partial<NavigationState>, replace = false) {
    write({ ...readLocation(), ...patch }, replace);
  }
  function navigate(route: Route) {
    const current = readLocation();
    memory.current[current.route] = current;
    write(memory.current[route] || initial(route));
  }
  return {
    ...state,
    navigate,
    openReference: (id: string) => {
      const current = readLocation();
      memory.current[current.route] = current;
      write({ ...initial("saver"), expanded: id });
    },
    setQuery: (query: string) => update({ query }, true),
    setProjectId: (projectId: string | null) =>
      update({ projectId, archive: false }),
    setExpanded: (expanded: string | null) => update({ expanded }),
    setArchive: (archive: boolean) => update({ archive }),
    setFilter: (filter: NavigationState["filter"]) => update({ filter }),
  };
}
