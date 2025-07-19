"use client";

import { useRouter, useParams } from "next/navigation";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useEffect, useState } from "react";

const persianMonths = ['فروردین','اردیبهشت','خرداد','تیر','مرداد','شهریور','مهر','آبان','آذر','دی','بهمن','اسفند'];

export default function MonthDetailPage() {
  const router = useRouter();
  const params = useParams();
  const jm = Number(params.month);
  const monthName = persianMonths[jm - 1] || "ماه نامشخص";
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<any>(null);

  useEffect(() => {
    // TODO: Fetch month details from API using jm
    setTimeout(() => {
      setData({
        income: 12345678,
        expense: 8765432,
        transactions: [
          { id: 1, title: "درآمد خدمات", amount: 5000000 },
          { id: 2, title: "تیپ", amount: 2000000 },
          { id: 3, title: "هزینه اجاره", amount: -3000000 },
        ],
      });
      setLoading(false);
    }, 500);
  }, [jm]);

  return (
    <div className="p-4 space-y-4">
      <Button variant="outline" onClick={() => router.push('/dashboard/accounting')}>بازگشت به نمای کلی</Button>
      <Card>
        <CardHeader>
          <CardTitle>جزییات ماه {monthName}</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div>در حال بارگذاری...</div>
          ) : (
            <div>
              <div className="mb-4">
                <span className="font-bold">درآمد:</span> {data.income.toLocaleString('fa-IR')} تومان<br/>
                <span className="font-bold">هزینه:</span> {data.expense.toLocaleString('fa-IR')} تومان
              </div>
              <div>
                <span className="font-bold">تراکنش‌ها:</span>
                <ul className="list-disc pr-6 mt-2">
                  {data.transactions.map((t: any) => (
                    <li key={t.id} className={t.amount < 0 ? 'text-red-600' : 'text-green-700'}>
                      {t.title}: {Math.abs(t.amount).toLocaleString('fa-IR')} تومان
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
} 