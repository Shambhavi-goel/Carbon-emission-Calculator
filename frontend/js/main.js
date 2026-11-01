import { redirectIfSignedIn } from "./authService.js?v=2";
import { initializeAuthUI } from "./authUI.js?v=2";

try {
  redirectIfSignedIn();
} catch (error) {
  console.error("Could not check the session.", error);
  const notice = document.getElementById("auth-error");
  notice.textContent = error.message || "Saved session could not be checked.";
  notice.hidden = false;
}

initializeAuthUI();
