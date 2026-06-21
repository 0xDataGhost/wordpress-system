import { Hammer } from "lucide-react";
import { PageHeader } from "@/components/shared/PageHeader";
import { EmptyState } from "@/components/shared/EmptyState";

type PlaceholderPageProps = {
  title: string;
  phase: string;
};

/**
 * Generic shell for nav routes whose module ships in a later phase.
 * Keeps the sidebar fully navigable without implementing future features.
 */
export function PlaceholderPage({ title, phase }: PlaceholderPageProps) {
  return (
    <div className="animate-fade-in">
      <PageHeader title={title} />
      <EmptyState
        icon={Hammer}
        title="هذه الصفحة قيد الإنشاء"
        description={`سيتم بناء هذه الصفحة في ${phase} وفق خطة المشروع.`}
      />
    </div>
  );
}
