import type { ReactNode } from "react";

export function StockButton({ children, code, onOpen }: { children: ReactNode; code?: string | null; onOpen: (code: string) => void }) {
  const normalized = code?.trim();
  if (!normalized) {
    return <>{children}</>;
  }
  return (
    <button className="stock-link" onClick={() => onOpen(normalized)} type="button">
      {children}
    </button>
  );
}
