// register.js
(function () {
  const registerForm = document.getElementById("registerForm");

  function showCustomAlert(type, message) {
    const alertColors = {
      success: "#28a745",
      error: "#dc3545",
      warning: "#ffc107"
    };
    const alert = document.createElement("div");
    alert.classList.add("custom-alert");
    alert.style.backgroundColor = alertColors[type] || "#E6007E";
    alert.textContent = message;
    document.body.appendChild(alert);
    setTimeout(() => {
      alert.remove();
    }, 3000);
  }

  if (registerForm) {
    registerForm.addEventListener("submit", function (event) {
      event.preventDefault();
      showCustomAlert("warning", "El registro se realiza únicamente mediante Google. Por favor, usa el botón de inicio de sesión con Google.");
    });
  }
})();
