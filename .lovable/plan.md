

# Scroll-Triggered Fade-In Animations

## Problem
Currently all `animate-fade-in` classes fire on page load, so sections below the fold animate before users even see them.

## Solution
Create a custom `useScrollReveal` hook using IntersectionObserver, then replace the static `animate-fade-in` classes with a ref-based approach that adds the animation class only when elements enter the viewport.

## Changes

### 1. New file: `src/hooks/useScrollReveal.ts`
A lightweight hook that:
- Accepts a threshold (default 0.15) and optional rootMargin
- Returns a `ref` callback
- Uses IntersectionObserver to add a `visible` class when the element enters the viewport
- Disconnects after triggering (animate once)

### 2. Update `src/index.css`
Add a new `.scroll-reveal` base class:
- Default state: `opacity: 0; transform: translateY(20px)`
- `.scroll-reveal.visible` state: `opacity: 1; transform: translateY(0)` with a smooth CSS transition (~0.6s ease-out)
- Support staggered children via a `--delay` CSS variable

### 3. Update `src/pages/Landing.tsx`
- Import the `useScrollReveal` hook
- Create refs for each major section: How It Works, Sustainability, Mission, Final CTA
- Replace static `animate-fade-in` classes on those sections with `scroll-reveal` + the ref
- Keep hero section animations as-is (they should fire immediately on load)
- For staggered items (steps, trust cards), apply incremental `--delay` via inline style

## Result
Sections will be invisible until scrolled into view, then gracefully fade up -- creating a polished, progressive reveal effect.

