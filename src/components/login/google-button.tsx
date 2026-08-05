import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";

function GoogleIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
      <path
        fill="#4285F4"
        d="M23.49 12.27c0-.79-.07-1.54-.2-2.27H12v4.51h6.47c-.28 1.48-1.13 2.73-2.4 3.58v2.98h3.88c2.27-2.09 3.54-5.17 3.54-8.8Z"
      />
      <path
        fill="#34A853"
        d="M12 24c3.24 0 5.95-1.07 7.93-2.9l-3.88-2.98c-1.08.72-2.45 1.15-4.05 1.15-3.11 0-5.75-2.1-6.69-4.93H1.3v3.09C3.26 21.3 7.31 24 12 24Z"
      />
      <path
        fill="#FBBC05"
        d="M5.31 14.34c-.24-.72-.38-1.49-.38-2.28s.14-1.56.38-2.28V6.69H1.3A11.98 11.98 0 0 0 0 12c0 1.93.46 3.76 1.3 5.31l4.01-2.97Z"
      />
      <path
        fill="#EA4335"
        d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.44-3.44C17.94 1.19 15.24 0 12 0 7.31 0 3.26 2.7 1.3 6.69l4.01 2.97C6.25 6.83 8.89 4.75 12 4.75Z"
      />
    </svg>
  );
}

export function GoogleButton({ onClick, disabled }: { onClick: () => void; disabled?: boolean }) {
  return (
    <motion.div whileHover={disabled ? undefined : { y: -2 }} whileTap={disabled ? undefined : { scale: 0.98 }}>
      <Button
        type="button"
        variant="outline"
        className="h-12 w-full gap-2 rounded-xl border-hairline bg-raised/40 text-sm transition-colors hover:bg-raised"
        onClick={onClick}
        disabled={disabled}
      >
        <GoogleIcon className="size-4" />
        Continue with Google
      </Button>
    </motion.div>
  );
}
