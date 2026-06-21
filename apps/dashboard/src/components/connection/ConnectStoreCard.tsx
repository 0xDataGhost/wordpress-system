import { useState, type FormEvent } from "react";
import { Link2, Unplug } from "lucide-react";
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
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import type { ConnectionStatusDto } from "@/lib/connector-api";

function isValidUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

type Props = {
  status: ConnectionStatusDto;
  onConnect: (siteUrl: string) => void;
  connecting: boolean;
  onDisconnect: () => void;
  disconnecting: boolean;
};

export function ConnectStoreCard({
  status,
  onConnect,
  connecting,
  onDisconnect,
  disconnecting,
}: Props) {
  const [siteUrl, setSiteUrl] = useState(status.siteUrl ?? "");
  const [touched, setTouched] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);

  const trimmed = siteUrl.trim();
  const urlValid = isValidUrl(trimmed);
  const showUrlError = touched && trimmed.length > 0 && !urlValid;
  const canConnect = status.hasApiKey && urlValid && !connecting;
  const isDisconnected = status.status === "disconnected";

  function submit(event: FormEvent) {
    event.preventDefault();
    setTouched(true);
    if (canConnect) onConnect(trimmed);
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>ربط المتجر</CardTitle>
        <CardDescription>
          أدخل رابط متجرك ثم اضغط ربط. أدخل المفتاح المُولّد في إضافة «SaaS
          Connector» داخل ووردبريس لإتمام الربط.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={submit} className="space-y-4" noValidate>
          <div className="space-y-2">
            <Label htmlFor="siteUrl">رابط المتجر</Label>
            <Input
              id="siteUrl"
              dir="ltr"
              inputMode="url"
              placeholder="https://store.example.com"
              value={siteUrl}
              onChange={(event) => setSiteUrl(event.target.value)}
              onBlur={() => setTouched(true)}
            />
            {showUrlError ? (
              <p className="text-xs text-destructive">
                أدخل رابطًا صحيحًا يبدأ بـ http أو https.
              </p>
            ) : null}
            {!status.hasApiKey ? (
              <p className="text-xs text-muted-foreground">
                ولّد مفتاح API أولًا لتفعيل الربط.
              </p>
            ) : null}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Button type="submit" disabled={!canConnect}>
              <Link2 />
              {status.status === "connected" ? "إعادة الربط" : "ربط المتجر"}
            </Button>
            {!isDisconnected ? (
              <Button
                type="button"
                variant="destructive"
                onClick={() => setConfirmOpen(true)}
                disabled={disconnecting}
              >
                <Unplug />
                فصل المتجر
              </Button>
            ) : null}
          </div>
        </form>
      </CardContent>

      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title="فصل المتجر؟"
        description="سيتم إبطال مفتاح API وإزالة بيانات الربط. يمكنك إعادة الربط لاحقًا بتوليد مفتاح جديد."
        confirmLabel="فصل المتجر"
        destructive
        loading={disconnecting}
        onConfirm={() => {
          setConfirmOpen(false);
          onDisconnect();
        }}
      />
    </Card>
  );
}
