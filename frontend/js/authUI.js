import { signIn, signUp } from "./authService.js";
import { normalizeEmail, validateEmail, validateName, validatePassword } from "./validators.js";
import { clearFieldErrors, setFieldError, setFormBusy, showNotice } from "./ui.js";

const wait = (milliseconds) => new Promise((resolve) => window.setTimeout(resolve, milliseconds));

// ─── Demo credentials ────────────────────────────────────────────────────────
const DEMO_USER = {
  name: "Demo User",
  email: "demo@wasteimpact.app",
  password: "Demo@2026"
};

async function accessAsDemo() {
  // Try sign-in first; if account doesn't exist yet, create it silently.
  try {
    await signIn({ email: DEMO_USER.email, password: DEMO_USER.password });
  } catch {
    try {
      await signUp({ name: DEMO_USER.name, email: DEMO_USER.email, password: DEMO_USER.password });
    } catch {
      // Account might already exist with a different hash — do nothing; signIn above would have thrown
    }
    // Try sign-in one more time after creating
    try {
      await signIn({ email: DEMO_USER.email, password: DEMO_USER.password });
    } catch {
      // Best-effort; fall through to redirect
    }
  }
  await wait(150);
  window.location.assign("dashboard.html");
}

// ─── Main auth UI initializer ────────────────────────────────────────────────
export function initializeAuthUI() {
  const tabs = [...document.querySelectorAll('[role="tab"][aria-controls]')];
  const signInForm = document.getElementById("form-sign-in");
  const signUpForm = document.getElementById("form-sign-up");
  const errorNotice = document.getElementById("auth-error");
  const duplicateSwitch = document.getElementById("duplicate-switch");

  function activateTab(tab, focus = false) {
    for (const candidate of tabs) {
      const active = candidate === tab;
      candidate.setAttribute("aria-selected", String(active));
      candidate.tabIndex = active ? 0 : -1;
      document.getElementById(candidate.getAttribute("aria-controls")).hidden = !active;
    }
    showNotice(errorNotice, "");
    duplicateSwitch.hidden = true;
    if (focus) tab.focus();
  }

  for (const tab of tabs) {
    tab.addEventListener("click", () => activateTab(tab));
    tab.addEventListener("keydown", (event) => {
      if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
      event.preventDefault();
      const direction = event.key === "ArrowRight" ? 1 : -1;
      const index = tabs.indexOf(tab);
      activateTab(tabs[(index + direction + tabs.length) % tabs.length], true);
    });
  }

  document.querySelectorAll("[data-switch-tab]").forEach((button) => {
    button.addEventListener("click", () => {
      const tab = tabs.find((candidate) => candidate.id === button.dataset.switchTab);
      if (tab) activateTab(tab, true);
    });
  });

  duplicateSwitch.addEventListener("click", () => {
    const signInTab = tabs.find((tab) => tab.id === "tab-sign-in");
    if (signInTab) activateTab(signInTab, true);
    document.getElementById("signin-email").value = normalizeEmail(signUpForm.elements.email.value);
  });

  document.querySelectorAll("[data-password-toggle]").forEach((button) => {
    button.addEventListener("click", () => {
      const input = document.getElementById(button.dataset.passwordToggle);
      const visible = input.type === "password";
      input.type = visible ? "text" : "password";
      button.textContent = visible ? "Hide" : "Show";
      button.setAttribute("aria-pressed", String(visible));
      button.setAttribute("aria-label", visible ? "Hide password" : "Show password");
    });
  });

  signInForm.addEventListener("blur", (event) => {
    if (event.target.name === "email") setFieldError(event.target, validateEmail(event.target.value));
    if (event.target.name === "password") setFieldError(event.target, event.target.value ? "" : "Enter your password.");
  }, true);

  signUpForm.addEventListener("blur", (event) => {
    if (event.target.name === "name") setFieldError(event.target, validateName(event.target.value));
    if (event.target.name === "email") setFieldError(event.target, validateEmail(event.target.value));
    if (event.target.name === "password") setFieldError(event.target, validatePassword(event.target.value));
  }, true);

  signInForm.addEventListener("submit", (event) => {
    event.preventDefault();
    void submitSignIn(signInForm, errorNotice, duplicateSwitch);
  });

  signUpForm.addEventListener("submit", (event) => {
    event.preventDefault();
    void submitSignUp(signUpForm, errorNotice, duplicateSwitch);
  });

  // ── Demo access buttons ────────────────────────────────────────────────────
  const demoButtons = document.querySelectorAll("#demo-access-signin, #demo-access-signup");
  demoButtons.forEach((btn) => {
    btn.addEventListener("click", () => {
      btn.disabled = true;
      btn.textContent = "Opening demo…";
      void accessAsDemo().finally(() => {
        btn.disabled = false;
        btn.innerHTML = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M8 5v14l11-7-11-7Z" fill="currentColor"/></svg> Quick demo access`;
      });
    });
  });
}

async function submitSignIn(form, errorNotice, duplicateSwitch) {
  clearFieldErrors(form);
  showNotice(errorNotice, "");
  duplicateSwitch.hidden = true;
  setFieldError(form.elements.email, validateEmail(form.elements.email.value));
  setFieldError(form.elements.password, form.elements.password.value ? "" : "Enter your password.");
  if (form.querySelector('[aria-invalid="true"]')) return;

  setFormBusy(form, true, "Signing in…");
  try {
    await signIn({ email: form.elements.email.value, password: form.elements.password.value });
    await wait(250);
    window.location.assign("dashboard.html");
  } catch (error) {
    if (error.code !== "INVALID_CREDENTIALS") console.error("Sign-in failed.", error);
    showNotice(errorNotice, error.message || "Sign-in could not be completed. Try again.", true);
  } finally {
    setFormBusy(form, false);
  }
}

async function submitSignUp(form, errorNotice, duplicateSwitch) {
  clearFieldErrors(form);
  showNotice(errorNotice, "");
  duplicateSwitch.hidden = true;
  setFieldError(form.elements.name, validateName(form.elements.name.value));
  setFieldError(form.elements.email, validateEmail(form.elements.email.value));
  setFieldError(form.elements.password, validatePassword(form.elements.password.value));
  if (form.querySelector('[aria-invalid="true"]')) return;

  setFormBusy(form, true, "Creating account…");
  try {
    await signUp({
      name: form.elements.name.value.trim(),
      email: form.elements.email.value,
      password: form.elements.password.value
    });
    await wait(250);
    window.location.assign("dashboard.html");
  } catch (error) {
    if (error.code !== "EMAIL_EXISTS") console.error("Sign-up failed.", error);
    showNotice(errorNotice, error.message || "Account creation could not be completed. Try again.", true);
    duplicateSwitch.hidden = error.code !== "EMAIL_EXISTS";
  } finally {
    setFormBusy(form, false);
  }
}
