import { redirectIfSignedIn } from "./authService.js";
import { initializeAuthUI } from "./authUI.js";

try {
  redirectIfSignedIn();
} catch (error) {
  console.error("Could not check the session.", error);
  const notice = document.getElementById("auth-error");
  notice.textContent = error.message || "Saved session could not be checked.";
  notice.hidden = false;
}

initializeAuthUI();
