"use client";
import { ArrowRightIcon, ChevronDownIcon } from "lucide-react";
import React from "react";
import { motion } from "framer-motion";

interface AnimatedButtonProps {
  children: React.ReactNode;
  onClick?: () => void;
  className?: string;
  icon?: "arrow" | "chevron";
}

const AnimatedButton = ({ 
  children, 
  onClick, 
  className = "", 
  icon = "arrow",
}: AnimatedButtonProps) => {
  const Icon = icon === "arrow" ? ArrowRightIcon : ChevronDownIcon;

  return (
    <motion.button
      initial="rest"
      animate="rest"
      whileHover="hover"
      whileTap="tap"
      onClick={onClick}
      transition={{
        type: "spring",
        stiffness: 1000,
        damping: 20,
        mass: 10,
      }}
      className={`relative cursor-pointer px-6 py-3 rounded-lg overflow-hidden ${className}`}
    >
      <motion.div
        variants={{
          rest: { scaleY: 0 },
          hover: { scaleY: 1 },
          tap: { scaleY: 0.95 },
        }}
        transition={{ duration: 0.3, ease: "easeOut" }}
        className="absolute inset-0 origin-bottom"
        style={{
          background: "linear-gradient(180deg, #00e5c8 0%, #00b3a0 100%)",
        }}
      />
      <motion.div
        variants={{
          rest: { x: 0 },
          hover: { x: 5 },
        }}
        className="relative z-10 flex items-center gap-2"
      >
        <motion.span
          variants={{
            rest: { color: "#00e5c8" },
            hover: { color: "#0a0f1a" },
          }}
          transition={{ duration: 0.2 }}
          className="font-medium text-sm"
        >
          {children}
        </motion.span>
        <motion.div
          variants={{
            rest: { rotate: 0 },
            hover: { rotate: icon === "chevron" ? 180 : 0, x: 5 },
          }}
          transition={{ duration: 0.2 }}
        >
          <Icon className="w-4 h-4" />
        </motion.div>
      </motion.div>
    </motion.button>
  );
};

export default AnimatedButton;
