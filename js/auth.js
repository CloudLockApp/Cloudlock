// auth.js
// IMPORTANT: Load this file with <script type="module" ...>

import { auth, db } from "./firebase-init.js";

import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  onAuthStateChanged,
  signOut,
  multiFactor,
  getMultiFactorResolver,
  TotpMultiFactorGenerator,
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-auth.js";

import {
  doc,
  setDoc,
  getDoc,
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js";

// =========================
// Existing UI/logic (kept)
// =========================

let encryptionKey = null;
let isShowingDashboard = false; // Flag to prevent double dashboard load

// Password requirements validation
const requirements = {
  length: (password) => password.length >= 8,
  uppercase: (password) => /[A-Z]/.test(password),
  lowercase: (password) => /[a-z]/.test(password),
  number: (password) => /[0-9]/.test(password),
  special: (password) => /[!@#$%^&*(),.?":{}|<>]/.test(password),
};

// Initialize password strength checker when DOM is loaded
document.addEventListener("DOMContentLoaded", function () {
  const passwordInput = document.getElementById("reg-password");
  const confirmPasswordInput = document.getElementById("reg-confirm");

  if (passwordInput) {
    passwordInput.addEventListener("input", updatePasswordStrength);
  }

  if (confirmPasswordInput) {
    confirmPasswordInput.addEventListener("input", updateSubmitButton);
  }
});

// Update password strength indicator
function updatePasswordStrength() {
  const password = document.getElementById("reg-password").value;
  const strengthBar = document.getElementById("strengthBar");
  const strengthText = document.getElementById("strengthText");
  let metCount = 0;

  // Check each requirement
  Object.keys(requirements).forEach((req) => {
    const requirementItem = document.querySelector(
      `[data-requirement="${req}"]`
    );
    if (!requirementItem) return;

    const isMet = requirements[req](password);

    if (isMet) {
      requirementItem.classList.add("met");
      metCount++;
    } else {
      requirementItem.classList.remove("met");
    }

    // Add active class when typing
    if (password.length > 0) {
      requirementItem.classList.add("active");
    } else {
      requirementItem.classList.remove("active");
    }
  });

  // Update strength bar
  if (strengthBar && strengthText) {
    strengthBar.className = "strength-bar";
    if (metCount === 0) {
      strengthBar.style.width = "0%";
      strengthText.textContent = "";
    } else if (metCount <= 2) {
      strengthBar.classList.add("weak");
      strengthText.textContent = "Weak Password";
      strengthText.style.color = "#ef4444";
    } else if (metCount === 3) {
      strengthBar.classList.add("fair");
      strengthText.textContent = "Fair Password";
      strengthText.style.color = "#f59e0b";
    } else if (metCount === 4) {
      strengthBar.classList.add("good");
      strengthText.textContent = "Good Password";
      strengthText.style.color = "#a78bfa";
    } else if (metCount === 5) {
      strengthBar.classList.add("strong");
      strengthText.textContent = "Strong Password!";
      strengthText.style.color = "#10b981";
    }
  }

  // Enable/disable submit button
  updateSubmitButton();
}

// Update submit button state
function updateSubmitButton() {
  const password = document.getElementById("reg-password").value;
  const confirmPassword = document.getElementById("reg-confirm").value;
  const submitBtn = document.getElementById("registerSubmitBtn");

  if (!submitBtn) return;

  const allMet = Object.keys(requirements).every((req) =>
    requirements[req](password)
  );
  const passwordsMatch = password === confirmPassword && password.length > 0;

  if (allMet && passwordsMatch) {
    submitBtn.classList.add("enabled");
    submitBtn.style.opacity = "1";
    submitBtn.style.pointerEvents = "all";
  } else {
    submitBtn.classList.remove("enabled");
    submitBtn.style.opacity = "0.5";
    submitBtn.style.pointerEvents = "none";
  }
}

// Switch between login and register tabs
function switchTab(tab) {
  const loginForm = document.getElementById("login-form");
  const registerForm = document.getElementById("register-form");
  const tabs = document.querySelectorAll(".tab-btn");

  tabs.forEach((btn) => btn.classList.remove("active"));

  if (tab === "login") {
    if (loginForm) loginForm.style.display = "block";
    if (registerForm) registerForm.style.display = "none";
    tabs[0]?.classList.add("active");
  } else {
    if (loginForm) loginForm.style.display = "none";
    if (registerForm) registerForm.style.display = "block";
    tabs[1]?.classList.add("active");
  }
}

// =========================
// Registration (with TOTP)
// =========================
export async function handleRegister(event) {
  event.preventDefault();

  const name = document.getElementById("reg-name").value;
  const email = document.getElementById("reg-email").value;
  const password = document.getElementById("reg-password").value;
  const confirmPassword = document.getElementById("reg-confirm").value;
  const enable2FA = document.getElementById("enable-2fa").checked;

  // Validate password match
  if (password !== confirmPassword) {
    showToast("Passwords do not match!", "error");
    return;
  }

  // Validate all password requirements are met
  const allMet = Object.keys(requirements).every((req) =>
    requirements[req](password)
  );
  if (!allMet) {
    showToast("Please meet all password requirements", "error");
    return;
  }

  // Show loading state
  const submitBtn = event.target.querySelector('button[type="submit"]');
  const originalText = submitBtn?.innerHTML;
  if (submitBtn) {
    submitBtn.innerHTML =
      '<i class="fas fa-spinner fa-spin"></i> Creating Account...';
    submitBtn.disabled = true;
  }

  try {
    // Create user with Firebase (modular)
    const userCredential = await createUserWithEmailAndPassword(
      auth,
      email,
      password
    );

    // Set encryption key
    encryptionKey = password;

    // Store user data including name
    await setDoc(doc(db, "users", userCredential.user.uid), {
      name,
      email,
      twoFactorEnabled: !!enable2FA,
      createdAt: new Date(),
    });

    // Enroll TOTP MFA immediately if requested
    if (enable2FA) {
      try {
        await enrollTotp(auth.currentUser);
        await setDoc(
          doc(db, "users", userCredential.user.uid),
          { twoFactorEnabled: true },
          { merge: true }
        );
      } catch (e) {
        console.error("TOTP enroll failed:", e);
        showToast(
          "2FA enrollment failed. You can enable it later from settings.",
          "error"
        );
      }
    }

    showToast("Account created successfully!", "success");

    // Auto-login after registration (user is already signed in)
    showDashboard(userCredential.user);
  } catch (error) {
    console.error("Registration error:", error);
    let errorMessage = "Registration failed. Please try again.";

    if (error.code === "auth/email-already-in-use") {
      errorMessage = "This email is already registered. Please login instead.";
    } else if (error.code === "auth/invalid-email") {
      errorMessage = "Invalid email address.";
    } else if (error.code === "auth/weak-password") {
      errorMessage = "Password is too weak.";
    }

    showToast(errorMessage, "error");
  } finally {
    if (submitBtn) {
      submitBtn.innerHTML = originalText || submitBtn.innerHTML;
      submitBtn.disabled = false;
    }
  }
}

// Helper: TOTP Enrollment flow
async function enrollTotp(currentUser) {
  // 1) Create an MFA session
  const mfaSession = await multiFactor(currentUser).getSession();

  // 2) Generate a TOTP secret
  const totpSecret = await TotpMultiFactorGenerator.generateSecret(mfaSession);

  // 3) Show QR and backup key (UI optional; will use existing elements if present)
  //    You may include a QR lib (e.g., qrcode) to render the URI into a canvas.
  const otpauth = totpSecret.generateQrCodeUrl(currentUser.email, "CloudLock");
  const canvas = document.getElementById("totp-qr");
  if (canvas && window.QRCode && window.QRCode.toCanvas) {
    // If you included a QR lib (e.g., qrcode.min.js), render the QR
    await window.QRCode.toCanvas(canvas, otpauth);
  }
  const keyBox = document.getElementById("totp-key");
  if (keyBox) keyBox.textContent = totpSecret.secretKey;

  // 4) Ask for the 6-digit code from the user's authenticator app
  const verificationCode = window.prompt(
    "Enter the 6-digit code from your authenticator app:"
  );

  // 5) Finalize enrollment
  const assertion = TotpMultiFactorGenerator.assertionForEnrollment(
    totpSecret,
    verificationCode
  );
  await multiFactor(currentUser).enroll(assertion, "Authenticator");
  showToast("2FA enrolled successfully.", "success");
}

// =========================
// Login (handles MFA)
// =========================
export async function handleLogin(event) {
  event.preventDefault();

  const email = document.getElementById("login-email").value;
  const password = document.getElementById("login-password").value;

  // Show loading state
  const submitBtn = event.target.querySelector('button[type="submit"]');
  const originalText = submitBtn?.innerHTML;
  if (submitBtn) {
    submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Logging in...';
    submitBtn.disabled = true;
  }

  try {
    // Attempt normal sign-in
    const cred = await signInWithEmailAndPassword(auth, email, password);

    // Set encryption key
    encryptionKey = password;

    showToast("Login successful!", "success");
    showDashboard(cred.user);
  } catch (error) {
    if (error.code === "auth/multi-factor-auth-required") {
      // MFA required → resolve with TOTP
      try {
        const resolver = getMultiFactorResolver(auth, error);

        // Ask for code
        const code = window.prompt("Enter your 6-digit authenticator code:");

        // We assume TOTP; if you later add SMS, present a picker using resolver.hints
        const totpHint = resolver.hints.find(
          (h) => h.factorId === TotpMultiFactorGenerator.FACTOR_ID
        );

        if (!totpHint) {
          showToast(
            "This account requires a second factor we don't support yet.",
            "error"
          );
        } else {
          const assertion =
            TotpMultiFactorGenerator.assertionForSignIn(totpHint.uid, code);
          const finalCred = await resolver.resolveSignIn(assertion);

          encryptionKey = password;
          showToast("Login successful!", "success");
          showDashboard(finalCred.user);
        }
      } catch (mfaErr) {
        console.error("MFA sign-in error:", mfaErr);
        showToast("Invalid or expired MFA code.", "error");
      }
    } else {
      console.error("Login error:", error);
      let errorMessage = "Login failed. Please check your credentials.";

      if (error.code === "auth/user-not-found") {
        errorMessage = "No account found with this email.";
      } else if (error.code === "auth/wrong-password") {
        errorMessage = "Incorrect password.";
      } else if (error.code === "auth/invalid-email") {
        errorMessage = "Invalid email address.";
      }

      showToast(errorMessage, "error");
    }
  } finally {
    if (submitBtn) {
      submitBtn.innerHTML = originalText || submitBtn.innerHTML;
      submitBtn.disabled = false;
    }
  }
}

// =========================
// UI helpers (kept)
// =========================

function typeWriter(element, text, speed = 50) {
  let i = 0;
  element.textContent = "";

  function type() {
    if (i < text.length) {
      element.textContent += text.charAt(i);
      i++;
      setTimeout(type, speed);
    }
  }

  type();
}

// Show dashboard after successful login
async function showDashboard(user) {
  // Prevent double execution
  if (isShowingDashboard) return;
  isShowingDashboard = true;

  const authContainer = document.getElementById("auth-container");
  if (authContainer) authContainer.style.display = "none";

  // Hide hero and info sections when logged in
  const heroSection = document.getElementById("hero-section");
  const infoSection = document.getElementById("features");
  const navLinks = document.getElementById("nav-links");

  if (heroSection) heroSection.style.display = "none";
  if (infoSection) infoSection.style.display = "none";
  if (navLinks) navLinks.style.display = "none";

  document.getElementById("dashboard")?.classList.add("active");
  const navUser = document.getElementById("nav-user");
  if (navUser) navUser.style.display = "block";
  const userEmailEl = document.getElementById("user-email");
  if (userEmailEl) userEmailEl.textContent = user.email;

  // Clear and reset the dashboard title immediately
  const dashboardTitle = document.querySelector(".dashboard-header h1");
  if (dashboardTitle) dashboardTitle.textContent = ""; // Clear it first

  // Get user's name from Firestore
  try {
    const userDoc = await getDoc(doc(db, "users", user.uid));

    if (userDoc.exists() && userDoc.data().name) {
      const userName = userDoc.data().name;

      // Create typewriter effect for welcome message
      const welcomeMessages = [
        `Welcome back, ${userName}.`,
        `Identity verified. Welcome, ${userName}.`,
        `You're in, ${userName}. Let's keep your world secure.`,
      ];

      // Pick a random message
      const message =
        welcomeMessages[Math.floor(Math.random() * welcomeMessages.length)];

      // Apply typewriter effect
      typeWriter(dashboardTitle, message, 60);
    } else {
      typeWriter(
        dashboardTitle,
        "Access granted. Your vault is secure.",
        60
      );
    }
  } catch (error) {
    console.error("Error fetching user data:", error);
    typeWriter(document.querySelector(".dashboard-header h1"), "Welcome to Your Secure Vault", 60);
  }

  // Load user's passwords
  if (typeof loadPasswords === "function") {
    loadPasswords();
  }
}

// Logout function
export async function logout() {
  try {
    await signOut(auth);
    encryptionKey = null;
    isShowingDashboard = false;

    // Hide auth container initially - user must click to show it
    const authContainer = document.getElementById("auth-container");
    if (authContainer) authContainer.style.display = "none";

    // Show hero and info sections when logged out
    const heroSection = document.getElementById("hero-section");
    const infoSection = document.getElementById("features");
    const navLinks = document.getElementById("nav-links");

    if (heroSection) heroSection.style.display = "block";
    if (infoSection) infoSection.style.display = "block";
    if (navLinks) navLinks.style.display = "flex";

    document.getElementById("dashboard")?.classList.remove("active");
    const navUser = document.getElementById("nav-user");
    if (navUser) navUser.style.display = "none";

    // Reset dashboard title
    const dashboardTitle = document.querySelector(".dashboard-header h1");
    if (dashboardTitle) dashboardTitle.textContent = "Welcome to Your Secure Vault";

    showToast("Logged out successfully", "success");
  } catch (error) {
    console.error("Logout error:", error);
    showToast("Logout failed", "error");
  }
}

// Check authentication state on page load
onAuthStateChanged(auth, (user) => {
  if (user) {
    // User is signed in - only show dashboard if not already showing
    if (!isShowingDashboard) {
      showDashboard(user);
    }
  } else {
    // User is signed out
    isShowingDashboard = false;

    // Keep auth container hidden on landing page
    const authContainer = document.getElementById("auth-container");
    if (authContainer) authContainer.style.display = "none";
    document.getElementById("dashboard")?.classList.remove("active");

    // Make sure landing sections are visible
    const heroSection = document.getElementById("hero-section");
    const infoSection = document.getElementById("features");
    const navLinks = document.getElementById("nav-links");

    if (heroSection) heroSection.style.display = "block";
    if (infoSection) infoSection.style.display = "block";
    if (navLinks) navLinks.style.display = "flex";
  }
});
