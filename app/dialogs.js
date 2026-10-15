// The app's own questions, all in one native <dialog>: a choice between buttons, or a name entry.
// A native dialog traps focus, returns it afterwards and closes on Escape without any code here.

/**
 * @param {HTMLDialogElement} dialog An empty dialog; its contents are rebuilt for every question.
 * @returns {{
 *   choose: (options: {title: string, body: string, choices: {id: string, label: string, primary?: boolean}[]}) => Promise<string | null>,
 *   askName: (options: {title: string, label: string, value: string, confirmLabel: string, preview: (name: string) => string}) => Promise<string | null>
 * }}
 */
export function createDialogs(dialog) {
  const doc = dialog.ownerDocument;
  dialog.className = "app-dialog";

  function el(tag, className, text) {
    const node = doc.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
  }

  function button(label, value, className, validates = false) {
    const node = el("button", className, label);
    node.type = "submit";
    node.value = value;
    if (!validates) node.formNoValidate = true;
    return node;
  }

  // Resolves with the pressed button's value, or null when the dialog is dismissed.
  function ask(content) {
    if (dialog.open) dialog.close();
    dialog.returnValue = "";
    dialog.replaceChildren(content.form);
    return new Promise((resolve) => {
      dialog.addEventListener(
        "close",
        () => resolve(dialog.returnValue === "" || dialog.returnValue === "cancel" ? null : content.result()),
        { once: true },
      );
      dialog.showModal();
      content.focus?.();
    });
  }

  function formOf(title, ...parts) {
    const form = el("form", "dialog-body");
    form.method = "dialog";
    form.append(el("h2", "dialog-title", title), ...parts);
    return form;
  }

  return {
    choose({ title, body, choices }) {
      const row = el("div", "dialog-actions");
      for (const choice of choices) {
        row.append(button(choice.label, choice.id, choice.primary ? "btn btn-primary" : "btn", true));
      }
      const form = formOf(title, el("p", "dialog-text", body), row);
      return ask({ form, result: () => dialog.returnValue });
    },

    askName({ title, label, value, confirmLabel, preview }) {
      const field = el("label", "dialog-field");
      const input = el("input", "dialog-input");
      input.type = "text";
      input.required = true;
      input.maxLength = 60;
      input.value = value;
      input.autocomplete = "off";
      field.append(el("span", "dialog-label", label), input);
      const fileLine = el("p", "dialog-text dialog-preview");
      const showFile = () => {
        fileLine.textContent = `File name: ${preview(input.value)}`;
      };
      input.addEventListener("input", showFile);
      showFile();
      const row = el("div", "dialog-actions");
      // Enter in the field submits through the form's first submit button, so Cancel must not be one.
      const cancel = el("button", "btn", "Cancel");
      cancel.type = "button";
      cancel.addEventListener("click", () => dialog.close("cancel"));
      row.append(cancel, button(confirmLabel, "ok", "btn btn-primary", true));
      const form = formOf(title, field, fileLine, row);
      return ask({
        form,
        result: () => input.value.trim() || null,
        focus: () => {
          input.focus();
          input.select();
        },
      });
    },
  };
}
