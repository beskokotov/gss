import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render } from '@testing-library/react';
import HeroSlideshow from './HeroSlideshow.jsx';

const images = ['one.png', 'two.png', 'three.png', 'four.png', 'five.png'];
afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('Смена иллюстраций главного баннера', () => {
  it('загружает первый кадр сразу, а остальные последовательно перед показом', () => {
    vi.useFakeTimers();
    const { container } = render(<HeroSlideshow images={images} motion />);
    expect(container.querySelectorAll('.hero-slide-art')).toHaveLength(1);
    expect(container.querySelector('.hero-slide-art').getAttribute('src')).toBe('one.png');
    act(() => vi.advanceTimersByTime(1199));
    expect(container.querySelectorAll('.hero-slide-art')).toHaveLength(1);
    act(() => vi.advanceTimersByTime(1));
    expect(container.querySelectorAll('.hero-slide-art')).toHaveLength(2);
    fireEvent.load(container.querySelectorAll('.hero-slide-art')[1]);
    act(() => vi.advanceTimersByTime(3800));
    expect(container.querySelector('.hero-slideshow').dataset.activeSlide).toBe('1');
    act(() => vi.advanceTimersByTime(1200));
    expect(container.querySelectorAll('.hero-slide-art')).toHaveLength(3);
  });

  it('меняет кадр ровно через 5 секунд, проходит полный цикл и останавливается на паузе', () => {
    vi.useFakeTimers();
    const { container, rerender, unmount } = render(<HeroSlideshow images={images} motion />);
    const current = () => container.querySelector('.hero-slideshow').dataset.activeSlide;
    expect(container.querySelectorAll('.hero-slide')).toHaveLength(5);
    expect(current()).toBe('0');
    fireEvent.load(container.querySelectorAll('.hero-slide-art')[0]);
    act(() => vi.advanceTimersByTime(1200));
    fireEvent.load(container.querySelectorAll('.hero-slide-art')[1]);
    act(() => vi.advanceTimersByTime(3799));
    expect(current()).toBe('0');
    act(() => vi.advanceTimersByTime(1));
    expect(current()).toBe('1');
    rerender(<HeroSlideshow images={images} motion={false} />);
    act(() => vi.advanceTimersByTime(1200));
    fireEvent.load(container.querySelectorAll('.hero-slide-art')[2]);
    act(() => vi.advanceTimersByTime(8800));
    expect(current()).toBe('1');
    expect(container.querySelector('.hero-slideshow').dataset.animated).toBe('false');
    rerender(<HeroSlideshow images={images} motion />);
    act(() => vi.advanceTimersByTime(5000));
    expect(current()).toBe('2');
    act(() => vi.advanceTimersByTime(1200));
    fireEvent.load(container.querySelectorAll('.hero-slide-art')[3]);
    act(() => vi.advanceTimersByTime(3800));
    act(() => vi.advanceTimersByTime(1200));
    fireEvent.load(container.querySelectorAll('.hero-slide-art')[4]);
    act(() => vi.advanceTimersByTime(3800));
    act(() => vi.advanceTimersByTime(5000));
    expect(current()).toBe('0');
    unmount();
    expect(vi.getTimerCount()).toBe(0);
  });

  it('учитывает уменьшение движения и приостанавливается в скрытой вкладке', () => {
    vi.useFakeTimers();
    let preferenceChanged;
    vi.stubGlobal('matchMedia', vi.fn((query) => ({
      matches: query.includes('prefers-reduced-motion'),
      addEventListener: (_type, callback) => { if (query.includes('prefers-reduced-motion')) preferenceChanged = callback; },
      removeEventListener: vi.fn()
    })));
    const visibility = vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('visible');
    const { container } = render(<HeroSlideshow images={images} motion />);
    const current = () => container.querySelector('.hero-slideshow').dataset.activeSlide;
    act(() => vi.advanceTimersByTime(10000));
    expect(current()).toBe('0');
    fireEvent.load(container.querySelectorAll('.hero-slide-art')[1]);
    act(() => preferenceChanged({ matches: false }));
    act(() => vi.advanceTimersByTime(5000));
    expect(current()).toBe('1');
    visibility.mockReturnValue('hidden');
    act(() => document.dispatchEvent(new Event('visibilitychange')));
    act(() => vi.advanceTimersByTime(10000));
    expect(current()).toBe('1');
  });

  it('выбирает мобильные изображения на узком экране', () => {
    vi.stubGlobal('matchMedia', vi.fn((query) => ({
      matches: query.includes('max-width'),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn()
    })));
    const mobileImages = ['m-one.webp', 'm-two.webp', 'm-three.webp', 'm-four.webp', 'm-five.webp'];
    const { container } = render(<HeroSlideshow images={images} mobileImages={mobileImages} motion />);
    expect(container.querySelector('.hero-slide-art').getAttribute('src')).toBe('m-one.webp');
    expect(container.querySelector('.hero-slide-art').getAttribute('width')).toBe('800');
  });

  it('пропускает изображение с ошибкой и продолжает показ', () => {
    vi.useFakeTimers();
    const { container } = render(<HeroSlideshow images={images} motion />);
    const current = () => container.querySelector('.hero-slideshow').dataset.activeSlide;
    act(() => vi.advanceTimersByTime(1200));
    fireEvent.error(container.querySelectorAll('.hero-slide-art')[1]);
    act(() => vi.advanceTimersByTime(1200));
    const thirdSlide = [...container.querySelectorAll('.hero-slide-art')].find((image) => image.getAttribute('src') === 'three.png');
    expect(thirdSlide).toBeTruthy();
    fireEvent.load(thirdSlide);
    act(() => vi.advanceTimersByTime(3800));
    expect(current()).toBe('2');
  });
});
