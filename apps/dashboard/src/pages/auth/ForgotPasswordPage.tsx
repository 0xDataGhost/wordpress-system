import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Link } from "react-router-dom";
import { ArrowRight, MailCheck } from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const schema = z.object({
  email: z
    .string()
    .min(1, "البريد الإلكتروني مطلوب")
    .email("صيغة البريد الإلكتروني غير صحيحة"),
});

type ForgotForm = z.infer<typeof schema>;

export function ForgotPasswordPage() {
  const [sent, setSent] = useState(false);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<ForgotForm>({
    resolver: zodResolver(schema),
    defaultValues: { email: "" },
  });

  // UI-only in Phase 1.
  const onSubmit = handleSubmit(() => {
    setSent(true);
  });

  return (
    <Card className="shadow-xl shadow-black/5">
      <CardHeader>
        <CardTitle>استعادة كلمة المرور</CardTitle>
        <CardDescription>
          أدخل بريدك الإلكتروني وسنرسل لك رابط إعادة التعيين
        </CardDescription>
      </CardHeader>
      <CardContent>
        {sent ? (
          <div className="flex flex-col items-center gap-3 py-4 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-success/10 text-success">
              <MailCheck className="h-6 w-6" />
            </div>
            <p className="text-sm text-muted-foreground">
              إذا كان البريد مسجلاً لدينا، فستصلك رسالة بها رابط إعادة التعيين.
            </p>
          </div>
        ) : (
          <form onSubmit={onSubmit} className="space-y-4" noValidate>
            <div className="space-y-2">
              <Label htmlFor="email">البريد الإلكتروني</Label>
              <Input
                id="email"
                type="email"
                dir="ltr"
                placeholder="store@example.com"
                autoComplete="email"
                {...register("email")}
              />
              {errors.email ? (
                <p className="text-xs text-destructive">
                  {errors.email.message}
                </p>
              ) : null}
            </div>
            <Button type="submit" className="w-full" disabled={isSubmitting}>
              إرسال رابط الاستعادة
            </Button>
          </form>
        )}

        <Link
          to="/login"
          className="mt-6 flex items-center justify-center gap-1 text-sm text-primary hover:underline"
        >
          <ArrowRight className="h-4 w-4" />
          العودة لتسجيل الدخول
        </Link>
      </CardContent>
    </Card>
  );
}
