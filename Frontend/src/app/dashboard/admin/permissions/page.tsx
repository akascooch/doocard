"use client";

import { useEffect, useState } from "react";
import axios from "@/lib/axios";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

const pages = [
  { key: "dashboard", label: "داشبورد" },
  { key: "appointments", label: "نوبت‌ها" },
  { key: "customers", label: "مشتریان" },
  { key: "accounting", label: "حسابداری" },
  { key: "users", label: "مدیریت کاربران" },
  { key: "settings", label: "تنظیمات" },
];
const features = ["view", "create", "edit", "delete"];
const roles = [
  { key: "ADMIN", label: "ادمین" },
  { key: "BARBER", label: "آرایشگر" },
  { key: "CUSTOMER", label: "مشتری" },
];

export default function PermissionsPage() {
  const [permissions, setPermissions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedRole, setSelectedRole] = useState("ADMIN");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchPermissions(selectedRole);
  }, [selectedRole]);

  const fetchPermissions = async (role: string) => {
    setLoading(true);
    try {
      const res = await axios.get(`/permissions?role=${role}`);
      setPermissions(res.data);
    } catch {
      setPermissions([]);
    } finally {
      setLoading(false);
    }
  };

  const handleToggle = (page: string, feature: string) => {
    setPermissions((prev) => {
      const idx = prev.findIndex((p: any) => p.page === page && p.feature === feature);
      if (idx > -1) {
        return prev.map((p, i) =>
          i === idx ? { ...p, canView: !p.canView } : p
        );
      } else {
        return [...prev, { role: selectedRole, page, feature, canView: true }];
      }
    });
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await axios.post("/permissions/bulk", { role: selectedRole, permissions });
      alert("دسترسی‌ها ذخیره شد.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>مدیریت دسترسی کاربران</CardTitle>
        <div className="flex gap-4 mt-4">
          {roles.map((r) => (
            <Button key={r.key} variant={selectedRole === r.key ? "primary" : "outline"} onClick={() => setSelectedRole(r.key)}>
              {r.label}
            </Button>
          ))}
        </div>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div>در حال بارگذاری...</div>
        ) : (
          <table className="min-w-full border rounded text-sm">
            <thead>
              <tr>
                <th className="p-2">صفحه</th>
                {features.map((f) => (
                  <th key={f} className="p-2">{f}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {pages.map((page) => (
                <tr key={page.key}>
                  <td className="p-2 font-bold">{page.label}</td>
                  {features.map((feature) => {
                    const perm = permissions.find((p: any) => p.page === page.key && p.feature === feature);
                    return (
                      <td key={feature} className="p-2 text-center">
                        <input
                          type="checkbox"
                          checked={!!perm?.canView}
                          onChange={() => handleToggle(page.key, feature)}
                        />
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        )}
        <div className="mt-6 flex justify-end">
          <Button onClick={handleSave} disabled={saving}>{saving ? "در حال ذخیره..." : "ذخیره تغییرات"}</Button>
        </div>
      </CardContent>
    </Card>
  );
} 