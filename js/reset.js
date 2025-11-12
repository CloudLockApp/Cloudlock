document.getElementById("fetch-questions-btn").addEventListener("click", async () => {
  const email = document.getElementById("reset-email").value.trim();
  if (!email) return alert("Please enter your email.");


  try {
    await firebase.auth().sendPasswordResetEmail(email);
    // Generic message to avoid account enumeration
    alert('If an account exists for that email, a password reset link has been sent.');
    window.location.href = 'login.html';
  } catch (err) {
    console.error('sendPasswordResetEmail error', err);
    // Keep message generic to avoid leaking info
    alert('If an account exists for that email, a password reset link has been sent.');
  }
});