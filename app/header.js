// The header: the View/Edit switch, the map name with its unsaved mark, and the file buttons.

const APP_NAME = "AltHistoryMap";

/**
 * @param {{
 *   root: HTMLElement,
 *   state: {get: () => object, set: (patch: object) => void, subscribe: Function},
 *   model: {name: string},
 *   actions: {isDirty: () => boolean, open: Function, save: Function, saveAs: Function, exportPng: Function}
 * }} deps
 * @returns {{refresh: () => void, setNarrow: (narrow: boolean) => void}} `refresh` re-reads the name and unsaved
 *   mark; `setNarrow` disables Edit and shows the note when the window is too narrow to edit in.
 */
export function bindHeader({ root, state, model, actions }) {
  const radios = [...root.querySelectorAll('input[name="mode"]')];
  const nameEl = root.querySelector('[data-role="map-name"]');
  const dirtyEls = root.querySelectorAll('[data-role="dirty"]');
  const note = root.querySelector('[data-role="edit-note"]');
  const editRadio = radios.find((radio) => radio.value === "edit");

  for (const radio of radios) {
    radio.addEventListener("change", () => {
      if (radio.checked) state.set({ mode: radio.value });
    });
  }
  const buttons = {
    open: actions.open,
    save: actions.save,
    "save-as": actions.saveAs,
    png: actions.exportPng,
  };
  for (const [name, run] of Object.entries(buttons)) {
    root.querySelector(`[data-action="${name}"]`).addEventListener("click", () => run());
  }

  function syncMode() {
    const { mode } = state.get();
    for (const radio of radios) radio.checked = radio.value === mode;
  }
  state.subscribe((value, changed) => {
    if (changed.includes("mode")) syncMode();
  });
  syncMode();

  function refresh() {
    const dirty = actions.isDirty();
    nameEl.textContent = model.name;
    for (const mark of dirtyEls) mark.hidden = !dirty;
    document.title = `${model.name}${dirty ? " *" : ""} — ${APP_NAME}`;
  }

  return {
    refresh,
    setNarrow(narrow) {
      editRadio.disabled = narrow;
      note.hidden = !narrow;
    },
  };
}
