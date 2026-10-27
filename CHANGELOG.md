# Changelog

## 0.1.0 — 2026-10-27

- Initial release.
- Drag the sidebar's global panel entries to reorder them; the drag starts after a 4px pointer move so a plain click still opens the panel.
- Insertion line while dragging, and the collapsed rail keeps the same order.
- Order is persisted in `localStorage` under `dsh-panel-order.v1` and replayed on every page load.
