import logo from '@/assets/images/logo_Background_Removed.webp'

export function SplashScreen() {
  return (
    <div className="fixed inset-0 flex flex-col items-center justify-center bg-background gap-6">
      <img
        src={logo}
        alt="PublicLogic"
        className="w-16 h-16 object-contain opacity-90"
      />
      <div className="flex gap-1.5">
        {[0, 1, 2].map(i => (
          <span
            key={i}
            className="w-1.5 h-1.5 rounded-full bg-muted-foreground/40 animate-bounce"
            style={{ animationDelay: `${i * 150}ms` }}
          />
        ))}
      </div>
    </div>
  )
}
