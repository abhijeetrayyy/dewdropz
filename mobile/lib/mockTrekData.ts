// Placeholder in-app notifications — DewDropz has no notifications table yet,
// so this is local mock content until a real backend exists. Content is
// grounded in real features (orders, restocks, saved designs), not the
// paused trekking business line.
export type MockNotification = {
  id: string;
  icon: string;
  iconColor: string;
  iconBg: string;
  title: string;
  body: string;
  time: string;
  accent?: string;
};

export const NOTIFICATIONS: MockNotification[] = [
  { id: "n1", icon: "local_shipping", iconColor: "#125B45", iconBg: "#DCEFE5", title: "Your order is on the way", body: "Order #DD2841 has shipped and is on its way to you.", time: "2 HOURS AGO", accent: "#16795B" },
  { id: "n2", icon: "brush", iconColor: "#B4761A", iconBg: "#FDEBD4", title: "Your design is ready to order", body: "The preview for your custom hoodie is ready — check it before it goes to print.", time: "YESTERDAY", accent: "#F0952B" },
  { id: "n3", icon: "workspace_premium", iconColor: "#5C6A62", iconBg: "#F1EADD", title: "Back in stock", body: "An item on your wishlist is available again.", time: "3 DAYS AGO" },
  { id: "n4", icon: "local_offer", iconColor: "#5C6A62", iconBg: "#F1EADD", title: "Welcome offer", body: "New here? Get 10% off your first custom design.", time: "5 DAYS AGO" },
];
