export function setFieldError(input, message) {
  const error = document.getElementById(`${input.id}-error`);
  input.setAttribute("aria-invalid", message ? "true" : "false");
  if (error) error.textContent = message;
}

export function clearFieldErrors(form) {
  for (const input of form.querySelectorAll("input")) {
    input.removeAttribute("aria-invalid");
    const error = document.getElementById(`${input.id}-error`);
    if (error) error.textContent = "";
  }
}

export function showNotice(element, message, isError = false) {
  element.textContent = message;
  element.hidden = !message;
  element.classList.toggle("notice-error", isError);
  element.classList.toggle("notice-warning", !isError && Boolean(message));
}

export function setFormBusy(form, busy, label) {
  const button = form.querySelector('button[type="submit"]');
  if (!button) return;
  if (busy) {
    button.dataset.originalLabel = button.textContent;
    button.textContent = label;
    button.disabled = true;
    form.setAttribute("aria-busy", "true");
  } else {
    button.textContent = button.dataset.originalLabel ?? button.textContent;
    delete button.dataset.originalLabel;
    button.disabled = false;
    form.removeAttribute("aria-busy");
  }
}
