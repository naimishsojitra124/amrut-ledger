import "dotenv/config";
import { PrismaClient } from "../generated/prisma/client";

const prisma = new PrismaClient();

function nextNumber(value: string, prefix: string) {
  const match = value.match(new RegExp(`^${prefix}-(\\d{4})-(\\d+)$`));
  return match ? Number(match[2]) + 1 : 1;
}

async function main() {
  const [bills, payments] = await Promise.all([
    prisma.bill.findMany({ select: { billNumber: true } }),
    prisma.payment.findMany({ select: { receiptNumber: true } }),
  ]);
  const counters = new Map<string, number>();
  for (const { billNumber } of bills) {
    const year = billNumber.match(/^BILL-(\d{4})-/)?.[1];
    if (year) counters.set(`bill-${year}`, Math.max(counters.get(`bill-${year}`) ?? 1, nextNumber(billNumber, "BILL")));
  }
  for (const { receiptNumber } of payments) {
    const year = receiptNumber.match(/^REC-(\d{4})-/)?.[1];
    if (year) counters.set(`receipt-${year}`, Math.max(counters.get(`receipt-${year}`) ?? 1, nextNumber(receiptNumber, "REC")));
  }
  await Promise.all([...counters].map(([id, nextNumber]) => prisma.counter.upsert({ where: { id }, create: { id, nextNumber }, update: { nextNumber } })));
}

main().finally(() => prisma.$disconnect());
