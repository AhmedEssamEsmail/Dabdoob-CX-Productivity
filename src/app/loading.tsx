import { Spinner } from "@/features/shared/components/ui/Spinner";

export default function Loading() {
  return (
    <div className="page-loading">
      <Spinner label="Loading page…" />
    </div>
  );
}
