import { useEffect, useRef, useState } from 'react';

export default function HeroSlideshow({ images, mobileImages, motion }) {
  const [activeSlide, setActiveSlide] = useState(0);
  const [loadedSlides, setLoadedSlides] = useState(() => new Set([0]));
  const [unavailableSlides, setUnavailableSlides] = useState(() => new Set());
  const readySlides = useRef(new Set());
  const [reducedMotion, setReducedMotion] = useState(() => window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches ?? false);
  const [pageHidden, setPageHidden] = useState(() => document.visibilityState === 'hidden');
  const [mobile, setMobile] = useState(() => window.matchMedia?.('(max-width: 700px)')?.matches ?? false);
  const sources = mobile && mobileImages?.length === images.length ? mobileImages : images;
  const findNextSlide = (from) => {
    for (let offset = 1; offset < images.length; offset += 1) {
      const candidate = (from + offset) % images.length;
      if (!unavailableSlides.has(candidate)) return candidate;
    }
    return from;
  };

  useEffect(() => {
    const preference = window.matchMedia?.('(prefers-reduced-motion: reduce)');
    const onPreference = (event) => setReducedMotion(event.matches);
    const onVisibility = () => setPageHidden(document.visibilityState === 'hidden');
    preference?.addEventListener('change', onPreference);
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      preference?.removeEventListener('change', onPreference);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, []);

  useEffect(() => {
    const query = window.matchMedia?.('(max-width: 700px)');
    const onChange = (event) => setMobile(event.matches);
    query?.addEventListener('change', onChange);
    return () => query?.removeEventListener('change', onChange);
  }, []);

  useEffect(() => {
    setActiveSlide(0);
    setLoadedSlides(new Set([0]));
    setUnavailableSlides(new Set());
    readySlides.current = new Set();
  }, [mobile]);

  useEffect(() => {
    if (!motion || reducedMotion || pageHidden || images.length < 2) return;
    const nextSlide = findNextSlide(activeSlide);
    if (nextSlide === activeSlide) return;
    let retryTimer;
    let attempts = 0;
    const advanceWhenReady = () => {
      if (readySlides.current.has(nextSlide)) setActiveSlide(nextSlide);
      else if (attempts < 32) {
        attempts += 1;
        retryTimer = window.setTimeout(advanceWhenReady, 250);
      } else {
        setUnavailableSlides((unavailable) => {
          const next = new Set(unavailable);
          next.add(nextSlide);
          return next;
        });
      }
    };
    const timer = window.setTimeout(advanceWhenReady, 5000);
    return () => {
      window.clearTimeout(timer);
      window.clearTimeout(retryTimer);
    };
  }, [activeSlide, motion, reducedMotion, pageHidden, images.length, unavailableSlides]);

  useEffect(() => {
    if (images.length < 2) return;
    const nextSlide = findNextSlide(activeSlide);
    if (nextSlide === activeSlide) return;
    const timer = window.setTimeout(() => {
      setLoadedSlides((loaded) => {
        if (loaded.has(nextSlide)) return loaded;
        const next = new Set(loaded);
        next.add(nextSlide);
        return next;
      });
    }, 1200);
    return () => window.clearTimeout(timer);
  }, [activeSlide, images.length, unavailableSlides]);

  const markUnavailable = (index) => {
    readySlides.current.delete(index);
    setUnavailableSlides((unavailable) => {
      const next = new Set(unavailable);
      next.add(index);
      return next;
    });
  };

  return <div className="hero-visual hero-slideshow" aria-hidden="true" data-active-slide={activeSlide} data-animated={motion && !reducedMotion && !pageHidden}>
    {sources.map((src, index) => <div key={src} className={`hero-slide${index === activeSlide ? ' is-active' : ''}`}>
      <div className="hero-slide-frame">
        {loadedSlides.has(index) && <>
          <div className="hero-slide-backdrop" style={{ backgroundImage: `url("${src}")` }} />
          <img className="hero-slide-art" src={src} width={mobile ? 800 : 1600} height={mobile ? 600 : 1200} alt="" loading="eager" fetchPriority={index === 0 ? 'high' : 'low'} decoding="async" draggable="false" onLoad={() => readySlides.current.add(index)} onError={() => markUnavailable(index)} />
        </>}
      </div>
    </div>)}
  </div>;
}
