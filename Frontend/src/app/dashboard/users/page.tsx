import { useEffect, useState } from 'react';
import api from '@/lib/axios';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/use-toast';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

interface User {
  id: number;
  firstName: string;
  lastName: string;
  email: string;
  phoneNumber: string;
  role: string;
  isActive: boolean;
  createdAt: string;
}

export default function UsersPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [importing, setImporting] = useState(false);
  const [converting, setConverting] = useState<number | null>(null);
  const [confirmDialog, setConfirmDialog] = useState<{
    open: boolean;
    user: User | null;
    action: 'convert' | 'import';
  }>({ open: false, user: null, action: 'convert' });
  const { toast } = useToast();

  const fetchUsers = async () => {
    try {
      const response = await api.get('/users');
      setUsers(response.data);
    } catch (error) {
      toast({
        title: 'خطا در دریافت کاربران',
        description: 'لطفاً دوباره تلاش کنید',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  const handleConvertToBarber = async (user: User) => {
    setConfirmDialog({ open: true, user, action: 'convert' });
  };

  const handleImportUser = async (user: User) => {
    setConfirmDialog({ open: true, user, action: 'import' });
  };

  const handleConfirmAction = async () => {
    if (!confirmDialog.user) return;

         if (confirmDialog.action === 'convert') {
       setConverting(confirmDialog.user.id);
       try {
         await api.post(`/users/convert-to-barber/${confirmDialog.user.id}`);
         toast({
           title: 'تبدیل موفق',
           description: 'کاربر با موفقیت به آرایشگر تبدیل شد',
         });
         fetchUsers();
       } catch (error) {
         toast({
           title: 'خطا در تبدیل',
           description: 'لطفاً دوباره تلاش کنید',
           variant: 'destructive',
         });
       } finally {
         setConverting(null);
       }
     } else if (confirmDialog.action === 'import') {
      setImporting(true);
      try {
        await api.post('/users/sync-role', { 
          userId: confirmDialog.user.id, 
          role: confirmDialog.user.role 
        });
        toast({
          title: 'ایمپورت موفق',
          description: 'کاربر با موفقیت ایمپورت شد',
        });
        fetchUsers();
      } catch (error) {
        toast({
          title: 'خطا در ایمپورت',
          description: 'لطفاً دوباره تلاش کنید',
          variant: 'destructive',
        });
      } finally {
        setImporting(false);
      }
    }

    setConfirmDialog({ open: false, user: null, action: 'convert' });
  };

  const getRoleBadge = (role: string) => {
    switch (role) {
      case 'ADMIN':
        return <Badge variant="destructive">ادمین</Badge>;
      case 'BARBER':
        return <Badge variant="default">آرایشگر</Badge>;
      case 'CUSTOMER':
        return <Badge variant="secondary">مشتری</Badge>;
      default:
        return <Badge variant="outline">{role}</Badge>;
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">مدیریت کاربران</h1>
      </div>

      <div className="grid gap-4">
        {users.map((user) => (
          <Card key={user.id}>
            <CardHeader>
              <div className="flex items-center justify-between">
    <div>
                  <CardTitle className="text-lg">
                    {user.firstName} {user.lastName}
                  </CardTitle>
                  <p className="text-sm text-muted-foreground">{user.email}</p>
                  <p className="text-sm text-muted-foreground">{user.phoneNumber}</p>
                </div>
                <div className="flex items-center gap-2">
                  {getRoleBadge(user.role)}
                  {user.role === 'CUSTOMER' && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleConvertToBarber(user)}
                      disabled={converting === user.id}
                    >
                      {converting === user.id ? 'در حال تبدیل...' : 'تبدیل به آرایشگر'}
                    </Button>
                  )}
                  {user.role === 'BARBER' && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleImportUser(user)}
                      disabled={importing}
                    >
                      {importing ? 'در حال ایمپورت...' : 'ایمپورت'}
        </Button>
                  )}
                </div>
              </div>
            </CardHeader>
          </Card>
        ))}
      </div>

      <Dialog open={confirmDialog.open} onOpenChange={(open) => setConfirmDialog(s => ({ ...s, open }))}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {confirmDialog.action === 'convert' ? 'تبدیل کاربر' : 'ایمپورت کاربر'}
            </DialogTitle>
            <DialogDescription>
              {confirmDialog.action === 'convert' 
                ? `آیا مطمئن هستید که می‌خواهید ${confirmDialog.user?.firstName} ${confirmDialog.user?.lastName} را به آرایشگر تبدیل کنید؟`
                : `آیا مطمئن هستید که می‌خواهید ${confirmDialog.user?.firstName} ${confirmDialog.user?.lastName} را ایمپورت کنید؟`
              }
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmDialog({ open: false, user: null, action: 'convert' })}>
              انصراف
            </Button>
            <Button onClick={handleConfirmAction}>
              {confirmDialog.action === 'convert' ? 'تبدیل' : 'ایمپورت'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
} 