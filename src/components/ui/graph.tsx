import { BarChart, Bar, XAxis, YAxis, Tooltip } from "recharts";

export function PlayerStatsChart({ data }: any) {
  return (
    <BarChart width={500} height={300} data={data}>
      <XAxis dataKey="name" />
      <YAxis />
      <Tooltip />
      <Bar dataKey="runs" />
    </BarChart>
  );
}