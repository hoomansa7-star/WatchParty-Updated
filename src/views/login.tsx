"use client";

import { useState, useEffect } from "react";
import { Loader2, Film, LogIn, Shield, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { useAuthStore } from "@/stores/auth-store";
import { useNavigate } from "@/stores/router";
import { useI18n } from "@/i18n";

export function LoginView() {
  const { t } = useI18n();
  const navigate = useNavigate();
  const login = useAuthStore((s) => s.login);
  const user = useAuthStore((s) => s.user);
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (user) navigate("/");
  }, [user, navigate]);

  const handleLogin = async (id: string, pass: string) => {
    const trimmedId = id.trim();
    if (!trimmedId) {
      toast.error("لطفاً یک نام یا نام کاربری وارد کنید");
      return;
    }

    setLoading(true);
    // If admin is chosen and password is empty, default to 12345
    const finalPass = (trimmedId.toLowerCase() === "admin" && !pass) ? "12345" : pass;
    const res = await login(trimmedId, finalPass);
    setLoading(false);

    if (res.ok) {
      toast.success(t("auth.loggedIn", { name: trimmedId }));
      navigate("/");
    } else {
      toast.error(res.error || t("auth.invalidCreds"));
    }
  };

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await handleLogin(identifier, password);
  };

  const quickAdminLogin = async () => {
    setIdentifier("admin");
    setPassword("12345");
    await handleLogin("admin", "12345");
  };

  return (
    <div className="max-w-md mx-auto px-4 py-12">
      <div className="text-center mb-6">
        <div className="size-14 rounded-2xl bg-red-600 flex items-center justify-center text-white mx-auto mb-3 shadow-lg shadow-red-600/30">
          <Film className="size-7" />
        </div>
        <h1 className="text-2xl font-bold">{t("auth.loginTitle")}</h1>
        <p className="text-sm text-muted-foreground mt-1">
          ورود آزاد با وارد کردن نام دلخواه یا حساب ادمین
        </p>
      </div>

      <Card className="p-6 space-y-4">
        {/* Quick Admin Access Button */}
        <div className="rounded-xl border border-red-500/20 bg-red-500/5 p-3 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 text-xs">
            <Shield className="size-4 text-red-500 shrink-0" />
            <div>
              <span className="font-semibold text-foreground">ورود سریع ادمین:</span>{" "}
              <span className="text-muted-foreground">admin / 12345</span>
            </div>
          </div>
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="text-xs h-8 border-red-500/30 hover:bg-red-500/10 text-red-600 dark:text-red-400"
            disabled={loading}
            onClick={quickAdminLogin}
          >
            ورود ادمین
          </Button>
        </div>

        <form onSubmit={onSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="identifier">نام یا نام کاربری</Label>
            <Input
              id="identifier"
              type="text"
              placeholder="مثلاً: علی، رضا، سارا یا admin"
              value={identifier}
              onChange={(e) => setIdentifier(e.target.value)}
              required
              autoFocus
            />
            <p className="text-[11px] text-muted-foreground flex items-center gap-1">
              <Sparkles className="size-3 text-amber-500" />
              برای ورود نیازی به رمز نیست؛ فقط نام خود را بنویسید.
            </p>
          </div>

          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label htmlFor="password">رمز عبور</Label>
              <span className="text-xs text-muted-foreground">(فقط برای ادمین: 12345)</span>
            </div>
            <Input
              id="password"
              type="password"
              placeholder="اختیاری (برای ادمین: 12345)"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
            />
          </div>

          <Button type="submit" className="w-full bg-red-600 hover:bg-red-700" disabled={loading}>
            {loading ? <Loader2 className="size-4 me-2 animate-spin" /> : <LogIn className="size-4 me-2" />}
            {t("auth.login")}
          </Button>
        </form>

        <div className="mt-4 pt-4 border-t border-border text-center text-sm">
          <span className="text-muted-foreground">{t("auth.noAccount")} </span>
          <button onClick={() => navigate("/register")} className="text-primary hover:underline font-medium">
            {t("auth.signUpHere")}
          </button>
        </div>
      </Card>
    </div>
  );
}
