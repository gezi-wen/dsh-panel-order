window.__ModuleLoader__.load({
  id: 'dsh-panel-order',
  factory(require) {
    void require;
    /** The list slot that holds the sidebar's global panel entries. */
    const SLOT = 'sidebar.panellist';
    /** Where the user's preferred id order is kept between reloads. */
    const STORAGE_KEY = 'dsh-panel-order.v1';
    /** Pointer travel in pixels before a press turns into a drag instead of a click. */
    const THRESHOLD = 4;
    /** Insertion indicators, used to reuse the panel row's own box shadow slot. */
    const INDICATOR_TOP = 'inset 0 2px 0 0 #4b8bf5';
    const INDICATOR_BOTTOM = 'inset 0 -2px 0 0 #4b8bf5';

    const warn = (message) => {
      try { console.warn('[dsh-panel-order] ' + message); } catch (error) { void error; }
    };

    const readPrefs = () => {
      try {
        const raw = window.localStorage.getItem(STORAGE_KEY);
        if (!raw) return null;
        const parsed = JSON.parse(raw);
        if (parsed && Array.isArray(parsed.ids)) {
          return parsed.ids.filter((id) => typeof id === 'string' && id.length > 0);
        }
      } catch (error) { warn('reading saved order failed'); }
      return null;
    };

    const writePrefs = (ids) => {
      try { window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ v: 1, ids })); } catch (error) { warn('saving order failed'); }
    };

    const labelText = (options) => {
      try {
        const raw = options && options.label;
        return typeof raw === 'function' ? String(raw()) : (raw === null || raw === undefined ? '' : String(raw));
      } catch (error) { return ''; }
    };

    return {
      inject: ['slots'],
      apply(ctx) {
        const slots = ctx.slots;
        if (!slots || typeof slots.entriesOfSlot !== 'function') {
          warn('slots service unavailable; panel order stays unchanged');
          return;
        }

        const entriesOf = () => {
          try { return slots.entriesOfSlot(SLOT) || []; } catch (error) { warn('reading panel entries failed'); return []; }
        };

        /** Bump the list slot so the sidebar recomputes its panel snapshot. */
        let nudgeSeq = 0;
        const nudge = () => {
          try {
            nudgeSeq += 1;
            const dispose = slots.register({
              name: SLOT,
              id: 'dsh-panel-order-nudge-' + nudgeSeq,
              order: 100000,
              label: 'order-nudge',
            }, () => null);
            if (typeof dispose === 'function') dispose();
          } catch (error) { warn('nudge failed'); }
        };

        /** Merge the preferred ids with whatever panels exist right now. */
        const orderedIds = (ids) => {
          const entries = entriesOf();
          const present = new Set();
          for (const entry of entries) {
            const options = entry && entry.options;
            if (options && options.id) present.add(options.id);
          }
          const result = [];
          for (const id of ids) {
            if (present.has(id) && result.indexOf(id) === -1) result.push(id);
          }
          for (const entry of entries) {
            const options = entry && entry.options;
            if (options && options.id && result.indexOf(options.id) === -1) result.push(options.id);
          }
          return result;
        };

        /** Write order values onto the live registrations, then persist and refresh. */
        const applyOrder = (ids, persist) => {
          const entries = entriesOf();
          if (entries.length === 0) return false;
          const byId = new Map();
          for (const entry of entries) {
            const options = entry && entry.options;
            if (options && options.id) byId.set(options.id, entry);
          }
          const sequence = orderedIds(ids);
          let changed = false;
          sequence.forEach((id, index) => {
            const entry = byId.get(id);
            if (!entry || !entry.options) return;
            const next = index * 10;
            if (entry.options.order === next) return;
            try {
              entry.options.order = next;
              changed = true;
            } catch (error) { warn('writing a panel order failed'); }
          });
          if (persist) writePrefs(sequence);
          if (changed) nudge();
          return changed;
        };

        const findNav = () => {
          const navs = Array.from(document.querySelectorAll('nav'));
          for (const nav of navs) {
            if (nav.querySelectorAll(':scope > button[aria-label]').length >= 2) return nav;
          }
          return null;
        };

        const panelLabels = () => {
          const labels = new Set();
          for (const entry of entriesOf()) {
            const text = labelText(entry && entry.options);
            if (text) labels.add(text);
          }
          return labels;
        };

        const panelButtons = (nav) => {
          const labels = panelLabels();
          return Array.from(nav.querySelectorAll(':scope > button[aria-label]'))
            .filter((button) => labels.has(button.getAttribute('aria-label')));
        };

        let drag = null;
        let suppressClick = false;
        let previousUserSelect = '';

        const onPointerDown = (event) => {
          if (event.button !== 0 || event.ctrlKey || event.metaKey || event.altKey || event.shiftKey) return;
          const nav = findNav();
          if (!nav || !nav.contains(event.target)) return;
          let button = event.target;
          while (button && button !== nav && !(button.tagName === 'BUTTON' && button.hasAttribute('aria-label'))) {
            button = button.parentElement;
          }
          if (!button || button === nav || button.parentElement !== nav) return;
          if (!panelLabels().has(button.getAttribute('aria-label'))) return;
          drag = {
            nav,
            button,
            startX: event.clientX,
            startY: event.clientY,
            active: false,
            insertAt: -1,
            marker: null,
            markerStyle: null,
            buttonOpacity: button.style.opacity,
          };
        };

        const onPointerMove = (event) => {
          if (!drag) return;
          const dx = Math.abs(event.clientX - drag.startX);
          const dy = Math.abs(event.clientY - drag.startY);
          if (!drag.active) {
            if (dx < THRESHOLD && dy < THRESHOLD) return;
            drag.active = true;
            drag.button.style.opacity = '0.35';
            previousUserSelect = document.body.style.userSelect;
            document.body.style.userSelect = 'none';
          }
          event.preventDefault();
          const buttons = panelButtons(drag.nav);
          let insertAt = buttons.length;
          for (let index = 0; index < buttons.length; index += 1) {
            const rect = buttons[index].getBoundingClientRect();
            if (event.clientY < rect.top + rect.height / 2) {
              insertAt = index;
              break;
            }
          }
          if (insertAt === drag.insertAt) return;
          if (drag.marker && drag.marker.isConnected) {
            drag.marker.style.boxShadow = drag.markerStyle === null ? '' : drag.markerStyle;
          }
          drag.marker = null;
          drag.markerStyle = null;
          drag.insertAt = insertAt;
          let marker = null;
          let style = INDICATOR_TOP;
          if (insertAt >= buttons.length) {
            marker = buttons[buttons.length - 1];
            style = INDICATOR_BOTTOM;
          } else {
            marker = buttons[insertAt];
          }
          if (marker && marker !== drag.button) {
            drag.marker = marker;
            drag.markerStyle = marker.style.boxShadow;
            marker.style.boxShadow = style;
          }
        };

        const onPointerUp = () => {
          const state = drag;
          drag = null;
          if (!state) return;
          if (state.marker && state.marker.isConnected) {
            state.marker.style.boxShadow = state.markerStyle === null ? '' : state.markerStyle;
          }
          state.button.style.opacity = state.buttonOpacity || '';
          if (!state.active) return;
          document.body.style.userSelect = previousUserSelect;
          suppressClick = true;
          window.setTimeout(() => { suppressClick = false; }, 0);
          const nav = state.nav && state.nav.isConnected ? state.nav : findNav();
          if (!nav) return;
          const buttons = panelButtons(nav);
          const labels = buttons.map((button) => button.getAttribute('aria-label'));
          const dragLabel = state.button.getAttribute('aria-label');
          const from = labels.indexOf(dragLabel);
          if (from === -1) return;
          const sequence = labels.slice();
          sequence.splice(from, 1);
          let target = state.insertAt;
          if (from < target) target -= 1;
          target = Math.max(0, Math.min(sequence.length, target));
          sequence.splice(target, 0, dragLabel);
          const labelToId = new Map();
          for (const entry of entriesOf()) {
            const options = entry && entry.options;
            if (!options || !options.id) continue;
            const text = labelText(options);
            if (text && !labelToId.has(text)) labelToId.set(text, options.id);
          }
          const ids = [];
          for (const label of sequence) {
            const id = labelToId.get(label);
            if (id) ids.push(id);
          }
          if (ids.length === 0) return;
          const saved = readPrefs() || [];
          for (const id of saved) {
            if (ids.indexOf(id) === -1) ids.push(id);
          }
          applyOrder(ids, true);
        };

        const onClickCapture = (event) => {
          if (!suppressClick) return;
          suppressClick = false;
          event.stopPropagation();
          event.preventDefault();
        };

        ctx.effect(() => {
          document.addEventListener('pointerdown', onPointerDown, true);
          window.addEventListener('pointermove', onPointerMove, { passive: false });
          window.addEventListener('pointerup', onPointerUp, true);
          window.addEventListener('pointercancel', onPointerUp, true);
          document.addEventListener('click', onClickCapture, true);
          return () => {
            document.removeEventListener('pointerdown', onPointerDown, true);
            window.removeEventListener('pointermove', onPointerMove);
            window.removeEventListener('pointerup', onPointerUp, true);
            window.removeEventListener('pointercancel', onPointerUp, true);
            document.removeEventListener('click', onClickCapture, true);
          };
        }, 'dsh-panel-order: drag handlers');

        if (typeof slots.subscribe === 'function') {
          ctx.effect(() => {
            let timer = 0;
            let unsubscribe = null;
            try {
              unsubscribe = slots.subscribe(SLOT, () => {
                window.clearTimeout(timer);
                timer = window.setTimeout(() => {
                  const saved = readPrefs();
                  if (saved && saved.length) applyOrder(saved, false);
                }, 150);
              });
            } catch (error) { warn('subscribing to panel entries failed'); }
            return () => {
              window.clearTimeout(timer);
              try { if (typeof unsubscribe === 'function') unsubscribe(); } catch (error) { void error; }
            };
          }, 'dsh-panel-order: panel entries subscription');
        }

        let attempts = 0;
        const boot = () => {
          attempts += 1;
          if (entriesOf().length > 0) {
            const saved = readPrefs();
            if (saved && saved.length > 0) applyOrder(saved, false);
            return;
          }
          if (attempts < 20) window.setTimeout(boot, 500);
        };
        window.setTimeout(boot, 400);
      },
    };
  },
});
