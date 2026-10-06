export default function AnimeLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <div
      className="anime-theme"
      style={
        {
          "--heroui-warning": "330 81% 75%",
          "--heroui-warning-foreground": "0 0% 0%",
        } as React.CSSProperties
      }
    >
      {children}
    </div>
  );
}
