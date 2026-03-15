export default function AdminStudioLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Full-screen layout — deliberately no root nav or sidebar.
  // The studio manages its own top bar internally.
  return (
    <div style={{ height: "100vh", overflow: "hidden" }}>
      {children}
    </div>
  );
}