document.addEventListener('DOMContentLoaded', () => {
    const loginBtn = document.getElementById('loginBtn');
    const heroSection = document.querySelector('.hero');
    const navLinks = document.querySelectorAll('nav a');
    const eventCards = document.querySelectorAll('.event-card');
    const candidateCards = document.querySelectorAll('.candidate-card');

    // Login button functionality
    loginBtn.addEventListener('click', () => {
        window.location.href ="../web_static/pages/login.html";
    });

    // Simple fade-in animation for hero section
    setTimeout(() => {
        heroSection.style.opacity = '0';
        heroSection.style.transition = 'opacity 1s ease-in-out';
        setTimeout(() => {
            heroSection.style.opacity = '1';
        }, 50);
    }, 300);

    // Smooth scrolling for navigation links
    navLinks.forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            const targetId = link.getAttribute('href');
            const targetSection = document.querySelector(targetId);
            if (targetSection) {
                targetSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }
        });
    });

    // Simple parallax effect for background
    window.addEventListener('scroll', () => {
        const scrollPosition = window.pageYOffset;
        document.body.style.backgroundPositionY = `${scrollPosition * 0.5}px`;
    });

    // Add 'active' class to navigation links based on scroll position
    window.addEventListener('scroll', () => {
        const scrollPosition = window.pageYOffset;

        document.querySelectorAll('section').forEach(section => {
            const sectionTop = section.offsetTop - 100;
            const sectionBottom = sectionTop + section.offsetHeight;

            if (scrollPosition >= sectionTop && scrollPosition < sectionBottom) {
                const correspondingLink = document.querySelector(`nav a[href="#${section.id}"]`);
                if (correspondingLink) {
                    navLinks.forEach(link => link.classList.remove('active'));
                    correspondingLink.classList.add('active');
                }
            }
        });
    });

    // Add hover effect to event cards
    eventCards.forEach(card => {
        card.addEventListener('mouseenter', () => {
            card.style.transform = 'scale(1.05)';
        });
        card.addEventListener('mouseleave', () => {
            card.style.transform = 'scale(1)';
        });
    });

    // Add hover effect to candidate cards
    candidateCards.forEach(card => {
        card.addEventListener('mouseenter', () => {
            card.style.transform = 'scale(1.05)';
        });
        card.addEventListener('mouseleave', () => {
            card.style.transform = 'scale(1)';
        });
    });
});