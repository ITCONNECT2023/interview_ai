import { signIn } from "@/auth";

export default function LoginPage() {
  return (
    <main className="page" style={{ maxWidth: 480, paddingTop: 110 }}>
      <section className="panel">
        <div className="panel-body" style={{ padding: 36 }}>
          <div className="brand"><span className="brand-mark">P</span><span>PressNote Desk</span></div>
          <h1 className="page-title" style={{ marginTop: 30 }}>취재 자료를 안전하게 검토하세요.</h1>
          <p className="page-subtitle">조직 Google 계정으로 로그인한 기자만 작업에 접근할 수 있습니다.</p>
          <form action={async () => { "use server"; await signIn("google", { redirectTo: "/jobs/new" }); }} style={{ marginTop: 28 }}>
            <button className="button button-primary" style={{ width: "100%", height: 46 }} type="submit">Google 조직 계정으로 로그인</button>
          </form>
        </div>
      </section>
    </main>
  );
}
