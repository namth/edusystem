import { permanentRedirect } from "next/navigation";

// Thay thế bằng /admin/orders (dùng /api/admin/orders)
export default function AdminRequestsPage() {
  permanentRedirect("/admin/orders");
}
