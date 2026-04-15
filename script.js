document.addEventListener('DOMContentLoaded', () => {
    // ── Core Failsafe: Block browser auto-scroll restoration ──────────────────
    if ('scrollRestoration' in history) {
        history.scrollRestoration = 'manual';
    }

    const video            = document.getElementById('intro-video');
    const videoWrapper     = document.getElementById('video-wrapper');
    const interactionPrompt = document.getElementById('interaction-prompt');
    const foregroundFooter = document.getElementById('foreground-footer');
    const globalScrollArrow = document.getElementById('global-scroll-arrow');
    const revealContents   = document.querySelectorAll('.reveal-content');
    const bgMusic          = document.getElementById('bg-music');
    const muteToggle       = document.getElementById('mute-toggle');

    let videoStarted   = false;
    let videoCompleted = false;
    let audioUnlocked  = false; // true once a user gesture has unlocked audio

    // ── Audio: Core play wrapper ──────────────────────────────────────────────
    // MUST be called synchronously inside a user-gesture stack for Android/iOS.
    // Android Chrome: load() is async — play() immediately after causes AbortError.
    // Solution: set src + load() inside gesture (preserves user-activation token),
    // then play() on canplaythrough. iOS allows play() directly in gesture.
    function playAudio() {
        if (!bgMusic) return;

        bgMusic.volume = 0.3;

        // Attempt 1: direct play (works on iOS + desktop where preload already loaded enough)
        const directAttempt = bgMusic.play();
        if (directAttempt !== undefined) {
            directAttempt.catch(err => {
                console.warn('Direct play() failed (' + err.name + '), trying load-then-play…');

                // Attempt 2: load() then wait for enough data, then play
                bgMusic.addEventListener('canplaythrough', function onReady() {
                    bgMusic.removeEventListener('canplaythrough', onReady);
                    bgMusic.play().catch(err2 => {
                        console.warn('canplaythrough play() also failed (' + err2.name + '), registering retry…');
                        // Attempt 3: one-shot retry on very next user gesture
                        const retryOnce = () => {
                            bgMusic.play().catch(e => console.warn('Retry play blocked:', e.name));
                        };
                        document.addEventListener('touchstart', retryOnce, { once: true, passive: true });
                        document.addEventListener('click',      retryOnce, { once: true });
                    });
                });
                bgMusic.load();
            });
        }
    }

    // ── Audio: Lifecycle handlers ─────────────────────────────────────────────
    // Pause immediately when the page is hidden or navigated away.
    document.addEventListener('visibilitychange', () => {
        if (document.hidden && bgMusic && !bgMusic.paused) {
            bgMusic.pause();
            bgMusic.dataset.wasPlaying = 'true';
        }
    });

    // Resume on next interaction only if audio was playing before being hidden.
    const resumeIfWasPlaying = () => {
        if (bgMusic && bgMusic.dataset.wasPlaying === 'true' && audioUnlocked) {
            bgMusic.dataset.wasPlaying = 'false';
            bgMusic.play().catch(e => console.warn('Audio resume blocked:', e.name));
        }
    };
    document.addEventListener('click',      resumeIfWasPlaying);
    document.addEventListener('touchstart', resumeIfWasPlaying, { passive: true });

    window.addEventListener('pagehide',     () => { if (bgMusic) bgMusic.pause(); });
    window.addEventListener('beforeunload', () => {
        window.scrollTo(0, 0);
        if (bgMusic) bgMusic.pause();
    });

    // ── Page-restore failsafe (WhatsApp / iOS back-cache) ─────────────────────
    const enforceReset = () => {
        window.scrollTo(0, 0);
        document.body.classList.remove('scroll-unlocked');
        document.body.classList.add('ready');
        if (bgMusic) bgMusic.pause();
    };

    window.addEventListener('pageshow', event => {
        if (event.persisted) {
            window.location.reload();
        } else {
            enforceReset();
            setTimeout(() => window.scrollTo(0, 0), 10);
        }
    });

    // ── Video: First-frame thumbnail trick for iOS WebKit ─────────────────────
    if (video) {
        video.load();
        video.addEventListener('loadedmetadata', () => {
            requestAnimationFrame(() => { video.currentTime = 0.001; });
        }, { once: true });
        setTimeout(() => {
            if (video.currentTime === 0) video.currentTime = 0.001;
        }, 50);
    }

    // ── First interaction handler ─────────────────────────────────────────────
    // All browser families require audio.play() to be called synchronously
    // inside the event handler stack – no awaits, no async gaps.
    const startOnInteraction = () => {
        // Video start (once only)
        if (!videoStarted) {
            videoStarted = true;
            interactionPrompt.classList.add('hidden');

            video.play().catch(err => {
                console.warn('Video blocked:', err);
                unlockScroll(); // Skip straight to content if video fails
            });
        }

        // Audio start (once only) – synchronously inside gesture stack
        if (!audioUnlocked) {
            audioUnlocked = true;
            playAudio();
        }
    };

    // Register listeners that each fire once per gesture type;
    // all four cover the full interaction surface across devices.
    ['touchstart', 'click', 'keydown', 'wheel'].forEach(ev => {
        window.addEventListener(ev, startOnInteraction, { once: true });
    });

    // ── Video progress → transition triggers ──────────────────────────────────
    video.addEventListener('timeupdate', () => {
        if (!video.duration) return;
        const progress = video.currentTime / video.duration;

        if (progress >= 0.9) {
            foregroundFooter.classList.add('active');
            if (muteToggle) muteToggle.classList.add('active');
        }
        if (progress >= 0.99 && !videoCompleted) {
            unlockScroll();
        }
    });

    video.addEventListener('ended', () => {
        if (!videoCompleted) unlockScroll();
    });

    // ── Scroll unlock ─────────────────────────────────────────────────────────
    function unlockScroll() {
        if (videoCompleted) return;
        videoCompleted = true;

        videoWrapper.classList.add('hide-post-play');
        setTimeout(() => { videoWrapper.style.display = 'none'; }, 1500);

        document.body.classList.add('scroll-unlocked');
        foregroundFooter.classList.add('active');
        if (muteToggle) muteToggle.classList.add('active');

        // Triple-tap scroll reset to defeat cached scroll position
        window.scrollTo(0, 0);
        requestAnimationFrame(() => {
            window.scrollTo(0, 0);
            setTimeout(() => window.scrollTo(0, 0), 50);
        });

        // Reveal first section
        document.querySelectorAll('#ganesh-page .reveal-content')
            .forEach(el => el.classList.add('visible'));

        if (globalScrollArrow) {
            setTimeout(() => globalScrollArrow.classList.add('active'), 800);
        }
    }

    // ── Scroll arrow click ────────────────────────────────────────────────────
    if (globalScrollArrow) {
        globalScrollArrow.addEventListener('click', () => {
            const wrapper = document.getElementById('scroll-wrapper');
            if (wrapper) {
                wrapper.scrollBy({ top: window.innerHeight, behavior: 'smooth' });
            }
        });
    }

    // ── Mute toggle ───────────────────────────────────────────────────────────
    if (muteToggle && bgMusic) {
        muteToggle.addEventListener('click', e => {
            e.stopPropagation(); // Don't trigger resume listeners above

            bgMusic.muted = !bgMusic.muted;
            muteToggle.querySelector('.icon-on').style.display  = bgMusic.muted ? 'none'  : 'block';
            muteToggle.querySelector('.icon-off').style.display = bgMusic.muted ? 'block' : 'none';

            // If unmuting while audio is paused (tab was backgrounded), resume
            if (!bgMusic.muted && bgMusic.paused && audioUnlocked) {
                bgMusic.play().catch(e => console.warn('Unmute resume blocked:', e.name));
            }
        });
    }

    // ── Intersection Observers ────────────────────────────────────────────────
    const cardObserver = new IntersectionObserver(entries => {
        entries.forEach(entry => {
            if (entry.target.closest('#ganesh-page')) return; // Ganesh handled by unlockScroll
            const rect = entry.boundingClientRect;
            if (entry.isIntersecting) {
                entry.target.classList.add('visible');
            } else if (rect.top > window.innerHeight || rect.bottom < 0) {
                entry.target.classList.remove('visible');
            }
        });
    }, { rootMargin: '0px', threshold: 0.25 });

    revealContents.forEach(el => cardObserver.observe(el));

    const layoutObserver = new IntersectionObserver(entries => {
        entries.forEach(entry => {
            if (!entry.isIntersecting) return;
            const isGanesh   = entry.target.id === 'ganesh-page';
            const isLastPage = entry.target.classList.contains('last-segment');
            document.body.classList.toggle('header-visible', !isGanesh);
            document.body.classList.toggle('hide-arrow',     isLastPage);
        });
    }, { threshold: 0.5 });

    document.querySelectorAll('.snap-segment').forEach(seg => layoutObserver.observe(seg));
});
