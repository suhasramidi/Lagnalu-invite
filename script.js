document.addEventListener('DOMContentLoaded', () => {
    // 1. Failsafe: Prevent browser keeping scroll position on reload which breaks snap layout
    if ('scrollRestoration' in history) {
        history.scrollRestoration = 'manual';
    }
    window.scrollTo(0, 0);

    const video = document.getElementById('intro-video');
    const interactionPrompt = document.getElementById('interaction-prompt');
    const foregroundFooter = document.getElementById('foreground-footer');
    const scrollIndicator = document.querySelector('.scroll-indicator');
    const revealContents = document.querySelectorAll('.reveal-content');

    let videoStarted = false;
    let videoCompleted = false;

    // Helper to start the video
    const startVideo = () => {
        if (!videoStarted) {
            videoStarted = true;
            interactionPrompt.classList.add('hidden');
            
            // Attempt to play.
            video.play().catch(e => {
                console.warn('Video playback failed', e);
                unlockScroll();
            });
        }
    };

    // Listen to first user interaction
    window.addEventListener('wheel', startVideo, { once: true });
    window.addEventListener('touchstart', startVideo, { once: true });
    window.addEventListener('click', startVideo, { once: true });
    window.addEventListener('keydown', startVideo, { once: true });

    // Monitor video progress
    video.addEventListener('timeupdate', () => {
        if (video.duration) {
            const progress = video.currentTime / video.duration;
            
            // Fade in footer at 90%
            if (progress >= 0.9) {
                foregroundFooter.classList.add('active');
            }

            // Unlock scroll at 98%
            if (progress >= 0.98 && !videoCompleted) {
                unlockScroll();
            }
        }
    });

    video.addEventListener('ended', () => {
        if (!videoCompleted) unlockScroll();
    });

    function unlockScroll() {
        videoCompleted = true;
        document.body.classList.add('scroll-unlocked');
        foregroundFooter.classList.add('active');
        
        // Trigger reveal of first page content immediately
        const firstPageItems = document.querySelectorAll('#first-page .reveal-content');
        firstPageItems.forEach(item => item.classList.add('visible'));

        // Show scroll indicator after first text reveals
        if (scrollIndicator) {
            setTimeout(() => {
                scrollIndicator.classList.add('active');
            }, 1000); 
        }
    }

    // Setup intersection observer for revealing subsequent content blocks
    const observerOptions = {
        root: null,
        rootMargin: '0px',
        // Slight lower threshold to trigger as it enters the bottom before snapping up
        threshold: 0.25
    };

    const cardObserver = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                if (!entry.target.closest('#first-page')) {
                    entry.target.classList.add('visible');
                }
            } else {
                const rect = entry.boundingClientRect;
                const windowHeight = window.innerHeight;
                if (rect.top > windowHeight || rect.bottom < 0) {
                   if (!entry.target.closest('#first-page')) {
                       entry.target.classList.remove('visible');
                   }
                }
            }
        });
    }, observerOptions);

    revealContents.forEach(content => cardObserver.observe(content));
});
