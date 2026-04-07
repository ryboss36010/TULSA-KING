"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";

export default function SettingsPage() {
  const [displayName, setDisplayName] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [pushEnabled, setPushEnabled] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const supabase = createClient();
  const router = useRouter();

  useEffect(() => {
    async function load() {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;

      const { data: profile } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", user.id)
        .single();

      if (profile) {
        setDisplayName(profile.display_name);
        setPhoneNumber(profile.phone_number || "");
        setPushEnabled(!!profile.push_subscription);
      }
    }

    load();
  }, []);

  async function handleSave() {
    setSaving(true);
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;

    await supabase
      .from("profiles")
      .update({
        display_name: displayName,
        phone_number: phoneNumber || null,
      })
      .eq("id", user.id);

    setMessage("Settings saved");
    setSaving(false);
    setTimeout(() => setMessage(""), 3000);
  }

  async function handleEnablePush() {
    if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
      setMessage("Push notifications are not supported in this browser");
      return;
    }

    const registration = await navigator.serviceWorker.register("/sw.js");
    const subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY,
    });

    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;

    await supabase
      .from("profiles")
      .update({ push_subscription: subscription.toJSON() })
      .eq("id", user.id);

    setPushEnabled(true);
    setMessage("Push notifications enabled");
    setTimeout(() => setMessage(""), 3000);
  }

  async function handleLogout() {
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  return (
    <div className="max-w-lg mx-auto px-4 py-6 space-y-8">
      <h1 className="text-2xl font-bold text-white">Settings</h1>

      <div className="space-y-4">
        <div>
          <label className="block text-sm text-gray-400 mb-1">
            Display Name
          </label>
          <input
            type="text"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            className="w-full px-4 py-3 bg-gray-800 text-white rounded-lg border border-gray-700 focus:border-green-500 focus:outline-none"
          />
        </div>

        <div>
          <label className="block text-sm text-gray-400 mb-1">
            Phone Number (for SMS alerts)
          </label>
          <input
            type="tel"
            value={phoneNumber}
            onChange={(e) => setPhoneNumber(e.target.value)}
            placeholder="+1234567890"
            className="w-full px-4 py-3 bg-gray-800 text-white rounded-lg border border-gray-700 focus:border-green-500 focus:outline-none"
          />
        </div>

        <div className="flex items-center justify-between bg-gray-800 rounded-lg px-4 py-3">
          <span className="text-white text-sm">Push Notifications</span>
          {pushEnabled ? (
            <span className="text-green-400 text-sm font-medium">Enabled</span>
          ) : (
            <button
              onClick={handleEnablePush}
              className="text-green-500 text-sm font-medium hover:text-green-400"
            >
              Enable
            </button>
          )}
        </div>

        <button
          onClick={handleSave}
          disabled={saving}
          className="w-full py-3 bg-green-600 hover:bg-green-500 text-white font-semibold rounded-lg transition disabled:opacity-50"
        >
          {saving ? "Saving..." : "Save Changes"}
        </button>

        {message && (
          <p className="text-green-400 text-sm text-center">{message}</p>
        )}
      </div>

      <div className="pt-4 border-t border-gray-800">
        <button
          onClick={handleLogout}
          className="w-full py-3 bg-gray-800 hover:bg-gray-700 text-red-400 font-medium rounded-lg transition"
        >
          Sign Out
        </button>
      </div>
    </div>
  );
}
