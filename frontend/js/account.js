/**
 * Account & Eco-Points Rewards System
 * Manages user authentication state (Sign In, Sign Up, Profile, Logout),
 * green points balance, impact metrics, achievements, and reward redemptions.
 */

import { storage } from "./utils.js";

const STORAGE_ACCOUNT_KEY = "cf_user_account";

// Catalog of redeemable rewards
export const REWARDS_CATALOG = [
  {
    id: "reward_tree",
    title: "Plant a Native Forest Tree",
    category: "Reforestation",
    pointsCost: 100,
    description: "Funds the planting and verified monitoring of one native sapling via certified global reforestation partners.",
    icon: "tree"
  },
  {
    id: "reward_coupon_5",
    title: "EcoStore $5 Digital Voucher",
    category: "Sustainable Shopping",
    pointsCost: 250,
    description: "Get $5 off zero-waste personal care, bamboo cutlery, or bulk shopping supplies at participating partners.",
    icon: "tag"
  },
  {
    id: "reward_straw_set",
    title: "Stainless Steel Reusable Straw Kit",
    category: "Zero Waste Gear",
    pointsCost: 400,
    description: "Pack of 4 food-grade stainless steel straws with organic cotton carrying pouch and cleaning brush.",
    icon: "gift"
  },
  {
    id: "reward_tote",
    title: "Organic Fair-Trade Cotton Tote",
    category: "Merchandise",
    pointsCost: 550,
    description: "Durable unbleached canvas grocery tote screen-printed with water-based eco-friendly inks.",
    icon: "bag"
  },
  {
    id: "reward_offset_15",
    title: "Gold Standard Carbon Offset (100 kg)",
    category: "Carbon Offsets",
    pointsCost: 750,
    description: "Retire 100 kg of certified Gold Standard CO₂ offsets supporting community biogas and solar clean energy.",
    icon: "certificate"
  }
];

export const ECO_ACHIEVEMENTS = [
  { id: "first_scan", name: "First Footprint", desc: "Completed your first AI waste classification", icon: "🌱", bonusPts: 25, unlocked: true },
  { id: "metal_master", name: "Aluminium Ace", desc: "Audited metal scrap with precision recovery", icon: "⚙️", bonusPts: 50, unlocked: true },
  { id: "plastic_buster", name: "Plastic Diverter", desc: "Classified and redirected recyclable polymers", icon: "♻️", bonusPts: 50, unlocked: true },
  { id: "century_divert", name: "Century Diverter", desc: "Prevented over 5 kg CO₂e from emissions", icon: "🛡️", bonusPts: 100, unlocked: false },
  { id: "tree_planter", name: "Forest Guardian", desc: "Redeemed your first certified native tree", icon: "🌲", bonusPts: 150, unlocked: false },
  { id: "zero_hero", name: "Zero Waste Hero", desc: "Achieved over 500 lifetime Green Points", icon: "🥇", bonusPts: 200, unlocked: false }
];

export class AccountController {
  constructor({
    onPointsChanged,
    onUserChanged
  } = {}) {
    this.onPointsChanged = onPointsChanged;
    this.onUserChanged = onUserChanged;

    this.user = null;
    this.init();
  }

  init() {
    this.load();
  }

  load() {
    const saved = storage.get(STORAGE_ACCOUNT_KEY, null);
    if (saved && typeof saved === "object") {
      this.user = saved;
    } else {
      // Default initial guest state for visitors arriving on the home page
      this.user = {
        isLoggedIn: false,
        username: "Guest",
        fullName: "Guest Visitor",
        email: "",
        memberSince: "",
        points: 0,
        lifetimePoints: 0,
        tier: "Guest",
        totalWasteDivertedKg: 0,
        totalCarbonAvoidedKg: 0,
        itemsAssessedCount: 0,
        treesFundedCount: 0,
        historyLog: [],
        redemptions: []
      };
      this.save();
    }
  }

  save() {
    storage.set(STORAGE_ACCOUNT_KEY, this.user);
  }

  getUser() {
    return this.user;
  }

  isLoggedIn() {
    return !!(this.user && this.user.isLoggedIn);
  }

  getPoints() {
    return this.user && this.user.isLoggedIn ? this.user.points : 0;
  }

  /**
   * Calculate points earned for classifying a waste item:
   * Base: 15 pts + (weight_kg * 40 pts) + (footprint * 20 pts), min 15 pts.
   */
  calculateEarnedPoints(weightKg, footprintKg) {
    const base = 15;
    const weightBonus = Math.round((Number(weightKg) || 0.1) * 40);
    const footprintBonus = Math.round((Number(footprintKg) || 0.1) * 20);
    const total = Math.max(15, base + weightBonus + footprintBonus);
    return total;
  }

  /**
   * Award points to the user account upon calculating/adding an item.
   */
  awardPoints(amount, reason = "Waste classification & carbon audit", weightKg = 0, footprintKg = 0) {
    if (!this.user || !this.user.isLoggedIn) return 0;

    const pts = Math.max(1, Math.round(amount));
    this.user.points += pts;
    this.user.lifetimePoints = (this.user.lifetimePoints || 0) + pts;
    this.user.totalWasteDivertedKg = +((this.user.totalWasteDivertedKg || 0) + (Number(weightKg) || 0)).toFixed(3);
    this.user.totalCarbonAvoidedKg = +((this.user.totalCarbonAvoidedKg || 0) + (Number(footprintKg) || 0)).toFixed(3);
    this.user.itemsAssessedCount = (this.user.itemsAssessedCount || 0) + 1;

    this.updateTier();

    // Log transaction
    if (!Array.isArray(this.user.historyLog)) {
      this.user.historyLog = [];
    }
    this.user.historyLog.unshift({
      id: "tx_" + Date.now(),
      timestamp: new Date().toISOString(),
      description: reason,
      points: pts,
      type: "earned"
    });

    this.save();

    if (this.onPointsChanged) {
      this.onPointsChanged(this.user.points, pts);
    }

    return pts;
  }

  /**
   * Redeem a reward from the catalog.
   */
  redeemReward(rewardId) {
    if (!this.user || !this.user.isLoggedIn) {
      return { success: false, message: "Please sign in to your account to redeem rewards." };
    }

    const reward = REWARDS_CATALOG.find(r => r.id === rewardId);
    if (!reward) return { success: false, message: "Reward not found" };

    if (this.user.points < reward.pointsCost) {
      return { 
        success: false, 
        message: `Insufficient points. You need ${reward.pointsCost - this.user.points} more points.` 
      };
    }

    // Deduct points
    this.user.points -= reward.pointsCost;

    if (reward.id === "reward_tree") {
      this.user.treesFundedCount = (this.user.treesFundedCount || 0) + 1;
    }

    const code = "ECO-" + Math.random().toString(36).substring(2, 6).toUpperCase() + "-" + Math.floor(1000 + Math.random() * 9000);
    const redemptionRecord = {
      id: "red_" + Date.now(),
      rewardId: reward.id,
      title: reward.title,
      pointsCost: reward.pointsCost,
      timestamp: new Date().toISOString(),
      code: code,
      status: "Active"
    };

    if (!Array.isArray(this.user.redemptions)) {
      this.user.redemptions = [];
    }
    this.user.redemptions.unshift(redemptionRecord);

    if (!Array.isArray(this.user.historyLog)) {
      this.user.historyLog = [];
    }
    this.user.historyLog.unshift({
      id: "tx_" + Date.now(),
      timestamp: new Date().toISOString(),
      description: `Redeemed: ${reward.title}`,
      points: -reward.pointsCost,
      type: "redeemed",
      code: code
    });

    this.save();

    if (this.onPointsChanged) {
      this.onPointsChanged(this.user.points, -reward.pointsCost);
    }

    return {
      success: true,
      code: code,
      title: reward.title,
      remainingPoints: this.user.points
    };
  }

  updateTier() {
    const lp = this.user.lifetimePoints || 0;
    if (lp >= 1000) {
      this.user.tier = "Climate Guardian";
    } else if (lp >= 500) {
      this.user.tier = "Sustainability Master";
    } else if (lp >= 200) {
      this.user.tier = "Eco Advocate";
    } else {
      this.user.tier = "Green Explorer";
    }
  }

  updateProfile(fullName, email) {
    if (!this.user) return;
    if (fullName) {
      this.user.fullName = fullName.trim();
      this.user.username = fullName.trim().split(" ")[0].toLowerCase();
    }
    if (email) this.user.email = email.trim();
    this.save();

    if (this.onUserChanged) {
      this.onUserChanged(this.user);
    }
  }

  login(identifier = "EcoChampion", password = "") {
    const raw = identifier ? identifier.trim() : "EcoChampion";
    const isEcoChamp = raw.toLowerCase().includes("champ") || raw.toLowerCase().includes("alex");

    this.user = {
      isLoggedIn: true,
      username: isEcoChamp ? "EcoChampion" : raw.split("@")[0].toLowerCase(),
      fullName: isEcoChamp ? "Alex Rivera" : (raw.charAt(0).toUpperCase() + raw.slice(1).split("@")[0]),
      email: isEcoChamp ? "champion@ecotrack.local" : (raw.includes("@") ? raw : `${raw}@ecotrack.local`),
      memberSince: "October 2024",
      points: isEcoChamp ? 80 : 50,
      lifetimePoints: isEcoChamp ? 80 : 50,
      tier: "Green Explorer",
      totalWasteDivertedKg: isEcoChamp ? 1.45 : 0.65,
      totalCarbonAvoidedKg: isEcoChamp ? 3.42 : 1.82,
      itemsAssessedCount: isEcoChamp ? 4 : 2,
      treesFundedCount: 0,
      historyLog: [
        {
          id: "tx_" + Date.now(),
          timestamp: new Date().toISOString(),
          description: "Sign-in session active",
          points: isEcoChamp ? 80 : 50,
          type: "earned"
        }
      ],
      redemptions: isEcoChamp ? [
        {
          id: "red_welcome_coupon",
          rewardId: "reward_coupon_5",
          title: "EcoStore $5 Digital Voucher",
          pointsCost: 250,
          timestamp: new Date(Date.now() - 86400000).toISOString(),
          code: "ECO-WELCOME-2024",
          status: "Active"
        }
      ] : []
    };
    this.updateTier();
    this.save();
    if (this.onUserChanged) this.onUserChanged(this.user);
    if (this.onPointsChanged) this.onPointsChanged(this.user.points, 0);
    return true;
  }

  signup(fullName, email, password, role = "Household Recycling") {
    const cleanName = (fullName || "Eco Member").trim();
    const cleanEmail = (email || "member@ecotrack.local").trim();
    const username = cleanEmail.split("@")[0] || cleanName.replace(/\s+/g, "").toLowerCase();

    this.user = {
      isLoggedIn: true,
      username: username.toLowerCase(),
      fullName: cleanName,
      email: cleanEmail,
      role: role,
      memberSince: "October 2024",
      points: 150, // Special sign up gift
      lifetimePoints: 150,
      tier: "Green Explorer",
      totalWasteDivertedKg: 0,
      totalCarbonAvoidedKg: 0,
      itemsAssessedCount: 0,
      treesFundedCount: 0,
      historyLog: [
        {
          id: "tx_signup_" + Date.now(),
          timestamp: new Date().toISOString(),
          description: "Welcome gift: +150 Green Points for joining",
          points: 150,
          type: "earned"
        }
      ],
      redemptions: []
    };
    this.updateTier();
    this.save();
    if (this.onUserChanged) this.onUserChanged(this.user);
    if (this.onPointsChanged) this.onPointsChanged(this.user.points, 150);
    return true;
  }

  logout() {
    this.user = {
      isLoggedIn: false,
      username: "Guest",
      fullName: "Guest User",
      email: "",
      memberSince: "",
      points: 0,
      lifetimePoints: 0,
      tier: "Guest",
      totalWasteDivertedKg: 0,
      totalCarbonAvoidedKg: 0,
      itemsAssessedCount: 0,
      treesFundedCount: 0,
      historyLog: [],
      redemptions: []
    };
    this.save();
    if (this.onUserChanged) this.onUserChanged(this.user);
    if (this.onPointsChanged) this.onPointsChanged(0, 0);
  }
}
