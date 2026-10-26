import { Card } from "@/components/ui";

export default function Loading() {
  return <div role="status" aria-label="Đang tải nội dung" className="animate-pulse">
    <div className="mb-7 h-20 max-w-lg rounded-xl bg-slate-200" />
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">{[1, 2, 3, 4].map((item) => <Card key={item} className="h-36 bg-slate-100" />)}</div>
    <Card className="mt-6 h-72 bg-slate-100" /><span className="sr-only">Đang tải...</span>
  </div>;
}
