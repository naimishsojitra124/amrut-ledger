// import { customers } from "@/data/mock/customers";
// import { getCustomerOutstanding } from "@/utils/customer.utils";

// export function useCustomerStats() {
//   const activeCustomers = customers.filter(
//     (customer) => customer.status === "active",
//   );

//   const closedCustomers = customers.filter(
//     (customer) => customer.status === "archived",
//   );

//   const totalOutstanding = activeCustomers.reduce(
//     (total, customer) => total + getCustomerOutstanding(customer._id),
//     0,
//   );

//   const totalDeposits = activeCustomers.reduce(
//     (total, customer) => total + customer.depositAmount,
//     0,
//   );

//   return {
//     activeCustomersCount: activeCustomers.length,
//     closedCustomersCount: closedCustomers.length,
//     totalOutstanding,
//     totalDeposits,
//   };
// }
