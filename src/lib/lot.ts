// Generate internal lot code: DDMMYY-XX
// date param: arrival date for raw materials, production date for products
export function generateInternalLot(prefix: "L" | "P" | "R" = "L", date?: Date): string {
  const d = date ?? new Date();
  const yy = String(d.getFullYear()).slice(-2);
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ0123456789";
  let suffix = "";
  for (let i = 0; i < 2; i++) suffix += chars[Math.floor(Math.random() * chars.length)];
  return `${dd}${mm}${yy}-${suffix}`;
}