const urlParams = new URLSearchParams(window.location.search);
const oobCode = urlParams.get("oobCode");
let resetEmail = null;
let securityQuestions = [];

async function initReset() {
  try {
    resetEmail = await firebase.auth().verifyPasswordResetCode(oobCode);

    // Fetch user's security questions
    const userQuery = await firebase.firestore()
      .collection("users")
      .where("email", "==", resetEmail)
      .limit(1)
      .get();

    if (userQuery.empty) throw new Error("User not found");

    const data = userQuery.docs[0].data();
   
    securityQuestions = Object.values(data.securityQuestions || {});

    if (securityQuestions.length === 0) {
        alert("No security questions found for this account. Cannot proceed with reset.");
        return;
    }

    const container = document.getElementById("questions-container");

    const questionTexts = {
      // Group 1
      pet: "What was the name of your first pet?",
      city: "In what city were you born?",
      school: "What is the name of your elementary school?",
      car: "What was the make of your first car?",
      food: "What is your favorite food?",
      teacher: "What was your favorite teacher's name?",
      // Group 2
      maiden: "What is your mother's maiden name?",
      street: "What street did you grow up on?",
      job: "What was your first job?",
      movie: "What is your favorite movie?",
      book: "What is your favorite book?",
      vacation: "Where did you go on your first vacation?",
      // Group 3
      nickname: "What was your childhood nickname?",
      friend: "What is your best friend's name?",
      sport: "What is your favorite sport?",
      sibling: "What is your oldest sibling's name?",
      color: "What is your favorite color?",
      hospital: "In what hospital were you born?"
    };
    
    container.innerHTML = securityQuestions.map((q, i) => `
      <div class="security-question">
        <label>${questionTexts[q.question] || q.question}</label>
        <input type="text" id="answer-${i}" placeholder="Your Answer">
      </div>
`    ).join("");

  } catch (err) {
    console.error("Reset initialization error:", err);
    alert("Invalid or expired reset link.");
    window.location.href = "reset.html";
  }
}

document.getElementById("submit-answers-btn").onclick = async () => {
  for (let i = 0; i < securityQuestions.length; i++) {
    const input = document.getElementById(`answer-${i}`).value.trim().toLowerCase();
    const correctHash = securityQuestions[i].answer;

    // Hash the user's input to compare with the stored hash
    const hashedInput = CryptoJS.SHA256(input).toString();

    if (hashedInput !== correctHash) {
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

  if (newPass.length < 8) {
      alert("Password must be at least 8 characters long.");
      return;
  }

  if (newPass !== confirmPass) {
    alert("Passwords do not match");
    return;
  }

  try {
    await firebase.auth().confirmPasswordReset(oobCode, newPass);
    alert("Password reset successfully");
    window.location.href = "login.html";
  } catch (err) {
    alert("Failed to reset password.");
  }
};

initReset();
