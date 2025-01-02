document.addEventListener('DOMContentLoaded', () => {
    const loginForm = document.getElementById('loginForm');
    const loginButton = document.getElementById('loginButton');
    const progressBar = document.getElementById('progressBar');
    const progressElement = progressBar.querySelector('.progress');
    const statusMessage = document.getElementById('statusMessage');

    loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const email = document.getElementById('email').value;
        const password = document.getElementById('password').value;

        // Reset status and show progress bar
        statusMessage.textContent = '';
        statusMessage.className = 'status-message';
        progressBar.style.display = 'block';
        progressElement.style.width = '0%';
        loginButton.disabled = true;
        loginButton.textContent = 'Signing in...';

        try {
            // Simulate progress
            await simulateProgress();

            // Perform login API call using AJAX
            const xhr = new XMLHttpRequest();
            xhr.open('POST', 'http://localhost:8000/evoting/auth/login', true);
            xhr.setRequestHeader('Content-Type', 'application/json');

            xhr.onreadystatechange = function () {
                if (xhr.readyState === 4) {
                    progressBar.style.display = 'none';
                    loginButton.disabled = false;
                    loginButton.textContent = 'Sign in';

                    if (xhr.status === 200) {
                        const response = JSON.parse(xhr.responseText);

                        if (response.success) {
                            // Success
                            statusMessage.textContent = 'Login successful! Redirecting...';
                            statusMessage.classList.add('success');
                            setTimeout(() => {
                                window.location.href = './dashboard.html'; // Redirect to dashboard
                            }, 1500);
                        } else {
                            // Show error message from server
                            statusMessage.textContent = 'Invalid credentials. Please try again.';
                            statusMessage.classList.add('error');
                        }
                    } else {

                        console.log(xhr.responseText);
                        // Error response
                        const errorResponse = xhr.responseText
                            ? JSON.parse(xhr.responseText)
                            : { error: 'An unexpected error occurred.' };
                        statusMessage.textContent = errorResponse.error || 'An unexpected error occurred.';
                        statusMessage.classList.add('error');
                    }
                }
            };

            // Send the request with the email and password as JSON
            xhr.send(JSON.stringify({ email, password }));
        } catch (error) {
            // Handle any unexpected client-side errors
            statusMessage.textContent = error.message || 'An unexpected error occurred.';
            statusMessage.classList.add('error');
        } finally {
            progressBar.style.display = 'none';
            loginButton.disabled = false;
            loginButton.textContent = 'Sign in';
        }
    });

    async function simulateProgress() {
        const totalSteps = 100;
        for (let i = 0; i <= totalSteps; i++) {
            await new Promise(resolve => setTimeout(resolve, 20));
            progressElement.style.width = `${i}%`;
        }
    }
});
