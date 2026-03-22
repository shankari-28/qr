import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "@/lib/supabase";
import { Loader2 } from "lucide-react";

export default function Redirect() {
  const { qrId } = useParams();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function processRedirect() {
      if (!qrId) {
        setError("Invalid QR Code Link");
        return;
      }

      try {
        // 1. Fetch QR code destination
        console.log("Fetching QR data for ID:", qrId);
        const { data, error: qrError } = await supabase
          .from("qr_codes")
          .select("content, type, user_id, status")
          .eq("id", qrId)
          .maybeSingle();

        if (qrError) {
          console.error("Supabase Query Error:", qrError);
          setError(`Database Error: ${qrError.message}`);
          return;
        }

        const qrData = data as any;
        console.log("Retrieved QR Data:", qrData);

        if (qrError || !qrData) {
          setError("QR code not found or has been deleted.");
          return;
        }

        // 2. Gather Analytics
        const userAgent = navigator.userAgent;
        const deviceType = /Mobi|Android|iPhone/i.test(userAgent) ? "mobile" : "desktop";

        // Try to get authenticated user email
        const { data: { user: scannerUser } } = await supabase.auth.getUser();
        const scannerEmail = scannerUser?.email || null;

        let country = "Unknown";
        let region = "Unknown";
        let city = "Unknown";

        try {
          const geoRes = await fetch("https://ipapi.co/json/");
          if (geoRes.ok) {
            const geo = await geoRes.json();
            country = geo.country_name || "Unknown";
            region = geo.region || "Unknown";
            city = geo.city || "Unknown";
          }
        } catch (e) {
          console.error("Geo IP failed", e);
        }

        // Use RPC to increment scan atomically and record event
        // @ts-ignore
        await supabase.rpc('increment_scan', {
          target_qr_id: qrId,
          scanner_email: scannerEmail,
          device_type: deviceType,
          country: country,
          state: region,
          city: city
        });

        // 3. Handle specific types
        if (qrData.type === "url" || qrData.type === "video" || qrData.type === "app" || qrData.type === "social") {
          let target = qrData.content;
          if (!target.startsWith("http://") && !target.startsWith("https://")) {
            target = "https://" + target;
          }
          window.location.replace(target);
        } else if (qrData.type === "text") {
          // Simple display for text
          document.body.innerHTML = `<div style="padding: 2rem; font-family: sans-serif; text-align: center; max-width: 600px; margin: 0 auto; margin-top: 20vh; background: #f8f9fa; border-radius: 12px; border: 1px solid #e5e7eb;">
            <p style="font-size: 1.25rem; line-height: 1.6; color: #111827; margin-bottom: 2rem;">${qrData.content}</p>
            <button onclick="window.close()" style="padding: 10px 20px; background: #0f172a; color: white; border: none; border-radius: 6px; cursor: pointer;">Close Window</button>
          </div>`;
        } else {
          // Default fallback
          window.location.replace(qrData.content);
        }

      } catch (err: any) {
        setError("Error processing redirect: " + err.message);
      }
    }

    processRedirect();
  }, [qrId]);

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 text-center">
        <div className="max-w-md w-full bg-destructive/10 border border-destructive/20 rounded-xl p-6">
          <h2 className="text-xl font-semibold text-destructive mb-2">Oops!</h2>
          <p className="text-destructive/80">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4">
      <Loader2 className="w-8 h-8 text-primary animate-spin mb-4" />
      <p className="text-muted-foreground font-medium animate-pulse">Routing to destination...</p>
    </div>
  );
}
