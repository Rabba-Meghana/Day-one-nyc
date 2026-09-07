import Dashboard, { type CenterData, type ContractPayload } from "./Dashboard";
import contractData from "./data/contracts.json";
import centerData from "./data/centers.json";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default function Home() {
  return (
    <Dashboard
      data={contractData as ContractPayload}
      centerData={centerData as CenterData}
    />
  );
}
