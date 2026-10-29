"use client";

// The cohort graph and your connections in it, for any screen that needs them.
// Fetches the live cohort of signed-up residents from /api/residency/graph,
// falling back cleanly to the verified Dhun cohort residents.

import { useEffect, useState } from "react";
import { personId, type Connection, type Graph, type Snapshot } from "@/contract/residency";
import { DHUN_REAL_RESIDENTS, type Resident } from "@/data/residency";
import { useR } from "@/lib/f/residency";

const EMPTY_GRAPH: Graph = { nodes: [], edges: [] };

export interface CohortState {
  graph: Graph;
  mine: Connection[];
  people: Resident[];
  snapshots: Snapshot[];
  failed: boolean;
  loading: boolean;
}

export function useCohort(): CohortState {
  const snapshot = useR((s) => s.snapshot);
  const me = useR((s) => s.me);
  const myConnections = useR((s) => s.mine);

  const [state, setState] = useState<CohortState>({
    graph: EMPTY_GRAPH,
    mine: myConnections || [],
    people: DHUN_REAL_RESIDENTS,
    snapshots: [],
    failed: false,
    loading: true,
  });

  useEffect(() => {
    let active = true;

    async function loadCohort() {
      try {
        const res = await fetch("/api/residency/graph");
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();

        if (active && data) {
          const graph: Graph = {
            nodes: Array.isArray(data.nodes) ? data.nodes : [],
            edges: Array.isArray(data.edges) ? data.edges : [],
          };
          const residents: Resident[] = Array.isArray(data.residents) && data.residents.length > 0
            ? data.residents
            : DHUN_REAL_RESIDENTS;
          const snapshots: Snapshot[] = Array.isArray(data.snapshots) ? data.snapshots : [];

          const pid = personId(me);
          const dynamicMine = graph.edges.filter(
            (e): e is Connection => "why_connected" in e && (e.source === pid || e.target === pid)
          );

          setState({
            graph,
            mine: dynamicMine.length > 0 ? dynamicMine : myConnections || [],
            people: residents,
            snapshots,
            failed: false,
            loading: false,
          });
        }
      } catch (err) {
        console.warn("⚠️ [useCohort] Error fetching live cohort graph, using verified residents:", err);
        if (active) {
          setState((prev) => ({
            ...prev,
            failed: true,
            loading: false,
            people: DHUN_REAL_RESIDENTS,
          }));
        }
      }
    }

    loadCohort();

    return () => {
      active = false;
    };
  }, [snapshot, me, myConnections]);

  return state;
}

// The resident on the other end of one of your connections.
export const otherIn = (c: Connection, me: string) => (c.source === `person_${me}` ? c.target : c.source).replace(/^person_/, "");
