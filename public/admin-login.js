import { auth } from './firebase-config.js';
import { signInWithEmailAndPassword } from "https://www.gstatic.com/firebasejs/9.6.1/firebase-auth.js";

const loginForm = document.getElementById('login-form');
const emailInput = document.getElementById('email');
const passwordInput = document.getElementById('password');
const errorMessage = document.getElementById('error-message');
const submitButton = document.getElementById('submit-button');
const originalButtonHTML = submitButton.innerHTML;

loginForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const email = emailInput.value;
    const password = passwordInput.value;
    errorMessage.classList.add('hidden');
    submitButton.disabled = true;
    submitButton.innerHTML = 'Ingresando...';

    signInWithEmailAndPassword(auth, email, password)
        .then((userCredential) => {
            window.location.href = 'admin-dashboard.html';
        })
        .catch((error) => {
            errorMessage.textContent = 'Credenciales incorrectas. Por favor, intente de nuevo.';
            errorMessage.classList.remove('hidden');
            submitButton.disabled = false;
            submitButton.innerHTML = originalButtonHTML;
        });
});
