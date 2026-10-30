import { LOW_CONFIDENCE_THRESHOLD, MAX_WEIGHT_KG } from "./config.js";
import { analyze } from "./analyzeService.js";
import { getDemoFactor, getMaterial, MATERIALS, MATERIAL_TIPS, calculateDemoEmission } from "./factors.js";
import { validateWeight, toKilograms } from "./validators.js";
import { deleteResult, getResults, getSummary, saveResult, updateResult } from "./storageService.js";
import { requireAuth, signOut } from "./authService.js";
import { createThumbnail, initializeImageUpload } from "./upload.js";
import { calculateReward, getTier, TIERS } from "./rewardService.js";
import { creditWallet, getWallet, isFirstActivityToday } from "./walletService.js";

try {
  const user = requireAuth();
  if (user) initializeDashboard(user);
} catch (error) {
  console.error("Could not verify the dashboard session.", error);
  document.getElementById("access-error-message").textContent = error.message || "Your session could not be checked.";
  document.getElementById("access-error").hidden = false;
}

function initializeDashboard(sessionUser) {
  const shell = document.getElementById("dashboard-shell");
  const accessError = document.getElementById("access-error");
  const analyzerForm = document.getElementById("analyzer-form");
  const imageInput = document.getElementById("waste-image");
  const weightInput = document.getElementById("item-weight");
  const weightUnit = document.getElementById("weight-unit");
  const analyzeButton = document.getElementById("analyze-button");
  const analysisError = document.getElementById("analysis-error");
  const storageWarning = document.getElementById("storage-warning");
  const imageError = document.getElementById("image-error");
  const weightError = document.getElementById("weight-error");
  const uploadZone = document.getElementById("upload-zone");
  const imagePreview = document.getElementById("image-preview");
  const resultEmpty = document.getElementById("result-empty");
  const resultContent = document.getElementById("result-content");
  const materialFilter = document.getElementById("history-filter");

  let selectedFile = null;
  let currentResultId = "";
  let latestResult = null;
  let busy = false;

  try {
    document.getElementById("dashboard-greeting").textContent = `Hi, ${sessionUser.name}`;
    const avatarEl = document.getElementById("dashboard-avatar");
    if (avatarEl) avatarEl.textContent = sessionUser.name.trim().charAt(0).toUpperCase();

    for (const material of MATERIALS) {
      const option = document.createElement("option");
      option.value = material.id;
      option.textContent = material.label;
      materialFilter.append(option);
    }
    shell.hidden = false;
    renderHistory();
    renderWalletUI();
  } catch (error) {
    console.error("Could not load the dashboard.", error);
    shell.hidden = true;
    accessError.hidden = false;
    document.getElementById("access-error-message").textContent = error.message || "Your dashboard data could not be loaded.";
    return;
  }

  // ── Sign out ───────────────────────────────────────────────────────────────
  document.getElementById("sign-out").addEventListener("click", () => {
    try {
      signOut();
      window.location.replace("index.html#account-access");
    } catch (error) {
      console.error("Could not sign out.", error);
      setStorageWarning("Sign-out failed. Close this tab to end this session.", true);
    }
  });

  // ── Wallet modal toggle ────────────────────────────────────────────────────
  const walletTrigger = document.getElementById("wallet-trigger");
  const walletTriggerAlt = document.getElementById("wallet-trigger-alt");
  const summaryWalletCard = document.getElementById("summary-wallet-card");
  const walletModal = document.getElementById("wallet-modal");
  const walletClose = document.getElementById("wallet-close");

  function openWalletModal() {
    if (!walletModal) return;
    renderWalletModal();
    walletModal.hidden = false;
    walletModal.querySelector("[data-modal-inner]")?.focus();
  }

  function closeWalletModal() {
    if (walletModal) walletModal.hidden = true;
  }

  if (walletModal) {
    walletTrigger?.addEventListener("click", openWalletModal);
    walletTriggerAlt?.addEventListener("click", openWalletModal);
    summaryWalletCard?.addEventListener("click", openWalletModal);
    summaryWalletCard?.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        openWalletModal();
      }
    });

    walletClose?.addEventListener("click", closeWalletModal);
    walletModal.addEventListener("click", (e) => {
      if (e.target === walletModal) closeWalletModal();
    });
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && !walletModal.hidden) closeWalletModal();
    });
  }

  // ── Upload ─────────────────────────────────────────────────────────────────
  const upload = initializeImageUpload({
    input: imageInput,
    zone: uploadZone,
    preview: imagePreview,
    previewImage: document.getElementById("preview-image"),
    previewName: document.getElementById("preview-name"),
    previewSize: document.getElementById("preview-size"),
    replaceButton: document.getElementById("replace-image"),
    removeButton: document.getElementById("remove-image")
  }, (file, message) => {
    selectedFile = file;
    setFieldError(imageError, message, imageInput);
    updateAnalyzeButton();
  });

  weightInput.addEventListener("input", updateAnalyzeButton);
  weightUnit.addEventListener("change", updateAnalyzeButton);
  analyzerForm.addEventListener("submit", (event) => {
    event.preventDefault();
    void submitAnalysis();
  });
  document.getElementById("retry-analysis").addEventListener("click", () => void submitAnalysis());
  document.getElementById("analyze-another").addEventListener("click", resetAnalyzer);
  materialFilter.addEventListener("change", renderHistory);
  document.getElementById("correct-material").addEventListener("change", () => correctMaterial(false));

  // ── Helpers ────────────────────────────────────────────────────────────────
  function setFieldError(element, message, field) {
    element.textContent = message;
    field.setAttribute("aria-invalid", message ? "true" : "false");
  }

  function setStorageWarning(message, isError = false) {
    storageWarning.textContent = message;
    storageWarning.hidden = !message;
    storageWarning.classList.toggle("notice-error", isError);
    storageWarning.classList.toggle("notice-warning", Boolean(message) && !isError);
  }

  function updateAnalyzeButton() {
    const weightMessage = validateWeight(weightInput.value, weightUnit.value, MAX_WEIGHT_KG);
    setFieldError(weightError, weightMessage, weightInput);
    analyzeButton.disabled = busy || !selectedFile || Boolean(weightMessage);
  }

  // ── Analysis ───────────────────────────────────────────────────────────────
  async function submitAnalysis() {
    if (busy) return;
    const weightMessage = validateWeight(weightInput.value, weightUnit.value, MAX_WEIGHT_KG);
    setFieldError(weightError, weightMessage, weightInput);
    if (weightMessage || !selectedFile) {
      if (!selectedFile) imageInput.focus();
      else weightInput.focus();
      return;
    }

    const file = selectedFile;
    const weightKg = toKilograms(weightInput.value, weightUnit.value);
    busy = true;
    upload.setBusy(true);
    weightInput.disabled = true;
    weightUnit.disabled = true;
    analyzeButton.disabled = true;
    document.getElementById("retry-analysis").disabled = true;
    analyzeButton.innerHTML = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true" class="spin-icon"><path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg> Analyzing…`;
    document.getElementById("retry-analysis").hidden = true;
    analysisError.hidden = true;
    setStorageWarning("");

    try {
      const prediction = await analyze({ image: file, weightKg });
      const emissionFactor = prediction.emissionFactor ?? getDemoFactor(prediction.material);
      if (!Number.isFinite(emissionFactor)) throw new Error("No emission factor is available for this material.");
      const co2eKg = calculateDemoEmission(weightKg, emissionFactor);

      // ── Reward calculation ─────────────────────────────────────────────────
      const firstToday = isFirstActivityToday(sessionUser.id);
      const reward = calculateReward({
        material: prediction.material,
        weightKg,
        confidence: prediction.confidence,
        isFirstToday: firstToday
      });

      let thumbnail = "";
      try {
        thumbnail = await createThumbnail(file);
      } catch (error) {
        console.error("Could not create an image thumbnail.", error);
        setStorageWarning("The result can be saved, but this browser could not create its optional history thumbnail.", true);
      }

      const saved = saveResult(sessionUser.id, {
        filename: file.name,
        material: prediction.material,
        confidence: prediction.confidence,
        source: prediction.source,
        weightKg,
        weightUnit: weightUnit.value,
        weightDisplay: Number(weightInput.value),
        emissionFactor,
        co2eKg,
        thumbnail,
        demo: prediction.source === "mock",
        pointsEarned: reward.totalPoints
      });
      latestResult = saved.result;
      currentResultId = saved.result.id;

      // ── Credit wallet ──────────────────────────────────────────────────────
      try {
        creditWallet(sessionUser.id, {
          points: reward.totalPoints,
          type: "EARN_ANALYSIS",
          material: prediction.material,
          weightKg,
          description: `Analyzed ${weightKg.toFixed(2)} kg of ${prediction.material}`,
          breakdown: reward.breakdown
        });
        renderWalletUI();
      } catch (walletError) {
        console.warn("Could not update wallet:", walletError);
      }

      renderResult(latestResult, reward);
      renderHistory();
      showRewardToast(reward.totalPoints, firstToday);

      if (thumbnail && !saved.thumbnailSaved) {
        setStorageWarning("Browser storage was full. The result was saved without its thumbnail.", true);
      } else if (!storageWarning.textContent) {
        document.getElementById("save-status").textContent = "Saved in this browser for this account.";
      }
    } catch (error) {
      console.error("Could not complete the waste analysis.", error);
      analysisError.textContent = error.message || "The analysis could not be completed. Try again.";
      analysisError.hidden = false;
      document.getElementById("retry-analysis").hidden = false;
    } finally {
      busy = false;
      upload.setBusy(false);
      weightInput.disabled = false;
      weightUnit.disabled = false;
      document.getElementById("retry-analysis").disabled = false;
      analyzeButton.innerHTML = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="m9 12 2 2 4-4M7.835 4.697a3.42 3.42 0 0 0 1.946-.806 3.42 3.42 0 0 1 4.438 0 3.42 3.42 0 0 0 1.946.806 3.42 3.42 0 0 1 3.138 3.138 3.42 3.42 0 0 0 .806 1.946 3.42 3.42 0 0 1 0 4.438 3.42 3.42 0 0 0-.806 1.946 3.42 3.42 0 0 1-3.138 3.138 3.42 3.42 0 0 0-1.946.806 3.42 3.42 0 0 1-4.438 0 3.42 3.42 0 0 0-1.946-.806 3.42 3.42 0 0 1-3.138-3.138 3.42 3.42 0 0 0-.806-1.946 3.42 3.42 0 0 1 0-4.438 3.42 3.42 0 0 0 .806-1.946 3.42 3.42 0 0 1 3.138-3.138Z" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg> Calculate carbon emission`;
      updateAnalyzeButton();
    }
  }

  // ── Reward toast ───────────────────────────────────────────────────────────
  function showRewardToast(points, isFirstToday) {
    const toast = document.getElementById("reward-toast");
    if (!toast) return;
    const label = toast.querySelector("#toast-points");
    const sub = toast.querySelector("#toast-sub");
    if (label) label.textContent = `+${points} Eco-Points`;
    if (sub) sub.textContent = isFirstToday ? "Daily streak bonus included! 🔥" : "Added to your wallet";
    toast.hidden = false;
    toast.classList.remove("toast-exit");
    toast.classList.add("toast-enter");
    clearTimeout(toast._timer);
    toast._timer = setTimeout(() => {
      toast.classList.replace("toast-enter", "toast-exit");
      setTimeout(() => { toast.hidden = true; }, 400);
    }, 3500);
  }

  // ── Render result ──────────────────────────────────────────────────────────
  function renderResult(result, reward = null) {
    const material = getMaterial(result.material);
    resultEmpty.hidden = true;
    resultContent.hidden = false;
    document.getElementById("result-material").textContent = material?.label ?? "Unknown material";
    document.getElementById("result-material").className = `material-badge ${material?.colorClass ?? ""}`;
    document.getElementById("confidence-label").textContent = `Classification confidence: ${Math.round(result.confidence * 100)}%`;
    document.getElementById("result-value").textContent = result.co2eKg.toFixed(3);
    document.getElementById("result-weight").textContent = `${result.weightKg.toFixed(3)} kg`;
    document.getElementById("result-factor").textContent = `${result.emissionFactor.toFixed(2)} kg CO₂e/kg`;
    document.getElementById("result-formula").textContent =
      `${result.weightKg.toFixed(3)} kg × ${result.emissionFactor.toFixed(2)} kg CO₂e/kg = ${result.co2eKg.toFixed(3)} kg CO₂e`;

    // Points earned inline in result card
    const pointsRow = document.getElementById("result-points-row");
    if (pointsRow) {
      const pts = reward?.totalPoints ?? result.pointsEarned ?? 0;
      pointsRow.hidden = pts === 0;
      const ptsBadge = document.getElementById("result-points-value");
      if (ptsBadge) ptsBadge.textContent = `+${pts} Eco-Points`;
    }

    const isLowConfidence = result.confidence < LOW_CONFIDENCE_THRESHOLD;
    const correction = document.getElementById("confidence-warning");
    correction.hidden = !isLowConfidence;
    if (isLowConfidence) {
      const select = document.getElementById("correct-material");
      select.replaceChildren();
      for (const candidate of MATERIALS) {
        const option = document.createElement("option");
        option.value = candidate.id;
        option.textContent = candidate.label;
        option.selected = candidate.id === result.material;
        select.append(option);
      }
    }

    const tips = document.getElementById("result-tips");
    tips.replaceChildren();
    for (const tip of MATERIAL_TIPS[result.material] ?? []) {
      const item = document.createElement("li");
      item.textContent = tip;
      tips.append(item);
    }
    document.getElementById("save-status").textContent = "";
  }

  // ── Correct material ───────────────────────────────────────────────────────
  function correctMaterial(awardBonus = true) {
    if (!latestResult || !currentResultId) return;
    const materialId = document.getElementById("correct-material").value;
    const factor = getDemoFactor(materialId);
    if (!factor) {
      setStorageWarning("No emission factor is available for that material.", true);
      return;
    }
    try {
      const updated = updateResult(sessionUser.id, currentResultId, {
        material: materialId,
        emissionFactor: factor,
        co2eKg: calculateDemoEmission(latestResult.weightKg, factor),
        correctedByUser: true
      });
      latestResult = updated;
      renderResult(updated);
      renderHistory();
      document.getElementById("save-status").textContent = "Material correction saved in this browser.";

      // Award correction bonus
      if (awardBonus) {
        try {
          const corrReward = calculateReward({
            material: materialId,
            weightKg: latestResult.weightKg,
            confidence: latestResult.confidence,
            isCorrection: true
          });
          // Only credit the correction bonus portion
          creditWallet(sessionUser.id, {
            points: 5,
            type: "BONUS_CORRECTION",
            material: materialId,
            description: `Corrected material to ${materialId}`,
            breakdown: ["+5 material-correction bonus"]
          });
          renderWalletUI();
          showRewardToast(5, false);
        } catch (e) {
          console.warn("Could not credit correction bonus:", e);
        }
      }
    } catch (error) {
      console.error("Could not save the material correction.", error);
      setStorageWarning(error.message || "Could not save the material correction.", true);
    }
  }

  // ── Wallet UI ──────────────────────────────────────────────────────────────
  function renderWalletUI() {
    try {
      const wallet = getWallet(sessionUser.id);
      const { current, next, progress } = getTier(wallet.lifetimeEarned ?? 0);

      // Header wallet badge
      const walletBadge = document.getElementById("wallet-balance");
      if (walletBadge) walletBadge.textContent = wallet.balance.toLocaleString();

      // Streak badge
      const streakBadge = document.getElementById("streak-count");
      if (streakBadge) streakBadge.textContent = wallet.currentStreak ?? 0;

      // Summary card
      const summaryPts = document.getElementById("summary-points");
      if (summaryPts) summaryPts.textContent = wallet.balance.toLocaleString();

      // Tier chip
      const tierChip = document.getElementById("wallet-tier");
      if (tierChip) tierChip.textContent = `${current.icon} ${current.name}`;

      // Mini tier progress inside modal (rendered on open)
    } catch (e) {
      console.warn("Could not render wallet UI:", e);
    }
  }

  function renderWalletModal() {
    const wallet = getWallet(sessionUser.id);
    const { current, next, progress } = getTier(wallet.lifetimeEarned ?? 0);

    // Tier progress bar
    const tierName = document.getElementById("modal-tier-name");
    const tierIcon = document.getElementById("modal-tier-icon");
    const tierBar = document.getElementById("modal-tier-bar");
    const tierProgress = document.getElementById("modal-tier-progress");
    const nextTierLabel = document.getElementById("modal-next-tier");
    const modalBalance = document.getElementById("modal-balance");
    const modalLifetime = document.getElementById("modal-lifetime");
    const modalStreak = document.getElementById("modal-streak");

    if (tierName) tierName.textContent = current.name;
    if (tierIcon) tierIcon.textContent = current.icon;
    if (tierBar) tierBar.style.width = `${Math.round(progress * 100)}%`;
    if (tierProgress) tierProgress.textContent = `${Math.round(progress * 100)}%`;
    if (nextTierLabel) nextTierLabel.textContent = next ? `Next: ${next.icon} ${next.name} (${next.minPoints} pts)` : "Maximum tier reached!";
    if (modalBalance) modalBalance.textContent = wallet.balance.toLocaleString();
    if (modalLifetime) modalLifetime.textContent = (wallet.lifetimeEarned ?? 0).toLocaleString();
    if (modalStreak) modalStreak.textContent = wallet.currentStreak ?? 0;

    // All tiers progress
    const tiersContainer = document.getElementById("modal-tiers-grid");
    if (tiersContainer) {
      tiersContainer.replaceChildren();
      for (const tier of TIERS) {
        const unlocked = (wallet.lifetimeEarned ?? 0) >= tier.minPoints;
        const el = document.createElement("div");
        el.className = `tier-item ${unlocked ? "tier-unlocked" : "tier-locked"}`;
        el.innerHTML = `<span class="tier-icon">${tier.icon}</span><span class="tier-name">${tier.name}</span><span class="tier-pts">${tier.minPoints.toLocaleString()} pts</span>`;
        tiersContainer.append(el);
      }
    }

    // Transaction ledger
    const ledger = document.getElementById("modal-ledger");
    if (ledger) {
      ledger.replaceChildren();
      const txs = (wallet.transactions ?? []).slice(0, 20);
      if (txs.length === 0) {
        const empty = document.createElement("p");
        empty.className = "ledger-empty";
        empty.textContent = "No transactions yet. Analyze your first item to earn points!";
        ledger.append(empty);
      } else {
        for (const tx of txs) {
          const row = document.createElement("div");
          row.className = "ledger-row";
          const date = new Date(tx.timestamp).toLocaleDateString();
          row.innerHTML = `
            <span class="ledger-icon">${tx.type === "BONUS_CORRECTION" ? "✏️" : tx.type === "BONUS_DAILY" ? "🔥" : "♻️"}</span>
            <span class="ledger-desc">${tx.description}</span>
            <span class="ledger-date">${date}</span>
            <span class="ledger-pts">+${tx.points} pts</span>
          `;
          ledger.append(row);
        }
      }
    }
  }

  // ── History ────────────────────────────────────────────────────────────────
  function renderHistory() {
    try {
      const body = document.getElementById("history-body");
      const empty = document.getElementById("empty-history");
      const filter = materialFilter.value;
      const results = getResults(sessionUser.id);
      const visible = filter === "all" ? results : results.filter((result) => result.material === filter);
      body.replaceChildren();
      empty.hidden = visible.length > 0;
      for (const result of visible) body.append(createHistoryRow(result));
      renderSummary();
      renderChart(results);
    } catch (error) {
      console.error("Could not load the saved analysis history.", error);
      setStorageWarning(error.message || "Could not load the saved analysis history.", true);
    }
  }

  function createHistoryRow(result) {
    const row = document.createElement("tr");

    const dateCell = document.createElement("td");
    const parsedDate = new Date(result.createdAt);
    dateCell.textContent = Number.isNaN(parsedDate.getTime()) ? "Unknown date" : parsedDate.toLocaleDateString();
    row.append(dateCell);

    const itemCell = document.createElement("td");
    const item = document.createElement("div");
    item.className = "history-item";
    if (result.thumbnail) {
      const thumbnail = document.createElement("img");
      thumbnail.className = "history-thumbnail";
      thumbnail.src = result.thumbnail;
      thumbnail.alt = "";
      thumbnail.loading = "lazy";
      item.append(thumbnail);
    }
    const name = document.createElement("span");
    name.textContent = result.filename || "Waste item";
    item.append(name);
    itemCell.append(item);
    row.append(itemCell);

    const materialCell = document.createElement("td");
    const material = getMaterial(result.material);
    const badge = document.createElement("span");
    badge.className = `material-badge ${material?.colorClass ?? ""}`;
    badge.textContent = material?.label ?? "Unknown";
    materialCell.append(badge);
    row.append(materialCell);

    const weightCell = document.createElement("td");
    weightCell.textContent = `${result.weightKg.toFixed(3)} kg`;
    row.append(weightCell);

    const emissionsCell = document.createElement("td");
    emissionsCell.textContent = `${result.co2eKg.toFixed(3)} kg`;
    row.append(emissionsCell);

    // Points column
    const ptsCell = document.createElement("td");
    if (result.pointsEarned) {
      const ptsBadge = document.createElement("span");
      ptsBadge.className = "pts-badge";
      ptsBadge.textContent = `+${result.pointsEarned}`;
      ptsCell.append(ptsBadge);
    } else {
      ptsCell.textContent = "—";
    }
    row.append(ptsCell);

    const actionCell = document.createElement("td");
    const removeButton = document.createElement("button");
    removeButton.className = "text-link-button delete-entry";
    removeButton.type = "button";
    removeButton.textContent = "Delete";
    removeButton.setAttribute("aria-label", `Delete analysis for ${result.filename || "waste item"}`);
    removeButton.addEventListener("click", () => {
      if (!window.confirm("Delete this saved analysis from this browser?")) return;
      try {
        deleteResult(sessionUser.id, result.id);
        if (result.id === currentResultId) {
          currentResultId = "";
          latestResult = null;
          resultContent.hidden = true;
          resultEmpty.hidden = false;
        }
        renderHistory();
      } catch (error) {
        console.error("Could not delete the saved analysis.", error);
        setStorageWarning(error.message || "Could not delete this saved analysis.", true);
      }
    });
    actionCell.append(removeButton);
    row.append(actionCell);
    return row;
  }

  // ── Summary ────────────────────────────────────────────────────────────────
  function renderSummary() {
    try {
      const summary = getSummary(sessionUser.id);
      document.getElementById("summary-total").replaceChildren(
        document.createTextNode(`${summary.total.toFixed(3)} `),
        createSummaryUnit()
      );
      document.getElementById("summary-count").textContent = String(summary.count);
      const material = getMaterial(summary.commonMaterial);
      document.getElementById("summary-material").textContent = material?.label ?? "—";
    } catch (error) {
      console.error("Could not load the analysis summary.", error);
      setStorageWarning(error.message || "Could not load the saved analysis summary.", true);
    }
  }

  function createSummaryUnit() {
    const unit = document.createElement("span");
    unit.textContent = "kg CO₂e";
    return unit;
  }

  // ── Chart ──────────────────────────────────────────────────────────────────
  function renderChart(results) {
    const chart = document.getElementById("history-chart");
    chart.replaceChildren();
    const totals = new Map(MATERIALS.map((material) => [material.id, 0]));
    for (const result of results) totals.set(result.material, (totals.get(result.material) ?? 0) + result.co2eKg);
    const maxTotal = Math.max(...totals.values(), 0);
    for (const material of MATERIALS) {
      const total = totals.get(material.id) ?? 0;
      const row = document.createElement("div");
      row.className = "chart-row";
      const label = document.createElement("span");
      label.className = "chart-label";
      label.textContent = material.label;
      const track = document.createElement("span");
      track.className = "chart-track";
      const fill = document.createElement("span");
      fill.className = `chart-fill ${material.colorClass}`;
      fill.style.width = maxTotal > 0 ? `${(total / maxTotal) * 100}%` : "0%";
      track.append(fill);
      const value = document.createElement("span");
      value.className = "chart-value";
      value.textContent = `${total.toFixed(3)} kg`;
      row.append(label, track, value);
      chart.append(row);
    }
  }

  // ── Reset ──────────────────────────────────────────────────────────────────
  function resetAnalyzer() {
    upload.remove();
    weightInput.value = "";
    weightUnit.value = "g";
    setFieldError(weightError, "", weightInput);
    analysisError.textContent = "";
    analysisError.hidden = true;
    document.getElementById("retry-analysis").hidden = true;
    resultContent.hidden = true;
    resultEmpty.hidden = false;
    currentResultId = "";
    latestResult = null;
    updateAnalyzeButton();
    imageInput.focus();
  }
}
