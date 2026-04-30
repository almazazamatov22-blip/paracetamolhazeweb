document.addEventListener('DOMContentLoaded', () => {
    const video = document.getElementById('localVideo');

    if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
        navigator.mediaDevices.getUserMedia({ video: true })
            .then((stream) => {
                video.srcObject = stream;
            })
            .catch((err) => {
                console.warn("Камера не найдена или доступ запрещен:", err);
            });
    }

    const slider = document.querySelector('.bet-slider');
    const display = document.querySelector('.amount-display');

    if (slider && display) {
        slider.addEventListener('input', (e) => {
            const val = (e.target.value / 100).toFixed(2);
            display.textContent = `$${val}`;
        });
    }

    const buttons = document.querySelectorAll('.btn, .q-btn, .adjust-btn, .icon-btn');
    buttons.forEach(btn => {
        btn.addEventListener('click', () => {
            btn.style.opacity = '0.5';
            setTimeout(() => btn.style.opacity = '1', 100);
        });
    });
});
