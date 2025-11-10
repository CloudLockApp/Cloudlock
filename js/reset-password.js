const urlParams = new URLSearchParams(window.location.search);
const oobCode = urlParams.get("oobCode");
let resetEmail = null;
let securityQuestions = [];

async function initReset() {
  try {
    resetEmail = await firebase.auth().verifyPasswordResetCode(oobCode);

    // Fetch user's security questions
    const userDoc = await firebase.firestore()
      .collection("users")
      .where("email", "==", resetEmail)
      .limit(1)
      .get();

    if (userDoc.empty) throw new Error("User not found");

    const data = userDoc.docs[0].data();
    securityQuestions = data.securityQuestions || [];

    const container = document.getElementById("questions-container");

    container.innerHTML = securityQuestions.map((q,i) => `
      <div class="security-question">
        <label>${q.question}</label>
        <input type="text" id="answer-${i}" placeholder="Your Answer">
      </div>
    `).join("");

  } catch (err) {
    alert("Invalid or expired reset link.");
    window.location.href = "reset.html";
  }
}

document.getElementById("submit-answers-btn").onclick = async () => {
  for (let i = 0; i < securityQuestions.length; i++) {
    const input = document.getElementById(`answer-${i}`).value.trim().toLowerCase();
    const correct = securityQuestions[i].answer.toLowerCase();

    if (input !== correct) {
      alert("Incorrect security answer");
      return;
    }
  }

  // Passed security questions
  document.getElementById("step-questions").classList.add("hidden");
  document.getElementById("step-new-password").classList.remove("hidden");
};

document.getElementById("reset-password-btn").onclick = async () => {
  const newPass = document.getElementById("new-password").value;
  const confirmPass = document.getElementById("confirm-password").value;

  if (newPass !== confirmPass) {
    alert("Passwords do not match");
    return;
  }

  try {
    await firebase.auth().confirmPasswordReset(oobCode, newPass);
    alert("Password reset successfully 🔐");
    window.location.href = "login.html";
  } catch (err) {
    alert("Failed to reset password.");
  }
};

initReset();
