import { nanoid } from "nanoid";
import type { FastifyInstance } from "fastify";

import type { FunctionOrder, PrismaClient } from "../../../generated/prisma/client";

import type {
  CreateFunctionOrderRequest,
  UpdateFunctionOrderRequest,
} from "./function-order.types";

import { buildPageInfo } from "../customer/customer.service";

const getPrisma = (app: FastifyInstance) =>
  (
    app as FastifyInstance & {
      prisma: PrismaClient;
    }
  ).prisma;

const error = (statusCode: number, message: string) =>
  Object.assign(new Error(message), {
    statusCode,
  });

const BUSINESS_TIME_ZONE = "Asia/Kolkata";

const businessDate = (value: string) => {
  return new Date(`${value}T00:00:00.000Z`);
};

function getBusinessYearMonth(date = new Date()) {
  const parts = new Intl.DateTimeFormat("en-IN", {
    timeZone: BUSINESS_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
  }).formatToParts(date);

  const year = parts.find((part) => part.type === "year")?.value;

  const month = parts.find((part) => part.type === "month")?.value;

  if (!year || !month) {
    throw new Error("Unable to determine business date.");
  }

  return {
    year,
    month,
  };
}

function createOrderNumber(date = new Date()) {
  const { year, month } = getBusinessYearMonth(date);

  return `FO-${month}-${year}-${nanoid(6).toUpperCase()}`;
}

function serialize(order: FunctionOrder) {
  return {
    ...order,

    createdAt: order.createdAt.toISOString(),

    updatedAt: order.updatedAt.toISOString(),

    deliveryDays: order.deliveryDays.map((day) => ({
      ...day,

      deliveryDate: day.deliveryDate.toISOString().slice(0, 10),

      items: day.items.map((item) => ({
        ...item,
        movements: item.movements ?? [],
      })),
    })),
  };
}

function serializeAuditLog(log: {
  id: string;
  functionOrderId: string;
  orderNumber: string;
  action: string;
  details: string;
  performedById: string;
  performedAt: Date;
}) {
  return {
    id: log.id,
    functionOrderId: log.functionOrderId,
    orderNumber: log.orderNumber,
    action: log.action,
    details: log.details,
    performedById: log.performedById,
    performedAt: log.performedAt.toISOString(),
  };
}

function mapDays(days: CreateFunctionOrderRequest["deliveryDays"]) {
  return days.map((day) => ({
    deliveryDate: businessDate(day.deliveryDate),

    deliveryTime: day.deliveryTime,

    peopleCount: day.peopleCount,

    notes: day.notes,

    items: day.items.map((item) => ({
      ...item,

      id: item.id ?? nanoid(12),

      movements: (item.movements ?? []).map((movement) => ({
        ...movement,

        id: movement.id ?? nanoid(12),

        createdAt: movement.createdAt ? new Date(movement.createdAt) : new Date(),
      })),
    })),
  }));
}

function formatQuantity(quantity: number, unit: string) {
  return `${Number(quantity.toFixed(2))} ${unit}`;
}

function movementDescription(
  itemName: string,
  movement: {
    type: "dispatch" | "return";
    quantity: number;
  },
  unit: string,
) {
  const action = movement.type === "dispatch" ? "additional dispatch" : "additional return";

  return `${itemName}: ${action} ${formatQuantity(movement.quantity, unit)}`;
}

function movementRemovalDescription(
  itemName: string,
  movement: {
    type: "dispatch" | "return";
    quantity: number;
  },
  unit: string,
) {
  const action = movement.type === "dispatch" ? "dispatch" : "return";

  return `${itemName}: ${action} ${formatQuantity(movement.quantity, unit)} removed`;
}

function getMovementChanges(
  itemName: string,
  unit: string,
  previousMovements: Array<{
    id: string;
    type: "dispatch" | "return";
    quantity: number;
    note: string;
  }>,
  nextMovements: Array<{
    id?: string;
    type: "dispatch" | "return";
    quantity: number;
    note: string;
  }>,
) {
  const changes: string[] = [];

  const previousById = new Map(previousMovements.map((movement) => [movement.id, movement]));

  const nextById = new Map(
    nextMovements
      .filter((movement): movement is typeof movement & { id: string } => movement.id !== undefined)
      .map((movement) => [movement.id, movement]),
  );

  for (const movement of nextMovements) {
    const previous = movement.id !== undefined ? previousById.get(movement.id) : undefined;

    if (!previous) {
      changes.push(movementDescription(itemName, movement, unit));
      continue;
    }

    if (previous.type !== movement.type) {
      changes.push(
        `${itemName}: ${previous.type} ${formatQuantity(
          previous.quantity,
          unit,
        )} changed to ${movement.type} ${formatQuantity(movement.quantity, unit)}`,
      );
      continue;
    }

    if (previous.quantity !== movement.quantity) {
      changes.push(
        `${itemName}: ${movement.type} quantity changed from ${formatQuantity(
          previous.quantity,
          unit,
        )} to ${formatQuantity(movement.quantity, unit)}`,
      );
    }

    if (previous.note !== movement.note) {
      changes.push(`${itemName}: ${movement.type} note updated`);
    }
  }

  for (const movement of previousMovements) {
    if (!nextById.has(movement.id)) {
      changes.push(movementRemovalDescription(itemName, movement, unit));
    }
  }

  return changes;
}

function changeSummary(
  previous: Awaited<ReturnType<typeof getFunctionOrder>>,
  input: UpdateFunctionOrderRequest,
) {
  const changes: string[] = [];

  if (input.customerName !== undefined && input.customerName !== previous.customerName) {
    changes.push(
      `customer name changed from "${previous.customerName}" to "${input.customerName}"`,
    );
  }

  if (input.mobileNumber !== undefined && input.mobileNumber !== previous.mobileNumber) {
    changes.push(
      `mobile number changed from "${previous.mobileNumber}" to "${input.mobileNumber}"`,
    );
  }

  if (input.eventName !== undefined && input.eventName !== previous.eventName) {
    changes.push(`event name changed from "${previous.eventName}" to "${input.eventName}"`);
  }

  if (
    input.reminderDaysBefore !== undefined &&
    input.reminderDaysBefore !== previous.reminderDaysBefore
  ) {
    changes.push(
      `reminder changed from ${previous.reminderDaysBefore} days to ${input.reminderDaysBefore} days`,
    );
  }

  if (input.status !== undefined && input.status !== previous.status) {
    changes.push(`status changed from ${previous.status} to ${input.status}`);
  }

  if (input.notes !== undefined && input.notes !== previous.notes) {
    changes.push("order notes updated");
  }

  if (input.deliveryDays) {
    const previousItems = new Map(
      previous.deliveryDays.flatMap((day) => day.items).map((item) => [item.id, item]),
    );

    for (const item of input.deliveryDays.flatMap((day) => day.items)) {
      const before = item.id ? previousItems.get(item.id) : undefined;

      if (!before) {
        changes.push(`item added: ${item.itemName} (${formatQuantity(item.quantity, item.unit)})`);
        continue;
      }

      if (item.itemName !== before.itemName) {
        changes.push(`item renamed from "${before.itemName}" to "${item.itemName}"`);
      }

      if (item.quantity !== before.quantity) {
        changes.push(
          `${item.itemName}: quantity changed from ${formatQuantity(
            before.quantity,
            before.unit,
          )} to ${formatQuantity(item.quantity, item.unit)}`,
        );
      }

      if (item.unit !== before.unit) {
        changes.push(`${item.itemName}: unit changed from ${before.unit} to ${item.unit}`);
      }

      if (item.unitPrice !== before.unitPrice) {
        changes.push(
          `${item.itemName}: unit price changed from ₹${before.unitPrice} to ₹${item.unitPrice}`,
        );
      }

      if (item.returnedQuantity !== before.returnedQuantity) {
        changes.push(
          `${item.itemName}: returned quantity changed from ${formatQuantity(
            before.returnedQuantity,
            before.unit,
          )} to ${formatQuantity(item.returnedQuantity, item.unit)}`,
        );
      }

      if (item.returnNote !== before.returnNote) {
        changes.push(`${item.itemName}: return note updated`);
      }

      changes.push(
        ...getMovementChanges(
          item.itemName,
          item.unit,
          (before.movements ?? [])
            .filter((movement) => movement.id !== undefined)
            .map((movement) => ({
              ...movement,
              type: movement.type as "dispatch" | "return",
            })),
          (item.movements ?? []).map((movement) => {
            const normalizedMovement = {
              type: movement.type,
              quantity: movement.quantity,
              note: movement.note,
            };

            return movement.id === undefined
              ? normalizedMovement
              : { ...normalizedMovement, id: movement.id };
          }),
        ),
      );

      previousItems.delete(before.id);
    }

    for (const item of previousItems.values()) {
      changes.push(`item removed: ${item.itemName}`);
    }

    const previousDays = previous.deliveryDays.map((day) => ({
      date: day.deliveryDate,
      time: day.deliveryTime,
      people: day.peopleCount,
      notes: day.notes,
    }));

    const nextDays = input.deliveryDays.map((day) => ({
      date: day.deliveryDate,
      time: day.deliveryTime,
      people: day.peopleCount,
      notes: day.notes,
    }));

    if (JSON.stringify(previousDays) !== JSON.stringify(nextDays)) {
      changes.push("delivery schedule updated");
    }
  }

  return changes.join("; ") || "No values changed";
}

export async function createFunctionOrder(
  app: FastifyInstance,
  userId: string,
  input: CreateFunctionOrderRequest,
) {
  const prisma = getPrisma(app);

  const order = await prisma.functionOrder.create({
    data: {
      ...input,

      orderNumber: createOrderNumber(),

      deliveryDays: mapDays(input.deliveryDays),

      createdById: userId,
      updatedById: userId,
    },
  });

  await prisma.functionOrderAuditLog.create({
    data: {
      functionOrderId: order.id,
      orderNumber: order.orderNumber,
      action: "created",
      details: "Function order created",
      performedById: userId,
    },
  });

  return serialize(order);
}

export async function listFunctionOrders(
  app: FastifyInstance,
  query: {
    status?: "draft" | "confirmed" | "completed" | "cancelled" | undefined;

    search?: string | undefined;

    page?: number;

    limit?: number;
  },
) {
  const prisma = getPrisma(app);

  const page = query.page ?? 1;
  const limit = query.limit ?? 10;

  const where = {
    ...(query.status
      ? {
          status: query.status,
        }
      : {}),

    ...(query.search
      ? {
          OR: [
            {
              customerName: {
                contains: query.search,
                mode: "insensitive" as const,
              },
            },
            {
              mobileNumber: {
                contains: query.search,
              },
            },
            {
              orderNumber: {
                contains: query.search,
                mode: "insensitive" as const,
              },
            },
          ],
        }
      : {}),
  };

  const [totalItems, items] = await Promise.all([
    prisma.functionOrder.count({
      where,
    }),

    prisma.functionOrder.findMany({
      where,
      orderBy: {
        createdAt: "desc",
      },
      skip: (page - 1) * limit,
      take: limit,
    }),
  ]);

  const pageInfo = buildPageInfo(totalItems, page, limit);

  return {
    items: items.map(serialize),
    pageInfo,
  };
}

export async function getFunctionOrder(app: FastifyInstance, id: string) {
  const order = await getPrisma(app).functionOrder.findUnique({
    where: { id },
  });

  if (!order) {
    throw error(404, "Function order not found");
  }

  return serialize(order);
}

export async function updateFunctionOrder(
  app: FastifyInstance,
  id: string,
  userId: string,
  input: UpdateFunctionOrderRequest,
) {
  const existing = await getFunctionOrder(app, id);

  const prisma = getPrisma(app);

  const order = await prisma.functionOrder.update({
    where: { id },

    data: {
      ...input,

      ...(input.deliveryDays
        ? {
            deliveryDays: mapDays(input.deliveryDays),
          }
        : {}),

      updatedById: userId,
    },
  });

  await prisma.functionOrderAuditLog.create({
    data: {
      functionOrderId: id,
      orderNumber: existing.orderNumber,
      action: "updated",
      details: changeSummary(existing, input),
      performedById: userId,
    },
  });

  return serialize(order);
}

export async function deleteFunctionOrder(app: FastifyInstance, id: string, userId: string) {
  const existing = await getFunctionOrder(app, id);

  const prisma = getPrisma(app);

  await prisma.functionOrderAuditLog.create({
    data: {
      functionOrderId: id,
      orderNumber: existing.orderNumber,
      action: "deleted",
      details: "Function order deleted",
      performedById: userId,
    },
  });

  await prisma.functionOrder.delete({
    where: { id },
  });
}

export async function getFunctionOrderAuditLogs(app: FastifyInstance, id: string) {
  await getFunctionOrder(app, id);

  const logs = await getPrisma(app).functionOrderAuditLog.findMany({
    where: {
      functionOrderId: id,
    },

    orderBy: {
      performedAt: "desc",
    },
  });

  return {
    items: logs.map(serializeAuditLog),
  };
}

export async function getFunctionOrderReminders(app: FastifyInstance, daysAhead = 2) {
  const start = new Date();

  start.setUTCHours(0, 0, 0, 0);

  const end = new Date(start);

  end.setUTCDate(end.getUTCDate() + daysAhead);

  const orders = await getPrisma(app).functionOrder.findMany({
    where: {
      status: {
        in: ["draft", "confirmed"],
      },
    },

    orderBy: {
      createdAt: "desc",
    },
  });

  return {
    items: orders.flatMap((order: FunctionOrder) =>
      order.deliveryDays
        .filter((day) => day.deliveryDate >= start && day.deliveryDate <= end)
        .map((day) => ({
          order: serialize(order),

          deliveryDate: day.deliveryDate.toISOString().slice(0, 10),

          daysUntil: Math.ceil((day.deliveryDate.getTime() - start.getTime()) / 86_400_000),
        })),
    ),
  };
}
