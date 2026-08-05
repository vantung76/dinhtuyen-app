import { useState } from "react";
import { FileSpreadsheet, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";

type Props = {
  /** Trả về danh sách sheet + tên file, có thể truy vấn thêm dữ liệu trước khi xuất. */
  onExport: () => Promise<number>;
  label?: string;
  className?: string;
};

/** Nút "Xuất dữ liệu" màu xanh lá đặc trưng Excel. */
export function ExcelExportButton({ onExport, label = "Xuất dữ liệu", className }: Props) {
  const [loading, setLoading] = useState(false);

  const run = async () => {
    setLoading(true);
    try {
      const count = await onExport();
      toast.success("Đã xuất file Excel", {
        description: `${count} dòng dữ liệu đã được tải về máy của bạn.`,
      });
    } catch (e) {
      toast.error("Không xuất được dữ liệu", { description: (e as Error).message });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Button
      type="button"
      variant="outline"
      disabled={loading}
      onClick={() => void run()}
      className={`border-[#107C41] bg-[#107C41]/10 text-[#0B5C30] hover:bg-[#107C41] hover:text-white dark:text-[#4ED07F] dark:hover:text-white ${className ?? ""}`}
    >
      {loading ? <Loader2 className="animate-spin" /> : <FileSpreadsheet />}
      {label}
    </Button>
  );
}
