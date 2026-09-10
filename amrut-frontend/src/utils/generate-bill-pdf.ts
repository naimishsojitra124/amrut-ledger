import { jsPDF } from "jspdf";
import { autoTable } from "jspdf-autotable";

import type {
  CustomerDailyHistoryItemResponse,
} from "@/types/customer";

import type { BillResponse } from "@/types/bill";

// const PRIMARY = "#266699";

const PAGE_WIDTH = 210;
const PAGE_HEIGHT = 297;

const MARGIN_LEFT = 14;
const MARGIN_RIGHT = 14;

type BusinessDetails = {
  name: string;
  address?: string;
  phone?: string;
  email?: string;
  gstNumber?: string;
};

type CustomerDetails = {
  id?: string;
  cardNumber?: number;
  fullName: string;
  mobile?: string;
  address?: string;
};

type GenerateBillPdfOptions = {
  bill: BillResponse;

  dailyHistory: CustomerDailyHistoryItemResponse[];

  business: BusinessDetails;

  customer: CustomerDetails;
};

function formatCurrency(value: number): string {
  return `Rs. ${Number(value || 0).toFixed(2)}`;
}

function formatDate(
  value: string | Date,
): string {
  const date =
    value instanceof Date
      ? value
      : new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "—";
  }

  return date.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function formatMonthYear(
  month: number,
  year: number,
): string {
  return new Date(
    year,
    month - 1,
    1,
  ).toLocaleDateString("en-IN", {
    month: "long",
    year: "numeric",
  });
}

function getDayName(value: string): string {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "";
  }

  return date.toLocaleDateString("en-IN", {
    weekday: "short",
  });
}

function normalizeMilkAmount(
  milk: {
    litres: number;
    rate?: number;
    amount?: number;
  },
): number {
  if (
    typeof milk.amount === "number" &&
    Number.isFinite(milk.amount)
  ) {
    return milk.amount;
  }

  if (
    typeof milk.rate === "number" &&
    Number.isFinite(milk.rate)
  ) {
    return milk.litres * milk.rate;
  }

  return 0;
}

function normalizeProductAmount(
  product: {
    quantity: number;
    unitPrice: number;
    amount?: number;
  },
): number {
  if (
    typeof product.amount === "number" &&
    Number.isFinite(product.amount)
  ) {
    return product.amount;
  }

  return product.quantity * product.unitPrice;
}

function getDailyHistoryRows(
  history: CustomerDailyHistoryItemResponse[],
) {
  return history
    .slice()
    .sort(
      (a, b) =>
        new Date(a.ledgerDate).getTime() -
        new Date(b.ledgerDate).getTime(),
    )
    .map((ledger) => {
      const milkLines: string[] = [];
      const productLines: string[] = [];

      let milkTotal = 0;
      let productTotal = 0;

      for (const entry of ledger.entries ?? []) {
        for (const milk of entry.milkEntries ?? []) {
          const litres = Number(milk.litres || 0);

          const amount =
            normalizeMilkAmount(milk);

          milkTotal += amount;

          const milkName =
            milk.milkTypeName ??
            "Milk";

          milkLines.push(`${milkName}\n${litres.toFixed(2)} L × ${formatCurrency(milk.rate ?? 0)}/L\n${formatCurrency(amount)}`);
        }

        for (const product of entry.productEntries ?? []) {
          const quantity = Number(
            product.quantity || 0,
          );

          const amount =
            normalizeProductAmount(product);

          productTotal += amount;

          productLines.push(`${product.itemName}\n${quantity} Qty × ${formatCurrency(product.unitPrice)}\n${formatCurrency(amount)}`);
        }
      }

      return {
        date: formatDate(ledger.ledgerDate),

        day: getDayName(ledger.ledgerDate),

        milk: milkLines.length
          ? milkLines.join("\n")
          : "—",

        products: productLines.length
          ? productLines.join("\n")
          : "—",

        milkTotal,

        productTotal,

        total:
          milkTotal +
          productTotal,
      };
    });
}

function addFooter(
  doc: jsPDF,
) {
  const pageCount =
    doc.getNumberOfPages();

  for (
    let page = 1;
    page <= pageCount;
    page++
  ) {
    doc.setPage(page);

    const y = PAGE_HEIGHT - 8;

    doc.setDrawColor(220, 220, 220);

    doc.line(
      MARGIN_LEFT,
      y - 3,
      PAGE_WIDTH - MARGIN_RIGHT,
      y - 3,
    );

    doc.setFontSize(8);

    doc.setTextColor(
      120,
      120,
      120,
    );

    doc.text(
      "Amrut Dairy Farm",
      MARGIN_LEFT,
      y,
    );

    doc.text(
      `Page ${page} of ${pageCount}`,
      PAGE_WIDTH - MARGIN_RIGHT,
      y,
      {
        align: "right",
      },
    );
  }
}

function addSectionTitle(
  doc: jsPDF,
  title: string,
  y: number,
): number {
  doc.setFillColor(
    38,
    102,
    153,
  );

  doc.roundedRect(
    MARGIN_LEFT,
    y,
    PAGE_WIDTH -
      MARGIN_LEFT -
      MARGIN_RIGHT,
    8,
    1.5,
    1.5,
    "F",
  );

  doc.setFontSize(11);

  doc.setFont("helvetica", "bold");

  doc.setTextColor(
    255,
    255,
    255,
  );

  doc.text(
    title,
    MARGIN_LEFT + 4,
    y + 5.5,
  );

  return y + 13;
}

export function generateBillPdf({
  bill,
  dailyHistory,
  business,
  customer,
}: GenerateBillPdfOptions) {
  const doc = new jsPDF({
    orientation: "portrait",
    unit: "mm",
    format: "a4",
  });

  /* ---------------------------------------------------------------------- */
  /* Header                                                                  */
  /* ---------------------------------------------------------------------- */

  let y = 15;

  doc.setTextColor(
    38,
    102,
    153,
  );

  doc.setFont(
    "helvetica",
    "bold",
  );

  doc.setFontSize(20);

  doc.text(
    business.name,
    PAGE_WIDTH / 2,
    y,
    {
      align: "center",
    },
  );

  y += 7;

  doc.setFont(
    "helvetica",
    "normal",
  );

  doc.setFontSize(9);

  doc.setTextColor(
    80,
    80,
    80,
  );

  if (business.address) {
    doc.text(
      business.address,
      PAGE_WIDTH / 2,
      y,
      {
        align: "center",
      },
    );

    y += 4;
  }

  const contactParts = [
    business.phone,
    business.email,
    business.gstNumber
      ? `GSTIN: ${business.gstNumber}`
      : undefined,
  ].filter(Boolean);

  if (contactParts.length) {
    doc.text(
      contactParts.join("  |  "),
      PAGE_WIDTH / 2,
      y,
      {
        align: "center",
      },
    );

    y += 6;
  }

  doc.setDrawColor(
    38,
    102,
    153,
  );

  doc.setLineWidth(0.5);

  doc.line(
    MARGIN_LEFT,
    y,
    PAGE_WIDTH - MARGIN_RIGHT,
    y,
  );

  y += 8;

  /* ---------------------------------------------------------------------- */
  /* Bill/customer information                                               */
  /* ---------------------------------------------------------------------- */

  doc.setFont(
    "helvetica",
    "bold",
  );

  doc.setFontSize(13);

  doc.setTextColor(
    30,
    30,
    30,
  );

  doc.text(
    "MONTHLY BILL",
    MARGIN_LEFT,
    y,
  );

  y += 7;

  const infoStartY = y;

  doc.setFontSize(9);

  doc.setFont(
    "helvetica",
    "normal",
  );

  doc.setTextColor(
    70,
    70,
    70,
  );

  doc.text(
    `Customer: ${customer.fullName}`,
    MARGIN_LEFT,
    y,
  );

  doc.text(
    `Bill Number: ${bill.billNumber}`,
    110,
    y,
  );

  y += 5;

  doc.text(
    `Card Number: ${
      customer.cardNumber ?? "—"
    }`,
    MARGIN_LEFT,
    y,
  );

  doc.text(
    `Bill Date: ${formatDate(
      bill.billDate,
    )}`,
    110,
    y,
  );

  y += 5;

  doc.text(
    `Mobile: ${
      customer.mobile ?? "—"
    }`,
    MARGIN_LEFT,
    y,
  );

  doc.text(
    `Billing Period: ${formatMonthYear(
      bill.month,
      bill.year,
    )}`,
    110,
    y,
  );

  y += 5;

  if (customer.address) {
    doc.text(
      `Address: ${customer.address}`,
      MARGIN_LEFT,
      y,
    );

    y += 5;
  }

  y = Math.max(
    y,
    infoStartY + 22,
  );

  /* ---------------------------------------------------------------------- */
  /* Bill summary                                                            */
  /* ---------------------------------------------------------------------- */

  y = addSectionTitle(
    doc,
    "Bill Summary",
    y,
  );

  const summaryBody: string[][] =
    [];

  for (const milk of bill.milkSummary ??
    []) {
    summaryBody.push([
      `${milk.litres.toFixed(
        2,
      )} Ltr × ${
        milk.milkTypeName
      } @ ${formatCurrency(
        milk.rate,
      )}/Ltr`,
      formatCurrency(
        milk.amount,
      ),
    ]);
  }

  summaryBody.push([
    "Other Items Total",
    formatCurrency(
      bill.otherItemsTotal,
    ),
  ]);

  if (bill.previousDue > 0) {
    summaryBody.push([
      "Previous Due",
      formatCurrency(
        bill.previousDue,
      ),
    ]);
  }

  summaryBody.push([
    "Grand Total",
    formatCurrency(
      bill.grandTotal,
    ),
  ]);

  summaryBody.push([
    "Total Paid",
    formatCurrency(
      bill.totalPaid,
    ),
  ]);

  summaryBody.push([
    "Outstanding",
    formatCurrency(
      bill.outstandingAmount,
    ),
  ]);

  autoTable(doc, {
    startY: y,

    head: [
      [
        "Details",
        "Amount",
      ],
    ],

    body: summaryBody,

    margin: {
      left: MARGIN_LEFT,
      right: MARGIN_RIGHT,
    },

    theme: "grid",

    styles: {
      font: "helvetica",
      fontSize: 9,
      cellPadding: 3,
      textColor: [
        50,
        50,
        50,
      ],
    },

    headStyles: {
      fillColor: [
        38,
        102,
        153,
      ],

      textColor: [
        255,
        255,
        255,
      ],

      fontStyle: "bold",
    },

    columnStyles: {
      0: {
        cellWidth: 135,
      },

      1: {
        cellWidth: 45,
        halign: "right",
      },
    },

    didParseCell(data) {
      if (
        data.section ===
          "body" &&
        data.row.index ===
          summaryBody.length - 3
      ) {
        data.cell.styles.fontStyle =
          "bold";

        data.cell.styles.fillColor =
          [
            239,
            246,
            255,
          ];
      }

      if (
        data.section ===
          "body" &&
        data.row.index ===
          summaryBody.length - 1
      ) {
        data.cell.styles.fontStyle =
          "bold";

        data.cell.styles.textColor =
          [
            220,
            38,
            38,
          ];
      }
    },
  });

  const summaryTable =
    (
      doc as unknown as {
        lastAutoTable?: {
          finalY?: number;
        };
      }
    ).lastAutoTable;

  y =
    (summaryTable?.finalY ??
      y + 50) + 10;

  /* ---------------------------------------------------------------------- */
  /* Bill metadata                                                           */
  /* ---------------------------------------------------------------------- */

  doc.setFontSize(8.5);

  doc.setTextColor(
    100,
    100,
    100,
  );

  doc.text(
    `Generated on: ${formatDate(
      bill.generatedAt,
    )}`,
    MARGIN_LEFT,
    y,
  );

  doc.text(
    `Generated by: ${
      bill.generatedBy?.fullName ??
      "—"
    }`,
    110,
    y,
  );

  y += 10;

  /* ---------------------------------------------------------------------- */
  /* Daily history                                                           */
  /* ---------------------------------------------------------------------- */

  y = addSectionTitle(
    doc,
    `Daily Purchase History — ${formatMonthYear(
      bill.month,
      bill.year,
    )}`,
    y,
  );

  const historyRows =
    getDailyHistoryRows(
      dailyHistory,
    );

  if (!historyRows.length) {
    doc.setFontSize(9);

    doc.setTextColor(
      100,
      100,
      100,
    );

    doc.text(
      "No daily purchase history available for this billing period.",
      MARGIN_LEFT,
      y,
    );
  } else {
    autoTable(doc, {
      startY: y,

      head: [
        [
          "Date",
          "Milk Purchases",
          "Product Purchases",
          "Total",
        ],
      ],

      body: historyRows.map(
        (row) => [
          `${row.date}\n${row.day}`,
          row.milk,
          row.products,
          formatCurrency(
            row.total,
          ),
        ],
      ),

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
        textColor: [
          45,
          45,
          45,
        ],
      },

      headStyles: {
        fillColor: [
          38,
          102,
          153,
        ],

        textColor: [
          255,
          255,
          255,
        ],

        fontStyle: "bold",

        halign: "left",
      },

      alternateRowStyles: {
        fillColor: [
          248,
          250,
          252,
        ],
      },

      columnStyles: {
        0: {
          cellWidth: 30,
        },

        1: {
          cellWidth: 62,
        },

        2: {
          cellWidth: 63,
        },

        3: {
          cellWidth: 31,
          halign: "right",
          fontStyle: "bold",
        },
      },

      didParseCell(data) {
        if (
          data.section ===
          "body"
        ) {
          if (
            data.column.index ===
            0
          ) {
            data.cell.styles.fontStyle =
              "bold";
          }

          if (
            data.column.index ===
            3
          ) {
            data.cell.styles.textColor =
              [
                38,
                102,
                153,
              ];
          }
        }
      },
    });
  }

  /* ---------------------------------------------------------------------- */
  /* Final note                                                              */
  /* ---------------------------------------------------------------------- */

  const lastTable =
    (
      doc as unknown as {
        lastAutoTable?: {
          finalY?: number;
        };
      }
    ).lastAutoTable;

  y =
    (lastTable?.finalY ??
      y + 20) + 10;

  if (
    bill.notes &&
    y < PAGE_HEIGHT - 30
  ) {
    doc.setFontSize(8);

    doc.setFont(
      "helvetica",
      "bold",
    );

    doc.setTextColor(
      80,
      80,
      80,
    );

    doc.text(
      "Notes",
      MARGIN_LEFT,
      y,
    );

    y += 4;

    doc.setFont(
      "helvetica",
      "normal",
    );

    const noteLines =
      doc.splitTextToSize(
        bill.notes,
        PAGE_WIDTH -
          MARGIN_LEFT -
          MARGIN_RIGHT,
      );

    doc.text(
      noteLines,
      MARGIN_LEFT,
      y,
    );
  }

  /* ---------------------------------------------------------------------- */
  /* Footer                                                                  */
  /* ---------------------------------------------------------------------- */

  addFooter(doc);

  const filename =
    `${bill.billNumber}-${customer.fullName
      .replace(/[^a-zA-Z0-9]+/g, "-")
      .replace(/^-|-$/g, "")}.pdf`;

  doc.save(filename);
}
