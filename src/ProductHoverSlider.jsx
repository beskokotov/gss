import { useEffect, useRef, useState } from 'react';
import Icon from './Icon.jsx';

export default function ProductHoverSlider({ items, icons, selected, motion, onSelect }) {
  const host = useRef(null);
  const track = useRef(null);
  const buttons = useRef([]);
  const engine = useRef({ frame: null, velocity: 0, target: 0, last: null, position: 0, pauseUntil: 0 });
  const tilt = useRef(null);
  const [edges, setEdges] = useState({ start: true, end: false });
  const [media] = useState(() => ({
    pointer: window.matchMedia?.('(hover: hover) and (pointer: fine)'),
    reducedMotion: window.matchMedia?.('(prefers-reduced-motion: reduce)')
  }));

  function supportsMotion() {
    return motion && media.pointer?.matches && !media.reducedMotion?.matches;
  }

  function stopAuto(immediate = true) {
    const state = engine.current;
    state.target = 0;
    if (host.current) host.current.dataset.direction = 'none';
    if (immediate) {
      if (state.frame !== null) cancelAnimationFrame(state.frame);
      state.frame = null;
      state.velocity = 0;
      state.last = null;
      state.position = track.current?.scrollLeft ?? 0;
    }
  }

  function animate(now) {
    const element = track.current;
    if (!element || document.hidden || !supportsMotion()) { stopAuto(); return; }
    const state = engine.current;
    const dt = state.last === null ? 1 / 60 : Math.min((now - state.last) / 1000, .05);
    state.last = now;
    const response = 1 - Math.exp(-dt / (state.target === 0 ? .12 : .2));
    state.velocity += (state.target - state.velocity) * response;
    if (state.target === 0 && Math.abs(state.velocity) < .25) { stopAuto(); return; }
    const maximum = element.scrollWidth - element.clientWidth;
    state.position = Math.max(0, Math.min(maximum, state.position + state.velocity * dt));
    element.scrollLeft = state.position;
    if ((state.position <= 0 && state.velocity < 0) || (state.position >= maximum && state.velocity > 0)) {
      stopAuto();
      return;
    }
    state.frame = requestAnimationFrame(animate);
  }

  function followPointer(event) {
    if (event.target.closest('.product-slider-controls')) { stopAuto(); return; }
    if (event.pointerType === 'touch' || event.buttons || !supportsMotion() || performance.now() < engine.current.pauseUntil) return;
    const bounds = host.current.getBoundingClientRect();
    const x = Math.max(0, Math.min(bounds.width, event.clientX - bounds.left));
    const zone = bounds.width * .3;
    const element = track.current;
    let speed = 0;
    if (x < zone && element.scrollLeft > 0) speed = -1140 * (1 - x / zone) ** 1.5;
    else if (x > bounds.width - zone && element.scrollLeft < element.scrollWidth - element.clientWidth - 1) speed = 1140 * (1 - (bounds.width - x) / zone) ** 1.5;
    const state = engine.current;
    state.target = speed;
    host.current.dataset.direction = speed < 0 ? 'left' : speed > 0 ? 'right' : 'none';
    if (state.frame === null && speed !== 0) {
      state.position = element.scrollLeft;
      state.last = null;
      state.frame = requestAnimationFrame(animate);
    }
  }

  function resetTilt() {
    const state = tilt.current;
    if (state?.frame !== null && state?.frame !== undefined) cancelAnimationFrame(state.frame);
    if (state?.button) {
      for (const name of ['--tilt-x', '--tilt-y', '--pointer-x', '--pointer-y']) state.button.style.removeProperty(name);
      state.button.parentElement.removeAttribute('data-active');
    }
    tilt.current = null;
  }

  function beginTilt(event) {
    if (event.pointerType === 'touch' || !supportsMotion()) return;
    resetTilt();
    const button = event.currentTarget;
    tilt.current = { button, bounds: button.getBoundingClientRect(), x: event.clientX, y: event.clientY, frame: null };
    button.parentElement.dataset.active = 'true';
  }

  function followTilt(event) {
    const state = tilt.current;
    if (!state) return;
    state.x = event.clientX;
    state.y = event.clientY;
    if (state.frame !== null) return;
    state.frame = requestAnimationFrame(() => {
      state.frame = null;
      if (tilt.current !== state) return;
      const x = Math.max(-.5, Math.min(.5, (state.x - state.bounds.left) / state.bounds.width - .5));
      const y = Math.max(-.5, Math.min(.5, (state.y - state.bounds.top) / state.bounds.height - .5));
      state.button.style.setProperty('--tilt-x', `${-y * 6}deg`);
      state.button.style.setProperty('--tilt-y', `${x * 6}deg`);
      state.button.style.setProperty('--pointer-x', `${x * 12}px`);
      state.button.style.setProperty('--pointer-y', `${y * 12}px`);
    });
  }

  useEffect(() => {
    const element = track.current;
    function update() {
      const next = { start: element.scrollLeft <= 1, end: element.scrollWidth - element.clientWidth - element.scrollLeft <= 1 };
      setEdges(previous => previous.start === next.start && previous.end === next.end ? previous : next);
      if (engine.current.frame === null) engine.current.position = element.scrollLeft;
    }
    const stop = () => { stopAuto(); resetTilt(); };
    const resize = () => { stop(); update(); };
    const preference = media.reducedMotion;
    if (!motion || preference?.matches) stop();
    update();
    element.addEventListener('scroll', update, { passive: true });
    element.addEventListener('wheel', stop, { passive: true });
    window.addEventListener('resize', resize);
    window.addEventListener('blur', stop);
    window.addEventListener('scroll', stop, { passive: true });
    document.addEventListener('visibilitychange', stop);
    preference?.addEventListener('change', stop);
    media.pointer?.addEventListener('change', stop);
    const observer = window.ResizeObserver ? new ResizeObserver(resize) : null;
    observer?.observe(element);
    return () => {
      element.removeEventListener('scroll', update);
      element.removeEventListener('wheel', stop);
      window.removeEventListener('resize', resize);
      window.removeEventListener('blur', stop);
      window.removeEventListener('scroll', stop);
      document.removeEventListener('visibilitychange', stop);
      preference?.removeEventListener('change', stop);
      media.pointer?.removeEventListener('change', stop);
      observer?.disconnect();
      stop();
    };
  }, [motion, media]);

  useEffect(() => {
    stopAuto();
    const element = track.current;
    const button = buttons.current[selected];
    if (!button) return;
    const card = button.parentElement;
    const left = card.offsetLeft;
    const right = left + card.offsetWidth;
    const padding = 26;
    let target = element.scrollLeft;
    if (left < element.scrollLeft + padding) target = left - padding;
    else if (right > element.scrollLeft + element.clientWidth - padding) target = right - element.clientWidth + padding;
    const reducedMotion = media.reducedMotion?.matches;
    engine.current.pauseUntil = performance.now() + 700;
    if (Math.abs(target - element.scrollLeft) > 1) element.scrollTo?.({ left: target, behavior: reducedMotion ? 'instant' : 'smooth' });
  }, [selected]);

  function keyDown(event, index) {
    let next;
    if (event.key === 'ArrowRight') next = (index + 1) % items.length;
    if (event.key === 'ArrowLeft') next = (index - 1 + items.length) % items.length;
    if (event.key === 'Home') next = 0;
    if (event.key === 'End') next = items.length - 1;
    if (next === undefined) return;
    event.preventDefault();
    stopAuto();
    resetTilt();
    onSelect(next);
    buttons.current[next]?.focus({ preventScroll: true });
  }

  function returnToStart() {
    stopAuto();
    resetTilt();
    engine.current.pauseUntil = performance.now() + 1000;
    track.current.focus({ preventScroll: true });
    track.current.scrollTo({ left: 0, behavior: motion && !media.reducedMotion?.matches ? 'smooth' : 'instant' });
  }

  function scrollByArrow(direction) {
    stopAuto();
    resetTilt();
    engine.current.pauseUntil = performance.now() + 1000;
    if (window.matchMedia?.('(max-width: 700px)').matches) {
      onSelect(Math.max(0, Math.min(items.length - 1, selected + direction)));
      return;
    }
    const element = track.current;
    const card = buttons.current[0]?.parentElement;
    const step = card ? card.offsetWidth + parseFloat(getComputedStyle(element).columnGap || 0) : element.clientWidth * .8;
    element.scrollBy({ left: direction * step, behavior: motion && !media.reducedMotion?.matches ? 'smooth' : 'instant' });
  }

  return <div className="product-hover-slider" ref={host} data-direction="none" onPointerMove={followPointer} onPointerLeave={() => { stopAuto(false); resetTilt(); }} onPointerCancel={() => { stopAuto(); resetTilt(); }} onPointerDown={() => stopAuto()} onFocusCapture={() => { stopAuto(); resetTilt(); }}>
    <p className="sr-only" id="product-slider-help">Для прокрутки наведите курсор на край ленты или проведите по ней пальцем. Для выбора продукта используйте стрелки клавиатуры, Home и End.</p>
    <div className="product-strip" id="product-strip" ref={track} role="tablist" tabIndex={-1} aria-label="Продукты ГАРАНТ" aria-describedby="product-slider-help">
      {items.map((item, index) => <div className="product-tile" key={item.id}>
        <button className="product-tile-button" id={`tab-${item.id}`} ref={node => { buttons.current[index] = node; }} type="button" role="tab" aria-label={item.label} aria-selected={selected === index} aria-controls="product-panel" tabIndex={selected === index ? 0 : -1} onKeyDown={event => keyDown(event, index)} onPointerEnter={beginTilt} onPointerMove={followTilt} onPointerLeave={resetTilt} onClick={() => { stopAuto(); resetTilt(); engine.current.pauseUntil = performance.now() + 700; onSelect(index); }}>
          <span className="product-tile-symbol"><img src={icons[index]} width="128" height="128" alt="" loading="lazy" decoding="async" /></span>
          <span className="product-tile-label">{item.label}</span>
        </button>
      </div>)}
    </div>
    <div className="product-slider-controls">
      <button type="button" className="rss-slider-button product-slider-prev" aria-label="Предыдущие продукты" aria-controls="product-strip" disabled={edges.start} onClick={() => scrollByArrow(-1)}><Icon name="arrow" size={19} /></button>
      <button type="button" className="rss-slider-button" aria-label="Следующие продукты" aria-controls="product-strip" disabled={edges.end} onClick={() => scrollByArrow(1)}><Icon name="arrow" size={19} /></button>
      {edges.end && !edges.start && <button type="button" className="text-button product-slider-reset" aria-controls="product-strip" onClick={returnToStart}>В начало <Icon name="arrow" size={17} /></button>}
    </div>
  </div>;
}
