document.addEventListener('DOMContentLoaded', () => {
    // Core Failsafes: Block browser auto-scroll restoration
    if ('scrollRestoration' in history) {
        history.scrollRestoration = 'manual';
    }
    
    const video = document.getElementById('intro-video');
    const videoWrapper = document.getElementById('video-wrapper');
    const interactionPrompt = document.getElementById('interaction-prompt');
    const foregroundFooter = document.getElementById('foreground-footer');
    const scrollIndicator = document.querySelector('.scroll-indicator');
    const revealContents = document.querySelectorAll('.reveal-content');
    
    let videoStarted = false;
    let videoCompleted = false;

    // Hard reset mechanism to purge bad load mapping
    const enforceReset = () => {
        window.scrollTo(0, 0);
        document.body.classList.remove('scroll-unlocked');
        document.body.classList.add('ready'); // Fades the safety boot-overlay
    };
    
    // Absolute hard wipe to guarantee the browser overwrites the tab's internal scroll memory right BEFORE WhatsApp caches it
    window.addEventListener('beforeunload', () => {
        window.scrollTo(0, 0);
    });

    // iOS/Browser "Recent apps" tab-switch failover
    window.addEventListener('pageshow', (event) => {
        if (event.persisted) {
            window.location.reload();
        } else {
            enforceReset();
            setTimeout(() => window.scrollTo(0, 0), 10);
        }
    });

    // iOS WebKit exact first frame trick
    if (video) {
        // Must load to evaluate buffer
        video.load();
        video.currentTime = 0.001; 
    }

    // Safely attempt the playback sequence
    const startVideo = () => {
        if (!videoStarted) {
            videoStarted = true;
            interactionPrompt.classList.add('hidden');
            
            video.play().catch(e => {
                console.warn('Video playback completely blocked or failed:', e);
                // Hard skip to UI if user device fundamentally refuses MP4
                unlockScroll();
            });
        }
    };

    window.addEventListener('wheel', startVideo, { once: true });
    window.addEventListener('touchstart', startVideo, { once: true });
    window.addEventListener('click', startVideo, { once: true });
    window.addEventListener('keydown', startVideo, { once: true });

    // Stream progression mapping
    video.addEventListener('timeupdate', () => {
        if (video.duration) {
            const progress = video.currentTime / video.duration;
            
            // Trigger footer overlay 
            if (progress >= 0.9) {
                foregroundFooter.classList.add('active');
            }

            // Execute final transition milliseconds before the clip freezes
            if (progress >= 0.99 && !videoCompleted) {
                unlockScroll();
            }
        }
    });

    // Native fallback callback
    video.addEventListener('ended', () => {
        if (!videoCompleted) unlockScroll();
    });

    // Sequence for transferring UI priority from the video wrapper strictly to the Scroll view
    function unlockScroll() {
        if (videoCompleted) return;
        videoCompleted = true;
        
        // Dissolve and remove video layer to disable interference
        videoWrapper.classList.add('hide-post-play');
        setTimeout(() => { videoWrapper.style.display = 'none'; }, 1500);

        // Turn on the CSS snap scroll engine
        document.body.classList.add('scroll-unlocked');
        foregroundFooter.classList.add('active');
        
        // Lock document scroll exactly to the top pixel seamlessly
        window.scrollTo(0, 0);
        // Force an immediate layout recalculation natively to bypass delayed frame caches
        requestAnimationFrame(() => {
            window.scrollTo(0, 0);
            setTimeout(() => window.scrollTo(0, 0), 50);
        });

        // Elegantly reveal the integrated first page
        const firstPageItems = document.querySelectorAll('#first-page .reveal-content');
        firstPageItems.forEach(item => item.classList.add('visible'));

        if (scrollIndicator) {
            setTimeout(() => {
                scrollIndicator.classList.add('active');
            }, 800); 
        }
    }

    // Advanced dynamic visibility trigger using Intersection Observers mapped perfectly to Snap boundaries
    const observerOptions = {
        root: null,
        rootMargin: '0px',
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
