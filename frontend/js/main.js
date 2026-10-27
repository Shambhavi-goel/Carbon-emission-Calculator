/**
 * Main Application Bootstrapper & Event Orchestrator
 * Connects Upload, Weight, Result, History, Charts, and Account & Rewards modules.
 */

import { UploadController } from "./upload.js";
import { WeightController } from "./weight.js";
import { ResultController } from "./result.js";
import { HistoryController } from "./history.js";
import { ChartsController } from "./charts.js";
import { AccountController, REWARDS_CATALOG, ECO_ACHIEVEMENTS } from "./account.js";
import { predict, ApiError } from "./api.js";
import { escapeHtml } from "./utils.js";

function startApp() {
  // 1. Navigation & Mobile Drawer
  setupNavigation();

  // 2. Initialize Account & Eco-Points Controller
  const accountCtrl = new AccountController({
    onPointsChanged: (newBalance, delta) => {
      updateAccountUI();
      renderRewardsCatalog();
      if (delta > 0) {
        showToast(`🌿 +${delta} Green Points added to your account!`);
      } else if (delta < 0) {
        showToast(`🎁 Reward redeemed! ${Math.abs(delta)} points used.`);
      }
    },
    onUserChanged: () => {
      updateAccountUI();
      renderRewardsCatalog();
    }
  });

  // 3. Calculator UI references
  const calcBtn = document.getElementById("btn-calculate");
  const calcStatusHint = document.getElementById("calc-status-hint");
  const resultContainer = document.getElementById("result-column-container");
  const liveAnnouncer = document.getElementById("calc-live-announcer");

  let currentAbortController = null;
  let slowTimerId = null;

  // 4. Initialize Result Controller with Account link
  const resultCtrl = new ResultController({
    containerEl: resultContainer,
    liveAnnouncerEl: liveAnnouncer,
    accountController: accountCtrl,
    onAddToHistory: (historyEntry) => {
      historyCtrl.addItem(historyEntry);
      // Award Green Points to Account
      const earned = historyEntry.pointsEarned || 25;
      accountCtrl.awardPoints(earned, `Classified & logged: ${historyEntry.class} (${historyEntry.weight} ${historyEntry.unit})`);
    }
  });
  resultCtrl.showEmpty();

  // 5. Initialize Charts Controller
  const chartsCtrl = new ChartsController({});

  // 6. Initialize History Controller
  const historyCtrl = new HistoryController({
    tableBodyEl: document.getElementById("history-table-body"),
    emptyStateEl: document.getElementById("history-empty-state"),
    totalsBarEl: document.getElementById("history-totals-bar"),
    totalFootprintEl: document.getElementById("history-total-footprint"),
    totalRangeEl: document.getElementById("history-total-range"),
    totalCountEl: document.getElementById("history-total-count"),
    clearBtnEl: document.getElementById("btn-clear-history"),
    exportBtnEl: document.getElementById("btn-export-csv"),
    onHistoryUpdated: (items) => {
      chartsCtrl.update(items);
    }
  });

  chartsCtrl.update(historyCtrl.getItems());

  // 7. Initialize Weight Controller
  const weightInput = document.getElementById("input-weight");
  const weightCtrl = new WeightController({
    inputEl: weightInput,
    unitRadios: document.querySelectorAll("input[name='weight-unit']"),
    convertedPreviewEl: document.getElementById("weight-converted-preview"),
    errorEl: document.getElementById("weight-error-msg"),
    chipButtons: document.querySelectorAll(".chip[data-weight]"),
    helpTriggerEl: document.getElementById("btn-weight-help"),
    helpPopoverEl: document.getElementById("popover-weight-help"),
    onChange: () => updateFormState()
  });

  // 8. Initialize Upload Controller
  const uploadCtrl = new UploadController({
    dropzoneEl: document.getElementById("upload-dropzone"),
    fileInputEl: document.getElementById("input-file-browse"),
    cameraInputEl: document.getElementById("input-file-camera"),
    previewContainerEl: document.getElementById("upload-preview-box"),
    previewImgEl: document.getElementById("upload-preview-img"),
    previewNameEl: document.getElementById("upload-preview-name"),
    previewSizeEl: document.getElementById("upload-preview-size"),
    removeBtnEl: document.getElementById("btn-upload-remove"),
    replaceBtnEl: document.getElementById("btn-upload-replace"),
    exampleBtnEl: document.getElementById("btn-try-example"),
    errorEl: document.getElementById("upload-error-msg"),
    onFileSelected: () => {
      if (!weightCtrl.getValue().isValid) {
        weightInput.focus();
      }
      updateFormState();
    },
    onFileRemoved: () => {
      updateFormState();
    }
  });

  // Update Calculate button enablement
  function updateFormState() {
    const hasImage = uploadCtrl.hasFile();
    const weightVal = weightCtrl.getValue();

    if (hasImage && weightVal.isValid) {
      calcBtn.disabled = false;
      calcStatusHint.textContent = "";
    } else {
      calcBtn.disabled = true;
      if (!hasImage && !weightVal.isValid) {
        calcStatusHint.textContent = "Add a photo and a weight to continue";
      } else if (!hasImage) {
        calcStatusHint.textContent = "Upload a photo to continue";
      } else {
        calcStatusHint.textContent = "Enter a valid weight to continue";
      }
    }
  }

  // 9. Wire Calculate Action
  calcBtn.addEventListener("click", async () => {
    await performCalculation();
  });

  async function performCalculation() {
    const uploadData = uploadCtrl.getData();
    const weightVal = weightCtrl.getValue();

    if (!uploadData.blob || !weightVal.isValid) {
      weightCtrl.validate(true);
      return;
    }

    setLoadingState(true);
    resultCtrl.showSkeleton();

    currentAbortController = new AbortController();

    // 15 second slow response indicator
    slowTimerId = setTimeout(() => {
      calcStatusHint.innerHTML = `
        This is taking longer than usual. 
        <button type="button" class="btn-ghost btn-sm" id="btn-cancel-request" style="padding: 2px 6px; text-decoration: underline;">
          Cancel
        </button>
      `;
      const cancelBtn = document.getElementById("btn-cancel-request");
      if (cancelBtn) {
        cancelBtn.addEventListener("click", () => {
          if (currentAbortController) {
            currentAbortController.abort();
          }
        });
      }
    }, 15000);

    try {
      const result = await predict(
        uploadData.blob,
        weightVal.weight,
        weightVal.unit,
        currentAbortController.signal
      );

      clearTimeout(slowTimerId);
      setLoadingState(false);

      await resultCtrl.renderResult({
        predictionData: result,
        weight: weightVal.weight,
        unit: weightVal.unit,
        weightKg: result.weight_kg || weightVal.weightKg,
        thumbnailUrl: uploadData.thumbnailUrl,
        userCorrected: false
      });
    } catch (err) {
      clearTimeout(slowTimerId);
      setLoadingState(false);

      console.error("[App] Calculation failed:", err);

      if (err instanceof ApiError) {
        if (err.status === 400 || err.status === 413 || err.status === 422) {
          uploadCtrl.setError(err.detail || err.message);
          resultCtrl.showError(err.detail || err.message, () => performCalculation());
        } else if (err.status === 408) {
          resultCtrl.showError("The calculation timed out. Please verify your connection and try again.", () => performCalculation());
        } else {
          resultCtrl.showError(
            "Could not reach the server. Check that the backend is running, then try again.",
            () => performCalculation()
          );
        }
      } else {
        resultCtrl.showError(
          "Could not reach the server. Check that the backend is running, then try again.",
          () => performCalculation()
        );
      }
    }
  }

  function setLoadingState(isLoading) {
    if (isLoading) {
      calcBtn.disabled = true;
      calcBtn.innerHTML = `
        <span class="btn-spinner" aria-hidden="true"></span>
        <span>Analysing...</span>
      `;
      weightInput.disabled = true;
      calcStatusHint.textContent = "Processing image classification...";
    } else {
      calcBtn.innerHTML = `
        <svg width="20" height="20" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
        </svg>
        <span>Calculate footprint</span>
      `;
      weightInput.disabled = false;
      calcStatusHint.textContent = "";
      updateFormState();
    }
  }

  // 10. Rewards Catalog Rendering & Redemptions
  function renderRewardsCatalog() {
    const rewardsGrid = document.getElementById("rewards-grid");
    if (!rewardsGrid) return;

    const user = accountCtrl.getUser();
    const currentPoints = accountCtrl.getPoints();

    rewardsGrid.innerHTML = REWARDS_CATALOG.map(reward => {
      const canAfford = currentPoints >= reward.pointsCost;
      const ptsNeeded = reward.pointsCost - currentPoints;

      return `
        <div class="reward-card">
          <div class="reward-card-top">
            <div class="reward-badge-row">
              <span class="reward-category">${escapeHtml(reward.category)}</span>
              <span class="reward-cost-tag">${reward.pointsCost} pts</span>
            </div>
            <h3 class="reward-title">${escapeHtml(reward.title)}</h3>
            <p class="reward-desc">${escapeHtml(reward.description)}</p>
          </div>
          <button type="button" class="btn ${canAfford ? 'btn-primary' : 'btn-secondary'} reward-btn btn-redeem-item" data-id="${reward.id}" ${canAfford ? '' : 'disabled'}>
            ${canAfford ? 'Redeem Reward' : `Need ${ptsNeeded} more pts`}
          </button>
        </div>
      `;
    }).join("");

    rewardsGrid.querySelectorAll(".btn-redeem-item").forEach(btn => {
      btn.addEventListener("click", () => {
        const id = btn.getAttribute("data-id");
        const outcome = accountCtrl.redeemReward(id);
        if (outcome.success) {
          showRedemptionSuccessModal(outcome);
        } else {
          alert(outcome.message);
        }
      });
    });
  }

  // 11. Account UI, Dropdown & Multi-Section Dashboard System
  function updateAccountUI() {
    const user = accountCtrl.getUser();
    const points = accountCtrl.getPoints();
    const isLogged = accountCtrl.isLoggedIn();

    // 0. Toggle Authenticated App Content (Calculator, History, Rewards, Account)
    const authContent = document.getElementById("authenticated-app-content");
    if (authContent) {
      authContent.style.display = isLogged ? "block" : "none";
    }

    // Toggle Desktop and Mobile Navigation Links
    const authNavLinks = document.querySelectorAll(".auth-nav-link");
    authNavLinks.forEach(link => {
      link.style.display = isLogged ? "" : "none";
    });

    // Toggle Hero Actions (Calculate Footprint / Rewards buttons)
    const heroCtaActions = document.getElementById("hero-cta-actions");
    if (heroCtaActions) {
      heroCtaActions.style.display = isLogged ? "flex" : "none";
    }

    // 1. Header Navigation elements (Person Icon + Dropdown)
    const userMenuWrapper = document.getElementById("user-menu-wrapper");
    const navLoginBtn = document.getElementById("btn-nav-login");
    const navPointsEl = document.getElementById("header-user-points");
    const navUsernameEl = document.getElementById("header-user-name");
    const userDropdown = document.getElementById("user-account-dropdown");

    if (isLogged) {
      if (userMenuWrapper) userMenuWrapper.style.display = "inline-flex";
      if (navLoginBtn) navLoginBtn.style.display = "none";
      if (navPointsEl) navPointsEl.textContent = `${points} pts`;
      if (navUsernameEl) navUsernameEl.textContent = user.fullName || user.username || "EcoChampion";

      // Populate Dropdown Meta
      const initials = (user.fullName || user.username || "EC")
        .split(" ")
        .map(n => n[0])
        .join("")
        .toUpperCase()
        .slice(0, 2);

      const ddAvatar = document.getElementById("dropdown-avatar-initials");
      const ddName = document.getElementById("dropdown-user-name");
      const ddEmail = document.getElementById("dropdown-user-email");
      const ddTier = document.getElementById("dropdown-user-tier");
      const ddPoints = document.getElementById("dropdown-user-points");
      const ddCo2 = document.getElementById("dropdown-user-co2");
      const ddDiverted = document.getElementById("dropdown-user-diverted");

      if (ddAvatar) ddAvatar.textContent = initials;
      if (ddName) ddName.textContent = user.fullName || user.username;
      if (ddEmail) ddEmail.textContent = user.email || "champion@ecotrack.local";
      if (ddTier) ddTier.textContent = user.tier || "Green Explorer";
      if (ddPoints) ddPoints.textContent = `${points} pts`;
      if (ddCo2) ddCo2.textContent = `${(Number(user.totalCarbonAvoidedKg) || 0).toFixed(2)} kg`;
      if (ddDiverted) ddDiverted.textContent = `${(Number(user.totalWasteDivertedKg) || 0).toFixed(2)} kg`;
    } else {
      if (userMenuWrapper) userMenuWrapper.style.display = "none";
      if (navLoginBtn) navLoginBtn.style.display = "inline-flex";
      if (userDropdown) userDropdown.classList.remove("is-open");
    }

    // 2. Home Page Hero Right Column (Auth Card vs Logged-In Snapshot)
    const heroAuthCard = document.getElementById("hero-auth-card");
    const heroLoggedCard = document.getElementById("hero-logged-in-snapshot");
    const heroBalanceEl = document.getElementById("hero-user-points");
    const rewardsBalanceEl = document.getElementById("rewards-available-points");

    if (heroBalanceEl) heroBalanceEl.textContent = `${points} pts`;
    if (rewardsBalanceEl) rewardsBalanceEl.textContent = `${points} pts`;

    if (!isLogged) {
      if (heroAuthCard) heroAuthCard.style.display = "block";
      if (heroLoggedCard) heroLoggedCard.style.display = "none";
    } else {
      if (heroAuthCard) heroAuthCard.style.display = "none";
      if (heroLoggedCard) heroLoggedCard.style.display = "flex";

      const heroAvatar = document.getElementById("hero-avatar-initials");
      const heroName = document.getElementById("hero-greeting-name");
      const heroTier = document.getElementById("hero-greeting-tier");
      const heroCo2 = document.getElementById("hero-stat-co2");
      const heroDiverted = document.getElementById("hero-stat-diverted");

      const firstName = (user.fullName || user.username || "Explorer").split(" ")[0];
      const initials = (user.fullName || user.username || "EC")
        .split(" ")
        .map(n => n[0])
        .join("")
        .toUpperCase()
        .slice(0, 2);

      if (heroAvatar) heroAvatar.textContent = initials;
      if (heroName) heroName.textContent = firstName;
      if (heroTier) heroTier.textContent = user.tier || "Green Explorer";
      if (heroCo2) heroCo2.textContent = `${(Number(user.totalCarbonAvoidedKg) || 0).toFixed(2)} kg CO₂e`;
      if (heroDiverted) heroDiverted.textContent = `${(Number(user.totalWasteDivertedKg) || 0).toFixed(2)} kg`;
    }

    // 3. Section #account State Toggling
    const guestView = document.getElementById("account-guest-view");
    const loggedInView = document.getElementById("account-logged-in-view");

    if (!isLogged) {
      if (guestView) guestView.style.display = "block";
      if (loggedInView) loggedInView.style.display = "none";
    } else {
      if (guestView) guestView.style.display = "none";
      if (loggedInView) loggedInView.style.display = "flex";

      // Populate User Meta
      const initials = (user.fullName || user.username || "EC")
        .split(" ")
        .map(n => n[0])
        .join("")
        .toUpperCase()
        .slice(0, 2);

      const avatarEl = document.getElementById("acc-avatar-initials");
      const fullNameEl = document.getElementById("acc-full-name");
      const usernameEl = document.getElementById("acc-username");
      const emailEl = document.getElementById("acc-email");
      const tierBadgeEl = document.getElementById("acc-tier-name");
      const memberSinceEl = document.getElementById("acc-member-since");

      if (avatarEl) avatarEl.textContent = initials;
      if (fullNameEl) fullNameEl.textContent = user.fullName || user.username;
      if (usernameEl) usernameEl.textContent = `@${user.username || 'ecouser'}`;
      if (emailEl) emailEl.textContent = user.email || 'champion@ecotrack.local';
      if (tierBadgeEl) tierBadgeEl.textContent = user.tier || 'Green Explorer';
      if (memberSinceEl) memberSinceEl.textContent = user.memberSince || 'October 2024';

      // Tab 1: Stats & Tier Progress
      const statPointsEl = document.getElementById("acc-stat-points");
      const statLifetimeEl = document.getElementById("acc-stat-lifetime");
      const statCo2El = document.getElementById("acc-stat-co2");
      const statDivertedEl = document.getElementById("acc-stat-diverted");

      if (statPointsEl) statPointsEl.textContent = `${points} pts`;
      if (statLifetimeEl) statLifetimeEl.textContent = `${user.lifetimePoints || points} pts`;
      if (statCo2El) statCo2El.textContent = `${(Number(user.totalCarbonAvoidedKg) || 0).toFixed(2)} kg`;
      if (statDivertedEl) statDivertedEl.textContent = `${(Number(user.totalWasteDivertedKg) || 0).toFixed(2)} kg`;

      // Calculate Tier Progress Bar
      const lp = user.lifetimePoints || points;
      let nextTierName = "Eco Advocate";
      let nextTarget = 200;
      let pct = 40;

      if (lp >= 1000) {
        nextTierName = "Master Reforester";
        nextTarget = 1500;
        pct = 100;
      } else if (lp >= 500) {
        nextTierName = "Climate Guardian";
        nextTarget = 1000;
        pct = Math.min(100, Math.round(((lp - 500) / 500) * 100));
      } else if (lp >= 200) {
        nextTierName = "Sustainability Master";
        nextTarget = 500;
        pct = Math.min(100, Math.round(((lp - 200) / 300) * 100));
      } else {
        nextTierName = "Eco Advocate";
        nextTarget = 200;
        pct = Math.min(100, Math.round((lp / 200) * 100));
      }

      const progNameEl = document.getElementById("acc-tier-prog-name");
      const progTargetEl = document.getElementById("acc-tier-prog-target");
      const progFillEl = document.getElementById("acc-tier-prog-fill");

      if (progNameEl) progNameEl.textContent = user.tier || "Green Explorer";
      if (progTargetEl) progTargetEl.textContent = `${lp} / ${nextTarget} pts to ${nextTierName} (${pct}%)`;
      if (progFillEl) progFillEl.style.width = `${pct}%`;

      // Tab 2: Carbon Impact Equivalents
      const co2 = Number(user.totalCarbonAvoidedKg) || 0;
      const diverted = Number(user.totalWasteDivertedKg) || 0;

      const treeEquivEl = document.getElementById("acc-tree-equiv");
      const carEquivEl = document.getElementById("acc-car-equiv");
      const bottlesEquivEl = document.getElementById("acc-bottles-equiv");

      if (treeEquivEl) treeEquivEl.textContent = `~${(co2 / 21.77).toFixed(2)} Trees`;
      if (carEquivEl) carEquivEl.textContent = `~${(co2 * 4.0).toFixed(1)} km`;
      if (bottlesEquivEl) bottlesEquivEl.textContent = `~${Math.round(diverted * 40)} Items`;

      // Tab 3: Points Ledger
      renderFullLedger();

      // Tab 4: Claimed Digital Vouchers
      renderClaimedVouchers();

      // Tab 5: Eco Achievements
      renderAchievements();

      // Pre-fill Edit Profile Inputs
      const editNameInput = document.getElementById("edit-display-name");
      const editEmailInput = document.getElementById("edit-email");
      if (editNameInput) editNameInput.value = user.fullName || user.username;
      if (editEmailInput) editEmailInput.value = user.email || "";
    }
  }

  function renderFullLedger() {
    const container = document.getElementById("acc-full-ledger-list");
    if (!container) return;

    const user = accountCtrl.getUser();
    const log = user.historyLog || [];

    if (log.length === 0) {
      container.innerHTML = `
        <div style="color: var(--muted); font-size: var(--text-sm); text-align: center; padding: 24px;">
          No transactions recorded yet. Run a waste calculation to earn your first points!
        </div>
      `;
      return;
    }

    container.innerHTML = log.map(tx => {
      const isPositive = tx.points > 0;
      const formattedDate = new Date(tx.timestamp).toLocaleDateString([], {
        month: "short",
        day: "numeric",
        year: "numeric"
      }) + " " + new Date(tx.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

      return `
        <div class="redemption-item">
          <div>
            <div style="font-weight: 600; color: var(--ink);">${escapeHtml(tx.description)}</div>
            <div style="font-size: var(--text-xs); color: var(--muted); margin-top: 2px;">
              ${escapeHtml(formattedDate)}
            </div>
          </div>
          <strong style="font-variant-numeric: tabular-nums; font-size: var(--text-sm); color: ${isPositive ? 'var(--teal)' : 'var(--alert)'};">
            ${isPositive ? '+' : ''}${tx.points} pts
          </strong>
        </div>
      `;
    }).join("");
  }

  function renderClaimedVouchers() {
    const grid = document.getElementById("acc-vouchers-grid");
    if (!grid) return;

    const user = accountCtrl.getUser();
    const redemptions = user.redemptions || [];

    if (redemptions.length === 0) {
      grid.innerHTML = `
        <div class="card" style="grid-column: 1 / -1; text-align: center; padding: 36px var(--space-6);">
          <div style="font-size: 2rem; margin-bottom: 8px;">🎁</div>
          <h4 style="margin-bottom: 4px;">No Digital Vouchers Yet</h4>
          <p style="font-size: var(--text-xs); color: var(--muted); max-width: 44ch; margin: 0 auto 16px;">
            Redeem your available Green Points in our Rewards Catalog to get digital vouchers, saplings, and sustainable zero-waste gear.
          </p>
          <a href="#rewards" class="btn btn-secondary btn-sm" style="margin: 0 auto;">Browse Rewards Catalog &rarr;</a>
        </div>
      `;
      return;
    }

    grid.innerHTML = redemptions.map(r => {
      const formattedDate = new Date(r.timestamp).toLocaleDateString([], {
        month: "short",
        day: "numeric",
        year: "numeric"
      });

      return `
        <div class="voucher-card">
          <div class="voucher-card-top">
            <div>
              <div class="voucher-title">${escapeHtml(r.title)}</div>
              <div style="font-size: var(--text-xs); color: var(--muted); margin-top: 2px;">
                Claimed ${escapeHtml(formattedDate)} &bull; -${r.pointsCost} pts
              </div>
            </div>
            <span class="voucher-status-chip">Active</span>
          </div>

          <div class="voucher-code-box">
            <span class="voucher-code-text" id="code-${escapeHtml(r.id)}">${escapeHtml(r.code)}</span>
            <button type="button" class="btn-copy-code" data-copy-code="${escapeHtml(r.code)}" aria-label="Copy voucher code">
              <svg width="13" height="13" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3"/></svg>
              <span>Copy</span>
            </button>
          </div>

          <div class="voucher-instructions">
            Present this code or voucher string at checkout with participating sustainable partners or certified forestry partners.
          </div>
        </div>
      `;
    }).join("");
  }

  function renderAchievements() {
    const grid = document.getElementById("acc-achievements-grid");
    if (!grid) return;

    grid.innerHTML = ECO_ACHIEVEMENTS.map(ach => {
      return `
        <div class="achievement-card ${ach.unlocked ? 'is-unlocked' : 'is-locked'}">
          <div class="achievement-icon-circle">${ach.icon}</div>
          <div class="achievement-info">
            <h4>${escapeHtml(ach.name)}</h4>
            <p>${escapeHtml(ach.desc)}</p>
            <span class="achievement-badge-status">
              ${ach.unlocked ? `Unlocked &bull; +${ach.bonusPts} Pts` : `In Progress &bull; +${ach.bonusPts} Pts`}
            </span>
          </div>
        </div>
      `;
    }).join("");
  }

  function setupAuthAndAccountDashboard() {
    // Helper to scroll smoothly and land on account section
    function landUponAccount(tabId = "tab-overview") {
      updateAccountUI();
      const authContent = document.getElementById("authenticated-app-content");
      if (authContent) {
        authContent.style.display = "block";
      }

      const accSection = document.getElementById("account");
      if (accSection) {
        // Activate requested tab
        if (tabId) {
          const tabBtns = document.querySelectorAll(".account-tab-link");
          const tabPanes = document.querySelectorAll(".account-tab-content-panel");
          tabBtns.forEach(btn => {
            btn.classList.toggle("active", btn.getAttribute("data-acc-tab") === tabId);
          });
          tabPanes.forEach(pane => {
            pane.classList.toggle("active", pane.id === tabId);
          });
        }
        setTimeout(() => {
          const y = accSection.getBoundingClientRect().top + window.pageYOffset - 75;
          window.scrollTo({ top: Math.max(0, y), behavior: "smooth" });
        }, 50);
        try {
          history.replaceState(null, "", "#account");
        } catch (_) {}
      }
    }

    // 0. Header Login / Join CTA Button
    const btnNavLogin = document.getElementById("btn-nav-login");
    if (btnNavLogin) {
      btnNavLogin.addEventListener("click", () => {
        accountCtrl.login("EcoChampion", "demo123");
        showToast("Signed in as EcoChampion! Opening your account.");
        landUponAccount("tab-overview");
      });
    }

    // 1. Home Page Auth Tabs Switcher (Sign In vs Sign Up)
    const heroTabSignin = document.getElementById("hero-btn-tab-signin");
    const heroTabSignup = document.getElementById("hero-btn-tab-signup");
    const heroPaneSignin = document.getElementById("hero-pane-signin");
    const heroPaneSignup = document.getElementById("hero-pane-signup");

    if (heroTabSignin && heroTabSignup && heroPaneSignin && heroPaneSignup) {
      heroTabSignin.addEventListener("click", () => {
        heroTabSignin.classList.add("active");
        heroTabSignup.classList.remove("active");
        heroPaneSignin.style.display = "block";
        heroPaneSignup.style.display = "none";
      });

      heroTabSignup.addEventListener("click", () => {
        heroTabSignup.classList.add("active");
        heroTabSignin.classList.remove("active");
        heroPaneSignin.style.display = "none";
        heroPaneSignup.style.display = "block";
      });
    }

    // 2. Home Page Sign In Form Handler
    const heroFormSignIn = document.getElementById("hero-form-signin");
    if (heroFormSignIn) {
      heroFormSignIn.addEventListener("submit", (e) => {
        e.preventDefault();
        const emailEl = document.getElementById("hero-signin-email");
        const passEl = document.getElementById("hero-signin-password");
        const email = (emailEl && emailEl.value.trim()) || "EcoChampion";
        const pass = (passEl && passEl.value) || "demo123";
        accountCtrl.login(email, pass);
        showToast("Signed in successfully! Opening your Eco-Account.");
        landUponAccount("tab-overview");
      });
    }

    // 3. Home Page Sign Up Form Handler
    const heroFormSignUp = document.getElementById("hero-form-signup");
    if (heroFormSignUp) {
      heroFormSignUp.addEventListener("submit", (e) => {
        e.preventDefault();
        const nameEl = document.getElementById("hero-signup-name");
        const emailEl = document.getElementById("hero-signup-email");
        const passEl = document.getElementById("hero-signup-password");
        const roleEl = document.getElementById("hero-signup-role");
        const name = (nameEl && nameEl.value.trim()) || "Alex Rivera";
        const email = (emailEl && emailEl.value.trim()) || "alex@ecotrack.local";
        const pass = (passEl && passEl.value) || "demo123";
        const role = roleEl ? roleEl.value : "Household Recycling";
        accountCtrl.signup(name, email, pass, role);
        showToast("Welcome! +150 Welcome Points awarded to your account.");
        landUponAccount("tab-overview");
      });
    }

    // 4. Quick 1-Click Demo Buttons (on Home Hero)
    const heroDemoChamp = document.getElementById("hero-btn-demo-champion");
    const heroDemoNewUser = document.getElementById("hero-btn-demo-newuser");

    if (heroDemoChamp) {
      heroDemoChamp.addEventListener("click", () => {
        accountCtrl.login("EcoChampion", "demo123");
        showToast("Welcome back, EcoChampion! Opening your account.");
        landUponAccount("tab-overview");
      });
    }

    if (heroDemoNewUser) {
      heroDemoNewUser.addEventListener("click", () => {
        accountCtrl.signup("Alex Rivera", "alex@ecotrack.local", "demo123", "Household Recycling");
        showToast("Demo account created! +150 Welcome Points.");
        landUponAccount("tab-overview");
      });
    }

    // 5. Also handle the auth forms in #account-guest-view if visible
    const formSignInAcc = document.getElementById("form-signin");
    if (formSignInAcc) {
      formSignInAcc.addEventListener("submit", (e) => {
        e.preventDefault();
        const email = document.getElementById("signin-email")?.value || "EcoChampion";
        const pass = document.getElementById("signin-password")?.value || "";
        accountCtrl.login(email, pass);
        showToast("Signed in successfully!");
        setTimeout(() => landUponAccount("tab-overview"), 150);
      });
    }

    const formSignUpAcc = document.getElementById("form-signup");
    if (formSignUpAcc) {
      formSignUpAcc.addEventListener("submit", (e) => {
        e.preventDefault();
        const name = document.getElementById("signup-name")?.value || "Eco Member";
        const email = document.getElementById("signup-email")?.value || "member@ecotrack.local";
        const pass = document.getElementById("signup-password")?.value || "";
        const role = document.getElementById("signup-role")?.value || "Household Recycling";
        accountCtrl.signup(name, email, pass, role);
        showToast("Welcome! +150 Welcome Points awarded.");
        setTimeout(() => landUponAccount("tab-overview"), 150);
      });
    }

    const btnDemoChampAcc = document.getElementById("btn-demo-champion");
    if (btnDemoChampAcc) {
      btnDemoChampAcc.addEventListener("click", () => {
        accountCtrl.login("EcoChampion", "demo123");
        showToast("Signed in as EcoChampion!");
        setTimeout(() => landUponAccount("tab-overview"), 150);
      });
    }

    const btnDemoNewUserAcc = document.getElementById("btn-demo-newuser");
    if (btnDemoNewUserAcc) {
      btnDemoNewUserAcc.addEventListener("click", () => {
        accountCtrl.signup("Taylor Brooks", "taylor@ecotrack.local", "demo123", "Household Recycling");
        showToast("Demo account created: +150 Welcome Points!");
        setTimeout(() => landUponAccount("tab-overview"), 150);
      });
    }

    // 6. Header Person Icon Button & Dropdown Menu Toggle
    const btnOpenAccount = document.getElementById("btn-open-account");
    const userDropdown = document.getElementById("user-account-dropdown");
    const userMenuWrapper = document.getElementById("user-menu-wrapper");

    if (btnOpenAccount && userDropdown) {
      btnOpenAccount.addEventListener("click", (e) => {
        e.stopPropagation();
        const isOpen = userDropdown.classList.toggle("is-open");
        btnOpenAccount.setAttribute("aria-expanded", String(isOpen));
      });

      // Close on outside click
      document.addEventListener("click", (e) => {
        if (userMenuWrapper && !userMenuWrapper.contains(e.target)) {
          userDropdown.classList.remove("is-open");
          btnOpenAccount.setAttribute("aria-expanded", "false");
        }
      });

      // Close on Escape key
      document.addEventListener("keydown", (e) => {
        if (e.key === "Escape" && userDropdown.classList.contains("is-open")) {
          userDropdown.classList.remove("is-open");
          btnOpenAccount.setAttribute("aria-expanded", "false");
        }
      });
    }

    // 7. Dropdown Relevant Option Links
    const dropdownGoToTabs = document.querySelectorAll("[data-goto-tab]");
    dropdownGoToTabs.forEach(btn => {
      btn.addEventListener("click", () => {
        const tabId = btn.getAttribute("data-goto-tab");
        if (userDropdown) userDropdown.classList.remove("is-open");
        if (btnOpenAccount) btnOpenAccount.setAttribute("aria-expanded", "false");
        landUponAccount(tabId);
      });
    });

    const ddBtnEditProfile = document.getElementById("dropdown-btn-edit-profile");
    if (ddBtnEditProfile) {
      ddBtnEditProfile.addEventListener("click", () => {
        if (userDropdown) userDropdown.classList.remove("is-open");
        if (btnOpenAccount) btnOpenAccount.setAttribute("aria-expanded", "false");
        landUponAccount("tab-overview");
        const editCard = document.getElementById("acc-edit-profile-card");
        if (editCard) {
          editCard.style.display = "block";
          const nameInput = document.getElementById("edit-display-name");
          if (nameInput) nameInput.focus();
        }
      });
    }

    const ddBtnLogout = document.getElementById("dropdown-btn-logout");
    if (ddBtnLogout) {
      ddBtnLogout.addEventListener("click", () => {
        accountCtrl.logout();
        if (userDropdown) userDropdown.classList.remove("is-open");
        if (btnOpenAccount) btnOpenAccount.setAttribute("aria-expanded", "false");
        showToast("You have been signed out.");
        const topEl = document.getElementById("top");
        if (topEl) topEl.scrollIntoView({ behavior: "smooth" });
      });
    }

    // 8. Account Section Navigation Tabs (1 to 5)
    const sectionTabLinks = document.querySelectorAll(".account-tab-link");
    const sectionPanels = document.querySelectorAll(".account-tab-content-panel");

    sectionTabLinks.forEach(tab => {
      tab.addEventListener("click", () => {
        sectionTabLinks.forEach(t => t.classList.remove("active"));
        sectionPanels.forEach(p => p.classList.remove("active"));

        tab.classList.add("active");
        const targetId = tab.getAttribute("data-acc-tab");
        const panel = document.getElementById(targetId);
        if (panel) panel.classList.add("active");
      });
    });

    // 9. Profile Edit Toggle & Save inside Dashboard
    const btnToggleEdit = document.getElementById("btn-toggle-edit-profile");
    const btnCancelEdit = document.getElementById("btn-cancel-edit-profile");
    const editCard = document.getElementById("acc-edit-profile-card");
    const formUpdateProfile = document.getElementById("form-update-profile");

    if (btnToggleEdit && editCard) {
      btnToggleEdit.addEventListener("click", () => {
        const isHidden = editCard.style.display === "none";
        editCard.style.display = isHidden ? "block" : "none";
        if (isHidden) {
          const nameInput = document.getElementById("edit-display-name");
          if (nameInput) nameInput.focus();
        }
      });
    }

    if (btnCancelEdit && editCard) {
      btnCancelEdit.addEventListener("click", () => {
        editCard.style.display = "none";
      });
    }

    if (formUpdateProfile) {
      formUpdateProfile.addEventListener("submit", (e) => {
        e.preventDefault();
        const newName = document.getElementById("edit-display-name").value;
        const newEmail = document.getElementById("edit-email").value;
        accountCtrl.updateProfile(newName, newEmail);
        if (editCard) editCard.style.display = "none";
        showToast("Account details updated successfully!");
      });
    }

    // 10. Dashboard Sign Out Button
    const btnLogout = document.getElementById("btn-account-logout");
    if (btnLogout) {
      btnLogout.addEventListener("click", () => {
        accountCtrl.logout();
        showToast("You have been signed out.");
        const topEl = document.getElementById("top");
        if (topEl) topEl.scrollIntoView({ behavior: "smooth" });
      });
    }

    // 11. Copy Voucher Code delegation
    document.addEventListener("click", async (e) => {
      const copyBtn = e.target.closest(".btn-copy-code");
      if (copyBtn) {
        const code = copyBtn.getAttribute("data-copy-code");
        if (code) {
          try {
            await navigator.clipboard.writeText(code);
            const originalHTML = copyBtn.innerHTML;
            copyBtn.innerHTML = `<span>Copied!</span>`;
            setTimeout(() => {
              copyBtn.innerHTML = originalHTML;
            }, 2000);
            showToast(`Code copied: ${code}`);
          } catch {
            showToast(`Voucher code: ${code}`);
          }
        }
      }
    });
  }

  function showRedemptionSuccessModal(outcome) {
    const successModal = document.getElementById("redemption-success-modal");
    if (!successModal) {
      alert(`Success! You redeemed: ${outcome.title}\nYour voucher code: ${outcome.code}`);
      return;
    }

    const titleEl = document.getElementById("success-reward-title");
    const codeEl = document.getElementById("success-reward-code");
    const closeBtn = document.getElementById("btn-close-success-modal");

    if (titleEl) titleEl.textContent = outcome.title;
    if (codeEl) codeEl.textContent = outcome.code;

    successModal.classList.add("is-open");

    if (closeBtn) {
      closeBtn.onclick = () => {
        successModal.classList.remove("is-open");
      };
    }
  }

  function showToast(message) {
    let toast = document.getElementById("app-toast");
    if (!toast) {
      toast = document.createElement("div");
      toast.id = "app-toast";
      toast.className = "toast-notification";
      document.body.appendChild(toast);
    }
    toast.textContent = message;
    toast.classList.add("is-visible");
    setTimeout(() => {
      toast.classList.remove("is-visible");
    }, 3500);
  }

  // 12. Navigation Setup & Scroll Spy
  function setupNavigation() {
    const mobileMenuBtn = document.getElementById("btn-mobile-menu");
    const mobileNavDrawer = document.getElementById("mobile-nav-drawer");
    const navLinks = document.querySelectorAll(".nav-link, .mobile-nav-link");

    if (mobileMenuBtn && mobileNavDrawer) {
      mobileMenuBtn.addEventListener("click", () => {
        const isOpen = mobileNavDrawer.classList.toggle("is-open");
        mobileMenuBtn.setAttribute("aria-expanded", String(isOpen));
      });
    }

    // Smooth scroll for all hash links with automatic authentication unlock
    document.addEventListener("click", (e) => {
      const anchor = e.target.closest('a[href^="#"]');
      if (!anchor) return;
      const href = anchor.getAttribute("href");
      if (!href || href === "#") return;

      const targetEl = document.querySelector(href);
      if (targetEl) {
        const authContent = document.getElementById("authenticated-app-content");
        if (authContent && authContent.contains(targetEl) && !accountCtrl.isLoggedIn()) {
          accountCtrl.login("EcoChampion", "demo123");
          updateAccountUI();
        }

        e.preventDefault();
        setTimeout(() => {
          const y = targetEl.getBoundingClientRect().top + window.pageYOffset - 75;
          window.scrollTo({ top: Math.max(0, y), behavior: "smooth" });
          try {
            history.pushState(null, "", href);
          } catch (_) {}
        }, 30);

        if (mobileNavDrawer) mobileNavDrawer.classList.remove("is-open");
        if (mobileMenuBtn) mobileMenuBtn.setAttribute("aria-expanded", "false");
      }
    });

    const sections = document.querySelectorAll("section[id], header[id]");
    const observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          const id = entry.target.getAttribute("id");
          navLinks.forEach(link => {
            const href = link.getAttribute("href");
            if (href === `#${id}`) {
              link.classList.add("active");
              link.setAttribute("aria-current", "page");
            } else {
              link.classList.remove("active");
              link.removeAttribute("aria-current");
            }
          });
        }
      });
    }, {
      rootMargin: "-20% 0px -70% 0px"
    });

    sections.forEach(sec => observer.observe(sec));
  }

  // Boot UI bindings
  updateAccountUI();
  renderRewardsCatalog();
  setupAuthAndAccountDashboard();
}

// Robust startup invocation
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", startApp);
} else {
  startApp();
}
