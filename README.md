# dsh-panel-order

Drag the sidebar's global panel entries into the order you want — the same gesture the session list already uses. The order survives reloads.

DeepSeek Harness sorts the global panel icons in the sidebar (Plugins, Skill / MCP, Plugin Market, Scheduled Tasks, Memory, …) by the `order` value each plugin passes when it registers into the `sidebar.panellist` slot. That value is fixed at registration time and there is no user-facing control for it, while the session list right below can be reordered by dragging.

This plugin adds the missing gesture: press a panel row, drag it, drop it.

## Features

- Drag any global panel row to move it up or down.
- The drag starts only after the pointer travels more than 4px, so a plain click still opens the panel.
- A blue line marks the insertion point while dragging.
- Works in the expanded sidebar and in the collapsed icon rail; both use the same order.
- “More” always stays at the bottom.
- The order is saved and replayed on every page load.
- Panels you have never dragged (for example a plugin installed later) are appended after the ones you already arranged, never shuffled into the middle.
- Uninstalling restores the plain plugin-registration order on the next load.

## Install

### From a local checkout

Register the directory as a bundle in the profile that runs your Web UI:

```
dsh plugin --profile <profile-name> add link:<absolute-path-to-this-checkout>
```

The CLI forwards the request to pnpm and maintains the profile's bundle list itself; do not edit the profile manifest by hand. If you use a plugin manager UI with an “install bundle” action, point it at the same directory.

Restart or reload the page afterwards — the bundle registers a Client module, so the browser has to reload it.

### Requirements

- DeepSeek Harness 0.2.x with the Web UI (the desktop app, or a served web instance).
- No external dependencies, no services, no API keys, no build step.

## Usage

1. Press and hold a row in the sidebar's global panel list.
2. Move the pointer more than 4px and keep moving; the row turns translucent and a blue insertion line follows the pointer.
3. Release to drop. The list reorders immediately.
4. Reload whenever you like — the order is kept.

Saved order lives in `localStorage` under the key `dsh-panel-order.v1`. Clearing site data resets it.

## How it works

1. Read the live panel registry through `ctx.slots.entriesOfSlot('sidebar.panellist')`, which yields each entry's `id`, `order` and `label`.
2. On drop, write new `order` values (`0, 10, 20, …`) onto those registration objects.
3. Bump the list slot so the sidebar recomputes its panel snapshot — register a throwaway entry and dispose it immediately — which re-renders the rows in the new order and keeps DOM order, `Tab` order and the “More” menu consistent.
4. Persist the id sequence and replay it on every load.

Steps 2 and 3 use internals that upstream does not document as a stable API. The failure mode if upstream changes them is “dragging has no effect”: the sidebar, the panels and other plugins keep working, and uninstalling the plugin leaves no trace.

## Limitations

- Rows are matched to entries by their rendered label. Two panels that expose the identical label are left untouched instead of being sorted against each other.
- Panels pinned into “More” keep their relative position; only the visible rows are reordered by a drag.
- The saved order is kept in `localStorage`, which is scoped to the page origin. The desktop app serves the UI from a fixed port, so the order survives restarts there; a web instance started with a random port (`--port 0`) gets a new origin and falls back to the registration order.
- No keyboard reordering yet — the drag is a pointer gesture.

## Compatibility

- DeepSeek Harness 0.2.x, Web UI only (the desktop app and served web instances share the Client module format).
- Upstream discussion about making panel order a first-class feature: [deepseek-harness discussions #11198](https://github.com/deepseek-ai/deepseek-harness/discussions/11198).

## Development

```
npm test
```

The test is a static check: manifest fields, bundle patch, Client module syntax and identity, locale resources, icon format and size, and the host entry point. Behavior is verified against a live Web UI by dragging a row and reloading the page.

```
client.js      Client module: drag handling, order writes, persistence
index.js       Host half (empty; the bundle only needs a Client module)
cordis.patch.yml  Bundle patch that inserts the plugin row
locale/en.json Localized plugin title and description (also zh.json)
icon.svg       Plugin icon
scripts/check.mjs  Static checks behind `npm test`
```

## License

Apache-2.0. See [LICENSE](LICENSE).
