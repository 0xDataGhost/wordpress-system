import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";

export function NotFoundPage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-background p-4 text-center">
      <p className="text-6xl font-bold text-primary">404</p>
      <h1 className="text-xl font-semibold">الصفحة غير موجودة</h1>
      <p className="max-w-sm text-sm text-muted-foreground">
        الصفحة التي تبحث عنها غير متوفرة أو تم نقلها.
      </p>
      <Button asChild>
        <Link to="/dashboard">العودة للوحة التحكم</Link>
      </Button>
    </div>
  );
}
