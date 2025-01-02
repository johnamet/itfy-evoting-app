document.addEventListener('DOMContentLoaded', function() {
    // Toggle sidebar on mobile
    const toggleSidebar = document.createElement('button');
    toggleSidebar.textContent = '☰';
    toggleSidebar.className = 'toggle-sidebar';
    document.querySelector('.header').prepend(toggleSidebar);

    toggleSidebar.addEventListener('click', function() {
        document.querySelector('.sidebar').classList.toggle('show-sidebar');
    });

    // Highlight active sidebar item
    const sidebarItems = document.querySelectorAll('.sidebar li');
    sidebarItems.forEach(item => {
        item.addEventListener('click', function() {
            sidebarItems.forEach(i => i.classList.remove('active'));
            this.classList.add('active');
        });
    });

    // Simulate notifications
    const notificationIcon = document.querySelector('.notification-icon');
    notificationIcon.addEventListener('click', function() {
        alert('You have 3 new notifications');
    });

    // Quick action buttons
    const actionButtons = document.querySelectorAll('.action-button');
    actionButtons.forEach(button => {
        button.addEventListener('click', function() {
            alert(`Action: ${this.textContent}`);
        });
    });

    // Simulate real-time updates
    setInterval(() => {
        const randomProgress = Math.floor(Math.random() * 100);
        document.querySelector('.progress').style.width = `${randomProgress}%`;
        document.querySelector('.progress-text').textContent = `${randomProgress}% Complete`;
    }, 5000);
});