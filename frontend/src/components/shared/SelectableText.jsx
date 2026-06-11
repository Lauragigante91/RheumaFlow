/**
 * SelectableText
 *
 * Wraps any read-only text content (static <p>, <div>, etc.) with
 * text-selection detection. When the physician highlights text within the
 * wrapped content, a SelectionActionMenu appears with configurable actions.
 *
 * The menu is rendered via a portal (position:fixed) so it is never clipped
 * by ancestor overflow:hidden containers.
 *
 * Props:
 *   children    ReactNode — the static text content to display
 *   makeActions (selectedText: string) => Action[]
 *               Factory that builds the action list for the currently selected text.
 *               Action shape: { key, label, icon, color, bg, group, handler }
 *   minLength   number — minimum selected chars to trigger menu (default 3)
 *   className   string
 *   style       object
 */

import React, { useRef, useState, useCallback, useEffect } from "react";
import SelectionActionMenu from "./SelectionActionMenu";

/** Compute fixed-position coords for the menu anchored below the selection. */
function computeMenuPos(range) {
  const selRect = range.getBoundingClientRect();
  const menuW = 340;
  const menuH = 320; // rough estimate for flip logic

  // Prefer right-aligned to selection end, but clamp to viewport
  let left = selRect.right - menuW;
  if (left < 8) left = 8;
  if (left + menuW > window.innerWidth - 8) left = window.innerWidth - menuW - 8;

  // Below selection by default; flip above if not enough room
  let top = selRect.bottom + 6;
  if (top + menuH > window.innerHeight - 8) {
    top = selRect.top - menuH - 6;
    if (top < 8) top = 8;
  }

  return { top, left };
}

export default function SelectableText({
  children,
  makeActions,
  minLength = 3,
  className,
  style,
}) {
  const containerRef = useRef(null);
  const [menu, setMenu] = useState({ visible: false, text: "", pos: null });

  const handleMouseUp = useCallback(() => {
    // Small delay so the browser finishes updating the selection
    setTimeout(() => {
      const selection = window.getSelection();
      if (!selection || selection.isCollapsed) {
        setMenu(m => ({ ...m, visible: false }));
        return;
      }

      const text = selection.toString().trim();
      if (!text || text.length < minLength) {
        setMenu(m => ({ ...m, visible: false }));
        return;
      }

      // Only trigger if the selection is fully within this container
      if (!containerRef.current) return;
      const range = selection.getRangeAt(0);
      if (!containerRef.current.contains(range.commonAncestorContainer)) {
        return;
      }

      const pos = computeMenuPos(range);
      setMenu({ visible: true, text, pos });
    }, 30);
  }, [minLength]);

  const closeMenu = useCallback(() => {
    setMenu({ visible: false, text: "", pos: null });
  }, []);

  // Close when clicking outside the container — exclude portal (.sam-portal) clicks
  useEffect(() => {
    if (!menu.visible) return;
    const handler = (e) => {
      if (
        !containerRef.current?.contains(e.target) &&
        !e.target.closest?.(".sam-portal")
      ) {
        closeMenu();
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [menu.visible, closeMenu]);

  const actions = menu.visible && makeActions ? makeActions(menu.text) : [];

  return (
    <div
      ref={containerRef}
      style={{ position: "relative", ...style }}
      className={className}
      onMouseUp={handleMouseUp}
    >
      {children}

      {menu.visible && actions.length > 0 && menu.pos && (
        <SelectionActionMenu
          actions={actions}
          onClose={closeMenu}
          style={menu.pos}
        />
      )}
    </div>
  );
}
