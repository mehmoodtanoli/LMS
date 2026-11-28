// Sequential per-lab order number from the server, e.g. ORD-000042.
export const orderCode = (order) =>
  order?.orderNumber ? `ORD-${String(order.orderNumber).padStart(6, "0")}` : "—";
