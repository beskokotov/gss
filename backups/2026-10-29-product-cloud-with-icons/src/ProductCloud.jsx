import { useEffect, useRef } from 'react';
import Icon from './Icon.jsx';

const rotations = [-5, 3, -2, 4, -4, 2, 3, -3, 5, -2, 4, -4, -3, 2, -4, 3, -2];
const offsets = [-5, 8, -8, 5, -2, 7, 4, -6, 9, -3, 6, -5, -4, 7, -8, 5, 0];

export default function ProductCloud({ items, icons, motion, onOpen }) {
  const cards = useRef([]);
  const hover = useRef(null);

  function reset() {
    if (hover.current?.frame) cancelAnimationFrame(hover.current.frame);
    hover.current = null;
    for (const card of cards.current) {
      if (!card) continue;
      card.removeAttribute('data-active');
      for (const name of ['--spread-x', '--spread-y']) card.style.removeProperty(name);
      for (const name of ['--tilt-x', '--tilt-y', '--pointer-x', '--pointer-y', '--hover-scale']) card.firstElementChild.style.removeProperty(name);
    }
  }

  useEffect(() => {
    const preference = window.matchMedia?.('(prefers-reduced-motion: reduce)');
    if (!motion || preference?.matches) reset();
    const stop = () => reset();
    preference?.addEventListener('change', stop);
    window.addEventListener('resize', stop);
    return () => {
      preference?.removeEventListener('change', stop);
      window.removeEventListener('resize', stop);
      reset();
    };
  }, [motion]);

  function begin(event, index) {
    if (!motion || event.pointerType === 'touch' || !window.matchMedia?.('(hover: hover) and (pointer: fine)').matches || window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return;
    reset();
    const selected = cards.current[index];
    const bounds = event.currentTarget.getBoundingClientRect();
    const center = { x: bounds.left + bounds.width / 2, y: bounds.top + bounds.height / 2 };
    hover.current = { index, bounds, frame: null, x: event.clientX, y: event.clientY };
    selected.dataset.active = 'true';
    selected.firstElementChild.style.setProperty('--hover-scale', '1.07');
    for (const card of cards.current) {
      if (!card || card === selected) continue;
      const rect = card.getBoundingClientRect();
      const dx = rect.left + rect.width / 2 - center.x;
      const dy = rect.top + rect.height / 2 - center.y;
      const distance = Math.hypot(dx, dy);
      const spread = Math.max(0, 1 - distance / 500) * 20;
      if (distance > 0) {
        card.style.setProperty('--spread-x', `${dx / distance * spread}px`);
        card.style.setProperty('--spread-y', `${dy / distance * spread}px`);
      }
    }
  }

  function follow(event, index) {
    const state = hover.current;
    if (!state || state.index !== index) return;
    state.x = event.clientX;
    state.y = event.clientY;
    if (state.frame !== null) return;
    state.frame = requestAnimationFrame(() => {
      state.frame = null;
      if (hover.current !== state) return;
      const x = Math.max(-.5, Math.min(.5, (state.x - state.bounds.left) / state.bounds.width - .5));
      const y = Math.max(-.5, Math.min(.5, (state.y - state.bounds.top) / state.bounds.height - .5));
      const button = cards.current[index]?.firstElementChild;
      button?.style.setProperty('--tilt-x', `${-y * 10}deg`);
      button?.style.setProperty('--tilt-y', `${x * 10}deg`);
      button?.style.setProperty('--pointer-x', `${x * 7}px`);
      button?.style.setProperty('--pointer-y', `${y * 7}px`);
    });
  }

  return <div className="product-cloud" role="group" aria-label="Продукты ГАРАНТ">
    {items.map((item, index) => <div className="product-tile" key={item.id} ref={node => { cards.current[index] = node; }} style={{ '--base-rotation': `${rotations[index % rotations.length]}deg`, '--base-y': `${offsets[index % offsets.length]}px` }}>
      <button className="product-tile-button" id={`open-${item.id}`} type="button" aria-label={item.label} aria-haspopup="dialog" onPointerEnter={event => begin(event, index)} onPointerMove={event => follow(event, index)} onPointerLeave={reset} onPointerCancel={reset} onClick={() => { reset(); onOpen(item); }}>
        <span className="product-tile-symbol"><img src={icons[index]} width="128" height="128" alt="" loading="lazy" decoding="async" /></span>
        <span className="product-tile-corner"><Icon name="external" size={18} /></span>
        <span className="product-tile-label">{item.label}</span>
      </button>
    </div>)}
  </div>;
}
