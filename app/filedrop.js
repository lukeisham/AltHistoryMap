// Dropping a map file anywhere on the page opens it. Without this the browser would navigate to the file.

/**
 * @param {{target: Document | HTMLElement, onFile: (file: File) => void}} deps
 */
export function bindFileDrop({ target, onFile }) {
  const carriesFiles = (event) => Boolean(event.dataTransfer?.types.includes("Files"));
  target.addEventListener("dragover", (event) => {
    if (!carriesFiles(event)) return;
    event.preventDefault();
    event.dataTransfer.dropEffect = "copy";
  });
  target.addEventListener("drop", (event) => {
    if (!carriesFiles(event)) return;
    event.preventDefault();
    const file = event.dataTransfer.files[0];
    if (file) onFile(file);
  });
}
