// src/pages/Reports.tsx
import { useState } from "react";
import { Download, FileSpreadsheet } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

import { BASE_URL } from "@/services/apiClient";

export default function Reports() {
  const currentYear = new Date().getFullYear();
  const [isGenerating, setIsGenerating] = useState(false);
  const [year, setYear] = useState(currentYear);
  
  const years = Array.from({ length: 11 }, (_, i) => currentYear - i);

  const handleGenerateRecon = async () => {
    setIsGenerating(true);
    try {
      const params = new URLSearchParams({
        year: String(year),
      });
      const url = `${BASE_URL}/api/reports/reconciliation-excel?${params}`;
      
      window.open(url, '_blank');
    } catch (error) {
      console.error("Error generating report:", error);
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="w-full space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500 ease-out">
      <header className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Reports</h1>
          <p className="text-slate-500 mt-1">
            Generate and download financial reports.
          </p>
        </div>
      </header>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        <Card className="shadow-sm">
          <CardHeader>
            <div className="flex items-center gap-2 mb-1">
              <FileSpreadsheet className="h-5 w-5 text-emerald-600" />
              <CardTitle>Reconciliation Report</CardTitle>
            </div>
            <CardDescription>
              Generate an Excel reconciliation report based on consolidated data for {year}.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <label className="text-sm font-medium">Reporting Year</label>
              <Select
                value={year.toString()}
                onValueChange={(val) => setYear(Number(val))}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select year" />
                </SelectTrigger>
                <SelectContent>
                  {years.map((y) => (
                    <SelectItem key={y} value={y.toString()}>
                      {y}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </CardContent>
          <CardFooter className="pt-2">
            <Button
              onClick={handleGenerateRecon}
              disabled={isGenerating}
              className="w-full gap-2"
            >
              <Download className="w-4 h-4" />
              {isGenerating ? "Generating..." : "Generate Report"}
            </Button>
          </CardFooter>
        </Card>
      </div>
    </div>
  );
}
