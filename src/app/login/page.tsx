"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { motion, useReducedMotion } from "framer-motion";
import { Lock, Mail, User } from "lucide-react";
import { toast } from "sonner";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { AuthSubmitButton, type SubmitState } from "@/components/login/auth-submit-button";
import { FloatingInput } from "@/components/login/floating-input";
import { GoogleButton } from "@/components/login/google-button";
import { LoginHero } from "@/components/login/login-hero";
import { signIn, signUp } from "@/lib/auth-client";

type Mode = "login" | "signup";

interface FormErrors {
  name?: string;
  email?: string;
  password?: string;
}

function validate(mode: Mode, name: string, email: string, password: string): FormErrors {
  const errors: FormErrors = {};
  if (mode === "signup" && !name.trim()) errors.name = "Name is required";
  if (!email.trim()) errors.email = "Email is required";
  else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) errors.email = "Enter a valid email address";
  if (!password) errors.password = "Password is required";
  else if (password.length < 8) errors.password = "Must be at least 8 characters";
  return errors;
}

export default function LoginPage() {
  const router = useRouter();
  const reduceMotion = useReducedMotion();
  const [mode, setMode] = useState<Mode>("login");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [rememberMe, setRememberMe] = useState(true);
  const [errors, setErrors] = useState<FormErrors>({});
  const [submitState, setSubmitState] = useState<SubmitState>("idle");
  const [googleLoading, setGoogleLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const validationErrors = validate(mode, name, email, password);
    setErrors(validationErrors);
    if (Object.keys(validationErrors).length > 0) return;

    setSubmitState("loading");
    const { error } =
      mode === "login"
        ? await signIn.email({ email, password, rememberMe })
        : await signUp.email({ name, email, password });

    if (error) {
      setSubmitState("idle");
      toast.error(error.message ?? "Something went wrong");
      return;
    }

    setSubmitState("success");
    router.push("/");
    router.refresh();
  }

  async function handleGoogle() {
    setGoogleLoading(true);
    await signIn.social({ provider: "google", callbackURL: "/" });
  }

  function switchMode() {
    setMode((m) => (m === "login" ? "signup" : "login"));
    setErrors({});
  }

  return (
    <main className="grid min-h-screen lg:grid-cols-2">
      <LoginHero />

      <div className="relative flex flex-col items-center justify-center overflow-hidden bg-base px-4 py-12">
        {/* soft ambient glow behind the card, mobile included */}
        <div
          aria-hidden
          className="absolute top-1/2 left-1/2 size-[520px] -translate-x-1/2 -translate-y-1/2 rounded-full opacity-20 blur-3xl"
          style={{
            background:
              "radial-gradient(circle, color-mix(in srgb, var(--color-copper) 50%, transparent), transparent 70%)",
          }}
        />

        <div className="relative z-10 mb-8 text-center lg:hidden">
          <span className="flex items-center justify-center gap-2">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/logo-mark.png" alt="" width={24} height={24} className="size-6 rounded-md" />
            <span className="font-display text-sm font-semibold tracking-wide text-ink">JUPITAR ECOM</span>
          </span>
          <p className="mt-1 text-xs text-ink-faint">Know a winner before you list it.</p>
        </div>

        <motion.div
          initial={reduceMotion ? undefined : { opacity: 0, scale: 0.95, y: 12 }}
          animate={reduceMotion ? undefined : { opacity: 1, scale: 1, y: 0 }}
          transition={{ duration: 0.5, ease: "easeOut" }}
          className="glass-panel glow-breathe relative z-10 w-full max-w-sm rounded-3xl p-8"
        >
          <span className="hidden items-center gap-2 font-display text-sm font-semibold tracking-wide text-ink lg:inline-flex">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/logo-mark.png" alt="" width={24} height={24} className="size-6 rounded-md" />
            JUPITAR ECOM
          </span>
          <h1 className="mt-2 font-display text-2xl font-bold text-ink">
            {mode === "login" ? "Welcome back" : "Create your account"}
          </h1>
          <p className="mt-1.5 text-sm text-ink-dim">
            {mode === "login"
              ? "Sign in to get back to your pipeline."
              : "Start building your product research pipeline."}
          </p>

          <form onSubmit={handleSubmit} noValidate className="mt-7 flex flex-col gap-4">
            {mode === "signup" && (
              <FloatingInput
                label="Name"
                icon={User}
                value={name}
                onChange={(e) => setName(e.target.value)}
                error={errors.name}
                autoComplete="name"
              />
            )}
            <FloatingInput
              label="Email"
              icon={Mail}
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              error={errors.email}
              autoComplete="email"
            />
            <FloatingInput
              label="Password"
              icon={Lock}
              isPassword
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              error={errors.password}
              autoComplete={mode === "login" ? "current-password" : "new-password"}
            />

            {mode === "login" && (
              <div className="flex items-center gap-2">
                <Checkbox
                  id="remember-me"
                  checked={rememberMe}
                  onCheckedChange={(checked) => setRememberMe(checked === true)}
                />
                <Label htmlFor="remember-me" className="cursor-pointer text-sm font-normal text-ink-dim">
                  Remember me
                </Label>
              </div>
            )}

            <AuthSubmitButton state={submitState} className="mt-2">
              {mode === "login" ? "Sign in" : "Sign up"}
            </AuthSubmitButton>
          </form>

          <div className="my-6 flex items-center gap-3">
            <div className="h-px flex-1 bg-hairline" />
            <span className="text-xs text-ink-faint">OR</span>
            <div className="h-px flex-1 bg-hairline" />
          </div>

          <GoogleButton onClick={() => void handleGoogle()} disabled={googleLoading} />

          <p className="mt-6 text-center text-sm text-ink-dim">
            {mode === "login" ? "Don't have an account?" : "Already have an account?"}{" "}
            <button
              type="button"
              onClick={switchMode}
              className="cursor-pointer text-copper-bright transition-colors hover:text-ink hover:underline"
            >
              {mode === "login" ? "Sign up" : "Sign in"}
            </button>
          </p>
        </motion.div>
      </div>
    </main>
  );
}
