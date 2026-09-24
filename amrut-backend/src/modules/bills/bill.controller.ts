import type { FastifyReply, FastifyRequest } from "fastify";
import {
  billIdParamSchema,
  billListQuerySchema,
  createPaymentSchema,
  customerBillMonthParamSchema,
  customerIdParamSchema,
  generateBillSchema,
  paymentIdParamSchema,
  paymentListQuerySchema,
  reversePaymentSchema,
} from "./bill.schema";
import {
  generateBill,
  getBillById,
  getBillPayments,
  getBills,
  getBillsSummary,
  getCustomerBillByMonth,
  getPaymentById,
  getPayments,
  getPaymentsSummary,
  getOverdueBills,
  recordPayment,
  reversePayment,
} from "./bill.service";
import { getCurrentUserId } from "@/app/middleware/authorize";

export async function getBillsHandler(request: FastifyRequest, reply: FastifyReply) {
  const query = billListQuerySchema.parse(request.query);
  const result = await getBills(request.server, query);

  return reply.send(result);
}

export async function getBillsSummaryHandler(
  request: FastifyRequest,
  reply: FastifyReply,
) {
  const query = billListQuerySchema.parse(request.query);
  const result = await getBillsSummary(request.server, query);

  return reply.send(result);
}

export async function getBillByIdHandler(
  request: FastifyRequest,
  reply: FastifyReply,
) {
  const params = billIdParamSchema.parse(request.params);
  const result = await getBillById(request.server, params.billId);

  return reply.send(result);
}

export async function getBillPaymentsHandler(
  request: FastifyRequest,
  reply: FastifyReply,
) {
  const params = billIdParamSchema.parse(request.params);
  const query = paymentListQuerySchema.parse(request.query);
  const result = await getBillPayments(request.server, params.billId, query);

  return reply.send(result);
}

export async function getCustomerBillByMonthHandler(
  request: FastifyRequest,
  reply: FastifyReply,
) {
  const params = customerBillMonthParamSchema.parse(request.params);
  const result = await getCustomerBillByMonth(request.server, params);

  return reply.send(result);
}

export async function getPaymentsHandler(
  request: FastifyRequest,
  reply: FastifyReply,
) {
  const query = paymentListQuerySchema.parse(request.query);
  const result = await getPayments(request.server, query);

  return reply.send(result);
}

export async function getPaymentsSummaryHandler(
  request: FastifyRequest,
  reply: FastifyReply,
) {
  const query = paymentListQuerySchema.parse(request.query);
  const result = await getPaymentsSummary(request.server, query);

  return reply.send(result);
}

export async function getPaymentByIdHandler(
  request: FastifyRequest,
  reply: FastifyReply,
) {
  const params = paymentIdParamSchema.parse(request.params);
  const result = await getPaymentById(request.server, params.paymentId);

  return reply.send(result);
}


export async function generateBillHandler(
  request: FastifyRequest,
  reply: FastifyReply,
) {
  const params = customerIdParamSchema.parse(request.params);
  const body = generateBillSchema.parse(request.body);

  const result = await generateBill(
    request.server,
    params.customerId,
    body,
    getCurrentUserId(request),
  );

  return reply.status(201).send(result);
}


export async function recordPaymentHandler(
  request: FastifyRequest,
  reply: FastifyReply,
) {
  const body = createPaymentSchema.parse(request.body);

  const result = await recordPayment(
    request.server,
    body,
    getCurrentUserId(request),
  );

  return reply.status(201).send(result);
}

export async function getOverdueBillsHandler(request: FastifyRequest, reply: FastifyReply) {
  return reply.send(await getOverdueBills(request.server));
}

export async function reversePaymentHandler(request: FastifyRequest, reply: FastifyReply) {
  const { paymentId } = paymentIdParamSchema.parse(request.params);
  const { reason } = reversePaymentSchema.parse(request.body);
  return reply.send(await reversePayment(request.server, paymentId, reason, getCurrentUserId(request)));
}
