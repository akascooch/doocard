declare module "@/components/ui/icon" {
  interface IconProps {
    name: string;
    size?: number;
    className?: string;
  }
  export function Icon(props: IconProps): JSX.Element;
}

declare module "@/components/ui/button" {
  interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
    variant?: "default" | "ghost" | "primary" | "outline";
    size?: "default" | "sm" | "lg" | "icon";
    children: React.ReactNode;
  }
  export function Button(props: ButtonProps): JSX.Element;
}

declare module "@/components/ui/card" {
  interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
    children: React.ReactNode;
  }
  export function Card(props: CardProps): JSX.Element;
  export function CardHeader(props: CardProps): JSX.Element;
  export function CardTitle(props: CardProps): JSX.Element;
  export function CardDescription(props: CardProps): JSX.Element;
  export function CardContent(props: CardProps): JSX.Element;
}

declare module "@/components/ui/dialog" {
  interface DialogProps {
    children: React.ReactNode;
    open?: boolean;
    onOpenChange?: (open: boolean) => void;
  }
  interface DialogTriggerProps {
    children: React.ReactNode;
    asChild?: boolean;
  }
  export function Dialog(props: DialogProps): JSX.Element;
  export function DialogTrigger(props: DialogTriggerProps): JSX.Element;
  export function DialogContent(props: DialogProps): JSX.Element;
  export function DialogHeader(props: DialogProps): JSX.Element;
  export function DialogTitle(props: DialogProps): JSX.Element;
  export function DialogDescription(props: DialogProps): JSX.Element;
}

declare module "@/components/ui/form" {
  interface FormProps {
    children: React.ReactNode;
  }
  interface FormFieldProps {
    control: any;
    name: string;
    render: (props: { field: any }) => React.ReactNode;
  }
  interface FormItemProps {
    children: React.ReactNode;
  }
  interface FormLabelProps {
    children: React.ReactNode;
  }
  interface FormControlProps {
    children: React.ReactNode;
  }
  interface FormMessageProps {
    children?: React.ReactNode;
  }
  export function Form(props: FormProps): JSX.Element;
  export function FormField(props: FormFieldProps): JSX.Element;
  export function FormItem(props: FormItemProps): JSX.Element;
  export function FormLabel(props: FormLabelProps): JSX.Element;
  export function FormControl(props: FormControlProps): JSX.Element;
  export function FormMessage(props: FormMessageProps): JSX.Element;
}

declare module "@/components/ui/input" {
  interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {}
  export function Input(props: InputProps): JSX.Element;
}

declare module "@/components/ui/select" {
  interface SelectProps {
    children: React.ReactNode;
    onValueChange?: (value: string) => void;
    defaultValue?: string;
  }
  interface SelectTriggerProps {
    children: React.ReactNode;
  }
  interface SelectContentProps {
    children: React.ReactNode;
  }
  interface SelectItemProps {
    children: React.ReactNode;
    value: string;
  }
  interface SelectValueProps {
    children?: React.ReactNode;
    placeholder?: string;
  }
  export function Select(props: SelectProps): JSX.Element;
  export function SelectTrigger(props: SelectTriggerProps): JSX.Element;
  export function SelectContent(props: SelectContentProps): JSX.Element;
  export function SelectItem(props: SelectItemProps): JSX.Element;
  export function SelectValue(props: SelectValueProps): JSX.Element;
}

declare module "@/components/ui/table" {
  interface TableProps {
    children: React.ReactNode;
  }
  interface TableHeaderProps {
    children: React.ReactNode;
  }
  interface TableBodyProps {
    children: React.ReactNode;
  }
  interface TableHeadProps {
    children: React.ReactNode;
  }
  interface TableRowProps {
    children: React.ReactNode;
  }
  interface TableCellProps {
    children: React.ReactNode;
    colSpan?: number;
    className?: string;
    dir?: "ltr" | "rtl";
  }
  export function Table(props: TableProps): JSX.Element;
  export function TableHeader(props: TableHeaderProps): JSX.Element;
  export function TableBody(props: TableBodyProps): JSX.Element;
  export function TableHead(props: TableHeadProps): JSX.Element;
  export function TableRow(props: TableRowProps): JSX.Element;
  export function TableCell(props: TableCellProps): JSX.Element;
}

declare module "@/components/ui/use-toast" {
  interface ToastProps {
    title?: string;
    description?: string;
    variant?: "default" | "destructive";
  }
  export function useToast(): {
    toast: (props: ToastProps) => void;
  };
}

declare module "@/components/header" {
  export function Header(): JSX.Element;
} 