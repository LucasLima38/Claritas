import { Toaster as Sonner } from "sonner"
import { useEffect, useState } from "react"

const DARK_THEME_CLASSES = ['dark', 'theme-charcoal', 'theme-black-moon', 'theme-blue-moon']

function resolveTheme() {
  const classList = document.documentElement.classList
  return DARK_THEME_CLASSES.some(c => classList.contains(c)) ? 'dark' : 'light'
}

const Toaster = ({ ...props }) => {
  const [theme, setTheme] = useState(resolveTheme)

  useEffect(() => {
    const obs = new MutationObserver(() => setTheme(resolveTheme()))
    obs.observe(document.documentElement, { attributeFilter: ['class'] })
    return () => obs.disconnect()
  }, [])

  return (
    <Sonner
      theme={theme}
      className="toaster group"
      toastOptions={{
        classNames: {
          toast: "group toast group-[.toaster]:bg-background group-[.toaster]:text-foreground group-[.toaster]:border-border group-[.toaster]:shadow-lg",
          description: "group-[.toast]:text-muted-foreground",
          actionButton: "group-[.toast]:bg-primary group-[.toast]:text-primary-foreground",
          cancelButton: "group-[.toast]:bg-muted group-[.toast]:text-muted-foreground",
        },
      }}
      {...props}
    />
  )
}

export { Toaster }
