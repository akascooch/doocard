"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import axios from "@/lib/axios";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/components/ui/use-toast";
import { 
  Users, 
  Shield, 
  Settings, 
  Save, 
  RotateCcw, 
  Eye, 
  Edit, 
  Plus, 
  Trash2,
  CheckCircle,
  XCircle,
  AlertCircle
} from "lucide-react";

interface Permission {
  id?: number;
  role?: string;
  userId?: number;
  page: string;
  feature: string;
  canView: boolean;
  canCreate: boolean;
  canEdit: boolean;
  canDelete: boolean;
}

interface Page {
  key: string;
  label: string;
}

interface Feature {
  key: string;
  label: string;
}

interface User {
  id: number;
  firstName: string;
  lastName: string;
  email: string;
  role: string;
}

export default function PermissionsPage() {
  const searchParams = useSearchParams();
  const userId = searchParams.get('userId');
  
  const [activeTab, setActiveTab] = useState("roles");
  const [selectedRole, setSelectedRole] = useState("ADMIN");
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [users, setUsers] = useState<User[]>([]);
  const [permissions, setPermissions] = useState<Permission[]>([]);
  const [pages, setPages] = useState<Page[]>([]);
  const [features, setFeatures] = useState<Feature[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [userPermissionsSummary, setUserPermissionsSummary] = useState<any>({});
  
  const { toast } = useToast();

  const roles = [
    { key: "ADMIN", label: "ادمین", icon: Shield },
    { key: "BARBER", label: "آرایشگر", icon: Users },
    { key: "CUSTOMER", label: "مشتری", icon: Users },
  ];

  useEffect(() => {
    fetchInitialData();
  }, []);

  useEffect(() => {
    if (activeTab === "roles") {
      fetchRolePermissions(selectedRole);
    } else if (activeTab === "users" && selectedUser) {
      fetchUserPermissions(selectedUser.id);
    }
  }, [activeTab, selectedRole, selectedUser]);

  const fetchInitialData = async () => {
    try {
      setLoading(true);
      
      // دریافت صفحات و قابلیت‌های موجود
      const [pagesRes, featuresRes, usersRes] = await Promise.all([
        axios.get('/permissions/pages'),
        axios.get('/permissions/features'),
        axios.get('/users')
      ]);
      
      setPages(pagesRes.data);
      setFeatures(featuresRes.data);
      setUsers(usersRes.data);
      
      // اگر userId در URL وجود دارد، به تب کاربران برو
      if (userId) {
        const user = usersRes.data.find((u: User) => u.id.toString() === userId);
        if (user) {
          setSelectedUser(user);
          setActiveTab("users");
        }
      }
      
    } catch (error) {
      console.error('Error fetching initial data:', error);
      toast({
        title: "خطا",
        description: "خطا در بارگذاری اطلاعات",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const fetchRolePermissions = async (role: string) => {
    try {
      const response = await axios.get(`/permissions?role=${role}`);
      setPermissions(response.data);
    } catch (error) {
      console.error('Error fetching role permissions:', error);
      setPermissions([]);
    }
  };

  const fetchUserPermissions = async (userId: number) => {
    try {
      const [permissionsRes, summaryRes] = await Promise.all([
        axios.get(`/permissions?userId=${userId}`),
        axios.get(`/permissions/user/${userId}/summary`)
      ]);
      setPermissions(permissionsRes.data);
      setUserPermissionsSummary(summaryRes.data);
    } catch (error) {
      console.error('Error fetching user permissions:', error);
      setPermissions([]);
      setUserPermissionsSummary({});
    }
  };

  const handlePermissionToggle = (page: string, feature: string, value: boolean) => {
    setPermissions(prev => {
      const existingIndex = prev.findIndex(p => p.page === page && p.feature === feature);
      
      if (existingIndex > -1) {
        const updated = [...prev];
        updated[existingIndex] = {
          ...updated[existingIndex],
          [`can${feature.charAt(0).toUpperCase() + feature.slice(1)}`]: value
        };
        return updated;
      } else {
        return [...prev, {
          page,
          feature,
          canView: feature === 'view' ? value : false,
          canCreate: feature === 'create' ? value : false,
          canEdit: feature === 'edit' ? value : false,
          canDelete: feature === 'delete' ? value : false,
        }];
      }
    });
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      if (activeTab === "roles") {
        await axios.post("/api/permissions/bulk", { 
          role: selectedRole, 
          permissions: permissions.filter(p => p.canView || p.canCreate || p.canEdit || p.canDelete)
        });
        toast({
          title: "موفقیت",
          description: "دسترسی‌های نقش با موفقیت ذخیره شد",
        });
      } else if (activeTab === "users" && selectedUser) {
        await axios.post(`/permissions/user/${selectedUser.id}`, { 
          permissions: permissions.filter(p => p.canView || p.canCreate || p.canEdit || p.canDelete)
        });
        toast({
          title: "موفقیت",
          description: "دسترسی‌های کاربر با موفقیت ذخیره شد",
        });
      }
    } catch (error) {
      console.error('Error saving permissions:', error);
      toast({
        title: "خطا",
        description: "خطا در ذخیره دسترسی‌ها",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const handleResetToDefault = async () => {
    try {
      if (activeTab === "roles") {
        await axios.post(`/permissions/reset/${selectedRole}`);
        await fetchRolePermissions(selectedRole);
        toast({
          title: "موفقیت",
          description: "دسترسی‌های پیش‌فرض بازگردانی شد",
        });
      }
    } catch (error) {
      console.error('Error resetting permissions:', error);
      toast({
        title: "خطا",
        description: "خطا در بازگردانی دسترسی‌ها",
        variant: "destructive",
      });
    }
  };

  const getPermissionValue = (page: string, feature: string): boolean => {
    const permission = permissions.find(p => p.page === page && p.feature === feature);
    if (!permission) return false;
    
    const permissionKey = `can${feature.charAt(0).toUpperCase() + feature.slice(1)}` as keyof Permission;
    return permission[permissionKey] as boolean;
  };

  const getFeatureIcon = (feature: string) => {
    switch (feature) {
      case 'view': return <Eye className="w-4 h-4" />;
      case 'create': return <Plus className="w-4 h-4" />;
      case 'edit': return <Edit className="w-4 h-4" />;
      case 'delete': return <Trash2 className="w-4 h-4" />;
      default: return null;
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
          <p>در حال بارگذاری...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Settings className="w-5 h-5" />
            مدیریت دسترسی‌ها
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="roles" className="flex items-center gap-2">
                <Shield className="w-4 h-4" />
                دسترسی‌های نقش‌ها
              </TabsTrigger>
              <TabsTrigger value="users" className="flex items-center gap-2">
                <Users className="w-4 h-4" />
                دسترسی‌های کاربران
              </TabsTrigger>
            </TabsList>

            <TabsContent value="roles" className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex gap-2">
                  {roles.map((role) => {
                    const Icon = role.icon;
                    return (
                      <Button
                        key={role.key}
                        variant={selectedRole === role.key ? "default" : "outline"}
                        onClick={() => setSelectedRole(role.key)}
                        className="flex items-center gap-2"
                      >
                        <Icon className="w-4 h-4" />
                        {role.label}
                      </Button>
                    );
                  })}
                </div>
                <Button
                  variant="outline"
                  onClick={handleResetToDefault}
                  className="flex items-center gap-2"
                >
                  <RotateCcw className="w-4 h-4" />
                  بازگردانی پیش‌فرض
                </Button>
              </div>

              <div className="border rounded-lg overflow-hidden">
                <div className="bg-muted p-4">
                  <h3 className="font-semibold">دسترسی‌های نقش: {roles.find(r => r.key === selectedRole)?.label}</h3>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-muted/50">
                      <tr>
                        <th className="p-3 text-right font-medium">صفحه</th>
                        {features.map((feature) => (
                          <th key={feature.key} className="p-3 text-center font-medium">
                            <div className="flex items-center justify-center gap-1">
                              {getFeatureIcon(feature.key)}
                              {feature.label}
                            </div>
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {pages.map((page) => (
                        <tr key={page.key} className="border-t">
                          <td className="p-3 font-medium">{page.label}</td>
                          {features.map((feature) => (
                            <td key={feature.key} className="p-3 text-center">
                              <Switch
                                checked={getPermissionValue(page.key, feature.key)}
                                onCheckedChange={(checked) => 
                                  handlePermissionToggle(page.key, feature.key, checked)
                                }
                              />
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </TabsContent>

            <TabsContent value="users" className="space-y-4">
              <div className="flex items-center gap-4">
                <Label htmlFor="user-select">انتخاب کاربر:</Label>
                <Select
                  onValueChange={(value) => {
                    const user = users.find(u => u.id.toString() === value);
                    setSelectedUser(user || null);
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="کاربری را انتخاب کنید" />
                  </SelectTrigger>
                  <SelectContent>
                    {users.map((user) => (
                      <SelectItem key={user.id} value={user.id.toString()}>
                        <div className="flex items-center gap-2">
                          <span>{user.firstName} {user.lastName}</span>
                          <Badge variant="outline">{user.role}</Badge>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {selectedUser && (
                <div className="space-y-4">
                  <div className="bg-muted p-4 rounded-lg">
                    <h3 className="font-semibold mb-2">خلاصه دسترسی‌های کاربر</h3>
                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-2">
                      {Object.entries(userPermissionsSummary).map(([page, perms]: [string, any]) => (
                        <div key={page} className="text-sm">
                          <div className="font-medium">{pages.find(p => p.key === page)?.label || page}</div>
                          <div className="flex gap-1 mt-1">
                            {Object.entries(perms).map(([feature, hasPermission]) => (
                              <div key={feature} className="flex items-center gap-1">
                                {hasPermission ? (
                                  <CheckCircle className="w-3 h-3 text-green-500" />
                                ) : (
                                  <XCircle className="w-3 h-3 text-red-500" />
                                )}
                                <span className="text-xs">{features.find(f => f.key === feature)?.label}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="border rounded-lg overflow-hidden">
                    <div className="bg-muted p-4">
                      <h3 className="font-semibold">
                        ویرایش دسترسی‌های کاربر: {selectedUser.firstName} {selectedUser.lastName}
                      </h3>
                      <p className="text-sm text-muted-foreground">
                        دسترسی‌های مخصوص کاربر (اولویت بالاتر از دسترسی‌های نقش)
                      </p>
                    </div>
                    <div className="overflow-x-auto">
                      <table className="w-full">
                        <thead className="bg-muted/50">
                          <tr>
                            <th className="p-3 text-right font-medium">صفحه</th>
                            {features.map((feature) => (
                              <th key={feature.key} className="p-3 text-center font-medium">
                                <div className="flex items-center justify-center gap-1">
                                  {getFeatureIcon(feature.key)}
                                  {feature.label}
                                </div>
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {pages.map((page) => (
                            <tr key={page.key} className="border-t">
                              <td className="p-3 font-medium">{page.label}</td>
                              {features.map((feature) => (
                                <td key={feature.key} className="p-3 text-center">
                                  <Switch
                                    checked={getPermissionValue(page.key, feature.key)}
                                    onCheckedChange={(checked) => 
                                      handlePermissionToggle(page.key, feature.key, checked)
                                    }
                                  />
                                </td>
                              ))}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              )}
            </TabsContent>
          </Tabs>

          <div className="flex justify-end mt-6">
            <Button
              onClick={handleSave}
              disabled={saving}
              className="flex items-center gap-2"
            >
              <Save className="w-4 h-4" />
              {saving ? "در حال ذخیره..." : "ذخیره تغییرات"}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
} 