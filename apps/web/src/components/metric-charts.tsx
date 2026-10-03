"use client";

import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

import type { SeriesPoint } from "@/lib/types";

export function MetricChart({
  data,
  dataKey,
  color,
  domain,
}: {
  data: SeriesPoint[];
  dataKey: "tps" | "mspt" | "ram";
  color: string;
  domain?: [number, number];
}) {
  if (data.length === 0) {
    return <p className="py-10 text-center text-sm text-muted-foreground">Zatiaľ nie je telemetria. Mod ju posiela na /api/v1/telemetry.</p>;
  }
  return (
    <div className="h-44 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
          <CartesianGrid stroke="rgba(232,220,200,0.08)" vertical={false} />
          <XAxis dataKey="label" tick={{ fill: "#a3988c", fontSize: 11 }} tickLine={false} axisLine={false} minTickGap={28} />
          <YAxis domain={domain ?? ["auto", "auto"]} tick={{ fill: "#a3988c", fontSize: 11 }} tickLine={false} axisLine={false} width={40} />
          <Tooltip
            contentStyle={{ background: "#1c1814", border: "1px solid #3a322a", borderRadius: 6, fontSize: 12 }}
            labelStyle={{ color: "#c8b8a4" }}
            formatter={(value) => [typeof value === "number" ? value.toLocaleString("sk-SK") : value, dataKey.toUpperCase()]}
          />
          <Line type="monotone" dataKey={dataKey} stroke={color} strokeWidth={1.8} dot={false} isAnimationActive={false} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
