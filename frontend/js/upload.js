import { MAX_IMAGE_BYTES } from "./config.js";
import { validateImage } from "./validators.js";

export function initializeImageUpload(elements, onChange) {
  let selectedFile = null;
  let previewUrl = "";
  let busy = false;
  let selectionVersion = 0;

  elements.input.addEventListener("change", () => {
    if (!busy && elements.input.files?.[0]) void selectImage(elements.input.files[0]);
  });

  elements.zone.addEventListener("keydown", (event) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      elements.input.click();
    }
  });

  elements.zone.addEventListener("dragover", (event) => {
    event.preventDefault();
    if (busy) return;
    elements.zone.classList.add("is-dragging");
  });

  elements.zone.addEventListener("dragleave", () => elements.zone.classList.remove("is-dragging"));
  elements.zone.addEventListener("drop", (event) => {
    event.preventDefault();
    elements.zone.classList.remove("is-dragging");
    if (busy) return;
    const file = event.dataTransfer?.files?.[0];
    if (file) void selectImage(file);
  });

  elements.replaceButton.addEventListener("click", () => elements.input.click());
  elements.removeButton.addEventListener("click", remove);

  async function selectImage(file) {
    if (busy) return;
    const currentSelection = ++selectionVersion;
    const validationMessage = validateImage(file, MAX_IMAGE_BYTES);
    if (validationMessage) {
      selectedFile = null;
      clearPreview();
      onChange(null, validationMessage);
      return;
    }

    let objectUrl = "";
    try {
      const bitmap = await createImageBitmap(file);
      try {
        if (bitmap.width < 1 || bitmap.height < 1) throw new Error("The selected image has invalid dimensions.");
      } finally {
        bitmap.close();
      }
      if (currentSelection !== selectionVersion) return;
      objectUrl = URL.createObjectURL(file);
      const previousUrl = previewUrl;
      previewUrl = objectUrl;
      selectedFile = file;
      elements.previewImage.src = previewUrl;
      elements.previewName.textContent = file.name;
      elements.previewSize.textContent = `${(file.size / (1024 * 1024)).toFixed(2)} MB`;
      elements.zone.hidden = true;
      elements.preview.hidden = false;
      if (previousUrl) URL.revokeObjectURL(previousUrl);
      onChange(selectedFile, "");
    } catch (error) {
      if (objectUrl) URL.revokeObjectURL(objectUrl);
      if (currentSelection !== selectionVersion) return;
      console.error("Could not decode selected image.", error);
      selectedFile = null;
      clearPreview();
      onChange(null, "This file could not be read as an image. Choose a valid JPG, PNG, or WebP file.");
    }
  }

  function clearPreview() {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    previewUrl = "";
    elements.previewImage.removeAttribute("src");
    elements.previewName.textContent = "";
    elements.previewSize.textContent = "";
    elements.preview.hidden = true;
    elements.zone.hidden = false;
  }

  function remove() {
    if (busy) return;
    selectionVersion += 1;
    selectedFile = null;
    elements.input.value = "";
    clearPreview();
    onChange(null, "");
  }

  function setBusy(value) {
    busy = value;
    elements.input.disabled = value;
    elements.replaceButton.disabled = value;
    elements.removeButton.disabled = value;
    elements.zone.tabIndex = value ? -1 : 0;
    elements.zone.setAttribute("aria-disabled", String(value));
  }

  return {
    remove,
    setBusy
  };
}

export async function createThumbnail(file) {
  const bitmap = await createImageBitmap(file);
  try {
    const canvas = document.createElement("canvas");
    const scale = Math.min(1, 200 / Math.max(bitmap.width, bitmap.height));
    canvas.width = Math.max(1, Math.round(bitmap.width * scale));
    canvas.height = Math.max(1, Math.round(bitmap.height * scale));
    const context = canvas.getContext("2d");
    if (!context) throw new Error("A browser canvas is unavailable.");
    context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL("image/jpeg", 0.72);
  } finally {
    bitmap.close();
  }
}
