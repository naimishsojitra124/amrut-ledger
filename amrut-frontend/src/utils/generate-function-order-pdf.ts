import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import type { FunctionOrder } from "@/types/function-order";
import {
  formatFunctionOrderQuantity,
  summariseFunctionOrderItem,
} from "@/utils/function-order";
import { formatRupees } from "@/utils/format-currency";
import { BUSINESS_DETAILS } from "@/config/business";

export function generateFunctionOrderPdf(order: FunctionOrder) {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  let y = 15;
  doc.setTextColor(38, 102, 153);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(20);
  doc.text(BUSINESS_DETAILS.name, 105, y, { align: "center" });
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
  // Charged rows are shaded so the eye lands on what is actually being billed.
  const totalRowIndexes = new Set<number>();
  let total = 0;

  order.deliveryDays.forEach((day) =>
    day.items.forEach((item) => {
      const summary = summariseFunctionOrderItem(item);
      const when = `${day.deliveryTime || "—"}${day.peopleCount ? ` / ${day.peopleCount} people` : ""}`;

      summary.breakdown.forEach((movement) => {
        rows.push([
          day.deliveryDate,
          when,
          item.itemName,
          movement.label,
          formatFunctionOrderQuantity(movement.quantity, item.unit),
          "",
          "",
        ]);
      });

      totalRowIndexes.add(rows.length);

      rows.push([
        // Repeated only when this row stands alone, so a breakdown reads as one block.
        summary.breakdown.length ? "" : day.deliveryDate,
        summary.breakdown.length ? "" : when,
        item.itemName,
        summary.totalLabel,
        summary.quantityLabel,
        formatRupees(item.unitPrice),
        formatRupees(summary.amount),
      ]);

      total += summary.amount;
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
    columnStyles: {
      5: { halign: "right" },
      6: { halign: "right" },
    },
    didParseCell: (data) => {
      if (data.section !== "body") return;
      if (!totalRowIndexes.has(data.row.index)) return;

      data.cell.styles.fontStyle = "bold";
      data.cell.styles.fillColor = [238, 244, 249];
    },
  });

  const finalY =
    (doc as jsPDF & { lastAutoTable: { finalY: number } }).lastAutoTable
      .finalY + 9;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.setTextColor(30, 30, 30);
  doc.text(`Net total: ${formatRupees(total)}`, 196, finalY, {
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
