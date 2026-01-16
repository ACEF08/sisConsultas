
import { auth } from './firebase-config.js';
import { signInWithEmailAndPassword } from "https://www.gstatic.com/firebasejs/9.6.1/firebase-auth.js";

document.addEventListener('DOMContentLoaded', () => {
    const loginForm = document.getElementById('admin-login-form');

    loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const email = document.getElementById('email').value;
        const password = document.getElementById('password').value;
        const submitButton = loginForm.querySelector('button[type="submit"]');
        const originalButtonHTML = submitButton.innerHTML;

        submitButton.disabled = true;
        submitButton.innerHTML = '<span class="loader"></span> Verificando...';

        try {
            await signInWithEmailAndPassword(auth, email, password);
            // On successful login, redirect to the admin panel
            window.location.href = 'admin.html';
        } catch (error) {
            let errorMessage = "Ocurrió un error inesperado. Por favor, intente de nuevo.";
            switch (error.code) {
                case 'auth/user-not-found':
                case 'auth/wrong-password':
                case 'auth/invalid-credential':
                    errorMessage = "Credenciales incorrectas. Verifique su correo y contraseña.";
                    break;
                case 'auth/invalid-email':
                    errorMessage = "El formato del correo electrónico no es válido.";
                    break;
            }
            alert(errorMessage);
            console.error("Error de autenticación:", error);
        } finally {
            submitButton.disabled = false;
            submitButton.innerHTML = originalButtonHTML;
        }
    });
});
