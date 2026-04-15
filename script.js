document.addEventListener('DOMContentLoaded', () => {
    // Core Failsafes: Block browser auto-scroll restoration
    if ('scrollRestoration' in history) {
        history.scrollRestoration = 'manual';
    }
    
    const video = document.getElementById('intro-video');
    const videoWrapper = document.getElementById('video-wrapper');
    const interactionPrompt = document.getElementById('interaction-prompt');
    const foregroundFooter = document.getElementById('foreground-footer');
    const globalScrollArrow = document.getElementById('global-scroll-arrow');
    const revealContents = document.querySelectorAll('.reveal-content');
    
    // Audio elements
    const bgMusic = document.getElementById('bg-music');
    const muteToggle = document.getElementById('mute-toggle');
    
    let videoStarted = false;
    let videoCompleted = false;
    let audioStarted = false;

    // Set subtle background volume
    if (bgMusic) {
        bgMusic.volume = 0.3;
    }

    // Hard reset mechanism to purge bad load mapping
    const enforceReset = () => {
        window.scrollTo(0, 0);
        document.body.classList.remove('scroll-unlocked');
        document.body.classList.add('ready'); // Fades the safety boot-overlay
        if (bgMusic) bgMusic.pause();
    };
    
    // Absolute hard wipe to guarantee the browser overwrites the tab's internal scroll memory right BEFORE WhatsApp caches it
    window.addEventListener('beforeunload', () => {
        window.scrollTo(0, 0);
        if (bgMusic) bgMusic.pause();
    });

    window.addEventListener('pagehide', () => {
        if (bgMusic) bgMusic.pause();
    });

    // Handle tab visibility (pause when backgrounded)
    document.addEventListener("visibilitychange", () => {
        if (document.hidden) {
            if (bgMusic && !bgMusic.paused) {
                bgMusic.pause();
                bgMusic.dataset.wasPlaying = "true";
            }
        }
    });

    // Resume audio only on explicit interaction if it was paused by backgrounding
    const resumeAudioOnInteraction = () => {
        if (bgMusic && bgMusic.dataset.wasPlaying === "true") {
            bgMusic.play().catch(e => console.warn('Audio resume blocked:', e));
            bgMusic.dataset.wasPlaying = "false";
        }
    };

    document.addEventListener('click', resumeAudioOnInteraction);
    document.addEventListener('touchstart', resumeAudioOnInteraction);

    // iOS/Browser "Recent apps" tab-switch failover
    window.addEventListener('pageshow', (event) => {
        if (event.persisted) {
            window.location.reload();
        } else {
            enforceReset();
            setTimeout(() => window.scrollTo(0, 0), 10);
        }
    });

    // iOS WebKit exact first frame trick - async wrap to ensure metadata is processed
    if (video) {
        video.load();
        
        // Wait for metadata so the frame seek is respected by WebKit
        video.addEventListener('loadedmetadata', () => {
            requestAnimationFrame(() => {
                video.currentTime = 0.001;
            });
        }, { once: true });
        
        // Fallback constraint if loadedmetadata already fired or fails
        setTimeout(() => {
            if (video.currentTime === 0) video.currentTime = 0.001;
        }, 50);
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

        // iOS strictly mandates audio playback must be directly inside the user action stack
        if (!audioStarted && bgMusic) {
            audioStarted = true;
            bgMusic.play().catch(e => console.warn('Audio blocked:', e));
        } else if (audioStarted && bgMusic && bgMusic.paused && bgMusic.dataset.wasPlaying !== "true") {
             // Only resume if not muted (handled by mute toggle logic via another listener)
             if (!bgMusic.muted && document.body.classList.contains('scroll-unlocked')) {
                 // Do not force play unless it is an explicit interaction handled elsewhere
             }
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
                if (muteToggle) muteToggle.classList.add('active');
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
        if (muteToggle) muteToggle.classList.add('active');
        
        // Lock document scroll exactly to the top pixel seamlessly
        window.scrollTo(0, 0);
        // Force an immediate layout recalculation natively to bypass delayed frame caches
        requestAnimationFrame(() => {
            window.scrollTo(0, 0);
            setTimeout(() => window.scrollTo(0, 0), 50);
        });

        // Elegantly reveal the integrated first page
        const ganeshPageItems = document.querySelectorAll('#ganesh-page .reveal-content');
        ganeshPageItems.forEach(item => item.classList.add('visible'));

        if (globalScrollArrow) {
            setTimeout(() => {
                globalScrollArrow.classList.add('active');
            }, 800); 
            
            // Re-bind the click event here or just ensure it's bound.
            // Since it's global, we bind it outside.
        }
    }
    
    if (globalScrollArrow) {
        globalScrollArrow.addEventListener('click', () => {
            const wrapper = document.getElementById('scroll-wrapper');
            if (wrapper) {
                // Execute a smooth native scroll burst by exactly one viewport segment height
                wrapper.scrollBy({ top: window.innerHeight, behavior: 'smooth' });
            }
        });
    }

    // Bind Mutator toggle listener safely outside of main initialization bounds
    if (muteToggle && bgMusic) {
        muteToggle.addEventListener('click', (e) => {
            // Stop toggle from causing scroll snapping conflicts if hit
            e.stopPropagation(); 
            
            bgMusic.muted = !bgMusic.muted;
            const iconOn = muteToggle.querySelector('.icon-on');
            const iconOff = muteToggle.querySelector('.icon-off');
            
            if (bgMusic.muted) {
                if (iconOn) iconOn.style.display = 'none';
                if (iconOff) iconOff.style.display = 'block';
            } else {
                if (iconOn) iconOn.style.display = 'block';
                if (iconOff) iconOff.style.display = 'none';
            }
        });
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
                if (!entry.target.closest('#ganesh-page')) {
                    entry.target.classList.add('visible');
                }
            } else {
                const rect = entry.boundingClientRect;
                const windowHeight = window.innerHeight;
                if (rect.top > windowHeight || rect.bottom < 0) {
                   if (!entry.target.closest('#ganesh-page')) {
                       entry.target.classList.remove('visible');
                   }
                }
            }
        });
    }, observerOptions);

    revealContents.forEach(content => cardObserver.observe(content));
    
    // Dedicated observer for managing persistent layouts structurally
    const layoutStateObserver = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                if (entry.target.id === 'ganesh-page') {
                    document.body.classList.remove('header-visible');
                } else {
                    document.body.classList.add('header-visible');
                }

                if (entry.target.classList.contains('last-segment')) {
                    document.body.classList.add('hide-arrow');
                } else {
                    document.body.classList.remove('hide-arrow');
                }
            }
        });
    }, { threshold: 0.5 });
    
    document.querySelectorAll('.snap-segment').forEach(seg => layoutStateObserver.observe(seg));
});
