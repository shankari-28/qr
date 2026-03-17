import { Link, useLocation } from "react-router-dom";
import { QrCode, BarChart3, FolderOpen, User } from "lucide-react";
import Header from "@/components/Header";

const sidebarLinks = [
  { label: "QR Code Generator", to: "/generator", icon: QrCode },
  { label: "Created QR Codes", to: "/dashboard/codes", icon: FolderOpen },
  { label: "Analytics", to: "/dashboard/analytics", icon: BarChart3 },
  { label: "Profile", to: "/dashboard/profile", icon: User },
];

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const location = useLocation();

  return (
    <div className="min-h-screen">
      <Header />
      <div className="flex pt-16">
        <aside className="hidden lg:flex flex-col w-[260px] border-r border-border p-6 min-h-[calc(100vh-4rem)] bg-card">
          <nav className="space-y-1 flex-1">
            {sidebarLinks.map((l) => (
              <Link
                key={l.to}
                to={l.to}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                  location.pathname === l.to
                    ? "bg-accent text-foreground"
                    : "text-muted-foreground hover:text-foreground hover:bg-accent/50"
                }`}
              >
                <l.icon className="w-4 h-4" />
                {l.label}
              </Link>
            ))}
          </nav>
        </aside>
        <main className="flex-1 p-6 lg:p-10">{children}</main>
      </div>
    </div>
  );
}
