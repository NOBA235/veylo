"use client";

import React from "react";
import { X, ShoppingBag, Trash2, ListPlus } from "lucide-react";

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
    <div className="fixed inset-0 z-50 overflow-hidden bg-slate-900/40 backdrop-blur-xs flex justify-end animate-in fade-in duration-150">
      <div className="w-full max-w-md bg-white h-full shadow-2xl flex flex-col border-l border-slate-200">
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-slate-200 flex items-center justify-between bg-slate-50/80">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-slate-900 text-white rounded-lg">
              <ShoppingBag className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-semibold text-slate-900 text-base">Shopping List</h3>
              <p className="text-xs text-slate-500">
                Created via MCP <code className="text-[11px] font-mono">create_shopping_list</code>
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-200/60 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* List Items */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {items.length === 0 ? (
            <div className="text-center py-12 text-slate-400 text-xs">
              <ListPlus className="w-8 h-8 mx-auto mb-2 opacity-50" />
              <span>Your shopping list is empty. Add identified products from search results!</span>
            </div>
          ) : (
            items.map((it, idx) => (
              <div
                key={idx}
                className="flex items-start justify-between gap-3 p-3.5 bg-slate-50 rounded-xl border border-slate-200 text-xs"
              >
                <div>
                  <h4 className="font-semibold text-slate-900 text-sm">{it.product}</h4>
                  <div className="flex items-center gap-2 mt-1 text-slate-500">
                    <span>Qty: {it.quantity}</span>
                    {it.notes && (
                      <>
                        <span>•</span>
                        <span className="italic">{it.notes}</span>
                      </>
                    )}
                  </div>
                </div>

                {onRemoveItem && (
                  <button
                    onClick={() => onRemoveItem(idx)}
                    className="p-1 text-slate-400 hover:text-rose-600 rounded transition-colors"
                    title="Remove item"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </div>
            ))
          )}
        </div>

        {/* Footer */}
        {items.length > 0 && (
          <div className="p-4 border-t border-slate-200 bg-slate-50 flex items-center justify-between">
            {onClearList && (
              <button
                onClick={onClearList}
                className="text-xs text-rose-600 hover:text-rose-700 font-medium"
              >
                Clear All
              </button>
            )}
            <button
              onClick={onClose}
              className="px-4 py-2 bg-slate-900 text-white rounded-lg text-xs font-medium hover:bg-slate-800 transition-colors ml-auto"
            >
              Done
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

