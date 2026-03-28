import { useState } from "react";

export type Panel = "list" | "detail" | "links";

const PANEL_ORDER: Panel[] = ["list", "detail", "links"];

export interface NavigationState {
  activePanel: Panel;
  selectedListIndex: number;
  selectedLinkIndex: number;
  filterFocused: boolean;
}

export function useNavigation() {
  const [activePanel, setActivePanel] = useState<Panel>("list");
  const [selectedListIndex, setSelectedListIndex] = useState(0);
  const [selectedLinkIndex, setSelectedLinkIndex] = useState(0);
  const [filterFocused, setFilterFocused] = useState(false);

  function cyclePanel() {
    const current = PANEL_ORDER.indexOf(activePanel);
    const next = PANEL_ORDER[(current + 1) % PANEL_ORDER.length];
    if (next) {
      setActivePanel(next);
    }
  }

  function focusFilter() {
    setFilterFocused(true);
  }

  function blurFilter() {
    setFilterFocused(false);
  }

  function navigateDown(listLength: number) {
    if (activePanel === "list") {
      setSelectedListIndex((i) => Math.min(i + 1, Math.max(0, listLength - 1)));
    } else if (activePanel === "links") {
      setSelectedLinkIndex((i) => Math.min(i + 1, Math.max(0, listLength - 1)));
    }
  }

  function navigateUp() {
    if (activePanel === "list") {
      setSelectedListIndex((i) => Math.max(0, i - 1));
    } else if (activePanel === "links") {
      setSelectedLinkIndex((i) => Math.max(0, i - 1));
    }
  }

  function resetListIndex() {
    setSelectedListIndex(0);
  }

  function resetLinkIndex() {
    setSelectedLinkIndex(0);
  }

  return {
    activePanel,
    blurFilter,
    cyclePanel,
    filterFocused,
    focusFilter,
    navigateDown,
    navigateUp,
    resetLinkIndex,
    resetListIndex,
    selectedLinkIndex,
    selectedListIndex,
    setActivePanel,
    setSelectedLinkIndex,
    setSelectedListIndex,
  };
}
