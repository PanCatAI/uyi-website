import { Toaster as Sonner, type ToasterProps } from "sonner"

const Toaster = ({ theme = "dark", ...props }: ToasterProps) => {
  return (
    <Sonner
      theme={theme}
      className="toaster group"
      icons={{
        success: null,
        info: null,
        warning: null,
        error: null,
        loading: null,
      }}
      style={
        {
          "--normal-bg": "var(--ink)",
          "--normal-text": "var(--text)",
          "--normal-border": "var(--line)",
          "--border-radius": "6px",
        } as React.CSSProperties
      }
      toastOptions={{
        classNames: {
          toast: "cn-toast text-[13px] shadow-none",
        },
      }}
      {...props}
    />
  )
}

export { Toaster }
