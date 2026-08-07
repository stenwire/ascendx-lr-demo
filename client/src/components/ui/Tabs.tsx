import { useState, type ReactNode } from "react";

export interface TabItem {
  id: string;
  label: string;
  content: ReactNode;
}

export function Tabs({ items, defaultId }: { items: TabItem[]; defaultId?: string }) {
  const [active, setActive] = useState(defaultId ?? items[0]?.id);
  const activeItem = items.find((item) => item.id === active) ?? items[0];

  return (
    <div>
      <div role="tablist" className="flex gap-1 border-b border-slate-200">
        {items.map((item) => {
          const selected = item.id === activeItem?.id;
          return (
            <button
              key={item.id}
              type="button"
              role="tab"
              aria-selected={selected}
              onClick={() => setActive(item.id)}
              className={`cursor-pointer border-b-2 px-3 py-2 text-sm font-medium transition-colors ${
                selected
                  ? "border-brand-700 text-brand-700"
                  : "border-transparent text-slate-500 hover:text-slate-900"
              }`}
            >
              {item.label}
            </button>
          );
        })}
      </div>
      <div role="tabpanel" className="pt-4">
        {activeItem?.content}
      </div>
    </div>
  );
}
