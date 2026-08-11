"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";

export type DayRect = {
  left: number;
  top: number;
  width: number;
  height: number;
};

export type DayDragSnapshot = {
  sourceKey: string;
  hoverKey: string | null;
  originRect: DayRect;
  homes: Record<string, DayRect>;
};

type DayDragContextValue = {
  snapshot: DayDragSnapshot | null;
  beginDrag: (sourceKey: string, originRect: DayRect) => void;
  setHoverKey: (key: string | null) => void;
  endDrag: () => void;
  measureHomes: () => Record<string, DayRect>;
};

const DayDragContext = createContext<DayDragContextValue | null>(null);

function readRect(el: HTMLElement): DayRect {
  const r = el.getBoundingClientRect();
  return { left: r.left, top: r.top, width: r.width, height: r.height };
}

export function DayDragProvider({ children }: { children: ReactNode }) {
  const [snapshot, setSnapshot] = useState<DayDragSnapshot | null>(null);

  const measureHomes = useCallback(() => {
    const homes: Record<string, DayRect> = {};
    document.querySelectorAll<HTMLElement>("[data-day-key]").forEach((el) => {
      const key = el.dataset.dayKey;
      if (!key) return;
      // Prefer the layout shell so transforms on the visual layer do not skew homes
      homes[key] = readRect(el);
    });
    return homes;
  }, []);

  const beginDrag = useCallback(
    (sourceKey: string, originRect: DayRect) => {
      setSnapshot({
        sourceKey,
        hoverKey: null,
        originRect,
        homes: measureHomes(),
      });
    },
    [measureHomes],
  );

  const setHoverKey = useCallback((key: string | null) => {
    setSnapshot((prev) => {
      if (!prev) return prev;
      if (prev.hoverKey === key) return prev;
      return { ...prev, hoverKey: key };
    });
  }, []);

  const endDrag = useCallback(() => {
    setSnapshot(null);
  }, []);

  const value = useMemo(
    () => ({ snapshot, beginDrag, setHoverKey, endDrag, measureHomes }),
    [snapshot, beginDrag, setHoverKey, endDrag, measureHomes],
  );

  return <DayDragContext.Provider value={value}>{children}</DayDragContext.Provider>;
}

export function useDayDrag() {
  return useContext(DayDragContext);
}

/** Transform that moves a card from its home rect into the drag source slot. */
export function previewTransform(
  snapshot: DayDragSnapshot | null,
  dateKey: string,
): { transform: string; zIndex: number } | null {
  if (!snapshot || snapshot.hoverKey !== dateKey) return null;
  const home = snapshot.homes[dateKey];
  if (!home) return null;
  const dx = snapshot.originRect.left - home.left;
  const dy = snapshot.originRect.top - home.top;
  const sx = home.width ? snapshot.originRect.width / home.width : 1;
  const sy = home.height ? snapshot.originRect.height / home.height : 1;
  return {
    transform: `translate(${dx}px, ${dy}px) scale(${sx}, ${sy})`,
    zIndex: 30,
  };
}
