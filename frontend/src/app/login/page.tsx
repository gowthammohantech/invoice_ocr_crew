"use client";

import { useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { Eye, EyeOff, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { setToken } from "@/lib/auth";
import api from "@/lib/api";

export default function LoginPage() {
  const [token, setTokenVal] = useState("");
  const [showToken, setShowToken] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const router = useRouter();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!token.trim()) return;
    setLoading(true);
    setError("");
    try {
      const res = await api.post("/auth/login", { token });
      setToken(res.data.access_token);
      router.replace("/dashboard");
    } catch {
      setError("Invalid access token. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center p-4">
      {/* Background grid */}
      <div
        className="absolute inset-0 opacity-[0.02]"
        style={{
          backgroundImage: "linear-gradient(#fff 1px, transparent 1px), linear-gradient(90deg, #fff 1px, transparent 1px)",
          backgroundSize: "40px 40px",
        }}
      />

      <div className="relative w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="flex justify-center mb-4">
            <Image
              src="/elixir-logo.png"
              alt="Elixir Global"
              width={200}
              height={66}
              className="object-contain brightness-0 invert"
              priority
            />
          </div>
          <p className="text-sm text-violet-400/80 font-medium tracking-widest uppercase">Agent Sandbox</p>
          <p className="text-sm text-zinc-500 mt-2">Invoice OCR Crew — Powered by Elixir Global</p>
        </div>

        {/* Card */}
        <div className="bg-[#111] border border-white/[0.08] rounded-2xl p-8">
          <h2 className="text-base font-medium text-white mb-1">Sign in</h2>
          <p className="text-sm text-zinc-500 mb-6">Enter your sandbox access token to continue</p>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="token" className="text-zinc-400 text-sm">Access Token</Label>
              <div className="relative">
                <Input
                  id="token"
                  type={showToken ? "text" : "password"}
                  placeholder="Enter access token..."
                  value={token}
                  onChange={(e) => setTokenVal(e.target.value)}
                  className="bg-white/[0.04] border-white/[0.08] text-white placeholder:text-zinc-600 pr-10 focus:border-violet-500/50 focus:ring-violet-500/20"
                  autoFocus
                />
                <button
                  type="button"
                  onClick={() => setShowToken(!showToken)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300"
                >
                  {showToken ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {error && (
              <p className="text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">
                {error}
              </p>
            )}

            <Button
              type="submit"
              disabled={loading || !token.trim()}
              className="w-full bg-violet-600 hover:bg-violet-500 text-white font-medium"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Authenticating...
                </>
              ) : (
                "Sign in"
              )}
            </Button>
          </form>

          <div className="mt-6 pt-6 border-t border-white/[0.06]">
            <p className="text-xs text-zinc-600 text-center">
              Session persists for 24 hours. Contact your admin for access.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
