"use client";

import NotificationBell from "./NotificationBell";

export default function TopBar() {
  return (
    <header className="flex h-14 flex-shrink-0 items-center justify-end border-b border-white/10 bg-ink2 px-6 gap-3">
      <NotificationBell />
    </header>
  );
}
