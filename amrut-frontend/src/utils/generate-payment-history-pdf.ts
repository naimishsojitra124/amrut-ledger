import { jsPDF } from "jspdf";
import { autoTable } from "jspdf-autotable";

import type { CustomerPaymentItemResponse } from "@/types/customer";
import { formatRupees } from "@/utils/format-currency";
import { BUSINESS_DETAILS } from "@/config/business";

const PAGE_WIDTH = 210;
const PAGE_HEIGHT = 297;

const MARGIN_LEFT = 14;
const MARGIN_RIGHT = 14;

type GeneratePaymentHistoryPdfOptions = {
  payments: CustomerPaymentItemResponse[];

  customer: {
    id?: string;
    cardNumber?: number;
    fullName: string;
    mobile?: string;
    address?: string;
  };

  business: {
    name: string;
    address?: string;
    phone?: string;
    email?: string;
  };

  summary: {
    totalBilled: number;
    totalPaid: number;
    outstanding: number;
    totalPayments: number;
  };
};

function formatDateTime(value: string): string {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "—";
  }

  return date.toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function addFooter(doc: jsPDF) {
  const pageCount = doc.getNumberOfPages();

  for (let page = 1; page <= pageCount; page += 1) {
    doc.setPage(page);

    const y = PAGE_HEIGHT - 8;

    doc.setDrawColor(220, 220, 220);

    doc.line(MARGIN_LEFT, y - 3, PAGE_WIDTH - MARGIN_RIGHT, y - 3);

    doc.setFontSize(8);

    doc.setFont("helvetica", "normal");

    doc.setTextColor(120, 120, 120);

    doc.text(BUSINESS_DETAILS.name, MARGIN_LEFT, y);

    doc.text(`Page ${page} of ${pageCount}`, PAGE_WIDTH - MARGIN_RIGHT, y, {
      align: "right",
    });
  }
}

export function generatePaymentHistoryPdf({
  payments,
  customer,
  business,
  summary,
}: GeneratePaymentHistoryPdfOptions) {
  const doc = new jsPDF({
    orientation: "portrait",
    unit: "mm",
    format: "a4",
  });

  let y = 15;

  /*
   * --------------------------------------------------------------------------
   * Header
   * --------------------------------------------------------------------------
   */

  doc.setTextColor(38, 102, 153);

  doc.setFont("helvetica", "bold");

  doc.setFontSize(20);

  doc.text(business.name, PAGE_WIDTH / 2, y, {
    align: "center",
  });

  y += 7;

  doc.setFont("helvetica", "normal");

  doc.setFontSize(9);

  doc.setTextColor(80, 80, 80);

  if (business.address) {
    doc.text(business.address, PAGE_WIDTH / 2, y, {
      align: "center",
    });

    y += 4;
  }

  const contactParts = [
    business.phone,
    business.email,
  ].filter(Boolean);

  if (contactParts.length > 0) {
    doc.text(contactParts.join("  |  "), PAGE_WIDTH / 2, y, {
      align: "center",
    });

    y += 6;
  }

  doc.setDrawColor(38, 102, 153);

  doc.setLineWidth(0.5);

  doc.line(MARGIN_LEFT, y, PAGE_WIDTH - MARGIN_RIGHT, y);

  y += 8;

  /*
   * --------------------------------------------------------------------------
   * Title
   * --------------------------------------------------------------------------
   */

  doc.setFont("helvetica", "bold");

  doc.setFontSize(14);

  doc.setTextColor(30, 30, 30);

  doc.text("PAYMENT HISTORY", MARGIN_LEFT, y);

  y += 7;

  /*
   * --------------------------------------------------------------------------
   * Customer information
   * --------------------------------------------------------------------------
   */

  doc.setFontSize(9);

  doc.setFont("helvetica", "normal");

  doc.setTextColor(70, 70, 70);

  doc.text(`Customer: ${customer.fullName}`, MARGIN_LEFT, y);

  if (customer.cardNumber !== undefined) {
    doc.text(`Card Number: ${customer.cardNumber}`, 110, y);
  }

  y += 5;

  doc.text(`Mobile: ${customer.mobile ?? "—"}`, MARGIN_LEFT, y);

  doc.text(`Customer ID: ${customer.id ?? "—"}`, 110, y);

  y += 5;

  if (customer.address) {
    doc.text(`Address: ${customer.address}`, MARGIN_LEFT, y);

    y += 5;
  }

  /*
   * --------------------------------------------------------------------------
   * Summary
   * --------------------------------------------------------------------------
   */

  y += 3;

  autoTable(doc, {
    startY: y,

    head: [["Total Payments", "Total Paid", "Current Outstanding"]],

    body: [
      [
        String(payments.length),
        formatRupees(
          payments.reduce((sum, payment) => sum + payment.creditedAmount, 0),
        ),
        formatRupees(summary.outstanding),
      ],
    ],

    margin: {
      left: MARGIN_LEFT,
      right: MARGIN_RIGHT,
    },

    theme: "grid",

    styles: {
      font: "helvetica",
      fontSize: 9,
      cellPadding: 4,
      halign: "center",
      textColor: [50, 50, 50],
    },

    headStyles: {
      fillColor: [38, 102, 153],

      textColor: [255, 255, 255],

      fontStyle: "bold",
    },

    bodyStyles: {
      fontStyle: "bold",
    },
  });

  const summaryTable = (
    doc as unknown as {
      lastAutoTable?: {
        finalY?: number;
      };
    }
  ).lastAutoTable;

  y = (summaryTable?.finalY ?? y + 20) + 10;

  /*
   * --------------------------------------------------------------------------
   * Payment table
   * --------------------------------------------------------------------------
   */

  autoTable(doc, {
    startY: y,

    head: [
      [
        "Date & Time",
        "Receipt",
        "Bill",
        "Amount",
        "Mode",
        "Received By",
        "Reference / Note",
      ],
    ],

    body: payments.map((payment) => {
      const referenceOrNote = payment.referenceNumber || payment.notes || "—";

      return [
        formatDateTime(payment.receivedAt),

        payment.receiptNumber || "—",

        `${payment.bill.billNumber}\n${new Date(
          payment.billYear,
          payment.billMonth - 1,
          1,
        ).toLocaleDateString("en-IN", {
          month: "short",
          year: "numeric",
        })}`,

        formatRupees(payment.creditedAmount),

        payment.paymentMethod.toUpperCase(),

        payment.receivedBy?.fullName ?? "—",

        referenceOrNote,
      ];
    }),

    margin: {
      left: MARGIN_LEFT,
      right: MARGIN_RIGHT,
      bottom: 15,
    },

    theme: "grid",

    styles: {
      font: "helvetica",
      fontSize: 7.5,
      cellPadding: 3,
      valign: "top",
      textColor: [45, 45, 45],
    },

    headStyles: {
      fillColor: [38, 102, 153],

      textColor: [255, 255, 255],

      fontStyle: "bold",
    },

    alternateRowStyles: {
      fillColor: [248, 250, 252],
    },

    columnStyles: {
      0: {
        cellWidth: 27,
      },

      1: {
        cellWidth: 25,
      },

      2: {
        cellWidth: 32,
      },

      3: {
        cellWidth: 24,
        halign: "right",
        fontStyle: "bold",
      },

      4: {
        cellWidth: 18,
      },

      5: {
        cellWidth: 29,
      },

      6: {
        cellWidth: 31,
      },
    },

    didParseCell(data) {
      if (data.section === "body" && data.column.index === 3) {
        data.cell.styles.textColor = [38, 102, 153];
      }
    },
  });

  /*
   * --------------------------------------------------------------------------
   * Footer
   * --------------------------------------------------------------------------
   */

  addFooter(doc);

  const safeCustomerName = customer.fullName
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

  doc.save(`payment-history-${safeCustomerName || "customer"}.pdf`);
}
