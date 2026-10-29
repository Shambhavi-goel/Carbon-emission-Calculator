const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function normalizeEmail(email) {
  return email.trim().toLowerCase();
}

export function validateName(name) {
  const value = name.trim();
  if (!value) return "Enter your name.";
  if (value.length < 2 || value.length > 60) return "Name must be between 2 and 60 characters.";
  return "";
}

export function validateEmail(email) {
  const value = normalizeEmail(email);
  if (!value) return "Enter your email address.";
  if (value.length > 254 || !EMAIL_PATTERN.test(value)) return "Enter a valid email address.";
  return "";
}

export function validatePassword(password) {
  if (password.length < 8) return "Use at least 8 characters.";
  if (!/[A-Za-z]/.test(password) || !/\d/.test(password)) return "Include at least one letter and one number.";
  return "";
}

export function validateImage(file, maximumBytes) {
  if (!file) return "Choose a photo of one waste item.";
  if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) return "Choose a JPG, PNG, or WebP image.";
  if (file.size === 0) return "The selected image is empty.";
  if (file.size > maximumBytes) return "Choose an image no larger than 5 MB.";
  return "";
}

export function validateWeight(value, unit, maximumKg) {
  if (value.trim() === "") return "Enter the item's approximate weight.";
  const amount = Number(value);
  const weightKg = unit === "g" ? amount / 1000 : amount;
  if (!Number.isFinite(amount) || amount <= 0 || !Number.isFinite(weightKg) || weightKg > maximumKg) {
    return `Enter a weight greater than 0 and no more than ${maximumKg} kg.`;
  }
  return "";
}

export function toKilograms(value, unit) {
  const amount = Number(value);
  return unit === "g" ? amount / 1000 : amount;
}
