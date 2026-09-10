// import { useMemo } from "react";

// import { customers } from "@/data/mock/customers";
// import { cards } from "@/data/mock/cards";
// import { cardAssignments } from "@/data/mock/card-assignments";
// import { milkTypes } from "@/data/mock/milk-types";
// import { dailyLedgers } from "@/data/mock/daily-ledgers";

// export interface CustomerTableRow {
//   id: string;
//   cardNumber: number;
//   fullName: string;
//   mobileNumber: string;
//   primaryMilk: string;
//   depositAmount: number;
//   outstandingAmount: number;
//   status: "active" | "closed";
//   lastEntryDate: Date | null;
// }

// export const useCustomersTableData = () => {
//   return useMemo<CustomerTableRow[]>(() => {
//     return customers.map((customer) => {
//       const activeAssignment = cardAssignments.find(
//         (assignment) =>
//           assignment.customerId === customer._id &&
//           !assignment.unassignedAt
//       );

//       const card = cards.find(
//         (card) => card._id === activeAssignment?.cardId
//       );

//       const defaultMilk = customer.milkTypes.find(
//         (milk) => milk.isDefault
//       );


//       const milkType = milkTypes.find(
//         (milk) => milk._id === defaultMilk?.milkTypeId
//       );

//       const customerLedgers = dailyLedgers
//         .filter(
//           (ledger) =>
//             ledger.customerId === customer._id
//         )
//         .sort(
//           (a, b) =>
//             new Date(b.ledgerDate).getTime() -
//             new Date(a.ledgerDate).getTime()
//         );

//       return {
//         id: customer._id,
//         cardNumber: card?.cardNumber ?? 0,
//         fullName: customer.fullName,
//         mobileNumber: customer.mobileNumber,
//         primaryMilk: milkType?.name ?? "-",
//         depositAmount: customer.depositAmount,
//         outstandingAmount:
//           customer.outstandingAmount,
//         status: customer.status,
//         lastEntryDate:
//           customerLedgers[0]?.ledgerDate ?? null,
//       };
//     });
//   }, []);
// };
