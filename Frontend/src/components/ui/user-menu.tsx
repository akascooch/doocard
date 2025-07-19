import { useState } from 'react'
import { Button } from "./button"
import { Icon } from "./icon"
import { User } from "@/types"

interface UserMenuProps {
  user: User
  onLogout: () => void
}

export function UserMenu({ user, onLogout }: UserMenuProps) {
  const [showMenu, setShowMenu] = useState(false)

  return (
    <div className="relative">
      <Button
        variant="ghost"
        size="sm"
        className="flex items-center gap-2"
        onClick={() => setShowMenu(!showMenu)}
      >
        <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center text-primary-foreground">
          {user.firstName?.charAt(0)}
        </div>
        <span>{user.firstName}</span>
      </Button>
      
      {showMenu && (
        <div className="absolute right-0 mt-2 w-48 rounded-md shadow-lg bg-background border">
          <div className="py-1">
            <button
              onClick={onLogout}
              className="flex w-full items-center gap-2 px-4 py-2 text-sm hover:bg-accent"
            >
              <Icon name="LogOut" size={16} />
              <span>خروج</span>
            </button>
          </div>
        </div>
      )}
    </div>
  )
} 