import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import type { FunctionOrder } from "@/types/function-order";

export function generateFunctionOrderPdf(order: FunctionOrder) {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  let y = 15;
  doc.setTextColor(38, 102, 153);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(20);
  doc.text("Amrut Dairy Farm", 105, y, { align: "center" });
  y += 8;
  doc.setTextColor(80, 80, 80);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.text("Function orders and catering", 105, y, { align: "center" });
  y += 6;
  doc.setDrawColor(38, 102, 153);
  doc.line(14, y, 196, y);
  y += 9;
  doc.setTextColor(30, 30, 30);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  doc.text("FUNCTION ORDER", 14, y);
  y += 7;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(70, 70, 70);
  doc.text(`Order: ${order.orderNumber}`, 14, y);
  doc.text(`Customer: ${order.customerName}`, 110, y);
  y += 5;
  doc.text(`Mobile: ${order.mobileNumber}`, 14, y);
  if (order.eventName) doc.text(`Event: ${order.eventName}`, 110, y);
  y += 6;
  const rows: string[][] = [];
  let total = 0;
  order.deliveryDays.forEach((day) =>
    day.items.forEach((item) => {
      const add = (movement: string, quantity: number, sign: number) => {
        const amount = quantity * item.unitPrice * sign;
        total += amount;
        rows.push([
          day.deliveryDate,
          `${day.deliveryTime || "—"}${day.peopleCount ? ` / ${day.peopleCount} people` : ""}`,
          item.itemName,
          movement,
          `${quantity} ${item.unit}`,
          `Rs ${item.unitPrice.toFixed(2)}`,
          `${sign < 0 ? "-" : ""}Rs ${Math.abs(amount).toFixed(2)}`,
        ]);
      };
      add("Initial dispatch", item.quantity, 1);
      (item.movements ?? []).forEach((m) =>
        add(
          m.type === "dispatch" ? "Additional dispatch" : "Return",
          m.quantity,
          m.type === "return" ? -1 : 1,
        ),
      );
      if (item.returnedQuantity) add("Return", item.returnedQuantity, -1);
    }),
  );
  autoTable(doc, {
    startY: y,
    head: [
      [
        "Date",
        "Time / People",
        "Item",
        "Movement",
        "Quantity",
        "Rate",
        "Amount",
      ],
    ],
    body: rows,
    theme: "grid",
    headStyles: {
      fillColor: [38, 102, 153],
      textColor: 255,
      fontStyle: "bold",
    },
    styles: { fontSize: 8, cellPadding: 2.4 },
    columnStyles: { 6: { halign: "right" } },
  });
  const finalY =
    (doc as jsPDF & { lastAutoTable: { finalY: number } }).lastAutoTable
      .finalY + 9;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.setTextColor(30, 30, 30);
  doc.text(`Net total: Rs ${total.toFixed(2)}`, 196, finalY, {
    align: "right",
  });
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(100, 100, 100);
  doc.text("This is a computer-generated function order.", 105, 287, {
    align: "center",
  });
  doc.save(`${order.orderNumber}.pdf`);
}
