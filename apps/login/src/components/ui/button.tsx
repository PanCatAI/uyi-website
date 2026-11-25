import { Button as ButtonPrimitive } from "@base-ui/react/button"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "cn"

const buttonVariants = cva(
  "group/button inline-flex shrink-0 cursor-pointer items-center justify-center rounded-[6px] border border-transparent bg-clip-padding text-[15px] font-medium whitespace-nowrap transition-[background-color,color,border-color,transform] duration-150 outline-none select-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-uyi-lamp active:not-aria-[haspopup]:translate-y-px disabled:pointer-events-none disabled:opacity-45 [&_svg]:pointer-events-none [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default:
          "bg-uyi-lamp font-semibold text-uyi-ink hover:bg-[#ffebb9]",
        outline:
          "border-uyi-line bg-transparent text-uyi-text hover:border-uyi-mute",
        secondary:
          "border-uyi-line bg-transparent text-uyi-text hover:border-uyi-mute",
        ghost:
          "bg-transparent text-uyi-mute hover:text-uyi-text",
        destructive:
          "border-destructive/50 bg-transparent text-destructive hover:border-destructive",
        link:
          "rounded-none border-0 bg-transparent text-uyi-mute underline-offset-4 hover:text-uyi-text hover:underline",
      },
      size: {
        default: "h-10 gap-2 px-4",
        xs: "h-7 gap-1 px-2.5 text-[13px]",
        sm: "h-8 gap-1.5 px-3 text-[13px]",
        lg: "h-11 gap-2 px-5",
        icon: "size-9",
        "icon-xs": "size-7",
        "icon-sm": "size-8",
        "icon-lg": "size-10",
      },
    },
    compoundVariants: [
      {
        variant: "link",
        class: "h-auto px-0 py-0",
      },
    ],
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

function Button({
  className,
  variant = "default",
  size = "default",
  ...props
}: ButtonPrimitive.Props & VariantProps<typeof buttonVariants>) {
  return (
    <ButtonPrimitive
      data-slot="button"
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  )
}

export { Button, buttonVariants }
