import Link from "next/link";

const steps = ["음성 업로드", "전사 중", "전사 검토", "기사 초안"];

export function AppShell({ active, children }: { active: 1 | 2 | 3 | 4; children: React.ReactNode }) {
  return (
    <div className="shell">
      <header className="topbar">
        <Link href="/jobs/new" className="brand" aria-label="PressNote 홈">
          <span className="brand-mark">P</span>
          <span>PressNote <small style={{ color: "#2563eb" }}>Desk</small></span>
        </Link>
        <nav className="stepper" aria-label="작업 단계">
          {steps.map((step, index) => {
            const number = index + 1;
            return <div key={step} className={`step ${number === active ? "active" : number < active ? "done" : ""}`} data-step={number}><span>{step}</span></div>;
          })}
        </nav>
        <span className="badge">30일 자동 삭제</span>
      </header>
      {children}
    </div>
  );
}
