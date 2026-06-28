/// <reference types="vite/client" />
declare const GITHUB_RUNTIME_PERMANENT_NAME: string
declare const BASE_KV_SERVICE_URL: string

// Shadcn UI components import lucide-react via subpath — declare them to satisfy noImplicitAny
declare module 'lucide-react/dist/esm/icons/*' {
  import type { FC, SVGProps } from 'react'
  const Icon: FC<SVGProps<SVGSVGElement> & { size?: number | string; strokeWidth?: number | string }>
  export default Icon
}