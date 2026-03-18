import { motion } from "framer-motion";
import { User, Mail, Calendar, QrCode } from "lucide-react";
import DashboardLayout from "@/components/DashboardLayout";

const ease = [0.16, 1, 0.3, 1] as const;

const savedCodes = [
  { name: "Product Launch Campaign", type: "URL", created: "Mar 12, 2026", value: "https://launch.acme.com" },
  { name: "Event Check-In", type: "vCard", created: "Mar 10, 2026", value: "John Doe Contact" },
  { name: "WiFi Guest Access", type: "WiFi", created: "Mar 8, 2026", value: "SSID: Acme-Guest" },
  { name: "Menu QR Code", type: "URL", created: "Mar 5, 2026", value: "https://menu.acme.com" },
  { name: "Social Profile Card", type: "Social", created: "Mar 1, 2026", value: "@acme_official" },
];

export default function Dashboard() {
  return (
    <DashboardLayout>
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease }}
      >
        <h1 className="text-2xl font-semibold mb-1">Profile</h1>
        <p className="text-sm text-muted-foreground mb-8">Manage your account details.</p>

        <div className="bg-card border border-border rounded-xl p-6 max-w-lg space-y-6 mb-10">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-full bg-accent flex items-center justify-center">
              <User className="w-8 h-8 text-muted-foreground" />
            </div>
            <div>
              <p className="font-semibold text-lg">John Doe</p>
              <p className="text-sm text-muted-foreground">Pro Plan</p>
            </div>
          </div>

          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <Mail className="w-4 h-4 text-muted-foreground" />
              <div>
                <p className="label-caps text-muted-foreground mb-0.5">Email</p>
                <p className="text-sm">john@company.com</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Calendar className="w-4 h-4 text-muted-foreground" />
              <div>
                <p className="label-caps text-muted-foreground mb-0.5">Member Since</p>
                <p className="text-sm">January 2026</p>
              </div>
            </div>
          </div>

          <button className="bg-foreground text-background px-5 py-2.5 rounded-lg text-sm font-medium hover:opacity-90 btn-press">
            Edit Profile
          </button>
        </div>

        <h2 className="text-lg font-semibold mb-1">My QR Codes</h2>
        <p className="text-sm text-muted-foreground mb-4">Previously generated QR codes.</p>

        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {savedCodes.map((c, i) => (
            <motion.div
              key={c.name}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, ease, delay: i * 0.06 }}
              className="bg-card border border-border rounded-xl p-5"
            >
              <div className="w-10 h-10 rounded-lg bg-accent flex items-center justify-center mb-3">
                <QrCode className="w-5 h-5 text-muted-foreground" />
              </div>
              <h3 className="font-semibold text-sm mb-1 truncate">{c.name}</h3>
              <p className="text-xs text-muted-foreground font-mono mb-1">{c.type} · {c.value}</p>
              <p className="text-xs text-muted-foreground">{c.created}</p>
            </motion.div>
          ))}
        </div>
      </motion.div>
    </DashboardLayout>
  );
}
