"use client";
import React, { useRef } from "react";
import { gsap } from "gsap";
import { useGSAP } from "@gsap/react";
import { cn } from "@/lib/utils";

interface MorphButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  children?: React.ReactNode;
}

const MorphButton = React.forwardRef<HTMLButtonElement, MorphButtonProps>(
  (
    { className, disabled = false, children, ...props },
    ref
  ) => {
    const buttonRef = useRef<HTMLButtonElement>(null);
    useGSAP(
      () => {
        if (!buttonRef.current) return;

        const fill = buttonRef.current.querySelector(".fill") as SVGRectElement;
        const text = buttonRef.current.querySelector(".text");

        const tl = gsap.timeline({ paused: true });

        tl.to(fill, {
          scaleY: 1,
          ease: "power2.out",
        }).to(text, {
          color: "#ffffff",
          scale: 1.02,
          ease: "power2.inOut",
        }, "<");

        buttonRef.current.addEventListener("mouseenter", () => tl.play());
        buttonRef.current.addEventListener("mouseleave", () => tl.reverse());
      },
      { scope: buttonRef }
    );

    return (
      <button
        ref={buttonRef}
        disabled={disabled}
        className={cn(
          "relative cursor-pointer overflow-hidden bg-white text-black rounded-md text-sm font-medium border px-6 py-2.5",
          className
        )}
        {...props}
      >
        <div className="absolute inset-0 overflow-hidden rounded-md">
          <div 
            className="fill absolute inset-0 origin-bottom scale-y-0"
            style={{ backgroundColor: "#00e5c8" }}
          />
        </div>
        <span className="text relative z-10">{children ?? "Hover Me"}</span>
      </button>
    );
  }
);

MorphButton.displayName = "MorphButton";

export { MorphButton };
