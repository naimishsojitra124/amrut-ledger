export type MilkTypeStatus = "active" | "inactive";

export interface MilkType {
  _id: string;
  name: string;
  rate: number;
  shortCode: string;
  status: MilkTypeStatus;
  
  createdAt: Date;
  updatedAt: Date;
}