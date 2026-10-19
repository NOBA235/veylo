"use client";

import React from "react";
import { X, ShoppingBag, Trash2, PlusCircle } from "lucide-react";

export interface ShoppingItem {
  id?: string;
  product: string;
  quantity: number;
  notes?: string;
}

interface ShoppingListDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  items: ShoppingItem[];
  onRemoveItem?: (index: number) => void;
  onClearList?: () => void;
}

export function ShoppingListDrawer({
  isOpen,
  onClose,
  items,
  onRemoveItem,
  onClearList,
}: ShoppingListDrawerProps) {
  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex justify-end bg-zinc-950/40 backdrop-blur-xs animate-in fade-in duration-150"
      role="dialog"
      aria-modal="true"
      aria-label="Shopping List"
    >
      <div className="flex h-full w-full max-w-md flex-col border-l border-zinc-200 bg-white shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-zinc-200 px-4 py-3.5 sm:px-6">
          <div className="flex items-center gap-2.5">
            <div className="flex h-7 w-7 items-center justify-center rounded-md bg-zinc-100 text-zinc-700">
              <ShoppingBag className="h-4 w-4" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-semibold text-zinc-900">
                  Shopping list
                </h3>
                {items.length > 0 && (
                  <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-[10px] font-semibold text-zinc-700">
                    {items.length} {items.length === 1 ? "item" : "items"}
                  </span>
                )}
              </div>
              <p className="text-[11px] text-zinc-500">
                Identified products saved for your shopping trip
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            aria-label="Close shopping list"
            className="rounded p-1 text-zinc-400 transition-colors hover:bg-zinc-100 hover:text-zinc-700"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* List items */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-2">
          {items.length === 0 ? (
            <div className="py-16 text-center text-zinc-400">
              <PlusCircle className="mx-auto h-7 w-7 mb-2 text-zinc-300" />
              <p className="text-xs font-medium text-zinc-600">Your shopping list is empty</p>
              <p className="text-[11px] text-zinc-400 mt-1 max-w-xs mx-auto">
                Search for an item and tap &ldquo;Add to list&rdquo; to save it here.
              </p>
            </div>
          ) : (
            items.map((it, idx) => (
              <div
                key={idx}
                className="group flex items-start justify-between gap-3 rounded-lg border border-zinc-200 bg-white p-3 text-xs shadow-2xs hover:border-zinc-300 transition-colors"
              >
                <div className="min-w-0 flex-1">
                  <h4 className="font-semibold text-zinc-900 break-words">
                    {it.product}
                  </h4>
                  <div className="mt-1 flex items-center gap-2 text-zinc-500 text-[11px]">
                    <span>Qty: {it.quantity}</span>
                    {it.notes && (
                      <>
                        <span className="text-zinc-300">•</span>
                        <span className="truncate">{it.notes}</span>
                      </>
                    )}
                  </div>
                </div>

                {onRemoveItem && (
                  <button
                    onClick={() => onRemoveItem(idx)}
                    className="rounded p-1 text-zinc-300 transition-colors hover:bg-zinc-100 hover:text-zinc-700"
                    title="Remove item"
                    aria-label={`Remove ${it.product}`}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
            ))
          )}
        </div>

        {/* Footer */}
        {items.length > 0 && (
          <div className="border-t border-zinc-200 bg-zinc-50 px-4 py-3 sm:px-6 flex items-center justify-between">
            {onClearList && (
              <button
                onClick={onClearList}
                className="text-xs text-zinc-500 hover:text-rose-600 transition-colors font-medium"
              >
                Clear all
              </button>
            )}
            <button
              onClick={onClose}
              className="ml-auto rounded-lg bg-zinc-900 px-3.5 py-1.5 text-xs font-medium text-white transition-colors hover:bg-zinc-800"
            >
              Done
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
