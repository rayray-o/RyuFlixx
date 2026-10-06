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
          "--color-warning": "#f9a8d4",
        } as React.CSSProperties
      }
    >
      {children}
    </div>
  );
}
