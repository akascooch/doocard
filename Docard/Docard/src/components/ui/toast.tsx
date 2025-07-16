"use client"

import * as React from "react"
import * as ToastPrimitives from "@radix-ui/react-toast"
import { cva, type VariantProps } from "class-variance-authority"
import { XMarkIcon } from "@heroicons/react/24/outline"

import { cn } from "@/lib/utils"

export function ToastClose(props: ToastCloseProps) {
  return (
    <ToastPrimitives.Close
      ref={props.ref}
      className={cn(
        "absolute left-2 top-2 rounded-md p-1 text-foreground/50 opacity-0 transition-opacity hover:text-foreground focus:opacity-100 focus:outline-none focus:ring-2 group-hover:opacity-100",
        props.className
      )}
      toast-close=""
      {...props}
    >
      <XMarkIcon className="h-4 w-4" />
    </ToastPrimitives.Close>
  )
} 