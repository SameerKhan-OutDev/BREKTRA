import { useEffect } from "react";

// Feedback is attached to the control, so mouse, touch, Enter and Space all
// share the same behavior without adding handlers to every icon instance.
export function IconMotion() {
  useEffect(() => {
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)");
    const running = new Set<Animation>();
    const byElement = new WeakMap<Element, Animation>();
    const animate = (element: SVGElement, frames: Keyframe[], options: KeyframeAnimationOptions = {}) => {
      byElement.get(element)?.cancel();
      const animation = element.animate(frames, { duration: 430, easing: "cubic-bezier(.2,.7,.25,1)", ...options });
      byElement.set(element, animation); running.add(animation);
      const finish = () => { running.delete(animation); if (byElement.get(element) === animation) byElement.delete(element); };
      animation.onfinish = finish; animation.oncancel = finish;
    };
    const handleClick = (event: MouseEvent) => {
      if (reduced.matches || !(event.target instanceof Element)) return;
      const control = event.target.closest('button, a[href], summary, [role="button"]');
      if (!control || control.matches(':disabled, [aria-disabled="true"]')) return;
      for (const icon of control.querySelectorAll<SVGSVGElement>("svg.lucide")) {
        if (icon.closest(".spin") || typeof icon.animate !== "function") continue;
        const classes = icon.classList;
        const has = (...names: string[]) => names.some(name => classes.contains(`lucide-${name}`));
        const move = (transforms: string[], duration = 430) => animate(icon, transforms.map(transform => ({ transform })), { duration });
        if (has("bell", "bell-ring")) {
          animate(icon, [0, -19, 16, -12, 8, -4, 0].map(degrees => ({ transform: `rotate(${degrees}deg)`, transformOrigin: "50% 12%" })), { duration: 680 });
        } else if (has("refresh-cw", "refresh-ccw", "rotate-cw", "loader-circle", "loader")) {
          move(["rotate(0deg)", "rotate(360deg)"], 600);
        } else if (has("send")) {
          move(["translate(0,0) rotate(0deg)", "translate(5px,-5px) rotate(-9deg)", "translate(-2px,2px) rotate(3deg)", "translate(0,0) rotate(0deg)"], 520);
        } else if (has("trash-2", "trash")) {
          const lid = icon.querySelector<SVGElement>("path");
          if (lid) animate(lid, [{ transform: "translateY(0) rotate(0deg)" }, { transform: "translateY(-2px) rotate(-8deg)" }, { transform: "translateY(0) rotate(0deg)" }]);
        } else if (has("key-round", "key", "settings")) {
          move(["rotate(0deg)", "rotate(-28deg)", "rotate(7deg)", "rotate(0deg)"]);
        } else if (has("settings-2", "sliders-horizontal", "filter")) {
          const paths = icon.querySelectorAll<SVGElement>("path, line, circle");
          paths.forEach((path, i) => animate(path, [{ transform: "translateX(0)" }, { transform: `translateX(${i % 2 ? -1.5 : 1.5}px)` }, { transform: "translateX(0)" }]));
        } else if (has("arrow-right", "arrow-up-right", "chevron-right", "external-link")) {
          const diagonal = has("arrow-up-right", "external-link");
          move(["translate(0,0)", `translate(3px,${diagonal ? -3 : 0}px)`, "translate(0,0)"]);
        } else if (has("arrow-left", "chevron-left", "arrow-down-left", "download")) {
          move(["translate(0,0)", has("download") ? "translate(0,3px)" : "translate(-3px,0)", "translate(0,0)"]);
        } else if (has("chevron-down", "chevron-up")) {
          // Disclosure chevrons already rotate with their open state.
          if (control.tagName !== "SUMMARY") move(["translateY(0)", "translateY(3px)", "translateY(0)"]);
        } else if (has("check", "check-check", "shield-check", "list-checks", "user-check")) {
          move(["scale(1)", "scale(.85)", "scale(1.12)", "scale(1)"]);
        } else if (has("users", "user-plus")) {
          const heads = icon.querySelectorAll<SVGElement>("circle");
          if (heads.length) heads.forEach((head, i) => animate(head, [{ transform: "translateY(0)" }, { transform: "translateY(-1.8px)" }, { transform: "translateY(0)" }], { delay: i * 60 }));
          else move(["rotate(0deg)", "rotate(-6deg)", "rotate(4deg)", "rotate(0deg)"]);
        } else if (has("message-square", "mail", "copy")) {
          move(["scale(1)", "scale(.9) rotate(-4deg)", "scale(1.08) rotate(2deg)", "scale(1) rotate(0deg)"]);
        } else if (has("plus", "x", "x-circle")) {
          move(["rotate(0deg) scale(1)", "rotate(90deg) scale(.85)", "rotate(90deg) scale(1)"]);
        } else if (has("play", "pause")) {
          move(["scaleX(1)", "scaleX(.65)", "scaleX(1)"]);
        } else if (has("search")) {
          move(["scale(1) translate(0,0)", "scale(1.13) translate(-1px,-1px)", "scale(1) translate(0,0)"]);
        } else if (has("layout-dashboard", "layers-3", "layers", "book-open")) {
          icon.querySelectorAll<SVGElement>("path, rect").forEach((part, i) => animate(part, [{ transform: "translateY(0)" }, { transform: "translateY(-1.5px)" }, { transform: "translateY(0)" }], { delay: i * 35 }));
        } else {
          move(["scale(1)", "scale(.9)", "scale(1.06)", "scale(1)"], 330);
        }
      }
    };
    const stop = () => { for (const animation of running) animation.cancel(); running.clear(); };
    const preferenceChanged = () => { if (reduced.matches) stop(); };
    document.addEventListener("click", handleClick, true);
    reduced.addEventListener("change", preferenceChanged);
    return () => { document.removeEventListener("click", handleClick, true); reduced.removeEventListener("change", preferenceChanged); stop(); };
  }, []);
  return null;
}
